## What & why
<!-- Requester, problem, link to request -->

## Platform checklist
- [ ] Server-side `requirePermission` on every new action/route/page
- [ ] Mutations write `audit()` events
- [ ] Money / regulated decisions / thresholds go through maker-checker
- [ ] PII fields marked and masked
- [ ] PII stored via `sealPii`/`seal()`; plaintext only inside `revealPii()`
- [ ] Connector calls go through `callConnector` with the right `dataClass`; manifest + catalog + NetworkPolicy updated for new connectors
- [ ] `pnpm lint:platform` and `pnpm audit:verify` pass locally
- [ ] Synthetic data only

## How I verified
<!-- Roles signed in as, screenshots -->
