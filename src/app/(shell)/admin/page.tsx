import Link from "next/link";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { Badge, Card, DataTable, PageHeader, Stat } from "@/kit/ui";
import { APPS } from "@/apps/manifest";

export default async function AdminCenter() {
  await requirePagePermission("admin.read");
  const since = new Date(Date.now() - 24 * 3600_000);
  const [users, pending, events, calls, blocked] = await Promise.all([
    db.user.count(),
    db.approvalRequest.count({ where: { status: "pending" } }),
    db.auditEvent.count({ where: { at: { gte: since } } }),
    db.connectorCall.count(),
    db.connectorCall.count({ where: { status: "blocked" } }),
  ]);
  return (
    <>
      <PageHeader title="Admin center" subtitle="Every app on the platform, who owns it, what it can reach, and who can open it." />
      <div className="mb-6 grid grid-cols-5 gap-4">
        <Stat label="Apps" value={APPS.length} />
        <Stat label="Users" value={users} />
        <Stat label="Pending approvals" value={pending} tone="amber" />
        <Stat label="Audit events (24h)" value={events} />
        <Stat label="Connector calls" value={<>{calls}{blocked > 0 && <span className="ml-2 text-sm text-red-600">{blocked} blocked</span>}</>} />
      </div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">App catalog</h2>
      <DataTable
        rows={APPS}
        rowKey={(a) => a.id}
        columns={[
          { key: "n", label: "App", render: (a) => <Link className="font-medium text-indigo-600" href={a.route}>{a.icon} {a.name}</Link> },
          { key: "k", label: "Type", render: (a) => <Badge tone={a.kind === "generated" ? "blue" : "purple"}>{a.kind}</Badge> },
          { key: "o", label: "Owner", render: (a) => a.owner },
          { key: "p", label: "Access permission", render: (a) => <code className="text-xs">{a.permission}</code> },
          { key: "c", label: "Allowed connectors", render: (a) => <span className="space-x-1">{a.connectors.map((c) => <Badge key={c}>{c}</Badge>)}</span> },
        ]}
      />
      <Card title="Adding app #4" className="mt-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Someone asks Devin (Slack, Linear or the web app): “Build a chargebacks tracker: fields…, approvals over $X”.</li>
          <li>Devin follows <code>.agents/skills/new-internal-app/SKILL.md</code>: a definition file, a manifest entry and permissions. No new auth, audit or approval code.</li>
          <li>The PR runs CI and a preview deploy; CODEOWNERS pulls in security if it touches the kit or moves money.</li>
          <li>An engineer reviews and merges. The app shows up here, in the sidebar for permitted roles, and in Automations.</li>
        </ol>
      </Card>
    </>
  );
}
