---
name: internal-tools-conventions
description: Rules every change to the internal-tools platform must follow (auth, audit, approvals, PII, connectors). Read before editing anything under src/.
---

# Internal tools conventions

The kit in `src/kit/` is the platform. Apps in `src/apps/` must use it, never reimplement it.

## Non-negotiables
1. **Permissions** — every server action, route handler and page calls `requirePermission()` / `requirePagePermission()` from `@/kit/auth` before reading or writing data. New permissions go in `src/kit/rbac.ts` (deny by default). Hiding a button is not access control.
2. **Audit** — every mutation calls `audit()` from `@/kit/audit` inside the same transaction, with `before`/`after` and a `reason` when the user gave one. Never update or delete `AuditEvent` (DB triggers will reject it anyway).
3. **Maker-checker** — anything that moves money, changes a regulated decision or changes a threshold goes through `requestApproval()` in `@/kit/approvals`. Register the executor in `src/apps/approval-handlers.ts`. Don't hand-roll approval flags.
4. **PII** — mark fields `pii: true` in definitions; render with `PiiField` / `redact()`. Unmasked values only come from `revealPii()` (needs `pii.reveal` + reason, audited). Never log raw PII.
5. **Connectors** — external calls only via `callConnector()` in `@/kit/connectors`, and the app's manifest must list the connector. Payment calls must pass an idempotency key.
6. **Validation** — parse all input with zod on the server.
7. **Business rules ops may want to change** (thresholds, reason codes, SLAs, routing) belong in `src/kit/settings.ts`, not hard-coded.
8. **Synthetic data only** in seeds, fixtures and screenshots.

## Before opening a PR
`pnpm lint && pnpm typecheck && pnpm build`, then `pnpm db:reset && pnpm dev` and click through the change as each affected role. Changes to `src/kit/`, `prisma/` or money/PII paths need CODEOWNERS review.
