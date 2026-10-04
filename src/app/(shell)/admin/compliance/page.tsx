import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { verifyAuditChain } from "@/kit/audit-verify";
import { CONTROLS, controlWhere } from "@/kit/compliance/controls";
import { runDetections } from "@/kit/compliance/detections";
import { Badge, Card, PageHeader, Stat, btn, fmtDate } from "@/kit/ui";

export default async function Compliance() {
  await requirePagePermission("audit.read");
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const [chain, findings, counts] = await Promise.all([
    verifyAuditChain(),
    runDetections(),
    Promise.all(CONTROLS.map((c) => db.auditEvent.count({ where: { ...controlWhere(c), at: { gte: since } } }))),
  ]);
  return (
    <>
      <PageHeader
        title="Compliance & evidence"
        subtitle="One audit chain feeds every control. An evidence pack is the matching events for the last 30 days plus chain integrity and the role matrix, as one JSON an auditor can sample. Exports are audited too."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Audit chain" value={chain.ok ? "verified" : "BROKEN"} tone={chain.ok ? "gray" : "red"} />
        <Stat label="Events in chain" value={chain.count} />
        <Stat label="Open findings" value={findings.length} tone={findings.some((f) => f.severity === "high") ? "red" : findings.length ? "amber" : "gray"} />
      </div>
      <Card title="Controls → evidence packs">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-ink-2"><th className="pb-2">Control</th><th className="pb-2">Auditor&apos;s question</th><th className="pb-2">Audit actions</th><th className="pb-2 text-right">Events (30d)</th><th className="pb-2"></th></tr></thead>
          <tbody className="divide-y divide-line-2">
            {CONTROLS.map((c, i) => (
              <tr key={c.id}>
                <td className="py-2 pr-3"><div className="font-medium">{c.framework} {c.id}</div><div className="text-xs text-ink-2">{c.title}</div></td>
                <td className="py-2 pr-3 text-ink">{c.question}</td>
                <td className="py-2 pr-3"><div className="flex flex-wrap gap-1">{c.actions.map((a) => <code key={a} className="rounded bg-canvas px-1 text-xs">{a}</code>)}</div></td>
                <td className="py-2 text-right font-mono">{counts[i]}</td>
                <td className="py-2 pl-3 text-right"><a href={`/api/evidence/${encodeURIComponent(c.id)}`} className={btn.secondary}>Download pack</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Detections (SIEM rules, run against the same chain)" className="mt-6">
        {findings.length === 0 ? (
          <p className="text-sm text-ink-2">No findings. Rules: SoD bypass attempt, PII reveal burst (6+ in 10 min), security-role grants, data-policy blocks.</p>
        ) : (
          <div className="space-y-4">
            {findings.map((f) => (
              <div key={f.rule}>
                <div className="flex items-center gap-2 text-sm"><Badge tone={f.severity === "high" ? "red" : f.severity === "medium" ? "amber" : "gray"}>{f.severity}</Badge><span className="font-medium">{f.rule}</span><span className="text-ink-2">— {f.summary}</span></div>
                <ul className="mt-1 space-y-0.5 pl-6 text-xs text-ink-2">
                  {f.evidence.slice(0, 5).map((e, i) => <li key={i}><span className="text-ink-3">{fmtDate(e.at)}</span> · {e.actor} · {e.detail}</li>)}
                  {f.evidence.length > 5 && <li className="text-ink-3">+{f.evidence.length - 5} more</li>}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="What this replaces, and what it doesn't" className="mt-6">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          <li><strong>Replaces:</strong> Purview audit search and Dataverse per-table auditing (here every mutation is on by default), Sentinel&apos;s Power Platform detections (the four rules above), and the admin-center screenshots an auditor would otherwise sample.</li>
          <li><strong>Still needed in production:</strong> ship the chain to the SIEM and object-locked storage (7-year KYC/AML retention), clock sync, a retention/erasure procedure that preserves the chain, and a pen test before PCI-adjacent apps go live.</li>
          <li><strong>Not replaceable:</strong> Microsoft&apos;s SOC 2 / ISO / PCI attestations for the hosting layer. The client inherits its cloud provider&apos;s instead and owns the application layer itself.</li>
        </ul>
      </Card>
    </>
  );
}
