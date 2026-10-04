import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { DataTable, PageHeader, btn, fmtDate, input } from "@/kit/ui";
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
  const total = await db.auditEvent.count();

  return (
    <>
      <PageHeader title="Audit log" subtitle={`Append-only: no update or delete path in code, and database triggers reject both. ${total} events.`} />
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
