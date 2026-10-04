import type { ApprovalHandler } from "@/kit/approvals";
import { withTransaction } from "@/kit/db";
import { audit } from "@/kit/audit";
import { applyDecision, type Decision } from "./decision";

export const kycDecisionHandler: ApprovalHandler = {
  execute: async (p, { checker }) => {
    await applyDecision({
      caseId: String(p.caseId),
      decision: p.decision as Decision,
      reasonCode: String(p.reasonCode),
      note: String(p.note ?? ""),
      actor: checker,
      signedOffBy: checker.name,
    });
  },
  reject: async (p, { checker, approval }) => {
    await withTransaction(async (tx) => {
      await tx.kycCase.update({ where: { id: String(p.caseId) }, data: { status: "in_review", decision: null, decisionReason: null } });
      await audit({ actor: checker, action: "kyc.case.signoff_rejected", appId: "kyc", entityType: "KycCase", entityId: String(p.caseId), before: { status: "pending_signoff" }, after: { status: "in_review" }, reason: approval.decisionReason }, tx);
    });
  },
};
