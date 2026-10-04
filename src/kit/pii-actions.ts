"use server";

import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { errorMessage } from "@/kit/action-state";
import { getFields } from "@/kit/engine/fields";
import { DEFINITIONS } from "@/apps/definitions";

const KYC_PII_FIELDS = ["ssn", "dob", "email"] as const;

export async function revealPii(input: { entityType: "KycCase" | "Record"; entityId: string; field: string; reason: string }): Promise<{ value?: string; error?: string }> {
  try {
    const user = await requirePermission("pii.reveal");
    const reason = input.reason.trim();
    if (reason.length < 8) return { error: "Give a reason (at least 8 characters)" };

    let value: string | undefined;
    let appId: string;
    if (input.entityType === "KycCase") {
      if (!can(user, "kyc.case.read") || !(KYC_PII_FIELDS as readonly string[]).includes(input.field)) return { error: "Not allowed" };
      const c = await db.kycCase.findUnique({ where: { id: input.entityId } });
      value = c?.[input.field as (typeof KYC_PII_FIELDS)[number]];
      appId = "kyc";
    } else {
      const rec = await db.record.findUnique({ where: { id: input.entityId } });
      const def = rec && DEFINITIONS[rec.appId];
      if (!rec || !def || !can(user, def.permissions.read)) return { error: "Not allowed" };
      const field = getFields(def, await getSettings()).find((f) => f.name === input.field && f.pii);
      if (!field) return { error: "Not a PII field" };
      value = String((JSON.parse(rec.data) as Record<string, unknown>)[field.name] ?? "");
      appId = rec.appId;
    }
    if (value === undefined) return { error: "Not found" };
    await audit({ actor: user, action: "pii.reveal", appId, entityType: input.entityType, entityId: input.entityId, after: { field: input.field }, reason });
    return { value };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
