# Internal tools platform — charter

**Why this exists.** We are replacing a $250K/yr low-code licence with a shared, code-first kit that engineers (and Devin) build internal apps on. The kit is only worth it if it stays *one* platform with *one* owner and *one* SDLC. This page is the contract that keeps it that way. Decisions with their rejected alternatives live in [`docs/adr`](docs/adr).

## Scope
- **In:** operational internal apps for employees: review queues, back-office actions, admin panels, approvals, reporting over our own data.
- **Out:** customer-facing surfaces, feature flags (buy: LaunchDarkly / Unleash / Flagsmith), analytics/BI, anything needing a drag-and-drop builder for non-engineers.

## Ownership
- **One named owner** (platform engineer) with a **1-FTE ceiling** for the kit itself. App teams own their apps.
- **Kill rule (reviewed at 12 months):** if sustained platform effort exceeds 1.3 FTE, or agent spend exceeds $120K/yr, or apps 4–6 average more than 3 engineer-days each including review, stop and re-evaluate buy options. The data for this comes from the pilot report, not opinion.
- **On-call:** the kit is one service on the existing paved road (K8s, Postgres, Datadog, PagerDuty). It fails *with* core services, not separately; the app team on rotation owns the pager.

## Non-negotiables (CI enforces the ones it can)
1. Authorization is server-side and deny-by-default (`permission-lint`).
2. Every mutation is audited; the audit chain is append-only and hash-linked (`audit-lint`, `audit:verify`).
3. Money, regulated decisions, thresholds and role grants need a second person (maker-checker). No self-approval.
4. PII is encrypted at the field level, masked by default, revealed only with a permission *and* a reason, and every reveal is logged.
5. Outbound calls go through the connector gateway; the manifest allowlist and the data-class policy decide; the NetworkPolicy enforces the same hosts.
6. Secrets come from the secrets manager through `src/kit/secrets.ts`. Never from settings, the DB or a request body.
7. Dependencies are pinned; upgrades are PRs (`dep-lint`).

## How change happens
- **Tier 1 (ops, minutes):** settings, reason codes, SLA hours, form fields, automation rules. Edited in Admin, audited, approval for thresholds.
- **Tier 2 (ops → Devin → engineer, hours):** anything needing code goes through **Change requests**. Devin gets a prompt with the conventions and guardrails, opens one PR on `devin/cr-*`, has no production credentials and cannot merge. CODEOWNERS routes review by classification; the requester confirms the preview.
- **Tier 3 (engineers):** new apps start from `.agents/skills/new-internal-app`: a definition file first, custom code only where the definition can't express it.

## Policy on AI-authored code
Devin is a tool operated by an engineer. The engineer who approves the PR is accountable for it. Agent output is treated like any contractor's: PR-only, CI gates, SAST, named human reviewer, and never a path to production credentials. We measure hours-per-app and review time so the kill rule has data.

## Build / buy boundary
| We build | We buy / reuse |
|---|---|
| App definitions, screens, approval policy, audit chain, connector policy | Identity (Okta/Entra OIDC + SCIM), Postgres, K8s, Terraform, Datadog, SIEM, secrets manager |
| Generated apps engine, change-request flow | Feature flags, email/Slack delivery, payments, KYC vendor |
