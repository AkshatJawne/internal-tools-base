import type { AppDefinition } from "@/kit/engine/types";
import { flags as flagService } from "@/kit/connectors";

const prodNeedsApproval = {
  permission: "flags.approve_prod" as const,
  when: (d: Record<string, unknown>) => d.environment === "production",
  describe: (d: Record<string, unknown>) => `Change flag ${d.key} in production`,
};

const push = (enabled: boolean) => async ({ appId, data }: { appId: string; data: Record<string, unknown> }) => {
  const res = await flagService.set(appId, {
    key: String(data.key),
    environment: String(data.environment),
    enabled,
    rollout: Number(data.rollout ?? 100),
  });
  return { lastSyncedAt: res.syncedAt };
};

export const flags: AppDefinition = {
  appId: "flags",
  titleField: "key",
  permissions: { read: "flags.read", create: "flags.toggle" },
  fields: [
    { name: "key", label: "Flag key", type: "text", required: true, inList: true },
    { name: "environment", label: "Environment", type: "select", options: ["staging", "production"], required: true, inList: true },
    { name: "rollout", label: "Rollout %", type: "number", required: true, inList: true },
    { name: "owner", label: "Owning team", type: "text", inList: true },
    { name: "description", label: "Description", type: "textarea" },
  ],
  statuses: {
    off: { label: "Off", tone: "gray" },
    on: { label: "On", tone: "green" },
    pending_approval: { label: "Pending approval", tone: "amber" },
  },
  initialStatus: "off",
  actions: [
    { id: "enable", label: "Enable", from: ["off"], to: "on", permission: "flags.toggle", tone: "primary", approval: prodNeedsApproval, effect: push(true) },
    { id: "disable", label: "Disable", from: ["on"], to: "off", permission: "flags.toggle", tone: "danger", approval: prodNeedsApproval, effect: push(false) },
  ],
};
