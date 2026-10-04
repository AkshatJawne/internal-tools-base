import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { CONNECTORS, type ConnectorId } from "@/kit/connectors/catalog";
import { Badge, Card, DataTable, PageHeader, fmtDate } from "@/kit/ui";
import { APPS } from "@/apps/manifest";

export default async function Connectors() {
  await requirePagePermission("admin.read");
  const calls = await db.connectorCall.findMany({ orderBy: { at: "desc" }, take: 25 });
  const ids = Object.keys(CONNECTORS) as ConnectorId[];
  return (
    <>
      <PageHeader title="Connectors & data policy" subtitle="All integrations go through one adapter layer. An app can only call connectors on its allowlist (DLP equivalent); everything else is blocked and audited." />
      <Card title="Data policy matrix">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500"><th className="pb-2">Connector</th>{APPS.map((a) => <th key={a.id} className="pb-2 text-center">{a.icon} {a.name}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ids.map((id) => (
              <tr key={id}>
                <td className="py-2"><div className="font-medium">{CONNECTORS[id].name}</div><div className="text-xs text-slate-500">{CONNECTORS[id].description}</div></td>
                {APPS.map((a) => <td key={a.id} className="text-center">{a.connectors.includes(id) ? <Badge tone="green">allowed</Badge> : <Badge tone="red">blocked</Badge>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Adapters are mocks in this prototype (no network calls). Swapping one for the real SDK is a one-file change in <code>src/kit/connectors/index.ts</code>.</p>
      </Card>
      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Recent calls</h2>
      <DataTable
        rows={calls}
        rowKey={(c) => c.id}
        columns={[
          { key: "at", label: "When", render: (c) => <span className="text-slate-500">{fmtDate(c.at)}</span> },
          { key: "c", label: "Connector", render: (c) => c.connector },
          { key: "o", label: "Operation", render: (c) => <code className="text-xs">{c.operation}</code> },
          { key: "a", label: "App", render: (c) => c.appId },
          { key: "s", label: "Status", render: (c) => <Badge tone={c.status === "ok" ? "green" : "red"}>{c.status}</Badge> },
          { key: "k", label: "Idempotency key", render: (c) => <span className="font-mono text-xs">{c.idempotencyKey ?? ""}</span> },
        ]}
      />
    </>
  );
}
