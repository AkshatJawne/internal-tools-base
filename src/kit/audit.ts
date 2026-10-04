import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
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

export const GENESIS_HASH = "0".repeat(64);

export type HashedFields = {
  seq: number;
  prevHash: string;
  at: Date;
  actorId: string | null;
  actorName: string;
  action: string;
  appId: string | null;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  reason: string | null;
  requestId: string;
};

/** Canonical hash of one event. Shared by the writer and `audit:verify`, so a change here is a chain break. */
export function hashEvent(e: HashedFields): string {
  const canonical = JSON.stringify([
    e.seq, e.prevHash, e.at.toISOString(), e.actorId, e.actorName, e.action, e.appId,
    e.entityType, e.entityId, e.before, e.after, e.reason, e.requestId,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * The only way to write audit events. There is deliberately no update or delete helper.
 * Each event links to the previous one by hash (tamper-evident), on top of the DB triggers (tamper-resistant).
 */
export async function audit(e: AuditInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? db;
  const base = {
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
  };
  for (let attempt = 0; ; attempt++) {
    const head = await client.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { seq: true, hash: true } });
    const fields: HashedFields = { ...base, seq: (head?.seq ?? 0) + 1, prevHash: head?.hash ?? GENESIS_HASH, at: new Date() };
    try {
      return await client.auditEvent.create({ data: { ...fields, hash: hashEvent(fields) } });
    } catch (err) {
      // Two writers raced for the same seq: the unique index rejects one; re-read the head and retry.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 5) continue;
      throw err;
    }
  }
}

export const SYSTEM = (name: string): Actor => ({ id: null, name: `system:${name}` });
