# Architecture decision records

Short, one decision each, with the rejected alternative. Add one when you change something an auditor or a new engineer would ask "why?" about.

| # | Decision |
|---|---|
| [0001](0001-one-shared-kit.md) | One shared kit and repo, not one repo per app |
| [0002](0002-definition-first-apps.md) | Definition-first generated apps, custom code only where needed |
| [0003](0003-no-feature-flag-service.md) | Do not build a feature-flag service |
| [0004](0004-devin-pr-only.md) | Devin works PR-only with no production credentials |
| [0005](0005-hash-chained-audit.md) | Hash-chained, append-only audit with CI lints |
| [0006](0006-field-level-pii-encryption.md) | Field-level PII encryption behind a KMS adapter |
| [0007](0007-connector-gateway-and-egress.md) | Connector gateway with data classes, plus network egress policy |
| [0008](0008-change-requests.md) | Ops self-service is tiered; code changes go through change requests |
