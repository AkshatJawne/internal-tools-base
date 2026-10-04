"use server";

import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { errorMessage } from "@/kit/action-state";
import { getFields } from "@/kit/engine/fields";
import { unsealPii } from "@/kit/pii";
import { DEFINITIONS } from "@/apps/definitions";
import { APPS } from "@/apps/manifest";

/**
 * The only path from ciphertext to plaintext for a user. Generated apps are covered by their definition's `pii`
 * fields; custom apps declare `pii` in their manifest entry. Every reveal is audited with the typed reason.
 */
export async function revealPii(input: { entityType: string; entityId: string; field: string; reason: string }): Promise<{ value?: string; error?: string }> {
  try {
    const user = await requirePermission("pii.reveal");
    const reason = input.reason.trim();
    if (reason.length < 8) return { error: "Give a reason (at least 8 characters)" };

    let value: string | undefined;
    let appId: string;
    if (input.entityType === "Record") {
      const rec = await db.record.findUnique({ where: { id: input.entityId } });
      const def = rec && DEFINITIONS[rec.appId];
      if (!rec || !def || !can(user, def.permissions.read)) return { error: "Not allowed" };
      const field = getFields(def, await getSettings()).find((f) => f.name === input.field && f.pii);
      if (!field) return { error: "Not a PII field" };
      value = unsealPii(String((JSON.parse(rec.data) as Record<string, unknown>)[field.name] ?? ""));
      appId = rec.appId;
    } else {
      const app = APPS.find((a) => a.pii?.entityType === input.entityType);
      if (!app?.pii || !can(user, app.permission) || !app.pii.fields.includes(input.field)) return { error: "Not allowed" };
      const row = await app.pii.read(input.entityId);
      value = row ? unsealPii(row[input.field] ?? "") : undefined;
      appId = app.id;
    }
    if (value === undefined) return { error: "Not found" };
    await audit({ actor: user, action: "pii.reveal", appId, entityType: input.entityType, entityId: input.entityId, after: { field: input.field }, reason });
    return { value };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
