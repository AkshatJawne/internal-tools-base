# 0002 — Definition-first generated apps, custom code only where needed
**Status:** accepted

**Context.** Most of the 10 planned apps are forms, queues and approval flows: the sweet spot of model-driven Power Apps. The hard ones (KYC, refunds) need custom UX and server-side logic that low-code strains on.

**Decision.** An app starts as a typed definition (fields, statuses, actions, approval rules). The engine renders list/detail/form, enforces permissions, audits and routes approvals. Custom code is added only for what the definition cannot express (KYC's queue ordering, SLA, documents). Ops can add fields and rules through settings without a release.

**Alternatives rejected.** A drag-and-drop builder (months of work to reach parity with Studio; our builders are engineers); writing every app by hand (loses the Power Apps speed argument).

**Consequences.** Two tiers, not three. Delegation-style correctness hazards (Power Apps' 500/2,000-row caps) do not exist because filtering is server-side SQL.
