# CLICKEEN PHASE‑1 PRODUCTION READINESS — EXECUTION TASKS

This plan lists only remaining work as concrete, actionable tasks with file paths and acceptance checks.

Commit anchor: a41b515 (main)

## P0 — Database (Michael)

1) Create base schema migration (core tables + FKs + RLS)
   - Files:
     - `supabase/migrations/<TS>__phase1_base_tables.sql`
   - Do:
     - Add CREATE TABLE for: `workspaces`, `workspace_members`, `widgets`, `widget_instances`, `embed_tokens`, `widget_submissions`, `usage_events`, `plan_features`, `plan_limits`, `events`.
     - Add FKs and constraints per DB Truth; add essential indexes (lookups by public_id, status; idempotency hashes).
     - Enable RLS and add Phase‑1 policies.
   - Accept:
     - `supabase start && supabase migration up` succeeds locally.
     - Health checks and simple selects over new tables succeed.

2) Add submissions dedup index (rate‑window + payload hash)
   - Files:
     - `supabase/migrations/<TS>__widget_submissions_dedup.sql`
   - Do:
     - Create UNIQUE (or partial unique) index on `(widget_id, ts_second, payload_hash)` per docs.
   - Accept:
     - Duplicate payload within window returns accepted/deduped without new row; insert raises unique violation when attempted directly.

## P1 — API (Paris)

3) Normalize branding across all instance responses
   - Files:
     - `paris/lib/instances.ts` (or new `paris/lib/branding.ts`)
     - `paris/app/api/instance/from-template/route.ts`
     - `paris/app/api/claim/route.ts`
   - Do:
     - Add `computeBranding(client, workspaceId)` helper (plan‑based: `enforced = !features.brandingRemovable`).
     - Pass branding to `shapeInstanceResponse(record, branding)` in from‑template and claim endpoints.
   - Accept:
     - All instance-returning endpoints (GET/PUT/from‑template/claim) return consistent `branding` values.

4) Resolve POST `/api/instance` status (choose path)
   - Option A (deprecate in Phase‑1):
     - Files: `documentation/systems/paris.md`, `documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md`.
     - Do: Document that creation is via `/api/instance/from-template` only; keep current 422 guidance in code.
   - Option B (implement workspace‑scoped create):
     - Files: `paris/app/api/instance/route.ts` (+ tests)
     - Do: Create backing `widgets` row, insert `widget_instances` with valid `widget_id`, validate via Geneva.
   - Accept:
     - Chosen path implemented; docs and code aligned.

## P2 — Catalog & Privacy (Optional)

5) Add 8th template (or accept 7)
   - Files:
     - `paris/lib/catalog.ts`
   - Do:
     - Add another `TemplateCatalogEntry` (e.g., `faq-accordion` or `logos-row`).
   - Accept:
     - `GET /api/templates` returns 8 templates; or plan explicitly states 7 is final for Phase‑1.

6) Align submissions IP privacy (optional)
   - Files:
     - `paris/app/api/submit/[publicId]/route.ts`
     - `paris/lib/rate-limit.ts` (SQL fallback query)
     - `documentation/systems/paris.md`, `documentation/verceldeployments.md`
   - Do:
     - Compute `ipHash = sha256(RATE_LIMIT_IP_SALT || 'v1' + ip)`; store `ipHash` instead of raw IP.
     - Update SQL fallback to query `metadata->>ipHash`.
     - Update docs (already list `RATE_LIMIT_IP_SALT`).
   - Accept:
     - Rate-limits still enforce; raw IP no longer stored.

## P2 — Ops Finalization

7) Verify production CORS allowlist
   - Files/Env:
     - `ALLOWED_ORIGINS` in c‑keen‑api env (production)
   - Do:
     - Set allowlist to Bob/Prague origins; keep fail‑closed policy.
     - Verify `GET /api/healthz` → `deps.cors.configured=true`, `allowlistCount>0`.
   - Accept:
     - Healthz reports configured CORS; non-allowlisted origins return 403; allowlisted origins OK.

---
Checklist (run when done)
- [ ] Base schema migration applied; tables/constraints/policies live.
- [ ] Submissions dedup index live and effective.
- [ ] Branding consistent across all instance responses.
- [ ] POST `/api/instance` path decided and aligned in code+docs.
- [ ] Templates: 8 present or decision documented to stay at 7.
- [ ] (Optional) Submissions IP hashing aligned and documented.
- [ ] Production `ALLOWED_ORIGINS` configured; healthz CORS fields green.

