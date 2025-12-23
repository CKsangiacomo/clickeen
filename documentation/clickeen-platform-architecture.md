STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
- documentation/CONTEXT.md (glossary, Phase-1 scope, precedence rules)
- documentation/systems/ (system PRDs: Venice, Paris, Bob, Copenhagen, etc.)
- supabase/migrations/ (DB schema truth)
- documentation/systems/venice.md, documentation/systems/paris.md, documentation/systems/geneva.md (system PRDs)

Authority order: DB Schema (supabase/migrations/) > System PRDs > Widget PRDs > CONTEXT.md > WhyClickeen.

# CLICKEEN Platform Architecture — Phase 1 (Frozen)

This document is the canonical Phase‑1 architecture snapshot: what’s in scope, boundaries between surfaces, and how the platform fits together. Architecture changes require CEO approval with documentation updates in the same PR.

---

## Canonical Concepts (Phase‑1)

- **Widget Definition** (a.k.a. “Widget JSON”) — THE SOFTWARE; complete functional software for a widget type (e.g., FAQ, testimonials); lives in **Denver/CDN** (in-repo: `denver/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only))
- **Widget Instance** — THE DATA; user’s specific widget configuration; stored in **Michael (database)** as `{ publicId, widgetType, config }`
- **widgetType** — string identifier for widget type (e.g., `"faq"`); stored in `widgets.type` and surfaced via APIs
- **config** — user’s custom values for their widget instance (stored in `widget_instances.config`)
- **Template** — predefined config baseline (data) applied to an instance (not separate code)
- **ToolDrawer spec** — widget definition markup in `spec.json.html[]` (`<bob-panel>` + `<tooldrawer-field>`), compiled by Bob into ToolDrawer panel HTML (and optional `controls[]` for safe AI ops)
- **Single tag** — inline = iframe; overlays/popups = script that injects an iframe; both load Venice SSR HTML
- **Templates are data** — switching templates transforms/merges config, not code
- **JSON casing** — API payloads are camelCase (publicId, widgetType, config); DB casing follows the schema in supabase/migrations/

### 🔑 NEW: Bob's Two-API-Call Architecture

**Major architectural change: Bob owns instance config in React state during editing. Only saves via Paris on publish (persisted in Michael).**

**The Two-Place Rule:**
Config exists in EXACTLY 2 places:
1. **Michael (database)** - Published version (production source of truth; accessed via Paris)
2. **Bob's React state** - Working copy (during editing session)

**The Two-API-Call Pattern:**
Bob makes EXACTLY 2 calls to Paris per editing session:
1. **Load** - `GET /api/instance/:publicId` when Bob mounts
2. **Publish** - `PUT /api/instance/:publicId` when user clicks Publish

**Between load and publish:**
- All edits happen in Bob's React state (in memory)
- Preview updates via postMessage (NO Paris API calls)
- ZERO database writes

**Impact on Systems:**
- **Bob:** Holds config in state, only saves on publish
- **Paris:** Expects GET once on mount, PUT once on publish (no intermediate saves; persists to Michael)
- **Venice:** Serves public embeds at `/e/:publicId` (SSR only); editing previews are local (Bob loads Denver widget HTML in an iframe and streams config via postMessage to `widget.client.js`)
- **Database:** Only stores published widgets (no abandoned edits, no drafts during editing)

**Operational Benefits:**
- **Scalability:** 10,000 users editing simultaneously → no server load (good engineering practice)
- **Cost savings:** Millions of landing page visitors → ZERO database pollution until signup + publish (operational efficiency)
- **Performance:** Instant editing feedback (in-memory), no network latency (table stakes for modern editors)

See [Widget Architecture](./widgets/WidgetArchitecture.md), [Bob](./systems/bob.md), [Paris](./systems/paris.md), [Venice](./systems/venice.md) for complete details.

---

## System map (Phase‑1 scope)

| System (Codename) | Repo Path         | Deploy Surface (Vercel)            | Responsibility (Phase‑1)                                        | Status            |
|---|---|---|---|---|
| Prague — Marketing Site | prague | c-keen-site | Marketing pages, gallery, static content | Active (P1) |
| Bob — Builder Application | bob | c-keen-app | Builder surface at /bob. Provides layout/nav/device toggles, shared error surfacing, configuration workflow, previews, claim flows. | Active (P1) |
| Venice — Embed Runtime | venice | c-keen-embed | Public SSR embeds, preview flags, pixel, loader for overlays | Active (P1) |
| Paris — HTTP API | paris | c-keen-api | Instances, tokens, entitlements, submissions, usage, health | Active (P1) |
| Geneva — Schema Registry | paris | c-keen-api | Widget/template schemas, validation contracts | Active (P1) |
| Atlas — Edge Config | — (Vercel Edge Config) | — | Config cache/mirror (read-only at runtime; administrative writes require INTERNAL_ADMIN_KEY) | Active (P1) |
| Michael — Data Plane | Supabase | Supabase | Postgres + RLS (authoritative DB) | Active (P1) |
| Phoenix — Idempotency | paris | c-keen-api | Idempotency enforcement on mutating endpoints | Active (P1) |
| Berlin — Observability/Security | bob, prague | c-keen-app, c-keen-site | Logs/metrics/rate limits for app/site only; never in embeds or API. | Active (P1) |
| Cairo — Custom Domains | bob | c-keen-app | Domain provisioning/validation (Phase‑1 scope) | Active (P1) |
| Denver — Assets/CDN | paris | c-keen-api | Asset storage (signed URLs) and delivery | Active (P1) |
| Dieter — Design System | dieter | c-keen-app | Tokens, foundations, components; embeds output SSR HTML/CSS only | Active (P1) |

> Atlas runtime writes remain read-only in Phase‑1. A temporary, key-gated write path exists solely for administrative overrides approved by the CEO and guarded by INTERNAL_ADMIN_KEY; do not expand it without explicit direction.

Phase‑2/3 systems (e.g., Copenhagen, Helsinki, Lisbon, Robert, Tokyo) are placeholders and not deployed in Phase‑1.

---

## Deploy surfaces

- prague/ → c-keen-site (Prague + Berlin instrumentation for marketing surfaces)
- bob/ → c-keen-app (Bob builder app at `/bob`, Cairo, Berlin app instrumentation)
- venice/ → c-keen-embed (Venice; edge runtime)
- paris/ → c-keen-api (Paris + Geneva + Phoenix; node runtime)
- Supabase → Michael (Postgres + RLS; DB schema source defined by supabase/migrations/)

---

## Widget Docs (Phase‑1)

- Widget system architecture: `documentation/widgets/WidgetArchitecture.md` (NORMATIVE - authoritative for widget system)
- Widget definitions (source in-repo): `denver/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- Per‑widget PRDs: `documentation/widgets/*.md` (one file per widget)

---

## Embed Architecture (Venice)

- Route: GET /e/:publicId → SSR HTML (canonical; no CSR fallback)
- Auth policy:
  - Published: public; no token required
  - Draft/Inactive/Protected: valid embed token required (or workspace session in Bob)
- Caching (Phase‑1 canonical):
  - Published: Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=1800
  - Draft: Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300
  - Preview (?ts): Cache-Control: no-store
- Validators: ETag + Last-Modified=updatedAt; support If-None-Match/If-Modified-Since; Vary: Authorization, X-Embed-Token
- Overlay loader (popups/bars):
  - Static bundle served at `/embed/v{semver}/loader.js` (`/embed/latest/loader.js` alias maintained manually during releases)
  - Reads data attributes (e.g., `data-trigger`, `data-delay`, `data-scroll-pct`, `data-click-selector`) and injects a positioned iframe that points at `/e/:publicId`
  - Minimal event bus (`window.ckeenBus`): open, close, ready; publish/subscribe with buffer‑until‑ready (legacy alias `window.Clickeen` exists; new code must use `window.ckeenBus`)
  - Preferred loader size ≤80KB gzipped; MUST NOT exceed 200KB gzipped; keep third-party deps to a minimum
- Front-door pattern: All third-party embed traffic terminates at Venice. Browsers never call Paris directly; Venice enforces tokens/branding/entitlements and proxies to Paris over a private channel.
- Accessibility: WCAG AA; labeled form controls; aria-live; overlays focus trap and Esc; keyboard operable
- CSP (embeds): strict; no third‑party; no storage; form-action 'self' (proxy via Venice)
- Backlink: “Made with Clickeen” in SSR HTML for free plan
- Branding: Paris is authoritative; Venice must enforce branding flags from responses

---

## Template & Render Model

- Widget Definition (“Widget JSON”) IS the software (controls UI structure + defaults and points to runtime assets)
- Venice renders HTML using widget runtime assets + instance config
- Template = predefined config baseline
- Composition precedence: instance.config → template defaults → widget defaults
- Validation: JSON Schema per widgetType; invalid → 422 with [{ path, message }]
- Authorities:
  - Denver — serves widget definitions/assets (CDN)
  - Michael — stores widget instances/config
  - Paris — stateless gateway API for instances/config (no widget definition hosting)
  - Geneva — schemas/catalog
  - Atlas — cache/mirror only; never authoritative

---

## Data Flows

1) SSR view
- Venice validates entitlements (and token if required) → fetches instance from Paris → fetches schema/catalog from Geneva (via Atlas mirror when available) → renders SSR HTML → writes usage (pixel) → sets cache/validator headers

2) Submissions (data‑collecting widgets)
- POST /s/:publicId to Venice → validates + proxies to Paris POST /api/submit/:publicId → server‑side validation; rate‑limited; no PII in embed events

3) Usage/Attribution
- Venice serves a 1×1 pixel at `/embed/pixel` → Paris `/api/usage` (idempotent) → aggregates in Michael → KPIs surfaced inside Bob (builder app); no third-party in embeds

---

## Plans & Entitlements (Phase‑1)

- Free: 1 active widget; branding enforced; preview premium templates but cannot select
- Paid: unlimited widgets; branding removable; premium templates available
- Paris returns effective entitlements; Venice follows responses exactly

---

## Performance (Phase‑1)

- Preferred embed size (loader + initial render) ≤80KB gzipped; MUST NOT exceed 200KB gzipped
- Edge TTFB ≤ 100ms; TTI < 1s (4G)
- Manual release checklist: verify bundle budgets before shipping
Note: Embed budgets mirror systems/venice.md (normative).

---

## Security & Privacy

- Supabase RLS enforced (Michael)
- Embed tokens: 128‑bit random; rotatable/revocable
- Rate limiting on writes
- No third-party scripts/cookies/storage in embeds; Sentry/PostHog allowed only in app/site (Berlin)
- Secrets live in c-keen-api only (server surface)
- Atlas runtime writes are read-only by policy. Administrative overrides require the INTERNAL_ADMIN_KEY and the ops runbook described in the Atlas PRD; treat Atlas as read-only in all engineering work unless the CEO explicitly approves a change.

---

## Observability (Phase‑1)

- Health surface: GET /api/healthz (Paris) with dependency details
- Logs/metrics/rate limits via Berlin in app/site and API; never in embeds
- Developers verify lockfile integrity, Dieter asset generation, and doc accuracy manually before release

---

## Change control

- Any cross‑surface change requires CEO approval with documentation updated in the same PR
- Documentation drift is a P0 incident; fix docs first

---

## Appendix: Paris / Atlas separation summary

- Decision: Paris is a separate Vercel project to contain secrets and server-only endpoints.
- Rationale: strict boundary between public embeddable code and secret-bearing surfaces.
- Health: dependency-aware healthz endpoint required.
- Edge Config: read-only at runtime; administrative writes require INTERNAL_ADMIN_KEY and explicit ops approval.
- Risks: cold starts and schema drift; mitigated via health checks and docs-as-code.
