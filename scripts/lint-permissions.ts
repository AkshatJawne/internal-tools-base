/**
 * permission-lint: every page, route handler and server action must authorize server-side.
 * Rule 1 of the conventions skill, made unbreakable. Allowlist is explicit and reviewed.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..");
const ALLOW = new Set([
  "src/app/layout.tsx",
  "src/app/sign-in/page.tsx", // the sign-in page itself
  "src/app/(shell)/layout.tsx", // redirects to sign-in via getCurrentUser
  "src/app/(shell)/page.tsx", // home: shows only what can() allows
  "src/kit/auth/actions.ts", // sign-in / sign-out
]);
const AUTH = /\brequire(Page)?Permission\(/;

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const failures: string[] = [];
for (const abs of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, abs);
  const src = readFileSync(abs, "utf8");
  const isPage = /\/(page|route)\.tsx?$/.test(rel) && rel.startsWith("src/app/");
  const isServerAction = /^\s*["']use server["']/.test(src);
  if (!isPage && !isServerAction) continue;
  if (ALLOW.has(rel)) continue;
  if (rel.startsWith("src/app/api/webhooks/")) {
    if (!/timingSafeEqual/.test(src)) failures.push(`${rel}: webhook route must verify an HMAC signature (timingSafeEqual)`);
    continue;
  }
  if (isServerAction) {
    const fns = src.split(/export async function /).slice(1);
    for (const fn of fns) {
      const name = fn.split("(")[0];
      if (!AUTH.test(fn)) failures.push(`${rel}: server action ${name}() has no requirePermission()`);
    }
  } else if (!AUTH.test(src)) {
    failures.push(`${rel}: page/route has no requirePermission()/requirePagePermission()`);
  }
}

if (failures.length) {
  console.error("permission-lint failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log("permission-lint OK");
