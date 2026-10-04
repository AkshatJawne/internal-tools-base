import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/kit/db";

type Actor = { id: string | null; name: string };

export type AuditInput = {
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  appId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

async function requestId(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("x-request-id") ?? randomUUID();
  } catch {
    return randomUUID(); // outside a request (seed, scripts)
  }
}

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));

/** The only way to write audit events. There is deliberately no update or delete helper. */
export async function audit(e: AuditInput, tx?: Prisma.TransactionClient) {
  return (tx ?? db).auditEvent.create({
    data: {
      actorId: e.actor.id,
      actorName: e.actor.name,
      action: e.action,
      appId: e.appId ?? null,
      entityType: e.entityType,
      entityId: e.entityId,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason ?? null,
      requestId: await requestId(),
    },
  });
}

export const SYSTEM = (name: string): Actor => ({ id: null, name: `system:${name}` });
