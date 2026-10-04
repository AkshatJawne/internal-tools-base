import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { Badge, DataTable, PageHeader, btn, fmtDate, input } from "@/kit/ui";
import { verifyAuditChain } from "@/kit/audit-verify";
import { APPS } from "@/apps/manifest";

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ actor?: string; action?: string; app?: string; entity?: string }> }) {
  await requirePagePermission("audit.read");
  const sp = await searchParams;
  const events = await db.auditEvent.findMany({
    where: {
      ...(sp.actor ? { actorName: { contains: sp.actor } } : {}),
      ...(sp.action ? { action: { contains: sp.action } } : {}),
      ...(sp.app ? { appId: sp.app } : {}),
      ...(sp.entity ? { entityId: { contains: sp.entity } } : {}),
    },
    orderBy: { at: "desc" },
    take: 200,
  });
  const chain = await verifyAuditChain();

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only (no update/delete path in code; DB triggers reject both) and hash-chained: each event's hash covers the previous one, so an edited or removed row breaks the chain."
        actions={
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <Badge tone={chain.ok ? "green" : "red"}>{chain.ok ? "chain verified" : `chain BROKEN at #${chain.brokenAt}`}</Badge>
              <span className="text-slate-500">{chain.count} events</span>
            </div>
            <div className="mt-1 font-mono text-slate-400">head {chain.head?.slice(0, 24) ?? "—"}…</div>
            {!chain.ok && <div className="mt-1 text-red-700">{chain.problem}</div>}
          </div>
        }
      />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input name="actor" defaultValue={sp.actor} placeholder="Actor" className={`${input} w-40`} />
        <input name="action" defaultValue={sp.action} placeholder="Action (e.g. pii.reveal)" className={`${input} w-52`} />
        <select name="app" defaultValue={sp.app ?? ""} className={`${input} w-44`}>
          <option value="">All apps</option>
          {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input name="entity" defaultValue={sp.entity} placeholder="Entity id" className={`${input} w-44`} />
        <button className={btn.secondary}>Filter</button>
      </form>
      <DataTable
        rows={events}
        rowKey={(e) => e.id}
        columns={[
          { key: "seq", label: "#", render: (e) => <span className="font-mono text-xs text-slate-400">{e.seq}</span> },
          { key: "at", label: "When", render: (e) => <span className="whitespace-nowrap text-slate-500">{fmtDate(e.at)}</span> },
          { key: "actor", label: "Actor", render: (e) => e.actorName },
          { key: "action", label: "Action", render: (e) => <span className={`font-mono text-xs font-semibold ${e.action.startsWith("access.denied") || e.action.includes("blocked") ? "text-red-600" : ""}`}>{e.action}</span> },
          { key: "entity", label: "Entity", render: (e) => <span className="font-mono text-xs">{e.entityType}:{e.entityId.slice(0, 14)}</span> },
          { key: "reason", label: "Reason", render: (e) => e.reason ?? "" },
          {
            key: "change",
            label: "Change",
            className: "max-w-xs",
            render: (e) =>
              e.before || e.after ? (
                <details>
                  <summary className="cursor-pointer text-xs text-indigo-600">diff</summary>
                  {e.before && <pre className="whitespace-pre-wrap text-[11px] text-red-700">- {e.before}</pre>}
                  {e.after && <pre className="whitespace-pre-wrap text-[11px] text-emerald-700">+ {e.after}</pre>}
                </details>
              ) : null,
          },
          { key: "req", label: "Request", render: (e) => <span className="font-mono text-[11px] text-slate-400">{e.requestId.slice(0, 8)}</span> },
        ]}
      />
    </>
  );
}
