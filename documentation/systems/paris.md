STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to CEO. Do not guess.

## AIs Quick Scan

**Purpose:** Phase-1 HTTP API (instances, tokens, submissions, usage).
**Owner:** Cloudflare Workers (`paris`).
**Dependencies:** Michael (Postgres), Atlas (read-only config).
**Phase-1 Endpoints:** `POST /api/instance (disabled)`, `GET/PUT /api/instance/:publicId`, `POST /api/claim`, `POST /api/token`, `GET /api/entitlements`, `POST /api/usage`, `POST /api/submit/:publicId`, `GET /api/healthz`. (`GET /api/instances` exists for dev tooling only.)
**Database Tables:** `widget_instances`, `widgets`, `embed_tokens`, `plan_features`, `plan_limits`, `widget_submissions`, `usage_events`, `events`.
**Common mistakes:** Treating PUT as upsert, calling Paris directly from browser surfaces, skipping idempotency key handling.

### 🔑 CRITICAL: Bob's Two-API-Call Pattern (NEW ARCHITECTURE)

**Bob makes EXACTLY 2 calls to Paris per editing session:**

1. **Load** - `GET /api/instance/:publicId` when Bob mounts → gets published config
2. **Publish** - `PUT /api/instance/:publicId` when user clicks Publish → saves working copy

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
- No intermediate saves, no auto-save, no draft saves during editing
- Database only stores published widgets users actually care about

See [Bob Architecture](./bob.md) and [Widget Architecture](../widgets/WidgetArchitecture.md) for complete details.

### 🔒 CRITICAL: Widget Definition vs Instance

**Paris manages INSTANCES, NOT widget definitions.**

**Widget Definition** (a.k.a. “Widget JSON”) **= THE SOFTWARE** (Tokyo/CDN):
- Platform-controlled widget spec + runtime assets
- In-repo source: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- **NOT stored in Michael**
- **NOT served by Paris**

**Widget Instance config = THE DATA** (Michael tables: `widget_instances`, `widgets`):
- ONE user’s specific instance config (`widget_instances.config`)
- Associated widget type is `widgets.type` (surfaced as `widgetType`)
- **EDITABLE by users** (via Bob → Paris `PUT /api/instance/:publicId`)

**What Paris returns for an instance:**
```json
{
  "publicId": "wgt_abc123",
  "status": "draft",
  "widgetType": "faq",
  "config": {
    "title": "My Customer FAQs"
  }
}
```

**Paris endpoints (instance data only):**
- `GET /api/instance/:publicId` — Loads the instance snapshot (config + metadata)
- `PUT /api/instance/:publicId` — Updates instance `config`/`status` (workspace-auth)
- `POST /api/instance` — Disabled in this repo snapshot (returns 422)

# Paris — HTTP API Service (Phase-1)

## Purpose
Paris is Clickeen's server-side HTTP API service that handles all privileged operations requiring service-role access to Supabase. It runs on **Cloudflare Workers** and serves as the secure backend for Bob (builder app), authentication flows, widget instance management, and data operations.

## Deployment & Runtime
- **Platform**: Cloudflare Workers
- **Source Directory**: `paris`
- **Runtime**: Edge (V8 isolates)
- **Build Command**: `pnpm build`
- **URL Pattern**: `https://paris.clickeen.com` (prod) / `https://paris-dev.clickeen.workers.dev` (dev)

## Security Boundaries
- **Service Role Access**: Paris has `SUPABASE_SERVICE_ROLE_KEY` and can bypass RLS. Handlers MUST scope service-role usage to the smallest set of operations and MUST never expose this key to clients.
- **No Public Secrets**: All server secrets live here, never exposed to client. Environment variables MUST remain server-only.
- **JWT Validation**: Paris MUST validate Supabase Auth JWTs on every authenticated request and MUST reject expired or invalid tokens with `401 AUTH_REQUIRED`.
- **Rate Limiting**: Paris MUST enforce per-user and per-workspace rate limits; exceedances MUST return `429 RATE_LIMITED`.
- **Front-door rule**: Third-party pages MUST NOT contact Paris directly. Browsers hit Venice only; Venice validates tokens/branding/entitlements and calls Paris over a private channel.
- **CORS**: Only the Bob app and Prague marketing site origins are allowed (e.g., `https://app.clickeen.com`, `https://clickeen.com` in production, plus their preview counterparts). All other origins MUST receive `403 FORBIDDEN`. Venice→Paris traffic bypasses CORS via server-to-server credentials and MUST include HMAC or allowlisted headers.
- **Transport Security**: Paris MUST enforce HTTPS, HSTS, and reject plaintext HTTP. Mutual TLS is not required but outbound fetches MUST verify certificates.

## Phase-1 API Endpoints

### Widget Definitions (Non-Paris)

Paris does **not** serve widget definitions. Widget definitions (“Widget JSON”) live in **Tokyo/CDN**.

- Source in-repo: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- Bob compiles widget specs for the editor via `GET /api/widgets/[widgetname]/compiled` (Bob app, not Paris)
- Venice embed rendering should load widget runtime assets from Tokyo; Paris only provides instance config via `/api/instance/:publicId`

### Instance Management (Phase-1)
`publicId` in every payload maps 1:1 to `widget_instances.public_id`; each instance row also references its parent widget via `widget_instances.widget_id → widgets.id`. Widget type is `widgets.type` (surfaced as `widgetType`).

- `POST /api/instance` (Phase‑1 status: disabled)
  - Returns 422 with guidance in this repo snapshot. Instance creation is intentionally out of Paris scope.
- `GET /api/instance/:publicId`
  - Loads the latest instance snapshot (service role or authorized workspace member). Returns 200 payload or 404 `NOT_FOUND`.
  - _Example response (200):_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "draft",
      "widgetType": "faq",
      "config": {
        "title": "Frequently Asked Questions",
        "categories": [...]
      },
      "branding": { "hide": false, "enforced": true },
      "updatedAt": "2025-09-28T19:15:03.000Z"
    }
    ```
- `PUT /api/instance/:publicId`
  - Updates `config` and/or `status` (workspace-authenticated). Returns 200 payload, 404 if missing, 422 on validation errors.
  - _Example validation error (422):_
    ```http
    PUT /api/instance/wgt_42yx31
    Authorization: Bearer <workspace JWT>
    Content-Type: application/json

    { "config": { "categories": [{ "title": "" }] } }
    ```
    ```json
    [ { "path": "categories.0.title", "message": "Title is required" } ]
    ```
  - _Example response (200):_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "draft",
      "widgetType": "faq",
      "config": {
        "title": "Frequently Asked Questions",
        "categories": [...]
      },
      "branding": { "hide": false, "enforced": true },
      "updatedAt": "2025-09-28T19:16:44.000Z"
    }
    ```
- `POST /api/claim`
  - Requires workspace-authenticated request. Body includes `{ draftToken, workspaceId? }`.
  - Invalid/expired tokens return 410 `TOKEN_REVOKED`.
  - **On success (200):** Paris MUST
    - Set `widget_instances.draft_token = NULL`
    - Set `widget_instances.claimed_at = now()`
    - Issue an embed token; prior draft tokens become invalid (`TOKEN_REVOKED`).
  - _Example request:_
    ```http
    POST /api/claim
    Authorization: Bearer <workspace JWT>
    Content-Type: application/json

    { "draftToken": "dft_fa0bde7d-1dbe-4a4f-8b0a-98a8ea" }
    ```
    _Example response (200):_
    ```json
    {
      "instance": {
        "publicId": "wgt_42yx31",
        "status": "published",
        "widgetType": "faq",
        "config": {
          "title": "Frequently Asked Questions",
          "categories": []
        },
        "branding": { "hide": false, "enforced": true },
        "updatedAt": "2025-09-28T19:20:11.000Z"
      },
      "embedToken": {
        "token": "cket_9c0b5e57d7b1",
        "expiresAt": "2025-10-28T19:20:11.000Z"
      }
    }
    ```
    _Example 410 response:_
    ```http
    HTTP/1.1 410 Gone
    { "error": "TOKEN_REVOKED" }
    ```

**Canonical instance payload (GET/PUT `/api/instance/:publicId`)**
```json
{
  "publicId": "wgt_42yx31",
  "status": "draft",
  "widgetType": "faq",
  "config": {
    "title": "Frequently Asked Questions",
    "categories": [...]
  },
  "branding": { "hide": false, "enforced": true },
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
| `branding.hide` | Derived from entitlements (not persisted; Venice/Paris enforce based on plan) |
| `updatedAt` | `widget_instances.updated_at` |

> Branding fields (`branding.hide`, `branding.enforced`) are derived from entitlements and are never persisted in the database.

**publicId generation (Phase-1)**
- In this repo snapshot, Paris does not create instances. `publicId` generation happens upstream (outside Paris) and is persisted in Michael.

### Token Management
Embed tokens live in `embed_tokens` and are scoped per instance/workspace.

- `POST /api/token` with `{ publicId, action: "issue" }` → 201 `{ token, publicId, expiresAt }`.
- `POST /api/token` with `{ publicId, action: "revoke" }` → 204.
- `POST /api/token` with `{ publicId, action: "list" }` → 200 `{ tokens: [...] }`.

_Example token issue request/response_
```http
POST /api/token
Authorization: Bearer <workspace JWT>
Content-Type: application/json

{ "publicId": "wgt_42yx31", "action": "issue" }
```
```json
{ "token": "cket_9c0b5e57d7b1", "publicId": "wgt_42yx31", "expiresAt": "2025-10-01T00:00:00.000Z" }
```
_Example list response (200):_
```json
{
  "tokens": [
    {
      "token": "cket_9c0b5e57d7b1",
      "expires_at": "2025-10-01T00:00:00.000Z",
      "revoked_at": null,
      "created_at": "2025-09-28T19:25:30.000Z"
    }
  ]
}
```

_Example entitlements response_
```http
GET /api/entitlements
Authorization: Bearer <workspace JWT>
```
```json
{
  "plan": "free",
  "limits": { "maxWidgets": 1 },
  "features": {
    "premiumTemplates": false,
    "brandingRemovable": false
  },
  "usage": { "widgetsCount": 1, "submissionsCount": 42 }
}
```

### Entitlements
- `GET /api/entitlements`
  - Computes `{ plan, limits, features }` by joining `plan_features` (capabilities) and `plan_limits` (hard quotas).
  - Free plan enforcement: publishing a second active widget returns 403 `PLAN_LIMIT` (any auto-deactivate behavior requires explicit CEO approval).
  - `features.premiumTemplates` is returned for future gating but is not enforced by the current instance update flow in this repo snapshot.

### Usage, Submissions & Attribution
- `POST /api/usage`
  - Records widget events (load/view/interact/submit). Requests MUST include an `idempotencyKey`; the body shape is `{ publicId, event, timestamp, idempotencyKey, metadata? }`. Returns **202 Accepted** on enqueue (idempotent). Example:
    ```json
    {
      "publicId": "wgt_42yx31",
      "event": "load",
      "timestamp": "2025-09-28T19:15:48.000Z",
      "idempotencyKey": "load-wgt_42yx31-1695938148000",
      "metadata": { "referrer": "https://example.com" }
    }
    ```
    Paris deduplicates using the unique index on `usage_events.idempotency_hash`. Returns 202 `{ recorded: true }` or 202 `{ recorded: false }` for duplicates.
    _Example response (202):_
    ```json
    { "recorded": true }
    ```
  - **Idempotency key (example, non-normative):** `{event}-{publicId}-{epochMs}` such as `load-wgt_f3k9qz-1695938148000`. Clients may use any unique string; Paris only requires uniqueness.
- `POST /api/submit/:publicId`
  - Receives submissions proxied from Venice. Persists into `widget_submissions`; rate limited per IP and instance. Anonymous rows are retained 30 days by backend maintenance (no DB TTL).
  - _Example request:_
    ```http
    POST /api/submit/wgt_42yx31
    Content-Type: application/json
    X-Request-ID: 5b3c3a2d-1981-4a6f-938d-a56f0e6fb5f0

    {
      "fields": {
        "name": "Jane Baker",
        "email": "jane@example.com",
        "message": "Interested in pricing."
      },
      "metadata": {
        "userAgent": "Mozilla/5.0",
        "ip": "203.0.113.24"
      }
    }
    ```
  - _Example response (202):_
    ```json
    { "status": "accepted", "deduped": false }
    ```
  - Privacy: Paris computes a salted SHA‑256 of the request IP (`RATE_LIMIT_IP_SALT` || `v1`) and stores only the hash in the `ip` column. Raw IPs are not stored. SQL fallback for rate limiting queries on the hash. Redis keys also use the hash.
- Viral attribution events are written via the `events` table with `event_type = 'user_attribution'`.

### Health & System (Phase-1)
#### `GET /api/healthz`
**Purpose**: Health check with dependency status  
**Auth**: None (public)  
**Returns**:
```json
{
  "sha": "string",
  "env": "development|preview|production",
  "up": true,
  "deps": {
    "supabase": { "status": "ok|error" },
    "edgeConfig": { "status": "ok|error" },
    "cors": { "configured": true, "allowlistCount": 2 }
  }
}
```
**Status**: 200 if all deps OK, 503 if any critical dep fails. `deps.cors` reflects whether `ALLOWED_ORIGINS` is configured (fail‑closed policy). Phase‑1 acceptance requires this endpoint to return green on production.

### Privacy & Rate Limiting (Phase‑1)
- IP hashing: When an endpoint needs per‑IP rate limiting, Paris computes a deterministic hash:
  `sha256( (RATE_LIMIT_IP_SALT || 'v1') + ip )` and uses this value for storage/keys.
- Storage: Submissions write the hash into `widget_submissions.ip` (TEXT). Usage events may include the hash in `metadata.ipHash` for SQL fallback limits.
- Backends: Redis counters use the hash; SQL fallbacks query the hash from storage columns/metadata.

## Database Integration

### Supabase Configuration

**Tracing & timeouts**: Accept and propagate an `X-Request-ID` header on incoming requests. Venice issues requests with ≤5s timeouts; Paris handlers should complete within that window or fail fast with a 503 so Venice can degrade gracefully.
```typescript
// Service role client (full access)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### Key Tables Used
- `widget_instances`: Instance snapshots (`public_id`, `status`, `config`, `draft_token`, `claimed_at`, `updated_at`)
- `widgets`: Parent widget records (`type` is surfaced as `widgetType` for instances)
- `embed_tokens`: Token lifecycle management  
- `workspaces`: Tenant isolation and plan enforcement
- `workspace_members`: Authorization and role checking
- `plan_features` + `plan_limits`: Combined to compute entitlements
- `widget_submissions`: Submission storage
- `usage_events`: Usage tracking and audit trail for load/view/interact/submit events
- `events`: Attribution (`event_type = 'user_attribution'`) and other audit records

### RLS Enforcement
Supabase row-level security remains enabled on all tables (see policies defined on `workspace_members`, `widget_instances`, etc.). Paris uses the service-role key, but MUST still:
1. Validate JWT tokens for user context.
2. Verify workspace membership/role before reading or writing on behalf of a user.
3. Respect plan limits before mutations.
4. Log all privileged operations for auditability.

## Integration Contracts

### Venice (Embed Service)
Paris provides widget instance data to Venice:
- Venice calls `GET /api/instance/:publicId` to load instance `config` + metadata
- Paris validates embed tokens before serving data
- Response cached by Venice with TTL based on status
- Widget definitions/assets are loaded from Tokyo/CDN (outside Paris)

### Bob (Builder App)
Bob manages widgets through Paris APIs:
- Fetches Widget Instance via `GET /api/instance/:publicId` to get the user’s current config
- User edits → updates config only
- Saves config changes via `PUT /api/instance/:publicId`
- Token management for embed code generation
- Entitlements checking for feature gating

### Site (Marketing)
Site creates anonymous widgets via Paris:
- Anonymous widget creation/from-starter is not implemented in this repo snapshot.
- Claim flow converts drafts to owned widgets and triggers draft token invalidation (`TOKEN_REVOKED`).
- Demo widget configs for marketing pages

## Error Handling Standards

### Error Response Format
Paris uses two response shapes:

1) **Validation errors**: `422` with `[{ path, message }]` (e.g., invalid `config`)
2) **Error codes**: `{ "error": "ERROR_CODE", "details"?: "..." }`

### Standard Error Codes

_API error code mapping (Phase-1)_
| Error code | Description | Phase-1 Specs reference |
| --- | --- | --- |
| `AUTH_REQUIRED` | Missing or invalid authentication | S9 APIs |
| `FORBIDDEN` | Valid auth but insufficient permissions | S9 APIs |
| `NOT_FOUND` | Resource does not exist | S2 Rendering Contracts |
| `RATE_LIMITED` | Too many requests (per limits above) | S2/S9 rate limits |
| `PLAN_LIMIT` | Free plan exceeded (publish) | S9 APIs |
| `DB_ERROR` | Database operation failed | N/A |
| `SERVER_ERROR` | Unexpected internal error | N/A |

> Embed-surface error keys (`TOKEN_INVALID`, `TOKEN_REVOKED`, etc.) are documented in `documentation/systems/venice.md`; do not mix them with API error codes.

### Error Scenario Matrix (Phase-1)
| Scenario | Endpoint(s) | Status / Error | Response Body | Client guidance |
| --- | --- | --- | --- | --- |
| Instance creation disabled | `POST /api/instance` | 422 | `[{ "path": "endpoint", "message": "Instance creation is disabled in this environment" }]` | Do not retry; creation happens outside Paris |
| Validation failure | `PUT /api/instance/:publicId` | 422 | `[{ "path": "categories.0.title", "message": "Required field" }]` | Surface field-level errors; block retry until corrected |
| Draft token revoked | `POST /api/claim` | 410 `TOKEN_REVOKED` | `{ "error": "TOKEN_REVOKED" }` | Remove cached draft token and prompt user to refresh |
| Missing auth | Any authenticated endpoint | 401 `AUTH_REQUIRED` | `{ "error": "AUTH_REQUIRED" }` | Redirect to login / refresh workspace session |
| Plan limit exceeded | `PUT /api/instance/:publicId` (publish) | 403 `PLAN_LIMIT` | `{ "error": "PLAN_LIMIT" }` | Show upgrade CTA; retry only after plan change |
| Rate limit triggered | `POST /api/usage`, `POST /api/submit/:publicId` | 429 `RATE_LIMITED` | `{ "error": "RATE_LIMITED" }` | Back off; obey `Retry-After` header |
| Idempotency replay | `POST /api/usage` | 202 | `{ "recorded": false }` | Treat as success; do not re-send same key |
| Submission dedupe | `POST /api/submit/:publicId` | 202 | `{ "status": "accepted", "deduped": true }` | Treat as success |
| Database error | Any endpoint | 500 `DB_ERROR` | `{ "error": "DB_ERROR", "details": "..." }` | Log and show generic retry (internal follow-up required) |

## Security Requirements

### Authentication Flow
1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify JWT signature with Supabase public key
3. Extract `sub` (user_id) and workspace context
4. Check workspace membership and role permissions
5. Proceed with authorized operation

### Rate Limiting
- Embed submissions: 60 requests/minute/IP and 120 requests/minute/instance (enforced when Venice proxies to `POST /api/submit/:publicId`).
- Usage pixel: 600 requests/minute/IP when Venice proxies to `POST /api/usage`.
- Authoritative schema lives under `supabase/migrations/` (see rate window policies there); adjust only with CEO approval and updated documentation.
- Repeated violations should trigger exponential backoff and logging for SRE follow-up.
#### Headers and backend visibility
- All rate‑limited endpoints return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- On limit, responses include `Retry-After: 60` and `{ "error": "RATE_LIMITED" }` with status 429.
- Backend: `X-RateLimit-Backend: redis|sql` indicates the active limiter backend (Redis counters when available; SQL window fallback otherwise). Paris degrades to SQL automatically on Redis issues and recovers without intervention; transitions are logged.

#### CORS allowlist (Phase‑1)
- Allowed origins are configured via `ALLOWED_ORIGINS` (comma‑separated URLs). Non‑allowlisted origins receive `403 FORBIDDEN`.
- OPTIONS preflight includes: `Access-Control-Allow-Methods: GET,POST,PUT,OPTIONS` and `Access-Control-Allow-Headers: Authorization,Content-Type,X-Request-ID,X-Workspace-Id,X-Embed-Token`.
- In development, localhost origins are allowed when `ALLOWED_ORIGINS` is unset.

### Input Validation
- All JSON payloads validated against JSON Schema
- SQL injection prevention via parameterized queries
- XSS prevention via input sanitization
- File upload restrictions (if applicable)

### Handler Checklist (Phase-1)
Before shipping or modifying a Paris endpoint, verify:
1. **Auth:** Validate Supabase JWT (unless route is explicitly public) and reject expired/invalid tokens with `401 AUTH_REQUIRED`.
2. **Workspace scope:** Resolve workspace/member via service-role query or RLS-friendly SQL and enforce permissions/plan state (return `PLAN_LIMIT` when appropriate).
3. **Idempotency & rate limits:** Require `idempotencyKey` for write surfaces (`/api/usage`, `/api/submit`, etc.) and invoke the documented rate-limit helper before executing mutations.
4. **Canonical SQL:** Use the queries listed in `documentation/systems/michael.md` (“Canonical SQL Queries”) or utilities that wrap them—no ad-hoc SQL that could drift from DB Truth.
5. **Error mapping:** Never emit raw database errors. Return `422` validation arrays for user-correctable input issues and `{ "error": "DB_ERROR" }`/`{ "error": "SERVER_ERROR" }` for unexpected failures.
6. **Telemetry:** Emit Berlin logs with `X-Request-ID`, endpoint identifier, latency, and result (success/error) while avoiding PII/secret leakage.

## Monitoring & Observability

### Logging Requirements
- All API requests with duration, status, user context
- Authentication failures and authorization denials  
- Database errors and slow queries (>1s)
- Rate limiting violations
- Plan limit enforcement actions

### Metrics to Track
- Request volume and latency by endpoint
- Error rates by error type and endpoint
- Database connection pool utilization
- JWT validation success/failure rates
- Feature usage by plan type

### Alerts
- Error rate >5% for any endpoint
- Response time >2s for 95th percentile
- Database connection failures
- Memory usage >80%
- Disk usage >85%

## Development Guidelines

### Code Organization
```
paris/
├── app/
│   └── api/
│       ├── instance/
│       ├── token/  
│       ├── entitlements/
│       ├── usage/
│       └── healthz/
├── lib/
│   ├── auth.ts        # JWT validation utilities
│   ├── supabase.ts    # Database client setup
│   ├── validation.ts  # JSON Schema validators
│   └── rate-limit.ts  # Rate limiting logic
└── middleware/        # Auth, CORS, rate limiting
```

## Testing Requirements (NORMATIVE)
- RLS policy tests for each table (run manually during development)
- Performance benchmarks for critical queries (manual developer verification)
- No automated CI enforcement in Phase-1

### Environment Configuration
```env
# Required in production
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
JWT_SECRET=your-jwt-secret

# Optional (Phase-1)
ALLOWED_ORIGINS=https://app.clickeen.com,https://clickeen.com
RATE_LIMIT_REDIS_URL=redis://...
RATE_LIMIT_REDIS_PREFIX=ck:rl:
RATE_LIMIT_BREAKER_THRESHOLD=5
RATE_LIMIT_BREAKER_WINDOW_MS=60000
RATE_LIMIT_BREAKER_COOLDOWN_MS=300000
RATE_LIMIT_IP_SALT=some-stable-secret
```

> Environment variables are summarized in `CONTEXT.md` (“Phase-1 Environment Variables”). Atlas remains read-only at runtime; administrative overrides require INTERNAL_ADMIN_KEY and explicit ops approval.
> Per Berlin policy: API surfaces (Paris) rely on application logs/metrics only. No third-party telemetry vendors (e.g., Sentry) in API or embeds; observability vendors are Bob/Prague only.

This completes the Paris system specification. All endpoints should be implemented according to these contracts to ensure proper integration with Venice, Bob, and other services.
