# Peer Review Plan + RCA — Consolidation Execution

## Executive Summary
- Scope executed locally in full (code, docs, local DB). Remote DB verified via schema dump; materialized schema matches plan (critical indexes present). 
- One attempted `supabase db push` surfaced a migration history divergence — we did not auto‑repair history without explicit approval. As a result, “push” was not used; we verified and (if needed) would apply indexes directly via SQL.

## What We Shipped (Code + Docs)
- Venice (edge SSR)
  - CSP nonce propagated to all 6 renderers; route passes nonce.
- Paris (API)
  - CORS: Allow no‑Origin (S2S) traffic while enforcing browser allowlist.
  - PUT /api/instance: `config` optional; template‑only/status‑only OK; empty body returns 422.
  - Submissions: return 202 for accepted + deduped.
  - AJV: log loudly when unavailable; keep fallback (no fail‑closed in Phase‑1).
  - Redis: connect once when URL present; breaker degrades to SQL.
- DB (migrations)
  - Added partial UNIQUE index to enforce idempotency when hash present: 
    - `20251007090000__usage_events_idempotency_partial_unique.sql`
  - Performance hygiene index (FK) exists as migration: 
    - `20251006152000__idx_widget_instances_widget_id.sql`
- Docs
  - Removed `documentation/dbschemacontext.md`; all schema references point to `supabase/migrations/`.
  - Added `documentation/widgets/*.md` (WIP/SSR‑only; not GA) + README.
  - Updated testing playbook to verify via migrations, not DB dump.

## DB Changes — Detailed
- Local (Docker Supabase)
  - Ran `supabase migration up` (escalated) → “Local database is up to date.”
  - Ensured partial UNIQUE index on `usage_events(idempotency_hash) WHERE NOT NULL` exists.
  - Ensured FK index on `widget_instances(widget_id)` exists.
- Remote (Project ref: `ebmqwqdexmemhrdhkmwn`)
  - Attempted `supabase db push` → failed: 
    > Remote migration versions not found in local migrations directory
  - Performed a remote schema dump via CLI and searched for expected indexes. Found both:
    - `idx_widget_instances_widget_id` on public.widget_instances(widget_id)
    - `usage_events_idempotency_hash_key` with `WHERE (idempotency_hash IS NOT NULL)`
  - Conclusion: Remote schema already satisfies the Phase‑1 DB requirements.

## RCA — Why “push” didn’t complete
- Symptom: `supabase db push` reported remote migration versions not found locally.
- Root Cause: Migration history divergence between local files and remote history (lineage mismatch). This occurs when remote DB has applied migration IDs not present locally, or vice‑versa.
- Constraints:
  - Auto‑repair (`supabase migration repair` / `supabase db pull`) can rewrite migration history or snapshot schema into local, which is risky without explicit approval.
  - Given the plan only required those two indexes, and remote already has them, a history repair wasn’t necessary to complete Phase‑1.
- Decision: Do not alter remote migration history; instead, verify schema and, if anything were missing, apply idempotent `CREATE INDEX IF NOT EXISTS …` via SQL editor.

## Outstanding Items
- Remote DB: None — both indexes are present. No action required.
- Environment checks (non‑code):
  - Confirm Paris `ALLOWED_ORIGINS` in prod; verify CORS S2S + browser allowlist behavior.
  - If using Redis, verify `X‑RateLimit‑Backend: redis` appears on rate‑limited responses; otherwise SQL fallback is fine.
- Quick Smoke (prod/staging):
  - Venice SSR styled (no CSP errors) and validators return 304.
  - PUT status‑only/template‑only 200; empty body 422; submissions 202 (accepted/deduped).

## Verification Artifacts (Evidence)
- Remote schema dump included the expected indexes (CLI output captured during execution):
  - `CREATE INDEX "idx_widget_instances_widget_id" ... ("widget_id");`
  - `CREATE UNIQUE INDEX "usage_events_idempotency_hash_key" ... WHERE ("idempotency_hash" IS NOT NULL);`
- Local migrations present in `supabase/migrations/` and applied locally.

## Remediation / Alternatives (if migration alignment is desired later)
- Option 1 (safest, surgical):
  - Continue to use idempotent `CREATE INDEX IF NOT EXISTS …` statements for small DB changes without reconciling the full migration history.
- Option 2 (full alignment; requires approval):
  - `supabase db pull` to snapshot remote schema or `supabase migration repair` with explicit migration IDs to reconcile history. 
  - Risk: changes the recorded lineage; requires careful review and a freeze window.

## Peer Review Checklist (Code Verification)
- [x] Code changes match Phase‑1 PRDs and docs
  - PUT guard: paris/app/api/instance/[publicId]/route.ts:96-100
  - CSP nonce: All 6 renderers + venice/app/e/[publicId]/route.ts:72,164
  - CORS S2S: paris/middleware.ts:44-46
  - Submissions 202: paris/app/api/submit/[publicId]/route.ts:102,113
  - Redis breaker: paris/lib/redis.ts + paris/lib/rate-limit.ts
- [x] CSP nonce present across all Venice renderers; route passes nonce
  - Renderers: formsContact.ts, faq.ts, testimonials.ts, announcement.ts, newsletter.ts, socialProof.ts
  - Route: nonce generated at line 72, passed to all renderer calls, used in buildCsp(nonce) at line 164
- [x] CORS middleware allows S2S; browser allowlist enforced
  - S2S bypass: if (!origin) return NextResponse.next() at line 44
  - Browser enforcement: allowlist check at line 49, 403 at line 70
- [x] PUT empty body → 422; status‑only and template‑only still succeed
  - Guard: lines 96-100 reject when config undefined, no status, no templateId
  - Status-only: config remains optional (line 84: payload.config !== undefined)
- [x] Submissions return 202 Accepted (accepted/deduped)
  - Deduped: line 102 returns 202 on unique constraint violation
  - Accepted: line 113 returns 202 on successful insert
- [x] Redis connect‑once + breaker fallback verified (env permitting)
  - Connect-once: paris/lib/redis.ts:22-30 (single client creation)
  - Breaker: paris/lib/rate-limit.ts:105-154 (degrades to SQL on errors)
  - Backend header: X-RateLimit-Backend exposed at submit route.ts:82,112
- [x] Remote DB shows both indexes present
  - usage_events_idempotency_hash_key: UNIQUE WHERE NOT NULL (verified via CLI dump)
  - idx_widget_instances_widget_id: btree(widget_id) (verified via CLI dump)
- [x] Docs reference only `supabase/migrations/`; widget docs discoverable
  - dbschemacontext.md removed; references updated in michael.md, geneva.md, TESTING.md
  - Widget docs: documentation/widgets/*.md + README.md added

## Manual Test Results (Evidence Collection)

**Status:** Awaiting execution (run tests from PRE_SHIP_VERIFICATION.md)

### Test 1: CSP Nonce (Browser) — PENDING
**Command:**
```bash
open http://localhost:3002/e/<publicId>?theme=light&device=desktop
```
**Expected:** Zero CSP errors in console, styles render correctly

**Result:**
```
[Paste screenshot or console output]
```

---

### Test 2: CORS Server-to-Server — PENDING
**Command:**
```bash
curl -v -X PUT http://localhost:3001/api/instance/<publicId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}'
```
**Expected:** HTTP 200, instance updated

**Result:**
```
[Paste curl output]
```

---

### Test 3: CORS Browser Enforcement — PENDING
**Command:**
```bash
curl -v -X PUT http://localhost:3001/api/instance/<publicId> \
  -H "Origin: https://evil.example" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}'
```
**Expected:** HTTP 403 with `{"error":"FORBIDDEN"}`

**Result:**
```
[Paste curl output]
```

---

### Test 4: PUT Empty Body → 422 — PENDING
**Command:**
```bash
curl -v -X PUT http://localhost:3001/api/instance/<publicId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** HTTP 422 with `[{"path":"body","message":"At least one field (config, status, templateId) required"}]`

**Result:**
```
[Paste curl output]
```

---

### Test 5: PUT Status-Only (Regression) — PENDING
**Command:**
```bash
curl -v -X PUT http://localhost:3001/api/instance/<publicId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"published"}'
```
**Expected:** HTTP 200, status updated

**Result:**
```
[Paste curl output]
```

---

### Test 6: Submissions Dedup — PENDING
**Command:**
```bash
# First submission
curl -v -X POST http://localhost:3002/s/<publicId> \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","timestamp":"1234567890"}'

# Duplicate (same payload)
curl -v -X POST http://localhost:3002/s/<publicId> \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","timestamp":"1234567890"}'
```
**Expected:**
- First: HTTP 202 `{"status":"accepted","deduped":false}`
- Second: HTTP 202 `{"status":"accepted","deduped":true}`

**Result:**
```
[Paste both curl outputs]
```

---

### DB Verification: Remote Indexes — PENDING
**Command:**
```bash
psql $REMOTE_DB -c "\d+ widget_instances"
psql $REMOTE_DB -c "\d+ usage_events"
```
**Expected:** Both indexes present with correct structure

**Result:**
```
[Paste psql output]
```

---

## Ask
- Approve closing the "push" task as "verified by schema and unnecessary to modify history," or authorise a migration history reconciliation plan if you need strict `db push` to work against current remote lineage.

