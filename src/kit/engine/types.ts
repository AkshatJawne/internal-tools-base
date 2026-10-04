import type { Permission } from "@/kit/rbac";
import type { FieldDef, Settings } from "@/kit/settings";
import type { Tone } from "@/kit/ui";

export type RecordData = Record<string, string | number | null | undefined>;

export type ActionDef = {
  id: string;
  label: string;
  from: string[];
  to: string;
  permission: Permission;
  tone?: "primary" | "danger";
  requireReason?: boolean;
  /** If `when` is true the action waits for a second person holding `permission`. */
  approval?: {
    permission: Permission;
    when: (data: RecordData, settings: Settings) => boolean;
    describe: (data: RecordData) => string;
  };
  /** Side effect run when the action executes (after approval if needed). Returned data is merged into the record. */
  effect?: (ctx: { appId: string; recordId: string; data: RecordData }) => Promise<RecordData | void>;
};

/** A generated app: describe the data, statuses and actions; the kit renders list, form, detail, audit and approvals. */
export type AppDefinition = {
  appId: string;
  titleField: string;
  permissions: { read: Permission; create: Permission };
  fields: FieldDef[];
  statuses: Record<string, { label: string; tone: Tone }>;
  initialStatus: string;
  actions: ActionDef[];
};
