import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import { db } from "@/kit/db";
import { can, ROLES, type Permission, type Role } from "@/kit/rbac";
import { signOut } from "@/kit/auth/actions";
import { APPS } from "@/apps/manifest";
import { NavLink } from "./NavLink";

const ADMIN_LINKS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Admin center", permission: "admin.read" },
  { href: "/admin/settings", label: "Settings", permission: "settings.read" },
  { href: "/admin/forms", label: "Form designer", permission: "settings.read" },
  { href: "/admin/automations", label: "Automations", permission: "settings.read" },
  { href: "/admin/connectors", label: "Connectors & data policy", permission: "admin.read" },
  { href: "/admin/users", label: "Users & roles", permission: "admin.read" },
  { href: "/audit", label: "Audit log", permission: "audit.read" },
];

export async function Shell({ user, children }: { user: User; children: ReactNode }) {
  const apps = APPS.filter((a) => can(user, a.permission));
  const pending = await db.approvalRequest.findMany({ where: { status: "pending", NOT: { makerId: user.id } }, select: { requiredPermission: true } });
  const myApprovals = pending.filter((p) => can(user, p.requiredPermission as Permission)).length;
  const admin = ADMIN_LINKS.filter((l) => can(user, l.permission));

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 px-3 py-4">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold text-white">Internal Tools</div>
          <div className="text-xs text-slate-400">Acme Pay · built on the kit</div>
        </div>
        <nav className="flex-1 space-y-5">
          <div className="space-y-0.5">
            <NavLink href="/">Home</NavLink>
          </div>
          {apps.length > 0 && (
            <div>
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Apps</div>
              <div className="space-y-0.5">
                {apps.map((a) => <NavLink key={a.id} href={a.route}><span>{a.icon} {a.name}</span></NavLink>)}
              </div>
            </div>
          )}
          {can(user, "approvals.read") && (
            <div>
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Workflow</div>
              <NavLink href="/approvals">
                <span>Approvals</span>
                {myApprovals > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-900">{myApprovals}</span>}
              </NavLink>
            </div>
          )}
          {admin.length > 0 && (
            <div>
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Governance</div>
              <div className="space-y-0.5">{admin.map((l) => <NavLink key={l.href} href={l.href}>{l.label}</NavLink>)}</div>
            </div>
          )}
        </nav>
        <div className="mt-4 border-t border-slate-800 px-2 pt-3">
          <div className="text-sm text-white">{user.name}</div>
          <div className="text-xs text-slate-400">{ROLES[user.role as Role]?.label ?? user.role}</div>
          <form action={signOut}>
            <button className="mt-2 text-xs text-indigo-300 hover:text-indigo-200">Switch user</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-6 py-2 text-xs">
          <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{(process.env.APP_ENV ?? "development").toUpperCase()}</span>
          <span className="text-slate-500">Synthetic data only · mock connectors</span>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
