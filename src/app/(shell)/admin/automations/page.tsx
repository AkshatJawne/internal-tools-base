import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { saveAutomationRuleAction, toggleAutomationRuleAction } from "@/kit/admin-actions";
import { Badge, Card, DataTable, PageHeader, btn, fmtDate, input, label } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { EVENTS } from "@/apps/events";

export default async function Automations() {
  const user = await requirePagePermission("settings.read");
  const { automationRules } = await getSettings();
  const canEdit = can(user, "settings.write");
  const runs = await db.connectorCall.findMany({ where: { connector: { in: ["slack", "email"] } }, orderBy: { at: "desc" }, take: 15 });
  const eventLabel = Object.fromEntries(EVENTS.map((e) => [e.id, e.label]));
  return (
    <>
      <PageHeader title="Automations" subtitle="When-this-then-that rules ops can create without code (the Power Automate equivalent). Rules run through connectors, so data policy still applies." />
      <DataTable
        rows={automationRules}
        rowKey={(r) => r.id}
        columns={[
          { key: "n", label: "Rule", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "w", label: "When", render: (r) => <span className="text-xs">{eventLabel[r.event] ?? r.event}{r.condition && <> · if <code>{r.condition.field} {r.condition.op} {r.condition.value}</code></>}</span> },
          { key: "t", label: "Then", render: (r) => <span className="text-xs"><Badge>{r.action.connector}</Badge> {r.action.target}</span> },
          { key: "s", label: "Status", render: (r) => <Badge tone={r.enabled ? "green" : "gray"}>{r.enabled ? "on" : "off"}</Badge> },
          { key: "a", label: "", render: (r) => canEdit && (
            <ActionForm action={toggleAutomationRuleAction}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-accent">{r.enabled ? "disable" : "enable"}</button></ActionForm>
          ) },
        ]}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {canEdit && (
          <Card title="New rule">
            <ActionForm action={saveAutomationRuleAction} className="space-y-2">
              <div><label className={label}>Name</label><input name="name" required className={`${input} w-full`} placeholder="Alert #refunds on fraud refunds" /></div>
              <div><label className={label}>When</label><select name="event" className={`${input} w-full`}>{EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={label}>If field</label><input name="condField" className={`${input} w-full`} placeholder="reasonCode" /></div>
                <div><label className={label}>Operator</label><select name="condOp" className={`${input} w-full`}><option value="eq">equals</option><option value="neq">not equals</option><option value="gt">greater than</option><option value="lt">less than</option></select></div>
                <div><label className={label}>Value</label><input name="condValue" className={`${input} w-full`} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={label}>Then</label><select name="connector" className={`${input} w-full`}><option value="slack">Slack</option><option value="email">Email</option></select></div>
                <div className="col-span-2"><label className={label}>Channel / address</label><input name="target" required className={`${input} w-full`} placeholder="#refunds" /></div>
              </div>
              <div><label className={label}>Message ({"{{field}}"} placeholders)</label><input name="message" required className={`${input} w-full`} placeholder="Refund {{amount}} for {{customerName}}" /></div>
              <button className={btn.primary}>Create rule</button>
            </ActionForm>
          </Card>
        )}
        <Card title="Recent runs (outbox)">
          <ul className="space-y-2 text-sm">
            {runs.length === 0 && <li className="text-ink-3">No runs yet.</li>}
            {runs.map((r) => {
              const req = JSON.parse(r.request) as { channel?: string; to?: string; text?: string; body?: string };
              return (
                <li key={r.id} className="border-l-2 border-line pl-2">
                  <div className="text-xs text-ink-2">{fmtDate(r.at)} · {r.connector} → {req.channel ?? req.to} · {r.appId}</div>
                  <div>{req.text ?? req.body}</div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
