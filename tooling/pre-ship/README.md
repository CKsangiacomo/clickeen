# Pre-Ship Verification Harness

Automated test suite that verifies all P1 fixes from the post-consolidation review are working correctly in a live environment.

## Quick Start

### 1. Ensure Local Supabase is Running

```bash
# Start Supabase (if not already running)
supabase start

# Verify it's accessible
curl http://127.0.0.1:54321/rest/v1/
```

### 2. Run Migrations (Including Geneva Seeds)

The pre-ship tests depend on the Geneva schema registry tables being populated. Ensure all migrations have been applied:

```bash
# Apply all pending migrations
supabase db push

# Or apply migrations to a specific database
supabase db push --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

**Critical Migration:**
The test harness requires `20251009100000__seed_geneva_phase1.sql` which seeds:
- `widget_schemas` table with JSON schemas for all 6 Phase-1 widget types
- `widget_templates` table with `classic-light` templates for each widget

Without this seed data, PUT endpoint tests will fail with 422 because `transformConfig()` cannot resolve schemas.

### 3. Set Environment Variables

```bash
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
export SUPABASE_JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Optional: Enable Redis breaker test (if Redis is running)
export REDIS_URL="redis://localhost:6379"
export WITH_REDIS=true
```

### 4. Run the Test Suite

```bash
# From repository root
pnpm verify:pre-ship
```

This will:
1. Create a test workspace, user, widget, and instance in Supabase
2. Start Paris (port 3001) and Venice (port 3002) services locally
3. Run 8 tests covering all P1 fixes
4. Generate artifacts in `tooling/artifacts/pre-ship/`
5. Shut down services and report results

## Test Coverage

| Test | Verifies | Reviewer | Pass Criteria |
|------|----------|----------|---------------|
| 1. CSP nonce | Venice embeds include `<style nonce>` and CSP header | R2 | `status=200`, nonce found in HTML + CSP header |
| 2. CORS S2S | Server-to-server requests (no Origin) pass through | R2 | PUT without Origin returns `200` |
| 3. CORS disallowed | Browser requests from evil origins are blocked | R2 | PUT with `Origin: https://evil.example` returns `403` |
| 4. PUT guard | Empty PUT body is rejected | R3 | PUT `{}` returns `422` with "At least one field" message |
| 5. PUT status-only | Status-only updates work (config optional) | R2 | PUT `{status:'inactive'}` returns `200` |
| 6. Dedup | Submission deduplication works with 202 status | R2 | First=`202 deduped:false`, Second=`202 deduped:true` |
| 7. Redis breaker | Circuit breaker degrades gracefully | R2 | Skipped unless `REDIS_URL` provided |
| 8. DB indexes | FK index on widget_instances.widget_id exists | R3 | Skipped (not implemented yet) |

## Output Artifacts

All artifacts are written to `tooling/artifacts/pre-ship/`:

- **`context.json`** — Test workspace/user/widget/instance IDs and JWT token
- **`results.json`** — Summary with pass/fail counts and all test results
- **`test-{id}-{name}.json`** — Individual test result with metrics and error details

### Sample results.json

```json
{
  "summary": {
    "passed": true,
    "failedCount": 0
  },
  "tests": [
    {
      "id": 1,
      "name": "csp-nonce",
      "status": "pass",
      "error": null,
      "metrics": {
        "status": 200,
        "nonceCount": 1,
        "hasCspHeader": true,
        "durationMs": 57
      }
    }
  ]
}
```

## Troubleshooting

### Tests 2 & 5 Fail with 422

**Symptom:**
```json
{
  "id": 2,
  "name": "cors-s2s",
  "status": "fail",
  "error": "Expected 200 from PUT /api/instance but received 422"
}
```

**Root Cause:**
Geneva tables (`widget_schemas`, `widget_templates`) are empty. The PUT endpoint calls `transformConfig()` which queries these tables and fails when they're not found.

**Fix:**
Ensure migration `20251009100000__seed_geneva_phase1.sql` has been applied:
```bash
supabase db push
```

### Services Won't Start

**Symptom:**
```
Error: Timed out waiting for paris at http://localhost:3001/api/healthz
```

**Root Cause:**
Port 3001 or 3002 may already be in use, or Paris/Venice have build errors.

**Fix:**
```bash
# Check for port conflicts
lsof -i :3001
lsof -i :3002

# Rebuild packages
pnpm build
```

### EPERM / Sandbox Errors

**Symptom:**
```
Error: EPERM: operation not permitted
```

**Root Cause:**
The harness spawns child processes (`pnpm dev`) which may trigger macOS sandbox restrictions.

**Fix:**
Run from a terminal with Full Disk Access, or grant Node.js Developer Tools access in System Preferences → Privacy & Security.

## Running Against Staging

To run tests against a deployed staging environment (instead of starting local services):

```bash
export STAGING_MODE=true
export BASE_URL_PARIS="https://paris-staging.clickeen.com"
export BASE_URL_VENICE="https://venice-staging.clickeen.com"
export PUBLIC_ID="wgt_existing_instance"
export AUTH_BEARER="eyJhbGciOiJIUzI1NiIs..."

pnpm verify:pre-ship
```

In staging mode, the harness:
- Skips starting local Paris/Venice services
- Uses provided `PUBLIC_ID` and `AUTH_BEARER` instead of creating fixtures
- Runs tests against live endpoints

## Architecture

```
tooling/pre-ship/
├── package.json          # Defines "verify" script
└── src/
    └── cli.mjs           # Main harness (595 lines)
                          # - loadConfig() — parse env vars
                          # - prepareContext() — create Supabase fixtures
                          # - startLocalServices() — spawn Paris/Venice
                          # - runAndRecord() — execute tests + write artifacts
                          # - test*() — individual test implementations
```

### Test Execution Flow

1. **Load config** from environment variables
2. **Prepare context:**
   - Create workspace, user, workspace_member
   - Create widget (forms.contact with classic-light template)
   - Create published widget_instance
   - Generate JWT token
3. **Start services** (if not staging mode):
   - Spawn `pnpm --filter paris dev` on port 3001
   - Spawn `pnpm --filter venice dev` on port 3002
   - Wait for healthz endpoints
4. **Run tests** sequentially (to avoid race conditions)
5. **Write artifacts** (context.json, test-*.json, results.json)
6. **Shutdown services** and exit with code 0 (pass) or 1 (fail)

## References

- [POST_CONSOLIDATION_PLAN_FINDINGS.md](../../CURRENTLY_EXECUTING/POST_CONSOLIDATION_PLAN_FINDINGS.md) — Original review findings
- [documentation/systems/geneva.md](../../documentation/systems/geneva.md) — Geneva schema registry PRD
- [supabase/migrations/20251009100000__seed_geneva_phase1.sql](../../supabase/migrations/20251009100000__seed_geneva_phase1.sql) — Required seed data
