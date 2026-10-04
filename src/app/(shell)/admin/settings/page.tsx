import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings, SETTING_META, type SettingKey } from "@/kit/settings";
import { updateSettingAction } from "@/kit/admin-actions";
import { Badge, Card, PageHeader, btn, input, label } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";

function Section({ k, canEdit, children }: { k: SettingKey; canEdit: boolean; children: React.ReactNode }) {
  const meta = SETTING_META[k];
  return (
    <Card title={<span className="flex items-center gap-2">{meta.label} {meta.requiresApproval && <Badge tone="amber">needs 2nd approver</Badge>}</span>}>
      <p className="mb-3 text-sm text-slate-500">{meta.description}</p>
      <ActionForm action={updateSettingAction.bind(null, k)} className="space-y-3">
        <fieldset disabled={!canEdit} className="space-y-3">{children}</fieldset>
        {canEdit && (
          <div className="flex gap-2">
            <input name="reason" placeholder="Why? (audited)" className={input} />
            <button className={btn.primary}>{meta.requiresApproval ? "Submit for approval" : "Save"}</button>
          </div>
        )}
      </ActionForm>
    </Card>
  );
}

export default async function SettingsPage() {
  const user = await requirePagePermission("settings.read");
  const s = await getSettings();
  const canEdit = can(user, "settings.write");
  const pending = await db.approvalRequest.findMany({ where: { kind: "settings.update", status: "pending" } });
  return (
    <>
      <PageHeader title="Settings" subtitle="Business rules ops can change without a deploy. Every change is audited with before/after values." />
      {!canEdit && <p className="mb-4 text-sm text-slate-500">Read-only for your role.</p>}
      {pending.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {pending.map((p) => <div key={p.id}>Pending approval: {p.summary} (requested by {p.makerName})</div>)}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section k="approvalThresholds" canEdit={canEdit}>
          <label className={label}>Refunds above this amount need an approver (USD)</label>
          <input name="refundAmount" type="number" min={0} defaultValue={s.approvalThresholds.refundAmount} className={input} />
        </Section>
        <Section k="slaHours" canEdit={canEdit}>
          <div className="grid grid-cols-3 gap-2">
            {(["high", "medium", "low"] as const).map((t) => (
              <div key={t}><label className={label}>{t} risk (hours)</label><input name={t} type="number" min={1} defaultValue={s.slaHours[t]} className={input} /></div>
            ))}
          </div>
        </Section>
        <Section k="makerCheckerTiers" canEdit={canEdit}>
          <div className="flex gap-4 text-sm">
            {(["high", "medium", "low"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" name="tiers" value={t} defaultChecked={(s.makerCheckerTiers as string[]).includes(t)} /> {t}</label>
            ))}
          </div>
        </Section>
        <Section k="refundReasons" canEdit={canEdit}>
          <label className={label}>One per line</label>
          <textarea name="values" rows={4} defaultValue={s.refundReasons.join("\n")} className={input} />
        </Section>
        <Section k="kycReasonCodes" canEdit={canEdit}>
          <div className="grid grid-cols-3 gap-2">
            {(["approve", "reject", "escalate"] as const).map((d) => (
              <div key={d}><label className={label}>{d}</label><textarea name={d} rows={5} defaultValue={s.kycReasonCodes[d].join("\n")} className={`${input} text-xs`} /></div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
