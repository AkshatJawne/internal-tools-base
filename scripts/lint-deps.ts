/** dep-lint: exact versions only (no ^ ~ x or bare majors) so the lockfile and package.json agree and upgrades are deliberate PRs. */
import { readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const bad = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, v]) => !EXACT.test(v));
if (bad.length) {
  console.error("dep-lint failed: pin these to exact versions:\n  " + bad.map(([k, v]) => `${k}: ${v}`).join("\n  "));
  process.exit(1);
}
console.log("dep-lint OK");
