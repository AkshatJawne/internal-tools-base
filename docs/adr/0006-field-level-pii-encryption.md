# 0006 — Field-level PII encryption behind a KMS adapter
**Status:** accepted

**Context.** Dataverse offers customer-managed keys at the environment level. Here SSNs, DOBs and emails sit next to operational data in Postgres; disk encryption does not stop a read replica, a backup or a bug from exposing them.

**Decision.** Fields marked `pii: true` (generated apps) and the KYC applicant fields are encrypted with AES-256-GCM before they reach the database; a precomputed mask is stored alongside so screens never need the plaintext. `src/kit/crypto.ts` is the seam: the local adapter derives a key from `PII_KEY`; production wraps a KMS data key (envelope encryption, key rotation by re-wrapping). Plaintext exists only inside `revealPii()`, which requires `pii.reveal` plus a reason and writes an audit event.

**Alternatives rejected.** Column-level encryption in the database (ties us to one engine, no per-field reveal path); tokenisation service (right answer for card data, overkill for SSN/DOB at this stage).

**Consequences.** Encrypted fields cannot be searched or sorted server-side; add a blind index (HMAC) if a queue ever needs to search by email. Ciphertext never appears in audit payloads or automation events because `redact()` runs first.
