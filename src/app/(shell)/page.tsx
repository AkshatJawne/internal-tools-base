import Link from "next/link";
import { db } from "@/kit/db";
import { getCurrentUser } from "@/kit/auth";
import { can, ROLES } from "@/kit/rbac";
import { verifyAuditChain } from "@/kit/audit-verify";
import { CONNECTORS } from "@/kit/connectors/catalog";
import { APPS } from "@/apps/manifest";

const day = () => new Date(Date.now() - 24 * 3600_000);

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = (await getCurrentUser())!;
  const { denied } = await searchParams;
  const apps = APPS.filter((a) => can(user, a.permission));
  const seesPlatform = can(user, "admin.read") || can(user, "audit.read");

  const [users, chain, pendingApprovals, reveals, calls, blocked, openRequests] = seesPlatform
    ? await Promise.all([
        db.user.count({ where: { active: true } }),
        verifyAuditChain(),
        db.approvalRequest.count({ where: { status: "pending" } }),
        db.auditEvent.count({ where: { action: "pii.reveal", at: { gte: day() } } }),
        db.connectorCall.count(),
        db.connectorCall.count({ where: { status: "blocked" } }),
        db.changeRequest.count({ where: { status: { notIn: ["merged", "closed"] } } }),
      ])
    : [];

  const provisions = seesPlatform
    ? [
        { href: "/admin/users", name: "Identity and roles", detail: `${users} users, ${Object.keys(ROLES).length} roles, deny by default` },
        { href: "/audit", name: "Audit", detail: chain!.ok ? `${chain!.count} events, chain verified` : `chain broken at ${chain!.brokenAt}` },
        { href: "/approvals", name: "Approvals", detail: `${pendingApprovals} pending, maker-checker on money and regulated decisions` },
        { href: "/admin/compliance", name: "PII handling", detail: `encrypted per field, masked by default, ${reveals} reveals in 24h` },
        { href: "/admin/connectors", name: "Connector policy", detail: `${Object.keys(CONNECTORS).length} connectors, ${calls} calls, ${blocked} blocked` },
        { href: "/requests", name: "Change requests", detail: `${openRequests} open, delivered as reviewed pull requests` },
      ]
    : [];

  return (
    <>
      {denied && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Your role does not include <code>{denied}</code>. The server refused the request and recorded it.
        </div>
      )}

      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Internal tools</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
          Every app here is built on one platform kit. Sign-in, roles, audit, approvals, PII handling and connector policy are implemented once and inherited; an app only adds its own fields, rules and screens.
        </p>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Apps</h2>
          <span className="text-xs text-ink-3">{apps.length} available to {ROLES[user.role as keyof typeof ROLES]?.label.toLowerCase()}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {apps.map((a) => (
            <Link key={a.id} href={a.route} className="group rounded-lg border border-line bg-white p-4 transition-colors hover:border-ink">
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-canvas text-xs font-semibold text-ink">{a.name[0]}</span>
                <span className="text-[11px] text-ink-3">{a.kind === "generated" ? "From a definition" : "Custom code"}</span>
              </div>
              <div className="mt-3 text-sm font-medium text-ink">{a.name}</div>
              <p className="mt-1 text-sm leading-5 text-ink-2">{a.description}</p>
              <div className="mt-3 text-xs text-ink-3">{a.owner}</div>
            </Link>
          ))}
          {apps.length === 0 && <p className="text-sm text-ink-2">No apps for this role.</p>}
        </div>
      </section>

      {seesPlatform && (
        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Platform</h2>
            <span className="text-xs text-ink-3">shared by every app</span>
          </div>
          <div className="divide-y divide-line-2 rounded-lg border border-line bg-white">
            {provisions.map((p) => (
              <Link key={p.href} href={p.href} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-canvas/60">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-ink-2">{p.detail}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {seesPlatform && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">How an app is added</h2>
          <ol className="grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Describe", "An engineer, or ops through a change request, states the fields, rules and who may do what."],
              ["Build", "Devin writes a definition file and manifest entry; custom screens only where a definition cannot express the workflow."],
              ["Review and ship", "CI enforces permission checks and audit coverage; a preview deploy is confirmed; an engineer merges."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-line bg-white p-4">
                <div className="text-xs text-ink-3">{i + 1}</div>
                <div className="mt-1 font-medium text-ink">{t}</div>
                <p className="mt-1 leading-5 text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
