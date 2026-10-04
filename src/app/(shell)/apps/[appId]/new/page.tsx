import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, requirePagePermission } from "@/kit/auth";
import { can } from "@/kit/rbac";
import { getSettings } from "@/kit/settings";
import { getFields } from "@/kit/engine/fields";
import { createRecordAction } from "@/kit/engine/actions";
import { FieldInput } from "@/kit/engine/FieldInput";
import { Card, PageHeader, btn } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { DEFINITIONS } from "@/apps/definitions";
import { getApp } from "@/apps/manifest";

export default async function NewRecord({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const def = DEFINITIONS[appId];
  const app = getApp(appId);
  if (!def || !app) notFound();
  // Admins without create rights can still preview the form from the Form designer.
  const canCreate = can(await getCurrentUser(), def.permissions.create);
  if (!canCreate) await requirePagePermission("settings.read");
  const settings = await getSettings();
  return (
    <>
      <Link href={`/apps/${appId}`} className="text-sm text-accent">← {app.name}</Link>
      <PageHeader title={`New ${app.name.toLowerCase().replace(/s$/, "")}`} subtitle="Form generated from the app definition plus fields ops added in the Form designer. Validated on the server with zod." />
      <Card className="max-w-2xl">
        <ActionForm action={createRecordAction.bind(null, appId)} className="grid gap-4 sm:grid-cols-2">
          {getFields(def, settings).map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}><FieldInput f={f} settings={settings} /></div>
          ))}
          <div className="sm:col-span-2">
            {canCreate ? <button className={btn.primary}>Create</button> : <p className="text-sm text-amber-700">Preview only: your role can&apos;t create {app.name.toLowerCase()} records.</p>}
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
