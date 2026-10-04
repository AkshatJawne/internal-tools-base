import type { Permission } from "@/kit/rbac";
import type { FieldDef, Settings } from "@/kit/settings";

export type RecordData = Record<string, string | number | null | undefined>;

/** Badge colour for a status. Mirrors `Tone` in @/kit/ui on purpose: the engine must not depend on the UI layer. */
export type StatusTone = "gray" | "green" | "amber" | "red" | "blue" | "purple";

export type ActionDef = {
  id: string;
  label: string;
  from: string[];
  to: string;
  permission: Permission;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  /**
   * If `when` is true the action waits for a second person holding `permission`.
   * Both hooks receive redacted data: PII fields are masks, never plaintext or ciphertext.
   */
  approval?: {
    permission: Permission;
    when: (data: RecordData, settings: Settings) => boolean;
    describe: (data: RecordData) => string;
  };
  /**
   * Side effect run when the action executes (after approval if needed). `data` is the stored record, so PII
   * fields are ciphertext; connector calls that need plaintext PII do not belong in a generated app.
   * Returned data is sealed and merged into the record.
   */
  effect?: (ctx: { appId: string; recordId: string; data: RecordData }) => Promise<RecordData | void>;
};

/**
 * A generated app: describe the data, statuses and actions; the kit renders list, form, detail, audit and approvals.
 * Build one with `defineApp()` so it is validated and gets the engine-owned `pending_approval` status.
 */
export type AppDefinition = {
  appId: string;
  titleField: string;
  permissions: { read: Permission; create: Permission };
  fields: FieldDef[];
  statuses: Record<string, { label: string; tone: StatusTone }>;
  initialStatus: string;
  actions: ActionDef[];
  /** Ops-tunable values this app reads. Shown in Admin → Settings; these are the defaults until ops change them. */
  settings?: { optionLists?: Record<string, string[]>; approvalThresholds?: Record<string, number> };
};
