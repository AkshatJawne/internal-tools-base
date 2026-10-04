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

You need Node.js 20.19 or newer (tested on 24.19, `.nvmrc` says 24) and pnpm 9 (tested on 9.15.0). No database server, no sqlite3 CLI and no external credentials are needed; the demo uses a local SQLite file and mock connectors.

```bash
# Node and pnpm, if you do not have them
nvm install 24 && nvm use 24          # or any Node >= 20.19
corepack enable && corepack prepare pnpm@9.15.0 --activate

git clone https://github.com/AkshatJawne/internal-tools-base.git
cd internal-tools-base
pnpm install
pnpm db:reset      # creates .env from .env.example, then resets the local SQLite DB (schema, triggers, seed data). Destructive on purpose.
pnpm dev           # leave this running, then open http://localhost:3000
```

In a second terminal in the same directory:

```bash
pnpm audit:verify  # recompute the audit hash chain; prints "audit chain OK: <n> events, head <hash>"
pnpm lint:platform # permission-lint, audit-lint, boundary-lint, dep-lint (the same checks CI runs)
pnpm webhooks      # optional: posts 40 signed vendor events, 2 replays and 1 forged event to the running server (set APP_URL if not on :3000)
```

## Demo path

Sign in with the demo account shown on the sign-in page: `demo@acmepay.example` / `acmepay-demo` (role: Platform owner, sees every app and platform page). Every seeded user has the same password, so you can also sign in as a single-role persona (e.g. `omar@acmepay.example`, `priya@acmepay.example`, `audrey@acmepay.example`) to show what a narrower role sees and is refused.

1. **Home**: apps on top of one shared platform, with live numbers.
2. **KYC review queue** (custom code on the kit): click **Get next case**. Click **Reveal** next to the SSN; an empty reason is refused, a reason reveals the value and writes an audit event. Pick a decision and a matching **Reason code**, then **Submit decision**. High-risk cases (the seeded rule) need a second person: sign out, sign in as `lena@acmepay.example`, open the same case, enter a **Sign-off note** and click **Sign off**. The person who decided cannot sign off. Sign back in as `demo@acmepay.example`.
3. **Refunds** (generated from `src/apps/refunds/definition.ts`): click **Create**, enter an amount above 500 (the seeded threshold) and save. The refund is **Requested**. Open it, enter a reason and click **Request: Issue refund**; it becomes **Pending approval** and appears in **Approvals**. The requester sees it there but gets no approve button. Sign out, sign in as `priya@acmepay.example`, open **Approvals**, add a note and approve; the refund becomes **Issued**. Sign back in as `demo@acmepay.example` and open **Connectors**: one payments call, with the idempotency key `refund:<id>`.
4. **Platform** (sidebar group): **Users and roles** (deny by default), **Audit log** (badge reads **chain verified**), **Compliance** (click **Download pack** next to a control, for example SOC 2 CC6.1), **Connectors** then **Policy test (DLP probe)** with app Refunds, connector slack, payload PII, click **Probe**; the call is blocked, logged and audited. **Settings** and **Form designer** are editable by the demo owner; every edit needs a reason and lands in the audit log. Changing an approval threshold itself needs a second approver.
5. **Change requests**: click **New request**, fill it in, **Submit request**, then **Send to Devin** and read the generated prompt (conventions included, customer data excluded). In this prototype the Devin connector is a mock: the status goes to **Devin working** and no real session, PR or preview is created. The seeded example request shows what a finished one looks like, and an admin can enter PR and preview URLs by hand. The real adapter is described in `docs/devin/automation.md`.

To see tamper evidence, edit an audit row directly (this uses the Prisma CLI you already have, no sqlite3 needed):

```bash
pnpm exec prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
PRAGMA writable_schema=1;
DROP TRIGGER audit_event_no_update;
UPDATE AuditEvent SET reason='edited' WHERE seq=5;
SQL
pnpm audit:verify   # exits 1 with "audit chain BROKEN at seq 5"; the Audit log page shows "chain BROKEN at #5"
pnpm db:reset       # restore (stop pnpm dev first, then start it again)
```

## Adding another generated app

See `.agents/skills/new-internal-app/SKILL.md` (this is what Devin reads). Vendor onboarding (`src/apps/vendors`) is the worked example and is already app #4. A typical list/form/approval tool is four edits; `pnpm lint:platform` checks that the registry, manifest and permissions agree, and `pnpm typecheck` catches the rest. Custom screens or a new connector need more files.

1. `src/apps/<id>/definition.ts` — `defineApp({...})` with `appId`, `titleField`, `permissions`, `fields` (mark PII), `statuses`, `initialStatus`, `actions` and an approval rule on the action that needs one. Ops-tunable defaults go in `settings.optionLists` / `settings.approvalThresholds` and appear under Platform → Settings automatically.
2. `src/apps/definitions.ts` — add it to the registry.
3. `src/apps/manifest.ts` — `id`, `name`, `description`, `route: "/apps/<id>"`, `permission` (the definition's read permission), `kind: "generated"`, `owner`, `icon`, connector allowlist.
4. `src/kit/rbac.ts` — its permissions and which roles get them (deny by default, so this one kit edit is deliberate).

Vendor onboarding is about 50 lines across those four files, with no new auth, audit, approval, PII or settings code. Auth, audit, approvals, PII masking, connectors, automations and admin screens come from the kit.

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
