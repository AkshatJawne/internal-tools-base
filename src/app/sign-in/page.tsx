import { db } from "@/kit/db";
import { ROLES, type Role } from "@/kit/rbac";
import { signInAs } from "@/kit/auth/actions";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  const users = await db.user.findMany({ where: { active: true }, orderBy: { team: "asc" } });
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>DEV ONLY.</strong> In production this page is replaced by SSO through your identity provider (Entra ID or Okta). Roles come from IdP groups.
      </div>
      <h1 className="text-2xl font-semibold">Sign in as…</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Pick a seeded user to see the platform through their role.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {users.map((u) => (
          <form key={u.id} action={signInAs}>
            <input type="hidden" name="userId" value={u.id} />
            <button className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-indigo-400">
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-slate-500">{ROLES[u.role as Role]?.label} · {u.team}</div>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
