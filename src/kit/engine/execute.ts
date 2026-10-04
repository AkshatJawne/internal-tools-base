import type { User } from "@prisma/client";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { emit } from "@/kit/automation";
import { getSettings } from "@/kit/settings";
import { DEFINITIONS } from "@/apps/definitions";
import { getFields, redact } from "./fields";
import type { RecordData } from "./types";

export async function executeRecordAction(p: { appId: string; recordId: string; actionId: string; actor: User; reason?: string | null }) {
  const def = DEFINITIONS[p.appId];
  const action = def?.actions.find((a) => a.id === p.actionId);
  if (!def || !action) throw new Error("Unknown action");
  const rec = await db.record.findUnique({ where: { id: p.recordId } });
  if (!rec || rec.appId !== p.appId) throw new Error("Record not found");
  if (!action.from.includes(rec.status) && rec.status !== "pending_approval") throw new Error(`Can't ${action.label} from status ${rec.status}`);

  const data = JSON.parse(rec.data) as RecordData;
  const extra = (await action.effect?.({ appId: p.appId, recordId: rec.id, data })) ?? {};
  const next = { ...data, ...extra };
  await db.record.update({ where: { id: rec.id }, data: { status: action.to, data: JSON.stringify(next) } });

  const fields = getFields(def, await getSettings());
  await audit({
    actor: p.actor,
    action: `record.${action.id}`,
    appId: p.appId,
    entityType: "Record",
    entityId: rec.id,
    before: { status: rec.status },
    after: { status: action.to, ...extra },
    reason: p.reason,
  });
  await emit(`${p.appId}.${action.id}`, { appId: p.appId, entityType: "Record", entityId: rec.id, data: redact(fields, next) });
}
