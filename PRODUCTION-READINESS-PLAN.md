# CLICKEEN PHASE‑1 PRODUCTION READINESS — REMAINING WORK ONLY

This document lists only what’s left to reach Phase‑1 production readiness. Completed items have been removed for clarity.

Commit anchor: ef6b23d (main)

## Remaining Risks & Tasks

| Priority | Area | Task | Notes |
|---|---|---|---|
| P0 | Database (Michael) | Add base schema migrations | Create core tables + FKs + policies from DB Truth; current `supabase/migrations/**` include only additive/index/RLS steps. |
| P0 | Database (Michael) | Add submissions dedup index | Unique/partial index for `widget_submissions` (e.g., `(widget_id, ts_second, payload_hash)`), per docs. |
| P1 | API (Paris) | Normalize branding across endpoints | Introduce `computeBranding(client, workspaceId)` and pass into all `shapeInstanceResponse` calls (from‑template, claim) as done in GET/PUT. |
| P1 | API/Docs | Resolve POST `/api/instance` status | Either (a) deprecate in docs (Phase‑1) to reflect code 422 guidance, or (b) implement a workspace‑scoped creation flow. |
| P2 | Catalog | Add 1 more template (optional) | Catalog has 7 templates; report cited 8. Either add another variant or update reporting. |
| P2 | Privacy | Align submissions IP handling (optional) | Optionally hash IP like usage (store `ipHash` only) and adjust RL SQL fallback accordingly; update docs. |
| P2 | Ops | Verify prod env | Ensure `ALLOWED_ORIGINS` configured; healthz now surfaces `deps.cors` for quick validation. |

## Details

### P0 — Base Schema Migrations
- Generate `supabase/migrations/<timestamp>__phase1_base_tables.sql` with:
  - CREATE TABLE: `workspaces`, `workspace_members`, `widgets`, `widget_instances`, `embed_tokens`, `widget_submissions`, `usage_events`, `plan_features`, `plan_limits`, `events`.
  - FKs and constraints per DB Truth; indexes for lookups; RLS enabled with Phase‑1 policies.
- Add unique/partial index for `widget_submissions` dedup (rate‑window + payload hash).
- Validate locally via `supabase start && supabase migration up`.

### P1 — Branding Consistency Helper
- Add `computeBranding(client, workspaceId)` in `paris/lib/instances.ts` (or `lib/entitlements.ts`).
- Update `from-template` and `claim` routes to call `shapeInstanceResponse(record, branding)` so all instance payloads return plan‑based branding.

### P1 — POST `/api/instance` Resolution
- Current code returns 422 advising to use `/api/instance/from-template`.
- Choose one:
  - Deprecate in docs (Phase‑1) and keep disabled, or
  - Implement workspace‑scoped create (create widget row + set `widget_id`).

### P2 — Catalog Template Count
- Add one more template variant (e.g., `faq-accordion` or `logos-row`) to reach 8, or update reporting/acceptance to 7.

### P2 — Submissions Privacy Alignment (Optional)
- Hash IP using salted SHA‑256 (env `RATE_LIMIT_IP_SALT`) and store `ipHash` only; update RL SQL fallback to query `metadata->>ipHash`.
- Update documentation to reflect the change (systems/paris.md).

### P2 — Ops Finalization
- Set `ALLOWED_ORIGINS` in production; verify `GET /api/healthz` → `deps.cors.configured=true` and `allowlistCount>0`.

## Validation Checklist (Remaining)
- Migrations apply cleanly; all required tables/policies exist.
- Submissions dedup works (duplicates accepted without new rows).
- All instance‑returning endpoints include plan‑based branding consistently.
- If POST `/api/instance` remains disabled, docs updated accordingly; otherwise endpoint passes workspace‑scoped tests.
- Catalog templates count decision made and implemented.
- Optional: submissions IP hashing applied and documented.
- Healthz CORS fields reflect configured allowlist in production.

## Out of Scope (Already Completed)
- Widget renderers (6), catalog wiring, Venice routing.
- Usage privacy hashing, Redis/SQL fallback & circuit breaker.
- Loader bus naming alignment (`window.ckeenBus`, legacy alias).
- Healthz CORS visibility; env docs updated (`RATE_LIMIT_IP_SALT`).
- CORS policy remains fail‑closed; middleware verified.

---
Owner: Engineering  
Target: Ship remaining P0/P1 in next working day; P2 optional items within the week.

