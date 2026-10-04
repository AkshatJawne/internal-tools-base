import Link from "next/link";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { FIELD_TYPES, getSettings } from "@/kit/settings";
import { addCustomFieldAction, removeCustomFieldAction } from "@/kit/admin-actions";
import { Badge, Card, PageHeader, btn, input, label } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { DEFINITIONS } from "@/apps/definitions";
import { getApp } from "@/apps/manifest";

export default async function FormDesigner() {
  const user = await requirePagePermission("settings.read");
  const settings = await getSettings();
  const canEdit = can(user, "settings.write");
  return (
    <>
      <PageHeader title="Form designer" subtitle="Ops can add fields to generated apps without code. Fields from the definition file are locked; changing those is a reviewed PR." />
      <div className="space-y-6">
        {Object.values(DEFINITIONS).map((def) => {
          const app = getApp(def.appId)!;
          const custom = settings.customFields[def.appId] ?? [];
          return (
            <Card key={def.appId} title={<span>{app.icon} {app.name}</span>} actions={<Link href={`/apps/${def.appId}/new`} className="text-sm text-indigo-600">Preview form →</Link>}>
              <div className="grid gap-6 lg:grid-cols-2">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="pb-1">Field</th><th>Type</th><th>Source</th><th /></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {def.fields.map((f) => (
                      <tr key={f.name}><td className="py-1.5">{f.label} {f.pii && <Badge tone="purple">PII</Badge>}</td><td>{f.type}</td><td><Badge>code 🔒</Badge></td><td /></tr>
                    ))}
                    {custom.map((f) => (
                      <tr key={f.name}>
                        <td className="py-1.5">{f.label} {f.pii && <Badge tone="purple">PII</Badge>}</td><td>{f.type}</td><td><Badge tone="blue">ops</Badge></td>
                        <td>{canEdit && (
                          <ActionForm action={removeCustomFieldAction}>
                            <input type="hidden" name="appId" value={def.appId} /><input type="hidden" name="name" value={f.name} />
                            <button className="text-xs text-red-600">remove</button>
                          </ActionForm>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {canEdit && (
                  <ActionForm action={addCustomFieldAction} className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <input type="hidden" name="appId" value={def.appId} />
                    <div className="text-sm font-medium">Add a field</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Label</label><input name="label" required className={input} placeholder="e.g. Ticket link" /></div>
                      <div><label className={label}>Type</label><select name="type" className={input}>{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                    </div>
                    <div><label className={label}>Options (for select, comma-separated)</label><input name="options" className={input} /></div>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-1"><input type="checkbox" name="required" /> required</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="inList" defaultChecked /> show in list</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="pii" /> PII (masked)</label>
                    </div>
                    <button className={btn.primary}>Add field</button>
                  </ActionForm>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
