import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can, type Permission } from "@/kit/rbac";
import { decideApprovalAction } from "@/kit/approvals-actions";
import { Badge, Card, DataTable, PageHeader, btn, fmtDate, input } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { getApp } from "@/apps/manifest";

export default async function Approvals() {
  const user = await requirePagePermission("approvals.read");
  const pending = await db.approvalRequest.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
  const forMe = pending.filter((p) => p.makerId !== user.id && can(user, p.requiredPermission as Permission));
  const mine = await db.approvalRequest.findMany({ where: { makerId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const recent = await db.approvalRequest.findMany({ where: { NOT: { status: "pending" } }, orderBy: { decidedAt: "desc" }, take: 15 });

  return (
    <>
      <PageHeader title="Approvals" subtitle="One inbox for every maker-checker step across apps. The requester can never approve their own request." />
      <h2 className="mb-2 text-sm font-semibold text-ink">Waiting for you ({forMe.length})</h2>
      <div className="mb-8 grid gap-3">
        {forMe.length === 0 && <p className="text-sm text-ink-3">Nothing waiting for you.</p>}
        {forMe.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-ink-2">{getApp(p.appId)?.name} · {fmtDate(p.createdAt)}</div>
                <div className="font-medium">{p.summary}</div>
                <div className="text-sm text-ink-2">Requested by {p.makerName}{p.makerReason ? `: “${p.makerReason}”` : ""}</div>
              </div>
              <ActionForm action={decideApprovalAction} className="flex w-96 shrink-0 gap-2">
                <input type="hidden" name="approvalId" value={p.id} />
                <input name="reason" placeholder="Decision note" className={`${input} w-full`} />
                <button name="decision" value="approve" className={btn.primary}>Approve</button>
                <button name="decision" value="reject" className={btn.secondary}>Reject</button>
              </ActionForm>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">Your requests</h2>
          <DataTable rows={mine} rowKey={(r) => r.id} empty="You haven't requested anything." columns={[
            { key: "s", label: "Request", render: (r) => r.summary },
            { key: "st", label: "Status", render: (r) => <StatusBadge s={r.status} /> },
            { key: "c", label: "Checker", render: (r) => r.checkerName ?? "—" },
          ]} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">Recently decided</h2>
          <DataTable rows={recent} rowKey={(r) => r.id} empty="No decisions yet." columns={[
            { key: "s", label: "Request", render: (r) => r.summary },
            { key: "m", label: "Maker → checker", render: (r) => `${r.makerName} → ${r.checkerName ?? "—"}` },
            { key: "st", label: "Status", render: (r) => <StatusBadge s={r.status} /> },
          ]} />
        </div>
      </div>
    </>
  );
}

function StatusBadge({ s }: { s: string }) {
  return <Badge tone={s === "approved" ? "green" : s === "pending" ? "amber" : "red"}>{s}</Badge>;
}
