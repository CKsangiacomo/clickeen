STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
1) supabase/migrations/ (DB schema truth)
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Global Contracts)
3) documentation/systems/<System>.md (System PRDs, Phase-1)

# Vercel Deployments (Phase-1 Reset)

## Deployment: c-keen-site
- **Stack:** Next.js on Vercel (production + preview)
- **Root directory:** `prague/`
- **Hosts:** Prague marketing site and gallery
- **Build command:** `pnpm build`
- **Notes:** Berlin instrumentation allowed here; no Dieter assets or embed code served from this project.

## Deployment: c-keen-app
- **Stack:** Next.js on Vercel (Node runtime)
- **Root directory:** `bob/`
- **Hosts:** Bob builder application at `/bob`, Dieter web assets, Cairo custom-domain flows, Berlin app instrumentation
- **Build command:** `pnpm build`
- **Install command:** default Vercel `pnpm install`
- **Static assets:** Dieter copies live under `bob/public/dieter/` (copy-on-build; never committed). Ensure the build copies `dieter/dist/**` into this directory before deploy.

## Deployment: c-keen-embed
- **Stack:** Edge Functions on Vercel
- **Root directory:** `venice/`
- **Hosts:** Venice SSR runtime (`/e/:publicId`), loader bundle (`/embed/v{semver}/loader.js` + `/embed/latest/loader.js`), pixel endpoint
- **Build command:** `pnpm build`
- **Notes:** Enforce ≤28 KB gzipped loader target manually. Venice always calls Paris via private server-to-server channel; browsers never hit Paris directly.

## Deployment: c-keen-api
- **Stack:** Next.js (Node runtime) on Vercel
- **Root directory:** `paris/`
- **Hosts:** Paris HTTP API (`/api/instance`, `/api/claim`, `/api/token`, `/api/usage`, `/api/submit/:publicId`, `/api/healthz`) plus Geneva schema endpoints and Phoenix idempotency middleware
- **Build command:** `pnpm build`
- **Notes:** Holds all service-role secrets (Supabase, INTERNAL_ADMIN_KEY). No public traffic should land here without auth.

---

## Shared runtime guidance (Phase-1)
- Node 20 is the required runtime (`"engines": { "node": "20.x" }`).
- Atlas (Edge Config) is **read-only** at runtime. Administrative writes require `INTERNAL_ADMIN_KEY` and the Vercel Edge Config API token.
- All deployments rely on `pnpm` workspaces; install runs at repo root. Use `pnpm install --frozen-lockfile` locally/CI before triggering Vercel builds.

## Environment Variables (reference)

### c-keen-app (`bob/`)
- `NEXT_PUBLIC_PARIS_URL` — points Bob at the deployed API for client fetches
- `NEXT_PUBLIC_VENICE_URL` — used for embed preview iframe src
- Any Cairo/Berlin keys (feature flagged) stay here; no embed secrets permitted.

### c-keen-embed (`venice/`)
- `PARIS_URL` — internal API base (defaults to `https://c-keen-api.vercel.app`)
- `ATLAS_EDGE_CONFIG` — Vercel Edge Config ID (read-only access)

### c-keen-api (`paris/`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `INTERNAL_ADMIN_KEY` (ops-only; required for Atlas administrative overrides)
- `ATLAS_EDGE_CONFIG_TOKEN` / `ATLAS_EDGE_CONFIG_ID` for administrative updates (never exposed to runtime handlers)
 - `ALLOWED_ORIGINS` — comma‑separated allowlist of origins (Bob/Prague). Required in prod.
 - `RATE_LIMIT_REDIS_URL` — optional Redis for distributed rate limiting
 - `RATE_LIMIT_REDIS_PREFIX` — optional Redis key prefix (default `ck:rl:`)
 - `RATE_LIMIT_BREAKER_THRESHOLD` — errors to open circuit (default 5)
 - `RATE_LIMIT_BREAKER_WINDOW_MS` — counting window (default 60000)
 - `RATE_LIMIT_BREAKER_COOLDOWN_MS` — cooldown before retry (default 300000)
 - `RATE_LIMIT_IP_SALT` — optional salt for hashing client IPs in SQL fallback (privacy‑safe per‑IP rate limiting; raw IPs are never stored)

### c-keen-site (`prague/`)
- Public marketing keys only (analytics, etc.); no secrets.

> Keep this file in sync with system PRDs and Techphases when deployments or env contracts change.
