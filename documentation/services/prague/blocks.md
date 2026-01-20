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

Supported block types (registered):
`big-bang`, `hero`, `split-creative-left`, `split-creative-right`, `split-creative-stacked`, `steps`, `outcomes`, `cta`, `minibob`, `navmeta`, `page-meta`.

### Block registry + validation (executed)

Prague validates widget page JSON at load time:
- Registry: `prague/src/lib/blockRegistry.ts`
- Loader: `prague/src/lib/markdown.ts`

Validation rules:
- A block may only include meta keys registered for its type (example: `visual`, `curatedRef`).
- Required copy keys are enforced per block type.

Required copy keys (enforced today):
- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline` (meta: `visual` allowed; `curatedRef` allowed)
- `split-creative-left|right|stacked`: `headline`, `subheadline` (meta: `curatedRef` allowed)
- `steps`: `title`, `items[]`
- `cta`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

Notes:
- `outcomes` currently has no enforced required keys, but expects `items[]` when used.

Blocks without required keys in the registry have no enforced required keys yet; use their component props below as the expected shape.

Only block types registered in `prague/src/lib/blockRegistry.ts` are supported at runtime. Other block folders that exist on disk but are not registered are legacy and must not be referenced in page JSON.

### Naming + taxonomy (non-negotiable)

This is where we win (or die). The filesystem is the taxonomy.

- **Folder names describe the block type**, not the page family: `hero/`, `steps/`, `cta/`, `minibob/`, `split-creative-left/`.
- **File names are kebab-case** and match the block type: `hero.astro`, `split-creative-left.astro`, `steps.astro`.
- **Variants prefer props over forks** when layout is the same; use distinct block types when layout diverges (e.g. `split-creative-left|right|stacked`).
- **Site chrome lives under `blocks/site/`** (Nav, Footer) and is not part of page JSON.

Examples:

```
prague/src/blocks/site/nav/Nav.astro
prague/src/blocks/site/footer.astro
prague/src/blocks/hero/hero.astro
prague/src/blocks/split-creative-left/split-creative-left.astro
prague/src/blocks/steps/steps.astro
prague/src/blocks/cta/cta.astro
```

### 2.1 Navigation

`site/nav/Nav.astro` (system-owned)
- Primary nav is derived from the URL and `resolveWidgetsMegaMenu()` (no page-authored `items[]` in the scalable path).
- The **Widgets** nav item behaves as:
  - Hover/focus opens the mega menu (CSS-only via `:has()` + `focus-within`)
  - “View all widgets” CTA links to `/{locale}/` (directory page)
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
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, curatedRef?: { publicId: string, locale: string, height?: string, title?: string } }`
- Owns: H1 + subhead + primary/secondary CTA + curated embed (optional)

Copy contract:
- `headline` and `subheadline` come from `blocks[].copy`.
- CTA labels come from Prague chrome strings (`prague.cta.*`), not from page copy.

**Contract (non-negotiable):**
- The hero visual is rendered only when a curated instance is explicitly provided via `curatedRef.publicId`.
- Pages opt in by adding `curatedRef.publicId` to the hero block in the canonical page spec.
- `visual: true` is legacy metadata only; it does not embed anything by itself.

**Embed rule (strict):**
- Prague embeds Venice with the canonical locale-free `publicId` and passes locale only as a query param.
- `wgt_curated_*.<locale>` is invalid and must 404 (no legacy support).

Acquisition preview hook:
- Hero headline and subheadline expose `data-ck-copy="heroTitle|heroSubtitle"` for personalization preview.
- The primary CTA label uses `data-ck-copy="ctaText"` for preview overrides.

### 2.3 Big bang

`blocks/big-bang/big-bang`
- Props: `{ headline: string, body: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string } }`

Copy contract:
- `headline`, `body`
- CTA labels come from Prague chrome strings (`prague.cta.*`), not from page copy.

### 2.4 Split creative (left/right/stacked)

`blocks/split-creative-left/split-creative-left`
`blocks/split-creative-right/split-creative-right`
`blocks/split-creative-stacked/split-creative-stacked`
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, curatedRef?: { publicId: string, locale: string, height?: string, title?: string } }`

Copy contract:
- `headline`, `subheadline`

Embed rules:
- Curated visuals render only when `curatedRef.publicId` is present.
- If missing, the block renders a visible stub (fail-visible in dev).

### 2.5 How-it-works (steps)

`blocks/steps/steps`
- Props: `{ title: string, subhead?: string, steps: { title: string, body: string }[] }`

Copy contract:
- `title` (required by registry, used as section heading)
- `items[]` (mapped to `steps[]`)

Acquisition preview hook:
- Steps header exposes `data-ck-copy="sectionTitle"` for personalization preview.

### 2.6 Outcomes

`blocks/outcomes/outcomes`
- Props: `{ title?: string, items: { title: string, body: string, eyebrow?: string }[] }`
- Used for proof points / outcomes tiles.

### 2.7 CTA

`blocks/cta/cta`
- Props: `{ headline: string, subheadline?: string, primaryCta?: { label: string, href: string } }`
- CTA label/href are currently derived from Prague chrome strings; per-block CTA metadata is ignored (reserved for future use).

Acquisition preview hook:
- CTA primary button uses `data-ck-copy="ctaText"` for personalization preview.

### 2.8 Minibob island

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
  - It may override the default `workspaceId` via env:
    - `PUBLIC_MINIBOB_WORKSPACE_ID_<WIDGET>`
    - fallback: `PUBLIC_MINIBOB_WORKSPACE_ID`
  - `publicId` is always derived as `wgt_main_{widget}` (no override).

## 3) Page templates (composition)

Page templates are just a list of blocks in a fixed order. Example (widget landing):
- site/nav (global chrome)
- hero
- split-creative-left/right/stacked (optional)
- steps
- outcomes (optional)
- cta
- minibob

## 4) Content mapping (Tokyo → Prague)

Prague is **JSON-only** for widget marketing pages in this repo snapshot.

- Canonical widget pages:
  - Source of truth: `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`
  - Prague renders `blocks[]` by `type` and embeds curated instances only when `curatedRef.publicId` is present.
  - Page JSON is layout + meta only; compiled strings override any inline `copy` in the JSON.
  - Strings are loaded from `prague-strings/compiled/v1/{locale}/widgets/{widget}.json` (overview) and `prague-strings/compiled/v1/{locale}/widgets/{widget}/{page}.json` (subpages), then merged into `copy`.
- Canonical overview is fail-fast for required meta blocks (`navmeta`, `page-meta`) and for per-block validation in the registry. See `prague/src/pages/[locale]/widgets/[widget]/index.astro`.

---

## Links

- Prague overview: `documentation/services/prague/prague-overview.md`
- Localization contract: `documentation/capabilities/localization.md`
