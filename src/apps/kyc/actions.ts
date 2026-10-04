"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { requestApproval } from "@/kit/approvals";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { errorMessage, type FormState } from "@/kit/action-state";
import { RISK_ORDER } from "./risk";
import { applyDecision } from "./decision";

/** Assigns the highest-risk, oldest unassigned case. The conditional update prevents two analysts claiming the same case. */
export async function claimNextCase() {
  const user = await requirePermission("kyc.case.claim");
  const candidates = await db.kycCase.findMany({ where: { status: "new", assigneeId: null }, select: { id: true, riskTier: true, receivedAt: true } });
  candidates.sort((a, b) => RISK_ORDER[a.riskTier] - RISK_ORDER[b.riskTier] || a.receivedAt.getTime() - b.receivedAt.getTime());
  for (const c of candidates) {
    const res = await db.kycCase.updateMany({ where: { id: c.id, assigneeId: null, status: "new" }, data: { assigneeId: user.id, status: "in_review" } });
    if (res.count === 1) {
      await audit({ actor: user, action: "kyc.case.claimed", appId: "kyc", entityType: "KycCase", entityId: c.id, before: { status: "new", assignee: null }, after: { status: "in_review", assignee: user.name } });
      redirect(`/kyc/${c.id}`);
    }
  }
  redirect("/kyc?empty=1");
}

export async function reassignCase(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("kyc.case.reassign");
    const caseId = String(formData.get("caseId"));
    const target = await db.user.findUnique({ where: { id: String(formData.get("assigneeId")) } });
    if (!target || !can(target, "kyc.case.decide")) return { error: "Pick an analyst who can decide cases" };
    const c = await db.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    if (["approved", "rejected", "pending_signoff"].includes(c.status)) return { error: `Can't reassign a ${c.status} case` };
    await db.kycCase.update({ where: { id: caseId }, data: { assigneeId: target.id, status: "in_review" } });
    await audit({ actor: user, action: "kyc.case.reassigned", appId: "kyc", entityType: "KycCase", entityId: caseId, before: { assigneeId: c.assigneeId, status: c.status }, after: { assignee: target.name, status: "in_review" } });
    revalidatePath(`/kyc/${caseId}`);
    return { ok: `Assigned to ${target.name}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const decisionSchema = z.object({
  caseId: z.string(),
  decision: z.enum(["approve", "reject", "escalate"]),
  reasonCode: z.string().min(1, "Pick a reason code"),
  note: z.string().max(2000).default(""),
});

export async function decideCase(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("kyc.case.decide");
    const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid decision" };
    const { caseId, decision, reasonCode, note } = parsed.data;
    const settings = await getSettings();
    if (!settings.kycReasonCodes[decision].includes(reasonCode)) return { error: "Reason code doesn't match the decision" };

    const c = await db.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    if (c.status !== "in_review" || c.assigneeId !== user.id) return { error: "Only the assigned analyst can decide an in-review case" };

    if (decision !== "escalate" && (settings.makerCheckerTiers as string[]).includes(c.riskTier)) {
      await db.kycCase.update({ where: { id: c.id }, data: { status: "pending_signoff", decision, decisionReason: reasonCode, decisionNote: note } });
      await requestApproval({
        kind: "kyc.decision",
        appId: "kyc",
        entityType: "KycCase",
        entityId: c.id,
        summary: `${decision.toUpperCase()} ${c.externalRef} (${c.riskTier} risk): ${reasonCode}`,
        payload: { caseId: c.id, decision, reasonCode, note },
        maker: user,
        makerReason: note || reasonCode,
        requiredPermission: "kyc.case.signoff",
      });
      revalidatePath(`/kyc/${caseId}`);
      return { ok: "Decision recorded. Waiting for a lead's sign-off (four-eyes)." };
    }
    await applyDecision({ caseId, decision, reasonCode, note, actor: user });
    revalidatePath(`/kyc/${caseId}`);
    return { ok: `Case ${decision === "escalate" ? "escalated" : decision + "d"}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
