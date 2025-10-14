# Clickeen Widgets — System Architecture

STATUS: NORMATIVE — AUTHORITATIVE FOR WIDGET SYSTEM ARCHITECTURE
This document is **widget-agnostic**. It defines the widget system architecture, not individual widgets.

**For individual widget specs, see:**
- `documentation/widgets/testbutton.md` — Test button widget PRD (Phase-0 tokenization reference)
- `documentation/widgets/{widgetType}.md` — Individual widget PRDs (when CEO approves)

**For related systems, see:**
- `documentation/WhyClickeen.md` — Product strategy and AI-native vision
- `documentation/CONTEXT.md` — Runtime contracts
- `documentation/systems/venice.md` — Widget rendering (SSR)
- `documentation/systems/paris.md` — Widget instance management (API)
- `documentation/systems/geneva.md` — Widget schemas and catalog
- `documentation/systems/bob.md` — Widget builder (UI)
- `documentation/systems/Dieter.md` — Design system (components & tokens)

---

## What Is a Widget?

A **widget** is a self-contained functional unit that businesses embed on their websites with a single line of code.

**Conceptual examples** (actual widget catalog defined by CEO):
- Forms that collect data
- Content displays that present information
- Engagement elements that drive actions

**Key characteristics:**
- Single responsibility (does one thing well)
- Embeddable via iframe or script tag
- Configurable without code
- Renders server-side (SSR) for performance
- Works on any website (third-party embeds)

---

## Core Concepts

### Widget vs Template vs Instance

**Widget (Type):**
- A functional category (e.g., `{category}.{name}`)
- Defines what the widget does
- Has a JSON schema defining configurable fields

**Template:**
- A pre-designed visual style for a widget type
- Data-only (no custom code per template)
- Defined by: layout, skin, density, accents, tokens, defaults

**Instance:**
- A user's saved widget with their specific configuration
- Derived from a template
- Identified by `publicId` (e.g., `wgt_xxxxxx`)
- Private to a workspace

**Relationship:**
```
Widget Type
  ↓ has many
Templates (different visual styles)
  ↓ creates
Instance (wgt_abc123) with user's config
```

---

## Widget Architecture

### The Widget Lifecycle

```
1. User browses gallery on Prague (marketing site)
   ↓
2. User clicks widget card (e.g., "Contact Form")
   ↓
3. Prague creates draft instance via Paris POST /api/instance/from-template (with chosen widget type + default template)
   ↓
4. Prague opens Bob/MiniBob with publicId
   ↓
5. User configures instance and/or switches templates in Bob
   ↓
6. User clicks "Publish" (MiniBob) or "Save" (authenticated Bob)
   ↓
7. Bob persists via Paris PUT /api/instance/:publicId
   ↓
8. User gets embed code → embeds on their site
   ↓
9. Visitor sees widget, interacts (form submit, click, etc.)
   ↓
10. Venice proxies submissions to Paris POST /api/submit/:publicId
```

**CRITICAL:** Widget type is chosen on Prague gallery BEFORE Bob opens. Bob does NOT have widget type picker. Bob receives `publicId` query param and loads that specific widget instance.

---

## V0 — testbutton (Phase‑1 working slice)

This appendix defines the smallest end‑to‑end slice we use to validate the widget system with real traffic and the Bob editor. It does not change the global architecture above; it instantiates it for one concrete widget.

**IMPORTANT:** Phase-0 tokenization MUST be completed before Phase-1 preview system. See `documentation/widgets/testbutton.md` for detailed tokenization requirements.

### Overview
- Widget type: `testbutton`
- Purpose: prove Bob ↔ Paris (GET/PUT) ↔ Venice (SSR) loop with minimal UI
- Renderer: `venice/lib/renderers/testButton.ts`
- **Prerequisite:** Widget must be tokenized (CSS variables for patchable fields)
- **See:** `documentation/widgets/testbutton.md` for complete PRD and tokenization reference

### Templates (data‑only; static catalog in Phase‑1)
- Template id: `testbutton-pill`
- Descriptor example: `{ layout: "INLINE", skin: "MINIMAL", density: "COZY", schemaVersion: "2025-09-01" }`

### Instance config (server‑authoritative)
- `text: string` (1–50 chars)
- `color: "green" | "red"`
- `radiusPx: number` (0–32, default 12) — Added for Phase-0 tokenization

### Bob controls → config mapping
- "Button text" → `config.text`
- "Color" (Green/Red) → `config.color`
- "Border Radius" slider → `config.radiusPx` (Phase-1+)

### Paris APIs touched
- `GET /api/instance/:publicId` — load instance snapshot
- `PUT /api/instance/:publicId` — update `config` and/or `status`; switch template using dry‑run/confirm

Template switching (Phase‑1, already implemented)
```http
# Preview the switch (no write)
PUT /api/instance/wgt_42yx31?dryRun=true
Content-Type: application/json
Authorization: Bearer <jwt>
{ "templateId": "testbutton-pill" }

# Confirm apply (persist transformed config)
PUT /api/instance/wgt_42yx31?confirm=true
Content-Type: application/json
Authorization: Bearer <jwt>
{ "templateId": "testbutton-pill" }
```

### Embedding (Venice SSR)
Use an iframe for third‑party sites (universal across WordPress, Wix, Shopify, Squarespace):
```html
<iframe
  src="https://c-keen-embed.vercel.app/e/wgt_42yx31"
  loading="lazy"
  title="Clickeen widget"
  sandbox="allow-forms allow-same-origin"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width:100%;max-width:480px;height:120px;border:0">
</iframe>
```

Platform notes
- WordPress/Squarespace: paste iframe into “Custom HTML/Code” block.
- Wix: use “Embed a site”/HTML iframe element.
- Shopify: add iframe in a theme section or template. (App Embed can wrap this later.)
- Overlays/bars: optional small loader script at `/embed/v1/loader.js` when the platform allows scripts; default to the iframe.

### Budgets (measure, don’t gate)
- Loader bundle ≤ 28KB gz (report‑only via pre‑ship harness)
- SSR first paint per widget ≤ 10KB gz (report‑only)

### Security & privacy (embed)
- Strict CSP with nonce; no third‑party scripts, cookies, or storage in embeds
- Analytics via Venice pixel → Paris `/api/usage` only

### Acceptance (V0)
- Editing `text`/`color` in Bob persists via Paris `PUT` and reflects in Venice preview (with `?ts=`)
- Publishing works; free plan limit returns `403 PLAN_LIMIT` and is surfaced by Bob without breaking flows
- Iframe embed renders without client JS; performance and CSP remain intact
- No regressions in other services (Paris, Venice, Bob)

Elegant engineering (definition)
- Do the smallest working change by reusing existing patterns; no new abstractions, refactors, or extra scope.

### The Widget Stack

**Frontend (Embed):**
- Venice SSR renders HTML/CSS (no client JS required for basic functionality)
- Optional loader script for overlays/popups (`/embed/v{semver}/loader.js`)
- Respects user's theme (light/dark) and device (desktop/mobile)

**Backend (Management):**
- Paris manages instances (CRUD operations)
- Geneva provides schemas and catalog
- Bob provides builder UI (manual + AI Copilot)

**Storage:**
- Widget instances → `widget_instances` table
- Widget templates → `widget_templates` table
- Widget schemas → `widget_schemas` table
- Submissions → `widget_submissions` table

---

## Widget Anatomy

Every widget has these components:

### 1. Schema (JSON Schema)

Defines what's configurable for a widget type.

**Why schemas matter:**
- AI reads schema to know what's editable
- Paris validates config changes against schema
- Bob generates form controls from schema
- Prevents invalid configurations

**Schema requirements:**
- Must be valid JSON Schema
- All properties must have types
- String fields should have maxLength
- Enums for constrained values
- Required fields explicitly defined

**See individual widget PRDs for actual schemas** (e.g., `documentation/widgets/testbutton.md`)

### 2. Template Descriptor (Data)

Defines visual style for a widget.

**Template structure:**
- `templateId` — Unique identifier
- `widgetType` — Which widget this template is for
- `layout` — Layout style (e.g., INLINE, CARD, LIST, GRID)
- `skin` — Visual treatment (e.g., MINIMAL, SOFT, SHARP)
- `density` — Spacing (e.g., COZY, COMPACT)
- `schemaVersion` — Schema version this template uses

**Template switching:**
- User can switch templates within same widget type
- Config is revalidated against target template's schema
- Unknown fields reset to target defaults
- Bob prompts "Save & switch" / "Discard & switch" / "Cancel" (NON_CARRYABLE guard)

### 3. Renderer (Server-Side)

Pure function that takes config and returns HTML.

**Renderer rules:**
- Pure function (no side effects)
- Server-side only (no client JS required for basic functionality)
- Uses Dieter components (semantic tokens)
- Escapes user input (XSS protection)
- Returns valid HTML string
- **Tokenization required:** Use CSS variables for patchable fields (see below)

**Location:** `venice/lib/renderers/{widgetType}.ts`

**Tokenization for Preview System:**

All widgets MUST be tokenized to support Bob's instant preview updates:

```css
/* ❌ WRONG: Hardcoded values (not patchable) */
.widget {
  border-radius: 12px;
  background: #3b82f6;
  padding: 16px;
}

/* ✅ RIGHT: CSS variables (patchable via postMessage) */
.widget {
  border-radius: var(--widget-radius, 12px);
  background: var(--widget-bg, #3b82f6);
  padding: var(--widget-padding, 16px);
}
```

**HTML Requirements:**
- Include `data-widget-element="<element-name>"` on patchable elements
- Set CSS variables in inline `style` attribute from config
- Variables enable instant preview updates without full reload

**Example:**
```html
<div
  class="widget"
  data-widget-element="container"
  style="--widget-radius: 12px; --widget-bg: #3b82f6; --widget-padding: 16px;">
  <!-- content -->
</div>
```

**See:** `documentation/widgets/testbutton.md` for complete tokenization reference

### 4. Styles (CSS)

Widget-specific styles using Dieter tokens.

**Style rules:**
- Use Dieter tokens (not hardcoded values)
- Support light/dark themes
- Responsive (desktop/mobile)
- No inline styles
- No `!important`

**Location:** Inline in renderer HTML output (Phase-1)

---

## Widget Catalog

**Widget catalog is defined by CEO, not AI.**

**Current catalog location:** `paris/lib/catalog.ts` (Phase-1 static source of truth)

**Phase-1 scope:** See `documentation/CONTEXT.md` section S8 for authoritative list.

**Individual widget PRDs:** Each implemented widget has its own PRD in `documentation/widgets/{widgetType}.md`

**DO NOT:**
- Invent new widget types
- Implement widgets not in catalog
- Create taxonomy structures
- Make up widget examples

**CEO defines:** Widget catalog, taxonomy, and which widgets to implement.

---

## How Widgets Are Built

### Step 1: Define the Schema

Create JSON schema in `widget_schemas` table. See existing schemas for reference.

### Step 2: Create Templates

Add template descriptors to static catalog in `paris/lib/catalog.ts` (Phase-1 source of truth).

### Step 3: Implement Renderer

Add rendering logic to Venice in `venice/lib/renderers/{widgetType}.ts`

### Step 4: Add Styles

Widget-specific CSS goes inline in the renderer's HTML output. Use Dieter tokens only.

### Step 5: Create Bob Controls

Add configuration UI to Bob tool drawer in `bob/app/bob/bob.tsx` (controls section based on widgetTypeState).

### Step 6: Test End-to-End

1. Create instance via Paris
2. Configure in Bob (manual or AI)
3. Publish
4. Embed on test page
5. Verify rendering in Venice
6. Test submissions
7. Check analytics

---

## Widget Development Principles

### 1. AI-First Design

**Every widget must be AI-legible:**
- Complete JSON schema (AI knows what's editable)
- Semantic tokens (AI understands structure)
- Documented templates (AI knows visual options)
- Clear renderer contracts (AI can modify safely)

**Wrong (AI can't understand):**
```html
<div class="p-4 bg-blue-500 rounded-lg shadow-md">
```

**Right (AI can understand):**
```html
<div class="diet-card" data-variant="primary" data-size="md">
```

### 2. Templates as Data

**No per-template code:**
- Templates are data (layout + skin + tokens + defaults)
- Same renderer for all templates of a widget type
- Switching templates = CSS/config change only

**Why?** So AI can suggest/create new templates without writing code.

### 3. Attributes-Only Contracts

**Use data attributes, not utility classes:**

```html
<!-- ✅ Right -->
<button class="diet-btn" data-variant="primary" data-size="lg">

<!-- ❌ Wrong -->
<button class="btn btn-primary btn-lg px-4 py-2 rounded">
```

### 4. Schema-Driven Everything

**If it's configurable, it's in the schema:**
- Bob generates controls from schema
- Paris validates against schema
- AI reads schema to understand widget
- No "hidden" configuration

### 5. Single Responsibility

**Each widget does one thing:**
- Contact form collects contact info (not a survey + newsletter combo)
- FAQ displays questions (not a form + testimonials)
- Keep widgets focused and composable

---

## Widget Submission Flow

For data-collecting widgets (forms, surveys, etc.):

```
1. User fills form in widget (on third-party site)
   ↓
2. Form submits to Venice POST /s/:publicId
   ↓
3. Venice validates:
   - Rate limits (60 req/min/IP, 120 req/min/instance)
   - Content-Type required
   - Body ≤ 64KB
   - Strip disallowed fields
   ↓
4. Venice proxies to Paris POST /api/submit/:publicId
   ↓
5. Paris stores in widget_submissions table
   ↓
6. Paris returns success/error to Venice
   ↓
7. Venice returns to widget
   ↓
8. Widget shows success/error message
```

**Security model:**
- Third-party pages call Venice only (not Paris directly)
- Venice validates tokens/branding/entitlements
- Venice forwards to Paris over private channel
- CORS to Paris for embed origins disallowed

---

## Widget Analytics

### Events Tracked

- `load` — Widget rendered
- `view` — Widget in viewport
- `interact` — User interaction (click, focus, etc.)
- `submit` — Form submission
- `success` — Submission succeeded
- `error` — Submission failed

### Analytics Pixel

```
GET /embed/pixel?widget=:publicId&event=load&ts=...
```

**Privacy-safe:**
- No PII collected
- Respects DNT (Do Not Track)
- Returns 204 No Content
- Cache-Control: no-store

---

## For AIs Reading This

**When building or modifying widgets:**

1. **Read the schema first** — It defines what's configurable
2. **Tokenize for preview** — Use CSS variables for all patchable fields (see `testbutton.md`)
3. **Use Dieter components** — Check `dieter/dieteradmin/src/html/dieter-showcase/*.html` for canonical patterns
4. **Semantic tokens only** — `data-variant="primary"` not `class="bg-blue-500"`
5. **Pure renderer functions** — No side effects, server-side only
6. **AI-legible structure** — Can you explain what this widget does from its schema?

**When adding new widgets:**

1. Define schema (what's configurable)
2. Create template descriptors (visual styles)
3. Implement renderer with tokenization (CSS variables for patchable fields)
4. Add `data-widget-element` attributes on patchable elements
5. Add styles (CSS with Dieter tokens + CSS variables)
6. Build Bob controls (manual editing UI)
7. Implement postMessage patch handler (preview=1 only)
8. Test end-to-end (SSR + preview patches)

**When modifying existing widgets:**

1. Read current schema
2. Check if widget is tokenized (Phase-0 requirement)
3. Check if change requires schema update
4. Update renderer if needed (maintain tokenization)
5. Update Bob controls if needed
6. Update postMessage patch whitelist if adding fields
7. Test with existing instances (backward compatibility)

**Preview System Architecture:**

- **Production embeds:** Pure SSR HTML/CSS, no client JS required
- **Preview mode (`?preview=1`):** Venice injects patch script for instant updates
- **Tokenization:** CSS variables enable postMessage patches (no reload)
- **Security:** Origin whitelist, field whitelist, value validation
- **Draft tokens:** Server-side only, never exposed to browser

**Key questions to ask:**
- Can AI read the schema and know what's editable?
- Is the widget tokenized (CSS variables for patchable fields)?
- Does HTML include `data-widget-element` attributes?
- Can AI read the template and know the visual style?
- Can AI modify this safely without breaking things?
- Are we using semantic tokens (not utility classes)?
- Is the renderer pure (no side effects)?
- Is the patch handler whitelisting fields and validating values?

**If you're confused:**
- Check `documentation/widgets/testbutton.md` for tokenization reference
- Check `documentation/systems/bob.md` for preview system architecture
- Check `documentation/systems/Dieter.md` for component patterns
- Check `documentation/systems/venice.md` for rendering contracts
- Check `documentation/systems/paris.md` for API contracts
- Check existing widgets in `venice/lib/renderers/` for examples

---

## Common Mistakes

### ❌ WRONG: Hardcoded styles
```html
<div style="padding: 16px; color: blue;">
```

### ✅ RIGHT: Dieter tokens
```html
<div class="diet-card" data-variant="primary">
```

---

### ❌ WRONG: Per-template renderers
```typescript
function renderContactMinimal() { ... }
function renderContactModern() { ... }
```

### ✅ RIGHT: Single renderer with template data
```typescript
function renderContact(config, template) {
  // Apply template.layout, template.skin, etc.
}
```

---

### ❌ WRONG: Utility classes
```html
<button class="px-4 py-2 bg-blue-500 rounded">
```

### ✅ RIGHT: Semantic attributes
```html
<button class="diet-btn" data-variant="primary" data-size="md">
```

---

### ❌ WRONG: Client-side rendering required
```typescript
// Widget doesn't work without JavaScript
export function mount(el) { ReactDOM.render(<Widget />, el); }
```

### ✅ RIGHT: SSR with progressive enhancement
```typescript
// Widget works with just HTML/CSS, JS optional for interactivity
export function renderWidget(config): string { return html; }
```

---

## Next Steps

**For widget-specific documentation:**
- Each widget type should have its own doc in `documentation/widgets/{widgetType}.md`
- Example: `documentation/widgets/engagement.contact.md`

**For implementation examples:**
- Check `venice/lib/renderers/` for renderer implementations
- Check `bob/app/bob/controls/` for Bob control components
- Check `dieter/dieteradmin/src/html/dieter-showcase/` for Dieter patterns

**For testing:**
- Create test instance: See `documentation/systems/bob.md` "Creating a Test Widget"
- Test rendering: `curl http://localhost:3002/e/wgt_xxxxxx`
- Test submission: `curl -X POST http://localhost:3002/s/wgt_xxxxxx -d '{...}'`

---

## Competitor Analysis (Informative)

This section documents external delivery patterns to clarify why our SSR+strict‑CSP approach is deliberate. It is informative, not prescriptive.

### Competitor Learnings

What they do (observed across CommonNinja, Elfsight, Smash Balloon)
- Client‑side runtimes: central platform SDKs scan containers and mount React/Next widgets in the browser; per‑widget versioned bundles are fetched on demand.
- Viewer/iframe shells: dedicated viewer pages double as iframe targets; some use third‑party iframe‑resizer helpers.
- Cross‑origin surface & third‑party scripts: assets from multiple CDNs (e.g., Google Fonts, cdnjs) and, in some contexts, GTM/Mixpanel/Zendesk.
- Platform fit: WordPress‑first plugins and builder integrations (Wix/Shopify/Squarespace) with shortcode/div + script embeds.

What this achieves and why it works for their model
- Distribution & onboarding: “install in 1 click” in marketplaces; paste a shortcode/div and it “just works.”
- Feature velocity & interactivity: central JS runtimes ship new UI fast (load‑more, lightboxes, filters, animations).
- Analytics & iteration: built‑in tracking enables product loops; viewer shells standardize telemetry.
- Operational simplicity for client‑heavy stacks: fewer server renderers to maintain; most changes live in JS.

How we achieve the same benefits with our approach (without the trade‑offs)
- Distribution: universal iframe snippet works everywhere; optional versioned overlay loader for popups/bars; light platform wrappers (WP plugin/Shopify app) that only generate our snippet.
- Velocity: templates as data + Paris dryRun/confirm enable fast visual changes without shipping heavy JS; SSR renderers stay small and consistent.
- Interactivity: add tiny, per‑widget enhancement modules (strict budgets, our origin) only when truly needed; overlay loader provides event bus for overlays.
- Analytics: Venice pixel → Paris `/api/usage` gives KPIs without third‑party scripts in customer pages; strict CSP with nonce stays intact.
- Performance, privacy, reliability, cost: SSR first paint (5–10KB HTML/CSS), strong cache validators (ETag/Last‑Modified), fewer origins; no third‑party scripts/cookies in embeds.

### CommonNinja

1) What they do and how they do it
- Client‑side runtime (React/Next.js): A lightweight “viewer” page loads a bootstrap SDK (`commonninja.js`) which then pulls multiple Next.js chunk files and mounts the widget entirely in the browser.
- White‑label viewer domains: Widgets are served from branded viewer pages (e.g., `commonninja.site/...`) that initialize the client app.
- Third‑party instrumentation: Scripts for Google Tag Manager and Mixpanel (and optionally Zendesk) are injected under certain paths/environments.
- Platform detection: The viewer conditionally loads Wix’s SDK when it detects a Wix path, suggesting dedicated integrations for site builders.
- Styling mix: Evidence of mixed styling systems (CSS Modules with hashed classnames and likely styled‑components), which enables velocity but risks inconsistency.
- Fonts & network surface: Preconnects to Google Fonts and loads external font CSS; multiple external origins are required for the widget to render fully.

2) Why they do it that way (inferred)
- Feature velocity at scale: A single, central client runtime lets them ship features across many widget types without coordinating server releases.
- Rich interactivity: Complex client interactions (drag/drop, animations, live editors) are easiest in a full client app.
- Platform ecosystem support: Conditional SDKs (e.g., Wix) allow tighter integration with builders and marketplaces.
- Central analytics/tooling: Injecting GTM/Mixpanel enables unified analytics, funnels, and editor instrumentation.

3) Benefits of their approach
- Rapid iteration: Centralized JS bundles allow quick updates across all embeds.
- Deep client features: Complex, highly interactive widgets can be authored in one place.
- Distribution fit: Viewer pages and SDKs can integrate with website builders and app stores.
- Consolidated analytics: Out‑of‑the‑box tracking for product KPIs and editor usage.

4) How we achieve the same benefits with our approach (without the trade‑offs)
- SSR first‑paint with optional enhancement:
  - Venice returns complete HTML/CSS for immediate paint (fast LCP/INP) and reliability even under script blockers.
  - Where behaviors are truly needed, we add tiny, versioned enhancement modules per widget (opt‑in, strict budgets) loaded inside the iframe origin.
- Versioned overlay loader (popups/bars):
  - `/embed/v{semver}/loader.js` provides overlays and an event bus under ≤28KB gz; `/embed/latest/loader.js` is a stable alias.
  - No third‑party scripts; strict CSP with nonce enforced from the edge.
- Templates as data, not code:
  - Paris + Geneva handle descriptor/schema; switching uses `PUT` dry‑run/confirm to compute and apply safe transforms, enabling visual variety without client bloat.
- Analytics without third‑party embeds:
  - Venice pixel → Paris `/api/usage` provides privacy‑safe, compliant metrics without GTM/Mixpanel inside customer pages.
- Ecosystem compatibility:
  - Default is a universal iframe (works on WordPress, Wix, Shopify, Squarespace). Optional small loader for overlays where scripts are allowed.
  - Lightweight platform wrappers (plugins/apps) can generate the same snippet and expose minimal settings without changing runtime architecture.
- Operational advantages (cost and resilience):
  - CDN‑friendly SSR responses with ETag/Last‑Modified mean most views are cache hits/304s with tiny payloads (5–10KB) and minimal compute.
  - Fewer external origins reduce failure modes and ad‑blocker friction; strict CSP and no third‑party scripts lower compliance risk.

Summary
- CommonNinja optimizes for client‑side flexibility and analytics. We optimize for speed, privacy, and reliability, while still supporting rich features via server‑driven templates, optional small enhancements, and a versioned overlay loader. The result is better Core Web Vitals on host sites, simpler compliance, and lower operational risk — without sacrificing the ability to ship features quickly.

### Elfsight

1) What they do and how they do it
- Platform SDK + container scan: A central SDK (`https://static.elfsight.com/platform/platform.js`) scans the DOM for containers like `<div class="elfsight-app-<appId>">` and mounts widgets entirely client‑side.
- Versioned widget bundles: Pages preload explicit widget bundles (e.g., `.../app-releases/google-reviews/stable/v3.23.8/.../widget/googleReviews.js`) fetched from `elfsightcdn.com`.
- Viewer shell for iframe/script: A static viewer page sets OG/meta/icons, toggles an `iframe` class when embedded, and can be used standalone or within an iframe.
- Cross‑origin dependencies: Preconnects to `core.service.elfsight.com` (likely config/content API) and loads assets from `elfsightcdn.com` plus third‑party `cdnjs`.
- Auto‑resizing helper: Includes `iframeResizer.contentWindow.js` when iframed to postMessage size changes to parents that support it.
- Fonts/styling: Uses a system font stack with external font sources; multiple external origins participate in render.

2) Why they do it that way (inferred)
- Catalog velocity: One platform SDK with per‑widget bundles lets them iterate across many widget types quickly.
- Client interactivity: Rich, reactive experiences authored purely in the browser runtime.
- Broad embed support: Script embeds where allowed; iframe viewer fallback with auto‑resize when scripts are restricted.
- Distribution tooling: Viewer pages and explicit semver support caching/rollbacks and marketplace integrations.

3) Benefits of their approach
- Rapid feature rollout through a centralized client runtime.
- Highly interactive widget behavior without server deployments.
- Works across varied CMS/builders via script or iframe modes.
- Clear version control for bundles improves cache behavior and rollback safety.

4) How we achieve the same benefits with our approach (without the trade‑offs)
- SSR first‑paint + optional tiny enhancements:
  - Venice returns complete HTML/CSS for instant render; optional, small per‑widget enhancement JS (served from our origin) can add behavior when truly needed.
- Universal iframe + optional loader:
  - Default universal iframe works across WordPress/Wix/Shopify/Squarespace; optional versioned overlay loader `/embed/v{semver}/loader.js` for popups/bars where scripts are permitted.
- Templates as data:
  - Paris+Geneva compute safe transforms via `PUT` dry‑run/confirm, enabling design flexibility without heavy client runtimes.
- Privacy‑safe analytics:
  - Venice pixel → Paris `/api/usage` gives KPIs without GTM/third‑party scripts in customer pages; strict CSP with nonce enforced.
- Operational simplicity:
  - CDN‑friendly SSR responses (ETag/Last‑Modified, cache tiers) keep per‑view cost low; fewer external origins reduce failure modes and ad‑blocker friction.
- Auto‑resize, only if warranted:
  - Prefer predictable, responsive heights; if dynamic height is unavoidable, an optional, minimal resizer can be shipped from our origin (no third‑party), kept within strict budgets.

Summary
- Elfsight ships a central platform SDK with versioned widget bundles and supports both script and iframe modes, using third‑party helpers for iframe sizing. Our SSR+strict‑CSP model matches the distribution coverage (universal iframe + small loader) while delivering superior performance, privacy, and reliability — with room for targeted, lightweight enhancements when justified.

### Smash Balloon

1) What they do and how they do it
- Client‑side widgets (WordPress‑first): WP plugins enqueue JS/CSS, render a container/shortcode, and front‑end JS builds the feed in the browser.
- Runtime hydration & AJAX: Interactive features (expand comments, “Load more”, filters, lightboxes) rely on plugin JS; content is assembled dynamically on the client.
- Server‑side caching (likely): The plugin layer caches upstream social API responses (rate‑limit friendly), but the final markup is still rendered client‑side.
- Multi‑platform variants: Separate integrations for Shopify/Squarespace/etc., but the embed pattern remains container + client JS.

2) Why they do it that way (inferred)
- Rich interactivity: Social feeds require pagination, sorting, media viewers, and filtering—convenient to implement in a browser runtime.
- Velocity: Shipping new front‑end JS across many feed types is faster than coordinating server renderers per feed.
- API ergonomics: Client runtime orchestrates incremental fetches and UX, while the plugin manages tokens/caching behind the scenes.

3) Benefits of their approach
- Faster feature rollout across a large catalog of social feeds.
- Deep, dynamic UI patterns (lightboxes, animated grids, client‑side filters) without server changes.
- WP‑native install flows (shortcodes, settings pages) that are familiar to site owners.

4) How we achieve the same benefits with our approach (without the trade‑offs)
- SSR first paint with optional enhancements:
  - Venice returns full HTML/CSS for immediate paint (fast LCP/INP). When truly needed (e.g., load‑more), we ship a tiny, versioned enhancement module from our own origin under strict size budgets.
- Server caching + transforms (Paris/Geneva):
  - Fetch and cache upstream data server‑side, normalize it to schema, and render in Venice templates—no heavy client runtime required.
- Universal embed compatibility:
  - Default iframe snippet works across WP/Wix/Shopify/Squarespace even when scripts are restricted. For popups/bars, use our small versioned loader.
- Privacy & CSP:
  - No third‑party scripts/cookies inside embeds; strict CSP with nonce enforced. Analytics via Venice pixel → Paris avoids GTM/third‑party trackers on customer sites.
- Operational resilience & cost:
  - Cache‑friendly SSR (ETag/Last‑Modified, s‑maxage, 304) keeps per‑view cost low and reduces failures compared to shipping large JS bundles.

Summary
- Smash Balloon optimizes for client‑side richness and plugin‑based distribution. Our SSR‑first model delivers equivalent user‑visible features via server‑rendered templates and optional, small enhancements—while preserving Core Web Vitals, simplifying compliance, and keeping operational costs and failure modes down.
