# 0007 — Connector gateway with data classes, plus network egress policy
**Status:** accepted

**Context.** Power Platform DLP is a policy over connectors, but Microsoft's own docs list endpoint-filtering gaps and researchers have documented unblockable connectors. A policy only in application config has the same weakness: one new SDK import bypasses it.

**Decision.** Two layers. (1) `callConnector()` is the only outbound path: the app manifest allowlists connectors, each connector declares the data classes it accepts (`internal`, `pii`, `money`), every call is logged (PII request bodies redacted), blocked calls are audited, and admins can probe the policy from the UI. (2) `deploy/k8s/egress-networkpolicy.yaml` allows the app pods to reach only the connector hosts and the database; a direct call from new code fails at the network, not at a code review.

**Alternatives rejected.** Service mesh egress gateway (right at scale, heavy for one service today); trusting the allowlist alone.

**Consequences.** Adding a connector is a PR touching the catalog, the manifest and the NetworkPolicy, reviewed by security. Secrets for connectors come from `src/kit/secrets.ts`, which supports a previous key for rotation.
