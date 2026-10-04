# Internal Tools Base

A prototype of a self-hosted alternative to Microsoft Power Apps for a fintech team, built with Devin. It copies the **platform** that comes with Power Apps, not just individual apps, so app #4 onward becomes a small, reviewable change.

| Power Apps capability | Here |
|---|---|
| Entra ID sign-in + security roles | DEV sign-in (swap for OIDC) + central role→permission map, enforced server-side (`src/kit/auth`, `src/kit/rbac.ts`) |
| Dataverse + model-driven apps | Apps generated from a definition file (`src/kit/engine`, `src/apps/*/definition.ts`) |
| Canvas app for complex UX | Custom KYC review queue (`src/apps/kyc`, `src/app/(shell)/kyc`) |
| Power Automate approvals | Shared maker-checker primitive (`src/kit/approvals.ts`), approvals inbox |
| Power Automate flows | No-code when/then automation rules (`src/kit/automation.ts`, Admin → Automations) |
| Connectors + DLP policies | Gateway with per-app allowlist **and** per-connector data classes (`internal`/`pii`/`money`); blocked calls logged + audited; admin "DLP probe"; the same boundary as a K8s NetworkPolicy (`src/kit/connectors`, `deploy/k8s`) |
| Maker edits without code | Tier 1: Settings and Form designer. Tier 2: **Change requests** → Devin PR → engineer review → requester confirms preview (`/requests`, `docs/devin/automation.md`) |
| Admin center + audit | App catalog, users & roles, connector policy, **hash-chained** append-only audit log (`pnpm audit:verify`, DB triggers block UPDATE/DELETE) |
| Purview / Sentinel / compliance evidence | Compliance page: controls → evidence packs (JSON per SOC 2 / PCI / GDPR control), four SIEM-style detections over the same chain (`/admin/compliance`, `/api/evidence/<control>`) |
| Dataverse customer-managed keys | Field-level AES-256-GCM encryption of PII behind a KMS adapter; plaintext only inside the audited reveal path (`src/kit/crypto.ts`) |
| Managed Environments (governance) | `PLATFORM_CHARTER.md` (owner, 1-FTE ceiling, kill rule, AI-code policy) + `docs/adr/` + CI gates `permission-lint`, `audit-lint`, `dep-lint` (`scripts/`) |

Plus fintech specifics: PII encrypted at the field level and masked by default with reason-required, audited reveal; HMAC-signed, idempotent KYC vendor webhooks with key rotation; idempotency keys on refunds; four-eyes on high-risk KYC decisions, large refunds, production flag changes and threshold changes.

All data is synthetic. All connectors are mocks; nothing makes network calls.

## Run it

```bash
pnpm install
pnpm db:reset      # creates .env from .env.example, SQLite DB, triggers, seed data
pnpm dev           # http://localhost:3000
pnpm audit:verify  # recompute the audit hash chain
pnpm lint:platform # permission-lint, audit-lint, dep-lint (also run in CI)
pnpm webhooks      # optional: posts 40 signed vendor events + 2 replays + 1 forged
```

## Demo path

Sign in with the demo account shown on the sign-in page: `demo@acmepay.example` / `acmepay-demo` (role: Platform owner, sees every app and platform page). Every seeded user has the same password, so you can also sign in as a single-role persona (e.g. `omar@acmepay.example`, `priya@acmepay.example`, `audrey@acmepay.example`) to show what a narrower role sees and is refused.

1. **Home**: apps on top of one shared platform, with live numbers.
2. **KYC review queue** (custom code on the kit): Get next case, reveal the SSN (reason required, audited), decide; a second person signs off.
3. **Refunds** (generated from `src/apps/refunds/definition.ts`): create a refund above the threshold; it waits in Approvals. The requester cannot approve it; sign in as Priya to approve. The payments connector is called once with an idempotency key.
4. **Platform**: Users and roles (deny by default), Audit log (chain verified), Compliance (download an evidence pack), Connectors (policy test: Refunds to Slack with PII is blocked), Settings and Form designer (ops-editable, audited).
5. **Change requests**: open a request, Send to Devin, read the generated prompt; the PR and preview URL come back on the request.

To see tamper evidence: `sqlite3 prisma/dev.db "PRAGMA writable_schema=1; DROP TRIGGER audit_event_no_update; UPDATE AuditEvent SET reason='edited' WHERE seq=5"` then `pnpm audit:verify` → `BROKEN at seq 5` (and the Audit page shows it).

## Adding app #4

See `.agents/skills/new-internal-app/SKILL.md`. For a typical CRUD/approval tool it is exactly four edits, and `pnpm lint:platform` fails if they disagree:

1. `src/apps/<id>/definition.ts` — `defineApp({...})`: fields (mark PII), statuses, actions, approval rule, and the ops-tunable defaults it needs (`settings.optionLists` / `approvalThresholds`, which appear in Admin → Settings automatically).
2. `src/apps/definitions.ts` — add it to the registry.
3. `src/apps/manifest.ts` — name, route, read permission, owner, connector allowlist.
4. `src/kit/rbac.ts` — its permissions and which roles get them (deny by default, so this one kit edit is deliberate).

Vendor onboarding (`src/apps/vendors`) is the worked example: ~50 lines, no new auth, audit, approval, PII or settings code. Auth, audit, approvals, PII masking, connectors, automations and admin screens come from the kit.

## Layout

```
src/kit/                platform. Imports apps only through the three registries below (boundary-lint enforces it)
  auth/ rbac.ts         sessions (DEV, swap for OIDC), permissions + roles (deny by default)
  audit.ts, audit-verify.ts   hash-chained append-only log; the only writer, always inside a transaction
  approvals.ts          maker-checker primitive; kit-owned handlers live next to what they execute
  pii.ts, crypto.ts     seal/unseal/mask behind a KMS adapter; pii-actions.ts = the one reveal path
  settings.ts           ops-tunable rules; app defaults come from definitions, not from here
  connectors/           gateway (allowlist + data class + idempotency claim + log) and mock adapters
  engine/               generated apps: types, defineApp(), fields (seal/redact), actions, execute
  automation.ts, compliance/, requests*.ts, secrets.ts
  ui/                   shared components (visual layer)
src/apps/               the apps
  manifest.ts           registry 1: catalog (id, route, permission, owner, connectors, custom-app PII source)
  definitions.ts        registry 2: generated-app behaviour (defineApp results)
  approval-handlers.ts  registry 3: approval kinds owned by custom apps
  kyc/                  custom app (queue, SLA, documents, vendor webhook)
  refunds/ flags/ vendors/   generated apps: one definition.ts each
src/app/                Next.js routes (shell, /kyc, /apps/[appId] generic pages, admin, api)
prisma/                 schema, audit triggers, synthetic seed + fixtures
scripts/                CI lints (permission, audit, boundaries, deps), audit chain verifier, webhook sender
docs/adr/       architecture decisions with rejected alternatives; docs/devin/ = ops → Devin flow
deploy/k8s/     egress NetworkPolicy mirroring the connector catalog
.agents/skills/ instructions Devin follows when changing this repo
```

Production swaps: SQLite → Postgres (the audit chain head row already serialises writers portably), DEV sign-in → OIDC (Entra ID/Okta) with SCIM roles, mock connectors → real SDKs, `LocalKms` → AWS/GCP KMS envelope keys, env secrets → secrets manager, audit chain shipped to SIEM + object-locked storage. The charter and ADRs say who owns each.
