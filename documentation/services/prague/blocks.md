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

- **Folder names describe the page family**, not implementation: `widget-landing/`, `widget-features/`, `site/`, `playground/`.
- **File names are kebab-case** and start simple: `hero.astro`, `stats.astro`, `features.astro`.
- **Variants use a suffix** (no new naming scheme): `hero-stacked.astro`, `hero-animated.astro`, `features-compact.astro`.
- **No CamelCase “two-word” components** like `HeroWidget.astro` or `FeatureGrid.astro`. Those scale into naming drift.

Examples:

```
prague/src/blocks/site/nav/Nav.astro
prague/src/blocks/site/footer.astro
prague/src/blocks/widget-landing/hero.astro
prague/src/blocks/widget-landing/features.astro
prague/src/blocks/widget-landing/hero-stacked.astro
```

### 2.1 Navigation

`site/nav/Nav.astro` (system-owned)
- Primary nav is derived from the URL and `resolveWidgetsMegaMenu()` (no page-authored `items[]` in the scalable path).
- The **Widgets** nav item behaves as:
  - Hover: opens the mega menu
  - Click: navigates to `/{locale}/widgets/`
- Widget secondary tabs are also derived from the URL:
  - `/[locale]/widgets/[widget]` → Overview
  - `/[locale]/widgets/[widget]/templates|examples|features|pricing`

`site/nav/widgetsMegaMenu.ts`
- Resolves mega menu content from the canonical widget registry + each widget’s `pages/landing.md`:
  - `headline` comes from `## Headline`
  - `subheadline` comes from `## Subheadline`
  - Source: `tokyo/widgets/{widget}/pages/landing.md`
 
`site/footer`
- Props: `{ locale: string }`

### 2.2 Hero

`widget-landing/hero`
- Props: `{ headline: string, subheadline?: string }`
- Owns: H1 + subhead + primary/secondary CTA + preview slot

### 2.3 Proof

`widget-landing/stats`
- Props: `{ stats: { value: string, label: string }[] }`

`TestimonialsStrip` (later)
- Props: `{ quotes: { name: string, text: string }[] }`

### 2.4 How-it-works

`widget-landing/steps`
- Props: `{ steps: { title: string, body: string }[] }`

### 2.5 Collections

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

### 2.6 Meta FAQ (about the widget)

`widget-landing/meta-faq`
- Props: `{ items: { question: string, answer: string }[] }`
- Implementation: semantic `<details>` + `<summary>` (SSR only)

### 2.7 CTA

`widget-landing/cta`
- Props: `{ headline: string, subheadline?: string, primaryLabel: string, primaryHref: string }`

### 2.8 Minibob island

`site/minibob`
- Island: the only Prague section that ships JS.
- Responsibility: embed Bob in Minibob mode and bootstrap a demo instance.
- Structure (non-negotiable):
  - Stage: heading + subhead (from markdown)
  - Pod: iframe only (Minibob takes full available width)
- Contract:
  - It must not introduce global CSS (only block-scoped styles).
  - It must not access host cookies/storage.
  - It must bootstrap Bob via `postMessage` → `devstudio:load-instance` (same mechanism DevStudio uses).
  - It must identify itself as the `minibob` subject (so Bob applies the MiniBob policy: flags/caps/budgets).

## 3) Page templates (composition)

Page templates are just a list of blocks in a fixed order. Example (widget landing):
- site/nav
- widget-landing/hero
- widget-landing/stats
- widget-landing/steps
- widget-landing/features
- widget-landing/meta-faq
- widget-landing/cta
- site/minibob

## 4) Content mapping (Tokyo → Prague)

Content lives in `tokyo/widgets/{widget}/pages/*.md`.
Prague loads/derives block props from markdown sections (at build time).

Example keys for `landing.md`:
- `## Headline`
- `## Subheadline`
- `## Stats` (list)
- `## Steps` (list)
- `## Features` (list)
- `## Meta FAQ` (Q/A pairs)
- `## CTA`
- `## Minibob` (2 lines: heading, subhead)
