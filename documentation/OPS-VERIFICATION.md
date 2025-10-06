# Ops Verification Checklist (Phase‑1)

Use this to verify production readiness after deploying Phase‑1.

## 1) CORS Allowlist (Paris)
- Set `ALLOWED_ORIGINS` to Bob/Prague origins in c‑keen‑api environment.
- Verify: `GET /api/healthz` → `deps.cors.configured=true`, `allowlistCount>0`.
- Negative check: requests from non‑allowlisted origins receive `403 FORBIDDEN`.

## 2) Database Migrations
- Ensure all Phase‑1 migrations are applied (remote):
  - Base tables: `20251004100000__phase1_base_tables.sql`, `20251006150000__phase1_base_tables.sql`
  - Dedup index: `20251006151000__widget_submissions_dedup.sql`
  - FK index: `20251006152000__idx_widget_instances_widget_id.sql`
- Spot checks:
  - `\dt public.*` shows `workspaces`, `workspace_members`, `widgets`, `widget_instances`, `embed_tokens`, `widget_submissions`, `usage_events`, `plan_features`, `plan_limits`, `events`.
  - `\d+ widget_submissions` shows `widget_submissions_dedup_idx` on `(widget_id, ts_second, payload_hash)` with `WHERE payload_hash IS NOT NULL`.
  - `\d+ widget_instances` shows `idx_widget_instances_widget_id` on `(widget_id)`.

## 3) Branding Consistency (Paris → Venice)
- Create draft instance via from‑template → Expect `branding.enforced` based on plan features.
- Claim instance → Expect same branding semantics.
- GET / PUT instance → Expect `branding` matches from‑template/claim.

## 4) Template Catalog
- `GET /api/templates` returns 8 templates (includes `faq-accordion`).

## 5) Submission Dedup
- Send `POST /api/submit/:publicId` twice with identical payloads within the same second.
- Expect the second request to be accepted/deduped without creating a new row.

## 6) Error Ergonomics (from‑template)
- Invalid `templateId` → 422 with valid template IDs listed for the given `widgetType`.

## Notes
- Submissions store `widget_instance_id` as publicId (TEXT) by design (no FK) to allow cross‑service integration and audit retention.
- Usage events and submissions employ idempotency/dedup patterns to handle client retries safely.

