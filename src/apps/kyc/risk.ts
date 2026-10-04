import type { Settings } from "@/kit/settings";

export type Tier = "low" | "medium" | "high";
export const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function riskTier(v: { sanctionsHit: boolean; pepHit: boolean; idScore: number }): Tier {
  if (v.sanctionsHit || v.pepHit || v.idScore < 50) return "high";
  if (v.idScore < 80) return "medium";
  return "low";
}

export const OPEN_STATUSES = ["new", "in_review", "pending_signoff", "escalated"];

/** SLA is computed from settings at read time, so changing SLA hours in Admin updates badges immediately. */
export function sla(c: { receivedAt: Date; riskTier: string; status: string }, slaHours: Settings["slaHours"]) {
  const hours = slaHours[c.riskTier as Tier] ?? 24;
  const due = new Date(c.receivedAt.getTime() + hours * 3600_000);
  if (!OPEN_STATUSES.includes(c.status)) return { state: "done" as const, due };
  const remaining = due.getTime() - Date.now();
  if (remaining < 0) return { state: "breached" as const, due };
  if (remaining < hours * 3600_000 * 0.25) return { state: "warning" as const, due };
  return { state: "ok" as const, due };
}
