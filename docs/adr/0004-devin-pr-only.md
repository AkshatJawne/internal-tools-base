# 0004 — Devin works PR-only with no production credentials
**Status:** accepted

**Context.** AI-authored code is the build-cost lever, but review cost and regulator scrutiny do not go away (Veracode 2025: ~45% of LLM-generated samples contained a flaw). Public incidents with agents touching production data all share one trait: the agent had a path to production.

**Decision.** Devin has repo write access to `devin/*` branches only, plus a preview environment. It cannot merge, cannot deploy, and has no production, staging-with-real-data or secrets-manager access. Every change is a PR that passes CI (`lint`, `typecheck`, `build`, `lint:platform`, `audit:verify`) and is approved by a named engineer; `src/kit/**`, `prisma/**`, money and PII paths need the owners in CODEOWNERS. Prompts are generated from code (`src/kit/requests.ts`) so the guardrails are reviewable.

**Alternatives rejected.** Letting Devin deploy to a sandbox tenant (creates a second SDLC, the thing we left Power Apps to avoid); human-only development (gives up the cost lever).

**Consequences.** Change latency for ops is hours, not minutes. That is intended for money and PII apps. Engineering time shifts from writing to reviewing; we measure review minutes per PR in the pilot.
