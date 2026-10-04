import Link from "next/link";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { Badge, DataTable, PageHeader, Stat, btn, fmtDate, input, timeUntil, type Tone } from "@/kit/ui";
import { claimNextCase } from "@/apps/kyc/actions";
import { RISK_ORDER, sla } from "@/apps/kyc/risk";

const STATUS_TONE: Record<string, Tone> = { new: "blue", in_review: "purple", pending_signoff: "amber", approved: "green", rejected: "red", escalated: "red" };
const TIER_TONE: Record<string, Tone> = { high: "red", medium: "amber", low: "gray" };
const SLA_TONE = { ok: "green", warning: "amber", breached: "red", done: "gray" } as const;

export default async function KycQueue({ searchParams }: { searchParams: Promise<{ status?: string; tier?: string; who?: string; empty?: string }> }) {
  const user = await requirePagePermission("kyc.case.read");
  const sp = await searchParams;
  const settings = await getSettings();
  const all = await db.kycCase.findMany();
  const users = Object.fromEntries((await db.user.findMany()).map((u) => [u.id, u.name]));

  const withSla = all.map((c) => ({ ...c, sla: sla(c, settings.slaHours) }));
  const status = sp.status ?? "open";
  const rows = withSla
    .filter((c) => (status === "open" ? !["approved", "rejected"].includes(c.status) : status === "all" || c.status === status))
    .filter((c) => !sp.tier || c.riskTier === sp.tier)
    .filter((c) => !sp.who || (sp.who === "me" ? c.assigneeId === user.id : c.assigneeId === null))
    .sort((a, b) => RISK_ORDER[a.riskTier] - RISK_ORDER[b.riskTier] || a.receivedAt.getTime() - b.receivedAt.getTime());

  return (
    <>
      <PageHeader
        title="KYC review queue"
        subtitle="Cases arrive from the KYC vendor webhook. Highest risk and oldest first."
        actions={can(user, "kyc.case.claim") && <form action={claimNextCase}><button className={btn.primary}>Get next case</button></form>}
      />
      {sp.empty && <div className="mb-4 rounded-lg bg-canvas px-4 py-2 text-sm">No unassigned cases right now.</div>}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Stat label="Unassigned" value={withSla.filter((c) => c.status === "new").length} />
        <Stat label="Assigned to me" value={withSla.filter((c) => c.assigneeId === user.id && c.status === "in_review").length} />
        <Stat label="Awaiting sign-off" value={withSla.filter((c) => c.status === "pending_signoff").length} tone="amber" />
        <Stat label="SLA breached" value={withSla.filter((c) => c.sla.state === "breached").length} tone="red" />
      </div>
      <form className="mb-4 flex items-end gap-3">
        <select name="status" defaultValue={status} className={`${input} w-44`}>
          {["open", "all", "new", "in_review", "pending_signoff", "escalated", "approved", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="tier" defaultValue={sp.tier ?? ""} className={`${input} w-36`}>
          <option value="">any risk</option>
          {["high", "medium", "low"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="who" defaultValue={sp.who ?? ""} className={`${input} w-40`}>
          <option value="">anyone</option>
          <option value="me">assigned to me</option>
          <option value="unassigned">unassigned</option>
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        empty="No cases match. Run `pnpm webhooks` to send synthetic vendor events."
        columns={[
          { key: "ref", label: "Case", render: (c) => <Link className="font-medium text-accent hover:underline" href={`/kyc/${c.id}`}>{c.externalRef}</Link> },
          { key: "name", label: "Applicant", render: (c) => `${c.firstName} ${c.lastName}` },
          { key: "risk", label: "Risk", render: (c) => <Badge tone={TIER_TONE[c.riskTier]}>{c.riskTier}</Badge> },
          { key: "hits", label: "Screening", render: (c) => <span className="space-x-1">{c.sanctionsHit && <Badge tone="red">sanctions</Badge>}{c.pepHit && <Badge tone="purple">PEP</Badge>}{!c.sanctionsHit && !c.pepHit && <span className="text-ink-3">clear</span>}</span> },
          { key: "score", label: "ID score", render: (c) => c.idScore },
          { key: "status", label: "Status", render: (c) => <Badge tone={STATUS_TONE[c.status]}>{c.status.replace("_", " ")}</Badge> },
          { key: "who", label: "Assignee", render: (c) => (c.assigneeId ? users[c.assigneeId] : <span className="text-ink-3">—</span>) },
          { key: "sla", label: "SLA", render: (c) => (c.sla.state === "done" ? <span className="text-ink-3">done</span> : <Badge tone={SLA_TONE[c.sla.state]}>{timeUntil(c.sla.due)}</Badge>) },
          { key: "received", label: "Received", render: (c) => <span className="text-ink-2">{fmtDate(c.receivedAt)}</span> },
        ]}
      />
    </>
  );
}
