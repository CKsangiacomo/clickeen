# Prague — Block Catalog (v0)

This doc is the **implementation contract** for building Prague pages at 100⁵ scale.

Goal: a small, reusable set of **primitives** and **blocks** that can compose all Prague page types (landing, features, templates, examples, pricing, create/install, platform pages).

## 1) Primitives (must be reusable everywhere)

### 1.1 Layout primitives (non-negotiable)

These are the core “stage/pod” concepts without using those names:
- `ck-canvas` — full‑bleed block surface (background + vertical rhythm).
- `ck-inline` — optional inline wrapper (max width + gutters). Anything “inline” lives inside this.

Rules:
- `ck-canvas` / `ck-inline` must not set `overflow`, `position`, or default centering.
- Scroll containers (carousels, horizontal galleries) own `overflow-x: auto` themselves.

Source: `prague/public/styles/layout.css`.

### 1.2 UI primitives (CSS utilities)

These are the atoms used inside blocks:
- Buttons: `ck-btn` (`primary|secondary|ghost`)
- Badge/pill: `ck-badge`
- Card surface: `ck-card`
- Media frame: `ck-media` (screenshots/video frames)

Typography uses Dieter utilities (e.g. `.heading-*`, `.label-*`, `.overline`, `.body-*`).

Source: `prague/public/styles/primitives.css`.

## 2) Blocks (page sections)

Blocks are **Astro components** in `prague/src/blocks/**`.
Blocks:
- receive data via props
- do not fetch
- do not read from filesystem
- use primitives for layout and UI

Non-visual blocks:
- `navmeta` and `page-meta` are data-only blocks (strings for navigation + SEO).
- They are present in `blocks[]` but are not rendered by the block renderer.

### Block registry + validation (executed)

Prague validates widget page JSON at load time:
- Registry: `prague/src/lib/blockRegistry.ts`
- Loader: `prague/src/lib/markdown.ts`

Validation rules:
- A block may only include meta keys registered for its type (example: `visual`).
- Required copy keys are enforced per block type.

Required copy keys (enforced today):
- `hero`: `headline`, `subheadline` (meta: `visual` allowed)
- `steps`: `title`, `items[]`
- `features`: `title`, `items[]` (meta: `visual` allowed)
- `cta`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

Blocks without required keys in the registry have no enforced required keys yet; use their component props below as the expected shape.

### Naming + taxonomy (non-negotiable)

This is where we win (or die). The filesystem is the taxonomy.

- **Folder names describe the block type**, not the page family: `hero/`, `steps/`, `features/`, `cta/`, `minibob/`.
- **File names are kebab-case** and match the block type: `hero.astro`, `features.astro`, `pricing-plans.astro`.
- **Variants prefer props over forks** (e.g., `creative-split` with `align`), only use suffixes when layout truly diverges.
- **Site chrome lives under `blocks/site/`** (Nav, Footer) and is not part of page JSON.

Examples:

```
prague/src/blocks/site/nav/Nav.astro
prague/src/blocks/site/footer.astro
prague/src/blocks/hero/hero.astro
prague/src/blocks/features/features.astro
```

### 2.1 Navigation

`site/nav/Nav.astro` (system-owned)
- Primary nav is derived from the URL and `resolveWidgetsMegaMenu()` (no page-authored `items[]` in the scalable path).
- The **Widgets** nav item behaves as:
  - Hover/focus opens the mega menu (CSS-only via `:has()` + `focus-within`)
  - “View all widgets” CTA links to `/{locale}/widgets/` (route is not implemented; the directory page lives at `/{locale}/`)
- Widget secondary tabs are also derived from the URL:
  - `/[locale]/widgets/[widget]` → Overview
  - `/[locale]/widgets/[widget]/templates|examples|features|pricing`

`site/nav/widgetsMegaMenu.ts`
- Resolves mega menu content from the canonical widget registry + each widget’s localized page JSON:
  - `title` comes from `blocks[].id=="navmeta" && type=="navmeta"` → `copy.title`
  - `description` comes from `blocks[].id=="navmeta" && type=="navmeta"` → `copy.description`
  - Source: `tokyo/widgets/{widget}/pages/overview.json` + compiled strings from `prague-strings/compiled/v1/{locale}/widgets/{widget}.json`

`site/footer`
- Props: `{ locale: string }`

Non-visual block contracts (required):
- `navmeta` (overview only) requires `copy.title` + `copy.description` or the build fails.
- `page-meta` (all widget pages) requires `copy.title` + `copy.description` or the build fails.

### 2.2 Hero

`blocks/hero/hero`
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, websiteCreative?: { widgetType: string, locale: string, height?: string, title?: string } }`
- Owns: H1 + subhead + primary/secondary CTA + **deterministic hero visual**

Copy contract:
- `headline` and `subheadline` come from `blocks[].copy`.
- CTA labels come from Prague chrome strings (`prague.cta.*`), not from page copy.

**Contract (non-negotiable):**
- This is **not** a generic “slot”. The hero visual (when enabled) is always the website creative for:
  - `wgt_curated_{widgetType}.overview.hero`
- Pages enable the hero visual via the canonical page spec:
  - `tokyo/widgets/{widgetType}/pages/overview.json` → block `{ id: "hero", type: "hero", visual: true }`

**Embed rule (strict):**
- Prague always embeds Venice with the canonical locale-free `publicId` and passes locale only as a query param.
- `wgt_curated_*.<locale>` is invalid and must 404 (no legacy support).

### 2.3 How-it-works

`blocks/steps/steps`
- Props: `{ title?: string, steps: { title: string, body: string }[] }`

Copy contract:
- `title` (required by registry, used as section heading)
- `items[]` (mapped to `steps[]`)

### 2.4 Outcomes

`blocks/outcomes/outcomes`
- Props: `{ title?: string, items: { title: string, body: string, eyebrow?: string }[] }`
- Used for proof points / outcomes tiles.

### 2.5 Collections

`blocks/features/features`
- Props: `{ title?: string, items: { title: string, body?: string }[] }`

`blocks/templates-grid/templates-grid` (stub)
- Props: `{ title?: string, items: { title: string, body?: string }[] }`

`blocks/examples-grid/examples-grid` (stub)
- Props: `{ title?: string, items: { title: string, body?: string }[] }`

`blocks/pricing-plans/pricing-plans` (stub)
- Props: `{ title?: string, plans: { name: string, price: string, bullets: string[] }[] }`

`TemplateGallery` (later)
- Props: `{ items: { title: string, instanceRef: string }[] }`

`ExamplesGallery` (later)
- Props: `{ items: { title: string, instanceRef: string }[] }`

### 2.6 CTA

`blocks/cta/cta`
- Props: `{ headline: string, subheadline?: string, primaryLabel: string, primaryHref: string }`

### 2.7 Minibob island

`blocks/minibob/minibob`
- Island: the only Prague section that ships JS.
- Responsibility: embed Bob in Minibob mode and bootstrap a demo instance.
- Structure (non-negotiable):
  - Stage: heading + subhead (from compiled strings for `blocks[].id=="minibob"`)
  - Pod: iframe only (Minibob takes full available width)
- Contract:
  - It must not introduce global CSS (only block-scoped styles).
  - It must not access host cookies/storage.
  - It must identify itself as the `minibob` subject (so Bob applies the MiniBob policy: flags/caps/budgets).
  - It must pass `workspaceId` + `publicId` via the iframe URL query params (Bob loads them on mount).
  - It may override the default `workspaceId` + `publicId` via env:
    - `PUBLIC_MINIBOB_WORKSPACE_ID_<WIDGET>` / `PUBLIC_MINIBOB_PUBLIC_ID_<WIDGET>`
    - fallback: `PUBLIC_MINIBOB_WORKSPACE_ID` / `PUBLIC_MINIBOB_PUBLIC_ID`

## 3) Page templates (composition)

Page templates are just a list of blocks in a fixed order. Example (widget landing):
- site/nav (global chrome)
- hero
- steps
- features
- cta
- minibob

## 4) Content mapping (Tokyo → Prague)

Prague is **JSON-only** for widget marketing pages in this repo snapshot.

- Canonical widget pages:
  - Source of truth: `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`
  - Prague renders `blocks[]` by `type` and uses `visual: true` to embed website creatives deterministically.
  - Strings are loaded from `prague-strings/compiled/v1/{locale}/widgets/{widget}.json` (overview) and `prague-strings/compiled/v1/{locale}/widgets/{widget}/{page}.json` (subpages), then merged into `copy`.
- Canonical overview is fail-fast for required meta blocks (`navmeta`, `page-meta`) and for per-block validation in the registry. See `prague/src/pages/[locale]/widgets/[widget]/index.astro`.

---

## Links

- Prague overview: `documentation/services/prague/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
