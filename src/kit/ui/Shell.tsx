import type { ReactNode } from "react";
import type { User } from "@prisma/client";
import { db } from "@/kit/db";
import { can, ROLES, type Permission, type Role } from "@/kit/rbac";
import { signOut } from "@/kit/auth/actions";
import { APPS } from "@/apps/manifest";
import { NavLink } from "./NavLink";

type Item = { href: string; label: string; permission: Permission };

const OPERATE: Item[] = [
  { href: "/approvals", label: "Approvals", permission: "approvals.read" },
  { href: "/requests", label: "Change requests", permission: "requests.create" },
];

const PLATFORM: Item[] = [
  { href: "/admin", label: "Overview", permission: "admin.read" },
  { href: "/admin/users", label: "Users and roles", permission: "admin.read" },
  { href: "/admin/settings", label: "Settings", permission: "settings.read" },
  { href: "/admin/forms", label: "Form designer", permission: "settings.read" },
  { href: "/admin/automations", label: "Automations", permission: "settings.read" },
  { href: "/admin/connectors", label: "Connectors", permission: "admin.read" },
  { href: "/admin/compliance", label: "Compliance", permission: "audit.read" },
  { href: "/audit", label: "Audit log", permission: "audit.read" },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-3">{title}</div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

export async function Shell({ user, children }: { user: User; children: ReactNode }) {
  const apps = APPS.filter((a) => can(user, a.permission));
  const pending = await db.approvalRequest.findMany({ where: { status: "pending", NOT: { makerId: user.id } }, select: { requiredPermission: true } });
  const myApprovals = pending.filter((p) => can(user, p.requiredPermission as Permission)).length;
  const operate = OPERATE.filter((l) => can(user, l.permission));
  const platform = PLATFORM.filter((l) => can(user, l.permission));
  const env = process.env.APP_ENV ?? "development";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-canvas px-3 py-4">
        <div className="mb-6 flex items-center gap-2.5 px-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-white">A</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">Acme Pay</div>
            <div className="text-[11px] text-ink-2">Internal tools</div>
          </div>
        </div>
        <nav className="flex-1 space-y-6">
          <div className="space-y-px">
            <NavLink href="/">Home</NavLink>
          </div>
          {apps.length > 0 && (
            <Group title="Apps">
              {apps.map((a) => <NavLink key={a.id} href={a.route}>{a.name}</NavLink>)}
            </Group>
          )}
          {operate.length > 0 && (
            <Group title="Operate">
              {operate.map((l) => (
                <NavLink key={l.href} href={l.href}>
                  <span>{l.label}</span>
                  {l.href === "/approvals" && myApprovals > 0 && <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium tabular-nums text-amber-800">{myApprovals}</span>}
                </NavLink>
              ))}
            </Group>
          )}
          {platform.length > 0 && (
            <Group title="Platform">
              {platform.map((l) => <NavLink key={l.href} href={l.href}>{l.label}</NavLink>)}
            </Group>
          )}
        </nav>
        <div className="mt-4 border-t border-line px-2.5 pt-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
              <div className="truncate text-[11px] text-ink-2">{ROLES[user.role as Role]?.label ?? user.role}</div>
            </div>
            <form action={signOut}>
              <button className="text-[11px] text-ink-2 hover:text-ink">Sign out</button>
            </form>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {env} · synthetic data
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-white">
        <div className="mx-auto w-full max-w-6xl px-10 py-10">{children}</div>
      </main>
    </div>
  );
}
