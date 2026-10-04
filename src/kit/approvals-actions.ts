"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/kit/auth";
import { decideApproval, type ApprovalHandler } from "@/kit/approvals";
import { engineApprovalHandler } from "@/kit/engine/execute";
import { settingsApprovalHandler } from "@/kit/settings";
import { errorMessage, type FormState } from "@/kit/action-state";
import { APP_APPROVAL_HANDLERS } from "@/apps/approval-handlers";

// Kit-owned approval kinds live with the code they execute; custom apps add theirs in src/apps/approval-handlers.ts.
const HANDLERS: Record<string, ApprovalHandler> = {
  "engine.action": engineApprovalHandler,
  "settings.update": settingsApprovalHandler,
  ...APP_APPROVAL_HANDLERS,
};

export async function decideApprovalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const checker = await requirePermission("approvals.read");
    const decision = formData.get("decision") === "approve" ? "approve" : "reject";
    await decideApproval({
      approvalId: String(formData.get("approvalId")),
      checker,
      decision,
      reason: String(formData.get("reason") ?? ""),
      handlers: HANDLERS,
    });
    revalidatePath("/", "layout");
    return { ok: decision === "approve" ? "Approved and executed" : "Rejected" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
