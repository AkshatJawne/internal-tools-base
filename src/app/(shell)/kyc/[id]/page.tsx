import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { decideApprovalAction } from "@/kit/approvals-actions";
import { Badge, Card, Field, PageHeader, btn, input, label, timeUntil } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { PiiField } from "@/kit/ui/PiiField";
import { AuditTimeline } from "@/kit/ui/AuditTimeline";
import { decideCase, reassignCase } from "@/apps/kyc/actions";
import { sla } from "@/apps/kyc/risk";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("kyc.case.read");
  const { id } = await params;
  const c = await db.kycCase.findUnique({ where: { id }, include: { documents: true } });
  if (!c) notFound();
  const settings = await getSettings();
  const users = await db.user.findMany();
  const assignee = users.find((u) => u.id === c.assigneeId);
  const s = sla(c, settings.slaHours);
  const reveal = can(user, "pii.reveal");
  const approval = c.status === "pending_signoff" ? await db.approvalRequest.findFirst({ where: { entityType: "KycCase", entityId: c.id, status: "pending" } }) : null;
  const canDecide = can(user, "kyc.case.decide") && c.status === "in_review" && c.assigneeId === user.id;
  const needsSignoff = (settings.makerCheckerTiers as string[]).includes(c.riskTier);

  return (
    <>
      <Link href="/kyc" className="text-sm text-accent">← Queue</Link>
      <PageHeader
        title={<span className="flex items-center gap-2">{c.externalRef} <Badge tone={c.riskTier === "high" ? "red" : c.riskTier === "medium" ? "amber" : "gray"}>{c.riskTier} risk</Badge> <Badge>{c.status.replace("_", " ")}</Badge></span>}
        subtitle={s.state === "done" ? `Decided: ${c.decision} · ${c.decisionReason}` : `SLA ${timeUntil(s.due)} (${settings.slaHours[c.riskTier as "low"]}h for ${c.riskTier} risk)`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Applicant">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Name">{c.firstName} {c.lastName}</Field>
              <Field label="Country">{c.country}</Field>
              <Field label="Email"><PiiField entityType="KycCase" entityId={c.id} field="email" masked={c.emailMask} canReveal={reveal} /></Field>
              <Field label="SSN"><PiiField entityType="KycCase" entityId={c.id} field="ssn" masked={c.ssnMask} canReveal={reveal} /></Field>
              <Field label="Date of birth"><PiiField entityType="KycCase" entityId={c.id} field="dob" masked="••/••/••••" canReveal={reveal} /></Field>
            </dl>
          </Card>
          <Card title="Vendor results">
            <dl className="grid grid-cols-3 gap-4">
              <Field label="ID document score"><span className={c.idScore < 50 ? "font-semibold text-red-600" : ""}>{c.idScore} / 100</span></Field>
              <Field label="Sanctions">{c.sanctionsHit ? <Badge tone="red">possible match</Badge> : <Badge tone="green">clear</Badge>}</Field>
              <Field label="PEP">{c.pepHit ? <Badge tone="purple">possible match</Badge> : <Badge tone="green">clear</Badge>}</Field>
            </dl>
          </Card>
          <Card title="Documents">
            <div className="grid gap-3 sm:grid-cols-2">
              {c.documents.map((d) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={d.id} alt={d.kind} className="w-full rounded-lg border border-line" src={`data:image/svg+xml;base64,${Buffer.from(d.svg).toString("base64")}`} />
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {canDecide && (
            <Card title="Decision">
              <ActionForm action={decideCase} className="space-y-3">
                <input type="hidden" name="caseId" value={c.id} />
                <div>
                  <span className={label}>Decision</span>
                  <div className="flex gap-3 text-sm">
                    {(["approve", "reject", "escalate"] as const).map((d) => (
                      <label key={d} className="flex items-center gap-1"><input type="radio" name="decision" value={d} required /> {d}</label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="reasonCode">Reason code</label>
                  <select id="reasonCode" name="reasonCode" className={`${input} w-full`} required defaultValue="">
                    <option value="" disabled>Select…</option>
                    {(["approve", "reject", "escalate"] as const).map((d) => (
                      <optgroup key={d} label={d}>{settings.kycReasonCodes[d].map((r) => <option key={r}>{r}</option>)}</optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="note">Note</label>
                  <textarea id="note" name="note" rows={2} className={`${input} w-full`} />
                </div>
                {needsSignoff && <p className="text-xs text-amber-700">{c.riskTier} risk: approve/reject needs a KYC lead&apos;s sign-off.</p>}
                <button className={btn.primary}>Submit decision</button>
              </ActionForm>
            </Card>
          )}
          {approval && (
            <Card title="Four-eyes sign-off">
              <p className="text-sm">{approval.makerName} proposed: <strong>{approval.summary}</strong></p>
              {approval.makerReason && <p className="mt-1 text-xs text-ink-2">Note: {approval.makerReason}</p>}
              {approval.makerId === user.id ? (
                <p className="mt-3 text-sm text-amber-700">Waiting for a lead. You can&apos;t sign off your own decision.</p>
              ) : can(user, "kyc.case.signoff") ? (
                <ActionForm action={decideApprovalAction} className="mt-3 space-y-2">
                  <input type="hidden" name="approvalId" value={approval.id} />
                  <input name="reason" placeholder="Sign-off note (required)" className={`${input} w-full`} />
                  <div className="flex gap-2">
                    <button name="decision" value="approve" className={btn.primary}>Sign off</button>
                    <button name="decision" value="reject" className={btn.secondary}>Send back</button>
                  </div>
                </ActionForm>
              ) : (
                <p className="mt-3 text-sm text-ink-2">Needs a user with kyc.case.signoff.</p>
              )}
            </Card>
          )}
          <Card title="Assignment">
            <p className="text-sm">{assignee ? assignee.name : "Unassigned"}</p>
            {can(user, "kyc.case.reassign") && !["approved", "rejected", "pending_signoff"].includes(c.status) && (
              <ActionForm action={reassignCase} className="mt-2 flex gap-2">
                <input type="hidden" name="caseId" value={c.id} />
                <select name="assigneeId" className={`${input} w-full`} defaultValue={c.assigneeId ?? ""}>
                  {users.filter((u) => can(u, "kyc.case.decide")).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button className={btn.secondary}>Assign</button>
              </ActionForm>
            )}
          </Card>
          <Card title="Audit trail"><AuditTimeline entityType="KycCase" entityId={c.id} /></Card>
        </div>
      </div>
    </>
  );
}
