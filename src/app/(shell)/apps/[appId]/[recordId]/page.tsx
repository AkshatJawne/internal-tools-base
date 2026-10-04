import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { getFields, redact } from "@/kit/engine/fields";
import { runRecordAction } from "@/kit/engine/actions";
import { PENDING_APPROVAL } from "@/kit/engine/definition";
import type { RecordData } from "@/kit/engine/types";
import { Badge, Card, Field, PageHeader, btn, fmtDate, fmtMoney, input } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { PiiField } from "@/kit/ui/PiiField";
import { AuditTimeline } from "@/kit/ui/AuditTimeline";
import { DEFINITIONS } from "@/apps/definitions";
import { getApp } from "@/apps/manifest";

export default async function RecordPage({ params }: { params: Promise<{ appId: string; recordId: string }> }) {
  const { appId, recordId } = await params;
  const def = DEFINITIONS[appId];
  const app = getApp(appId);
  if (!def || !app) notFound();
  const user = await requirePagePermission(def.permissions.read);
  const rec = await db.record.findUnique({ where: { id: recordId } });
  if (!rec || rec.appId !== appId) notFound();
  const settings = await getSettings();
  const fields = getFields(def, settings);
  const data = redact(fields, JSON.parse(rec.data) as RecordData); // PII arrives here already masked; reveal goes through revealPii()
  const known = new Set(fields.map((f) => f.name));
  const systemFields = Object.entries(data).filter(([k]) => !known.has(k));
  const actions = def.actions.filter((a) => a.from.includes(rec.status) && can(user, a.permission));
  const pending = rec.status === PENDING_APPROVAL ? await db.approvalRequest.findFirst({ where: { entityType: "Record", entityId: rec.id, status: "pending" } }) : null;
  const status = def.statuses[rec.status];

  return (
    <>
      <Link href={`/apps/${appId}`} className="text-sm text-accent">← {app.name}</Link>
      <PageHeader title={<span className="flex items-center gap-2">{String(data[def.titleField] ?? rec.id)} <Badge tone={status?.tone}>{status?.label ?? rec.status}</Badge></span>} subtitle={`Created ${fmtDate(rec.createdAt)} by ${rec.createdBy}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Details">
            <dl className="grid grid-cols-2 gap-4">
              {fields.map((f) => {
                const v = data[f.name];
                return (
                  <Field key={f.name} label={f.label}>
                    {v == null || v === "" ? <span className="text-ink-3">—</span>
                      : f.pii ? <PiiField entityType="Record" entityId={rec.id} field={f.name} masked={String(v)} canReveal={can(user, "pii.reveal")} />
                      : f.type === "money" ? fmtMoney(Number(v), String(data.currency ?? "USD"))
                      : String(v)}
                  </Field>
                );
              })}
              {systemFields.map(([k, v]) => <Field key={k} label={`${k} (system)`}><span className="font-mono text-xs">{String(v)}</span></Field>)}
            </dl>
          </Card>
          <Card title="Audit trail"><AuditTimeline entityType="Record" entityId={rec.id} /></Card>
        </div>
        <div className="space-y-4">
          {pending && (
            <Card title="Waiting for approval">
              <p className="text-sm">{pending.summary}</p>
              <p className="mt-1 text-xs text-ink-2">Requested by {pending.makerName}. Needs <code>{pending.requiredPermission}</code> and a different person.</p>
              <Link href="/approvals" className={`${btn.secondary} mt-3`}>Open approvals</Link>
            </Card>
          )}
          {actions.map((a) => {
            const gated = a.approval?.when(data, settings);
            return (
              <Card key={a.id} title={a.label}>
                <ActionForm action={runRecordAction.bind(null, appId, rec.id, a.id)} className="space-y-2">
                  {(a.requireReason || gated) && <input name="reason" placeholder="Reason (required)" className={`${input} w-full`} />}
                  {gated && <p className="text-xs text-amber-700">Needs approval from someone with <code>{a.approval!.permission}</code>.</p>}
                  <button className={a.tone === "danger" ? btn.danger : btn.primary}>{gated ? `Request: ${a.label}` : a.label}</button>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
