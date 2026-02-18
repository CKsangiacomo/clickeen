STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes the intended Paris responsibilities and APIs.
Runtime code + `supabase/migrations/` are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

## AIs Quick Scan

**Purpose:** Phase-1 HTTP API (instances) + AI grant/outcome gateway + metering enforcement (usage is shipped; submissions are placeholders in this repo snapshot).
**Owner:** Cloudflare Workers (`paris`).
**Dependencies:** Michael (Postgres via Supabase REST), San Francisco (AI execution).
**Shipped Endpoints (this repo snapshot):** `GET /api/healthz`, `GET /api/me` (optional `workspaceId` query to resolve explicit active workspace defaults), `GET /api/widgets` (widget catalog), `GET /api/curated-instances` (curated listing), `GET /api/workspaces/:workspaceId`, `GET /api/workspaces/:workspaceId/members`, `GET /api/workspaces/:workspaceId/policy`, `GET /api/workspaces/:workspaceId/entitlements`, `GET /api/workspaces/:workspaceId/ai/profile`, `GET /api/workspaces/:workspaceId/ai/limits`, `GET /api/workspaces/:workspaceId/ai/outcomes` (explicit unavailable contract in this snapshot), `GET /api/workspaces/:workspaceId/instances/:publicId/layers?subject=devstudio|minibob|workspace`, `GET/PUT/DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`, `GET /api/workspaces/:workspaceId/instances/:publicId/l10n/status?subject=devstudio|minibob|workspace`, `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=devstudio|minibob|workspace`, `GET /api/workspaces/:workspaceId/instances/:publicId/publish/status?subject=devstudio|minibob|workspace`, `POST /api/workspaces/:workspaceId/instances/:publicId/render-snapshot?subject=devstudio|minibob|workspace`, `POST /api/l10n/jobs/report`, `GET /api/instance/:publicId` (public; user-owned instances are published-only), `GET/POST /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace`, `GET/PUT /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace`, `GET/PUT /api/workspaces/:workspaceId/locales`, `GET/POST /api/workspaces/:workspaceId/business-profile`, `POST /api/workspaces/:workspaceId/website-creative` (devstudio; local-only), `POST /api/ai/grant`, `POST /api/ai/minibob/session`, `POST /api/ai/minibob/grant`, `POST /api/ai/outcome`, `POST /api/personalization/preview`, `GET /api/personalization/preview/:jobId`, `POST /api/personalization/onboarding`, `GET /api/personalization/onboarding/:jobId`, `POST /api/usage` (metering; HMAC-signed), `POST /api/submit/:publicId` (501).
**Also shipped (account/Roma app domain):** `POST /api/accounts`, `GET /api/accounts/:accountId`, `GET/POST /api/accounts/:accountId/workspaces`, `GET /api/accounts/:accountId/usage`, `GET /api/accounts/:accountId/assets` (optional `view/workspaceId` projection), `GET /api/accounts/:accountId/assets/:assetId` (optional `view/workspaceId` projection), `DELETE /api/accounts/:accountId/assets/:assetId`, `GET /api/accounts/:accountId/billing/summary`, `POST /api/accounts/:accountId/billing/checkout-session` (explicit not-configured contract), `POST /api/accounts/:accountId/billing/portal-session` (explicit not-configured contract), `GET /api/roma/bootstrap` (identity + workspace/account authz capsules + account entitlement snapshot), `GET /api/roma/widgets?workspaceId=:workspaceId`, `GET /api/roma/templates?workspaceId=:workspaceId`, `POST /api/roma/widgets/duplicate`, `DELETE /api/roma/instances/:publicId?workspaceId=:workspaceId`, `POST /api/minibob/handoff/start`, `POST /api/minibob/handoff/complete`.
**Database Tables (this repo snapshot):** `widgets`, `widget_instances`, `curated_widget_instances`, `workspaces`, `accounts`, `account_assets`, `account_asset_variants`, `account_asset_usage`, `widget_instance_overlays`, `l10n_generate_state`, `l10n_base_snapshots`, `workspace_business_profiles`, `instance_enforcement_state`.
**Key constraints:** instance config is stored verbatim (JSON object required); status is `published|unpublished`; non-public product endpoints require Supabase session JWT auth; workspace-scoped product endpoints enforce workspace membership + minimum role (`viewer` for reads, `editor` for writes); public `/api/instance/:publicId` is published-only for user-owned instances.

## Runtime Reality (this repo snapshot)

Paris in this repo is a **dev-focused Worker** with a deliberately small surface:

- **Modular monolith:** Paris is organized by domain modules under `paris/src/domains/*` with shared utilities in `paris/src/shared/*`. It is a single Worker (no worker-to-worker microservices).
- Non-public product endpoints require Supabase session JWT auth. `GET /api/instance/:publicId` is public and published-only for user-owned instances.
- Local auth invariant: the Supabase JWT issuer must match the Supabase project configured in the running Paris worker. Cross-project tokens fail with `AUTH_INVALID` issuer mismatch.
- `GET /api/me` defaults are explicit: when `workspaceId` query is supplied and membership exists, that workspace becomes default; without explicit selection, defaults are only emitted when membership is unambiguous (single workspace).
- `GET /api/roma/bootstrap` returns identity/workspace graph plus:
  - short-lived signed workspace authz capsule (`x-ck-authz-capsule`),
  - short-lived signed account authz capsule (`x-ck-account-capsule`),
  - account entitlement snapshot (`authz.entitlements`) with policy flags/caps and budget max+used.
- Workspace-scoped authz is capsule-first: when `x-ck-authz-capsule` is present, Paris verifies signature + expiry + user/workspace binding before using it. Without capsule, Paris falls back to workspace membership lookup.
- Account-scoped authz is capsule-first: when `x-ck-account-capsule` is present, Paris verifies signature + expiry + user/account binding before using it. Without capsule, Paris falls back to account membership lookup.
- Membership fallback is cached in-worker for short windows (`workspaceId:userId`, 20s TTL) to reduce repeated Supabase reads during active sessions.
- Workspace-scoped product endpoints still require membership in the target workspace; `subject` controls policy profile, but does not bypass membership authz.
- Instance creation is workspace-scoped (`POST /api/workspaces/:workspaceId/instances?subject=...`) and requires product auth (+ superadmin key when enforced).
- Instance reads/writes use Supabase REST with the service role.
- Paris requires `TOKYO_BASE_URL` to validate widget types and load widget `limits.json`.
- Paris exposes account-canonical asset management APIs backed by `account_assets`, `account_asset_variants`, and `account_asset_usage` ("where used"), with optional workspace projection filters.
- Paris best-effort syncs `account_asset_usage` rows on instance config create/update/delete (workspace + Roma endpoints); sync errors are logged and do not block writes.
- Roma widgets/templates domain lists (`GET /api/roma/widgets`, `GET /api/roma/templates`) are intentionally lightweight (no instance `config` blobs); write actions like duplicate are explicit commands (`POST /api/roma/widgets/duplicate`).
- `GET /api/roma/widgets` returns active-workspace user instances plus curated/main starters owned by the workspace account.
- `GET /api/roma/templates` returns all curated/main starters available to authenticated workspace members.
- `GET /api/roma/widgets` derives per-instance action permissions (`edit|duplicate|delete`) from effective workspace role (viewer/editor/admin).
- Roma widget lookup (`widget_id -> widget_type`) is cached in-worker (5 minute TTL) to keep widget list latency stable.
- AI is handled via:
  - `POST /api/ai/grant` (mint short-lived signed grants)
  - `POST /api/ai/outcome` (forward outcome events to San Francisco `/v1/outcome`)

If you need the exact shipped behavior, inspect `paris/src/index.ts`.

### 🔑 CRITICAL: Base-Config Two-API-Call Pattern (NEW ARCHITECTURE)

**Core base-config editing uses EXACTLY 2 Paris instance calls per open session:**

1. **Load** - `GET /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` once per open (host-performed in Roma/DevStudio message boot, Bob-performed in URL boot) → gets instance snapshot (`config` + `status`)
2. **Publish** - `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` when user clicks Publish (from Bob) → saves working copy

`subject` is required on workspace endpoints (`workspace`, `devstudio`, `minibob`) to resolve policy profile.
Membership authz is enforced separately: caller must belong to that workspace, and write routes require at least `editor`.

Localization is separate and writes overlays via Paris; these do not change the base config.

**Between load and publish:**

- User edits in ToolDrawer → Bob updates React state (NO API calls to Paris for base config)
- Bob sends updated config to preview via postMessage (NO API calls to Paris for base config)
- Preview updates in real-time (NO API calls to Paris for base config)
- ZERO base-config database writes (overlay writes are allowed)

**Why This Matters:**

- **Scalability:** 10,000 users editing simultaneously → no server load for base config, all edits in memory
- **Database cost savings:** Only published base config stored → no pollution from abandoned edits
- **Localization UX:** overlay writes preserve manual edits while base config stays clean
- **Landing page demos:** Millions of visitors playing with widgets → ZERO base-config writes until they sign up and publish

**For Paris:**

- Paris expects one load `GET` per open and one publish `PUT` per explicit publish.
- No intermediate saves, no auto-save during editing
- Database only stores published widgets users actually care about

See [Bob Architecture](./bob.md) and [Widget Architecture](../widgets/WidgetArchitecture.md) for complete details.

### 🔒 CRITICAL: Widget Definition vs Instance

**Paris manages INSTANCES, NOT widget definitions.**

**Widget Definition** (a.k.a. “Widget JSON”) **= THE SOFTWARE** (Tokyo/CDN):

- Platform-controlled widget spec + runtime assets
- In-repo source: `tokyo/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md` plus contract files (`limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`)
- **NOT stored in Michael**
- **NOT served by Paris**

**Widget Instance config = THE DATA** (Michael tables: `widget_instances`, `curated_widget_instances`, `widgets`):

- User instance config lives in `widget_instances.config` (workspace-owned)
- Curated/baseline config lives in `curated_widget_instances.config` (Clickeen-authored)
- Curated uses `widget_type` (denormalized) instead of `widget_id`
- **EDITABLE by users** (user instances via Bob → Paris `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace`)

**What Paris returns for an instance:**

```json
{
  "publicId": "wgt_abc123",
  "status": "unpublished",
  "widgetType": "faq",
  "config": {
    "title": "My Customer FAQs"
  },
  "updatedAt": "2025-09-28T19:15:03.000Z"
}
```

**Paris endpoints (instance data only):**

- `GET /api/instance/:publicId` — Public; user-owned rows are published-only (Venice typically passes `?subject=venice` for telemetry).
- `GET /api/curated-instances` — Curated/baseline list (authenticated product path).
  - Query: `includeConfig=0|1` (default `1`). Use `includeConfig=0` for lightweight list UIs that lazy-load config per selected instance.

**Workspace-scoped endpoints (dev tooling + promotion):**

- `GET /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace` — Lists instances in a specific workspace (authenticated product path).
- `POST /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace` — Creates the instance in that workspace if missing; if the `publicId` already exists in the same workspace it returns the existing snapshot (idempotent). If the `publicId` exists in a _different_ workspace, returns 409 `PUBLIC_ID_CONFLICT`.
- `GET /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace` — Loads an instance only if it belongs to `workspaceId` (404 if not found).
- `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace` — Updates an instance only if it belongs to `workspaceId` (404 if not found). Supports user-instance `displayName` updates in addition to `config`/`status`.
- `POST /api/workspaces/:workspaceId/website-creative` — DevStudio-only local helper that ensures/opens a curated “website creative” instance for Prague blocks. Requires `subject=devstudio` and is **local-only** (`ENV_STAGE=local`).

### Identity bootstrap + MiniBob handoff (shipped)

- `POST /api/accounts` — Supabase-only account bootstrap endpoint. Requires `Idempotency-Key`; creates account row + bootstrap-owner marker (KV).
- `POST /api/accounts/:accountId/workspaces` — Supabase-only first-workspace (or additional workspace) create endpoint. Requires `Idempotency-Key`; accepts bootstrap-owner marker until first membership exists.
- `GET /api/roma/bootstrap` — Roma bootstrap endpoint that returns identity graph + active workspace defaults + signed authz context.
  - Workspace capsule header contract: `x-ck-authz-capsule`.
  - Account capsule header contract: `x-ck-account-capsule`.
  - Workspace capsule payload binds user/account/workspace/tier/role + authzVersion with short expiry (15 minutes).
  - Account capsule payload binds user/account/profile/role + authzVersion with short expiry (15 minutes).
  - Response includes account entitlement snapshot (`authz.entitlements`) so Roma domains can render policy context without additional workspace policy/entitlements round-trips.
- `POST /api/minibob/handoff/start` — Public handoff-start endpoint used by Prague server relay. Stores handoff snapshot state in KV and returns opaque `handoffId`.
  - Source lineage constraint: `publicId` must be a curated/base source (`wgt_main_*` or `wgt_curated_*`), never a user instance id.
  - Stored snapshot: resolved `widgetType` + JSON config + source public id + expiry.
- `POST /api/minibob/handoff/complete` — Supabase-only handoff completion endpoint. Requires `Idempotency-Key` + `handoffId`.
  - Completion reads stored handoff snapshot from KV and materializes one canonical user instance in target workspace.
  - Deterministic outcome: public id is derived from `handoffId`; replay returns the same builder route for the same user/account/workspace.

### Account asset endpoints (shipped)

- `GET /api/accounts/:accountId/assets` — Lists non-deleted assets for one account (`includeDeleted=1` optional for internal tooling).
  - `view=all` (default): entire account library.
  - `view=used_in_workspace&workspaceId=:workspaceId`: assets currently used by instances in that workspace.
  - `view=created_in_workspace&workspaceId=:workspaceId`: assets whose provenance `workspace_id` matches that workspace.
- `GET /api/accounts/:accountId/assets/:assetId` — Returns one account-owned asset with variant metadata (same optional `view/workspaceId` projection rules).
- `DELETE /api/accounts/:accountId/assets/:assetId` — Soft-deletes one account asset (`deleted_at` set); purge is handled by Tokyo Worker retention endpoint.

Rules:
- Product ownership boundary for assets is account (`accountId`).
- `workspace_id` on `account_assets` is provenance metadata only (`created_from_workspace`), not an ownership/read gate.
- Auth uses Supabase session JWT for product paths.
- Curated platform assets are owned by `PLATFORM_ACCOUNT_ID` and are excluded from customer quota views by default.
- Asset responses include deterministic usage mapping (`usageCount`, `usedBy[]`) from `account_asset_usage` with instance `publicId` + `configPath`.

### Curated vs user instance routing

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances`
- `wgt_*_u_*` → `widget_instances`

Curated writes are allowed only in **local** and **cloud-dev**. Production remains blocked.

**Validation contract (fail-fast):** before writing curated instances, Paris validates `widget_type` against the Tokyo widget registry (or cached manifest) and rejects unknown types.

### Entitlements + limits (usage-first; executed)

- Paris computes policy from `config/entitlements.matrix.json` using `subject` + `workspaces.tier`.
- Roma bootstrap resolves an account-level policy snapshot once per capsule window and returns it in `authz.entitlements`.
- On create/publish (and any config write), Paris loads `tokyo/widgets/{widget}/limits.json` and evaluates it via `@clickeen/ck-policy` to sanitize/reject violations deterministically.
- **Budgets are metered server-side** at the cost boundary (not “trust the browser”):
  - **AI**: Paris consumes budgets when issuing grants (ex: `budget.copilot.turns`, personalization budgets for onboarding agents).
  - **Localization**: Paris consumes `budget.l10n.publishes` on overlay publish actions.
  - **Snapshots**: Paris consumes `budget.snapshots.regens` when triggering published render snapshot regeneration.
  - **Uploads**: Tokyo-worker enforces `uploads.size.max` and consumes upload budgets on `/assets/upload`, keyed by account scope (`acct:<accountId>`).
  - **Views**: Venice `/embed/pixel` signs and forwards view events to Paris `POST /api/usage` (capped tiers only) → Frozen Billboard enforcement.
- Flags are intentionally minimal (currently only `branding.remove` is tiered).

### Localization (l10n) (Layered, canonical)

- Workspace **active locales** live in `workspaces.l10n_locales` (non‑EN; EN is implied).
- Layered endpoints (workspace-scoped, `subject` required):
  - `GET /api/workspaces/:workspaceId/instances/:publicId/layers?subject=devstudio|minibob|workspace`
  - `GET /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
  - `PUT /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
  - `DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
- L10n status + reporting:
  - `GET /api/workspaces/:workspaceId/instances/:publicId/l10n/status?subject=devstudio|minibob|workspace`
    - Read-only endpoint: never enqueues jobs and never mutates `l10n_generate_state`.
  - `POST /api/workspaces/:workspaceId/instances/:publicId/l10n/enqueue-selected?subject=devstudio|minibob|workspace` (manual enqueue for the workspace active locales set)
  - `GET /api/workspaces/:workspaceId/instances/:publicId/publish/status?subject=devstudio|minibob|workspace` (per-locale pipeline visibility: l10n state + snapshot pointer state)
    - Read-only endpoint: reports pipeline state only (no enqueue/no writes).
    - If a locale overlay already matches the current `baseFingerprint`, status treats that locale as `succeeded` even when historical state rows are missing.
    - Includes finite l10n buckets in `summary.l10n` / `pipeline.l10n` (`inFlight`, `retrying`, `failedTerminal`, `needsEnqueue`) so UIs can distinguish active work from stale/manual-action states.
    - `pipeline.l10n` also exposes `stageReasons` (count by blocker reason) and `nextAction` (explicit operator hint for DevStudio/Bob).
    - `stage=failed` is terminal (no `nextAttemptAt`); retry-scheduled failures remain `awaiting_l10n`.
  - `POST /api/l10n/jobs/report` (San Francisco → Paris job status updates)
- Canonical store: `widget_instance_overlays` (layer + layer_key).
- User overrides live in layer=user (layerKey=<locale>) with optional `global` fallback and are merged last at publish time.
- Publish/update triggers:
  - On **published instance save/update** (user and curated), Paris enqueues l10n jobs to `L10N_GENERATE_QUEUE`.
  - Paris mints a short-lived AI grant for `l10n.instance.v1` (10-minute TTL) and attaches `{ agentId, grant }` to each l10n job.
  - If enqueue/dispatch fails, the publish/update request fails (fail-fast to preserve overlay determinism).
  - Local dev: when `ENV_STAGE=local` and `SANFRANCISCO_BASE_URL` are set, Paris POSTs l10n jobs directly to San Francisco `/v1/l10n` (queue bypass).
  - Locale scope: workspace **active locales** from `workspaces.l10n_locales` (within cap) for both **user** and **curated** instances.
  - Paris persists job state in `l10n_generate_state` and retries `dirty/failed` rows via cron (skips locales no longer active; marks them `superseded`).
  - Cron also recovers stale in-flight rows (`queued`/`running` older than the staleness window) and re-queues them through the same finite retry budget.
  - Publish-triggered enqueue honors `failed.next_attempt_at` backoff (unless explicitly forced by tooling), avoiding self-trigger retry loops.
  - Queued/running l10n states that are stale for 10+ minutes may be re-queued on the next published instance update.
  - Paris stores allowlist snapshots in `l10n_base_snapshots`, diffs `changed_paths` + `removed_paths`, and rebases user overrides to the new fingerprint.
  - `baseFingerprint` is required on overlay writes; `baseUpdatedAt` is metadata only.
  - Overlay writes enqueue `L10N_PUBLISH_QUEUE` (layer + layerKey).
  - Tokyo-worker materializes overlays into Tokyo and writes per-fingerprint base snapshots (`tokyo/l10n/instances/<publicId>/bases/<baseFingerprint>.snapshot.json`) so Venice can safely apply stale locale overlays while async generation catches up.
  - Local dev: when `ENV_STAGE=local` and `TOKYO_WORKER_BASE_URL` are set, Paris also POSTs to tokyo-worker `/l10n/publish` to materialize overlays into `tokyo/l10n/**`.
  - Snapshot publish path is fail-fast: when Paris cannot enqueue `RENDER_SNAPSHOT_QUEUE`, publish/update returns an error instead of silently succeeding with stale embeds.
- Prague website strings use page JSON base copy plus Tokyo-hosted overlays (`tokyo/widgets/*/pages/*.json` + `tokyo/l10n/prague/**`) and do not go through Paris. Chrome UI strings remain in `prague/content/base/v1/chrome.json`.

# Paris — HTTP API Service (Phase-1)

## Purpose

Paris is Clickeen's server-side HTTP API service that handles all privileged operations requiring service-role access to Supabase. It runs on **Cloudflare Workers** and serves as the secure backend for Roma/Bob/DevStudio auth, workspace policy, widget instance management, and data operations.

## Deployment & Runtime

- **Platform**: Cloudflare Workers
- **Source Directory**: `paris`
- **Runtime**: Edge (V8 isolates)
- **Deploy Command**: `pnpm --filter @clickeen/paris deploy` (Wrangler bundles internally)
- **URL Pattern**: `https://paris.clickeen.com` (prod) / `https://paris.dev.clickeen.com` (cloud-dev)
- **Runtime deps**: `TOKYO_BASE_URL` is required for widget validation and limits; `TOKYO_WORKER_BASE_URL` is used only when `ENV_STAGE=local` to publish l10n overlays to tokyo-worker.

Fallback (when custom domains aren’t configured yet): `{script}.workers.dev`

## Security Boundaries

- **Service Role Access**: Paris has `SUPABASE_SERVICE_ROLE_KEY` and can bypass RLS. Handlers MUST scope service-role usage to the smallest set of operations and MUST never expose this key to clients.
- **No Public Secrets**: All server secrets live here, never exposed to client. Environment variables MUST remain server-only.
- **Auth model (this repo snapshot):** non-public product endpoints require Supabase session JWT auth. `GET /api/instance/:publicId` is public and published-only for user-owned instances.
- **Local auth alignment:** `scripts/dev-up.sh` uses local Supabase by default; if you switch to remote Supabase (`DEV_UP_USE_REMOTE_SUPABASE=1`), all local product tokens must come from that same remote issuer.
- **Rate limiting:** Not implemented in this repo snapshot (planned for write endpoints once usage/submissions ship).
- **Front-door rule:** Third-party pages MUST NOT contact Paris directly. Browsers hit Venice only; Venice proxies to Paris over a server-to-server channel.
- **CORS:** Intended production rule is an allowlist (Bob/Prague only). In this repo snapshot, treat Supabase auth enforcement as the primary gate.
- **Transport Security**: Paris MUST enforce HTTPS, HSTS, and reject plaintext HTTP. Mutual TLS is not required but outbound fetches MUST verify certificates.

## Phase-1 API Endpoints

### Widget Definitions (Non-Paris)

Paris does **not** serve widget definitions. Widget definitions (“Widget JSON”) live in **Tokyo/CDN**.

- Source in-repo: `tokyo/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md` plus contract files (`limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`)
- Paris does expose an authenticated widget catalog for tooling: `GET /api/widgets` → `{ widgets: [{ type, name }] }` (this is _metadata_, not the widget definition).
- Bob compiles widget specs for the editor via `GET /api/widgets/[widgetname]/compiled` (Bob app, not Paris)
- Venice embed rendering should load widget runtime assets from Tokyo; Venice currently fetches the instance snapshot from Paris via `/api/instance/:publicId?subject=venice` (public; user-owned is published-only). Editor/dev tooling uses the workspace-scoped endpoints.

### AI Gateway (Grants + Outcomes) (shipped in dev/local)

Paris is the **product authority** and issues short-lived signed grants for AI execution. Paris does **not** call LLM providers; it mints grants and forwards outcomes.

#### `POST /api/ai/grant`

Issues an **AI Grant** that San Francisco can verify and execute under.

Current repo behavior:

- **Auth:** requires `Authorization: Bearer <Supabase session JWT>` on product paths (Bob/Roma proxy-forwarded).
- **Agent registry:** only known `agentId`s are accepted (registry-backed, with alias support; canonical IDs returned).
- **Policy context:** `subject` + `workspaceId` determine the policy profile (defaults to `minibob` when missing).
- **Widget-copilot canonicalization:** for `widget.copilot.v1`, `sdr.widget.copilot.v1`, and `cs.widget.copilot.v1`, Paris resolves to policy-safe canonical IDs:
  - `minibob|free` -> `sdr.widget.copilot.v1`
  - `tier1|tier2|tier3|devstudio` -> `cs.widget.copilot.v1`
- **Tiered Access (PRD 041):** Paris resolves `workspaces.tier` to an `AiProfile` (e.g., `free_low`, `paid_standard`, `paid_premium`, `curated_premium`) and stamps it into the grant.
- **Budgets are derived from policy** and capped server-side (tokens/timeout/requests) to keep the edge path safe.
- **AI policy capsule:** grants include `ai.profile` + `ai.allowedProviders` for SF enforcement.
- `trace.envStage` is stamped from `ENV_STAGE` (used by San Francisco learning indexes).

Request:

```json
{
  "agentId": "widget.copilot.v1",
  "mode": "ops",
  "trace": { "sessionId": "anon", "instancePublicId": "wgt_..." },
  "subject": "workspace",
  "workspaceId": "uuid",
  "budgets": { "maxTokens": 420, "timeoutMs": 25000, "maxRequests": 2 }
}
```

Response:

```json
{
  "grant": "v1....",
  "exp": 1735521234,
  "agentId": "cs.widget.copilot.v1",
  "ai": {
    "profile": "paid_premium",
    "allowedProviders": ["deepseek", "openai", "anthropic", "groq", "amazon"]
  }
}
```

#### `POST /api/ai/minibob/session`

Public Minibob session mint. Returns a short-lived, server-signed `sessionToken` so the grant mint cannot be driven by infinite client-generated `sessionId`s.

Current repo behavior:

- **Auth:** public (no `PARIS_DEV_JWT` required).
- **Signing secret:** requires `AI_GRANT_HMAC_SECRET`.
- **TTL:** ~1 hour.

Response:

```json
{ "sessionToken": "minibob.v1.<issuedAt>.<nonce>.<sig>", "exp": 1735524834 }
```

#### `POST /api/ai/minibob/grant`

Public Minibob grant mint with strict, server-owned policy gates.

Current repo behavior:

- **Auth:** public (no `PARIS_DEV_JWT` required).
- **Required inputs:** `sessionToken`, `sessionId`, `widgetType`.
- **Server enforcement:** `subject=minibob`, `agentId=sdr.widget.copilot.v1`, `mode=ops`.
- **Session verification:** `sessionToken` signature + TTL are verified before minting.
- **Budgets:** fixed clamps for Minibob (`maxTokens=420`, `timeoutMs=12000`, `maxRequests=2`).  
  Local dev exception: `timeoutMs=45000`, `maxTokens=650` to avoid local LLM timeouts.
- **Rate limiting:** two KV counters (session/minute + session/hour). Per-IP abuse controls for the public session mint are handled at the edge (WAF/rate limits), since grant requests may be proxied through Bob.
- **Throttle errors:**
  - `coreui.errors.ai.minibob.rateLimited` (HTTP 429)
  - `coreui.errors.ai.minibob.ratelimitUnavailable` (HTTP 503)

Required env vars:

- `AI_GRANT_HMAC_SECRET` (secret): used to sign grants
- `ENV_STAGE` (string): `local|cloud-dev|uat|limited-ga|ga` (used for learning attribution)
- `MINIBOB_RATELIMIT_KV` (KV binding): required for enforced Minibob throttling outside `local`/`cloud-dev`
- `MINIBOB_RATELIMIT_MODE` (optional): `off|log|enforce` (stage defaults: `local=off`, `cloud-dev=log`, others=`enforce`)

### Personalization Preview (acquisition, async)

- `POST /api/personalization/preview` — issues a preview grant and creates a SF job; returns `jobId`.
- `GET /api/personalization/preview/:jobId` — polls SF for status/result.
- Paris is the public entrypoint; SF stores job state in KV and executes the agent.

### Personalization Onboarding (workspace, async)

- `POST /api/personalization/onboarding` — issues an onboarding grant and creates a SF job; returns `jobId`.
- `GET /api/personalization/onboarding/:jobId` — polls SF for status/result.
- On success, SF persists the workspace business profile in `workspace_business_profiles`.
- `GET /api/workspaces/:workspaceId/business-profile` returns the stored profile (authenticated product path).
- `POST /api/workspaces/:workspaceId/business-profile` upserts the profile (internal; used by SF).

#### `POST /api/ai/outcome`

Forwards an outcome event to San Francisco `/v1/outcome` with a signed `x-paris-signature`.

Current repo behavior:

- **Auth:** requires `Authorization: Bearer <Supabase session JWT>` on product paths (Bob/Roma proxy-forwarded).
- Validates payload shape and event enum.
- Computes signature: `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`.
- Forwards to: `${SANFRANCISCO_BASE_URL}/v1/outcome`.

Request:

```json
{
  "requestId": "uuid",
  "sessionId": "anon",
  "event": "ux_keep",
  "occurredAtMs": 1735521234567,
  "timeToDecisionMs": 1200
}
```

Required env vars:

- `SANFRANCISCO_BASE_URL` (string): base URL for the San Francisco Worker
- `AI_GRANT_HMAC_SECRET` (secret): used to sign the forwarded outcome payload

### Instance Management (Phase-1)

`publicId` in every payload maps 1:1 to `widget_instances.public_id`; each instance row also references its parent widget via `widget_instances.widget_id → widgets.id`. Widget type is `widgets.type` (surfaced as `widgetType`).

- `POST /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace`
  - Authenticated product endpoint (superadmin key required only when Bob is configured to enforce it).
  - Accepts `{ widgetType, publicId, config, status?, displayName?, meta? }` with curated/user validation by `publicId` kind.
- `GET /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace`
  - Lists workspace-owned user instances for tooling/editor flows.
- `GET /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace`
  - Returns scoped editor snapshot; 404 when the instance does not belong to the workspace.
- `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace`
  - Updates scoped instance `config`/`status` and user-instance `displayName`.
- `GET /api/instance/:publicId`
  - Loads the latest instance snapshot. Public read only returns published user-owned rows (curated rows remain public).
  - _Example response (200):_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "published",
      "widgetType": "faq",
      "config": {
        "title": "Frequently Asked Questions",
        "categories": [...]
      },
      "updatedAt": "2025-09-28T19:15:03.000Z"
    }
    ```
- _Example validation error (422):_

  ```http
  PUT /api/workspaces/11111111-1111-1111-1111-111111111111/instance/wgt_42yx31?subject=workspace
  Authorization: Bearer <Supabase session JWT>
  Content-Type: application/json

  { "status": "archived" }
  ```

  ```json
  [{ "path": "status", "message": "invalid status" }]
  ```

  - _Example response (200):_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "published",
      "widgetType": "faq",
      "config": {
        "title": "Frequently Asked Questions",
        "categories": [...]
      },
      "updatedAt": "2025-09-28T19:16:44.000Z"
    }
    ```

**Canonical instance payload (`GET /api/instance/:publicId`, `GET/PUT /api/workspaces/:workspaceId/instance/:publicId`)**

```json
{
  "publicId": "wgt_42yx31",
  "displayName": "Main FAQ",
  "status": "published",
  "widgetType": "faq",
  "config": {
    "title": "Frequently Asked Questions",
    "categories": [...]
  },
  "updatedAt": "2025-09-28T19:15:03.000Z"
}
```

**API ↔ DB mapping (Phase-1)**
| API field | DB column/property |
| --- | --- |
| `publicId` | `widget_instances.public_id` |
| `displayName` | `widget_instances.display_name` (fallback: `public_id`) |
| `status` | `widget_instances.status` |
| `widgetType` | `widgets.type` (via `widget_instances.widget_id → widgets.id`) |
| `config` | `widget_instances.config` (JSONB column with user's custom values) |
| `updatedAt` | `widget_instances.updated_at` |

**publicId generation (Phase-1)**

- `publicId` is provided by the caller (internal services / DevStudio Local superadmin flows) and persisted in Michael.
- The stable contract is `widget_instances.public_id` + `widget_instances.config` (+ `workspace_id`), not internal UUIDs.

Notes:

- Locale is a **runtime parameter** (handled by Venice overlays); it must not be encoded into `publicId`.

### Usage & submissions (not shipped here)

### Usage (Shipped: PRD 37 metering)

`POST /api/usage` accepts a signed view event from Venice:

```json
{ "publicId": "wgt_...", "event": "view", "tier": "free|tier1|...", "sig": "<hmac>" }
```

**Behavior (v1):**

- Only capped tiers are counted (`free`, `tier1`). Other tiers are treated as unlimited and skipped.
- Counts monthly views in `USAGE_KV`. On first overage view (`next > cap`), Paris marks the instance as frozen:
  - Upserts `instance_enforcement_state` with `{ mode: "frozen", period_key, frozen_at, reset_at }`
  - Enqueues a PRD 38 render snapshot regen for `locales: ["en"]` (Frozen Billboard contract: base locale only)

**Requirements:**

- `USAGE_EVENT_HMAC_SECRET` (shared secret with Venice)
- `USAGE_KV` binding (KV namespace for view counters + frozen markers)

### Submissions (Not Shipped Here)

- `POST /api/submit/:publicId` exists only as an explicit `501 NOT_IMPLEMENTED` placeholder in this repo snapshot.

### Health & System (Phase-1)

#### `GET /api/healthz`

**Purpose**: Simple health check  
**Auth**: None (public)  
**Returns**:

```json
{
  "up": true
}
```

**Status**: Always `200` when the worker is up.

### Privacy, Rate Limiting, Submissions (Not Shipped Here)

- `POST /api/submit/:publicId` exists only as an explicit `501 NOT_IMPLEMENTED` placeholder in this repo snapshot.
- Document token flows, event storage tables, and rate-limit behavior as “shipped” only once the endpoints exist and `supabase/migrations/` includes the authoritative schema.

## Database Integration (This Repo Snapshot)

Paris uses Supabase REST with the service role key for reads/writes to Michael.

```ts
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
```

### Tables Used (This Repo Snapshot)

- `widgets`
- `widget_instances`

## Integration Contracts (This Repo Snapshot)

### Venice

- Venice calls `GET /api/instance/:publicId` to load `widgetType`, `status`, and `config`.
- Widget definitions/assets are loaded from Tokyo (outside Paris).

### Bob

- `GET /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` on mount (load)
- `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` on publish
- `POST /api/workspaces/:workspaceId/instances?subject=devstudio` supports DevStudio Local create/ensure flows (superadmin key only when enforced)

## Errors (This Repo Snapshot)

- Auth failures: `401` with `{ "error": "AUTH_REQUIRED" }`
- Not found: `404` with `{ "error": "NOT_FOUND" }`
- Validation: `422` with `[{ "path": "...", "message": "..." }]`
- Not implemented: `501` with `{ "error": "NOT_IMPLEMENTED" }` (submissions)

For exact response shapes and status codes, inspect `paris/src/index.ts`.
