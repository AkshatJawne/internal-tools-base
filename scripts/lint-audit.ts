/**
 * audit-lint: (a) only kit/audit.ts may write AuditEvent and nothing may update/delete it; (b) any file that
 * mutates a business table must call audit() in the same file; (c) no second Prisma client or raw SQL.
 * Rule 2 of the conventions skill. This is a cheap static check, not a proof: it cannot see whether every
 * code path that mutates also audits, which is why the kit wraps mutation + audit in one transaction.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");
const UNAUDITED_MODELS = new Set(["connectorCall", "webhookEvent", "auditEvent"]); // logs, not business state
const ALLOW = new Set(["src/kit/audit.ts", "src/kit/db.ts"]);

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const failures: string[] = [];
for (const abs of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, abs);
  const src = readFileSync(abs, "utf8");
  if (/auditEvent\.(update|updateMany|delete|deleteMany|upsert)\(/.test(src)) failures.push(`${rel}: AuditEvent is append-only`);
  if (/auditEvent\.(create|createMany)\(|auditChainHead\.(create|update|updateMany|upsert|delete|deleteMany)\(/.test(src) && rel !== "src/kit/audit.ts") failures.push(`${rel}: only kit/audit.ts may write the audit chain`);
  if (/\$executeRaw|\$queryRaw/.test(src) && !ALLOW.has(rel)) failures.push(`${rel}: raw SQL bypasses the audit path`);
  if (/new PrismaClient\(/.test(src) && rel !== "src/kit/db.ts") failures.push(`${rel}: use db from @/kit/db, not a second PrismaClient`);
  if (/\$transaction\(/.test(src) && rel !== "src/kit/db.ts") failures.push(`${rel}: open transactions with withTransaction() from @/kit/db`);
  if (ALLOW.has(rel)) continue;
  const mutations = [...src.matchAll(/\b(?:db|tx|client)\.(\w+)\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(/g)]
    .map((m) => m[1])
    .filter((model) => !UNAUDITED_MODELS.has(model));
  if (mutations.length && !/\baudit\(/.test(src)) {
    failures.push(`${rel}: mutates ${[...new Set(mutations)].join(", ")} but never calls audit()`);
  }
}

if (failures.length) {
  console.error("audit-lint failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("audit-lint OK");
