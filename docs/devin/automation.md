# Change request → Devin → PR

The prototype's **Change requests** page (`/requests`) files and tracks ops requests. The `devin` connector in `src/kit/connectors/index.ts` is a mock. This is how it is wired for real.

## Flow
1. Ops files a request in `/requests`. It is classified `ui` / `logic` / `money_pii` and audited (`change_request.created`).
2. An ops admin clicks **Send to Devin**. The app builds the prompt with `buildDevinPrompt()` (`src/kit/requests.ts`): the ask, the repo conventions skill, the branch name `devin/cr-<id>`, required reviewers, CI commands and the guardrails. No customer data, no credentials.
3. The connector call becomes a `repository_dispatch` to this repo (`.github/workflows/change-request.yml`), which calls the Devin API from a CI runner. Devin's API key lives in GitHub Actions secrets, never in the app.
4. Devin opens one PR. CI runs `pnpm lint`, `typecheck`, `build`, `lint:platform` (permission / audit / dep lints) and `audit:verify`. CODEOWNERS requests review from the owners of the paths touched.
5. The PR's preview deploy URL is posted back (status `preview_ready`); the requester confirms in `/requests/<id>`; an engineer merges. Devin cannot merge.

## Guardrails that hold regardless of prompt
- Branch protection on `main`: required checks, required reviews, CODEOWNERS, no force-push, no admin bypass.
- Devin's GitHub identity: write to `devin/*` branches only, no `Administration`, `Secrets` or `Environments` scopes.
- Preview environments use the seeded synthetic DB, never a copy of production.
- Spend cap per session (ACU limit) set in the Devin org settings; the prompt also asks Devin to stop at ~2h and report.

## Devin API call (from CI, not from the app)
```bash
curl -s -X POST https://api.devin.ai/v1/sessions \
  -H "Authorization: Bearer $DEVIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" --arg t "cr-$CR_ID" '{prompt: $p, title: $t, idempotent: true}')"
```
Check the current request shape at https://docs.devin.ai before enabling; field names may change.

## Measuring it (feeds the kill rule)
Per request: time filed → PR open → preview → merged; engineer review minutes; agent spend. The pilot report compares these to the 2–3 engineer-days-per-app gate in `PLATFORM_CHARTER.md`.
