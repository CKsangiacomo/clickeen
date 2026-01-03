# SEO + GEO Platform Architecture

This document defines the architecture contracts for:
- **SEO**: Search Engine Optimization (Google/Bing indexing and rich results).
- **GEO**: Generative Engine Optimization (AI answer extraction, citation, and deep-linkability).

This is a platform capability. It applies across the 100⁵ surface:
- **Widgets** (100s): each widget type needs schema + deep links + extractable content.
- **Pages** (100s): Prague marketing/use-case pages and any Clickeen-owned pages embedding widgets.
- **Countries** (100s): localized schema metadata (`inLanguage`) and localized content when provided.
- **Use cases** (100s): schema variants (SaaS vs restaurant vs ecommerce) via business-type modeling.
- **Outputs** (100s): embed snippets, landing pages, emails, and other surfaces should carry the right schema/citation strategy.

As a result, this doc is cross-cutting and affects **Tokyo widget definitions**, **Venice embed**, **Bob editor schema**, **Paris entitlements**, and **SanFrancisco optimization**.

## 100⁵ SEO/GEO scale (why this is a platform moat)

SEO/GEO is not a “FAQ widget feature”. It is a horizontal moat that compounds with every new widget and every new locale:
- Every new widget type adds a new schema surface and new extractable content patterns.
- Every new locale multiplies schema output and validation requirements.
- Every embed/output surface becomes a distribution channel for the same core content.

Architectural implication: the system must be **widget-agnostic**. We cannot ship “100 widgets = 100 one-off schema implementations”.

## Platform primitives (shared contracts)

### 1) Schema generation is a platform service

Schema generation should be treated as a platform module that:
- Takes `{ widgetType, state, locale }` (plus an optional `businessType` discriminator from state).
- Outputs valid JSON-LD (deterministic, sanitized, plain text where required).
- Works for embeds and for Clickeen-owned pages.

**Execution model:** Venice owns schema generation (server-side), and embed loaders only inject the returned JSON-LD.

**Implementation approach (scales to 100 widgets):**
- A single schema generator with per-widget “schema mapping” definitions.
- Each widget declares which schema(s) it supports and how to map state paths → schema fields.
- The platform generator validates mappings and produces JSON-LD consistently.

FAQ is the first implementation. The contract must be designed so we can generalize without rewriting everything.

### 2) Deep links are a platform pattern

Deep links are not FAQ-specific. Any widget with “items” must support:
- Stable item IDs (state-level, not runtime-random).
- Anchor fragments (`#<widget>-<itemId>`).
- A deterministic “activate item from hash” behavior (scroll + expand/select as applicable).

This must work in Shadow DOM (default embed mode) and degrade gracefully via the loader’s hash handling.

### 3) Shadow DOM embed is the platform default (indexable mode)

Indexable embed must survive hostile host CSS. Shadow DOM is the platform default for UI rendering.
iframe remains an explicit fallback when origin-level isolation is required.

### 4) GEO optimization is cross-widget

“Direct-first, extractable content” applies across many widgets:
- FAQ answers
- testimonials/reviews
- product descriptions and feature lists
- pricing plan descriptions

GEO enforcement and AI-assisted rewrites should be implemented as reusable UX patterns and prompts, not widget-only hacks.

### 5) Localization and schema

Schema should include language metadata (`inLanguage`) when known.

Important contract:
- **UI i18n** (editor chrome, labels) is separate from **user content localization**.
- Widgets must not silently translate user content. If translations are desired, they are proposed via SanFrancisco and accepted via ops (Keep/Undo), same as other AI edits.

## Definitions (non-negotiable)

### SEO (Search Engine Optimization)
SEO is about making the **host page** eligible for search features and improving search understanding via:
- Correct, minimal **Schema.org JSON-LD** (e.g. `FAQPage`, plus the primary entity such as `Product` or `Organization`).
- Clean, semantic HTML structure (headings, lists, anchors).
- Canonical URL / stable URLs (owned by the host site, not the widget).

### GEO (Generative Engine Optimization)
GEO is about making content easy for LLM-driven engines to extract and cite:
- **Direct-first answers** (1–2 sentence quotable answer first, then details).
- **Length targeting** (short, dense answers for extraction).
- **Deep links** (stable per-question anchors so AI/search can cite a specific Q/A).

GEO is not “local SEO”. Local/NAP is a subset of SEO entity modeling.

## Core constraint: iframes do not carry SEO

If a widget is rendered inside an `iframe` (`/e/:publicId`), schema and semantic HTML live inside the iframe document.
Search engines do not reliably attribute that content to the **host page**, so SEO impact is weak and inconsistent.

**Conclusion:** Clickeen must support an **indexable embed mode** where the SEO-bearing markup is in the host DOM.

## Embed modes (platform contract)

### 1) Safe Embed (shipped): iframe
- Purpose: CSS isolation, predictable rendering, lowest integration risk.
- Venice route: `GET /e/:publicId` (complete HTML document).
- SEO: not a reliable channel.
- GEO: still valuable for user conversion, but not for host-page extractability/citation.

### 2) Indexable Embed (planned): inline
- Purpose: SEO + GEO that applies to the host page.
- Loader mounts content directly into a host `<div>` (no iframe).
- Schema is injected into the host `<head>` as `<script type="application/ld+json">…</script>`.
- Deep links are anchors in the host DOM (e.g. `#faq-q-<stableId>`).

This mode is the long-term platform for “SEO is a moat across 100s of widgets”.

Naming convention:
- `/e/:publicId` = **embed** (HTML document, intended for iframes)
- `/r/:publicId` = **render** (JSON payload for the indexable loader)

### Embed mode strategy (default vs fallback)

We ship both modes and choose the mode per instance via a single user-facing toggle:
- `state.seoGeo.enabled` (“Enable SEO/GEO Optimization”)

Default behavior:
- When `seoGeo.enabled === false`: default to **iframe** (safe embed).
- When `seoGeo.enabled === true`: default to **indexable embed (Shadow DOM UI)**.

This keeps the editor clean for the majority while enabling a “turn it on and go deep” moat path.

State shape (explicit):
```json
{
  "seoGeo": { "enabled": false },
  "seo": { "enableSchema": true, "businessType": "online-service" },
  "geo": { "answerFormat": "direct-first", "enableDeepLinks": true }
}
```

Recommended strategy:
- **Default when enabled:** indexable embed with **Shadow DOM UI**.
- **Fallback when disabled or required:** iframe embed (or explicit opt-in for compliance/security/legacy host constraints).

This yields:
- strong SEO attribution + GEO deep links when the user opts into optimization
- a clear escape hatch for origin-level isolation requirements

### Indexable embed: Shadow DOM is the default (recommended)

Inline embed without isolation is fragile on real sites (Tailwind/Bootstrap/resets/`!important`/font overrides).
For indexable embed, the platform default should be:
- **Render widget UI into a Shadow Root** (CSS isolation).
- **Inject Schema.org JSON-LD into host `<head>`** (SEO applies to host page).
- **Expose deep-link anchors** (GEO citation and scrollability).

Comparison:

| Approach | SEO | CSS isolation | Notes |
|---|---|---|---|
| iframe (safe) | weak/inconsistent | strong | shipped, lowest risk |
| inline (light DOM) | strong | fragile | likely to break on real host CSS |
| inline + Shadow DOM | strong | strong | recommended platform target |

### Deep links (anchor mechanism)

Default mechanism:
- Each FAQ question in the Shadow DOM has a stable `id` (e.g. `faq-q-<stableId>`).
- URL hash uses the same id (e.g. `#faq-q-<stableId>`).
- The loader listens to `hashchange` and on initial mount:
  - finds the element inside the shadow root
  - `scrollIntoView({ block: 'start' })`
  - opens/expands the target question

This keeps anchors “native” (hash is standard) while remaining robust across browsers that don’t auto-scroll into shadow content.

## SEO data model (widget state contract)

SEO settings are part of widget instance state (`state.seo`), owned by the widget definition:
- `seo.enableSchema: boolean`
- `seo.canonicalUrl: string` (optional; used as `url`/`@id` in JSON-LD, not as a host `<link rel="canonical">`)
- `seo.businessType: 'local' | 'online-service' | 'product-seller'`
- `seo.product.*` (only meaningful for `product-seller`)
- `seo.place.*` (only meaningful for `local`)

## SEO/GEO optimization gating (product rule)

The "Enable SEO/GEO Optimization" toggle is intentionally gated:

| Tier | SEO/GEO Access |
|------|----------------|
| Free | ❌ Disabled |
| Tier 1 | ✅ Enabled |
| Tier 2 | ✅ Enabled |
| Tier 3 | ✅ Enabled |

SEO/GEO is a Tier 1+ feature — it's one of the key reasons "serious" users upgrade from Free.

- **Bob (editor):** toggle exists in Settings, off by default, and only enabled for Tier 1+.
- **Minibob:** toggle cannot be turned on (Minibob is a demo surface; no SEO/GEO advanced mode).

Server-side enforcement (required):
- Publish should reject `seoGeo.enabled === true` for subjects without entitlement.
- UI gating is not sufficient; entitlements must be enforced at the product boundary.

### SEO schema output (deterministic rules)

Always emit:
- `FAQPage` with `mainEntity[]` questions/answers.

Additionally emit, based on `seo.businessType`:
- `product-seller`: `Product` (+ `Offer`/merchant URLs when provided)
- `online-service`: `Organization` (or a service entity) with support URLs when provided
- `local`: `LocalBusiness`/`Place` with address/geo/hours when explicitly enabled

Output format:
- Prefer a single JSON-LD payload with `{"@context":"https://schema.org","@graph":[ ... ]}`.

### Schema generation ownership (clear responsibility)

Schema generation must be **server-owned and deterministic**:
- **Owner:** Venice (embed origin).
- **When:** at embed render time (from the canonical instance snapshot).
- **How:** Venice constructs JSON-LD from instance state, stripping/normalizing any rich text.

Why Venice:
- It already fetches `{ widgetType, config }` from Paris for `/e/:publicId`.
- It is the stable public origin for embeds and can apply consistent caching.
- It keeps schema generation out of Bob (editor) and out of host page code (less drift, fewer XSS footguns).

Inline embed can still *inject* the schema via a loader, but the schema payload should come from Venice.

### Schema endpoint contract (indexable embed)

Indexable embed must have a single deterministic fetch contract:
- `GET /r/:publicId` returns:
  - `widgetType`
  - `state` (canonical instance config snapshot)
  - `schemaJsonLd` (string, already stripped to plain text for Q/A)
  - `renderHtml` (string, HTML fragment for Shadow DOM mount)
  - `assets.styles[]` (CSS hrefs to load inside the Shadow Root; must include `tokens.shadow.css`)
  - `assets.scripts[]` (JS srcs to load inside the Shadow Root, in dependency order)

The loader:
- injects `schemaJsonLd` into `document.head` as `<script type="application/ld+json">…</script>`
- mounts `renderHtml` into the container shadow root, then loads `assets.styles[]` + `assets.scripts[]`

Caching (required, deterministic):
- `GET /r/:publicId` is derived from the canonical instance snapshot and should use the same cache policy as `GET /e/:publicId` for published instances.
- Cache invalidation happens on publish (instance `updatedAt` changes, ETag/Last-Modified semantics apply).

## GEO data model (widget state contract)

GEO settings are part of widget instance state (`state.geo`):
- `geo.answerFormat: 'direct-first' | 'detailed'`
- `geo.maxAnswerLength: number` (character target for “extractable” answers)
- `geo.enableDeepLinks: boolean`

### GEO rendering rules (deterministic)

When `geo.enableDeepLinks === true`:
- Each FAQ item must have a stable DOM `id` and an anchorable URL fragment.
- The widget must support deep-link activation: if the URL hash targets a question, it should expand/open that question.

When `geo.answerFormat === 'direct-first'`:
- The editor/runtime must present answers in direct-first structure (manual or AI-assisted).
- AI optimizers may rewrite answers, but must preserve facts and links.

### GEO enforcement UX (concrete flow)

GEO enforcement must be explicit and user-controlled (no silent rewrites):
- **Manual:** user writes the answer in direct-first structure.
- **AI-assisted:** user clicks an action in Bob (e.g. “Rewrite to direct-first”) which:
  - calls SanFrancisco to propose a rewrite,
  - returns deterministic `ops[]`,
  - applies ops locally with the standard Keep/Undo pattern (no background auto-commit).

When `geo.maxAnswerLength` is set:
- Bob should surface a clear “over target” indicator and offer the same AI-assisted rewrite action.
- Publish should remain deterministic: no server-side “magic compression”.

## Engineering implications (what must change)

### Widget CSS + DOM scoping (required for inline embed)
Inline embed means widget CSS runs on the host page. Therefore:
- Widget CSS must not style `html`, `body`, `:root` globally.
- Widget CSS must be scoped under the widget root (e.g. `[data-ck-widget="faq"] …`).
- Shared layout wrappers (`stage`/`pod`) must not rely on global class selection.

### CSS isolation strategy (required for production host pages)

Scoping selectors is necessary but not sufficient. Real host pages frequently include:
- global resets (e.g. `* { margin:0; padding:0; }`)
- Tailwind/Bootstrap/base typography overrides
- `!important` and high-specificity selectors
- global keyframe names
- hostile focus/outline removal
- z-index stacking conflicts

Therefore, indexable embed should default to **Shadow DOM rendering** for UI:
- Widget UI CSS lives inside the shadow root.
- The host page cannot leak styles into the widget (and vice versa).
- We still keep schema and deep-link anchors on the host page for SEO/GEO.

Within the shadow root:
- Apply a minimal internal baseline (reset) plus Dieter tokens and widget styles.
- Treat font + color + spacing as explicitly defined inside the widget boundary (no reliance on host `body` styles).

### Fonts in Shadow DOM (explicit rule)

Shadow DOM isolates styling, but fonts must still be available to the document:
- Do not rely on host `body { font-family: ... }`.
- Ensure required fonts are loaded by Clickeen (e.g. by inserting the Google Fonts `<link>` into `document.head`).
- Inside the Shadow DOM, set `font-family` explicitly (typically via Dieter tokens / typography variables).

### Shared runtime modules (required change)
Shared modules must target the closest `data-role` wrappers within the widget scope, not generic selectors:
- Stage/Pod lookup must use `data-role="stage"` / `data-role="pod"` rooted from the widget scope element.

### Venice (indexable embed)
Venice owns the embed origin and must provide:
- A loader script for indexable embed (mount into host DOM).
- A render endpoint that returns JSON needed for inline mount (state + schema payload or HTML fragment).
- Cache behavior that is safe for published instances.

### Bob (editor UX + contracts)
Bob must expose:
- A dedicated SEO panel (schema/business type/product metadata).
- A dedicated GEO panel (answer format/length/deep links).
- Strict, visible failures when required fields are missing for enabled modes.

### SanFrancisco (automation)
SanFrancisco may implement:
- Scoring (SEO score, GEO score).
- “Fix all” ops generation to reformat answers (GEO) and recommend missing schema fields (SEO).

## Security model (inline embed)

Inline embed means widget JavaScript runs in the host page context. The platform contract must be explicit:

- **State is untrusted input** (even if authored in Bob). Rendering must not allow script injection via Q/A text.
- **Rich text must be sanitized** using an allowlist (tags + attributes) and safe URL rules (`http(s)` only).
- **Schema generation must strip HTML** and emit plain text for `Question.name` and `Answer.text`.
- Inline embed is powerful: it enables SEO/GEO, but it removes origin-level JS isolation.

The platform does not attempt to protect widgets from a malicious host page (the host can always break its own page).
It does guarantee:
- no global CSS leakage (Shadow DOM UI)
- no XSS via widget state rendering (sanitization + escaping)
- deterministic behavior and visible failures when contracts are broken

### Host data isolation contract (required)

Even though we control 100% of widget code (users cannot upload custom JS/CSS), **Shadow DOM does not sandbox JavaScript**.
Therefore we must enforce a strict “do not touch host data” contract in widget code.

Clickeen widgets MUST NOT:
- Read or write `document.cookie`
- Read or write `localStorage` / `sessionStorage` / `indexedDB`
- Query or mutate host DOM outside the widget boundary (except for inserting JSON-LD into `document.head`)
- Exfiltrate host data in network requests (never include cookies/DOM content in query params, headers, or bodies)

Clickeen widgets MAY:
- Read and write DOM **only inside their own Shadow Root** (or inside a container element for iframe mode)
- Inject schema JSON-LD into `document.head` (SEO), with a deterministic ID so it can be updated/removed
- Implement deep-link behavior by reacting to `location.hash` and scrolling/opening within the widget boundary (no scraping of host DOM)

Allowed host DOM mutations (strict):
- Insert/update a single JSON-LD `<script>` tag in `document.head`
- Otherwise, only touch the provided widget container + its shadow root

Enforcement (non-optional):
- Code review + deterministic runtime contracts
- ESLint rules to block `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB` usage in widget/runtime code
- Automated tests that fail on forbidden API usage (cheap grep/lint gate)

### When iframe is required (origin-level isolation)

iframe embed is still the correct choice when the customer explicitly requires:
- origin-level JS isolation (widget code must not run in host context)
- strict cookie/storage separation guarantees
- sandbox-style capability restriction via CSP/policies

These are edge cases for Clickeen-owned widget code, but the platform should support them as an explicit mode.

## Shipped vs planned

**Shipped today:**
- iframe embed via Venice `GET /e/:publicId`.

**Planned for SEO/GEO moat:**
- indexable embed mode (Shadow DOM UI) + schema injection + deep links on host page.

Implementation plan (FAQ first):
- `documentation/widgets/FAQ/FAQ_SEO_GEO_Plan.md`

## Verification (acceptance criteria)

SEO:
- JSON-LD validates (Schema.org validator + Google Rich Results Test).
- For a published instance, `schemaJsonLd` renders plain text (no HTML) for Q/A.

GEO:
- `#faq-q-<id>` scrolls and opens the correct question (on initial load and on hashchange).

Embed robustness:
- Widget looks correct on “hostile” pages (Tailwind preflight, Bootstrap, global resets) because UI lives in Shadow DOM.
