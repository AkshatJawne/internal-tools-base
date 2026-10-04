# Internal Tools Base

A prototype of a self-hosted alternative to Microsoft Power Apps for a fintech team, built with Devin. It copies the **platform** that comes with Power Apps, not just individual apps, so app #4 onward becomes a small, reviewable change.

| Power Apps capability | Here |
|---|---|
| Entra ID sign-in + security roles | DEV sign-in (swap for OIDC) + central role→permission map, enforced server-side (`src/kit/auth`, `src/kit/rbac.ts`) |
| Dataverse + model-driven apps | Apps generated from a definition file (`src/kit/engine`, `src/apps/*/definition.ts`) |
| Canvas app for complex UX | Custom KYC review queue (`src/apps/kyc`, `src/app/(shell)/kyc`) |
| Power Automate approvals | Shared maker-checker primitive (`src/kit/approvals.ts`), approvals inbox |
| Power Automate flows | No-code when/then automation rules (`src/kit/automation.ts`, Admin → Automations) |
| Connectors + DLP policies | Adapter layer with per-app allowlist; blocked calls are audited (`src/kit/connectors`) |
| Maker edits without code | Settings (thresholds, SLAs, reason codes) and Form designer (add fields) |
| Admin center + audit | App catalog, users & roles, connector policy, append-only audit log (DB triggers block UPDATE/DELETE) |

Plus fintech specifics: PII masked by default with reason-required, audited reveal; HMAC-signed, idempotent KYC vendor webhooks; idempotency keys on refunds; four-eyes on high-risk KYC decisions, large refunds, production flag changes and threshold changes.

All data is synthetic. All connectors are mocks; nothing makes network calls.

## Run it

```bash
pnpm install
pnpm db:reset      # creates .env from .env.example, SQLite DB, triggers, seed data
pnpm dev           # http://localhost:3000
pnpm webhooks      # optional: posts 40 signed vendor events + 2 replays + 1 forged
```

## Demo path

| Sign in as | Try |
|---|---|
| Alice Analyst (KYC analyst) | KYC queue → **Get next case** → reveal SSN (reason required) → approve a high-risk case → it waits for sign-off |
| Lena Lead (KYC lead) | Open the same case → **Sign off**. Check the audit trail on the case |
| Omar Ops (ops agent) | Refunds → New → create a $7,500 refund → **Request: Issue refund** (over threshold) |
| Priya Approver | Approvals → approve it. Payment connector is called once with an idempotency key |
| Adam Admin (ops admin) | Form designer: add a field to Refunds. Settings: change the refund threshold (needs Priya's approval). Automations, Connectors & data policy, Users & roles, Audit log |
| Audrey Auditor | Read-only: audit log, admin center, no PII reveal, no actions |

## Adding app #4

See `.agents/skills/new-internal-app/SKILL.md`. For a typical CRUD/approval tool: one definition file, a manifest entry and permissions. Auth, audit, approvals, PII masking, connectors, automations and admin screens come from the kit.

## Layout

```
src/kit/        platform: auth, rbac, audit, approvals, pii, settings, connectors, automation, engine, ui
src/apps/       app manifests and definitions (kyc = custom, refunds/flags = generated)
src/app/        Next.js routes
prisma/         schema, audit triggers, synthetic seed + fixtures
.agents/skills/ instructions Devin follows when changing this repo
```

Production swaps: SQLite → Postgres, DEV sign-in → OIDC (Entra ID/Okta) with SCIM roles, mock connectors → real SDKs, secrets from your secrets manager.
