"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kit/auth";
import { decideApproval } from "@/kit/approvals";
import { errorMessage, type FormState } from "@/kit/action-state";
import { APPROVAL_HANDLERS } from "@/apps/approval-handlers";

export async function decideApprovalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const checker = await requirePermission("approvals.read");
    const decision = formData.get("decision") === "approve" ? "approve" : "reject";
    await decideApproval({
      approvalId: String(formData.get("approvalId")),
      checker,
      decision,
      reason: String(formData.get("reason") ?? ""),
      handlers: APPROVAL_HANDLERS,
    });
    revalidatePath("/", "layout");
    return { ok: decision === "approve" ? "Approved and executed" : "Rejected" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
