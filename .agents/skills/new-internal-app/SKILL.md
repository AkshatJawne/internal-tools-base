---
name: new-internal-app
description: Add a new internal tool (app #4+) to the platform from a plain-English request. Use when someone asks for a new queue, tracker, dashboard or admin panel.
---

# Adding a new internal app

Read `.agents/skills/internal-tools-conventions/SKILL.md` first.

## 1. Pick the app kind
- **generated** (default): list/detail/form/state-machine apps. Usually one definition file, no UI code.
- **custom**: only when the UX genuinely needs it (e.g. the KYC document review screen). Still uses the kit.

## 2. Generated app (most requests)
Four edits, no other kit changes (`src/apps/vendors/definition.ts` is the smallest worked example):
1. Create `src/apps/<id>/definition.ts` exporting `defineApp({...})` (see `src/apps/refunds/definition.ts`):
   fields (mark PII), statuses (do **not** declare `pending_approval`; the engine adds it), `initialStatus`, actions with `from`/`to`/`permission`,
   optional `approval { permission, when(data, settings), describe(data) }` and `effect` (connector call, idempotency key = record id).
   Ops-tunable values go in `settings: { optionLists: { <name>: [...] }, approvalThresholds: { <name>: n } }` and are read as
   `optionsFrom: "<name>"` / `settings.approvalThresholds.<name>`; they show up in Admin → Settings automatically.
   `defineApp` throws at build time if statuses, titleField or optionsFrom don't line up.
2. Add it to the `registry([...])` in `src/apps/definitions.ts`.
3. Add a manifest entry in `src/apps/manifest.ts`: id, name, route `/apps/<id>`, read permission (must equal `permissions.read`), owner team, icon, **connector allowlist** (least privilege).
4. Add `<id>.read/create/...` permissions in `src/kit/rbac.ts` and grant them to roles.
Optional: seed rows in `prisma/seed.ts`. Automation events are derived from the definition.

`pnpm lint:platform` (boundary-lint) fails if the manifest and registry disagree. The app then appears in the sidebar for permitted roles, the admin catalog, the form designer, the connector policy matrix, automations, settings and the audit log with no further work.

Data rules the engine enforces for you: PII fields are sealed on write and redacted before audit/automation/approval hooks; `effect` output is sealed too; a status transition and its audit event commit in one transaction.

## 3. Verify
`pnpm db:reset && pnpm dev`; sign in as a role that can create, one that approves, and one that must be denied. Confirm audit entries and that blocked connectors are refused.

## 4. PR
Describe: requester, fields, permissions granted to which roles, connectors allowed, approval rules. Include screenshots.
