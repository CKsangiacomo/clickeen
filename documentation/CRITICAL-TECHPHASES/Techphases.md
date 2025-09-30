# Techphases.md (Phase-1, Freeze Version)

**Purpose**  
This document defines the technical phases of Clickeen across Phase-1, Phase-2, and Phase-3.  
It establishes which **systems** exist (codenames, responsibilities) and which **services** deploy them.  
This is the authoritative roadmap for humans and AIs.

- Sections marked **NORMATIVE** = binding specifications.  
- Sections marked **INFORMATIVE** = context only.

---

## Authority & Conflict Resolution (NORMATIVE)

- **DB Truth (`dbschemacontext.md`)** is canonical for schema and table definitions.  
- **System specs (`documentation/systems/*.md`)** (e.g., Venice, Paris, Geneva) are canonical for API/payload shapes.  
- **Techphases.md** is architectural guidance.  
- If there is any conflict: **DB Truth and system specs win.**

---

## Systems vs. Services

- **Systems** = logical architecture components with codenames (e.g., Venice, Paris, Bob).  
- **Services** = concrete deployable units (Vercel projects, Supabase functions, etc.) that host one or more systems.

Example:  
- Venice (system) = Embed Runtime.  
- c-keen-embed (service) = Vercel deployment that serves Venice.

---

## Codename Map (Systems)

- Phase-1 systems (scope; specs live in `documentation/systems/`. If a system doc is missing, treat it as informative until added; do not assume implementation.)
  - Atlas — Config & Cache Layer  
  - Berlin — Observability & Security (app/site surfaces only; never in embeds or API)  
  - Bob — Builder app (shell + editor) at `/bob`; hosts configuration workflow, previews, claim flows  
  - Cairo — Custom Domains  
  - Denver — Asset Storage & CDN  
  - Dieter — Design System  
  - Geneva — Schema Registry  
  - Michael — Data Plane  
  - Phoenix — Idempotency Layer  
  - Venice — Embed Runtime  
  - Paris — HTTP API  
  - Prague — Marketing Site

- Future systems (Phase-2/3, informative only; specs may not yet exist)
  - Copenhagen — AI Orchestration (not implemented in Phase-1; spec TBD)  
  - Helsinki — Analytics Warehouse (not implemented in Phase-1; spec TBD)  
  - Lisbon — Email/Notifications (Phase-2)  
  - Robert — Notification Router (Phase-2)  
  - Tokyo — Job/Workflow Orchestrator (Phase-2)

---

## Canonical Glossary (NORMATIVE)

- Widget — functional unit (e.g., form, FAQ).  
- Template — pre-designed style for a widget (layout + skin + density). Templates are data-only (JSON).  
- Instance — specific deployment of a widget (private config + publicId).  
- Draft — unclaimed instance created on first play; claim binds it to a workspace.  
- Embed delivery — SSR HTML from Venice at `GET /e/:publicId`.  
  - Consumers may embed via iframe (inline) or the static loader script served from `/embed/v{semver}/loader.js` (overlay). SSR HTML is canonical (no client React in embeds).  
- Single tag — the embed snippet a website places; widget type determines inline vs overlay.  
- Templates as data — structured JSON; switching templates changes config only, not code.

Casing: All JSON examples here use camelCase. For DB table/column names, always refer to DB Truth (`dbschemacontext.md`). Do not infer casing.

---

## Phase-1 Overview (NORMATIVE)

Scope
- Widgets: 20–30 widget types (GA list defined in Phase-1 Specs).
- Templates: 10–20 per widget type (~200–600 total).
- Renderer: one renderer per widget type; templates are data-only.
- Embed: static versioned loader at `/embed/v{semver}/loader.js` (`/embed/latest/loader.js` alias maintained manually); ≤28KB gzipped, tiny event bus (publish/subscribe). See Phase-1 Specs for trigger attributes parsed from `data-*`.
- Per-widget budget: ≤10KB gzipped initial render.
- Plans:
  - Free → 1 active widget, includes “Made with Clickeen” branding
  - Paid → unlimited widgets, no branding, premium templates

Non-Goals
- Per-template JavaScript
- Client-side React runtime in embeds
- Third-party scripts in embeds (Berlin instrumentation lives only in app/site surfaces)
- Cookies/localStorage in embeds
- Phase-2/3 features (roles, deep integrations, enterprise)

---

## Guiding Principles (NORMATIVE)

- Product-led, self-serve
- Modular from day one (split only when scale demands)
- Size + speed are features (strict budgets)
- Security by default (RLS, scoped tokens, least privilege)
- DX matters (pnpm, linting, type safety)
- No guessing — escalate if unspecified

---

## Template Composition (NORMATIVE)

- Templates are JSON objects:
  - id, widgetType, layout, skin, density, accents?, tokens?, schemaVersion, defaults, slots?
- Composition precedence: `instance.config → template.defaults → theme.tokenOverrides`.
- Source of truth:
  - Paris — instance configs & entitlements.
  - Geneva — schemas/catalog.
  - Atlas — edge cache only (read-through); never authoritative.
- Renderer: server renderer per widget type → HTML string (pure; no inline handlers).
- Inheritance: variants may extend a base + provide diff; flattened at build.
- Validation: JSON Schema per widget type; invalid → 422 with `[ { path, message } ]`.

See also: systems/geneva.md (schemas) and systems/paris.md (catalog + instance creation).

---

## SSR Data Flow & Caching (NORMATIVE)

- Route: `GET /e/:publicId` (Venice).
- Auth policy (clarifier)
  - Published instances: public GET; no token required.
  - Draft/inactive/protected: require embed token (or workspace session in Bob).
  - Venice enforces branding exactly as returned by Paris (no client overrides).
- Steps
  1) Validate entitlements; validate embed token only if required (draft/inactive).  
  2) Load instance snapshot + entitlements from Paris.  
  3) Load template schema/catalog from Geneva (Atlas mirror optional).  
  4) Resolve config → render SSR HTML (+ “Made with Clickeen” backlink).  
  5) Write usage (pixel; idempotent; rate-limited).  
  6) Apply cache headers (canonical TTLs, ETag/Last-Modified, Vary; see Phase‑1 Specs for exact values).
- Front-door rule: browsers on third-party sites never call Paris directly. Venice is the sole public origin for embeds, enforces tokens/branding/entitlements, and speaks to Paris over a private channel.
- Preview parity (Bob builder app): `/e/:publicId?ts=<ms>&theme=light|dark&device=desktop|mobile` (double-buffer, no white flash).
- Errors: TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR.
- Recovery: degrade gracefully with fallbacks when dependencies are unavailable.

References: systems/venice.md (embed, caching, CSP) and systems/paris.md (instance API).

---

## Widget State & Data (NORMATIVE)

- Presentational widgets: render-only (template + instance config).
- Data-collecting widgets (e.g., forms):
  - Endpoint: `POST /api/submit/:publicId` (Paris).
  - Server-side validation authoritative; client-side validation optional UX.
  - Anonymous submissions tied to draft token.
  - Retention: bounded (value set in DB Truth / Phase-1 Specs).
  - On claim: submissions re-keyed to workspace.

See also: systems/paris.md (submission endpoints).

---

## Builder (Bob) (NORMATIVE)

- Bob (system) — Builder app at `/bob`: provides shell, navigation, device/theme toggles, and hosts the editor UI for configuration, previews, drafts, claim flow, and template switching rules.

Builder UX rules
- One working surface (no separate “library” screen).
- TopDrawer (templates) collapses by default; first template auto-applies; push-down (no overlay).
- Shell components handle layout/transitions; ToolDrawer provides the editor controls.
- Workspace is always visible (iframe calling `/e/:publicId`); light debounce on edits; preserve focus/scroll; cross-fade preview.
- Mobile: drawers open as sheets; close back to Workspace.

See also: systems/bob.md (scaffolding + editor contracts).

---

## Token Taxonomy (NORMATIVE)

- JWT — user auth (Supabase).
- Embed token — identifies instance/draft; scoped; rotatable/revocable.
- Usage/pixel token — usage events; idempotent.
- No “template tokens.”

See also: systems/paris.md (token issuance/revoke, rate limits).

---

## Behavior & Animations (NORMATIVE)

- CSS-first: animations/transitions via tokens & skins.
- Per-widget JS: allowed only for interactivity CSS cannot do (FAQ expand, form validation/async submit, testimonial autoplay).
- Bundle ≤10KB gz per widget behavior engine.
- CSP: no `eval`, no `unsafe-inline`, no third-party, no storage.
- Behavior is driven by config flags (e.g., expandMode, autoplay, successMode).

---

## Loader & Event Bus (NORMATIVE)

- Loader pathing: `/embed/v{semver}/loader.js` and `/embed/latest/loader.js` (alias maintained manually during releases).
- Event bus (overlays):
  - `.publish(event, payload)`
  - `.subscribe(event, handler)` → `unsubscribe()`
  - Buffers until ready
  - Events: `open`, `close`, `ready`, plus widget-specific events

References: systems/venice.md (versioned loader + bus API).

---

## Accessibility Baseline (NORMATIVE)

- WCAG AA color contrast; visible focus states.
- Forms: labels associated via for/id; errors via aria-describedby; aria-live for errors/success.
- Overlays: focus trap, Escape to close, return focus to opener; restore focus on close.
- All interactive controls keyboard-operable.

References: systems/venice.md (accessibility requirements).

---

## PLG Metrics & Attribution (NORMATIVE)

- Backlink: “Made with Clickeen” → `https://clickeen.com/?ref=widget&id={publicId}`.
- Funnel: impressions (widget loads) → link clicks → account creations.
- Storage: recorded in the `events` table (`event_type = 'user_attribution'`).
- KPIs: viral coefficient; unique domains (eTLD+1 via Referer); time-to-embed (firstInteraction → embedCodeCopied).
- Free plan: unlimited drafts; exactly 1 active instance (`embedCodeGenerated=true`). Downgrade requires respecting the Phase‑1 default `403 PLAN_LIMIT` enforcement (see Phase‑1 Specs); any auto-deactivate behavior demands CEO approval.
- Premium templates: badged; free users can preview but must upgrade to select.
- Enforcement semantics (Phase-1 default): see Phase-1 Specs for the canonical `403 PLAN_LIMIT` and `403 PREMIUM_REQUIRED` behaviors. Any change requires CEO approval and documentation updates.
- Expansion tracking: widgets-per-workspace over time; adoption order; average widgets/account.

---

## Systems (Phase-1 Scope)

- Venice — Embed Runtime  
- Paris — HTTP API  
- Bob — Widget Builder UI  
- Atlas — Config cache  
- Berlin — Observability/logs/security (app/site surfaces only; never in embeds or API)  
- Denver — Assets/CDN  
- Cairo — Custom domains  
- Dieter — Design system  
- Geneva — Schema registry  
- Michael — Data plane  
- Phoenix — Idempotency  
- Prague — Marketing site

(Other systems — Copenhagen, Helsinki, Lisbon, Robert, Tokyo — are defined but not implemented until Phase-2/3.)

**Reminder:** If any referenced `documentation/systems/<System>.md` file is missing or out of date, do **not** infer behavior—escalate. Phase-1 Specs and DB Truth remain authoritative.

---

## Services (Deployments)

Note: Only Phase‑1 surfaces are active; Phase‑2/3 items listed here are placeholders, not deployed in Phase‑1.

- c-keen-embed — hosts Venice, Atlas cache layer.  
- c-keen-api — hosts Paris (and Geneva/Phoenix surfaces as needed).  
- c-keen-app — hosts Bob (builder app + shell), Cairo (Phase‑1), Berlin (Phase‑1), Lisbon (Phase‑2 placeholder), Robert (Phase‑2 placeholder), Tokyo (Phase‑2 placeholder).  
  > Note: these systems share the same runtime. They are hosted surfaces, not separate deployments.  
- c-keen-site — hosts Prague.  
- Supabase — hosts Michael (Postgres/RLS), Helsinki (Phase‑2/3 placeholder, warehouse), Copenhagen (Phase‑2/3 placeholder, AI).

---

## Phase-1 Stack (NORMATIVE)

- TypeScript everywhere
- Next.js (Prague, Bob builder app)
- Vanilla TS (Venice runtime)
- Supabase Postgres + Auth (Michael)
- Stripe (stub)
- PostHog + Sentry (Bob/Prague only; never in embeds)
- pnpm workspaces, esbuild/rollup
- Vercel hosting (frozen Phase-1)
- GitHub Actions workflows (optional; manual triggers in Phase-1)
- ESLint, Prettier, Vitest, Playwright

---

## Phase-1 Data Model (NORMATIVE)

- users, workspaces, workspaceMembers
- widgets, widgetInstances, widgetClaimAudit
- embedTokens, usage_events, events (`event_type = 'user_attribution'` for attribution rows)
- stripeCustomers, stripeSubscriptions

RLS: deny-all default; explicit allow via workspace membership.

Note: This section mirrors DB Truth for orientation. The authoritative schema is documentation/dbschemacontext.md.

---

## Phase-1 Security (NORMATIVE)

- RLS enforced everywhere
- Embed tokens: 128-bit random, rotatable
- Rate limiting on writes
- Strict CSP: `script-src 'self'` (no third-party in embeds)
- Privacy: no PII in embed events; aggregates only
- Secrets in env; never in repo

---

## Performance (NORMATIVE)

- Loader ≤28KB gz (manual target; verify at release)
- Per-widget initial ≤10KB gz (manual target; verify at release)
- Edge TTFB ≤100ms; TTI <1s (4G) remain goals for engineers to check manually
- No unnecessary third-party deps

Note: Performance budgets mirror Techphases-Phase1Specs.md (normative); engineers verify manually during release prep.

---

## Phase-2 — Low-Cost SaaS (INFORMATIVE)

- Multi-user roles & invites
- Full billing UI (Stripe)
- Integrations (Google OAuth, Slack, email)
- Webhooks + API keys
- Workflow automation (trigger→action)
- Berlin observability expansion
- Public docs/dev portal

---

## Phase-3 — Enterprise Platform (INFORMATIVE)

- SSO/SAML, SCIM, advanced roles
- Enterprise billing (seat-based, contracts)
- Deep CRM integrations (Salesforce, HubSpot)
- Compliance (SOC2, GDPR, retention)
- Tenant dashboards, SLA monitoring

---

## Repository (NORMATIVE)

- Monorepo with pnpm workspaces
- Direct commits to `main` allowed in Phase-1
- No PR workflows or automated gates
- Manual deployment to Vercel projects (c-keen-app, c-keen-site, c-keen-embed, c-keen-api)

---

## Acceptance Criteria (NORMATIVE)

Phase-1
- Loader ≤28KB gz; per-widget initial ≤10KB gz
- Widget renders across 3 CMSs
- Draft → Claim flow works
- Usage counters increment; KPIs visible (7-day history)
- Error reporting works in Bob/Prague (no third-party in embeds)
- `/api/healthz` endpoints green
- Stripe webhooks create subscription rows (behind flags)
- Retention + free-plan rules enforced per DB Truth/Specs
- Preview rate limiting enforced
- Viral attribution pipeline live (impressions→clicks→signups)
- Bob (builder app) works correctly with shell + editor integrated
- Dashboard shows KPIs (viral coefficient, time-to-embed, unique domains, free vs paid)

Phase-2
- Roles & invites; self-serve billing
- Integrations (Google OAuth, Slack webhook)
- Workflows live (1 trigger→1 action)
- Docs site live

Phase-3
- SSO/SAML + SCIM
- Enterprise quotas + invoices
- CRM integrations (Salesforce/HubSpot)
- Compliance (export/delete, retention, incidents)
