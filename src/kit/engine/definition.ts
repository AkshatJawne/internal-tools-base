import type { AppDefinition } from "./types";

/** Status the engine parks a record in while an action waits for approval. Owned here, not by definitions. */
export const PENDING_APPROVAL = "pending_approval";

/** Validates a definition at module load (so a bad one fails `pnpm build`, not a user) and adds the engine-owned status. */
export function defineApp(def: AppDefinition): AppDefinition {
  const fail = (msg: string) => {
    throw new Error(`App definition "${def.appId}": ${msg}`);
  };
  if (!/^[a-z][a-z0-9-]*$/.test(def.appId)) fail("appId must be lowercase letters, digits and dashes");
  if (PENDING_APPROVAL in def.statuses) fail(`"${PENDING_APPROVAL}" is added by the engine; do not declare it`);
  const statuses = { ...def.statuses, [PENDING_APPROVAL]: { label: "Pending approval", tone: "amber" as const } };
  const names = new Set<string>();
  for (const f of def.fields) {
    if (names.has(f.name)) fail(`duplicate field "${f.name}"`);
    names.add(f.name);
    if (f.type === "select" && !f.options?.length && !f.optionsFrom) fail(`select field "${f.name}" needs options or optionsFrom`);
    if (f.optionsFrom && !def.settings?.optionLists?.[f.optionsFrom]?.length) fail(`field "${f.name}" uses optionsFrom "${f.optionsFrom}" but settings.optionLists does not declare it`);
    if (f.pii && !["text", "email", "textarea", "date"].includes(f.type)) fail(`PII field "${f.name}" must be a string type`);
  }
  if (!names.has(def.titleField)) fail(`titleField "${def.titleField}" is not a field`);
  if (!(def.initialStatus in statuses)) fail(`initialStatus "${def.initialStatus}" is not a status`);
  const ids = new Set<string>();
  for (const a of def.actions) {
    if (ids.has(a.id)) fail(`duplicate action "${a.id}"`);
    ids.add(a.id);
    for (const s of [...a.from, a.to]) if (!(s in def.statuses)) fail(`action "${a.id}" references unknown status "${s}"`);
  }
  return { ...def, statuses };
}

export const registry = (defs: AppDefinition[]): Record<string, AppDefinition> => Object.fromEntries(defs.map((d) => [d.appId, d]));
