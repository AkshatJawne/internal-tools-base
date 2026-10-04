# 0009 — The kit reads apps only through three registries
**Status:** accepted

**Context.** The kit is a framework, so it has to know which apps exist (sidebar, connector allowlist, approval kinds, PII reveal). The first version did this from ten different kit files, kit-owned approval handlers lived in `src/apps`, and `pii-actions.ts` special-cased `KycCase`. A new engineer could not tell which direction the dependency ran, and app #4 needed edits in five places.

**Decision.** Apps → kit is the normal direction. Kit → apps is allowed only through `src/apps/manifest.ts` (static catalog + where a custom app keeps its PII), `src/apps/definitions.ts` (generated-app behaviour) and `src/apps/approval-handlers.ts` (approval kinds a custom app owns). Kit-owned approval kinds (`engine.action`, `settings.update`) live next to the code they execute. The engine does not import the UI layer. Apps do not import each other, the UI kit or route files. `scripts/lint-boundaries.ts` fails CI on any other edge and checks the registries agree with each other.

**Why two registries instead of one.** The connector gateway reads the manifest for the per-app allowlist, and definitions call connectors. A single registry would make `kit/connectors → registry → definitions → kit/connectors` a cycle. Keeping the catalog type-only-dependent on the kit keeps the graph acyclic.

**Alternatives rejected.** Runtime `registerApp()` calls (Next.js bundles server actions as separate entry points, so a registration side effect is not guaranteed to have run); moving the generic server actions out of the kit into each app (duplicates the thing the kit exists to share).

**Consequences.** "Where does the kit learn about my app?" has a three-file answer. The remaining cost of a generated app in the kit is one `rbac.ts` edit, which is deliberate: permissions are deny-by-default and reviewed centrally.
