# Operations Quickstart (Phase-1)

STATUS: Informative — deployment aide for ops and engineers. Specs remain authoritative in `documentation/`.

## CORS and Front-Door Policy

- Paris (API) only accepts requests from allowlisted app/site origins.
- Set `ALLOWED_ORIGINS` in production (comma‑separated). Example:
  - `ALLOWED_ORIGINS="https://app.clickeen.com,https://clickeen.com"`
- Production without `ALLOWED_ORIGINS` fails closed (403). Venice (embeds) never needs CORS.
- Health surface exposes basic CORS configuration:
  - `GET /api/healthz` → `deps.cors = { configured, allowlistCount }`.

## Environment Variables by Surface

### c-keen-app (Bob)
- `NEXT_PUBLIC_VENICE_URL` (canonical; used for preview iframe)
- Compatibility: `NEXT_PUBLIC_EMBED_BASE` still honored if set

### c-keen-embed (Venice)
- `PARIS_URL` — internal API base (defaults to production API)

### c-keen-api (Paris)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS` — required in production
- Optional rate limiting:
  - `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_PREFIX`
  - Circuit breaker tunables: `RATE_LIMIT_BREAKER_*`
  - IP hashing salt (SQL fallback only): `RATE_LIMIT_IP_SALT` (any stable secret string)

## Database Migrations (Supabase)

Phase‑1 migrations are stored under `supabase/migrations/`. Apply with Supabase CLI.

1) Ensure Docker Desktop is running locally (for `supabase start`).
2) From repo root:
```
supabase start                   # if local stack isn’t running
supabase migration up            # applies files under supabase/migrations locally
# (optional) run smoke checks against local services
supabase stop                    # optional teardown
```
3) For production, use your existing GitOps or Supabase deploy pipeline to apply the same migrations.

## Quick Validation Checklist

1) API health: `GET /api/healthz` → 200 and `deps.supabase.status: true`.
2) CORS:
   - Allowed origin → normal responses
   - Non‑allowlisted origin → 403
3) Catalog: `GET /api/widgets`, `GET /api/templates?widgetType=…` → 200 JSON.
4) Venice SSR: `GET /e/:publicId?ts=…&theme=light&device=desktop` → HTML with "Made with Clickeen".
5) Usage pipeline: `GET /embed/pixel?widget=:publicId&event=load&ts=…` → 204; `/api/usage` returns 202 when invoked by Venice.

Refer to `documentation/INTEGRATION-TESTING.md` for full end‑to‑end scenarios.

