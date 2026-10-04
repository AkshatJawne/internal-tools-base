import type { User } from "@prisma/client";
import { db, withTransaction } from "@/kit/db";
import { audit } from "@/kit/audit";
import { emit } from "@/kit/automation";
import { getSettings } from "@/kit/settings";
import type { ApprovalHandler } from "@/kit/approvals";
import { DEFINITIONS } from "@/apps/definitions";
import { getFields, redact, seal } from "./fields";
import { PENDING_APPROVAL } from "./definition";
import type { RecordData } from "./types";

/**
 * Runs an action on a record. `from` is the status the caller saw; the transition is an optimistic update guarded
 * by it, so two concurrent runs cannot both apply. The connector effect runs first and is idempotent per record,
 * which makes a failed commit safe to retry; state and its audit event then commit in one transaction.
 */
export async function executeRecordAction(p: { appId: string; recordId: string; actionId: string; from: string; actor: User; reason?: string | null }) {
  const def = DEFINITIONS[p.appId];
  const action = def?.actions.find((a) => a.id === p.actionId);
  if (!def || !action) throw new Error("Unknown action");
  const rec = await db.record.findUnique({ where: { id: p.recordId } });
  if (!rec || rec.appId !== p.appId) throw new Error("Record not found");
  if (rec.status !== p.from) throw new Error(`Record is now ${rec.status}; reload and try again`);
  if (p.from !== PENDING_APPROVAL && !action.from.includes(p.from)) throw new Error(`Can't ${action.label} from status ${p.from}`);

  const fields = getFields(def, await getSettings());
  const data = JSON.parse(rec.data) as RecordData;
  const extra = (await action.effect?.({ appId: p.appId, recordId: rec.id, data })) ?? {};
  const next = seal(fields, { ...data, ...extra });
  await withTransaction(async (tx) => {
    const moved = await tx.record.updateMany({ where: { id: rec.id, status: p.from }, data: { status: action.to, data: JSON.stringify(next) } });
    if (moved.count !== 1) throw new Error("Record changed while the action was running; nothing was saved");
    await audit(
      {
        actor: p.actor,
        action: `record.${action.id}`,
        appId: p.appId,
        entityType: "Record",
        entityId: rec.id,
        before: { status: p.from },
        after: { status: action.to, ...redact(fields, extra) },
        reason: p.reason,
      },
      tx,
    );
  });
  await emit(`${p.appId}.${action.id}`, { appId: p.appId, entityType: "Record", entityId: rec.id, data: redact(fields, next) });
}

/** Approval handler for gated record actions (kind "engine.action"). Payload is written by runRecordAction. */
export const engineApprovalHandler: ApprovalHandler = {
  execute: async (p, { checker, approval }) => {
    await executeRecordAction({
      appId: String(p.appId),
      recordId: String(p.recordId),
      actionId: String(p.actionId),
      from: PENDING_APPROVAL,
      actor: checker,
      reason: `Approved (requested by ${approval.makerName}): ${approval.makerReason ?? ""}`,
    });
  },
  reject: async (p, { checker, approval }) => {
    await withTransaction(async (tx) => {
      await tx.record.updateMany({ where: { id: String(p.recordId), status: PENDING_APPROVAL }, data: { status: String(p.previousStatus) } });
      await audit(
        {
          actor: checker,
          action: "record.approval_rejected",
          appId: approval.appId,
          entityType: "Record",
          entityId: String(p.recordId),
          before: { status: PENDING_APPROVAL },
          after: { status: p.previousStatus },
          reason: approval.decisionReason,
        },
        tx,
      );
    });
  },
};
