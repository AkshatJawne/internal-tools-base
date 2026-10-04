# 0005 — Hash-chained, append-only audit with CI lints
**Status:** accepted

**Context.** Dataverse auditing is per-table opt-in, storage-metered, and Purview retention is 180 days without E5. KYC/AML needs 7 years, and an auditor's first question is "could an admin have edited this?".

**Decision.** `AuditEvent` has a monotonic `seq`, `prevHash` and `hash = sha256(prevHash + canonical fields)`. `audit()` is the only writer; DB triggers reject UPDATE/DELETE; `pnpm audit:verify` recomputes the chain and runs in CI and on the Audit and Compliance pages. `audit-lint` fails CI if a file mutates business tables without importing `audit()` or touches `AuditEvent` with anything but create. Evidence packs (`/api/evidence/<control>`) bundle the matching events, the chain status and the role matrix per SOC 2 / PCI / GDPR control.

**Alternatives rejected.** Trusting the triggers alone (a DBA can drop a trigger; a hash break is visible); an external audit SaaS now (premature; the chain ships to the SIEM and object-locked storage in production).

**Consequences.** Writes serialise on `seq` (a unique-index retry handles races; use a Postgres sequence in production). Erasure requests must tombstone payloads without rewriting hashes; that procedure is a production gap.
