# Widget Pages GTM System — “Gigantic Leap FW” (Overview/Templates/Examples/Features)

**Status:** EXECUTED  
**PRD #:** 042  
**Priority:** P0 (GTM leverage; scales across 100s of widgets)  
**Owner:** GTM Dev (Prague/Tokyo) + Product Dev (Bob/Widgets)  
**Date:** 2026-02-04  
**Executed:** 2026-02-10

Source strategy doc: [documentation/widgets/WidgetGTMStrategy.md](../../documentation/widgets/WidgetGTMStrategy.md)

---

## 0) As-built execution record (authoritative)

This PRD is executed. Core block-system outcomes are implemented in:
- `prague/src/lib/blockRegistry.ts`
- `prague/src/components/WidgetBlocks.astro`
- `tokyo/widgets/*/pages/*.json`

When this document conflicts with runtime code/contracts, runtime code is the source of truth.

---

## 1) Problem Statement

Today, widget pages are structurally “good enough” but not systematically excellent.

What’s missing is a repeatable, high-signal system that:
- Communicates value fast (clear promise + differentiator)
- Proves capability immediately (live + real embeds)
- Makes Clickeen moats obvious (control moat + global moat + platform trust)
- Scales across many widgets and page intents without bespoke design work

We want a **systemic** upgrade where every widget gets a set of pages that feel premium, convert, and remain easy to maintain.

---

## 2) Core Decision

We ship a **standardized widget-page framework** composed of:
- A shared set of narrative “sections” (hero → live try → proof showoffs → moat blocks → trust strip → CTA)
- A small number of **new blocks** to enable premium interactions (carousel, mobile showcase, feature explorer)
- A content model + templates that can be stamped out per widget and per page type

**Block budget:**
- **Visual section blocks:** 12 total.
- **Non-visual contract blocks:** `page-meta`, `navmeta` (these are validation-only “blocks”, not UI sections).

This is the “gigantic leap forward”: pages become a productized system, not handcrafted marketing pages.

---

## 3) Current State (as-is)

### 3.1 Content architecture
- Widget pages are JSON-driven under `tokyo/widgets/<widget>/pages/<page>.json`.
- Prague renders blocks with strict validation via `prague/src/lib/blockRegistry.ts`.
- Runtime rendering uses `prague/src/components/WidgetBlocks.astro`.

### 3.2 Localization system constraints
- Prague build runs `scripts/prague-l10n/verify.mjs` which requires:
  - An allowlist per block type in `prague/content/allowlists/v1/blocks/<type>.allowlist.json`
  - A layer index per page under `tokyo/l10n/prague/<pageId>/index.json`
  - Overlays per page/locale/fingerprint under `tokyo/l10n/prague/<pageId>/locale/<locale>/<fingerprint>.ops.json`
  - **Base snapshots** per page/fingerprint under `tokyo/l10n/prague/<pageId>/bases/<fingerprint>.snapshot.json`

**Best-available overlays are a core contract.** If a locale overlay is stale (index points to an older fingerprint), Prague can still apply it safely *only if* the corresponding base snapshot exists.

### 3.3 Existing blocks
- `hero`, `split`, `steps`, `big-bang`, `minibob`, `cta-bottom-block`, etc.

**Existing visual blocks (baseline library):**
- `hero`, `big-bang`, `split`, `steps`, `minibob`, `cta-bottom-block` (6)

**New visual blocks proposed in this PRD (ship as one system):**
- Navigation + moats: `subpage-cards`, `locale-showcase`, `control-moat`, `global-moat`, `platform-strip`
- Proof + interaction: `embed-carousel`, `mobile-showcase`, `feature-explorer`

---

## 4) Goals

### 4.1 Product / GTM goals
1) Every widget has a coherent, premium set of pages:
   - `overview`
   - `templates`
   - `examples`
   - `features`
2) Pages demonstrate capability via:
   - Live try (“minibob”)
   - LocaleShowcase
   - Curated embed showoffs
3) Pages clearly communicate moats:
   - Control moat (design + translate controls)
   - Global moat (“Clickeen excellence” cards)
   - Platform strip (infra trust)

### 4.2 Platform goals
4) The system scales across 100s of widgets with minimal per-widget engineering.
5) Strict contracts remain intact: no “marketing-only hacks” that bypass validation.
6) Localization pipeline remains deterministic and easy to keep green.

---

## 5) Non-goals

- No new CMS backend: pages remain JSON-driven.
- No redesign of the entire Prague layout system.
- No “AI auto-generate all copy” promise: content may be assisted, but remains deliberate.
- No broad refactors unrelated to enabling the new page system.

---

## 6) Proposed Solution

### 6.1 Standard page wireframes (system contract)

These are *intent-based* page types that all widgets should implement.

**Overview**
- hero (PRD-driven promise)
- minibob (+ LocaleShowcase)
- split showoffs (proof)
- big-bang (impact statement)
- control moat (3 cards)
- global moat (6 cards)
- platform strip (3 trust cards)
- cta-bottom-block

**Templates**
- hero (templates promise)
- desktop carousel (`embed-carousel`)
- mobile proof (`mobile-showcase`)
- splits showcasing named template styles (curated embeds)
- big-bang
- control moat
- light/dark showcase (can be split/toggle)
- cta-bottom-block (Install template)

**Examples**
- hero (ICP promise)
- desktop carousel (`embed-carousel`)
- splits for primary ICPs
- big-bang
- mobile proof (`mobile-showcase`)
- global moat (tuned to ICP pains)
- platform strip (ICP trust)
- cta-bottom-block

**Features**
- hero (killer feature)
- feature explorer (`feature-explorer`)
- deep-dive splits (curated embeds where relevant)
- big-bang
- control moat
- global moat
- platform strip (technical excellence)
- cta-bottom-block

### 6.2 New blocks to build

This section is intentionally “contract-level”. After this PRD is approved, engineering should be able to implement the blocks + validation + allowlists without inventing new fields.

#### Shared conventions (all new blocks)

- **Block top-level shape:** `{ id?: string, type: <string>, copy?: <object>, ...meta }`
- **`copy` is the only localizable container** (strings only). All embeds/refs/config live in meta.
- **Embed references:** use one canonical shape everywhere.

Canonical embed reference (preferred):
```json
{ "publicId": "<string>" }
```

Alternate (allowed only if already used elsewhere):
```json
{ "curatedRef": { "publicId": "<string>" } }
```

If both are present, `curatedRef.publicId` wins.

---

#### Blocks (minimal new surface area; reuse primitives)

The intent is to keep the framework *working and scalable* with minimal new primitives:
- Prefer **reusing existing blocks** (`steps`, `split`, `hero`, `minibob`) over inventing new UI for every section.
- Keep new block types mostly as **semantic wrappers** so templates can be stamped out consistently across 100s of widgets.

---

#### A) `subpage-cards`
Purpose: lightweight navigation section that links to `templates/examples/features` with premium tiles.

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "subpage-cards"`
- `copy` (required)
- `links?` (optional; meta)

Required `copy` (allowlisted):
- `copy.title` (string)
- `copy.subhead?` (string)
- `copy.items[]` (array; length 3 recommended)
- `copy.items[i].title` (string)
- `copy.items[i].body` (string)

Optional meta:
- `links[]` (array; same order as `copy.items`), each item:
  - `page` (string; `"templates" | "examples" | "features"`)
  - `iconName?` (string; Dieter icon name)

Notes:
- If `links[]` is omitted, runtime maps the first 3 cards to `templates/examples/features`.

---

#### B) `locale-showcase`
Purpose: explicitly place the LocaleShowcase section (instead of implicit coupling to `minibob`).

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "locale-showcase"`
- `copy` (required)
- `curatedRef?` (optional; meta)

Required `copy` (allowlisted):
- `copy.title` (string)
- `copy.subtitle` (string)

Optional meta:
- `curatedRef.publicId?` (string; which instance to preview locales against)

Notes:
- If no `locale-showcase` block is present, Overview may still render a default LocaleShowcase after `minibob` (system default).
- If `curatedRef.publicId` is omitted, runtime falls back to the first block’s `curatedRef.publicId`, then `wgt_main_<widget>`.

---

#### C) `control-moat`, `global-moat`, `platform-strip`
Purpose: repeatable “cards” sections that communicate moats + platform trust.

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "control-moat" | "global-moat" | "platform-strip"`
- `copy` (required)
- `visual?` (optional; existing `steps` visual semantics)

Required `copy` (allowlisted):
- `copy.title` (string)
- `copy.subhead?` (string)
- `copy.items[]` (array; min 3)
- `copy.items[i].title` (string)
- `copy.items[i].body` (string)

Implementation note:
- These blocks should reuse the existing `steps` renderer to avoid bespoke styling code and keep motion/spacing consistent.

---

---

#### D) `embed-carousel`
Purpose: premium “gallery” that cycles curated embeds (desktop).
- Two embeds visible side-by-side on desktop
- Auto-scroll / auto-advance with pause-on-hover
- Deterministic order; supports N items
- Uses existing curated embed primitive(s)

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "embed-carousel"`
- `copy?`
- `items` (required)
- `options?`

Required `copy` (allowlisted):
- `copy.title?` (string)
- `copy.subhead?` (string)
- `copy.items?[]` (array of objects)
- `copy.items[i].label?` (string)

Required meta:
- `items[]` (array) where each item is:
  - `{ publicId: string }` OR `{ curatedRef: { publicId: string } }`

Optional meta:
- `options.visibleCountDesktop?` (number; default 2; allowed: 1 or 2)
- `options.visibleCountMobile?` (number; default 1; allowed: 1)
- `options.aspect?` (string; allowed: `"16:9" | "4:3" | "1:1"`)
- `options.autoplay?` (boolean; default true)
- `options.autoplayMs?` (number; default 6000; min 2500)
- `options.pauseOnHover?` (boolean; default true)

Example:
```json
{
  "id": "examples-carousel",
  "type": "embed-carousel",
  "copy": {
    "title": "Real examples",
    "subhead": "See what it looks like on live sites.",
    "items": [
      { "label": "FAQ" },
      { "label": "Pricing" },
      { "label": "Product tour" }
    ]
  },
  "items": [
    { "publicId": "curated/faq/desktop-01" },
    { "publicId": "curated/faq/desktop-02" },
    { "publicId": "curated/faq/desktop-03" }
  ],
  "options": { "visibleCountDesktop": 2, "aspect": "16:9", "autoplay": true, "autoplayMs": 6000 }
}
```

#### E) `mobile-showcase`
Purpose: mobile proof section with 4 mobile embeds side-by-side.
- Horizontal stack; responsive overflow
- Optional captions

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "mobile-showcase"`
- `copy?`
- `items` (required)
- `options?`

Required `copy` (allowlisted):
- `copy.title?` (string)
- `copy.subhead?` (string)
- `copy.items?[]` (array of objects)
- `copy.items[i].label?` (string)

Required meta:
- `items[]` (array) where each item is:
  - `{ publicId: string }` OR `{ curatedRef: { publicId: string } }`

Optional meta:
- `options.device?` (string; allowed: `"iphone" | "android"`)
- `options.visibleCountDesktop?` (number; default 4; allowed: 3 or 4)
- `options.visibleCountMobile?` (number; default 1; allowed: 1)

Example:
```json
{
  "id": "mobile-proof",
  "type": "mobile-showcase",
  "copy": {
    "title": "Looks native on mobile",
    "subhead": "Designed to feel like part of the page.",
    "items": [
      { "label": "Compact" },
      { "label": "Expanded" },
      { "label": "With images" },
      { "label": "Dark mode" }
    ]
  },
  "items": [
    { "publicId": "curated/faq/mobile-01" },
    { "publicId": "curated/faq/mobile-02" },
    { "publicId": "curated/faq/mobile-03" },
    { "publicId": "curated/faq/mobile-04" }
  ],
  "options": { "device": "iphone", "visibleCountDesktop": 4 }
}
```

#### F) `feature-explorer`
Purpose: map product capabilities to a browsable UI.
- Left: category pills (Content/Layout/Appearance/Typography/Translation/Settings)
- Right: grid of feature cards (icon + name + short description)
- Category state in URL hash is optional.

**Contract (JSON)**

Allowed fields:
- `id?`
- `type: "feature-explorer"`
- `copy` (required)
- `options?`

Required `copy` (allowlisted):
- `copy.title?` (string)
- `copy.subhead?` (string)
- `copy.categories[]` (array; min 3)
- `copy.categories[i].label` (string)
- `copy.categories[i].features[]` (array; min 1)
- `copy.categories[i].features[j].name` (string)
- `copy.categories[i].features[j].description` (string)

Required meta:
- None (all strings are in copy).

Optional meta:
- `options.columnsDesktop?` (number; default 3; allowed: 2 or 3)
- `options.defaultCategoryIndex?` (number; default 0)

Example:
```json
{
  "id": "features",
  "type": "feature-explorer",
  "copy": {
    "title": "Everything you need to match your site",
    "subhead": "Explore the editor like a product surface — not a list.",
    "categories": [
      {
        "label": "Layout",
        "features": [
          { "name": "Spacing & density", "description": "Tight or roomy — tuned per page." },
          { "name": "Sections", "description": "Show exactly what matters, hide the rest." }
        ]
      },
      {
        "label": "Appearance",
        "features": [
          { "name": "Colors", "description": "Match your palette and contrast rules." },
          { "name": "Corners & shadows", "description": "From minimal to expressive." }
        ]
      },
      {
        "label": "Typography",
        "features": [
          { "name": "Font + size", "description": "Align to your site’s scale." },
          { "name": "Hierarchy", "description": "Headings, labels, and body that read cleanly." }
        ]
      }
    ]
  },
  "options": { "columnsDesktop": 3, "defaultCategoryIndex": 0 }
}
```

### 6.3 Content templates + scaffolding

We need a repeatable way to generate new widget pages:
- Provide canonical `overview/templates/examples/features` page JSON templates
- Each template includes the standard section ordering and minimal placeholder copy
- Add a script to scaffold `tokyo/widgets/<widget>/pages/*.json` from templates

---

## 7) Requirements

### 7.1 Functional requirements
- New blocks render correctly in Prague.
- Blocks are fully contract-validated:
  - Added to `BlockType` and registry
  - Allowed meta fields defined
- Blocks are localizable:
  - Allowlist files exist for each block type
  - `scripts/prague-l10n/verify.mjs` passes
- CDN-first embed delivery remains intact:
  - Widget previews are served through Venice embed routes (snapshot-first)
  - Avoid production cache-busters (e.g. `ts=Date.now()`) except behind explicit dev/debug flags

**Required engineering deliverables:**
- Add block type + contract to `prague/src/lib/blockRegistry.ts`
- Add runtime renderer mapping in `prague/src/components/WidgetBlocks.astro`
- Create allowlists:
  - `subpage-cards`, `locale-showcase`, `control-moat`, `global-moat`, `platform-strip`
  - `embed-carousel`, `mobile-showcase`, `feature-explorer`
- Add one reference widget implementation across 4 pages in Tokyo (use an existing widget as the pilot)

### 7.2 UX requirements
- Carousels feel “Apple premium”: smooth motion, no jank, sensible spacing.
- All blocks must be responsive and look correct at common breakpoints.
- A11y:
  - Keyboard focus for controls
  - Reduced motion support where relevant

### 7.3 Performance requirements
- Avoid heavy client JS by default.
- Lazy-load embeds where possible.
- No layout thrash from carousel.

### 7.4 Workflow / environments (how we keep this scalable)

**Local dev**
- Canonical startup: `bash scripts/dev-up.sh`
- Prague: `pnpm dev:prague`

**Cloud-dev (shared Cloudflare + shared Supabase dev)**
- Pushing to `main` triggers `.github/workflows/cloud-dev-prague-content.yml` which:
  - Publishes Prague overlays to Tokyo R2 (`node scripts/prague-sync.mjs --publish --remote`)
  - Builds + deploys Prague Pages
  - Smoke-tests overlay headers on `/us/en/widgets/faq/` and `/us/fr/widgets/faq/`

**L10n status / generation**
- Status check: `node scripts/[retired]/prague-l10n-status` (best-available by default; add `--strict-latest` to see what’s missing for “latest”)
- Generate overlays + snapshots: `node scripts/prague-l10n/translate.mjs` (requires `SANFRANCISCO_BASE_URL` + `PARIS_DEV_JWT`; SanFrancisco must be configured with an AI provider key). Implementation detail: translations are **batched per page/locale** (fast) and the script will **auto-retry and split** if the provider returns malformed JSON.
- Publish overlays to R2: `node scripts/prague-sync.mjs --publish --remote` (publishes via Wrangler **bulk put**; add `--best-available` if you want to publish without requiring latest translations)

**Runtime debug signal**
- Prague pages send:
  - `x-prague-overlay-status: skipped | applied | missing | stale`
  - `x-prague-overlay-locale: <locale>`

---

## 8) Success Metrics

- Coverage: % of widgets with all 4 page types implemented.
- Conversion: uplift in create/start events from widget pages (baseline vs new system).
- Quality: reduction in “page feels inconsistent/bespoke” feedback.
- Reliability: Prague build stays green (including l10n verify) over time.

---

## 9) Rollout Plan

1) Lock the system spec (this PRD) and the deterministic wireframes (PagesDelta).
2) Implement the full block system in Prague:
   - `subpage-cards`, `locale-showcase`, `control-moat`, `global-moat`, `platform-strip`
   - `embed-carousel`, `mobile-showcase`, `feature-explorer`
3) Add allowlists for every new block type.
4) Ship one end-to-end widget as reference (FAQ or Countdown) across 4 pages.
5) Add the scaffolding script for faster widget onboarding.
6) Expand ICP/template catalogs.

---

## 10) Acceptance Criteria

- `pnpm --filter @clickeen/prague typecheck` passes.
- `pnpm --filter @clickeen/prague build` passes (including `scripts/prague-l10n/verify.mjs`).
- At least one widget has:
  - `overview`, `templates`, `examples`, `features` pages present in Tokyo
  - No runtime errors rendering blocks
  - New blocks render correctly and are responsive

**Block-level acceptance (must all be true):**
- `subpage-cards`: 3 premium tiles; keyboard focus visible; correct links for `templates/examples/features`
- `locale-showcase`: can be explicitly placed; defaults don’t double-render; can hide share chrome
- `control-moat`/`global-moat`/`platform-strip`: consistent card grid; responsive and readable
- `embed-carousel`: desktop shows 2 items; mobile 1; reduced-motion disables autoplay; keyboard reachable controls
- `mobile-showcase`: overflow behaves; captions optional
- `feature-explorer`: keyboard accessible category switching; deterministic default category

---

## 11) Open Questions

1) Confirm canonical embed reference shape: `publicId` vs `curatedRef.publicId` (this PRD proposes supporting both, with a clear precedence rule).
2) Should carousel/mobileshowcase be purely server-rendered (preferred) or require light client state?
3) Should features explorer categories be fully universal across widgets, or allow widget-specific categories?

---

## 12) Risks / Mitigations

- **Localization friction**: new blocks require allowlists + overlays.
  - Mitigation: add allowlists immediately and run translation step as part of rollout.
- **Missing base snapshots**: stale overlays can’t apply safely without snapshots.
  - Mitigation: ensure `translate.mjs` writes base snapshots and `prague-sync` publishes them to R2 alongside overlays and indices.
- **Overbuilding interaction**: carousel complexity can creep.
  - Mitigation: keep motion light, state minimal, and behavior deterministic.
- **Contract drift**: content authors may add fields not allowed.
  - Mitigation: strict validator is a feature; update allowlists/contracts deliberately.
