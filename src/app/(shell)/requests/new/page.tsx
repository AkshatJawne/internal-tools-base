import Link from "next/link";
import { requirePagePermission } from "@/kit/auth";
import { createChangeRequest } from "@/kit/requests-actions";
import { CLASSIFICATIONS } from "@/kit/requests";
import { Card, PageHeader, btn, input, label } from "@/kit/ui";
import { ActionForm } from "@/kit/ui/ActionForm";
import { APPS } from "@/apps/manifest";

export default async function NewRequest() {
  await requirePagePermission("requests.create");
  return (
    <>
      <Link href="/requests" className="text-sm text-accent">← Change requests</Link>
      <PageHeader title="New change request" subtitle="Describe the outcome you need, not the implementation. Include who is affected and what 'done' looks like." />
      <Card className="max-w-2xl">
        <ActionForm action={createChangeRequest} className="space-y-4">
          <div>
            <label className={label} htmlFor="appId">App</label>
            <select id="appId" name="appId" className={`${input} w-full`}>
              {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value="new-app">A new app</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="title">Title</label>
            <input id="title" name="title" className={`${input} w-full`} placeholder="e.g. Show the customer's last 3 refunds on the refund detail page" required />
          </div>
          <div>
            <label className={label} htmlFor="description">What should change and why</label>
            <textarea id="description" name="description" rows={6} className={`${input} w-full`} placeholder="Today when I review a refund I have to open the payments console to check for repeat refunds. I'd like…" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="classification">What does it touch?</label>
              <select id="classification" name="classification" className={`${input} w-full`}>
                {Object.entries(CLASSIFICATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-2">Decides who must review. Engineering can reclassify.</p>
            </div>
            <div>
              <label className={label} htmlFor="urgency">Urgency</label>
              <select id="urgency" name="urgency" className={`${input} w-full`} defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select>
            </div>
          </div>
          <p className="text-xs text-ink-2">Don&apos;t paste customer data here. The request text is sent to Devin.</p>
          <button className={btn.primary}>Submit request</button>
        </ActionForm>
      </Card>
    </>
  );
}
