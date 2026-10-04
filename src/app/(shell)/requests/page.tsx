import Link from "next/link";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { CLASSIFICATIONS, REQUEST_STATUSES, type Classification } from "@/kit/requests";
import { Badge, Card, DataTable, PageHeader, btn, fmtDate } from "@/kit/ui";
import { APPS } from "@/apps/manifest";

export default async function Requests() {
  const user = await requirePagePermission("requests.create");
  const manage = can(user, "requests.manage");
  const rows = await db.changeRequest.findMany({ where: manage ? {} : { requesterId: user.id }, orderBy: { createdAt: "desc" } });
  const appName = (id: string) => APPS.find((a) => a.id === id)?.name ?? (id === "new-app" ? "New app" : id);
  return (
    <>
      <PageHeader
        title="Change requests"
        subtitle={manage ? "Every request from ops. Dispatch to Devin, track the PR and preview, close out." : "Ask for a change to any app in plain English. Devin drafts it as a pull request, an engineer reviews it, and you confirm the preview before it ships."}
        actions={<Link href="/requests/new" className={btn.primary}>New request</Link>}
      />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No requests yet"
        columns={[
          { key: "t", label: "Request", render: (r) => <Link href={`/requests/${r.id}`} className="font-medium text-accent">{r.title}</Link> },
          { key: "a", label: "App", render: (r) => appName(r.appId) },
          { key: "c", label: "Class", render: (r) => <span className="text-xs">{CLASSIFICATIONS[r.classification as Classification]?.label ?? r.classification}</span> },
          { key: "u", label: "Urgency", render: (r) => <Badge tone={r.urgency === "high" ? "red" : r.urgency === "low" ? "gray" : "blue"}>{r.urgency}</Badge> },
          { key: "s", label: "Status", render: (r) => <Badge tone={REQUEST_STATUSES[r.status]?.tone}>{REQUEST_STATUSES[r.status]?.label ?? r.status}</Badge> },
          { key: "by", label: "Requester", render: (r) => <span className="text-ink-2">{r.requesterName}<div className="text-xs text-ink-3">{fmtDate(r.createdAt)}</div></span> },
        ]}
      />
      <Card title="How a request becomes a change" className="mt-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
          <li><strong>Tier 1 — no request needed:</strong> reason codes, SLA hours, refund reasons, form fields and automation rules are edited directly in Admin, audited, with a second approver for thresholds.</li>
          <li><strong>Tier 2 — this page:</strong> anything that needs code. Ops admin dispatches it to Devin with a prompt that carries the conventions and guardrails (shown on each request). Devin opens one PR on a <code>devin/cr-*</code> branch; it has no production credentials.</li>
          <li>CI runs lint, typecheck, build, <code>permission-lint</code>, <code>audit-lint</code> and <code>dep-lint</code>. CODEOWNERS routes the review: one engineer for UI, the app owner for logic, plus security for anything touching money, PII or permissions.</li>
          <li>The requester confirms the preview deploy; engineering merges. Deliberately hours, not minutes, for KYC and refunds. That is the trade against Power Apps&apos; instant publish.</li>
        </ol>
      </Card>
    </>
  );
}
