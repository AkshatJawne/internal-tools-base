import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, withTransaction } from "@/kit/db";
import { audit } from "@/kit/audit";
import type { ApprovalHandler } from "@/kit/approvals";
import { DEFINITIONS } from "@/apps/definitions";

export const FIELD_TYPES = ["text", "textarea", "number", "money", "email", "date", "select"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const fieldDefSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "letters, numbers and _ only"),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  /** Name of an entry in `settings.optionLists`; the app's definition declares the default values. */
  optionsFrom: z.string().optional(),
  pii: z.boolean().optional(),
  inList: z.boolean().optional(),
  custom: z.boolean().optional(),
});
export type FieldDef = z.infer<typeof fieldDefSchema>;

export const automationRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  event: z.string().min(1),
  condition: z
    .object({ field: z.string().min(1), op: z.enum(["eq", "neq", "gt", "lt"]), value: z.string() })
    .optional(),
  action: z.object({ connector: z.enum(["slack", "email"]), target: z.string().min(1), message: z.string().min(1) }),
  enabled: z.boolean(),
});
export type AutomationRule = z.infer<typeof automationRuleSchema>;

const nonEmptyList = z.array(z.string().min(1)).min(1);

export const settingsSchema = z.object({
  kycReasonCodes: z.object({ approve: nonEmptyList, reject: nonEmptyList, escalate: nonEmptyList }),
  slaHours: z.object({
    low: z.number().positive(),
    medium: z.number().positive(),
    high: z.number().positive(),
  }),
  makerCheckerTiers: z.array(z.enum(["low", "medium", "high"])),
  /** Numeric thresholds and dropdown lists apps read; keys and defaults come from each app definition's `settings`. */
  approvalThresholds: z.record(z.number().nonnegative()),
  optionLists: z.record(nonEmptyList),
  customFields: z.record(z.array(fieldDefSchema)),
  automationRules: z.array(automationRuleSchema),
});
export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  kycReasonCodes: {
    approve: ["Documents verified", "Low risk, auto checks passed", "Manual verification complete"],
    reject: ["Document forgery suspected", "Sanctions match confirmed", "Identity mismatch", "Unsupported jurisdiction"],
    escalate: ["Possible sanctions match", "PEP needs EDD", "Document quality unclear"],
  },
  slaHours: { low: 72, medium: 24, high: 4 },
  makerCheckerTiers: ["high"],
  approvalThresholds: {},
  optionLists: {},
  customFields: {},
  automationRules: [
    {
      id: "rule-sanctions",
      name: "Alert #kyc-alerts on sanctions or PEP hit",
      event: "kyc.case.received",
      condition: { field: "riskTier", op: "eq", value: "high" },
      action: { connector: "slack", target: "#kyc-alerts", message: "High-risk KYC case {{externalRef}} received (sanctions={{sanctionsHit}}, pep={{pepHit}})" },
      enabled: true,
    },
    {
      id: "rule-big-refund",
      name: "Email finance when a refund over $1,000 is issued",
      event: "refunds.issue",
      condition: { field: "amount", op: "gt", value: "1000" },
      action: { connector: "email", target: "finance-ops@example.com", message: "Refund of {{amount}} {{currency}} issued for {{customerName}}" },
      enabled: true,
    },
    {
      id: "rule-prod-flag",
      name: "Post to #releases when a production flag changes",
      event: "flags.enable",
      condition: { field: "environment", op: "eq", value: "production" },
      action: { connector: "slack", target: "#releases", message: "Flag {{key}} enabled in production" },
      enabled: true,
    },
  ],
};

export const SETTING_META: Record<SettingKey, { label: string; description: string; requiresApproval: boolean }> = {
  kycReasonCodes: { label: "KYC reason codes", description: "Reason codes analysts must pick when deciding a case.", requiresApproval: false },
  slaHours: { label: "KYC SLA hours per risk tier", description: "Drives the green / amber / red badges in the queue.", requiresApproval: false },
  makerCheckerTiers: { label: "Tiers that need four-eyes sign-off", description: "KYC decisions on these tiers wait for a lead's sign-off.", requiresApproval: false },
  approvalThresholds: { label: "Approval thresholds", description: "Amounts above which an app's action needs a second approver. Changing one needs a second person.", requiresApproval: true },
  optionLists: { label: "Dropdown options", description: "Option lists that generated apps' select fields read (declared in each app definition).", requiresApproval: false },
  customFields: { label: "Custom form fields", description: "Fields ops added to generated apps without code.", requiresApproval: false },
  automationRules: { label: "Automation rules", description: "When-this-then-that rules (Power Automate equivalent).", requiresApproval: false },
};

/** Defaults contributed by app definitions, so adding an app never edits this file. */
function appDefaults() {
  const out = { approvalThresholds: {} as Record<string, number>, optionLists: {} as Record<string, string[]> };
  for (const def of Object.values(DEFINITIONS)) {
    Object.assign(out.approvalThresholds, def.settings?.approvalThresholds);
    Object.assign(out.optionLists, def.settings?.optionLists);
  }
  return out;
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const defaults = appDefaults();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...defaults };
  for (const r of rows) merged[r.key] = JSON.parse(r.value);
  const s = merged as Settings;
  // Keyed settings: keep definition defaults for keys ops have not saved yet (e.g. a newly added app).
  s.approvalThresholds = { ...defaults.approvalThresholds, ...s.approvalThresholds };
  s.optionLists = { ...defaults.optionLists, ...s.optionLists };
  return s;
}

export async function applySetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
  actor: { id: string | null; name: string },
  reason: string | null,
  tx?: Prisma.TransactionClient,
) {
  const parsed = settingsSchema.shape[key].parse(value);
  const before = (await getSettings())[key];
  const run = async (t: Prisma.TransactionClient) => {
    await t.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(parsed) },
      update: { value: JSON.stringify(parsed) },
    });
    await audit({ actor, action: "settings.update", entityType: "Setting", entityId: key, before, after: parsed, reason }, t);
  };
  if (tx) await run(tx);
  else await withTransaction(run);
}

/** Approval handler for settings that need a second person (kind "settings.update"). */
export const settingsApprovalHandler: ApprovalHandler = {
  execute: async (p, { checker, approval }) => {
    const key = p.key as SettingKey;
    await applySetting(key, p.value as Settings[typeof key], checker, `Approved change requested by ${approval.makerName}`);
  },
};
