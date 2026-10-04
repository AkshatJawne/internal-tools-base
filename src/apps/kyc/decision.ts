import type { User } from "@prisma/client";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { emit } from "@/kit/automation";

export const DECISION_STATUS = { approve: "approved", reject: "rejected", escalate: "escalated" } as const;
export type Decision = keyof typeof DECISION_STATUS;

export async function applyDecision(p: { caseId: string; decision: Decision; reasonCode: string; note: string; actor: User; signedOffBy?: string }) {
  const c = await db.kycCase.findUniqueOrThrow({ where: { id: p.caseId } });
  const status = DECISION_STATUS[p.decision];
  await db.kycCase.update({
    where: { id: c.id },
    data: { status, decision: p.decision, decisionReason: p.reasonCode, decisionNote: p.note, decidedAt: new Date() },
  });
  await audit({
    actor: p.actor,
    action: "kyc.case.decided",
    appId: "kyc",
    entityType: "KycCase",
    entityId: c.id,
    before: { status: c.status },
    after: { status, decision: p.decision, reasonCode: p.reasonCode, ...(p.signedOffBy ? { signedOffBy: p.signedOffBy } : {}) },
    reason: p.note || p.reasonCode,
  });
  await emit(`kyc.case.decided`, { appId: "kyc", entityType: "KycCase", entityId: c.id, data: { externalRef: c.externalRef, decision: p.decision, riskTier: c.riskTier } });
}
