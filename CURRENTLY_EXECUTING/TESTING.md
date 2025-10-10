Testing Plan — Phase‑1 Consolidation (P0/P1)

Purpose
- Verify the six high‑priority fixes and ensure Phase‑1 contracts remain intact (front‑door, caching/validators, tokens/entitlements).
- This plan assumes local dev for Paris and Venice, and a Supabase environment with the Phase‑1 migrations applied.

Prerequisites
- Install deps at repo root: `pnpm install`
- Run services locally (separate terminals):
  - `pnpm --filter paris dev`
  - `PARIS_URL=http://localhost:3001 pnpm --filter venice dev`
- Supabase available with Phase‑1 schema from `supabase/migrations/` applied (local or remote).
- Environment variables:
  - Paris: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` (include `http://localhost:3002`)
  - Venice: `PARIS_URL=http://localhost:3001`

P0 — Venice CSP Nonce in Renderers
Goal: All SSR pages include `<style nonce="...">` and render styled content under CSP.
Steps:
1) Request an embed: `curl -i "http://localhost:3002/e/<publicId>?theme=light&device=desktop"`
2) Inspect response headers: `Content-Security-Policy` should contain `style-src 'self' 'nonce-...';`.
3) Inspect HTML: every inline `<style>` in the renderer output has `nonce="..."` matching CSP.
4) Visual sanity check in browser (no CSP violations in console).
Expected: Styled HTML renders correctly; no CSP errors.

P0 — Paris PUT /api/instance config optional
Goal: Status‑only and template‑only updates succeed; transforms run only when needed.
Setup: Have a draft instance `wgt_xxxxxx` in DB.
Steps:
1) Status‑only update: `PUT /api/instance/wgt_xxxxxx` with `{ "status": "published" }`
   - Expect 200 JSON payload; plan limits enforced (403 `PLAN_LIMIT` if exceeded).
2) Template dry‑run: `PUT /api/instance/wgt_xxxxxx?dryRun=true` with `{ "templateId": "classic-light" }`
   - Expect 200 `{ action:'template-switch-preview', diff, proposedConfig }`.
3) Template confirm: `PUT /api/instance/wgt_xxxxxx?confirm=true` with `{ "templateId": "classic-light" }`
   - Expect 200 with updated `templateId/schemaVersion` and transformed config.
Expected: No `config must be an object` error when body omits `config`.

P0/P1 — Submissions return 202 Accepted
Goal: Accepted and deduped submission writes respond with 202.
Steps:
1) POST to Venice proxy: `curl -i -X POST http://localhost:3002/s/wgt_xxxxxx -H 'Content-Type: application/json' --data '{"fields":{"email":"a@b.com"}}'`
2) Repeat the exact request within the dedup window (same payload):
   - First request: `HTTP/1.1 202` with `{ status:'accepted', deduped:false }`
   - Second request: `HTTP/1.1 202` with `{ status:'accepted', deduped:true }`
Expected: Both responses are 202; second marks `deduped:true`.

Schema verification (via migrations)
Goal: Ensure the database schema matches the Phase‑1 migrations.
Steps:
1) Apply migrations to the target environment (local or remote):
   - Local: `supabase start` (if needed), then `supabase migration up`
   - Remote: apply the SQL in `supabase/migrations/` per your deployment process
2) Verify presence of Phase‑1 tables and indexes:
   - Tables: `workspaces`, `workspace_members`, `widgets`, `widget_instances`, `embed_tokens`, `widget_submissions`, `usage_events`, `plan_features`, `plan_limits`, `events`
   - Indexes: `widget_submissions_dedup_idx`, `idx_widget_instances_widget_id`
Expected: Applied schema matches the SQL under `supabase/migrations/`.

Optional — Rename widget_submissions.ip → ip_hash (clarity)
Goal: Column name reflects hashed content.
Steps (if migration applied):
1) Apply migration renaming column to `ip_hash`.
2) Exercise submissions and rate‑limit SQL fallback path.
3) Verify new rows have `ip_hash` populated; no references to `ip` remain in code.
Expected: Same functional behavior; clearer semantics.

P1 — Harden Geneva/AJV fallback
Goal: No silent accept‑all if AJV missing; health signals or 5xx emitted.
Steps:
1) Temporarily simulate missing AJV (e.g., remove/alias ajv in dev) or force code path.
2) Call `POST /api/instance/from-template` with an obviously invalid config.
3) Expect 422 with validation errors, or 5xx/503 with explicit validation unavailable signal (depending on chosen policy).
4) Optionally surface a `validation: { ajvAvailable: boolean }` in healthz.

Regression & Integration Smoke
- Run Venice validators scenario (this document, section “Venice caching (validators)”):
  1) First GET `/e/:publicId` → 200 with `ETag` and `Last-Modified`.
  2) Repeat with `If-None-Match` → 304. Repeat with `If-Modified-Since` → 304 when unchanged.
- Confirm front‑door: Browser → Venice only; Paris CORS blocks non‑allowlisted origins.
- Pixel usage path: `GET /embed/pixel?...` writes 202 via `/api/usage` with `X-RateLimit-Backend` present.
- Budgets (optional, report‑only): `pnpm --filter venice run check:budgets` and record gzipped bytes vs 10KB target.

Notes
- Do not expand scope beyond the P0/P1 list for Phase‑1.
- Keep schema precedence: `supabase/migrations/` > Phase‑1 Specs > System PRDs > Techphases > WhyClickeen.
