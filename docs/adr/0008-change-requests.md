# 0008 — Ops self-service is tiered; code changes go through change requests
**Status:** accepted

**Context.** Power Apps' real promise to ops is "change it yourself, now". For reason codes and form fields that is reasonable; for money and PII logic it is the SoD weakness the CISO flagged (flow approvals editable by the maker).

**Decision.** Tier 1: settings, reason codes, SLA hours, form fields and automation rules are editable in Admin, audited, with a second approver for thresholds. Tier 2: anything needing code is a **change request** (`/requests`). Ops admins dispatch it to Devin with a generated prompt; Devin opens a PR; CI and CODEOWNERS gate it by classification (`ui` / `logic` / `money_pii`); the requester confirms the preview; an engineer merges. Status changes are audited and count toward CC8.1 evidence.

**Alternatives rejected.** Giving ops a builder (ADR 0002); Slack-only requests (no audit trail, no classification, no evidence).

**Consequences.** Ops lose instant publish for code changes and gain a visible queue with SLAs engineering can be held to. The pilot measures request turnaround to see if "hours" is actually true.
