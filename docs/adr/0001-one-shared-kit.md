# 0001 — One shared kit and repo, not one repo per app
**Status:** accepted

**Context.** 13 apps are coming. Power Apps amortises platform cost across apps; a per-app repo approach would not, and would produce 13 slightly different auth, audit and approval implementations.

**Decision.** All internal apps live in this repo on top of `src/kit`. The kit is the only place auth, audit, approvals, PII, settings and connectors are implemented. Apps are definitions (`src/apps/<id>/definition.ts`) or thin custom screens.

**Alternatives rejected.** Per-app repos (duplication, 13 security reviews); a monorepo with per-app services (operational cost without benefit at this scale).

**Consequences.** A kit change affects every app, so `src/kit/**` requires CODEOWNERS review and the CI gates. The 1-FTE ceiling in the charter is only plausible because there is one kit.
