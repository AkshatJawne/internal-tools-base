import { db } from "@/kit/db";
import { GENESIS_HASH, hashEvent } from "@/kit/audit";

export type ChainStatus = { ok: boolean; count: number; head: string | null; brokenAt?: number; problem?: string };

/** Walks the whole chain and recomputes every hash. Cheap at prototype scale; batch it in production. */
export async function verifyAuditChain(): Promise<ChainStatus> {
  const events = await db.auditEvent.findMany({ orderBy: { seq: "asc" } });
  let prev = GENESIS_HASH;
  for (const [i, e] of events.entries()) {
    if (e.seq !== i + 1) return { ok: false, count: events.length, head: null, brokenAt: e.seq, problem: `gap: expected seq ${i + 1}, found ${e.seq}` };
    if (e.prevHash !== prev) return { ok: false, count: events.length, head: null, brokenAt: e.seq, problem: "prevHash does not match previous event" };
    if (hashEvent(e) !== e.hash) return { ok: false, count: events.length, head: null, brokenAt: e.seq, problem: "stored hash does not match event contents" };
    prev = e.hash;
  }
  const last = events.at(-1);
  const head = await db.auditChainHead.findUnique({ where: { id: 1 } });
  if ((head?.seq ?? 0) !== (last?.seq ?? 0) || (head?.hash ?? GENESIS_HASH) !== (last?.hash ?? GENESIS_HASH))
    return { ok: false, count: events.length, head: null, brokenAt: last?.seq, problem: "chain head row does not match the last event" };
  return { ok: true, count: events.length, head: last?.hash ?? null };
}
