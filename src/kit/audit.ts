import { createHash, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { withTransaction } from "@/kit/db";

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
 *
 * Always runs inside a transaction: pass the `tx` of the business mutation so state and its audit event
 * commit or roll back together; without one, `audit()` opens its own.
 *
 * Writers serialise on the single `AuditChainHead` row. The first statement is a blind write to that row
 * (upsert + increment), so a second writer queues on the row lock instead of racing: no read-then-write
 * upgrade (which SQLite refuses) and no constraint error (which would abort a Postgres transaction).
 * The unique index on `seq` stays as an independent second guard.
 */
export async function audit(e: AuditInput, tx?: Prisma.TransactionClient): Promise<{ id: string; seq: number; hash: string }> {
  if (!tx) return withTransaction((t) => audit(e, t));
  const head = await tx.auditChainHead.upsert({ where: { id: 1 }, create: { id: 1, seq: 1, hash: GENESIS_HASH }, update: { seq: { increment: 1 } } });
  const fields: HashedFields = {
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
    seq: head.seq,
    prevHash: head.hash, // still the previous event's hash: only seq moved above
    at: new Date(),
  };
  const hash = hashEvent(fields);
  await tx.auditChainHead.update({ where: { id: 1 }, data: { hash } });
  return tx.auditEvent.create({ data: { ...fields, hash }, select: { id: true, seq: true, hash: true } });
}

export const SYSTEM = (name: string): Actor => ({ id: null, name: `system:${name}` });
