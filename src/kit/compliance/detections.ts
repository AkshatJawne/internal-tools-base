import { db } from "@/kit/db";

export type Finding = { rule: string; severity: "high" | "medium" | "low"; summary: string; evidence: { at: Date; actor: string; detail: string }[] };

/**
 * Three detections a fintech SOC would want on day one. In production these run as SIEM rules
 * over the shipped audit stream; here they query the same table so the page shows real findings.
 */
export async function runDetections(): Promise<Finding[]> {
  const day = new Date(Date.now() - 24 * 3600_000);
  const week = new Date(Date.now() - 7 * 24 * 3600_000);
  const [sod, reveals, roles, blocked] = await Promise.all([
    db.auditEvent.findMany({ where: { action: "access.denied", entityType: "ApprovalRequest", at: { gte: week } }, orderBy: { at: "desc" } }),
    db.auditEvent.findMany({ where: { action: "pii.reveal", at: { gte: day } }, orderBy: { at: "asc" } }),
    db.auditEvent.findMany({ where: { action: "user.role_changed", at: { gte: week } }, orderBy: { at: "desc" } }),
    db.auditEvent.findMany({ where: { action: "connector.blocked", at: { gte: week } }, orderBy: { at: "desc" } }),
  ]);

  const findings: Finding[] = [];
  if (sod.length) {
    findings.push({ rule: "SoD bypass attempt", severity: "high", summary: `${sod.length} attempt(s) to approve one's own request in the last 7 days`, evidence: sod.map((e) => ({ at: e.at, actor: e.actorName, detail: e.reason ?? "" })) });
  }
  // PII reveal burst: more than 5 reveals by one actor within any 10-minute window.
  const byActor = new Map<string, typeof reveals>();
  for (const e of reveals) byActor.set(e.actorName, [...(byActor.get(e.actorName) ?? []), e]);
  for (const [actor, evs] of byActor) {
    for (let i = 0; i + 5 < evs.length; i++) {
      if (evs[i + 5].at.getTime() - evs[i].at.getTime() <= 10 * 60_000) {
        findings.push({ rule: "PII reveal burst", severity: "high", summary: `${actor} revealed PII ${evs.length} times in 24h, including 6+ within 10 minutes`, evidence: evs.slice(i, i + 6).map((e) => ({ at: e.at, actor, detail: `${e.entityType} ${e.entityId} · ${e.reason ?? ""}` })) });
        break;
      }
    }
  }
  if (roles.length) {
    findings.push({ rule: "Role grant", severity: "medium", summary: `${roles.length} security-role change(s) in the last 7 days (review each against the access request)`, evidence: roles.map((e) => ({ at: e.at, actor: e.actorName, detail: `${e.entityId}: ${e.before} → ${e.after}` })) });
  }
  if (blocked.length) {
    findings.push({ rule: "Data policy block", severity: "low", summary: `${blocked.length} connector call(s) blocked by data policy in the last 7 days`, evidence: blocked.map((e) => ({ at: e.at, actor: e.actorName, detail: `${e.appId} → ${e.entityId}: ${e.reason ?? ""}` })) });
  }
  return findings;
}
