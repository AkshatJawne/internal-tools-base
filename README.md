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

| Sign in as | Try |
|---|---|
| Alice Analyst (KYC analyst) | KYC queue → **Get next case** → reveal SSN (reason required) → approve a high-risk case → it waits for sign-off |
| Lena Lead (KYC lead) | Open the same case → **Sign off**. Check the audit trail on the case |
| Omar Ops (ops agent) | Refunds → New → create a $7,500 refund → **Request: Issue refund** (over threshold) |
| Priya Approver | Approvals → approve it. Payment connector is called once with an idempotency key |
| Omar Ops again | Change requests → **New request** ("show the customer's previous refunds") |
| Adam Admin (ops admin) | Change requests → open Omar's → **Send to Devin** (see the generated prompt). Connectors & data policy → **Policy test**: Refunds → slack with PII → blocked, logged, audited. Form designer, Settings (threshold needs Priya), Automations, Users & roles |
| Audrey Auditor | Compliance & evidence → **Download pack** for CC6.3; Audit log shows "chain verified". Read-only: no PII reveal, no actions |

To see tamper evidence: `sqlite3 prisma/dev.db "PRAGMA writable_schema=1; DROP TRIGGER audit_event_no_update; UPDATE AuditEvent SET reason='edited' WHERE seq=5"` then `pnpm audit:verify` → `BROKEN at seq 5` (and the Audit page shows it).

## Adding app #4

See `.agents/skills/new-internal-app/SKILL.md`. For a typical CRUD/approval tool: one definition file, a manifest entry and permissions. Auth, audit, approvals, PII masking, connectors, automations and admin screens come from the kit.

## Layout

```
src/kit/        platform: auth, rbac, audit (+ chain verify), approvals, pii + crypto, secrets, settings, connectors, compliance, requests, automation, engine, ui
src/apps/       app manifests and definitions (kyc = custom, refunds/flags = generated)
src/app/        Next.js routes
prisma/         schema, audit triggers, synthetic seed + fixtures
scripts/        CI lints (permission, audit, deps), audit chain verifier, webhook sender
docs/adr/       architecture decisions with rejected alternatives; docs/devin/ = ops → Devin flow
deploy/k8s/     egress NetworkPolicy mirroring the connector catalog
.agents/skills/ instructions Devin follows when changing this repo
```

Production swaps: SQLite → Postgres (audit `seq` from a sequence), DEV sign-in → OIDC (Entra ID/Okta) with SCIM roles, mock connectors → real SDKs, `LocalKms` → AWS/GCP KMS envelope keys, env secrets → secrets manager, audit chain shipped to SIEM + object-locked storage. The charter and ADRs say who owns each.
