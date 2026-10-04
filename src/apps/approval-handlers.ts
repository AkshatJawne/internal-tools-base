import type { ApprovalHandler } from "@/kit/approvals";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { applySetting, type SettingKey, type Settings } from "@/kit/settings";
import { executeRecordAction } from "@/kit/engine/execute";
import { kycDecisionHandler } from "@/apps/kyc/handlers";

export const APPROVAL_HANDLERS: Record<string, ApprovalHandler> = {
  "engine.action": {
    execute: async (p, { checker, approval }) => {
      await executeRecordAction({
        appId: String(p.appId),
        recordId: String(p.recordId),
        actionId: String(p.actionId),
        actor: checker,
        reason: `Approved (requested by ${approval.makerName}): ${approval.makerReason ?? ""}`,
      });
    },
    reject: async (p, { checker, approval }) => {
      await db.record.update({ where: { id: String(p.recordId) }, data: { status: String(p.previousStatus) } });
      await audit({
        actor: checker,
        action: "record.approval_rejected",
        appId: approval.appId,
        entityType: "Record",
        entityId: String(p.recordId),
        before: { status: "pending_approval" },
        after: { status: p.previousStatus },
        reason: approval.decisionReason,
      });
    },
  },
  "settings.update": {
    execute: async (p, { checker, approval }) => {
      const key = p.key as SettingKey;
      await applySetting(key, p.value as Settings[typeof key], checker, `Approved change requested by ${approval.makerName}`);
    },
  },
  "kyc.decision": kycDecisionHandler,
};
