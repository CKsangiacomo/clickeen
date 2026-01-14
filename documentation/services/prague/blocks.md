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

### Naming + taxonomy (non-negotiable)

This is where we win (or die). The filesystem is the taxonomy.

- **Folder names describe the page family**, not implementation: `widget-landing/`, `widget-templates/`, `widget-examples/`, `widget-pricing/`, `site/`, `playground/`.
- **File names are kebab-case** and start simple: `hero.astro`, `stats.astro`, `features.astro`.
- **Variants use a suffix** (no new naming scheme): e.g. `hero-stacked.astro`, `features-compact.astro`.
- **No CamelCase “two-word” components** like `HeroWidget.astro` or `FeatureGrid.astro`. Those scale into naming drift.

Examples:

```
prague/src/blocks/site/nav/Nav.astro
prague/src/blocks/site/footer.astro
prague/src/blocks/widget-landing/hero.astro
prague/src/blocks/widget-landing/features.astro
```

### 2.1 Navigation

`site/nav/Nav.astro` (system-owned)
- Primary nav is derived from the URL and `resolveWidgetsMegaMenu()` (no page-authored `items[]` in the scalable path).
- The **Widgets** nav item behaves as:
  - Click/keyboard toggle: opens the mega menu (`<details>` + `<summary>`)
  - “View all widgets” CTA links to `/{locale}/widgets/` (route is not implemented; the directory page lives at `/{locale}/`)
- Widget secondary tabs are also derived from the URL:
  - `/[locale]/widgets/[widget]` → Overview
  - `/[locale]/widgets/[widget]/templates|examples|features|pricing`

`site/nav/widgetsMegaMenu.ts`
- Resolves mega menu content from the canonical widget registry + each widget’s `pages/overview.json` (hero block copy):
  - `headline` comes from `blocks[].id=="hero" && kind=="hero"` → `copy.headline`
  - `subheadline` comes from `blocks[].id=="hero" && kind=="hero"` → `copy.subheadline`
  - Source: `tokyo/widgets/{widget}/pages/overview.json` (optional locale overrides under `pages/.locales/{locale}/overview.json`)
 
`site/footer`
- Props: `{ locale: string }`

### 2.2 Hero

`widget-landing/hero`
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, websiteCreative?: { widgetType: string, locale: string, height?: string, title?: string } }`
- Owns: H1 + subhead + primary/secondary CTA + **deterministic hero visual**

**Contract (non-negotiable):**
- This is **not** a generic “slot”. The hero visual (when enabled) is always the website creative for:
  - `wgt_curated_{widgetType}.overview.hero`
- Pages enable the hero visual via the canonical page spec:
  - `tokyo/widgets/{widgetType}/pages/overview.json` → block `{ id: "hero", kind: "hero", visual: true }`

**Embed rule (strict):**
- Prague always embeds Venice with the canonical locale-free `publicId` and passes locale only as a query param.
- `wgt_curated_*.<locale>` is invalid and must 404 (no legacy support).

### 2.3 How-it-works

`widget-landing/steps`
- Props: `{ steps: { title: string, body: string }[] }`

### 2.4 Collections

`widget-landing/features`
- Props: `{ items: { title: string, body?: string }[] }`

`widget-templates/grid` (stub)
- Props: `{ items: { title: string, body?: string }[] }`

`widget-examples/grid` (stub)
- Props: `{ items: { title: string, body?: string }[] }`

`widget-pricing/plans` (stub)
- Props: `{ plans: { name: string, price: string, bullets: string[] }[] }`

`TemplateGallery` (later)
- Props: `{ items: { title: string, instanceRef: string }[] }`

`ExamplesGallery` (later)
- Props: `{ items: { title: string, instanceRef: string }[] }`

### 2.5 CTA

`widget-landing/cta`
- Props: `{ headline: string, subheadline?: string, primaryLabel: string, primaryHref: string }`

### 2.6 Minibob island

`site/minibob`
- Island: the only Prague section that ships JS.
- Responsibility: embed Bob in Minibob mode and bootstrap a demo instance.
- Structure (non-negotiable):
  - Stage: heading + subhead (from `tokyo/widgets/{widget}/pages/overview.json` block `minibob.copy`)
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
- site/nav
- widget-landing/hero
- widget-landing/steps
- widget-landing/features
- widget-landing/cta
- site/minibob

## 4) Content mapping (Tokyo → Prague)

Prague is **JSON-only** for widget marketing pages in this repo snapshot.

- Canonical widget pages:
  - Source of truth: `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`
  - Optional per-locale overrides: `tokyo/widgets/{widget}/pages/.locales/{locale}/{page}.json`
  - Prague renders `blocks[]` by `kind` and uses `visual: true` to embed website creatives deterministically.
- Canonical overview is fail-fast: `overview.json` must include required blocks (`hero`, `steps`, `features`, `cta`, `minibob`). See `prague/src/pages/[locale]/widgets/[widget]/index.astro`.
