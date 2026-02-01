# Logo Showcase — PRD

STATUS: DRAFT

## 1) High level description of what the widget does
LogoShowcase renders a **header** + one or more **strips** of logos (each strip contains an ordered list of logos, optionally clickable) in one of four **Types** (Grid / Slider / Carousel / Ticker). Users edit the widget in Bob; the widget runtime applies the saved state deterministically on `{ type: 'ck:state-update' }`.

## Subject Policy — Entitlements (v1)

Tier values are defined globally in `config/entitlements.matrix.json`.

Widget-specific enforcement lives in:
- `tokyo/widgets/logoshowcase/limits.json`

Use the limits mapping for paths + metrics; do not duplicate per-tier matrices here.

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
  - Border uses `appearance.cardwrapper.border` object (wired to `dropdown-border`)
  - Shadow uses `appearance.cardwrapper.shadow` object (wired to `dropdown-shadow`)
  - Radius uses `appearance.cardwrapper.radiusLinked` and `appearance.cardwrapper.radius*` (linked/unlinked)

### What ships (authoritative widget definition)
The widget must be implemented as the standard Tokyo package (core runtime + contracts):
- `tokyo/widgets/logoshowcase/spec.json`
- `tokyo/widgets/logoshowcase/widget.html`
- `tokyo/widgets/logoshowcase/widget.css`
- `tokyo/widgets/logoshowcase/widget.client.js`
- `tokyo/widgets/logoshowcase/agent.md`
- `tokyo/widgets/logoshowcase/limits.json`
- `tokyo/widgets/logoshowcase/localization.json`
- `tokyo/widgets/logoshowcase/layers/*.allowlist.json`

### Non-negotiable platform constraints
- **No fallbacks**: `widget.client.js` must not merge defaults. Missing required state must throw a clear error.
- **Deterministic runtime**: on `ck:state-update`, update DOM/CSS only (no network work).
- **Always apply platform globals**:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`
- **Branding**: handled by `tokyo/widgets/shared/branding.js` (injects/toggles backlink via `state.behavior.showBacklink`; no widget-specific call required).
- **Width is Stage/Pod**: do not add a custom “widget width” control. Pod width mode/content width covers this.
- **Desktop/Mobile contract**: Pod settings frame the experience (width mode, padding, content width, radius), but **responsive behavior must still be explicitly defined by the widget** in `widget.html` + `widget.css` for arrays/items/subparts.

## 2) Types + Motion modes (high level)
In Clickeen terms, **Type = miniwidget**. LogoShowcase has **two Types**:
- `grid` (static grid)
- `carousel` (motion engine with two modes: `paged` or `continuous`)

Type is selected in the **Content panel** (`state.type`) and determines which controls appear (Section 4).

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
`typeConfig.carousel.mode` determines behavior:

#### Mode: `paged` (slides)
- **User sees**: one-row paged carousel; movement is discrete.
- **Step** (`typeConfig.carousel.step`): `logo` (one tile at a time) or `page` (per viewport page).
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
    - Use `segmented` for the Type picker (2 options: `grid`, `carousel`).
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
    - `strips[i].logos[j].asset` → file metadata for editor display (object with `name`, optional `mime`, optional `source`)
    - `strips[i].logos[j].name` → human label (and optional caption fallback if caption empty)
- `strips[i].logos[j].href` → wrap logo in `<a>` if valid http(s) (**editable via Logo details popup when `links.enabled` is true**)
- `strips[i].logos[j].targetBlank=true` → set `target="_blank"` (**editable via Logo details popup when `links.enabled` is true**)
- `strips[i].logos[j].nofollow=true` → set `rel="nofollow noopener noreferrer"` (else `rel="noopener noreferrer"`) (**editable via Logo details popup when `links.enabled` is true**)
- `strips[i].logos[j].alt` → set `alt` on the rendered `<img>` (or `aria-label` on the clickable logo surface if using background-image) (**editable when `media.meta.enabled` is true**)
- `strips[i].logos[j].title` → optional tooltip/title attribute on the logo surface (**editable when `media.meta.enabled` is true**)
    - `strips[i].logos[j].caption` → hover caption rendering (must be consistent across Types)

**Policy enforcement rule (required; no subject checks in runtime):**
- If `links.enabled` is blocked for the session:
  - Bob must force-clear `href/targetBlank/nofollow` on load, and reject any ops that set them.
- If `media.meta.enabled` is blocked for the session:
  - Bob must force-clear `alt/title` on load, and reject any ops that set them.

  - **Editor control**:
    - `strips[i].logos[j].logoFill` is edited using the global Dieter component `dropdown-upload` (image accept)
      - value stored is a **CSS fill string** (dropdown-upload legacy format, not a dropdown-fill object)
    - the popover template stays minimal (caption/name only; see Section 4)
      - selecting an image while editing is in-memory only (Data URL fill)

- **Header (shared primitive)**: `header.*` + `cta.*`
  - **changes**: title/subtitle/CTA copy + placement/alignment + CTA styling
  - **how**:
    - runtime delegates to `window.CKHeader.applyHeader(state, widgetRoot)` (no widget-specific header DOM code)
    - Content-owned: `header.enabled`, `header.title`, `header.showSubtitle`, `header.subtitleHtml`, `cta.enabled`, `cta.label`, `cta.href`, `cta.iconEnabled`, `cta.iconName`, `cta.iconPlacement`
    - Layout-owned: `header.placement`, `header.alignment`, `header.ctaPlacement`, `header.gap`, `header.textGap`, `header.innerGap`
    - Appearance-owned: `appearance.ctaBackground`, `appearance.ctaTextColor`, `appearance.ctaBorder`, `appearance.ctaRadius`, `appearance.ctaSizePreset`, `appearance.ctaPadding*`, `appearance.ctaIconSizePreset`, `appearance.ctaIconSize`

### Panel: Layout (common)
- **Logo size**: `spacing.logoHeight` (used for both desktop + mobile)
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
    - `pod.widthMode='fixed'` creates a centered “card/module” feel (good for Grid).
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
  - **Border**: `appearance.cardwrapper.border` (object schema; `dropdown-border`)
  - **Shadow**: `appearance.cardwrapper.shadow` (object schema; `dropdown-shadow`)
  - **Radius**: `appearance.cardwrapper.radiusLinked` + `appearance.cardwrapper.radius*` (linked/unlinked)
  - **how**: runtime calls `CKSurface.applyCardWrapper(state.appearance.cardwrapper, root)` which sets `--ck-cardwrapper-*` vars on the widget root; the logo tile CSS consumes them

- **Header text styling**: Typography roles `title` + `body`
  - **changes**: header title/subtitle font + text color
  - **how**: `CKTypography.applyTypography(...)` (no Appearance-level header text color controls)

- **CTA styling**: `appearance.ctaBackground`, `appearance.ctaTextColor`, `appearance.ctaBorder`, `appearance.ctaRadius`, `appearance.ctaSizePreset`, `appearance.ctaPadding*`, `appearance.ctaIconSizePreset`, `appearance.ctaIconSize`
  - **changes**: CTA colors + border + radius + padding/icon sizing presets
  - **how**: `CKHeader.applyHeader(...)` writes `--ck-header-cta-bg`, `--ck-header-cta-fg`, `--ck-header-cta-border-*`, `--ck-header-cta-radius`, `--ck-header-cta-padding-*`, `--ck-header-cta-icon-size` on `.ck-headerLayout`

- **Stage/Pod appearance (platform)**: `stage.background`, `pod.background`
  - **changes**: container fills
  - **how**: `CKStagePod.applyStagePod(...)`

### Panel: Typography (common, auto-generated by Bob)
- **Roles**: `title`, `body`, `button` under `typography.roles.*`
  - **changes**: header title/subtitle typography + CTA text typography (`typography.roles.body` is shown as “Subtitle” in the Typography panel)
  - **how**: `CKTypography.applyTypography(...)` roleMap binds header nodes + CTA to roles

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
    - If `links.enabled` and `media.meta.enabled` are both blocked: clicking opens Upsell and does nothing else.
    - Otherwise: open modal.
- Modal content: a table with **one row per logo**, including:
  - **Logo**: thumbnail + `name`
  - **URL**: `href` textfield
  - **Open in new tab**: checkbox → `targetBlank`
  - **Nofollow**: checkbox → `nofollow`
  - **Caption**: `caption` textfield
- Policy-gated columns inside the same modal:
  - **links.enabled**: URL + targetBlank + nofollow
  - **media.meta.enabled**: Alt (`alt`) + Title (`title`)
  - Caption/name remain available in all profiles
- Save behavior: the modal writes standard ops (`set`) to the underlying paths above; there is no special persistence logic.

**Implementation note (scales across many widgets):**
- This modal should be implemented as a reusable Bob primitive (generic “bulk edit table” for an array-of-items), configured by:
  - row source: flattened `strips[].logos[]`
  - columns: a list of `{ label, path, controlType }`, with per-column gating driven by policy flags (`links.enabled`, `media.meta.enabled`)
  - save: emits standard ops (`set`) only

#### AI behavior (Copilot, uses `websiteUrl`)
`websiteUrl` is a workspace setting (persistent on the workspace). It is not part of widget instance config.

If `websiteUrl` is present and policy allows it, Copilot may:
- Propose or rewrite LogoShowcase copy (header/CTA) based on the website URL.
- When `media.meta.enabled` is true (same tiers as SEO/GEO in v1), propose `alt`/`title` values for logos using the website URL context plus the logos (name/caption and/or the selected image).

### Type = `grid`
#### Content panel (below Type picker)
- **Row gap (grid-only)**: `spacing.rowGap`

#### Other panels when `grid` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='fixed'`
  - `pod.contentWidth=960`
  - `pod.padding=24` (linked)
  - `pod.radius='4xl'` (linked)
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - grid auto-fits columns based on tile width (derived from `spacing.logoHeight`)
  - logo sizing uses `spacing.logoHeight` + `spacing.gap` + `spacing.rowGap`
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - grid auto-fits columns based on tile width (derived from `spacing.logoHeight`)
  - logo sizing uses `spacing.logoHeight` + `spacing.mobileGap` + `spacing.rowGap`

### Type = `carousel` (motion)
#### Content panel (below Type picker)
- **Mode**
  - `typeConfig.carousel.mode` (`paged` | `continuous`)
- **Paged mode controls**
  - `typeConfig.carousel.step` (`logo` | `page`)
  - `typeConfig.carousel.showArrows`
  - `typeConfig.carousel.allowSwipe`
  - `typeConfig.carousel.autoplay`
  - `typeConfig.carousel.autoSlideDelayMs` (show only if `autoplay=true`)
  - `typeConfig.carousel.transitionMs`
- **Continuous mode controls**
  - `typeConfig.carousel.speed`
  - `typeConfig.carousel.direction` (`left|right`)
- **Shared**
  - `typeConfig.carousel.pauseOnHover`

#### Other panels when `carousel` is selected
- **Recommended Pod preset**:
  - `pod.widthMode='full'`
  - `pod.padding=16` (linked)
  - `pod.radius='none'` (linked)
  - Continuous mode often benefits from `pod.padding=0` if you want edge-to-edge motion.
- **Desktop rendering**:
  - strips stack vertically with gap `spacing.stripGap`
  - paged mode uses one-row slides with deterministic per-page sizing
  - continuous mode uses duplicated list (A+B) marquee
- **Mobile rendering**:
  - strips stack vertically with gap `spacing.mobileStripGap`
  - paged uses `spacing.logoHeight` + `spacing.mobileGap`
  - continuous uses the same marquee semantics per strip

## 5) What the defaults are (and if defaults are different for each type, what they are)
Defaults are the authoritative state shape. They must be complete (no missing paths).

### Decisions required (blockers) — must be resolved in defaults
If any item below is undecided, the implementer must stop and ask; do not guess.
We intentionally ship **no custom tint** in v1. `appearance.logoLook` is limited to `original | grayscale` (no `customColor` mode).

### Asset handling (scope for this PRD)
This PRD is for **editor-time widget UX** (core widget files + Bob preview). It is not blocked on asset persistence.
- **Editor-time (Bob)**: `dropdown-upload` stores an in-memory CSS fill string (typically a Data URL fill) so preview can render immediately.
- **Persistence/publish**: handled in a later phase. When persistence ships, we will store stable asset references (URL/fileKey) instead of Data URLs.

### `dropdown-upload` contract (editor-time)
In the editor loop, `dropdown-upload` must not persist assets. It stores an in-memory value for preview, and persistence is handled later on Save/Publish.

### Global defaults (apply to all types)
The full defaults object (used verbatim as `spec.json` → `defaults`):

```json
{
  "header": {
    "enabled": true,
    "title": "Some of our best clients",
    "showSubtitle": true,
    "subtitleHtml": "Trusted by teams worldwide.",
    "alignment": "center",
    "placement": "top",
    "ctaPlacement": "right"
  },
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
  "cta": { "enabled": true, "label": "Contact us", "href": "https://example.com/contact", "style": "filled" },
  "type": "grid",
  "typeConfig": {
    "grid": {},
    "carousel": {
      "mode": "paged",
      "step": "page",
      "showArrows": true,
      "allowSwipe": true,
      "autoplay": false,
      "pauseOnHover": true,
      "autoSlideDelayMs": 2500,
      "transitionMs": 350,
      "speed": 30,
      "direction": "left"
    }
  },
  "appearance": {
    "logoLook": "original",
    "logoOpacity": 0.9,
    "itemBackground": "transparent",
    "cardwrapper": {
      "radiusLinked": true,
      "radius": "4xl",
      "radiusTL": "4xl",
      "radiusTR": "4xl",
      "radiusBR": "4xl",
      "radiusBL": "4xl",
      "border": { "enabled": false, "width": 1, "color": "color-mix(in oklab, var(--color-system-black), transparent 88%)" },
      "shadow": { "enabled": false, "inset": false, "x": 0, "y": 8, "blur": 24, "spread": 0, "color": "#000000", "alpha": 18 }
    },
    "ctaBackground": "var(--color-system-blue)",
    "ctaTextColor": "var(--color-system-white)",
    "ctaRadius": "md"
  },
  "spacing": {
    "gap": 20,
    "rowGap": 16,
    "stripGap": 16,
    "logoHeight": 40,
    "mobileGap": 16,
    "mobileStripGap": 12
  },
  "behavior": { "randomOrder": false, "showBacklink": true },
  "stage": {
    "background": { "type": "color", "color": "var(--color-system-gray-5)" },
    "alignment": "center",
    "canvas": { "mode": "viewport", "width": 0, "height": 0 },
    "padding": {
      "desktop": { "linked": true, "all": 80, "top": 80, "right": 80, "bottom": 80, "left": 80 },
      "mobile": { "linked": true, "all": 24, "top": 24, "right": 24, "bottom": 24, "left": 24 }
    }
  },
  "pod": {
    "background": { "type": "color", "color": "var(--color-system-white)" },
    "padding": {
      "desktop": { "linked": true, "all": 24, "top": 24, "right": 24, "bottom": 24, "left": 24 },
      "mobile": { "linked": true, "all": 16, "top": 16, "right": 16, "bottom": 16, "left": 16 }
    },
    "widthMode": "fixed",
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
        "sizeCustom": 24,
        "fontStyle": "normal",
        "weight": "700",
        "color": "var(--color-system-black)"
      },
      "body": {
        "family": "Inter",
        "sizePreset": "m",
        "sizeCustom": 14,
        "fontStyle": "normal",
        "weight": "400",
        "color": "color-mix(in oklab, var(--color-system-black), transparent 25%)"
      },
      "button": {
        "family": "Inter",
        "sizePreset": "m",
        "sizeCustom": 14,
        "fontStyle": "normal",
        "weight": "600",
        "color": "var(--color-system-white)"
      }
    }
  }
}
```

### Per-type default differences
Defaults differ by Type primarily via **Pod presets** (because width/containment is part of the experience):
- **grid**: `pod.widthMode='fixed'`, `pod.contentWidth=960`, `pod.padding=24`, `pod.radius='4xl'`
- **carousel**: `pod.widthMode='full'`, `pod.padding=16`, `pod.radius='none'` (continuous mode often uses `pod.padding=0`)

Implementation requirement:
- The defaults object uses the `grid` Pod preset because `type='grid'` by default.
- The editor does not auto-apply Pod preset ops on type change; the presets are recommendations reflected in the per-type defaults above.

---

## Appendix A: Why EACH PRD must be written like this (the rule)
This rationale is universal across widgets. See `documentation/widgets/WidgetComplianceSteps.md` (Step -1) for the canonical “why” and the required policy matrix template.

## Appendix B: Competitor analysis artifacts (source material)
Captured under `documentation/widgets/LogoShowcase/CompetitorAnalysis/`:
- `Responsive Logo Showcase widget — Features (15+ custom settings).html`
- `Logo Showcase — Add Logo Carousel widget to your website [2025].html`
- `15+ Top Logo Showcase Templates for Websites [free].html`
- screenshots showing: type picker, size/spacing sliders, random order, logo look options
