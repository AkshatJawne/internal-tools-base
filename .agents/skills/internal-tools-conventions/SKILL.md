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
4. **PII** — mark fields `pii: true` in definitions. Values are encrypted before storage (`seal()` in the engine, `sealPii()` for custom tables) with a precomputed mask stored alongside; render with `PiiField` / `redact()`. Plaintext only exists inside `revealPii()` (needs `pii.reveal` + reason, audited). Never log raw PII or ciphertext.
5. **Connectors** — external calls only via `callConnector()` in `@/kit/connectors`, with the right `dataClass` (`internal` / `pii` / `money`). The app's manifest must list the connector and the catalog must accept the data class; a new connector also needs a line in `deploy/k8s/egress-networkpolicy.yaml`. Payment calls must pass an idempotency key. Secrets come from `@/kit/secrets`, never from settings or request bodies.
6. **Validation** — parse all input with zod on the server.
7. **Business rules ops may want to change** (thresholds, reason codes, SLAs, routing) belong in `src/kit/settings.ts`, not hard-coded.
8. **Synthetic data only** in seeds, fixtures and screenshots.
9. **Audit chain** — `audit()` hash-links every event. Never bypass it with raw SQL; `audit-lint` and `audit:verify` fail CI if you do.
10. **Ops requests** — if an ops user asked for the change, link the change request (`/requests/<id>`) in the PR and work on branch `devin/cr-<id>`. Decisions that change how the kit works get an ADR in `docs/adr/`.

## Before opening a PR
`pnpm lint && pnpm typecheck && pnpm lint:platform && pnpm build`, then `pnpm db:reset && pnpm audit:verify && pnpm dev` and click through the change as each affected role. Changes to `src/kit/`, `prisma/` or money/PII paths need CODEOWNERS review.
