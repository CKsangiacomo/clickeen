STATUS: REFERENCE — LIVING DOC (MAY DRIFT)
This document describes the intended Paris responsibilities and APIs.
When debugging reality, treat runtime code, `supabase/migrations/`, and deployed Cloudflare config as truth.
If you find a mismatch, update this document; execution continues even if docs drift.

## AIs Quick Scan

**Purpose:** Phase-1 HTTP API (instances) + AI grant/outcome gateway (usage/submissions are placeholders in this repo snapshot).
**Owner:** Cloudflare Workers (`paris`).
**Dependencies:** Michael (Postgres via Supabase REST), San Francisco (AI execution).
**Shipped Endpoints (this repo snapshot):** `GET /api/healthz`, `GET /api/instances` (dev tooling), `GET /api/curated-instances` (curated listing), `GET /api/instances/:publicId/locales`, `GET/PUT/DELETE /api/instances/:publicId/locales/:locale`, `POST /api/instance` (internal create), `GET/PUT /api/instance/:publicId`, `GET/POST /api/workspaces/:workspaceId/instances`, `GET/PUT /api/workspaces/:workspaceId/instance/:publicId`, `GET/PUT /api/workspaces/:workspaceId/locales`, `POST /api/workspaces/:workspaceId/website-creative` (local-only), `POST /api/ai/grant`, `POST /api/ai/outcome`, `POST /api/usage` (501), `POST /api/submit/:publicId` (501).
**Database Tables (this repo snapshot):** `widgets`, `widget_instances`, `curated_widget_instances`.
**Key constraints:** instance config is stored verbatim (JSON object required); status is `published|unpublished`; all current endpoints are gated by `PARIS_DEV_JWT`.

## Runtime Reality (this repo snapshot)

Paris in this repo is a **dev-focused Worker** with a deliberately small surface:
- All current endpoints are gated by `PARIS_DEV_JWT` (dev-only auth; not the final production model).
- Instance creation is implemented (`POST /api/instance`) for **internal DevStudio Local** workflows (superadmin), not as a user-facing product API.
- Instance reads/writes use Supabase REST with the service role.
- AI is handled via:
  - `POST /api/ai/grant` (mint short-lived signed grants)
  - `POST /api/ai/outcome` (forward outcome events to San Francisco `/v1/outcome`)

If you need the exact shipped behavior, inspect `paris/src/index.ts`.

### 🔑 CRITICAL: Bob's Two-API-Call Pattern (NEW ARCHITECTURE)

**Bob makes EXACTLY 2 calls to Paris per editing session:**

1. **Load** - `GET /api/workspaces/:workspaceId/instance/:publicId` when Bob mounts → gets instance snapshot (`config` + `status`)
2. **Publish** - `PUT /api/workspaces/:workspaceId/instance/:publicId` when user clicks Publish → saves working copy

**Between load and publish:**
- User edits in ToolDrawer → Bob updates React state (NO API calls to Paris)
- Bob sends updated config to preview via postMessage (NO API calls to Paris)
- Preview updates in real-time (NO API calls to Paris)
- ZERO database writes

**Why This Matters:**
- **Scalability:** 10,000 users editing simultaneously → no server load, all edits in memory
- **Database cost savings:** Only published widgets stored → no database pollution from abandoned edits
- **Landing page demos:** Millions of visitors playing with widgets → ZERO database writes until they sign up and publish

**For Paris:**
- Paris expects `GET` once on mount, `PUT` once on publish
- No intermediate saves, no auto-save during editing
- Database only stores published widgets users actually care about

See [Bob Architecture](./bob.md) and [Widget Architecture](../widgets/WidgetArchitecture.md) for complete details.

### 🔒 CRITICAL: Widget Definition vs Instance

**Paris manages INSTANCES, NOT widget definitions.**

**Widget Definition** (a.k.a. “Widget JSON”) **= THE SOFTWARE** (Tokyo/CDN):
- Platform-controlled widget spec + runtime assets
- In-repo source: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- **NOT stored in Michael**
- **NOT served by Paris**

**Widget Instance config = THE DATA** (Michael tables: `widget_instances`, `curated_widget_instances`, `widgets`):
- User instance config lives in `widget_instances.config` (workspace-owned)
- Curated/baseline config lives in `curated_widget_instances.config` (Clickeen-authored)
- Curated uses `widget_type` (denormalized) instead of `widget_id`
- **EDITABLE by users** (user instances via Bob → Paris `PUT /api/workspaces/:workspaceId/instance/:publicId`)

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
- `GET /api/instance/:publicId` — Loads the instance snapshot (config + metadata)
- `PUT /api/instance/:publicId` — Updates instance `config`/`status` (dev auth in this repo snapshot; production will be workspace-auth)
- `GET /api/instances` — Dev tooling list (requires dev auth)
- `GET /api/curated-instances` — Curated/baseline list (requires dev auth)
- `POST /api/instance` — Creates the instance if missing; otherwise returns the existing snapshot (idempotent)

**Workspace-scoped endpoints (dev tooling + promotion):**
- `GET /api/workspaces/:workspaceId/instances` — Lists instances in a specific workspace (requires dev auth).
- `POST /api/workspaces/:workspaceId/instances` — Creates the instance in that workspace if missing; if the `publicId` already exists in the same workspace it returns the existing snapshot (idempotent). If the `publicId` exists in a *different* workspace, returns 409 `PUBLIC_ID_CONFLICT`.
- `GET /api/workspaces/:workspaceId/instance/:publicId` — Loads an instance only if it belongs to `workspaceId` (404 if not found).
- `PUT /api/workspaces/:workspaceId/instance/:publicId` — Updates an instance only if it belongs to `workspaceId` (404 if not found).
- `POST /api/workspaces/:workspaceId/website-creative` — Ensures a website creative exists for that workspace (intentionally **local-only**; not a cloud-dev workflow).

### Curated vs user instance routing

- `wgt_main_*` and `wgt_curated_*` → `curated_widget_instances`
- `wgt_*_u_*` → `widget_instances`

Curated writes are gated by `PARIS_DEV_JWT` and allowed only in **local** and **cloud-dev** (one-way publish from local to cloud-dev). Production remains blocked.

**Validation contract (fail-fast):** before writing curated instances, Paris validates `widget_type` against the Tokyo widget registry (or cached manifest) and rejects unknown types.

### Entitlements + limits (v1)
- Paris computes entitlements from `config/entitlements.matrix.json` using `subject` + `workspaces.tier`.
- On create/publish, Paris loads `tokyo/widgets/{widget}/limits.json` and rejects configs that violate caps/flags.
- Budgets are per-session and enforced in Bob; Paris only enforces caps/flags at the product boundary.

### Localization (l10n) (V0)
- Workspace locale selection lives in `workspaces.l10n_locales`.
- Endpoints:
  - `GET /api/workspaces/:workspaceId/locales`
  - `PUT /api/workspaces/:workspaceId/locales` (entitlement gated via `l10n.enabled` + `l10n.locales.max`)
  - `GET /api/instances/:publicId/locales` (lists locales + `hasUserOps`)
  - `GET /api/instances/:publicId/locales/:locale` (single-locale overlay for preview/debug; returns `ops` + `userOps`)
  - `PUT /api/instances/:publicId/locales/:locale` (write `ops` or `userOps`; preserves `userOps` on agent updates)
  - `DELETE /api/instances/:publicId/locales/:locale` (clears `userOps` and re-publishes)
- Publish/update trigger:
  - On instance create/update, Paris enqueues l10n jobs to `L10N_GENERATE_QUEUE`.
  - Queue names follow `instance-l10n-generate-{env}` and `instance-l10n-publish-{env}` (`local`, `cloud-dev`, `prod`).
  - Curated instances → all supported locales.
  - User instances → `workspaces.l10n_locales` (within cap).
  - `baseFingerprint` is required on overlay writes; `baseUpdatedAt` is metadata only.
  - Instance locale overlays (`PUT/DELETE /api/instances/:publicId/locales/:locale`) enqueue `L10N_PUBLISH_QUEUE`.
  - Per-field manual overrides live in `widget_instance_locales.user_ops`; agent writes update `ops` only.
  - Local dev: when `ENV_STAGE=local` and `TOKYO_WORKER_BASE_URL` are set, Paris also POSTs to tokyo-worker `/l10n/publish` to materialize overlays into `tokyo/l10n/**`.
- Prague website strings use the repo-local `prague-strings/**` pipeline and do not go through Paris.

# Paris — HTTP API Service (Phase-1)

## Purpose
Paris is Clickeen's server-side HTTP API service that handles all privileged operations requiring service-role access to Supabase. It runs on **Cloudflare Workers** and serves as the secure backend for Bob (builder app), authentication flows, widget instance management, and data operations.

## Deployment & Runtime
- **Platform**: Cloudflare Workers
- **Source Directory**: `paris`
- **Runtime**: Edge (V8 isolates)
- **Deploy Command**: `pnpm --filter @clickeen/paris deploy` (Wrangler bundles internally)
- **URL Pattern**: `https://paris.clickeen.com` (prod) / `https://paris.dev.clickeen.com` (cloud-dev)

Fallback (when custom domains aren’t configured yet): `{script}.workers.dev`

## Security Boundaries
- **Service Role Access**: Paris has `SUPABASE_SERVICE_ROLE_KEY` and can bypass RLS. Handlers MUST scope service-role usage to the smallest set of operations and MUST never expose this key to clients.
- **No Public Secrets**: All server secrets live here, never exposed to client. Environment variables MUST remain server-only.
- **Auth model (this repo snapshot):** All current non-public endpoints are gated by `PARIS_DEV_JWT` (dev/local only). Production will validate Supabase Auth JWTs and workspace membership.
- **Rate limiting:** Not implemented in this repo snapshot (planned for write endpoints once usage/submissions ship).
- **Front-door rule:** Third-party pages MUST NOT contact Paris directly. Browsers hit Venice only; Venice proxies to Paris over a server-to-server channel.
- **CORS:** Intended production rule is an allowlist (Bob/Prague only). In this repo snapshot, treat `PARIS_DEV_JWT` as the primary gate.
- **Transport Security**: Paris MUST enforce HTTPS, HSTS, and reject plaintext HTTP. Mutual TLS is not required but outbound fetches MUST verify certificates.

## Phase-1 API Endpoints

### Widget Definitions (Non-Paris)

Paris does **not** serve widget definitions. Widget definitions (“Widget JSON”) live in **Tokyo/CDN**.

- Source in-repo: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- Bob compiles widget specs for the editor via `GET /api/widgets/[widgetname]/compiled` (Bob app, not Paris)
- Venice embed rendering should load widget runtime assets from Tokyo; Venice currently fetches the instance snapshot from Paris via `/api/instance/:publicId` (unscoped). Editor/dev tooling uses the workspace-scoped endpoints.

### AI Gateway (Grants + Outcomes) (shipped in dev/local)

Paris is the **product authority** and issues short-lived signed grants for AI execution. Paris does **not** call LLM providers; it mints grants and forwards outcomes.

#### `POST /api/ai/grant`
Issues an **AI Grant** that San Francisco can verify and execute under.

Current repo behavior:
- **Auth (dev/local only):** requires `Authorization: Bearer ${PARIS_DEV_JWT}`.
- **Agent allowlist:** only known `agentId`s are accepted (e.g. `sdr.copilot`, `sdr.widget.copilot.v1`, `debug.grantProbe`).
- **Budgets are capped server-side** (tokens/timeout/requests) to keep the edge path safe.
- `trace.envStage` is stamped from `ENV_STAGE` (used by San Francisco learning indexes).

Request:
```json
{
  "agentId": "sdr.widget.copilot.v1",
  "mode": "ops",
  "trace": { "sessionId": "anon", "instancePublicId": "wgt_..." },
  "budgets": { "maxTokens": 420, "timeoutMs": 25000, "maxRequests": 2 }
}
```

Response:
```json
{ "grant": "v1....", "exp": 1735521234, "agentId": "sdr.widget.copilot.v1" }
```

Required env vars:
- `AI_GRANT_HMAC_SECRET` (secret): used to sign grants
- `ENV_STAGE` (string): `local|cloud-dev|uat|limited-ga|ga` (used for learning attribution)

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

### Website creatives (local-only superadmin)

Paris provides a **local-only** endpoint for ensuring the Clickeen-owned website-creative instances used by Prague embeds.

Endpoint:
- `POST /api/workspaces/:workspaceId/website-creative` (requires dev auth; rejects non-local `ENV_STAGE`)

Deterministic identity (non-negotiable):
- `creativeKey = {widgetType}.{page}.{slot}` (locale-free)
- `publicId = wgt_curated_{creativeKey}` (locale-free)

Payload:
```json
{
  "widgetType": "faq",
  "page": "overview",
  "slot": "hero",
  "baselineConfig": { "...": "..." },
  "overwrite": false
}
```

Response:
```json
{ "creativeKey": "faq.overview.hero", "publicId": "wgt_curated_faq.overview.hero" }
```

Notes:
- Locale is a **runtime parameter** (handled by Venice overlays); it must not be encoded into `publicId`.
- Cloud-dev should be updated via DevStudio’s “promote instance” path (direct upsert), not by calling this local-only endpoint.

### Usage & submissions (not shipped here)
- `POST /api/usage` and `POST /api/submit/:publicId` exist only as explicit `501 NOT_IMPLEMENTED` placeholders in this repo snapshot.

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

### Privacy, Rate Limiting, Usage, Submissions (Not Shipped Here)
- `POST /api/usage` and `POST /api/submit/:publicId` exist only as explicit `501 NOT_IMPLEMENTED` placeholders in this repo snapshot.
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
- Not implemented: `501` with `{ "error": "NOT_IMPLEMENTED" }` (usage/submissions)

For exact response shapes and status codes, inspect `paris/src/index.ts`.
