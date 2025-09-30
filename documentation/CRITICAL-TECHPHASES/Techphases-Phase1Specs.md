STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It must not conflict with:
1) documentation/dbschemacontext.md (DB Truth) and
2) documentation/CRITICAL-TECHPHASES/Techphases.md (Global Contracts).
If any conflict is found, STOP and escalate to CEO. Do not guess.

# Techphases-Phase1Specs (NORMATIVE)

## Critical Implementation Notes (Phase-1)
- **Casing convention** — Database columns remain snake_case (e.g., `widget_instances.public_id`, `widget_instances.widget_id`). API payloads use camelCase (e.g., `publicId`). Treat `publicId` as a direct alias for `widget_instances.public_id`; each instance row references its widget via `widget_instances.widget_id → widgets.id`.
- **Draft token lifecycle** — Draft tokens live in `widget_instances.draft_token`, are issued on create, passed to Venice via Authorization header, and invalidated (`TOKEN_REVOKED`) immediately after claim. Never persist them beyond transient client state.
- **Front-door pattern** — Third-party pages talk only to Venice (edge). Venice enforces tokens/branding/entitlements and privately calls Paris. Browsers must never call Paris directly for embed flows.
- **Bundle budgets** — Static loader bundle (served from `/embed/v{semver}/loader.js`) ≤28KB gzipped. Per-widget SSR HTML/CSS budget ≤10KB gzipped initial render.

## Phase-1 Contracts — Locked
NORMATIVE. This section is the only source of truth for Phase‑1 runtime contracts. System specs (Venice/Paris/Geneva) provide details but must not contradict this.

### Canonical Terms (binding, Phase‑1)
- Widget: functional unit (e.g., contact form, testimonials, FAQ).
- Template: curated, data‑only preset for a widgetType (layout, skin, density, accents, tokens, defaults). No per‑template JS.
- Instance: user’s saved widget (private config) derived from a template; identified by publicId.
- Single tag: one iframe (inline) or one script (overlay); both load Venice SSR HTML.
- API JSON casing: camelCase. DB columns may be snake_case (see DB Truth).

---

### Venice (Edge SSR — Embed Delivery)
- Route: GET /e/:publicId
- Returns: text/html; charset=utf-8 (server-rendered). No CSR fallback in Phase‑1.
- Single tag patterns:
  - Inline → iframe src=/e/:publicId (canonical).
  - Overlays/popups/bars → static loader served from `/embed/v{semver}/loader.js` (SSR remains canonical) that injects a positioned iframe to `/e/:publicId`.
- Preview hints (for Bob builder app only): ?theme=light|dark&device=desktop|mobile&ts=<ms>
  - If ts present → Cache-Control: no-store (preview only).
- Auth policy:
  - Published: public; no token required.
  - Draft/inactive/protected: require valid embed token (or workspace session in Bob).
- Caching (normative):
  - Published: Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=1800
  - Draft: Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300
  - Preview (ts present): Cache-Control: no-store
  - Apply cache headers exactly as specified here; Techphases-Phase1Specs.md is the normative source.
- Validators & Vary (normative):
  - Set ETag and Last-Modified (Last-Modified = instance.updatedAt).
  - Support If-None-Match and If-Modified-Since; return 304 when unchanged.
  - Vary: Authorization, X-Embed-Token when auth can affect the response.
- Security headers (minimum):
  - Content-Security-Policy: default-src 'none'; frame-ancestors *; script-src 'self' 'nonce-{{nonce}}' 'strict-dynamic'; style-src 'self' 'nonce-{{nonce}}'; img-src 'self' data:; form-action 'self'
- Backlink (Phase‑1): SSR HTML MUST include “Made with Clickeen”.
- Accessibility (minimum):
  - Forms: label/for, aria-describedby for errors, aria-live for success/error.
  - Overlays (loader path): focus trap; Escape closes; return focus to opener.
  - Keyboard operable; visible focus states; WCAG AA contrast.
- Overlay loader (popups/bars):
- Canonical bundle served at `/embed/v{semver}/loader.js`
- `/embed/latest/loader.js` alias points to the current version (maintained manually; no other loader endpoints exist in Phase‑1).
  - Reads kebab-case data attributes (e.g., `data-trigger="time|scroll|click"`, `data-delay`, `data-scroll-pct`, `data-click-selector`) and injects an iframe pointed at `/e/:publicId`.
  - Budget: loader+runtime ≤ 28KB gz; no external deps; passive listeners only.
  - Event bus (minimal): publish/subscribe with buffering until ready; events: open, close, ready; unsubscribe supported.
- Errors (exact strings): TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR.
- Recovery: degrade gracefully with safe fallbacks if dependencies are unavailable.
  - Paris unavailable → Venice returns `503 Service Unavailable` with a branded HTML stub (no client JS) and appropriate cache headers.
  - Geneva/Atlas unavailable → Venice renders with the last in-memory schema/catalog when present; otherwise returns the same 503 stub.
  - If validators match (ETag/If-None-Match or Last-Modified/If-Modified-Since), Venice may respond `304 Not Modified` so clients/CDN reuse cached HTML.

---

### Submissions & Analytics (Embed-side contracts)
- Submissions (same-origin via Venice):
  - POST /s/:publicId → Venice validates and proxies to Paris POST /api/submit/:publicId
  - Limits: content-type required; body ≤ 64KB; strip disallowed fields; rate-limit per IP and per instance.
  - Security model: third-party pages never call Paris directly. Browsers call Venice only; Venice validates tokens/branding/entitlements and forwards to Paris over a private channel. CORS to Paris for embed origins is disallowed in Phase‑1.
  - Call path: Browser → `POST /s/:publicId` (Venice) → Venice proxy → `POST /api/submit/:publicId` (Paris).
- Analytics pixel (privacy-safe):
  - GET /embed/pixel?widget=:publicId&event=load|view|interact|submit|success|error&ts=...
  - Returns 204 No Content; Cache-Control: no-store; may proxy to Paris POST /api/usage.
  - No PII; respect DNT.
- Rate limits & retention (defaults; see `documentation/dbschemacontext.md` for authoritative values): submissions 60 req/min/IP and 120 req/min/instance; pixel 600 req/min/IP. Anonymous submissions retained 30 days via backend maintenance on `widget_submissions` (no database TTL).
- Usage storage: Paris writes usage metrics to the `usage_events` table (DB Truth). Any legacy name such as `usageCountersDaily` is obsolete.
- Attribution storage: User attribution rows are recorded in the `events` table with `event_type = 'user_attribution'`.
- **Submissions key (binding):** `widget_submissions.widget_instance_id` stores the instance’s textual `publicId` (`TEXT`); no internal UUIDs appear in this column.

## S9.1 Rate Limiting (NORMATIVE)
Principles and surfaces only; numeric thresholds come from DB Truth or configuration. Enforce at minimum:
- Submissions: per-IP and per-instance
- Usage writes: reject malformed/abusive patterns
- Token issuance: low rate per workspace

## S10. Draft Retention (NORMATIVE)
Retention follows DB Truth. Do not hardcode durations in code. Expired drafts may be purged. Successful claims bind the instance to a workspace and invalidate the draft token.

---

### Paris (HTTP API — Instances, Tokens, Entitlements, Catalog)
All JSON payloads are camelCase.

Endpoints (Phase‑1):
- POST /api/instance → Create instance
  - Body (optional): { publicId?: string, status?: "draft"|"published"|"inactive", widgetType?: string, templateId?: string, config?: object, schemaVersion?: string }
  - Defaults: server publicId, status="draft", config={}, schemaVersion resolved from template.
  - Conflicts → 409 ALREADY_EXISTS
  - Returns 201 with payload shape below.

- POST /api/instance/from-template → Create an instance from a template
  - Body: { widgetType: string, templateId: string, schemaVersion?: string, publicId?: string, overrides?: object }
  - Returns 201 `{ instance, draftToken }`.

- GET /api/instance/:publicId → Load instance
  - Returns 200 with payload shape below, or 404 NOT_FOUND.

- PUT /api/instance/:publicId → Update-only (no upsert)
  - Body: { config: object, status?: "draft"|"published"|"inactive", templateId?: string }
  - On templateId switch: revalidate; unknown fields reset to target template defaults.
  - Missing row → 404; validation errors → 422 [{ path, message }].

- POST /api/token → Issue/revoke/list embed tokens (minimal)
  - Issue: { publicId, action: "issue" } → 201 { token, publicId }
  - Revoke: { publicId, action: "revoke" } → 204
  - List: { publicId, action: "list" } → 200 { tokens: [...] }

**Draft token lifecycle (Phase‑1)**
- Creation: `POST /api/instance/from-template` issues a short-lived draft token scoped to the new instance; response includes `{ draftToken }`.
- Storage: token metadata lives in Michael (`embed_tokens` table) and is never written client-side beyond transient memory/local state.
- Transport: Bob sends draft tokens via `Authorization: Bearer <token>` (or `X-Embed-Token`) when calling Venice `/e/:publicId` or `/s/:publicId`; no cookies/localStorage.
- Validation: Venice enforces token presence for draft/inactive instances and forwards the token to Paris for verification.
- Claim: `POST /api/claim` invalidates the draft token and issues workspace-scoped embed tokens; Venice must reject the draft token thereafter (TOKEN_REVOKED).

- GET /api/entitlements → Effective plan and capabilities
  - Returns 200 { plan: "free"|"paid", limits: { maxWidgets: number }, features: { premiumTemplates: boolean, brandingRemovable: boolean } }
  - Source of truth: Paris derives entitlements from `plan_features` (capabilities) and `plan_limits` (hard quotas) in Michael.

- Catalog (read-only, public):
  - GET /api/widgets → list widget types and defaults
  - GET /api/templates?widgetType=... → list templates (id, name, premium, schemaVersion, preview, descriptor)

- POST /api/usage → Idempotent usage write
  - Body includes event, publicId, templateId, ts, idempotencyKey; returns 202 Accepted on enqueue.

- POST /api/submit/:publicId → Receive submissions (from Venice proxy)
  - Validates server-side, rate-limits, ties to instance/workspace (or draft token), persists result.

- POST /api/claim → Claim a draft instance into a workspace
  - Body: { draftToken: string }
  - Returns 200 with the claimed instance payload; invalid/expired → 401/410.

- Free plan enforcement (Phase‑1 default): When publishing would exceed the free plan limit of one active instance, Paris returns `403 PLAN_LIMIT` and leaves the new instance inactive. A future auto-deactivate flow would require explicit CEO approval and ADR update.
- Premium template enforcement: When `entitlements.features.premiumTemplates=false`, attempts to save or publish an instance with `premium=true` template must return `403 PREMIUM_REQUIRED`. Bob must block selection with an upgrade CTA; previews via `?ts` remain allowed.

- GET /api/healthz → Service health (richer shape)
  - { sha, env, up, deps: { supabase: { status, latencyMs }, edgeConfig: { status, lastSync } } }

Instance payloads (normative shape):
```json
{
  "publicId": "string",
  "status": "draft|published|inactive",
  "widgetType": "string",
  "templateId": "string",
  "schemaVersion": "string",
  "config": {},
  "branding": { "hide": false, "enforced": false },
  "updatedAt": "iso-8601"
}
```

Linkage: `publicId` maps directly to `widget_instances.public_id`; the backing row references `widgets.id` via `widget_instances.widget_id`.

Branding & entitlements (server-authoritative):
- Free: branding enforced; ignore config.branding.hide=true; return branding.enforced=true.
- Paid: branding can be removed when allowed; branding.enforced=false when permitted.
- Venice MUST obey Paris’ branding fields; no client-side override.
- Fail-closed rule: if branding flags are missing or inconsistent, Venice renders with full branding (backlink visible) and logs the anomaly.

Shared error keys (exact strings)
- TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR.

---

### Geneva (Schema Registry — Validation)
- Schemas:
  - Widget config schema per widgetType (instance config shape).
  - Template descriptor schema per templateId (layout/skin/density/accents/tokens/defaults).
- Enumerations (normative):
  - layout: LIST | GRID | CAROUSEL | CARD | ACCORDION | MARQUEE | STACKED | INLINE
  - skin: MINIMAL | SOFT | SHARP | GLASS
  - density: COZY | COMPACT
  - accents: BADGE | RIBBON | DIVIDER
- Validation:
  - Paris validates on POST/PUT /api/instance and /from-template.
  - 422 response body: [{ "path": "config.fields.email", "message": "must be boolean" }].
- Schemas are immutable per version; new breaking changes require new schemaVersion.

---

### Bob (Preview Integration — UX Contracts)
- Iframe src for preview: /e/:publicId?ts=<ms>&theme=light|dark&device=desktop|mobile
- UX parity: double-buffered preview (cross-fade; no white flash).
- TopDrawer push-down; Theme/Device toggles in Workspace header.
- SecondaryDrawer present but OFF by default in Phase‑1.

---

## S0. Scope & Principles
- Budgets (size/latency) are strict objectives; enforcement is CEO decision.
- Phase‑1 has NO CSR fallback and uses ONLY a single SSR route for embeds.
- GA plans: FREE and PAID only; do not add tiers without CEO approval.
- API JSON is camelCase; DB columns may be snake_case (see DB Truth).
- Path note: the folder name “CRITICAL-TECHPHASES” is LITERAL; treat it as an exact path.

---

## S1. Theming & Tokens (Light/Dark + Overrides)
- Tokens: { colors.fg/bg/surface/primary/accent/neutral, radius, shadow, density, typography }
- theme.mode: "auto"|"light"|"dark"
- Instance overrides: { brand.primary, brand.accent, brand.neutral, radius, shadow, density }
- WCAG AA enforced (warn/auto-adjust). CSS vars only. No inline handlers.

---

## S2. Rendering Contracts
- Backlink policy (Phase‑1): SSR MUST include “Made with Clickeen”.
- Error keys: TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR.
- Caching (normative; repeated here for quick reference):
  - Published: public, max-age=300, s-maxage=600, stale-while-revalidate=1800
  - Draft: public, max-age=60, s-maxage=60, stale-while-revalidate=300
  - Preview (?ts=…): no-store
- Validators: ETag + Last-Modified=updatedAt; support If-None-Match / If-Modified-Since; Vary: Authorization, X-Embed-Token.
- CSP (embed): strict; no third‑party; form-action 'self' (Venice proxy).
- WRC: render(widgetType, config) -> HTMLString (pure, server; no inline handlers).
- Embed flow: GET /e/:publicId → validate (entitlements + embed token if required) → load instance → render → inject backlink → write usage → set cache/validator headers.
- Status codes: 200 OK, 304 Not Modified, 401 Unauthorized (token required/invalid), 404 Not Found, 422 Unprocessable Entity, 429 Too Many Requests, 5xx Server Error.

---

## S3. Global Config Schema Conventions
- API payloads: camelCase; enums UPPERCASE; defaults defined in schema.
- Arrays have explicit max lengths.
- Server JSON Schema validation; 422 returns [{ path, message }] (dot/bracket paths).
- If an example payload is missing for a widget, DO NOT fabricate. Pause and request it from CEO.

---

## S4. Templates as DATA
- Layouts: { LIST, GRID, CAROUSEL, CARD, ACCORDION, MARQUEE, STACKED, INLINE }
- Skins: { MINIMAL, SOFT, SHARP, GLASS }
- Densities: { COZY, COMPACT }; optional Accents: { BADGE, RIBBON, DIVIDER }
- Descriptor (conceptual): { layout, skin, density, accents[], tokens?, defaults, schemaVersion }
- Switching templates is CSS/config only; no per‑template code.
- Each instance references: widgetType + templateId + schemaVersion.
- Switching templates within the same widgetType revalidates config; unknown fields reset to target defaults.
- Bob must present the NON_CARRYABLE guard (`Save & switch` / `Discard & switch` / `Cancel`) before committing any destructive template change.

---

## S5. Bob (Builder App Rules)
- Code location: `bob/`; route served at `/bob`.
- Single working surface that combines configuration and preview; no separate library/gallery screen.
- Toggles: Light/Dark, Desktop/Mobile.
- Preview MUST be an iframe calling GET /e/:publicId with working config (no mocks).

---

## S6. Dieter Base‑6 (Phase‑1)
- Components: Button, TextField, Select, Switch, Tabs, Panel.
- Tokens only; Light/Dark; a11y smoke checks.

---

## S7. Bob v1.0
- In: composition engine (as data), 10–20 curated templates per widget type (≈200–600 total), JSON Schema editor (server-validated), SSR preview, presets, Save/Reset/Copy-Embed.
- Out: undo/redo, custom CSS, animations/A‑B, external data integrations.

---

## S8. Seed Widgets (GA list)
- “Optional” == NOT in GA. Do not implement optional widgets unless CEO says GO.
- FAQ, Testimonials, Announcement/Promo, Newsletter, Contact, Social Proof.
- Optional: Pricing Cards, Gallery.
- Each: schema, presets, SSR HTML, error/loading/empty states.

---

## S9. APIs (Phase‑1)
- POST /api/token (issue/revoke/list)
- POST /api/usage (idempotent write; idempotency hash)
- GET /api/entitlements (plan→capabilities)
- Catalog: GET /api/widgets, GET /api/templates?widgetType=...
- Instance: POST /api/instance, POST /api/instance/from-template, GET /api/instance/:publicId, PUT /api/instance/:publicId
- Submissions: POST /api/submit/:publicId
- Health: GET /api/healthz (richer shape as specified above)

---

## S11. Data & RLS Minima
- Tables (see DB Truth for exact columns and casing):
  - `embed_tokens` — `public_id` (TEXT, UNIQUE, FK → `widget_instances.public_id`), `widget_instance_id` (UUID FK), `token` (TEXT UNIQUE), expiry metadata.
  - `widget_instances` — config JSONB, `schema_version`, `draft_token`, `public_id` (TEXT UNIQUE) surfaced to APIs.
  - `events` — includes nullable `idempotency_hash` (TEXT UNIQUE WHERE NOT NULL) for deduplication; written server-side only.
  - `plan_features` / `plan_limits` — authoritative entitlements and quotas; writes require service-role credentials.
  - `usage_events` / `widget_events` — analytics tables; reads scoped to workspace membership.
- RLS: enabled on all Phase-1 tables (profiles, usage_events, widget_events, plan_limits, etc.). Clients never bypass RLS; embed surfaces rely on Venice/Paris proxies.

---

## S12. Accessibility & Privacy Baseline
- WCAG AA color contrast; visible focus states.
- Forms: labeled controls; aria-describedby; aria-live for dynamic feedback.
- Overlays: focus trap; Esc closes; restore focus to opener.
- Privacy: No cookies/localStorage in embeds; no third‑party scripts; DNT respected.
