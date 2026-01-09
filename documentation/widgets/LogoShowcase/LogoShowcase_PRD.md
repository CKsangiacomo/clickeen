# Logo Showcase — PRD

STATUS: DRAFT

## 1) High level description of what the widget does
LogoShowcase renders a **header** + one or more **strips** of logos (each strip contains an ordered list of logos, optionally clickable) in one of four **Types** (Grid / Slider / Carousel / Ticker). Users edit the widget in Bob; the widget runtime applies the saved state deterministically on `{ type: 'ck:state-update' }`.

## Subject Policy — Flags / Caps / Budgets (Matrices)

X-axis is the policy profile: **DevStudio**, **MiniBob**, **Free**, **Tier 1**, **Tier 2**, **Tier 3**.

### Matrix A — Flags (ALLOW/BLOCK)

```text
Legend: A=ALLOW, B=BLOCK

Row                   | DS | MB | F  | T1 | T2 | T3
--------------------- |----|----|----|----|----|----
seoGeoEnabled         | A  | B  | B  | A  | A  | A
removeBranding        | A  | B  | B  | A  | A  | A
websiteUrlAllowed     | A  | B  | A  | A  | A  | A
logoLinksAllowed      | A  | B  | A  | A  | A  | A
logoMetaAllowed       | A  | B  | B  | A  | A  | A
```

**Flag key (details)**

```text
Flag key
Row                 | Path                        | Enforcement | Upsell | Meaning
------------------- | --------------------------- | ----------- | ------ | -------------------------
seoGeoEnabled       | seoGeo.enabled              | OPS+LOAD    | UP     | SEO/GEO optimization toggle
removeBranding      | behavior.showBacklink=false | UI+OPS      | UP     | Remove branding
websiteUrlAllowed   | workspace.websiteUrl        | UI+OPS      | UP     | Website URL for Copilot/AI content generation (workspace setting; not widget instance state)
logoLinksAllowed    | strips[i].logos[j].href / targetBlank / nofollow | UI+OPS | UP | Link URL + clickable behavior (Free+)
logoMetaAllowed     | strips[i].logos[j].alt / title | UI+OPS+LOAD | UP     | Alt/title meta (Tier 1+). When blocked (MiniBob/Free), must be forced empty on load + ops rejected.
```

### Matrix B — Caps (numbers)

```text
Legend: ∞ means “no cap”

Row                  |  DS |  MB |   F |  T1 |  T2 |  T3
-------------------- |-----|-----|-----|-----|-----|-----
maxStrips            |   ∞ |   1 |   2 |  10 |   ∞ |   ∞
maxLogosPerStrip     |   ∞ |   6 |  10 |  20 |   ∞ |   ∞
maxCaptionChars      |   ∞ |  40 |  80 | 120 |   ∞ |   ∞
maxHeaderTextHtmlChars|  ∞ | 140 | 200 | 300 |   ∞ |   ∞
```

**Cap key (details)**

```text
Cap key
Row                 | Path                    | Enforcement  | Violation | Upsell | Meaning
------------------- | ----------------------- | ------------ | --------- | ------ | -------------------------
maxStrips           | strips[]                | OPS(insert)  | REJECT    | UP     | Max strips
maxLogosPerStrip    | strips[i].logos[]       | OPS(insert)  | REJECT    | UP     | Max logos per strip
maxCaptionChars     | strips[i].logos[j].caption | OPS(set)  | REJECT    | UP     | Max caption length (chars)
maxHeaderTextHtmlChars | header.textHtml      | OPS(set)     | REJECT    | UP     | Max header subtitle length (chars)
```

### Matrix C — Budgets (numbers)

```text
Legend: ∞ means “no budget limit”

Row          |  DS |  MB |   F |  T1 |  T2 |  T3
------------ |-----|-----|-----|-----|-----|-----
uploads      |   ∞ |   5 |  10 |  50 | 200 |   ∞
copilotTurns |   ∞ |   4 |  20 | 100 | 300 |   ∞
edits        |   ∞ |  10 |   ∞ |   ∞ |   ∞ |   ∞
```

**Budget key (details)**

Budgets are **per-session counters**. When a budget reaches 0, the consuming action is blocked and the Upsell popup is shown.

```text
Budget key
Row          | Consumed when                           | Counts as            | Upsell | Notes
------------ | -------------------------------------- | -------------------- | ------ | -------------------------
uploads      | choose file for strips[i].logos[j].logoFill (dropdown-upload) | 1 per file chosen | UP     | in-editor (Data URL) selection
copilotTurns | Copilot prompt submit                   | 1 per user prompt    | UP     | —
edits        | any successful edit                     | 1 per state change   | UP     | continue editing your widget by creating a free account
```

### Non-negotiable widget implementation patterns (LogoShowcase-specific; do not copy another widget)
These are required patterns to keep editor UX deterministic and prevent dead controls:
- **Runtime skeleton**:
  - Scope all queries within `[data-ck-widget="logoshowcase"]` (no global selectors for internals).
  - Validate state types up front (throw clear errors; no merges).
  - Handle `{ type: 'ck:state-update' }` by updating DOM/CSS only (no network work).
- **DOM contract (stable `data-role` hooks)**:
  - Root: `[data-ck-widget="logoshowcase"]` and `[data-role="logoshowcase"]`
  - Header: `[data-role="header"]`, title `[data-role="title"]`, subtitle `[data-role="subtitle"]`, CTA `[data-role="cta"]`
  - Strips container: `[data-role="strips"]`
  - Strip item container (generated): `[data-role="strip"]`
  - Logos list per strip: `[data-role="logos"]`
  - Logo tile (generated): `[data-role="logo"]`
  - Logo visual surface (tile inner): `[data-role="logo-visual"]` (receives `logoFill` as background)
  - Optional caption: `[data-role="logo-caption"]`
- **Editor arrays pattern**:
  - Use `object-manager` + nested `repeater` templates for `strips[] → strips[i].logos[]` so editing/reorder is standard and stable.
- **Appearance schemas (must match Dieter controls)**:
  - Border uses `appearance.itemCard.border` object (wired to `dropdown-border`)
  - Shadow uses `appearance.itemCard.shadow` object (wired to `dropdown-shadow`)
  - Radius uses `appearance.itemCard.radiusLinked` and `appearance.itemCard.radius*` (linked/unlinked)

### What ships (authoritative widget definition)
The widget must be implemented as the standard 5-file Tokyo package:
- `tokyo/widgets/logoshowcase/spec.json`
- `tokyo/widgets/logoshowcase/widget.html`
- `tokyo/widgets/logoshowcase/widget.css`
- `tokyo/widgets/logoshowcase/widget.client.js`
- `tokyo/widgets/logoshowcase/agent.md`

### Non-negotiable platform constraints
- **No fallbacks**: `widget.client.js` must not merge defaults. Missing required state must throw a clear error.
- **Deterministic runtime**: on `ck:state-update`, update DOM/CSS only (no network work).
- **Always apply platform globals**:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`
- **Branding**: handled by `tokyo/widgets/shared/branding.js` (injects/toggles backlink via `state.behavior.showBacklink`; no widget-specific call required).
- **Width is Stage/Pod**: do not add a custom “widget width” control. Pod width mode/content width covers this.
- **Desktop/Mobile contract**: Pod settings frame the experience (width mode, padding, content width, radius), but **responsive behavior must still be explicitly defined by the widget** in `widget.html` + `widget.css` for arrays/items/subparts.

## 2) The 4 types (high level) and how the 4 types differ
In Clickeen terms, **Type = miniwidget**. A Type is defined by behavior + DOM/CSS structure + relevant controls.
Type is always selected in the **Content panel** (`state.type`), and it controls what appears under it (Section 4).

### Motion implementation (required, editor-only, works forever)
All motion types must reuse one shared “strip motion engine” so behavior is consistent and doesn’t accrete one-off logic.

**Shared DOM requirements for motion types** (inside each strip):
- `[data-role="strip-viewport"]` (the scroll viewport)
- `[data-role="strip-track"]` (the horizontal track)
- Each logo tile element inside the track is a stable `[data-role="logo"]`

**Shared sizing rule (deterministic, no extra controls)**:
- Define a single computed tile width derived from logo height:
  - `--ls-tile-w: clamp(96px, calc(var(--ls-logo-h) * 3), 240px)`
  - `--ls-tile-w-mobile: clamp(80px, calc(var(--ls-logo-h-mobile) * 3), 200px)`
- Each `[data-role="logo"]` uses `flex: 0 0 var(--ls-tile-w)` (mobile uses `--ls-tile-w-mobile` under 900px).

**Shared paging math** (used by Slider + Carousel):
- `viewportW = stripViewport.clientWidth`
- `tileW = resolved px width of the tile (desktop/mobile var)`
- `gap = spacing.gap` (or `spacing.mobileGap`)
- Compute:
  - `perPage = max(1, floor((viewportW + gap) / (tileW + gap)))`
  - `stepPx = perPage * (tileW + gap)`
  - `pageCount = ceil(itemCount / perPage)`
- Scroll position is the source of truth:
  - `pageIndex = clamp(round(stripViewport.scrollLeft / stepPx), 0, pageCount - 1)`

**Shared resize rule**:
- Attach `ResizeObserver` to each `[data-role="strip-viewport"]`.
- On resize, recompute `perPage/stepPx/pageCount` and snap to the nearest `pageIndex`.

**Shared update rule under `ck:state-update`**:
- Render DOM first (logos list) then (re)bind motion behavior for that strip.
- No global timers; each strip manages its own interval and cleans up on the next update.

### Type: `grid`
- **User sees**: each strip renders as a multi-row grid; all items are visible; no motion.
- **Behavior**: no motion, no navigation.
- **Structure**: CSS grid.

### Type: `slider` (paged)
- **User sees**: each strip is its own one-row, paged slider; user navigates pages per strip.
- **Behavior**: discrete page-to-page movement.
- **Navigation**: optional arrows, optional dots, optional swipe/drag.
- **Autoplay**: optional. If enabled, advances one page every `autoSlideDelayMs`. When it reaches the end, it wraps to the start (autoplay never “dies”).
- **Structure**: viewport + track translating in discrete steps.

**Implementation rule (simple + deterministic)**:
- Implement navigation by changing `stripViewport.scrollLeft` using a deterministic animation that respects `transitionMs`:
  - `animateScrollLeft(stripViewport, pageIndex * stepPx, transitionMs)` (requestAnimationFrame; cancel previous animation per strip)
- Dots count equals `pageCount` (computed).
- When `allowSwipe=true`, enable `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on tiles.
- When `allowSwipe=false`, set `overflow-x: hidden` on the viewport so manual scrolling doesn’t fight the state machine.

### Type: `carousel` (automatic discrete loop)
- **User sees**: each strip is its own one-row, automatically advancing loop.
- **Behavior**: discrete stepping loop (delay + transition), pauses on hover.
- **Navigation**: none (not part of this PRD).
- **Structure**: viewport + track + loop controller.

**Implementation rule (reuse slider paging)**:
- Carousel is “slider with autoplay always on and no UI”.
- Every `autoSlideDelayMs`, advance `pageIndex = (pageIndex + 1) % pageCount` and scroll.
- If `pauseOnHover=true`, pause the interval while the strip is hovered.

### Type: `ticker` (continuous marquee)
- **User sees**: each strip is its own one-row, continuously moving marquee.
- **Behavior**: continuous motion at steady speed, pauses on hover.
- **Navigation**: none.
- **Structure**: duplicated list (A+B) + CSS animation translate.

**Implementation rule (CSS animation + measured duration)**:
- Render two copies of the logos list back-to-back inside `[data-role="strip-track"]`:
  - `<div data-role="ticker-a">...</div><div data-role="ticker-b">...</div>`
- Measure `distancePx = tickerA.scrollWidth` after render.
- Set CSS vars:
  - `--ls-ticker-distance: <distancePx>px`
  - `--ls-ticker-duration: <distancePx / speed> seconds` (speed = `typeConfig.ticker.speed` interpreted as px/sec)
- Use keyframes translating from `0` to `-var(--ls-ticker-distance)` (direction flips sign).
- If `pauseOnHover=true`, set `animation-play-state: paused` on hover.

## 3) ALL THE CONTROLS THAT ARE COMMON FOR THE 4 TYPES (by panel), what they change and how
This section lists **only controls that apply to every Type**. Type-specific controls are in Section 4.

### Global taxonomy + panel distribution (applies to this widget)
- **Arrays vs Items** (do not mix terms):
  - **Array**: `strips[]` and `strips[i].logos[]`
  - **Item**: `strips[i]` (one strip) and `strips[i].logos[j]` (one logo)
  - **DOM item container**: the DOM wrapper that renders one logo item (must be stable via `data-role`, see widget HTML contract in implementation).
- **Panel distribution by surface**:
  - **Content**: content model and arrays/items (strips/logos + per-item fields) + Type selection
  - **Layout**: sizing/spacing/arrangement for arrays/items (logo size, gaps, strip gaps)
  - **Appearance**: “paint” for surfaces (logo look/opacity/radius, tile background/border, header/CTA colors)
  - **Typography**: role-based text (header title/body)
  - **Settings**: website URL (Copilot-only; policy-gated; workspace setting)

### Panel: Content (common)
- **Type picker**: `type`
  - **changes**: selects which miniwidget renders
  - **how**:
    - Use `dropdown-actions` for the Type picker (4 options). Do not use `choice-tiles` (it only supports 2–3 options).
    - Bob uses `show-if="type == '...'"` to show type-specific controls under the picker
    - runtime sets `data-type="<type>"` on widget root

- **Strips list (CRUD + reorder)**: `strips[]`
  - **changes**: how many logo rows/sections exist and their ordering
  - **how**:
    - runtime renders one strip container per item under `[data-role="strips"]`
    - each strip contains its own `[data-role="logos"]` list

- **Logos list inside each strip (CRUD + reorder)**: `strips[i].logos[]`
  - **changes**: which logos are rendered inside that strip, the selected image (in-memory while editing), link behavior, and hover caption text
  - **how**:
    - runtime renders children under the strip’s `[data-role="logos"]`
    - `strips[i].logos[j].logoFill` → CSS background for the logo tile (string value produced by `dropdown-upload`)
      - Editor-time value is an in-memory CSS fill string (e.g. `url("data:image/png;base64,...") center center / cover no-repeat`)
    - `strips[i].logos[j].name` → human label (and optional caption fallback if caption empty)
- `strips[i].logos[j].href` → wrap logo in `<a>` if valid http(s) (**editable via Logo details popup for Free+; not editable in MiniBob**)
- `strips[i].logos[j].targetBlank=true` → set `target="_blank"` (**editable via Logo details popup for Free+; not editable in MiniBob**)
- `strips[i].logos[j].nofollow=true` → set `rel="nofollow noopener noreferrer"` (else `rel="noopener noreferrer"`) (**editable via Logo details popup for Free+; not editable in MiniBob**)
- `strips[i].logos[j].alt` → set `alt` on the rendered `<img>` (or `aria-label` on the clickable logo surface if using background-image) (**editable via Logo details popup for Tier 1+; not editable in MiniBob**)
- `strips[i].logos[j].title` → optional tooltip/title attribute on the logo surface (**editable via Logo details popup for Tier 1+; not editable in MiniBob**)
    - `strips[i].logos[j].caption` → hover caption rendering (must be consistent across Types)

**Policy enforcement rule (required; no subject checks in runtime):**
- If `logoLinksAllowed` is blocked for the session:
  - Bob must force-clear `href/targetBlank/nofollow` on load, and reject any ops that set them.
- If `logoMetaAllowed` is blocked for the session:
  - Bob must force-clear `alt/title` on load, and reject any ops that set them.

  - **Editor control**:
    - `strips[i].logos[j].logoFill` is edited using the global Dieter component `dropdown-upload` (image accept)
      - value stored is a **CSS fill string** (same contract as other image fills)
    - the popover template stays minimal (caption/name only; see Section 4)
      - selecting an image while editing is in-memory only (Data URL fill)

- **Header enable + content**: `header.enabled`, `header.title`, `header.textHtml`, `header.alignment`
  - **changes**: whether header exists, text, and alignment
  - **how**:
    - runtime toggles `[data-role="header"]` visibility
    - `header.title` → `[data-role="title"].textContent`
    - `header.textHtml` → sanitized HTML into `[data-role="subtitle"]`
      - Allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br`
      - All other tags are unwrapped (keep text content; do not keep attributes)
      - Links:
        - Only allow `href` that starts with `http://` or `https://`
        - Strip all other attributes
        - If `target="_blank"`, force `rel="noopener"`; otherwise omit `rel`
    - `header.alignment` → `data-align` attribute on header root (`left|center|right`)

- **CTA enable + content**: `cta.enabled`, `cta.label`, `cta.href`, `cta.style`
  - **changes**: whether CTA exists, button label, click destination, and style variant
  - **how**:
    - runtime toggles `[data-role="cta"]` visibility
    - `cta.label` → button text
    - `cta.href` → set `<a href>` if valid http(s), else treat as empty/disabled
    - `cta.style` → `data-variant="filled|outline"` on CTA element

### Panel: Layout (common)
- **Logo size**: `spacing.logoHeight`, `spacing.mobileLogoHeight`
  - **changes**: rendered logo height across all types
  - **how**: root CSS vars `--ls-logo-h` and `--ls-logo-h-mobile`

- **Gutter / spacing**: `spacing.gap`, `spacing.mobileGap`
  - **changes**: spacing between logos (within a strip)
  - **how**: root CSS vars `--ls-gap` and `--ls-gap-mobile`

- **Strip spacing (vertical gap between strips)**: `spacing.stripGap`, `spacing.mobileStripGap`
  - **changes**: vertical spacing between strips
  - **how**: root CSS vars `--ls-strip-gap` and `--ls-strip-gap-mobile`

- **Random order**: `behavior.randomOrder`
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
    - `pod.widthMode='wrap'` creates a centered “card/module” feel (good for Grid).
    - `pod.widthMode='full'` makes the widget span the available width (good for Slider/Carousel/Ticker).

### Panel: Appearance (common)
- **Logo look**: `appearance.logoLook`
  - **changes**: original vs grayscale
  - **how**:
    - original: no filter
    - grayscale: apply grayscale filter

- **Logo opacity**: `appearance.logoOpacity`
  - **changes**: logo opacity
  - **how**: root CSS var `--ls-logo-opacity`

- **Per-logo tile styling (platform schemas; Dieter-backed)**:
  - **Fill**: `appearance.itemBackground` (`dropdown-fill`)
  - **Border**: `appearance.itemCard.border` (object schema; `dropdown-border`)
  - **Shadow**: `appearance.itemCard.shadow` (object schema; `dropdown-shadow`)
  - **Radius**: `appearance.itemCard.radiusLinked` + `appearance.itemCard.radius*` (linked/unlinked)
  - **how**: runtime applies these via CSS variables on the logo tile wrapper

- **Header colors**: `appearance.titleColor`, `appearance.textColor`
  - **changes**: header title/body colors
  - **how**: root CSS vars `--ls-title-color`, `--ls-text-color`

- **CTA styling**: `appearance.ctaBackground`, `appearance.ctaTextColor`, `appearance.ctaRadius`
  - **changes**: CTA colors + radius
  - **how**: root CSS vars `--ls-cta-bg`, `--ls-cta-fg`, `--ls-cta-radius`

- **Stage/Pod appearance (platform)**: `stage.background`, `pod.background`
  - **changes**: container fills
  - **how**: `CKStagePod.applyStagePod(...)`

### Panel: Typography (common, auto-generated by Bob)
- **Role: title** and **role: body** under `typography.roles.*`
  - **changes**: header typography (font/size/weight)
  - **how**: `CKTypography.applyTypography(...)` roleMap binds header nodes to roles

## 4) Detailed spec for each type in Content panel + what changes in other panels when user changes type
Type is always selected in **Content**. Under the Type picker, show only the controls relevant to that type.

### Shared rule for cross-panel behavior
When a Type does not use a setting, the corresponding control must be **hidden** (not shown) and the runtime must not “approximate” behavior.
Type changes must not emit “side effect ops”. Hidden features may remain in state, but the runtime must **ignore** them deterministically for that Type.

### Shared rule: Type recommends Pod defaults (no implicit editor mutations)
Type selection defines a **recommended Pod preset** for that Type (documented below as per-type defaults).
- Changing type does not silently mutate unrelated state.
- Users can still change Pod in the standard Stage/Pod panel.

### Content panel structure (always, for all types)
Below the Type picker, always show:
- **Strips** (`strips[]`) using `object-manager`
- Inside each strip item, **Logos** (`strips[i].logos[]`) using `repeater`

#### Logo item editor (required, global pattern)
Each logo item must use `dropdown-upload` for the logo image, and keep the per-item UI minimal.
- **Logo image**: `dropdown-upload` bound to `strips[i].logos[j].logoFill`
  - stored value is a CSS fill string (`url("...") center center / cover no-repeat` or `transparent`)
  - while editing, selected files are represented as Data URLs in state (in-memory)
  - `template="..."` includes (allowed in all subjects):
    - `textfield` for `strips[i].logos[j].caption`
    - (optional) `textfield` for `strips[i].logos[j].name`

Then, below the strips editor, show the Type-specific controls listed in each Type section below.

#### Bulk “Logo details” modal (required UX for per-logo settings)
We keep `object-manager` + nested `repeater` for strips/logos. The modal is **additive** and exists only to edit per-logo “details” at scale.

- Entry point: a single button near the strips/logos editor: **“Logo details…”**
  - Always visible.
  - Gated on interaction via the Upsell popup:
    - If `logoLinksAllowed` and `logoMetaAllowed` are both blocked: clicking opens Upsell and does nothing else.
    - Otherwise: open modal.
- Modal content: a table with **one row per logo**, including:
  - **Logo**: thumbnail + `name`
  - **URL**: `href` textfield
  - **Open in new tab**: checkbox → `targetBlank`
  - **Nofollow**: checkbox → `nofollow`
  - **Caption**: `caption` textfield
- Plan-gated columns inside the same modal:
  - **Free**: URL + targetBlank + nofollow + caption (no alt/title UI)
  - **Tier 1+**: add **Alt** (`alt`) + **Title** (`title`) fields (same tier as SEO/GEO)
- Save behavior: the modal writes standard ops (`set`) to the underlying paths above; there is no special persistence logic.

**Implementation note (scales across many widgets):**
- This modal should be implemented as a reusable Bob primitive (generic “bulk edit table” for an array-of-items), configured by:
  - row source: flattened `strips[].logos[]`
  - columns: a list of `{ label, path, controlType }`, with per-column gating driven by policy flags (`logoLinksAllowed`, `logoMetaAllowed`)
  - save: emits standard ops (`set`) only

#### AI behavior (Copilot, uses `websiteUrl`)
`websiteUrl` is a workspace setting (persistent on the workspace). It is not part of widget instance config.

If `websiteUrl` is present and policy allows it, Copilot may:
- Propose or rewrite LogoShowcase copy (header/CTA) based on the website URL.
- For **Tier 1+** (same plan as SEO/GEO), propose `alt`/`title` values for logos using the website URL context plus the logos (name/caption and/or the selected image).

### Type = `grid`
#### Content panel (below Type picker)
- **Grid columns**
  - `typeConfig.grid.columnsDesktop`
  - `typeConfig.grid.columnsMobile`
- **Row gap (grid-only)**
  - `spacing.rowGap`

#### Other panels when `grid` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='wrap'`
  - `pod.contentWidth=960`
  - `pod.padding=24` (linked)
  - `pod.radius='4xl'` (linked)
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - each strip uses `typeConfig.grid.columnsDesktop`
  - logo sizing uses `spacing.logoHeight` + `spacing.gap` + `spacing.rowGap`
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - each strip uses `typeConfig.grid.columnsMobile`
  - logo sizing uses `spacing.mobileLogoHeight` + `spacing.mobileGap` + `spacing.rowGap`

### Type = `slider`
#### Content panel (below Type picker)
- **Navigation**
  - `typeConfig.slider.showArrows`
  - `typeConfig.slider.showDots`
  - `typeConfig.slider.allowSwipe`
- **Autoplay**
  - `typeConfig.slider.autoSlide`
  - `typeConfig.slider.autoSlideDelayMs` (show only if `autoSlide=true`)
- **Motion**
  - `typeConfig.slider.transitionMs`
  - `typeConfig.slider.pauseOnHover`

#### Other panels when `slider` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='full'`
  - `pod.padding=16` (linked)
  - `pod.radius='none'` (linked) by default (full-width strips typically feel better without a card radius)
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - each strip is a one-row, paged “slides” carousel
  - number of logos visible per page is derived from available width and `spacing.logoHeight`/`spacing.gap` (deterministic layout)
  - if `typeConfig.slider.showArrows=true`, show arrows on desktop
  - if `typeConfig.slider.allowSwipe=true`, swipe/drag enabled
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - each strip is a one-row, paged “slides”
  - uses `spacing.mobileLogoHeight` and `spacing.mobileGap`
  - swipe/drag is the primary navigation surface (still gated by `allowSwipe`)
  - if arrows do not fit, they may be hidden via responsive CSS (deterministic by viewport)

### Type = `carousel`
#### Content panel (below Type picker)
- **Loop motion**
  - `typeConfig.carousel.autoSlideDelayMs`
  - `typeConfig.carousel.transitionMs`
  - `typeConfig.carousel.direction` (`left|right`)
  - `typeConfig.carousel.pauseOnHover`

#### Other panels when `carousel` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='full'`
  - `pod.padding=16` (linked)
  - `pod.radius='none'` (linked)
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - each strip is a one-row, discrete loop (delay + transition)
  - uses `spacing.logoHeight` + `spacing.gap`
  - direction from `typeConfig.carousel.direction`
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - same loop semantics per strip
  - uses `spacing.mobileLogoHeight` + `spacing.mobileGap`

### Type = `ticker`
#### Content panel (below Type picker)
- **Continuous motion**
  - `typeConfig.ticker.speed`
  - `typeConfig.ticker.direction` (`left|right`)
  - `typeConfig.ticker.pauseOnHover`

#### Other panels when `ticker` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='full'`
  - `pod.padding=0` (linked) by default (ticker is typically edge-to-edge)
  - `pod.radius='none'` (linked)
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - each strip is a continuous marquee, duplicated list (A+B)
  - uses `spacing.logoHeight` + `spacing.gap`
  - speed/direction from `typeConfig.ticker.speed` and `typeConfig.ticker.direction`
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - same marquee semantics per strip
  - uses `spacing.mobileLogoHeight` + `spacing.mobileGap`

## 5) What the defaults are (and if defaults are different for each type, what they are)
Defaults are the authoritative state shape. They must be complete (no missing paths).

### Decisions required (blockers) — must be resolved in defaults
If any item below is undecided, the implementer must stop and ask; do not guess.
We intentionally ship **no custom tint** in v1. `appearance.logoLook` is limited to `original | grayscale` (no `customColor` mode).

### Asset handling (scope for this PRD)
This PRD is for **editor-time widget UX** (Tokyo 5 files + Bob preview). It is not blocked on asset persistence.
- **Editor-time (Bob)**: `dropdown-upload` stores an in-memory CSS fill string (typically a Data URL fill) so preview can render immediately.
- **Persistence/publish**: handled in a later phase. When persistence ships, we will store stable asset references (URL/fileKey) instead of Data URLs.

### `dropdown-upload` contract (editor-time)
In the editor loop, `dropdown-upload` must not persist assets. It stores an in-memory value for preview, and persistence is handled later on Save/Publish.

### Global defaults (apply to all types)
The full defaults object (used verbatim as `spec.json.defaults`):

```json
{
  "header": { "enabled": true, "title": "Some of our clients", "textHtml": "", "alignment": "center" },
  "strips": [
    {
      "id": "s1",
      "logos": [
        {
          "id": "l1",
          "name": "Acme",
          "logoFill": "transparent",
          "href": "",
          "targetBlank": false,
          "nofollow": false,
          "alt": "",
          "title": "",
          "caption": ""
        }
      ]
    }
  ],
  "cta": { "enabled": false, "label": "Contact us", "href": "https://example.com/contact", "style": "filled" },
  "type": "grid",
  "typeConfig": {
    "grid": { "columnsDesktop": 5, "columnsMobile": 2 },
    "slider": {
      "showArrows": true,
      "showDots": false,
      "allowSwipe": true,
      "pauseOnHover": true,
      "autoSlide": false,
      "autoSlideDelayMs": 2500,
      "transitionMs": 350
    },
    "carousel": { "pauseOnHover": true, "autoSlideDelayMs": 2500, "transitionMs": 350, "direction": "left" },
    "ticker": { "pauseOnHover": true, "speed": 30, "direction": "left" }
  },
  "appearance": {
    "logoLook": "original",
    "logoOpacity": 0.9,
    "itemBackground": "transparent",
    "itemCard": {
      "radiusLinked": true,
      "radius": "4xl",
      "radiusTL": "4xl",
      "radiusTR": "4xl",
      "radiusBR": "4xl",
      "radiusBL": "4xl",
      "border": { "enabled": false, "width": 1, "color": "color-mix(in oklab, var(--color-system-black), transparent 88%)" },
      "shadow": { "enabled": false, "inset": false, "x": 0, "y": 8, "blur": 24, "spread": 0, "color": "#000000", "alpha": 18 }
    },
    "titleColor": "var(--color-system-black)",
    "textColor": "color-mix(in oklab, var(--color-system-black), transparent 25%)",
    "ctaBackground": "var(--color-system-blue)",
    "ctaTextColor": "var(--color-system-white)",
    "ctaRadius": "md"
  },
  "spacing": {
    "gap": 20,
    "rowGap": 16,
    "stripGap": 16,
    "logoHeight": 28,
    "mobileGap": 16,
    "mobileStripGap": 12,
    "mobileLogoHeight": 24
  },
  "behavior": { "randomOrder": false, "showBacklink": true },
  "stage": {
    "background": "transparent",
    "alignment": "center",
    "canvas": { "mode": "wrap", "width": 0, "height": 0 },
    "padding": {
      "desktop": { "linked": true, "all": 0, "top": 0, "right": 0, "bottom": 0, "left": 0 },
      "mobile": { "linked": true, "all": 0, "top": 0, "right": 0, "bottom": 0, "left": 0 }
    }
  },
  "pod": {
    "background": "transparent",
    "padding": {
      "desktop": { "linked": true, "all": 24, "top": 24, "right": 24, "bottom": 24, "left": 24 },
      "mobile": { "linked": true, "all": 16, "top": 16, "right": 16, "bottom": 16, "left": 16 }
    },
    "widthMode": "wrap",
    "contentWidth": 960,
    "radiusLinked": true,
    "radius": "4xl",
    "radiusTL": "4xl",
    "radiusTR": "4xl",
    "radiusBR": "4xl",
    "radiusBL": "4xl"
  },
  "typography": {
    "globalFamily": "Inter",
    "roleScales": {},
    "roles": {
      "title": {
        "family": "Inter",
        "sizePreset": "m",
        "sizeCustom": "24px",
        "fontStyle": "normal",
        "weight": "700",
        "color": "var(--color-system-black)"
      },
      "body": {
        "family": "Inter",
        "sizePreset": "m",
        "sizeCustom": "14px",
        "fontStyle": "normal",
        "weight": "400",
        "color": "color-mix(in oklab, var(--color-system-black), transparent 25%)"
      }
    }
  }
}
```

### Per-type default differences
Defaults differ by Type primarily via **Pod presets** (because width/containment is part of the experience):
- **grid**: `pod.widthMode='wrap'`, `pod.contentWidth=960`, `pod.padding=24`, `pod.radius='4xl'`
- **slider**: `pod.widthMode='full'`, `pod.padding=16`, `pod.radius='none'`
- **carousel**: `pod.widthMode='full'`, `pod.padding=16`, `pod.radius='none'`
- **ticker**: `pod.widthMode='full'`, `pod.padding=0`, `pod.radius='none'`

Implementation requirement:
- The defaults object uses the `grid` Pod preset because `type='grid'` by default.
- The editor does not auto-apply Pod preset ops on type change; the presets are recommendations reflected in the per-type defaults above.

---

## Appendix A: Why EACH PRD must be written like this (the rule)
This rationale is universal across widgets. See `documentation/widgets/WidgetBuildProcess.md` (Step -1) for the canonical “why” and the required policy matrix template.

## Appendix B: Competitor analysis artifacts (source material)
Captured under `documentation/widgets/LogoShowcase/CompetitorAnalysis/`:
- `Responsive Logo Showcase widget — Features (15+ custom settings).html`
- `Logo Showcase — Add Logo Carousel widget to your website [2025].html`
- `15+ Top Logo Showcase Templates for Websites [free].html`
- screenshots showing: type picker, size/spacing sliders, random order, logo look options
