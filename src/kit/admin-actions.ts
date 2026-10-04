"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { requestApproval } from "@/kit/approvals";
import { ROLES } from "@/kit/rbac";
import { applySetting, getSettings, SETTING_META, settingsSchema, type FieldDef, type SettingKey, type Settings } from "@/kit/settings";
import { errorMessage, type FormState } from "@/kit/action-state";
import { DEFINITIONS } from "@/apps/definitions";

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

function valueFromForm(key: SettingKey, fd: FormData): unknown {
  switch (key) {
    case "kycReasonCodes":
      return { approve: lines(fd.get("approve")), reject: lines(fd.get("reject")), escalate: lines(fd.get("escalate")) };
    case "refundReasons":
      return lines(fd.get("values"));
    case "slaHours":
      return { low: Number(fd.get("low")), medium: Number(fd.get("medium")), high: Number(fd.get("high")) };
    case "makerCheckerTiers":
      return fd.getAll("tiers").map(String);
    case "approvalThresholds":
      return { refundAmount: Number(fd.get("refundAmount")) };
    default:
      throw new Error("Not editable here");
  }
}

export async function updateSettingAction(key: SettingKey, _prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("settings.write");
    const parsed = settingsSchema.shape[key].safeParse(valueFromForm(key, fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid value" };
    const reason = String(fd.get("reason") ?? "").trim() || null;
    if (SETTING_META[key].requiresApproval) {
      const before = (await getSettings())[key];
      await requestApproval({
        kind: "settings.update",
        appId: "platform",
        entityType: "Setting",
        entityId: key,
        summary: `Change ${SETTING_META[key].label}: ${JSON.stringify(before)} → ${JSON.stringify(parsed.data)}`,
        payload: { key, value: parsed.data },
        maker: user,
        makerReason: reason,
        requiredPermission: "settings.approve",
      });
      revalidatePath("/", "layout");
      return { ok: "Change submitted. A second person with settings.approve must approve it." };
    }
    await applySetting(key, parsed.data as Settings[typeof key], user, reason);
    revalidatePath("/", "layout");
    return { ok: "Saved and audited" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const toName = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "").replace(/^[^a-zA-Z]+/, "");

export async function addCustomFieldAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("settings.write");
    const appId = String(fd.get("appId"));
    const def = DEFINITIONS[appId];
    if (!def) return { error: "Unknown app" };
    const labelText = String(fd.get("label") ?? "");
    const field: FieldDef = {
      name: toName(labelText),
      label: labelText.trim(),
      type: String(fd.get("type")) as FieldDef["type"],
      required: fd.get("required") === "on",
      pii: fd.get("pii") === "on",
      inList: fd.get("inList") === "on",
      ...(fd.get("type") === "select" ? { options: String(fd.get("options") ?? "").split(",").map((s) => s.trim()).filter(Boolean) } : {}),
    };
    if (!field.name) return { error: "Give the field a label" };
    if (field.type === "select" && !field.options?.length) return { error: "Select fields need options (comma-separated)" };
    const settings = await getSettings();
    const existing = settings.customFields[appId] ?? [];
    if ([...def.fields, ...existing].some((f) => f.name === field.name)) return { error: `A field called ${field.name} already exists` };
    await applySetting("customFields", { ...settings.customFields, [appId]: [...existing, field] }, user, `Added field "${field.label}" to ${appId}`);
    revalidatePath("/", "layout");
    return { ok: `Added "${field.label}". It now appears in the ${appId} form, detail page and audit log.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function removeCustomFieldAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("settings.write");
    const appId = String(fd.get("appId"));
    const name = String(fd.get("name"));
    const settings = await getSettings();
    const next = (settings.customFields[appId] ?? []).filter((f) => f.name !== name);
    await applySetting("customFields", { ...settings.customFields, [appId]: next }, user, `Removed field ${name} from ${appId} (existing data kept)`);
    revalidatePath("/", "layout");
    return { ok: "Removed" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function saveAutomationRuleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("settings.write");
    const settings = await getSettings();
    const condField = String(fd.get("condField") ?? "");
    const rule = {
      id: `rule-${randomBytes(3).toString("hex")}`,
      name: String(fd.get("name") ?? ""),
      event: String(fd.get("event") ?? ""),
      ...(condField ? { condition: { field: condField, op: String(fd.get("condOp")) as "eq", value: String(fd.get("condValue") ?? "") } } : {}),
      action: { connector: String(fd.get("connector")) as "slack", target: String(fd.get("target") ?? ""), message: String(fd.get("message") ?? "") },
      enabled: true,
    };
    await applySetting("automationRules", [...settings.automationRules, rule], user, `Created rule "${rule.name}"`);
    revalidatePath("/", "layout");
    return { ok: "Rule created and live" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function toggleAutomationRuleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("settings.write");
    const id = String(fd.get("id"));
    const settings = await getSettings();
    const rules = settings.automationRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    const r = rules.find((x) => x.id === id);
    await applySetting("automationRules", rules, user, `${r?.enabled ? "Enabled" : "Disabled"} rule "${r?.name}"`);
    revalidatePath("/", "layout");
    return { ok: r?.enabled ? "Enabled" : "Disabled" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function setUserRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const admin = await requirePermission("users.manage");
    const userId = String(fd.get("userId"));
    const role = String(fd.get("role"));
    if (!(role in ROLES)) return { error: "Unknown role" };
    if (userId === admin.id) return { error: "You can't change your own role" };
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await db.user.update({ where: { id: userId }, data: { role } });
    await audit({ actor: admin, action: "user.role_changed", entityType: "User", entityId: userId, before: { role: before.role }, after: { role } });
    revalidatePath("/", "layout");
    return { ok: `${before.name} is now ${role}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
