# Pre-Ship Verification — Consolidation Execution (Phase‑1)

Status: AUTOMATED (human optional)  
Target: Staging → Production  
Executor: CI / codex agent

This document has been rewritten so every verification step can be executed headlessly without a human opening a browser or copying curl output. Each test produces a machine‑readable JSON artifact in `artifacts/pre-ship/` and the aggregate command exits non‑zero on any failure.

## One‑Shot Command

Run all mandatory + DB checks (optional / redis gated by flag):

`pnpm verify:pre-ship`

Expected behaviors:
- Spawns/ensures local services (paris, venice) or targets STAGING_URL if provided.
- Generates a short‑lived auth token locally (no manual $TOKEN export).
- Executes tests 1–6 sequentially; optionally test 7 if `REDIS_URL` detected or `--with-redis` passed.
- Verifies DB indexes via SQL queries (not psql meta commands).
- Writes structured results to `artifacts/pre-ship/results.json`:
```jsonc
{
  "summary": {"passed": true, "failedCount": 0},
  "tests": [
    {"id":1, "name":"csp-nonce", "status":"pass", "details":{}}
  ]
}
```

CI gating: pipeline fails if `summary.passed` is false OR any mandatory test absent.

## Environment Variables

| Variable | Purpose | Default / Behavior |
|----------|---------|--------------------|
| SUPABASE_URL | Supabase rest URL used for fixture creation | **required** |
| SUPABASE_SERVICE_ROLE_KEY | Service-role key for Supabase admin calls | **required** |
| SUPABASE_JWT_SECRET | HS256 secret used to mint JWTs for tests | **required** |
| PUBLIC_ID | Widget public id fixture | Auto-created if missing |
| BASE_URL_PARIS | API base (paris) | http://localhost:3001 |
| BASE_URL_VENICE | Renderer base (venice) | http://localhost:3002 |
| STAGING_MODE | If 'true', do not spin local services | false |
| REDIS_URL | Enables Redis breaker test | (unset) |
| DATABASE_URL | Postgres DSN for index checks | required for index step |

If `PUBLIC_ID` is not provided the harness will create a widget + instance via direct DB insert or API factory and export the resulting id to subsequent tests.

## Test Contracts (Machine Readable)

Each test writes: `artifacts/pre-ship/test-<n>-<slug>.json` with shape:
```jsonc
{ "id": 1, "name": "csp-nonce", "status": "pass|fail", "error": null, "metrics": { ... } }
```

### Test 1: CSP Nonce
Command: `pnpm test:csp` (Playwright/undici)
Logic:
1. Fetch `${BASE_URL_VENICE}/e/${PUBLIC_ID}?theme=light&device=desktop` (headless chromium).
2. Collect console events & response HTML.
3. Assert: at least one `<style nonce>` present AND no console message containing `Refused to` (CSP violation).
Outputs:
```jsonc
{ "id":1, "name":"csp-nonce", "status":"pass", "metrics": { "nonceCount": 1, "consoleErrors": 0 } }
```

### Test 2: CORS S2S (No Origin)
Command: `pnpm test:cors-s2s`
Harness sends PUT `/api/instance/${PUBLIC_ID}` without `Origin` header, JSON `{ "status":"published" }`.
Expect: 200 + body.status == 'published'.

### Test 3: CORS Disallowed Origin
Command: `pnpm test:cors-disallowed`
Adds header `Origin: https://evil.example`.
Expect: 403 + JSON `{ error: 'FORBIDDEN' }`.

### Test 4: PUT Empty Body Guard
Command: `pnpm test:put-guard`
Sends `{}`. Expect: 422 with array containing message including `At least one field`.

### Test 5: PUT Status‑Only Regression
Command: `pnpm test:put-status-only`
Sends `{ "status":"published" }` after ensuring initial status differs (update to draft first if needed). Expect: 200.

### Test 6: Submissions Dedup
Command: `pnpm test:dedup`
Posts identical payload twice to `${BASE_URL_VENICE}/s/${PUBLIC_ID}`.
Expect:
- First: 202 with `{ deduped:false }`
- Second: 202 with `{ deduped:true }`.
Harness asserts both.
Harness republish the fixture instance (PUT status `published`) before exercising the submission path to ensure Venice proxies the request without authentication failures.

### Test 7 (Optional): Redis Circuit Breaker
Command: `pnpm test:redis-breaker` (skipped if no `REDIS_URL`).
Procedure:
1. Issue a request to trigger rate limit path; confirm header `X-RateLimit-Backend: redis`.
2. Simulate outage (spawn child process that closes Redis port OR set env to invalid) and re-issue until header flips to `sql`.
Timeout: 30s.

## Database Index Verification
Command: `pnpm verify:db-indexes`
SQL (not psql meta commands):
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'widget_instances' AND indexname = 'idx_widget_instances_widget_id';
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'usage_events' AND indexname = 'usage_events_idempotency_hash_key';
```
Criteria:
- Both queries return exactly 1 row.
- `indexdef` contains `btree` and expected column.
Outputs file: `artifacts/pre-ship/db-indexes.json`.

## Result Aggregation
Command: `pnpm verify:aggregate`
Reads all `test-*.json` + `db-indexes.json` → writes `results.json` with summary.
Fail Conditions:
- Any mandatory test status == fail or missing.
- DB index check missing or failing.

## Rollback Signals (Informational)
These are emitted as structured hints if related tests fail (no human narrative required):
```jsonc
{ "hintCode":"PUT_GUARD_FAILURE", "action":"Disable empty-body guard and redeploy" }
```

## Sign-Off (Automated)
CI passes ⇒ implicit sign-off. Optional manual override file: `artifacts/pre-ship/MANUAL_OVERRIDE.md` to document exceptional promotion.

## Implementation Notes (for codex)

If a listed script/command does not exist, generate it under `tooling/pre-ship/`:
- Tests in TypeScript (Node 18+) using undici or supertest.
- Playwright only for CSP test (headless, no screenshots required unless failing; on fail store HTML + console logs).
- Use a lightweight token factory (mock or signed JWT) at `tooling/pre-ship/util/auth.ts`.
- Ensure artifacts directory is created idempotently.

## Example Aggregate Output
```jsonc
{
  "summary": {"passed": true, "failedCount": 0},
  "tests": [
    {"id":1,"name":"csp-nonce","status":"pass"},
    {"id":2,"name":"cors-s2s","status":"pass"},
    {"id":3,"name":"cors-disallowed","status":"pass"},
    {"id":4,"name":"put-guard","status":"pass"},
    {"id":5,"name":"put-status-only","status":"pass"},
    {"id":6,"name":"dedup","status":"pass"},
    {"id":7,"name":"redis-breaker","status":"skipped"},
    {"id":"db-indexes","name":"db-indexes","status":"pass"}
  ]
}
```

---

This file is now automation-first; no step requires a human browser, manual curl, or screenshot capture.
