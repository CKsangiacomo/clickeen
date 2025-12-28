STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Berlin system. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Berlin — Observability & App/Site Security (Phase-1)

## 0) Quick Facts
- **Surfaces:** `c-keen-app` (Bob, Cairo) and `c-keen-site` (Prague) only
- **Purpose:** Application-level logging, metrics, rate limiting, and sanctioned analytics for app + marketing surfaces
- **Hard boundary:** **Berlin never ships inside embeds or API (Venice / Paris)**. No client bundles, scripts, or middleware from Berlin may be referenced there.

## 1) Responsibilities
- Collect structured logs (request ID, user/workspace, route, latency) and ship to the central sink defined by ops.
- Emit metrics for app/site traffic (request/sec, error rates, API proxy status when Bob calls Paris).
- Enforce Next.js middleware based rate limits for sensitive routes (login, claim, publish) using Supabase user context when available.
- Gate sanctioned analytics (PostHog/Sentry) to app/site only with project tokens stored in `c-keen-app` / `c-keen-site` env.

## 2) Forbidden
- No Sentry/PostHog/analytics inside Venice loader, Venice SSR output, or Paris API handlers.
- No logging from Berlin that includes PII (email, IP, token). Hash sensitive identifiers before logging.
- No service-role credentials stored in observability tooling.

## 3) Implementation Notes
- Logging helpers live under `bob/app/lib/observability/**` (app) and `prague/app/lib/observability/**` (site).
- Rate-limit middleware is expressed via Next.js App Router middleware (`bob/middleware.ts`) and must respect the budgets published in Phase-1 Specs.
- Error reporting must include `X-Request-ID` propagated from upstream surfaces. Venice issues this header when proxying to Paris.

## 4) Testing & Monitoring
- Smoke tests verify rate limits trigger after the configured threshold and reset per window.
- Observability unit tests ensure no PII fields are logged.
- `/api/healthz` (Paris) reports Berlin dependency status for app/site logging sinks only (lookups via internal service ping).

## 5) Common Mistakes (DO NOT DO)
- ❌ Adding observability scripts to Venice loader or embeds.
- ❌ Instrumenting Paris routes with Sentry/PostHog.
- ❌ Logging tokens, emails, or other PII in clear text.

---
Links: back to `documentation/CONTEXT.md`
