/**
 * boundary-lint: keeps the layering a new engineer is told about true.
 *   kit  -> may read apps only through the registries (manifest, definitions, approval-handlers); engine never imports UI
 *   apps -> may use the kit; may not import another app, the UI kit or route files
 *   registries <-> manifest must agree (every generated app has a definition with the same read permission, and vice versa)
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { APPS } from "../src/apps/manifest";
import { DEFINITIONS } from "../src/apps/definitions";

const ROOT = join(__dirname, "..");
const REGISTRIES = new Set(["@/apps/manifest", "@/apps/definitions", "@/apps/approval-handlers"]);

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const imports = (src: string) => [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);

const failures: string[] = [];
for (const abs of walk(join(ROOT, "src"))) {
  const rel = relative(ROOT, abs);
  const specs = imports(readFileSync(abs, "utf8"));
  if (rel.startsWith("src/kit/")) {
    for (const s of specs) {
      if (s.startsWith("@/apps/") && !REGISTRIES.has(s)) failures.push(`${rel}: kit may only import apps via a registry, not ${s}`);
      if (s.startsWith("@/app/")) failures.push(`${rel}: kit must not import route files (${s})`);
      if (s.startsWith("@/kit/ui") && !rel.startsWith("src/kit/ui/") && !rel.endsWith(".tsx")) failures.push(`${rel}: non-UI kit code must not import @/kit/ui`);
    }
  }
  if (rel.startsWith("src/apps/")) {
    const [, , own, ...rest] = rel.split("/");
    const isRegistry = rest.length === 0; // files directly in src/apps/ are the registries and may import every app
    for (const s of specs) {
      if (!isRegistry && s.startsWith("@/apps/") && !REGISTRIES.has(s) && !s.startsWith(`@/apps/${own}/`)) failures.push(`${rel}: apps must not import other apps (${s})`);
      if (s.startsWith("@/kit/ui") || s.startsWith("@/app/")) failures.push(`${rel}: app logic must not import UI or route files (${s})`);
    }
  }
}

const generated = APPS.filter((a) => a.kind === "generated");
for (const a of generated) {
  const def = DEFINITIONS[a.id];
  if (!def) failures.push(`manifest app "${a.id}" is generated but has no entry in src/apps/definitions.ts`);
  else if (def.permissions.read !== a.permission) failures.push(`app "${a.id}": manifest permission ${a.permission} != definition read permission ${def.permissions.read}`);
  if (a.route !== `/apps/${a.id}`) failures.push(`app "${a.id}": generated apps are served at /apps/<id>, not ${a.route}`);
}
for (const id of Object.keys(DEFINITIONS)) {
  const app = APPS.find((a) => a.id === id);
  if (!app) failures.push(`definition "${id}" has no manifest entry`);
  else if (app.kind !== "generated") failures.push(`definition "${id}" exists but the manifest marks it ${app.kind}`);
}

if (failures.length) {
  console.error("boundary-lint failed:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log(`boundary-lint OK (${generated.length} generated apps, ${APPS.length - generated.length} custom)`);
