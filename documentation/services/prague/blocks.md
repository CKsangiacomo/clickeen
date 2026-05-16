# Prague — Block Catalog (v0)

This doc is the **implementation contract** for building Prague pages at 100⁵ scale.

Goal: a small, reusable set of **primitives** and **blocks** that can compose all Prague page types (landing, features, examples, pricing, create/install, platform pages).

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
`big-bang`, `hero`, `split`, `split-carousel`, `steps`, `subpage-cards`, `control-moat`, `global-moat`, `platform-strip`, `cta-bottom-block`, `minibob`, `locale-showcase`, `embed-carousel`, `mobile-showcase`, `feature-explorer`, `navmeta`, `page-meta`.

### Block registry + validation (executed)

Prague validates widget page JSON at load time:
- Registry: `prague/src/lib/blockRegistry.ts`
- Loader: `prague/src/lib/markdown.ts`

Validation rules:
- A block may only include meta keys registered for its type (example: `visual`, `accountInstanceRef`).
- Required copy keys are enforced per block type.

Required copy keys (enforced today):
- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline` (meta: `visual`, `accountInstanceRef`, `items`)
- `split`: `headline`, `subheadline` (meta: `layout`, `accountInstanceRef`)
- `split-carousel`: `headline` (meta: `layout`, `items`)
- `steps`: `title`, `items[]` (meta: `visual`)
- `subpage-cards`: `title`, `items[]` (meta: `links`)
- `control-moat`: `title`, `items[]` (meta: `visual`)
- `global-moat`: `title`, `items[]` (meta: `visual`)
- `platform-strip`: `title`, `items[]` (meta: `visual`)
- `locale-showcase`: `title`, `subtitle` (meta: `accountInstanceRef`)
- `cta-bottom-block`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `feature-explorer`: `categories[]`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

Notes:
- `embed-carousel` and `mobile-showcase` currently have no enforced required keys; they are meta-driven (`items`, `options`).

Blocks without required keys in the registry have no enforced required keys yet; use their component props below as the expected shape.

Only block types registered in `prague/src/lib/blockRegistry.ts` are supported at runtime. Other block folders that exist on disk but are not registered must not be referenced in page JSON.

Shared block schema + AI contracts live in the composition package:
- Block schemas: `prague/src/composition/blockSchemas.ts`
- AI contracts: `prague/src/composition/contracts.ts` (`BLOCK_CONTRACTS`)

### Naming + taxonomy (non-negotiable)

This is where we win (or die). The filesystem is the taxonomy.

- **Folder names describe the block type**, not the page family: `hero/`, `steps/`, `cta/`, `minibob/`, `split/`.
- **File names are kebab-case** and match the block type: `hero.astro`, `split.astro`, `steps.astro`.
- **Variants prefer props over forks** when layout is the same; use a layout prop instead of new block types.
- **Site chrome lives under `blocks/site/`** (Nav, Footer) and is not part of page JSON.

Examples:

```
prague/src/blocks/site/nav/Nav.astro
prague/src/blocks/site/footer.astro
prague/src/blocks/hero/hero.astro
prague/src/blocks/split/split.astro
prague/src/blocks/steps/steps.astro
prague/src/blocks/cta/cta.astro
```

### 2.1 Navigation

`site/nav/Nav.astro` (system-owned)
- Primary nav is derived from the URL and `resolveWidgetsMegaMenu()` (no page-authored `items[]` in the scalable path).
- The **Widgets** nav item behaves as:
  - Hover/focus opens the mega menu (CSS-only via `:has()` + `focus-within`)
  - “View all widgets” CTA links to `/{market}/{locale}/` (directory page)
- Widget secondary tabs are also derived from the URL:
  - `/[market]/[locale]/widgets/[widget]` → Overview
  - `/[market]/[locale]/widgets/[widget]/examples|features|pricing`

`site/nav/widgetsMegaMenu.ts`
- Resolves mega menu content from the canonical widget registry + each widget’s page JSON:
  - `title` comes from `blocks[].id=="navmeta" && type=="navmeta"` → `copy.title`
  - `description` comes from `blocks[].id=="navmeta" && type=="navmeta"` → `copy.description`
  - Authored source: `tokyo/prague/pages/{widget}/overview.json`; deployed R2 home: `prague/pages/{widget}/overview.json`

`site/footer`
- Props: `{ market: string, locale: string }`

Non-visual block contracts (required):
- `navmeta` (overview only) requires `copy.title` + `copy.description` or the build fails.
- `page-meta` (all widget pages) requires `copy.title` + `copy.description` or the build fails.

### 2.2 Hero

`blocks/hero/hero`
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, actionGroup?: ActionGroup, accountInstanceRef?: { accountPublicId: string, instanceId: string, locale: string, embedMode?: 'iframe' | 'indexable', height?: string, title?: string } }`
- Owns: H1 + subhead + primary/secondary CTA + account instance embed (optional)

Copy contract:
- `headline` and `subheadline` come from `blocks[].copy`.
- CTA labels come from Prague chrome strings (`prague.cta.*`), not from page copy.

**Contract (non-negotiable):**
- The hero visual is rendered only when an account instance is explicitly provided via `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId`.
- Pages opt in by adding the complete `accountInstanceRef` to the hero block in the canonical page spec.
- `visual: true` is legacy metadata only; it does not embed anything by itself.

**Embed rule (strict):**
- Prague embeds Venice with the canonical account-scoped route: `/widget/{accountPublicId}/{instanceId}`.
- Locale is passed only as a query param or embed option; locale is never encoded into `instanceId`.
- Prague must not depend on a hidden instance-only lookup, root `published/` registry, or instance-only `/widget/{instanceId}` route.
- `wgt_*`, `ins_*`, and `ins_*.<locale>` are invalid current product identities and must fail at the boundary (no legacy support).

**Embed mode (accountInstanceRef.embedMode):**
- default (omitted): iframe embed
- `indexable`: iframe++ SEO/GEO optimized embed (uses Venice loader + host metadata injection; UI stays iframe)

### 2.3 Big bang

`blocks/big-bang/big-bang`
- Props: `{ headline: string, body: string, primaryCta: { label: string, href: string }, secondaryCta?: { label: string, href: string }, actionGroup?: ActionGroup }`

Copy contract:
- `headline`, `body`
- CTA labels come from Prague chrome strings (`prague.cta.*`), not from page copy.

### 2.4 Split (consolidated)

`blocks/split/split`
- Props: `{ headline: string, subheadline?: string, primaryCta, secondaryCta?, actionGroup?, accountInstanceRef?, layout: 'visual-left' | 'visual-right' | 'stacked' }`
- Layouts: `visual-left`, `visual-right`, `stacked`

Copy contract:
- `headline`, `subheadline`

Embed rules:
- Account instance visuals render only when `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId` are present.

### 2.5 How-it-works (steps)

`blocks/steps/steps`
- Props: `{ title: string, subhead?: string, steps: { title: string, body: string }[] }`

Copy contract:
- `title` (required by registry, used as section heading)
- `items[]` (mapped to `steps[]`)

### 2.6 Split Carousel

`blocks/split-carousel/SplitCarousel.astro`
- Props: `{ headline: string, subheadline?: string, layout: 'visual-left' | 'visual-right' | 'stacked', items: any[] }`
- Used for: visual comparison sections where one side is a carousel of account instance embeds.

Copy contract:
- `headline`, `subheadline`

### 2.7 Subpage Cards (Overview navigation)

`blocks/subpage-cards/subpage-cards`
- Props: `{ title: string, subhead?: string, items: { title: string, body: string }[], links?: { page: 'examples'|'features'|'pricing', iconName?: string }[] }`
- Used for: Overview pages to deep-link into Examples/Features/Pricing.

Copy contract:
- `title`, `items[]` (and optional `subhead`)

### 2.8 Control moat (Design depth)

`blocks/control-moat/control-moat`
- Props: `{ title: string, subhead?: string, items: { title: string, body: string }[], visual?: any }`
- Used for: “Design control” deep dive sections.

Copy contract:
- `title`, `items[]` (and optional `subhead`)

### 2.9 Global moat (Localization/infra proof)

`blocks/global-moat/global-moat`
- Props: `{ title: string, subhead?: string, items: { title: string, body: string }[], visual?: any }`
- Used for: “Global by default / infra” proof sections.

Copy contract:
- `title`, `items[]` (and optional `subhead`)

### 2.10 Platform strip (Enterprise baseline)

`blocks/platform-strip/platform-strip`
- Props: `{ title: string, subhead?: string, items: { title: string, body: string }[], visual?: any }`
- Used for: quiet enterprise baseline reassurance.

Copy contract:
- `title`, `items[]` (and optional `subhead`)

### 2.11 CTA bottom block

`blocks/cta/cta` (`type: "cta-bottom-block"`)
- Props: `{ headline: string, subheadline?: string, primaryCta: { label: string, href: string } }`
- CTA label/href are standardized at the page level (Prague chrome / route config), not authored per-block.

Copy contract:
- `headline`, `subheadline`

### Action group (flexible CTA pattern)
`ActionGroup` supports CTA layouts beyond primary/secondary:
- Shape: `{ layout: 'row' | 'column' | 'grid', columns?: number, actions: [{ type: 'link' | 'button' | 'modal', variant: 'primary' | 'secondary' | 'ghost', label: string, href?: string, onClick?: string }] }`
- Legacy CTA props (`primaryCta`, `secondaryCta`) are still supported and map to an `ActionGroup` internally.

### 2.12 Locale showcase (Global proof)

`blocks/locale-showcase/locale-showcase`
- Purpose: show the **same instance** in a few real locales (default tiles: `en`, `es`, `ja`) to prove global-by-default and layout adaptivity.
- Props: `{ title: string, subtitle: string, accountInstanceRef?: { accountPublicId: string, instanceId: string } }`
- Placement:
  - Preferred: include a `locale-showcase` block explicitly in page JSON (deterministic placement).
  - Convenience: if a widget page includes `minibob` but no explicit `locale-showcase`, Prague injects a default locale showcase immediately after `minibob` (see `prague/src/components/WidgetBlocks.astro`).
- Instance selection:
  - If the explicit `locale-showcase` block provides `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId`, use that.
  - Else use the first complete account instance ref found in the page blocks.
  - Else do not embed an account instance. Prague must not infer an instance from widget type, `wgt_main_{widget}`, or any hidden instance-only lookup.

Copy contract:
- `title`, `subtitle`

### 2.13 Minibob block

`blocks/minibob/minibob`
- Island: the only Prague section that ships JS.
- Responsibility: render the public demo experience and send the visitor to account signup.
- Structure (non-negotiable):
  - Stage: heading + subhead (from compiled strings for `blocks[].id=="minibob"`)
  - Pod: public demo interaction or explicit account-scoped embed when configured
- Contract:
  - It must not introduce global CSS (only block-scoped styles).
  - It must not access host cookies/storage.
  - It must not boot Bob or start a draft handoff flow.
  - It must not derive storage identity from widget type. If it embeds a real example widget, that reference must be a normal account instance ref carrying `accountPublicId` + `instanceId` (`00000001` for admin examples).

## 3) Page Composition

Pages are lists of blocks in a fixed order. Example (widget landing):
- site/nav (global chrome)
- hero
- minibob
- subpage-cards (overview only)
- split / split-carousel (optional; page-specific)
- steps / control-moat / global-moat / platform-strip (page-specific)
- cta-bottom-block
- locale-showcase (explicit) or injected after minibob (default)

## 4) Content mapping (Tokyo → Prague)

Prague is **JSON-only** for widget marketing pages in this repo snapshot.

- Canonical widget pages:
  - Authored source in this repo: `tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json`.
  - Deployed R2 home: `prague/pages/{widget}/{overview|examples|features|pricing}.json`.
  - Prague renders `blocks[]` by `type` and embeds account instances only when a complete `accountInstanceRef` is present.
  - Prague validates `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId` during page load; missing account instances fail fast in dev/build.
  - Page JSON is layout + base copy.
  - Account-widget overlays are not Prague page overlays; they are resolved by Venice from Tokyo published overlay IDs when a Prague page embeds a live instance.
- Admin/example references:
  - Admin examples are normal account-owned instances under `accounts/00000001/instances/{instanceId}/`.
  - Prague page JSON must reference them as `{ "accountPublicId": "00000001", "instanceId": "{instanceId}" }`.
  - Prague must not store or resolve examples as old `wgt_*` / `ins_*` identities, account UUID folders, or an admin-specific storage lane.
- Canonical overview is fail-fast for required meta blocks (`navmeta`, `page-meta`) and for per-block validation in the registry. See `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro`.

---

## Links

- Prague overview: `documentation/services/prague/prague-overview.md`
- Localization contract: `documentation/capabilities/localization.md`

### 2.14 Embed Carousel (Premium)

`blocks/embed-carousel/embed-carousel`
- Props: `{ items: { accountInstanceRef: { accountPublicId: string, instanceId: string } }[], options: Object }`
- Behavior: Horizontal scroll snap carousel of lazy−loaded Clickeen widgets.
- Used for: "Made with Clickeen" galleries.

### 2.15 Mobile Showcase (Premium)

`blocks/mobile-showcase/mobile-showcase`
- Props: `{ items: any[], options: { device: 'iphone'|'android' } }`
- Behavior: Horizontal scroll of mobile device frames showing widget content.

### 2.16 Feature Explorer (Premium)

`blocks/feature-explorer/feature-explorer`
- Props: `{ categories: { name: string, features: Feature[] }[], options: Object }`
- Behavior: Tabbed/Pill navigation switching between feature grids. Client-side interactive.
