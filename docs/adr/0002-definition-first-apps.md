# 0002 — Definition-first generated apps, custom code only where needed
**Status:** accepted

**Context.** Most of the 10 planned apps are forms, queues and approval flows: the sweet spot of model-driven Power Apps. The hard ones (KYC, refunds) need custom UX and server-side logic that low-code strains on.

**Decision.** An app starts as a typed definition (fields, statuses, actions, approval rules). The engine renders list/detail/form, enforces permissions, audits and routes approvals. Custom code is added only for what the definition cannot express (KYC's queue ordering, SLA, documents). Ops can add fields and rules through settings without a release.

**Alternatives rejected.** A drag-and-drop builder (months of work to reach parity with Studio; our builders are engineers); writing every app by hand (loses the Power Apps speed argument).

**Amended 2026-10.** Definitions are built with `defineApp()`, which validates them at module load and owns the `pending_approval` status, and they declare their own ops-tunable defaults (`settings.optionLists`, `settings.approvalThresholds`) instead of those living in `kit/settings.ts`. Approval hooks receive redacted data; effects receive stored (ciphertext) data. `boundary-lint` checks that manifest and definitions agree. Net: a new generated app touches `src/apps/<id>/definition.ts`, the two registries and `rbac.ts`, and nothing else in the kit.

**Consequences.** Two tiers, not three. Delegation-style correctness hazards (Power Apps' 500/2,000-row caps) do not exist because filtering is server-side SQL.
