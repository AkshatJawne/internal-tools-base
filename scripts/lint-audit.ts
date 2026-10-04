/**
 * audit-lint: (a) nothing may update/delete AuditEvent; (b) any file that mutates a business table
 * must import audit() so the mutation can be logged in the same code path. Rule 2 of the conventions skill.
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
  if (/\$executeRaw|\$queryRaw/.test(src) && !ALLOW.has(rel)) failures.push(`${rel}: raw SQL bypasses the audit path`);
  if (ALLOW.has(rel)) continue;
  const mutations = [...src.matchAll(/\b(?:db|tx|client)\.(\w+)\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\(/g)]
    .map((m) => m[1])
    .filter((model) => !UNAUDITED_MODELS.has(model));
  if (mutations.length && !/from ["']@\/kit\/audit["']/.test(src) && !/from ["']\.\.?\/audit["']/.test(src)) {
    failures.push(`${rel}: mutates ${[...new Set(mutations)].join(", ")} but never imports audit()`);
  }
}

if (failures.length) {
  console.error("audit-lint failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("audit-lint OK");
