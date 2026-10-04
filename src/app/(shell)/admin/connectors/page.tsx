import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { CONNECTORS, PLATFORM_CONNECTORS, type ConnectorId, type DataClass } from "@/kit/connectors/catalog";
import { probeConnectorPolicy } from "@/kit/connectors/policy-actions";
import { Badge, Card, DataTable, PageHeader, btn, fmtDate, input, label } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { APPS } from "@/apps/manifest";

const CLASS_TONE: Record<DataClass, "gray" | "amber" | "red"> = { internal: "gray", pii: "amber", money: "red" };

export default async function Connectors({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requirePagePermission("admin.read");
  const { view } = await searchParams;
  const blockedOnly = view === "blocked";
  const [calls, blockedCount] = await Promise.all([
    db.connectorCall.findMany({ where: blockedOnly ? { status: "blocked" } : {}, orderBy: { at: "desc" }, take: 25 }),
    db.connectorCall.count({ where: { status: "blocked" } }),
  ]);
  const ids = Object.keys(CONNECTORS) as ConnectorId[];
  const columns = [...APPS.map((a) => ({ id: a.id, name: `${a.icon} ${a.name}`, connectors: a.connectors as readonly ConnectorId[] })), { id: "platform", name: "Platform", connectors: PLATFORM_CONNECTORS }];
  return (
    <>
      <PageHeader
        title="Connectors & data policy"
        subtitle="Two rules, enforced in one place (src/kit/connectors/index.ts): an app may only call connectors on its manifest allowlist, and a connector only accepts the data classes it is cleared for. Blocked calls are logged and audited. deploy/k8s/egress-networkpolicy.yaml enforces the same hosts at the network layer."
      />
      <Card title="Policy matrix">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500"><th className="pb-2">Connector</th><th className="pb-2">Accepts</th>{columns.map((a) => <th key={a.id} className="pb-2 text-center">{a.name}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ids.map((id) => (
              <tr key={id}>
                <td className="py-2 pr-3"><div className="font-medium">{CONNECTORS[id].name}</div><div className="text-xs text-slate-500">{CONNECTORS[id].direction} · {CONNECTORS[id].classification} · {CONNECTORS[id].description}</div></td>
                <td className="py-2"><div className="flex flex-wrap gap-1">{CONNECTORS[id].accepts.map((c) => <Badge key={c} tone={CLASS_TONE[c]}>{c}</Badge>)}</div></td>
                {columns.map((a) => <td key={a.id} className="text-center">{a.connectors.includes(id) ? <Badge tone="green">allowed</Badge> : <Badge tone="red">blocked</Badge>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Adapters are mocks (no network calls). Request bodies classified <code>pii</code> are stored redacted in the call log. Swapping a mock for the real SDK is a one-file change.</p>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Policy test (DLP probe)">
          <p className="mb-3 text-xs text-slate-500">Send a no-op probe through the gateway to prove what the policy does. The attempt is logged like any real call.</p>
          <ActionForm action={probeConnectorPolicy} className="space-y-2">
            <div><label className={label} htmlFor="appId">App</label><select id="appId" name="appId" className={input}>{columns.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className={label} htmlFor="connector">Connector</label><select id="connector" name="connector" className={input}>{ids.map((id) => <option key={id} value={id}>{id}</option>)}</select></div>
            <div><label className={label} htmlFor="dataClass">Payload contains</label><select id="dataClass" name="dataClass" className={input} defaultValue="pii"><option value="internal">internal data</option><option value="pii">PII</option><option value="money">money movement</option></select></div>
            <button className={btn.secondary}>Probe</button>
          </ActionForm>
        </Card>
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{blockedOnly ? `Blocked attempts (${blockedCount})` : "Recent calls"}</h2>
            <a href={blockedOnly ? "/admin/connectors" : "/admin/connectors?view=blocked"} className="text-xs text-indigo-600">{blockedOnly ? "Show all calls" : `Show blocked only (${blockedCount})`}</a>
          </div>
          <DataTable
            rows={calls}
            rowKey={(c) => c.id}
            empty="No calls yet"
            columns={[
              { key: "at", label: "When", render: (c) => <span className="whitespace-nowrap text-slate-500">{fmtDate(c.at)}</span> },
              { key: "a", label: "App → connector", render: (c) => <span>{c.appId} → <span className="font-medium">{c.connector}</span><div className="font-mono text-xs text-slate-500">{c.operation}</div></span> },
              { key: "d", label: "Data", render: (c) => <Badge tone={CLASS_TONE[c.dataClass as DataClass] ?? "gray"}>{c.dataClass}</Badge> },
              { key: "s", label: "Status", render: (c) => <><Badge tone={c.status === "ok" ? "green" : "red"}>{c.status}</Badge>{c.policyReason && <div className="mt-1 text-xs text-red-700">{c.policyReason}</div>}</> },
              { key: "k", label: "Idempotency key", render: (c) => <span className="font-mono text-xs">{c.idempotencyKey ?? ""}</span> },
            ]}
          />
        </div>
      </div>
    </>
  );
}
