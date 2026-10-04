import Link from "next/link";
import { getCurrentUser } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { Card, PageHeader } from "@/kit/ui";
import { APPS } from "@/apps/manifest";

const MAPPING = [
  ["Entra ID sign-in + security roles", "Swappable auth module + role → permission map, enforced on every server action", "/admin/users"],
  ["Dataverse tables + model-driven apps", "Typed definitions → generated list, form, detail and audit (Refunds, Feature flags)", "/apps/refunds"],
  ["Canvas apps (custom UI)", "Hand-built screens on the same kit (KYC queue)", "/kyc"],
  ["Power Automate approvals", "Reusable maker-checker primitive + approvals inbox", "/approvals"],
  ["Power Automate flows", "Ops-editable when/then rules firing Slack and email connectors", "/admin/automations"],
  ["Connectors + DLP policies", "Connector adapters with a per-app allowlist; every call logged", "/admin/connectors"],
  ["Citizen-developer edits", "Settings and form designer: ops change fields, thresholds and reason codes without code", "/admin/forms"],
  ["Admin center + auditing", "App catalog, roles matrix, append-only audit log", "/audit"],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = (await getCurrentUser())!;
  const { denied } = await searchParams;
  const apps = APPS.filter((a) => can(user, a.permission));
  return (
    <>
      {denied && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Access denied: your role lacks <code>{denied}</code>.
        </div>
      )}
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle="Apps you can open with your role. Everything else is hidden in the UI and refused by the server." />
      <div className="grid gap-4 sm:grid-cols-3">
        {apps.map((a) => (
          <Link key={a.id} href={a.route} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-400">
            <div className="text-2xl">{a.icon}</div>
            <div className="mt-2 font-medium">{a.name}</div>
            <div className="mt-1 text-sm text-slate-500">{a.description}</div>
            <div className="mt-3 text-xs text-slate-400">{a.kind === "generated" ? "Generated from a definition" : "Custom UI"} · {a.owner}</div>
          </Link>
        ))}
        {apps.length === 0 && <p className="text-sm text-slate-500">Your role has no apps. Use the governance links on the left.</p>}
      </div>
      <Card title="What replaces each Power Apps capability" className="mt-8">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {MAPPING.map(([pa, ours, href]) => (
              <tr key={pa}>
                <td className="py-2 pr-4 font-medium text-slate-700">{pa}</td>
                <td className="py-2 pr-4 text-slate-600">{ours}</td>
                <td className="py-2 text-right"><Link href={href} className="text-indigo-600 hover:underline">open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
