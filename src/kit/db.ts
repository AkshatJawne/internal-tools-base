import { Prisma, PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient; txQueue?: Promise<unknown> };

export const db = g.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") g.prisma = db;

const isWriteConflict = (err: unknown) =>
  (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") ||
  (err instanceof Error && /database is locked|SQLITE_BUSY|write conflict|deadlock/i.test(err.message));

// SQLite has one writer per file and Prisma does not queue interactive transactions for it: concurrent ones
// time out instead of waiting. Local/CI only; Postgres serialises on row locks and skips this queue.
const SINGLE_WRITER = (process.env.DATABASE_URL ?? "file:").startsWith("file:");

/**
 * The one way to open a transaction. Retries the whole `fn` on a write conflict, so `fn` must only touch the
 * database: connector calls and other side effects go outside (see engine/execute.ts for the pattern).
 */
export async function withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(fn);
      } catch (err) {
        if (!isWriteConflict(err) || attempt >= 8) throw err;
        await new Promise((r) => setTimeout(r, 5 * 2 ** attempt + Math.random() * 20));
      }
    }
  };
  if (!SINGLE_WRITER) return run();
  const next = (g.txQueue ?? Promise.resolve()).then(run, run);
  g.txQueue = next.catch(() => undefined);
  return next;
}
