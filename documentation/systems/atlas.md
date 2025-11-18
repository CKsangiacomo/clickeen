STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Atlas system. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Atlas — Config & Cache Layer

## 0) Quick Facts
- **Surface:** Vercel Edge Config (`ATLAS_EDGE_CONFIG`) read via `c-keen-embed`
- **Purpose:** Provide a low-latency cache of schema + template metadata so Venice can render without hitting Supabase on every request
- **Dependencies:**
  - Sources data from Michael (via Paris service-role sync jobs)
  - Consumed exclusively by Venice during SSR
- **Secrets:**
  - `ATLAS_EDGE_CONFIG` (read-only ID) supplied to Venice
  - `ATLAS_EDGE_CONFIG_TOKEN` retained server-side in Paris for administrative writes (never exposed client-side)

## 1) Phase-1 Behaviour (NORMATIVE)
- Atlas is **read-only at runtime.** Venice may only issue GET lookups using the Edge Config ID. Any write requires an authenticated Paris admin job guarded by `INTERNAL_ADMIN_KEY` (see operational notes below).
- Cached payloads include:
  - Template descriptors (`widget_templates` projection)
  - Schema metadata (`widget_schemas` projection)
  - Branding + entitlement hints required for Venice SSR bootstrap
- Update flow: Paris background job fetches authoritative data from Michael → writes to Atlas via Vercel Edge Config API → logs version + checksum. Failures must leave the previous snapshot intact.
- Cache policy: Venice treats Atlas as an optimisation only. If a key is missing or stale, Venice falls back to fetching from Paris/Michael directly and logs a warning.

## 2) Interfaces
| Consumer | Operation | Notes |
| --- | --- | --- |
| Venice | `GET /edge-config/:key` | Pulled via Vercel `@vercel/edge-config` SDK. 50 ms timeout with fallback to Paris. |
| Paris Jobs | `PUT /edge-config` (internal) | Runs on deploy + hourly sync. Requires `ATLAS_EDGE_CONFIG_TOKEN` and `INTERNAL_ADMIN_KEY`. |

Keys follow the convention `atlas:v1:widgetTemplates` and `atlas:v1:widgetSchemas`. Any new key requires updating both the sync job and Venice lookup list.

## 3) Failure Handling
- **Atlas unavailable / timeout**: Venice must log `atlas_unavailable`, skip cache usage, and continue with direct Paris fetch (5 s overall budget still applies).
- **Stale data detection**: Paris stamps each entry with `updatedAt` + checksum. Venice compares with instance `schemaVersion`; mismatch triggers a Paris fetch + cache refresh hint.
- **Security**: No runtime writes or deletions are permitted from Venice or Bob. Attempting to mutate Atlas outside the sanctioned Paris jobs is a P0 violation.

## 4) Operational Notes
- Sync job lives under `paris/app/jobs/atlas-sync.*` (placeholder until implemented). Job MUST run with service-role credentials and exhaustive logging (success, diff count, checksum).
- On deploy, run `pnpm turbo run atlas:sync --filter=paris` (script TBD) before promoting traffic so Atlas mirrors the latest DB state.
- Incident response: if Atlas becomes corrupted, revoke the Edge Config token, regenerate via Vercel dashboard, update env vars, and rerun the sync job.

## 5) Testing Checklist
- Unit tests verifying Venice falls back gracefully when Atlas lookups fail.
- Integration test exercising Paris sync job against a fixture dataset (ensures keys + payload shape match Venice expectations).
- Monitoring hook that captures cache hit rate and last sync timestamp (exposed via `/api/healthz` dependency block).

## 6) Common Mistakes (DO NOT DO)
- ❌ Writing to Atlas from Venice/Bob — runtime must stay read-only.
- ❌ Adding new cache keys without updating both the sync job and Venice lookup logic.
- ❌ Treating Atlas as authoritative for branding or entitlements; Paris remains the source of truth.

---
Links: back to `documentation/CONTEXT.md`
