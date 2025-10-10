STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It must not conflict with:
1) documentation/dbschemacontext.md (DB Truth) and
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Global Contracts).
If any conflict is found, STOP and escalate to CEO. Do not guess.

## AIs Quick Scan

**Purpose:** Phase-1 HTTP API (instances, tokens, submissions, usage).  
**Owner:** Vercel project `c-keen-api`.  
**Dependencies:** Michael (Postgres), Geneva (schemas), Atlas (read-only config).  
**Phase-1 Endpoints:** `POST /api/instance`, `POST /api/instance/from-template`, `GET/PUT /api/instance/:publicId`, `POST /api/claim`, `POST /api/token`, `GET /api/entitlements`, `POST /api/usage`, `POST /api/submit/:publicId`, `GET /api/healthz`.  
**Database Tables:** `widget_instances`, `widgets`, `embed_tokens`, `plan_features`, `plan_limits`, `widget_submissions`, `usage_events`, `events`.  
**Key ADRs:** ADR-004 (tool versions), ADR-005 (Dieter assets), ADR-012 (Edge Config & workflow).  
**Common mistakes:** Treating PUT as upsert, calling Paris directly from browser surfaces, skipping idempotency key handling.

# Paris — HTTP API Service (Phase-1)

## Purpose
Paris is Clickeen's server-side HTTP API service that handles all privileged operations requiring service-role access to Supabase. It runs on Node.js runtime and serves as the secure backend for Studio, authentication flows, widget instance management, and data operations that cannot run on the edge.

## Deployment & Runtime
- **Vercel Project**: `c-keen-api` 
- **Source Directory**: `services/api`
- **Runtime**: Node.js (NOT edge)
- **Build Command**: `pnpm build`
- **URL Pattern**: `https://c-keen-api.vercel.app`

## Security Boundaries
- **Service Role Access**: Paris has SUPABASE_SERVICE_ROLE_KEY and can bypass RLS
- **No Public Secrets**: All server secrets live here, never exposed to client
- **JWT Validation**: Validates Supabase Auth JWTs for authenticated endpoints
- **Rate Limiting**: Implements per-user/workspace rate limits
- **Front-door rule**: Third-party pages never contact Paris directly. Browsers hit Venice (edge) only; Venice validates tokens/branding/entitlements and calls Paris over a private channel.
- **CORS**: Configured for Studio and Site origins only. Venice→Paris traffic is server-to-server (not subject to CORS); protect it with an internal allowlist or HMAC header.

## Phase-1 API Endpoints

### Instance Management (Phase-1)
`publicId` in every payload maps 1:1 to `widget_instances.public_id`; each instance row also references its parent widget via `widget_instances.widget_id → widgets.id`.

- `POST /api/instance`
  - Creates an instance (defaults: status=`"draft"`, empty config, schemaVersion from template).
  - Returns 201 `{ publicId, status, config, schemaVersion, branding, updatedAt }`.
  - 409 `ALREADY_EXISTS` on duplicate `publicId`; 422 with `[ { path, message } ]` on validation failures.
  - _Example request:_
    ```http
    POST /api/instance
    Authorization: Bearer <service-token>
    Content-Type: application/json

    { "widgetType": "forms.contact", "templateId": "classic-light" }
    ```
    _Example response:_
    ```json
    {
      "publicId": "wgt_42yx31",
      "status": "draft",
      "widgetType": "forms.contact",
      "templateId": "classic-light",
      "schemaVersion": "2025-09-01",
      "config": {},
      "branding": { "hide": false, "enforced": true },
      "updatedAt": "2025-09-28T19:15:03.000Z"
    }
    ```
- `POST /api/instance/from-template`
  - Workspace flow for creating from a catalog template. Body includes `{ widgetType, templateId, publicId?, overrides? }`.
  - Returns 201 instance payload plus `{ draftToken }`. Paris stores the token in `widget_instances.draft_token`; Venice must receive it via Authorization header until claim.
- `GET /api/instance/:publicId`
  - Loads the latest instance snapshot (service role or authorized workspace member). Returns 200 payload or 404 `NOT_FOUND`.
- `PUT /api/instance/:publicId`
  - Updates config/status/template. Unknown config fields reset to target template defaults. Returns 200 payload, 404 if missing, 422 on validation errors.
  - _Example validation error (CONFIG_INVALID, 422):_
    ```http
    PUT /api/instance/wgt_42yx31
    Authorization: Bearer <workspace JWT>
    Content-Type: application/json

    { "config": { "fields": { "email": "maybe" } } }
    ```
    ```json
    [ { "path": "config.fields.email", "message": "must be boolean" } ]
    ```
- `POST /api/claim`
  - `{ draftToken }` → 200 instance payload. Invalid/expired tokens return 401/410.
  - **On success (200):** Paris MUST
    - Set `widget_instances.draft_token = NULL`
    - Set `widget_instances.claimed_at = now()`
    - Issue workspace-scoped embed tokens; prior draft tokens become invalid (`TOKEN_REVOKED`).
  - _Example request:_
    ```http
    POST /api/claim
    Authorization: Bearer <workspace JWT>
    Content-Type: application/json

    { "draftToken": "dft_fa0bde7d-1dbe-4a4f-8b0a-98a8ea" }
    ```
    _Example 410 response:_
    ```http
    HTTP/1.1 410 Gone
    { "error": "TOKEN_REVOKED" }
    ```

**Canonical instance payload**
```json
{
  "publicId": "wgt_42yx31",
  "status": "draft",
  "widgetType": "forms.contact",
  "templateId": "classic-light",
  "schemaVersion": "2025-09-01",
  "config": {
    "title": "Contact Us",
    "fields": { "name": true, "email": true, "message": true }
  },
  "branding": { "hide": false, "enforced": true },
  "updatedAt": "2025-09-28T19:15:03.000Z"
}
```

**API ↔ DB mapping (Phase-1)**
| API field | DB column/property |
| --- | --- |
| `publicId` | `widget_instances.public_id` |
| `widgetType` | `widgets.type` |
| `templateId` | `widget_instances.template_id` |
| `schemaVersion` | `widget_instances.schema_version` |
| `config` | `widget_instances.config` |
| `branding.hide` | Derived from entitlements (not persisted; Venice/Paris enforce based on plan) |
| `updatedAt` | `widget_instances.updated_at` |

> Branding fields (`branding.hide`, `branding.enforced`) are derived from entitlements and are never persisted in the database.

**publicId generation (Phase-1)**
- Paris generates publicIds as `wgt_{base36_6}` (e.g., `wgt_f3k9qz`) when creating an instance. This prefix is reserved for widgets in Phase-1 to keep analytics and Venice contracts consistent.

### Token Management
Embed tokens live in `embed_tokens` and are scoped per instance/workspace.

- `POST /api/token` with `{ publicId, action: "issue" }` → 201 `{ token, publicId }`.
- `POST /api/token` with `{ publicId, action: "revoke" }` → 204.
- `POST /api/token` with `{ publicId, action: "list" }` → 200 `{ tokens: [...] }`.
- `GET /api/widgets` → Public catalog of widget types (id, name, description, defaults).
- `GET /api/templates?widgetType=…` → List templates for the given widget type (id, name, premium flag, schemaVersion, descriptor, preview URL).
  - Enforcement: free plan may preview premium templates but cannot select them; selection attempts return 403 FORBIDDEN.

_Example token issue request/response_
```http
POST /api/token
Authorization: Bearer <workspace JWT>
Content-Type: application/json

{ "publicId": "wgt_42yx31", "action": "issue" }
```
```json
{ "token": "cket_9c0b5e57d7b1", "publicId": "wgt_42yx31" }
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
  - Free plan enforcement: publishing a second active widget returns 403 `PLAN_LIMIT` (auto-deactivate requires an ADR).
  - Premium gating: if `features.premiumTemplates=false`, saving/publishing a premium template returns 403 `PREMIUM_REQUIRED`.

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
  - **Idempotency key (example, non-normative):** `{event}-{publicId}-{epochMs}` such as `load-wgt_f3k9qz-1695938148000`. Clients may use any unique string; Paris only requires uniqueness.
- `POST /api/submit/:publicId`
  - Receives submissions proxied from Venice. Persists into `widget_submissions`; rate limited per IP and instance. Anonymous rows are retained 30 days by backend maintenance (no DB TTL).
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
    "supabase": { "status": "ok|error", "latencyMs": "number" },
    "edgeConfig": { "status": "ok|error", "lastSync": "iso_string" }
  }
}
```
**Status**: 200 if all deps OK, 503 if any critical dep fails. Phase-1 acceptance requires this endpoint to return green on production.

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
- `widget_instances`: CRUD operations for widget configs (`public_id` aligns with API `publicId`, `widget_id` links to `widgets.id`, `draft_token` invalidated on claim)
- `embed_tokens`: Token lifecycle management  
- `workspaces`: Tenant isolation and plan enforcement
- `workspace_members`: Authorization and role checking
- `plan_features` + `plan_limits`: Combined to compute entitlements
- `widget_submissions`: Submission storage (anonymous rows pruned after 30 days by backend job)
- `usage_events`: Usage tracking and audit trail for load/view/interact/submit events
- `events`: Attribution (`event_type = 'user_attribution'`) and other audit records

### RLS Enforcement
Supabase row-level security remains enabled on all tables (see policies defined on `workspace_members`, `widget_instances`, etc.). Paris uses the service-role key, but must still:
1. Validate JWT tokens for user context.
2. Verify workspace membership/role before reading or writing on behalf of a user.
3. Respect plan limits before mutations.
4. Log all privileged operations for auditability.

## Integration Contracts

### Venice (Embed Service)
Paris provides widget configuration data to Venice:
- Venice calls `GET /api/instance/:publicId` to load configs
- Paris validates embed tokens before serving data
- Response cached by Venice with TTL based on status

### Studio (Console App)  
Studio manages widgets through Paris APIs:
- Instance CRUD operations for widget builder
- Token management for embed code generation
- Entitlements checking for feature gating
- Real-time config updates via PUT endpoints

### Site (Marketing)
Site creates anonymous widgets via Paris:
- Anonymous widget creation through Studio flow
- `POST /api/instance/from-template` issues `draftToken`; Venice uses it while the visitor edits without an account.
- Claim flow converts drafts to owned widgets and triggers draft token invalidation (`TOKEN_REVOKED`).
- Demo widget configs for marketing pages

## Error Handling Standards

### Error Response Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message", 
  "details": "Additional context (optional)",
  "field_errors": [
    { "path": "config.title", "message": "Required field" }
  ]
}
```
`CONFIG_INVALID` responses return the raw `[{ path, message }]` array defined in Phase-1 Specs; all other errors use the envelope above.

### Standard Error Codes

_API error code mapping (Phase-1)_
| Error code | Description | Phase-1 Specs reference |
| --- | --- | --- |
| `AUTH_REQUIRED` | Missing or invalid authentication | S9 APIs |
| `FORBIDDEN` | Valid auth but insufficient permissions | S9 APIs |
| `NOT_FOUND` | Resource does not exist | S2 Rendering Contracts |
| `ALREADY_EXISTS` | Conflict with existing resource | S9 APIs |
| `CONFIG_INVALID` | 422 with `[ { path, message } ]` | S3/S9 JSON validation |
| `RATE_LIMITED` | Too many requests (per limits above) | S2/S9 rate limits |
| `PLAN_LIMIT` | Free plan exceeded (publish) | S9 APIs |
| `PREMIUM_REQUIRED` | Premium-only capability requested | S9 APIs |
| `DB_ERROR` | Database operation failed | N/A |
| `SERVER_ERROR` | Unexpected internal error | N/A |

> Embed-surface error keys (`TOKEN_INVALID`, `TOKEN_REVOKED`, etc.) are documented in `documentation/systems/venice.md`; do not mix them with API error codes.

- `AUTH_REQUIRED`: Missing or invalid authentication
- `FORBIDDEN`: Valid auth but insufficient permissions  
- `NOT_FOUND`: Resource does not exist
- `ALREADY_EXISTS`: Conflict with existing resource
- `CONFIG_INVALID`: Invalid request payload (returns 422 with `[ { path, message } ]`)
- `RATE_LIMITED`: Too many requests
- `PLAN_LIMIT`: Feature not available on current plan (free tier attempting >1 active widget)
- `PREMIUM_REQUIRED`: Premium template or capability gated by plan
- `DB_ERROR`: Database operation failed
- `SERVER_ERROR`: Unexpected internal error

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
- Authoritative values live in `documentation/dbschemacontext.md` (see `submission_rate_window` policies); adjust only with CEO approval + ADR.
- Repeated violations should trigger exponential backoff and logging for SRE follow-up.

### Input Validation
- All JSON payloads validated against JSON Schema
- SQL injection prevention via parameterized queries
- XSS prevention via input sanitization
- File upload restrictions (if applicable)
- Submission retention: backend job prunes anonymous rows in `widget_submissions` after 30 days (no database TTL).

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
services/api/
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
RATE_LIMIT_REDIS_URL=redis://...
```

> Environment variables are summarized in `CONTEXT.md` (“Phase-1 Environment Variables”). Atlas remains read-only at runtime; the INTERNAL_ADMIN_KEY override is ops-only per ADR-012.
> Per Berlin policy: API surfaces (Paris) rely on application logs/metrics only. No third-party telemetry vendors (e.g., Sentry) in API or embeds; observability vendors are Studio/Prague only.

This completes the Paris system specification. All endpoints should be implemented according to these contracts to ensure proper integration with Venice, Studio, and other services.
