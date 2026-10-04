"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, withTransaction } from "@/kit/db";
import { audit } from "@/kit/audit";
import { emit } from "@/kit/automation";
import { requirePermission } from "@/kit/auth";
import { requestApproval } from "@/kit/approvals";
import { getSettings } from "@/kit/settings";
import { errorMessage, type FormState } from "@/kit/action-state";
import { DEFINITIONS } from "@/apps/definitions";
import { getFields, parseForm, redact, seal } from "./fields";
import { executeRecordAction } from "./execute";
import { PENDING_APPROVAL } from "./definition";
import type { RecordData } from "./types";

export async function createRecordAction(appId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const def = DEFINITIONS[appId];
  if (!def) return { error: "Unknown app" };
  let recordId: string;
  try {
    const user = await requirePermission(def.permissions.create);
    const settings = await getSettings();
    const fields = getFields(def, settings);
    const parsed = parseForm(fields, settings, formData);
    if (!parsed.data) return { error: parsed.error };
    const safe = redact(fields, parsed.data);
    const rec = await withTransaction(async (tx) => {
      const rec = await tx.record.create({
        data: { appId, status: def.initialStatus, data: JSON.stringify(seal(fields, parsed.data)), createdBy: user.name },
      });
      await audit({ actor: user, action: "record.create", appId, entityType: "Record", entityId: rec.id, after: { status: def.initialStatus, ...safe } }, tx);
      return rec;
    });
    recordId = rec.id;
    await emit(`${appId}.created`, { appId, entityType: "Record", entityId: rec.id, data: safe });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/apps/${appId}/${recordId}`);
}

export async function runRecordAction(appId: string, recordId: string, actionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const def = DEFINITIONS[appId];
  const action = def?.actions.find((a) => a.id === actionId);
  if (!def || !action) return { error: "Unknown action" };
  try {
    const user = await requirePermission(action.permission);
    const rec = await db.record.findUnique({ where: { id: recordId } });
    if (!rec || rec.appId !== appId) return { error: "Record not found" };
    if (!action.from.includes(rec.status)) return { error: `Can't ${action.label.toLowerCase()} while ${rec.status}` };
    const reason = String(formData.get("reason") ?? "").trim();
    const settings = await getSettings();
    const safe = redact(getFields(def, settings), JSON.parse(rec.data) as RecordData);
    const needsApproval = action.approval?.when(safe, settings) ?? false;
    if ((action.requireReason || needsApproval) && reason.length < 3) return { error: "Add a reason" };

    if (needsApproval && action.approval) {
      const { describe, permission } = action.approval;
      await withTransaction(async (tx) => {
        const moved = await tx.record.updateMany({ where: { id: rec.id, status: rec.status }, data: { status: PENDING_APPROVAL } });
        if (moved.count !== 1) throw new Error("Record changed; reload and try again");
        await requestApproval(
          {
            kind: "engine.action",
            appId,
            entityType: "Record",
            entityId: rec.id,
            summary: describe(safe),
            payload: { appId, recordId, actionId, previousStatus: rec.status },
            maker: user,
            makerReason: reason,
            requiredPermission: permission,
          },
          tx,
        );
      });
      revalidatePath(`/apps/${appId}`, "layout");
      return { ok: "Sent for approval" };
    }
    await executeRecordAction({ appId, recordId, actionId, from: rec.status, actor: user, reason: reason || null });
    revalidatePath(`/apps/${appId}`, "layout");
    return { ok: `${action.label}: done` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
