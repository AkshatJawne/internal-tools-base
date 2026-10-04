import { db } from "@/kit/db";
import { requirePagePermission } from "@/kit/auth";
import { can, PERMISSIONS, ROLES, type Permission, type Role } from "@/kit/rbac";
import { setUserRoleAction } from "@/kit/admin-actions";
import { Card, DataTable, PageHeader, btn, input } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";

export default async function Users() {
  const me = await requirePagePermission("admin.read");
  const users = await db.user.findMany({ orderBy: { team: "asc" } });
  const roles = Object.keys(ROLES) as Role[];
  const manage = can(me, "users.manage");
  return (
    <>
      <PageHeader title="Users & roles" subtitle="In production, users and role assignments sync from IdP groups (SCIM). Role changes here are audited." />
      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        columns={[
          { key: "n", label: "User", render: (u) => <><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></> },
          { key: "t", label: "Team", render: (u) => u.team },
          {
            key: "r",
            label: "Role",
            render: (u) =>
              manage && u.id !== me.id ? (
                <ActionForm action={setUserRoleAction} className="flex gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="role" defaultValue={u.role} className={`${input} w-44`}>{roles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select>
                  <button className={btn.secondary}>Save</button>
                </ActionForm>
              ) : (
                ROLES[u.role as Role]?.label
              ),
          },
        ]}
      />
      <Card title="Role → permission matrix (src/kit/rbac.ts)" className="mt-6">
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="pr-4 text-left">Permission</th>{roles.map((r) => <th key={r} className="px-2">{ROLES[r].label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p}>
                  <td className="py-1 pr-4"><code>{p}</code> <span className="text-slate-400">{PERMISSIONS[p]}</span></td>
                  {roles.map((r) => <td key={r} className="text-center">{(ROLES[r].permissions as readonly string[]).includes(p) ? "✓" : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
