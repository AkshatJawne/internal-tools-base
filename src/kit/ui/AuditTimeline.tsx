import { db } from "@/kit/db";
import { fmtDate } from "./index";

export async function AuditTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const events = await db.auditEvent.findMany({ where: { entityType, entityId }, orderBy: { at: "desc" }, take: 50 });
  if (events.length === 0) return <p className="text-sm text-slate-400">No events yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 border-slate-200 pl-3">
          <div className="text-xs text-slate-500">{fmtDate(e.at)} · {e.actorName}</div>
          <div className="font-mono text-xs font-semibold text-slate-800">{e.action}</div>
          {e.reason && <div className="text-xs text-slate-600">Reason: {e.reason}</div>}
          {e.after && <div className="truncate font-mono text-[11px] text-slate-400" title={e.after}>{e.after}</div>}
        </li>
      ))}
    </ol>
  );
}
