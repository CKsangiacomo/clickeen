STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
- documentation/CRITICAL-TECHPHASES/Techphases.md (architecture & global contracts)
- documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase‑1 contracts)
- documentation/dbschemacontext.md (DB Truth)
- documentation/systems/venice.md, documentation/systems/paris.md, documentation/systems/geneva.md (system PRDs)

Authority order: DB Truth > Phase‑1 Specs > System PRDs > Techphases > WhyClickeen.

# CLICKEEN Platform Architecture — Phase 1 (Frozen)

This document is the canonical Phase‑1 architecture snapshot: what’s in scope, boundaries between surfaces, and how the platform fits together. Architecture changes require an ADR and doc updates in the same PR.

---

## Canonical Concepts (Phase‑1)

- Widget — functional unit (e.g., contact form, FAQ, testimonials)
- Template — data‑only preset for a widget (layout, skin, density, tokens, defaults)
- Instance — a saved, private copy of a template with user edits; identified by publicId
- Single tag — inline = iframe; overlays/popups = script that injects an iframe; both load Venice SSR HTML
- Templates are data — switching templates changes config, not code
- JSON casing — API payloads are camelCase; DB casing follows DB Truth

---

## System map (Phase‑1 scope)

| System (Codename) | Repo Path         | Deploy Surface (Vercel)            | Responsibility (Phase‑1)                                        | Status            |
|---|---|---|---|---|
| Prague — Marketing Site | apps/site | c-keen-site | Marketing pages, gallery, static content | Active (P1) |
| Studio — Builder Application | apps/app/app/builder-shell | c-keen-app | Builder surface at /studio. Provides layout/nav/iframe isolation, theme/device toggles, shared error surfacing; Bob UI renders inside this shell. | Active (P1) |
| Bob — Widget Builder UI | apps/app | c-keen-app | Builder UI (config, previews, drafts/claim, template switching rules) | Active (P1) |
| Venice — Embed Runtime | services/embed | c-keen-embed | Public SSR embeds, preview flags, pixel, loader for overlays | Active (P1) |
| Paris — HTTP API | services/api | c-keen-api | Instances, tokens, entitlements, submissions, usage, health | Active (P1) |
| Geneva — Schema Registry | services/api | c-keen-api | Widget/template schemas, validation contracts | Active (P1) |
| Atlas — Edge Config | — (Vercel Edge Config) | — | Config cache/mirror (read-only at runtime; administrative writes require INTERNAL_ADMIN_KEY) | Active (P1) |
| Michael — Data Plane | Supabase | Supabase | Postgres + RLS (authoritative DB) | Active (P1) |
| Phoenix — Idempotency | services/api | c-keen-api | Idempotency enforcement on mutating endpoints | Active (P1) |
| Berlin — Observability/Security | apps/app, apps/site | c-keen-app, c-keen-site | Logs/metrics/rate limits for app/site only; never in embeds or API. | Active (P1) |
| Cairo — Custom Domains | apps/app | c-keen-app | Domain provisioning/validation (Phase‑1 scope) | Active (P1) |
| Denver — Assets/CDN | services/api | c-keen-api | Asset storage (signed URLs) and delivery | Active (P1) |
| Dieter — Design System | apps/app | c-keen-app | Tokens, foundations, components; embeds output SSR HTML/CSS only | Active (P1) |

> Atlas runtime writes remain read-only in Phase‑1. A temporary, key-gated write path exists solely for administrative overrides per ADR‑012 and must not be expanded without CEO approval.

Phase‑2/3 systems (e.g., Copenhagen, Helsinki, Lisbon, Robert, Tokyo) are placeholders and not deployed in Phase‑1.

---

## Deploy surfaces

- apps/site → c-keen-site (Prague + Berlin instrumentation for marketing surfaces)
- apps/app → c-keen-app (Studio shell at `/studio`, Bob UI, Cairo, Berlin app instrumentation)
- services/embed → c-keen-embed (Venice; edge runtime)
- services/api → c-keen-api (Paris + Geneva + Phoenix; node runtime)
- Supabase → Michael (Postgres + RLS; DB Truth source)

---

## Embed Architecture (Venice)

- Route: GET /e/:publicId → SSR HTML (canonical; no CSR fallback)
- Auth policy:
  - Published: public; no token required
  - Draft/Inactive/Protected: valid embed token required (or workspace session in Studio)
- Caching (Phase‑1 canonical):
  - Published: Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=1800
  - Draft: Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300
  - Preview (?ts): Cache-Control: no-store
- Validators: ETag + Last-Modified=updatedAt; support If-None-Match/If-Modified-Since; Vary: Authorization, X-Embed-Token
- Overlay loader (popups/bars):
  - Static bundle served at `/embed/v{semver}/loader.js` (`/embed/latest/loader.js` alias maintained manually during releases)
  - Reads data attributes (e.g., `data-trigger`, `data-delay`, `data-scroll-pct`, `data-click-selector`) and injects a positioned iframe that points at `/e/:publicId`
  - Minimal event bus: open, close, ready; publish/subscribe with buffer‑until‑ready
  - Bundle budget ≤ 28KB gz; no third-party deps
- Front-door pattern: All third-party embed traffic terminates at Venice. Browsers never call Paris directly; Venice enforces tokens/branding/entitlements and proxies to Paris over a private channel.
- Accessibility: WCAG AA; labeled form controls; aria-live; overlays focus trap and Esc; keyboard operable
- CSP (embeds): strict; no third‑party; no storage; form-action 'self' (proxy via Venice)
- Backlink: “Made with Clickeen” in SSR HTML for free plan
- Branding: Paris is authoritative; Venice must enforce branding flags from responses

---

## Template & Render Model

- One server renderer per widget type → HTML string (pure; no inline handlers)
- Template descriptor: { layout, skin, density, accents[], tokens?, defaults, schemaVersion }
- Composition precedence: instance.config → template.defaults → theme.tokenOverrides
- Validation: JSON Schema per widgetType; invalid → 422 with [{ path, message }]
- Authorities:
  - Paris — instance configs & entitlements
  - Geneva — schemas/catalog
  - Atlas — cache/mirror only; never authoritative

---

## Data Flows

1) SSR view
- Venice validates entitlements (and token if required) → fetches instance from Paris → fetches schema/catalog from Geneva (via Atlas mirror when available) → renders SSR HTML → writes usage (pixel) → sets cache/validator headers

2) Submissions (data‑collecting widgets)
- POST /s/:publicId to Venice → validates + proxies to Paris POST /api/submit/:publicId → server‑side validation; rate‑limited; no PII in embed events

3) Usage/Attribution
- Venice serves a 1×1 pixel at `/embed/pixel` → Paris `/api/usage` (idempotent) → aggregates in Michael → KPIs surfaced in the app (Bob experiences shown inside the builder-shell scaffolding; no third-party in embeds)

---

## Plans & Entitlements (Phase‑1)

- Free: 1 active widget; branding enforced; preview premium templates but cannot select
- Paid: unlimited widgets; branding removable; premium templates available
- Paris returns effective entitlements; Venice follows responses exactly

---

## Performance (Phase‑1)

- Loader ≤ 28KB gz; per‑widget initial ≤ 10KB gz
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
- Atlas runtime writes are read-only by policy. ADR‑012 documents a temporary, key-gated admin path for specific overrides; treat Atlas as read-only in all engineering work unless the CEO updates the ADR.

---

## Observability (Phase‑1)

- Health surface: GET /api/healthz (Paris) with dependency details
- Logs/metrics/rate limits via Berlin in app/site and API; never in embeds
- Developers verify lockfile integrity, Dieter asset generation, and doc accuracy manually before release

---

## Change control

- Any cross‑surface change requires an ADR and docs updated in the same PR
- Documentation drift is a P0 incident; fix docs first

---

## Appendix: ADR‑012 summary (Paris separation)

- Decision: Paris is a separate Vercel project to contain secrets and server‑only endpoints
- Rationale: strict boundary between public embeddable code and secret‑bearing surfaces
- Health: dependency‑aware healthz
- Edge Config: read-only at runtime; administrative writes require INTERNAL_ADMIN_KEY
- Risks: cold starts and schema drift; mitigated via health checks and docs‑as‑code
