# Logo Showcase — PRD

STATUS: DRAFT

## 1) High level description of what the widget does
LogoShowcase renders a **header** + one or more **strips** of logos (each strip contains an ordered list of logos, optionally clickable) in one of two **Types** (Grid / Carousel). Users edit the widget in Bob; the widget runtime applies the saved state deterministically on `{ type: 'ck:state-update' }`.

## Subject Policy — Entitlements (current)

Tier values are defined globally in `packages/ck-policy/entitlements.matrix.json`.

Widget-specific enforcement lives in:
- `tokyo/product/widgets/logoshowcase/limits.json`

Use the limits mapping for paths + metrics; do not duplicate per-tier matrices here.

Entitlements mapping (must match `tokyo/product/widgets/logoshowcase/limits.json`):

```text
Key                    | Kind  | Path(s)                 | Metric/Mode          | Enforcement        | Notes
---------------------- | ----- | ----------------------- | -------------------- | ------------------ | -----------------------------
branding.remove        | flag  | behavior.showBacklink   | boolean (deny false) | load ignore; ops+publish reject | Bob gates/rejects editor ops; Roma rejects save before Tokyo
items.group.small.max  | limit | strips[]                | count                | ops+publish        | strip count limit group
items.group.medium.max | limit | strips[].logos[]        | count                | ops+publish        | per-strip logo count limit group
items.group.large.max  | limit | strips[].logos[]        | count-total          | ops+publish        | total logo count limit group
```

Current implementation note: `limits.json` maps Logo Showcase state paths to real `ck-policy` keys. Bob enforces the mapping during editor operations, and Roma save policy rejects non-entitled or over-limit saves before Tokyo receives submitted package bytes.

### Non-negotiable widget implementation patterns (LogoShowcase-specific; do not copy another widget)
These are required patterns to keep editor UX deterministic and prevent dead controls:
- **Runtime skeleton**:
  - Scope all queries within `[data-ck-widget="logoshowcase"]` (no global selectors for internals).
  - Validate state types up front (throw clear errors; no merges).
  - Handle `{ type: 'ck:state-update' }` by updating DOM/CSS only (no network work).
- **DOM contract (stable `data-role` hooks)**:
  - Root: `[data-ck-widget="logoshowcase"]` and `[data-role="logoshowcase"]`
  - Header: `[data-role="header"]`, title `[data-role="header-title"]`, subtitle `[data-role="header-subtitle"]`, Header CTA `[data-role="header-cta"]`
  - Core/strips container: `[data-role="logoshowcase-core"]`
  - Strip item container (generated): `[data-role="strip"]`
  - Logos list per strip: `[data-role="logos"]`
  - Logo tile (generated): `[data-role="logo"]`
  - Logo visual surface (tile inner): `[data-role="logo-visual"]` (runtime consumes materialized `logoFill`)
  - Optional caption: `[data-role="logo-caption"]`
- **Editor arrays pattern**:
  - Use `object-manager` + nested `repeater` templates for `strips[] → strips[i].logos[]` so editing/reorder is standard and stable.
- **Appearance schemas (must match Dieter controls)**:
  - Border uses `logoshowcase.appearance.cardwrapper.border` object (wired to `dropdown-border`)
  - Shadow uses `logoshowcase.appearance.cardwrapper.shadow` object (wired to `dropdown-shadow`)
  - Radius uses `logoshowcase.appearance.cardwrapper.radiusLinked` and `logoshowcase.appearance.cardwrapper.radius*` (linked/unlinked)

### What ships (authoritative widget definition)
The widget must be implemented as the standard Tokyo package (core runtime + contracts):
- `tokyo/product/widgets/logoshowcase/spec.json`
- `tokyo/product/widgets/logoshowcase/widget.html`
- `tokyo/product/widgets/logoshowcase/widget.css`
- `tokyo/product/widgets/logoshowcase/widget.client.js`
- `tokyo/product/widgets/logoshowcase/limits.json`

Editable/translatable text primitives are declared in `tokyo/product/widgets/logoshowcase/editable-fields.json`.

### Non-negotiable platform constraints
- **No fallbacks**: `widget.client.js` must not merge defaults. Missing required state must throw a clear error.
- **Deterministic runtime**: on `ck:state-update`, update DOM/CSS only (no network work).
- **Always apply platform globals**:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`
  - `CKCoreSize.applyCoreSize(state.coreSize, coreEl)`
- **Branding**: runtime applies the shared `tokyo/product/widgets/shared/branding.js`
  utility via `state.behavior.showBacklink`; no widget-owned branding path.
- **Width is Stage/Pod**: do not add a custom “widget width” control. Pod width mode/content width covers this.
- **Desktop/Mobile contract**: Pod settings frame the experience (width mode, padding, content width, radius), but **responsive behavior must still be explicitly defined by the widget** in `widget.html` + `widget.css` for arrays/items/subparts.

### Babel text primitive coverage

LogoShowcase is WIP but still declares the PRD 098 text primitive graph:

- `header.title`
- `header.subtitleHtml`
- `headerCta.label`
- `logoshowcase.strips[].logos[].name`
- `logoshowcase.strips[].logos[].caption`
- `logoshowcase.strips[].logos[].alt`
- `logoshowcase.strips[].logos[].title`

Repeatable declarations are expanded to concrete saved config paths before San Francisco receives them. The widget must not add `localization.json`, layer sidecars, text packs, or wildcard producer payloads.

## 2) Types + Motion modes (high level)
In Clickeen terms, **Type = miniwidget**. LogoShowcase has **two Types**:
- `grid` (static grid)
- `carousel` (motion engine with two modes: `paged` or `continuous`)

Type is selected in the **Content panel** (`logoshowcase.type`) and determines which controls appear (Section 4).

### Motion implementation (required, editor-only, works forever)
All motion behavior (paged + continuous) must reuse one shared “strip motion engine” so logic stays consistent.

**Shared DOM requirements for motion** (inside each strip):
- `[data-role="strip-viewport"]` (the scroll viewport)
- `[data-role="strip-track"]` (the horizontal track)
- Each logo tile element inside the track is a stable `[data-role="logo"]`

**Shared sizing rule (deterministic, no extra controls)**:
- Define a single computed tile width derived from logo height:
  - `--ls-tile-w: clamp(96px, calc(var(--ls-logo-h) * 3), 240px)`
  - `--ls-tile-w-mobile: clamp(80px, calc(var(--ls-logo-h-mobile) * 3), 200px)`
- Each `[data-role="logo"]` uses `flex: 0 0 var(--ls-tile-w)` (mobile uses `--ls-tile-w-mobile` under 900px).

**Shared update rule under `ck:state-update`**:
- Render DOM first (logos list) then (re)bind motion behavior per strip.
- No global timers; each strip manages its own interval and cleans up on the next update.

### Type: `grid`
- **User sees**: multi-row grid; all items visible; no motion.
- **Behavior**: no navigation.
- **Structure**: CSS grid.

### Type: `carousel` (motion)
`logoshowcase.typeConfig.carousel.mode` determines behavior:

#### Mode: `paged` (slides)
- **User sees**: one-row paged carousel; movement is discrete.
- **Step** (`logoshowcase.typeConfig.carousel.step`): `logo` (one tile at a time) or `page` (per viewport page).
- **Navigation**: optional arrows (`showArrows`), optional swipe/drag (`allowSwipe`).
- **Autoplay**: optional (`autoplay`, `autoSlideDelayMs`), uses `transitionMs` for animation.

**Paging math** (paged only):
- `viewportW = stripViewport.clientWidth`
- `tileW = resolved px width of the tile (desktop/mobile var)`
- `gap = spacing.gap` (or `spacing.mobileGap`)
- Compute:
  - `perPage = max(1, floor((viewportW + gap) / (tileW + gap)))`
  - `stepPx = (step == 'logo' ? 1 : perPage) * (tileW + gap)`
  - `pageCount = (step == 'logo') ? itemCount : ceil(itemCount / perPage)`
- `pageIndex = clamp(round(stripViewport.scrollLeft / stepPx), 0, pageCount - 1)`

**Implementation rule**:
- Animate via `animateScrollLeft(stripViewport, pageIndex * stepPx, transitionMs)` (requestAnimationFrame).
- When `allowSwipe=true`, enable scroll-snap on tiles; otherwise hide horizontal overflow.
- If `pauseOnHover=true`, pause autoplay while hovered.

#### Mode: `continuous` (marquee)
- **User sees**: continuous marquee.
- **Controls**: `speed` (px/sec), `direction`, `pauseOnHover`.
- **Structure**: duplicated list (A+B) + CSS animation translate.

**Implementation rule (CSS animation + measured duration)**:
- Render two copies of the logos list back-to-back inside `[data-role="strip-track"]`.
- Measure `distancePx = copyA.scrollWidth` after render.
- Set CSS vars (historical `ticker` names, used for continuous mode):
  - `--ls-ticker-duration: <distancePx / speed> seconds`
  - `--ls-ticker-from` / `--ls-ticker-to` based on `direction`
- Pause on hover when `pauseOnHover=true`.

## 3) ALL THE CONTROLS THAT ARE COMMON FOR THE 2 TYPES (by panel), what they change and how
This section lists **only controls that apply to every Type**. Type-specific controls are in Section 4.

### Global taxonomy + panel distribution (applies to this widget)
- **Arrays vs Items** (do not mix terms):
  - **Array**: `logoshowcase.strips[]` and `logoshowcase.strips[i].logos[]`
  - **Item**: `logoshowcase.strips[i]` (one strip) and `logoshowcase.strips[i].logos[j]` (one logo)
  - **DOM item container**: the DOM wrapper that renders one logo item (must be stable via `data-role`, see widget HTML contract in implementation).
- **Panel distribution by surface**:
  - **Content**: content model and arrays/items (strips/logos + per-item fields) + Type selection
  - **Layout**: sizing/spacing/arrangement for arrays/items (logo size, gaps, strip gaps)
  - **Appearance**: “paint” for surfaces (logo look/opacity/radius, tile background/border, header/CTA colors)
  - **Typography**: role-based text (header title/body)
  - **Settings**: shared Shell behavior only; website URL is account/workspace
    context outside widget instance state

### Panel: Content (common)
- **Type picker**: `logoshowcase.type`
  - **changes**: selects which miniwidget renders
  - **how**:
    - Use `segmented` for the Type picker (2 options: `grid`, `carousel`).
    - Bob uses `show-if="logoshowcase.type == '...'"` to show type-specific controls under the picker
    - runtime sets `data-type="<type>"` on widget root

- **Strips list (CRUD + reorder)**: `strips[]`
  - **changes**: how many logo rows/sections exist and their ordering
  - **how**:
    - runtime renders one strip container per item under `[data-role="logoshowcase-core"]`
    - each strip contains its own `[data-role="logos"]` list
    - `object-manager` uses `min=1`; the user cannot delete the final strip.

- **Logos list inside each strip (CRUD + reorder)**: `strips[i].logos[]`
  - **changes**: which logos are rendered inside that strip, the selected image fill, link behavior, and hover caption text
  - **how**:
    - runtime renders children under the strip’s `[data-role="logos"]`
    - nested `repeater` uses `min=1`; the user cannot delete the final logo in a strip.
- `logoshowcase.strips[i].logos[j].logoFill` → media-only logo image fill; `{ "type": "none" }` means no logo selected
    - `logoshowcase.strips[i].logos[j].name` → human label (and optional caption fallback if caption empty)
- `logoshowcase.strips[i].logos[j].href` → wrap logo in `<a>` if valid http(s)
- `logoshowcase.strips[i].logos[j].targetBlank=true` → set `target="_blank"`
- `logoshowcase.strips[i].logos[j].nofollow=true` → set `rel="nofollow noopener noreferrer"` (else `rel="noopener noreferrer"`)
- `logoshowcase.strips[i].logos[j].alt` → set `aria-label` on the logo surface
- `logoshowcase.strips[i].logos[j].title` → optional tooltip/title attribute on the logo surface
    - `logoshowcase.strips[i].logos[j].caption` → hover caption rendering (must be consistent across Types)

Note: Links and logo media fill are baseline product behavior (not tier-gated). Invalid URLs should render as non-clickable logos.

  - **Editor control**:
    - `strips[i].logos[j].logoFill` is edited using the global Dieter component `dropdown-fill` with `fill-modes="image"`
      - empty logo slots persist `{ "type": "none" }`
      - selected logos persist structured image fill truth under `logoFill`
    - the popover template stays minimal (caption/name only; see Section 4)
      - selecting an image updates `logoFill` through the shared media fill flow

- **Header (shared primitive)**: `header.*` + `headerCta.*`
  - **changes**: title/subtitle/CTA copy + placement/alignment + CTA styling
  - **how**:
    - runtime delegates to `window.CKHeader.applyHeader(state, widgetRoot)` (no widget-specific header DOM code)
    - Content-owned: `header.enabled`, `header.title`, `header.showSubtitle`, `header.subtitleHtml`, `headerCta.enabled`, `headerCta.label`, `headerCta.href`, `headerCta.iconEnabled`, `headerCta.iconName`, `headerCta.iconPlacement`
    - Layout-owned: `header.placement`, `header.alignment`, `header.ctaPlacement`, `header.gap`, `header.textGap`, `header.innerGap`
    - Appearance-owned: `appearance.headerCta.background`, `appearance.headerCta.textColor`, `appearance.headerCta.border`, `appearance.headerCta.radius`, `appearance.headerCta.sizePreset`, `appearance.headerCta.padding*`, `appearance.headerCta.iconSizePreset`, `appearance.headerCta.iconSize`

### Panel: Layout (common)
- **Logo size**: `logoshowcase.spacing.logoHeight` (used for both desktop + mobile)
  - **changes**: rendered logo height across all types
  - **how**: root CSS vars `--ls-logo-h` and `--ls-logo-h-mobile`

- **Gutter / spacing**: `logoshowcase.spacing.gap`, `logoshowcase.spacing.mobileGap`
  - **changes**: spacing between logos (within a strip)
  - **how**: root CSS vars `--ls-gap` and `--ls-gap-mobile`

- **Strip spacing (vertical gap between strips)**: `logoshowcase.spacing.stripGap`, `logoshowcase.spacing.mobileStripGap`
  - **changes**: vertical spacing between strips
  - **how**: root CSS vars `--ls-strip-gap` and `--ls-strip-gap-mobile`

- **Random order**: `logoshowcase.behavior.randomOrder`
  - **changes**: logo ordering within each strip
  - **how**: runtime deterministically shuffles `strips[i].logos[]` render order per strip
    - No `Math.random()` in runtime.
    - Shuffle must be stable across unrelated `ck:state-update` changes; it may only change when the strip's logo id list changes or when `behavior.randomOrder` toggles.
    - Deterministic seed input (per strip):
      - `seedString = strip.id + '|' + logos.map(l => l.id).join(',')`
    - Deterministic PRNG:
      - Convert `seedString` to an integer seed via a stable string hash (e.g., FNV-1a 32-bit).
      - Use a simple PRNG (e.g., xorshift32) to drive a Fisher–Yates shuffle.

- **Stage/Pod layout (platform)**: `stage.*`, `pod.*`
  - **changes**: container padding, width mode, radius, alignment
  - **how**: Bob auto-generates Stage/Pod Layout panel; runtime applies via `CKStagePod.applyStagePod(...)`
  - **important**: Pod width mode materially changes how Types present:
    - `pod.widthMode='fixed'` creates a centered “card/module” feel (good for Grid).
    - `pod.widthMode='full'` makes the widget span the available width (good for Carousel, especially continuous mode).

### Panel: Appearance (common)
- **Logo look**: `logoshowcase.appearance.logoLook`
  - **changes**: original vs grayscale
  - **how**:
    - original: no filter
    - grayscale: apply grayscale filter

- **Logo opacity**: `logoshowcase.appearance.logoOpacity`
  - **changes**: logo opacity
  - **how**: root CSS var `--ls-logo-opacity`

- **Per-logo tile styling (platform schemas; Dieter-backed)**:
  - **Fill**: `logoshowcase.appearance.itemBackground` (`dropdown-fill`)
  - **Border**: `logoshowcase.appearance.cardwrapper.border` (object schema; `dropdown-border`)
  - **Shadow**: `logoshowcase.appearance.cardwrapper.shadow` (object schema; `dropdown-shadow`)
  - **Radius**: `logoshowcase.appearance.cardwrapper.radiusLinked` + `logoshowcase.appearance.cardwrapper.radius*` (linked/unlinked)
  - **how**: runtime calls `CKSurface.applyCardWrapper(state.logoshowcase.appearance.cardwrapper, root)` which sets `--ck-cardwrapper-*` vars on the widget root; the logo tile CSS consumes them

- **Header text styling**: Typography roles `title` + `body`
  - **changes**: header title/subtitle font + text color
  - **how**: `CKTypography.applyTypography(...)` (no Appearance-level header text color controls)

- **CTA styling**: `appearance.headerCta.background`, `appearance.headerCta.textColor`, `appearance.headerCta.border`, `appearance.headerCta.radius`, `appearance.headerCta.sizePreset`, `appearance.headerCta.padding*`, `appearance.headerCta.iconSizePreset`, `appearance.headerCta.iconSize`
  - **changes**: CTA colors + border + radius + padding/icon sizing presets
  - **how**: `CKHeader.applyHeader(...)` writes `--ck-header-cta-bg`, `--ck-header-cta-fg`, `--ck-header-cta-border-*`, `--ck-header-cta-radius`, `--ck-header-cta-padding-*`, `--ck-header-cta-icon-size` on `.ck-headerLayout`

- **Stage/Pod appearance (platform)**: `stage.background`, `pod.background`
  - **changes**: container fills
  - **how**: `CKStagePod.applyStagePod(...)`

### Panel: Typography (common, auto-generated by Bob)
- **Roles**: shared Shell roles `title`, `body`, `button` under `typography.roles.*`
  - **changes**: header title/subtitle typography + CTA text typography (`typography.roles.body` is shown as “Subtitle” in the Typography panel)
  - **how**: `CKTypography.applyTypography(...)` roleMap binds header nodes + CTA to roles

## 4) Detailed spec for each type in Content panel + what changes in other panels when user changes type
Type is always selected in **Content**. Under the Type picker, show only the controls relevant to that type.

### Shared rule for cross-panel behavior
When a Type does not use a setting, the corresponding control must be **hidden** (not shown) and the runtime must not “approximate” behavior.
Type changes must not emit “side effect ops”. Hidden features may remain in state, but the runtime must **ignore** them deterministically for that Type.

### Shared rule: Type recommends Pod defaults (no implicit editor mutations)
Type selection defines a **recommended Pod preset** for that Type. These are product recommendations only.
- Changing type does not silently mutate unrelated state.
- Users can still change Pod in the standard Stage/Pod panel.
- Logo Showcase Core defaults do not contain Pod defaults. Pod is Shell state and comes from account Shell defaults.

### Content panel structure (always, for all types)
Below the Type picker, always show:
- **Strips** (`logoshowcase.strips[]`) using `object-manager`
  - `min=1`
- Inside each strip item, **Logos** (`logoshowcase.strips[i].logos[]`) using `repeater`
  - `min=1`

#### Logo item editor (required, global pattern)
Each logo item must use media-only `dropdown-fill` for the logo image, and keep the per-item UI minimal.
- **Logo image**: `dropdown-fill` bound to `logoshowcase.strips[i].logos[j].logoFill`
  - configured with `fill-modes="image"`
  - `{ "type": "none" }` means no logo selected
  - runtime image source is `logoshowcase.strips[i].logos[j].logoFill`
  - `template="..."` includes (allowed in all subjects):
    - `textfield` for `strips[i].logos[j].caption`
    - (optional) `textfield` for `strips[i].logos[j].name`

Then, below the strips editor, show the Type-specific controls listed in each Type section below.

#### Bulk “Logo details” modal (required UX for per-logo settings)
We keep `object-manager` + nested `repeater` for strips/logos. The modal is **additive** and exists only to edit per-logo “details” at scale.

- Entry point: a single button near the strips/logos editor: **“Logo details…”**
  - Always visible.
  - Opens the modal (no entitlement gating).
- Modal content: a table with **one row per logo**, including:
  - **Logo**: thumbnail + `name`
  - **URL**: `href` textfield
  - **Open in new tab**: checkbox → `targetBlank`
  - **Nofollow**: checkbox → `nofollow`
  - **Caption**: `caption` textfield
- Alt/title fields are optional but always allowed (no tier gating).
- Save behavior: the modal writes standard ops (`set`) to the underlying paths above; there is no special persistence logic.

**Implementation note (scales across many widgets):**
- This modal should be implemented as a reusable Bob primitive (generic “bulk edit table” for an array-of-items), configured by:
  - row source: flattened `strips[].logos[]`
  - columns: a list of `{ label, path, controlType }`
  - save: emits standard ops (`set`) only

#### AI behavior (Copilot, uses `websiteUrl`)
`websiteUrl` is a workspace setting (persistent on the workspace). It is not part of widget instance config.
Current Bob runtime does not edit or persist `websiteUrl`; that setting belongs
to the account/Roma settings surface when implemented.

If `websiteUrl` is present, Copilot may:
- Propose or rewrite LogoShowcase copy (header/CTA) based on the website URL.
- Propose `alt`/`title` values for logos using the website URL context plus the logos (name/caption and/or the selected image).

### Type = `grid`
#### Content panel (below Type picker)
- **Row gap (grid-only)**: `logoshowcase.spacing.rowGap`

#### Other panels when `grid` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='fixed'`
  - `pod.contentWidth=960`
  - `pod.padding=24` (linked)
  - `pod.radius='4xl'` (linked)
- **Desktop rendering**:
  - strips stack vertically with gap `logoshowcase.spacing.stripGap`
  - grid auto-fits columns based on tile width (derived from `logoshowcase.spacing.logoHeight`)
  - logo sizing uses `logoshowcase.spacing.logoHeight` + `logoshowcase.spacing.gap` + `logoshowcase.spacing.rowGap`
- **Mobile rendering**:
  - strips stack vertically with gap `logoshowcase.spacing.mobileStripGap`
  - grid auto-fits columns based on tile width (derived from `logoshowcase.spacing.logoHeight`)
  - logo sizing uses `logoshowcase.spacing.logoHeight` + `logoshowcase.spacing.mobileGap` + `logoshowcase.spacing.rowGap`

### Type = `carousel` (motion)
#### Content panel (below Type picker)
- **Mode**
  - `logoshowcase.typeConfig.carousel.mode` (`paged` | `continuous`)
- **Paged mode controls**
  - `logoshowcase.typeConfig.carousel.step` (`logo` | `page`)
  - `logoshowcase.typeConfig.carousel.showArrows`
  - `logoshowcase.typeConfig.carousel.allowSwipe`
  - `logoshowcase.typeConfig.carousel.autoplay`
  - `logoshowcase.typeConfig.carousel.autoSlideDelayMs` (show only if `autoplay=true`)
  - `logoshowcase.typeConfig.carousel.transitionMs`
- **Continuous mode controls**
  - `logoshowcase.typeConfig.carousel.speed`
  - `logoshowcase.typeConfig.carousel.direction` (`left|right`)
- **Shared**
  - `logoshowcase.typeConfig.carousel.pauseOnHover`

#### Other panels when `carousel` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='full'`
  - `pod.padding=16` (linked)
  - `pod.radius='none'` (linked)
  - Continuous mode often benefits from `pod.padding=0` if you want edge-to-edge motion.
- **Desktop rendering**:
  - strips stack vertically with gap `logoshowcase.spacing.stripGap`
  - paged mode uses one-row slides with deterministic per-page sizing
  - continuous mode uses duplicated list (A+B) marquee
- **Mobile rendering**:
  - strips stack vertically with gap `logoshowcase.spacing.mobileStripGap`
  - paged uses `logoshowcase.spacing.logoHeight` + `logoshowcase.spacing.mobileGap`
  - continuous uses the same marquee semantics per strip

## 5) What the defaults are (and if defaults are different for each type, what they are)
Defaults are the authoritative state shape. They must be complete (no missing paths).

### Decisions required (blockers) — must be resolved in defaults
If any item below is undecided, the implementer must stop and ask; do not guess.
We intentionally ship **no custom tint** in current. `appearance.logoLook` is limited to `original | grayscale` (no `customColor` mode).

### Asset Handling
- **Selection path**: logo images use the shared media-only `dropdown-fill` flow.
- **Persistence**: Logo Showcase stores structured image fill truth under `logoshowcase.strips[i].logos[j].logoFill`.
- **Runtime**: generated widget output renders the materialized `logoFill.image.src`. If the image source cannot be resolved, the logo fails at the named media boundary.

### Global defaults (apply to all types)

Logo Showcase factory defaults are **Core only**. Shared Shell defaults
(`header`, `headerCta`, `stage`, `pod`, shared typography, backlink, social
share, locale switcher, and `coreSize`) come from account Shell defaults and are
resolved into the instance before Bob opens it.

The Core factory default starts with one strip containing six logo slots. Each
slot persists `logoFill: { "type": "none" }`, so new instances open with real
empty `dropdown-fill` controls instead of product-owned fallback logos, CSS
string fills, or sidecar asset metadata.
Logo Showcase does not keep product-owned logo files under its widget source
folder; Clickeen-authored example logos are normal account assets owned by the
admin account.

Core factory defaults live under:

```text
uiLabels.core.*
logoshowcase.type
logoshowcase.strips[]
logoshowcase.spacing.*
logoshowcase.behavior.randomOrder
logoshowcase.appearance.*
logoshowcase.typeConfig.carousel.*
```

Logo Showcase does not expose SEO/GEO/schema/canonical defaults or controls in
current because no named public output path exists for them.

### Per-type Shell recommendations
Type recommendations primarily concern **Pod presets** because width/containment
changes the experience. These are not Logo Showcase Core defaults:
- **grid**: `pod.widthMode='fixed'`, `pod.contentWidth=960`, `pod.padding=24`, `pod.radius='4xl'`
- **carousel**: `pod.widthMode='full'`, `pod.padding=16`, `pod.radius='none'` (continuous mode often uses `pod.padding=0`)

Implementation requirement:
- Account Shell defaults provide the actual Pod starting values.
- The editor does not auto-apply Pod preset ops on type change.
- If a user wants the carousel-style Pod, they change it through the shared Stage/Pod controls like every other widget.

---

## Appendix A: Why EACH PRD must be written like this (the rule)
This rationale is universal across widgets. See `documentation/widgets/WidgetComplianceSteps.md` (Step -1) for the canonical “why” and the required policy matrix template.

## Appendix B: Competitor analysis artifacts (source material)
Captured under `documentation/widgets/LogoShowcase/CompetitorAnalysis/`:
- `Responsive Logo Showcase widget — Features (15+ custom settings).html`
- `Logo Showcase — Add Logo Carousel widget to your website [2025].html`
- `15+ Top Logo Showcase Templates for Websites [free].html`
- screenshots showing: type picker, size/spacing sliders, random order, logo look options
