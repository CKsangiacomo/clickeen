STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes the intended Paris responsibilities and APIs.
Runtime code + `supabase/migrations/` are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

## AIs Quick Scan

**Purpose:** Phase-1 HTTP API (instances) + AI grant/outcome gateway + metering enforcement (usage is shipped; submissions are placeholders in this repo snapshot).
**Owner:** Cloudflare Workers (`paris`).
**Dependencies:** Michael (Postgres via Supabase REST), San Francisco (AI execution).
**Shipped Endpoints (this repo snapshot):** `GET /api/healthz`, `GET /api/instances` (dev tooling), `GET /api/curated-instances` (curated listing), `GET /api/workspaces/:workspaceId/instances/:publicId/layers?subject=devstudio|minibob|workspace`, `GET/PUT/DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`, `GET /api/workspaces/:workspaceId/instances/:publicId/l10n/status?subject=devstudio|minibob|workspace`, `POST /api/l10n/jobs/report`, `POST /api/instance` (internal create), `GET/PUT /api/instance/:publicId` (public, published-only unless dev auth), `GET/POST /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace`, `GET/PUT /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace`, `GET/PUT /api/workspaces/:workspaceId/locales`, `GET/POST /api/workspaces/:workspaceId/business-profile`, `POST /api/ai/grant`, `POST /api/ai/minibob/session`, `POST /api/ai/minibob/grant`, `POST /api/ai/outcome`, `POST /api/personalization/preview`, `GET /api/personalization/preview/:jobId`, `POST /api/personalization/onboarding`, `GET /api/personalization/onboarding/:jobId`, `POST /api/usage` (metering; HMAC-signed), `POST /api/submit/:publicId` (501).
**Database Tables (this repo snapshot):** `widgets`, `widget_instances`, `curated_widget_instances`, `workspaces`, `widget_instance_overlays`, `l10n_generate_state`, `l10n_base_snapshots`, `workspace_business_profiles`, `instance_enforcement_state`.
**Key constraints:** instance config is stored verbatim (JSON object required); status is `published|unpublished`; all non-public endpoints are gated by `PARIS_DEV_JWT` (public `/api/instance/:publicId` is published-only unless dev auth is present).

## Runtime Reality (this repo snapshot)

Paris in this repo is a **dev-focused Worker** with a deliberately small surface:
- **Modular monolith:** Paris is organized by domain modules under `paris/src/domains/*` with shared utilities in `paris/src/shared/*`. It is a single Worker (no worker-to-worker microservices).
- All non-public endpoints are gated by `PARIS_DEV_JWT` (dev-only auth; not the final production model). `GET /api/instance/:publicId` is public but published-only unless a valid dev token is supplied.
- Instance creation is implemented (`POST /api/instance`) for **internal DevStudio Local** workflows (superadmin), not as a user-facing product API.
- Instance reads/writes use Supabase REST with the service role.
- Paris requires `TOKYO_BASE_URL` to validate widget types and load widget `limits.json`.
- AI is handled via:
  - `POST /api/ai/grant` (mint short-lived signed grants)
  - `POST /api/ai/outcome` (forward outcome events to San Francisco `/v1/outcome`)

If you need the exact shipped behavior, inspect `paris/src/index.ts`.

### 🔑 CRITICAL: Bob's Two-API-Call Pattern (NEW ARCHITECTURE)

**Bob makes EXACTLY 2 calls to Paris per editing session for core instance config:**

1. **Load** - `GET /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` when Bob mounts → gets instance snapshot (`config` + `status`)
2. **Publish** - `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` when user clicks Publish → saves working copy

`subject` is required on workspace endpoints (`workspace`, `devstudio`, `minibob`) to resolve policy.

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
- Paris expects `GET` once on mount, `PUT` once on publish
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
- `GET /api/instance/:publicId` — Public, published-only unless dev auth is present (Venice typically passes `?subject=venice` for telemetry).
- `PUT /api/instance/:publicId` — Updates instance `config`/`status` (dev auth in this repo snapshot; production will be workspace-auth)
- `GET /api/instances` — Dev tooling list (requires dev auth)
- `GET /api/curated-instances` — Curated/baseline list (requires dev auth)
- `POST /api/instance` — Creates the instance if missing; otherwise returns the existing snapshot (idempotent)

**Workspace-scoped endpoints (dev tooling + promotion):**
- `GET /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace` — Lists instances in a specific workspace (requires dev auth).
- `POST /api/workspaces/:workspaceId/instances?subject=devstudio|minibob|workspace` — Creates the instance in that workspace if missing; if the `publicId` already exists in the same workspace it returns the existing snapshot (idempotent). If the `publicId` exists in a *different* workspace, returns 409 `PUBLIC_ID_CONFLICT`.
- `GET /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace` — Loads an instance only if it belongs to `workspaceId` (404 if not found).
- `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=devstudio|minibob|workspace` — Updates an instance only if it belongs to `workspaceId` (404 if not found).

### Curated vs user instance routing

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances`
- `wgt_*_u_*` → `widget_instances`

Curated writes are gated by `PARIS_DEV_JWT` and allowed only in **local** and **cloud-dev**. Production remains blocked.

**Validation contract (fail-fast):** before writing curated instances, Paris validates `widget_type` against the Tokyo widget registry (or cached manifest) and rejects unknown types.

### Entitlements + limits (usage-first; executed)
- Paris computes policy from `config/entitlements.matrix.json` using `subject` + `workspaces.tier`.
- On create/publish (and any config write), Paris loads `tokyo/widgets/{widget}/limits.json` and evaluates it via `@clickeen/ck-policy` to sanitize/reject violations deterministically.
- **Budgets are metered server-side** at the cost boundary (not “trust the browser”):
  - **AI**: Paris consumes budgets when issuing grants (ex: `budget.copilot.turns`, personalization budgets for onboarding agents).
  - **Localization**: Paris consumes `budget.l10n.publishes` on overlay publish actions.
  - **Snapshots**: Paris consumes `budget.snapshots.regens` when triggering published render snapshot regeneration.
  - **Uploads**: Tokyo-worker enforces `uploads.size.max` and consumes `budget.uploads.count` on `/workspace-assets/upload`.
  - **Views**: Venice `/embed/pixel` signs and forwards view events to Paris `POST /api/usage` (capped tiers only) → Frozen Billboard enforcement.
- Flags are intentionally minimal (currently only `branding.remove` is tiered).

### Localization (l10n) (Layered, canonical)
- Workspace locale selection lives in `workspaces.l10n_locales`.
- Layered endpoints (workspace-scoped, `subject` required):
  - `GET /api/workspaces/:workspaceId/instances/:publicId/layers?subject=devstudio|minibob|workspace`
  - `GET /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
  - `PUT /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
  - `DELETE /api/workspaces/:workspaceId/instances/:publicId/layers/:layer/:layerKey?subject=devstudio|minibob|workspace`
- L10n status + reporting:
  - `GET /api/workspaces/:workspaceId/instances/:publicId/l10n/status?subject=devstudio|minibob|workspace`
  - `POST /api/l10n/jobs/report` (San Francisco → Paris job status updates)
- Canonical store: `widget_instance_overlays` (layer + layer_key).
- User overrides live in layer=user (layerKey=<locale>) with optional `global` fallback and are merged last at publish time.
- Publish/update triggers:
  - On instance create/update, Paris enqueues l10n jobs to `L10N_GENERATE_QUEUE`.
  - Paris mints a short-lived AI grant for `l10n.instance.v1` (10-minute TTL) and attaches `{ agentId, grant }` to each l10n job.
  - If enqueue/dispatch fails, the publish/update request fails (fail-fast to preserve overlay determinism).
  - Local dev: when `ENV_STAGE=local` and `SANFRANCISCO_BASE_URL` are set, Paris POSTs l10n jobs directly to San Francisco `/v1/l10n` (queue bypass).
  - Curated instances → all supported locales.
  - User instances → `workspaces.l10n_locales` (within cap).
  - Paris persists job state in `l10n_generate_state` and retries `dirty/failed` rows via cron.
  - Queued/running l10n states that are stale for 10+ minutes are re-queued on the next instance update/promote.
  - Paris stores allowlist snapshots in `l10n_base_snapshots`, diffs `changed_paths` + `removed_paths`, and rebases user overrides to the new fingerprint.
  - `baseFingerprint` is required on overlay writes; `baseUpdatedAt` is metadata only.
  - Overlay writes enqueue `L10N_PUBLISH_QUEUE` (layer + layerKey).
  - Local dev: when `ENV_STAGE=local` and `TOKYO_WORKER_BASE_URL` are set, Paris also POSTs to tokyo-worker `/l10n/publish` to materialize overlays into `tokyo/l10n/**`.
- Prague website strings use page JSON base copy plus Tokyo-hosted overlays (`tokyo/widgets/*/pages/*.json` + `tokyo/l10n/prague/**`) and do not go through Paris. Chrome UI strings remain in `prague/content/base/v1/chrome.json`.

# Paris — HTTP API Service (Phase-1)

## Purpose
Paris is Clickeen's server-side HTTP API service that handles all privileged operations requiring service-role access to Supabase. It runs on **Cloudflare Workers** and serves as the secure backend for Bob (builder app), authentication flows, widget instance management, and data operations.

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
- **Auth model (this repo snapshot):** All current non-public endpoints are gated by `PARIS_DEV_JWT` (dev/local only). `GET /api/instance/:publicId` is public but published-only unless a valid dev token is supplied. Production will validate Supabase Auth JWTs and workspace membership.
- **Rate limiting:** Not implemented in this repo snapshot (planned for write endpoints once usage/submissions ship).
- **Front-door rule:** Third-party pages MUST NOT contact Paris directly. Browsers hit Venice only; Venice proxies to Paris over a server-to-server channel.
- **CORS:** Intended production rule is an allowlist (Bob/Prague only). In this repo snapshot, treat `PARIS_DEV_JWT` as the primary gate.
- **Transport Security**: Paris MUST enforce HTTPS, HSTS, and reject plaintext HTTP. Mutual TLS is not required but outbound fetches MUST verify certificates.

## Phase-1 API Endpoints

### Widget Definitions (Non-Paris)

Paris does **not** serve widget definitions. Widget definitions (“Widget JSON”) live in **Tokyo/CDN**.

- Source in-repo: `tokyo/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md` plus contract files (`limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`)
- Bob compiles widget specs for the editor via `GET /api/widgets/[widgetname]/compiled` (Bob app, not Paris)
- Venice embed rendering should load widget runtime assets from Tokyo; Venice currently fetches the instance snapshot from Paris via `/api/instance/:publicId?subject=venice` (public, published-only unless dev auth). Editor/dev tooling uses the workspace-scoped endpoints.

### AI Gateway (Grants + Outcomes) (shipped in dev/local)

Paris is the **product authority** and issues short-lived signed grants for AI execution. Paris does **not** call LLM providers; it mints grants and forwards outcomes.

#### `POST /api/ai/grant`
Issues an **AI Grant** that San Francisco can verify and execute under.

Current repo behavior:
- **Auth (dev/local only):** requires `Authorization: Bearer ${PARIS_DEV_JWT}`.
- **Agent registry:** only known `agentId`s are accepted (registry-backed, with alias support; canonical IDs returned).
- **Policy context:** `subject` + `workspaceId` determine the policy profile (defaults to `minibob` when missing).
- **Budgets are derived from policy** and capped server-side (tokens/timeout/requests) to keep the edge path safe.
- **AI policy capsule:** grants include `ai.profile` + `ai.allowedProviders` for SF enforcement.
- `trace.envStage` is stamped from `ENV_STAGE` (used by San Francisco learning indexes).

Request:
```json
{
  "agentId": "sdr.widget.copilot.v1",
  "mode": "ops",
  "trace": { "sessionId": "anon", "instancePublicId": "wgt_..." },
  "subject": "workspace",
  "workspaceId": "uuid",
  "budgets": { "maxTokens": 420, "timeoutMs": 25000, "maxRequests": 2 }
}
```

Response:
```json
{ "grant": "v1....", "exp": 1735521234, "agentId": "sdr.widget.copilot.v1" }
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
- **Rate limiting:** two KV counters (fingerprint/minute + session/hour).
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
- `GET /api/workspaces/:workspaceId/business-profile` returns the stored profile (dev auth required).
- `POST /api/workspaces/:workspaceId/business-profile` upserts the profile (internal; used by SF).

#### `POST /api/ai/outcome`
Forwards an outcome event to San Francisco `/v1/outcome` with a signed `x-paris-signature`.

Current repo behavior:
- **Auth (dev/local only):** requires `Authorization: Bearer ${PARIS_DEV_JWT}`.
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

- `POST /api/instance`
  - Internal DevStudio Local superadmin endpoint (requires dev auth). Creates the widget row if missing and then creates the instance row.
  - Accepts `{ widgetType, publicId, workspaceId, config, status?, widgetName? }`.
- `GET /api/instances`
  - Dev tooling list (requires dev auth). Typically called with `?workspaceId=<uuid>`.
- `GET /api/instance/:publicId`
  - Loads the latest instance snapshot (dev auth in this repo snapshot). Returns 200 payload or 404 `NOT_FOUND`.
  - _Example response (200):_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "unpublished",
      "widgetType": "faq",
      "config": {
        "title": "Frequently Asked Questions",
        "categories": [...]
      },
      "updatedAt": "2025-09-28T19:15:03.000Z"
    }
    ```
- `PUT /api/instance/:publicId`
  - Updates `config` and/or `status` (dev auth in this repo snapshot). Returns 200 payload, 404 if missing, 422 on validation errors.
- _Example validation error (422):_
    ```http
    PUT /api/instance/wgt_42yx31
    Authorization: Bearer <PARIS_DEV_JWT>
    Content-Type: application/json

    { "status": "archived" }
    ```
    ```json
    [ { "path": "status", "message": "invalid status" } ]
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

**Canonical instance payload (GET/PUT `/api/instance/:publicId`)**
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

**API ↔ DB mapping (Phase-1)**
| API field | DB column/property |
| --- | --- |
| `publicId` | `widget_instances.public_id` |
| `status` | `widget_instances.status` |
| `widgetType` | `widgets.type` (via `widget_instances.widget_id → widgets.id`) |
| `config` | `widget_instances.config` (JSONB column with user's custom values) |
| `updatedAt` | `widget_instances.updated_at` |

**publicId generation (Phase-1)**
- `publicId` is provided by the caller (internal services / DevStudio Local superadmin flows) and persisted in Michael.
- The stable contract is `widget_instances.public_id` + `widget_instances.config` (+ `workspace_id`), not internal UUIDs.

Notes:
- Locale is a **runtime parameter** (handled by Venice overlays); it must not be encoded into `publicId`.
- Cloud-dev should be updated via DevStudio’s “promote instance” path (direct upsert), not by calling this local-only endpoint.

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
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### Tables Used (This Repo Snapshot)
- `widgets`
- `widget_instances`

## Integration Contracts (This Repo Snapshot)

### Venice
- Venice calls `GET /api/instance/:publicId` to load `widgetType`, `status`, and `config`.
- Widget definitions/assets are loaded from Tokyo (outside Paris).

### Bob
- `GET /api/instance/:publicId` on mount (load)
- `PUT /api/instance/:publicId` on publish
- `POST /api/instance` exists for DevStudio Local superadmin flows (idempotent create-or-get; requires dev auth)

## Errors (This Repo Snapshot)

- Auth failures: `401` with `{ "error": "AUTH_REQUIRED" }` (dev/local gate)
- Not found: `404` with `{ "error": "NOT_FOUND" }`
- Validation: `422` with `[{ "path": "...", "message": "..." }]`
- Not implemented: `501` with `{ "error": "NOT_IMPLEMENTED" }` (submissions)

For exact response shapes and status codes, inspect `paris/src/index.ts`.
