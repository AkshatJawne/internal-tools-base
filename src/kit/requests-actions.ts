"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/kit/db";
import { audit } from "@/kit/audit";
import { requirePermission } from "@/kit/auth";
import { devin, notify } from "@/kit/connectors";
import { errorMessage, type FormState } from "@/kit/action-state";
import { APPS } from "@/apps/manifest";
import { buildDevinPrompt, CLASSIFICATIONS, REQUEST_STATUSES } from "@/kit/requests";

const createSchema = z.object({
  appId: z.string().refine((v) => v === "new-app" || APPS.some((a) => a.id === v), "Unknown app"),
  title: z.string().min(5, "Give it a short title").max(120),
  description: z.string().min(20, "Describe what should change and why (20+ chars)").max(4000),
  classification: z.enum(Object.keys(CLASSIFICATIONS) as [keyof typeof CLASSIFICATIONS, ...(keyof typeof CLASSIFICATIONS)[]]),
  urgency: z.enum(["low", "normal", "high"]),
});

export async function createChangeRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  let id: string;
  try {
    const user = await requirePermission("requests.create");
    const parsed = createSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
    const r = await db.changeRequest.create({ data: { ...parsed.data, requesterId: user.id, requesterName: user.name } });
    id = r.id;
    await audit({ actor: user, action: "change_request.created", appId: r.appId, entityType: "ChangeRequest", entityId: r.id, after: { title: r.title, classification: r.classification, urgency: r.urgency } });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/requests/${id}`);
}

/** Ops admin sends the request to Devin. Mock connector; the real call is a POST to the Devin API (docs/devin/automation.md). */
export async function dispatchToDevin(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("requests.manage");
    const r = await db.changeRequest.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
    if (r.status !== "open") return { error: `Already ${REQUEST_STATUSES[r.status]?.label ?? r.status}` };
    const prompt = buildDevinPrompt(r);
    const session = await devin.openSession({ changeRequestId: r.id, prompt });
    await db.changeRequest.update({ where: { id: r.id }, data: { status: "dispatched", prompt } });
    await audit({ actor: user, action: "change_request.dispatched", appId: r.appId, entityType: "ChangeRequest", entityId: r.id, before: { status: "open" }, after: { status: "dispatched", session: session.url } });
    await notify.slack("platform", "#internal-tools", `Change request ${r.id} (${r.title}) sent to Devin by ${user.name}`);
    revalidatePath(`/requests/${r.id}`);
    return { ok: "Sent to Devin. It will open a PR; an engineer reviews before anything ships." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["pr_open", "preview_ready", "deployed", "declined"]),
  prUrl: z.string().url().optional().or(z.literal("")),
  previewUrl: z.string().url().optional().or(z.literal("")),
  reason: z.string().max(500).optional(),
});

export async function updateChangeRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("requests.manage");
    const parsed = updateSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid update" };
    const { id, status, prUrl, previewUrl, reason } = parsed.data;
    const before = await db.changeRequest.findUniqueOrThrow({ where: { id } });
    if (["deployed", "declined"].includes(before.status)) return { error: "This request is closed" };
    if (status === "declined" && !reason?.trim()) return { error: "Say why it was declined" };
    const r = await db.changeRequest.update({ where: { id }, data: { status, prUrl: prUrl || before.prUrl, previewUrl: previewUrl || before.previewUrl } });
    await audit({ actor: user, action: `change_request.${status}`, appId: r.appId, entityType: "ChangeRequest", entityId: r.id, before: { status: before.status }, after: { status, prUrl: r.prUrl, previewUrl: r.previewUrl }, reason: reason || null });
    revalidatePath(`/requests/${id}`);
    return { ok: `Marked ${REQUEST_STATUSES[status].label}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** The requester confirms the preview does what they asked. Only the requester can do this. */
export async function approvePreview(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requirePermission("requests.create");
    const r = await db.changeRequest.findUniqueOrThrow({ where: { id: String(fd.get("id")) } });
    if (r.requesterId !== user.id) return { error: "Only the requester can confirm the preview" };
    if (r.status !== "preview_ready") return { error: "No preview to confirm yet" };
    await db.changeRequest.update({ where: { id: r.id }, data: { status: "approved" } });
    await audit({ actor: user, action: "change_request.approved", appId: r.appId, entityType: "ChangeRequest", entityId: r.id, before: { status: "preview_ready" }, after: { status: "approved" }, reason: String(fd.get("reason") ?? "") || null });
    revalidatePath(`/requests/${r.id}`);
    return { ok: "Confirmed. Engineering can merge once CI and review pass." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
