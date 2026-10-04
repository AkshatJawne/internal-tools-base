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
1. Create `src/apps/<id>/definition.ts` exporting an `AppDefinition` (see `src/apps/refunds/definition.ts`):
   fields (mark PII), statuses, `initialStatus`, actions with `from`/`to`/`permission`, optional `approval(record, settings)` and `effect` (connector call).
2. Register it in `src/apps/definitions.ts`.
3. Add a manifest entry in `src/apps/manifest.ts`: id, name, route `/apps/<id>`, read permission, owner team, icon, **connector allowlist** (least privilege).
4. Add `<id>.read/create/...` permissions in `src/kit/rbac.ts` and grant them to roles.
5. If ops should be able to tune a rule (threshold, reason list), add a setting in `src/kit/settings.ts` and use `optionsFrom` / `settings` in the definition.
6. Optional: add automation events in `src/apps/events.ts` and seed rows in `prisma/seed.ts`.

The app then appears in the sidebar for permitted roles, the admin catalog, the form designer, the connector policy matrix, automations and the audit log with no further work.

## 3. Verify
`pnpm db:reset && pnpm dev`; sign in as a role that can create, one that approves, and one that must be denied. Confirm audit entries and that blocked connectors are refused.

## 4. PR
Describe: requester, fields, permissions granted to which roles, connectors allowed, approval rules. Include screenshots.
