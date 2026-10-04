import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { getFields, redact } from "@/kit/engine/fields";
import type { RecordData } from "@/kit/engine/types";
import { Badge, DataTable, PageHeader, btn, fmtDate, fmtMoney } from "@/kit/ui";
import { DEFINITIONS } from "@/apps/definitions";
import { getApp } from "@/apps/manifest";

export default async function AppList({ params, searchParams }: { params: Promise<{ appId: string }>; searchParams: Promise<{ status?: string }> }) {
  const { appId } = await params;
  const { status } = await searchParams;
  const def = DEFINITIONS[appId];
  const app = getApp(appId);
  if (!def || !app) notFound();
  const user = await requirePagePermission(def.permissions.read);
  const fields = getFields(def, await getSettings());
  const listFields = fields.filter((f) => f.inList);
  const records = await db.record.findMany({ where: { appId, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" } });
  const rows = records.map((r) => ({ ...r, d: redact(fields, JSON.parse(r.data) as RecordData) }));

  return (
    <>
      <PageHeader
        title={app.name}
        subtitle={<>{app.description} <span className="text-ink-3">· generated from <code>src/apps/{appId}/definition.ts</code></span></>}
        actions={can(user, def.permissions.create) && <Link href={`/apps/${appId}/new`} className={btn.primary}>New</Link>}
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href={`/apps/${appId}`} className={!status ? "font-semibold text-accent" : "text-ink-2"}>All</Link>
        {Object.entries(def.statuses).map(([k, s]) => (
          <Link key={k} href={`/apps/${appId}?status=${k}`} className={status === k ? "font-semibold text-accent" : "text-ink-2"}>{s.label}</Link>
        ))}
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          ...listFields.map((f, i) => ({
            key: f.name,
            label: f.label,
            render: (r: (typeof rows)[number]) => {
              const v = r.d[f.name];
              const text = v == null ? "—" : f.type === "money" ? fmtMoney(Number(v), String(r.d.currency ?? "USD")) : String(v);
              return i === 0 ? <Link className="font-medium text-accent hover:underline" href={`/apps/${appId}/${r.id}`}>{text}</Link> : text;
            },
          })),
          { key: "status", label: "Status", render: (r) => <Badge tone={def.statuses[r.status]?.tone}>{def.statuses[r.status]?.label ?? r.status}</Badge> },
          { key: "created", label: "Created", render: (r) => <span className="text-ink-2">{fmtDate(r.createdAt)} · {r.createdBy}</span> },
        ]}
      />
    </>
  );
}
