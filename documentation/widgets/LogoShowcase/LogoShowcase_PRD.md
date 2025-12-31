# Logo Showcase — PRD

STATUS: DRAFT

## 1) High level description of what the widget does
LogoShowcase renders a **header** + one or more **strips** of logos (each strip contains an ordered list of logos, optionally clickable) in one of four **Types** (Grid / Slider / Carousel / Ticker). Users edit the widget in Bob; the widget runtime applies the saved state deterministically on `{ type: 'ck:state-update' }`.

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
  - `CKBranding.applyBranding(state.behavior, root)`
- **Width is Stage/Pod**: do not add a custom “widget width” control. Pod width mode/content width covers this.

## 2) The 4 types (high level) and how the 4 types differ
In Clickeen terms, **Type = miniwidget**. A Type is defined by behavior + DOM/CSS structure + relevant controls.
Type is always selected in the **Content panel** (`state.type`), and it controls what appears under it (Section 4).

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

### Type: `carousel` (automatic discrete loop)
- **User sees**: each strip is its own one-row, automatically advancing loop.
- **Behavior**: discrete stepping loop (delay + transition), pauses on hover.
- **Navigation**: none (not part of this PRD).
- **Structure**: viewport + track + loop controller.

### Type: `ticker` (continuous marquee)
- **User sees**: each strip is its own one-row, continuously moving marquee.
- **Behavior**: continuous motion at steady speed, pauses on hover.
- **Navigation**: none.
- **Structure**: duplicated list (A+B) + CSS animation translate.

## 3) ALL THE CONTROLS THAT ARE COMMON FOR THE 4 TYPES (by panel), what they change and how
This section lists **only controls that apply to every Type**. Type-specific controls are in Section 4.

### Panel: Content (common)
- **Type picker**: `type`
  - **changes**: selects which miniwidget renders
  - **how**:
    - Bob uses `show-if="type == '...'"` to show type-specific controls under the picker
    - runtime sets `data-type="<type>"` on widget root

- **Strips list (CRUD + reorder)**: `strips[]`
  - **changes**: how many logo rows/sections exist and their ordering
  - **how**:
    - runtime renders one strip container per item under `[data-role="strips"]`
    - each strip contains its own `[data-role="logos"]` list

- **Logos list inside each strip (CRUD + reorder)**: `strips[i].logos[]`
  - **changes**: which logos are rendered inside that strip, the uploaded asset key used for the image, link behavior, and hover caption text
  - **how**:
    - runtime renders children under the strip’s `[data-role="logos"]`
    - `strips[i].logos[j].fileKey` → `<img src>` (fileKey is a path-like string that is directly usable as `img.src`, e.g. `/assets/upl_.../logo.svg`)
    - `strips[i].logos[j].name` → `<img alt>` (and optional caption fallback if caption empty)
    - `strips[i].logos[j].href` → wrap logo in `<a>` if valid http(s)
    - `strips[i].logos[j].nofollow=true` → set `rel="nofollow noopener noreferrer"` (else `rel="noopener noreferrer"`)
    - `strips[i].logos[j].caption` → hover caption rendering (must be consistent across Types)

  - **Editor control**:
    - `strips[i].logos[j].fileKey` is edited using the global Dieter component `dropdown-upload`
      - value stored is a **fileKey string**, not a URL
      - allowlist is specified per usage (LogoShowcase allowlist: `.svg,.png,.jpg,.jpeg,.webp`)
      - the popover may embed additional per-logo controls via `template="..."` (see Section 4)

- **Header enable + content**: `header.enabled`, `header.title`, `header.textHtml`, `header.alignment`
  - **changes**: whether header exists, text, and alignment
  - **how**:
    - runtime toggles `[data-role="header"]` visibility
    - `header.title` → `[data-role="title"].textContent`
    - `header.textHtml` → sanitized HTML into `[data-role="subtitle"]`
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
  - **how**: runtime deterministically shuffles `strips[i].logos[]` render order per strip (seed rule defined in Defaults)

- **Stage/Pod layout (platform)**: `stage.*`, `pod.*`
  - **changes**: container padding, width mode, radius, alignment
  - **how**: Bob auto-generates Stage/Pod Layout panel; runtime applies via `CKStagePod.applyStagePod(...)`
  - **important**: Pod width mode materially changes how Types present:
    - `pod.widthMode='wrap'` creates a centered “card/module” feel (good for Grid).
    - `pod.widthMode='full'` makes the widget span the available width (good for Slider/Carousel/Ticker).

### Panel: Appearance (common)
- **Logo look**: `appearance.logoLook`, `appearance.logoCustomColor`
  - **changes**: original vs grayscale vs custom tint
  - **how**:
    - original: no filter
    - grayscale: apply grayscale filter
    - customColor: apply the chosen tint implementation (must be defined in Defaults “Decisions required”)

- **Logo opacity**: `appearance.logoOpacity`
  - **changes**: logo opacity
  - **how**: root CSS var `--ls-logo-opacity`

- **Logo radius**: `appearance.logoRadius`
  - **changes**: rounding on logo tile/image
  - **how**: root CSS var `--ls-logo-radius`

- **Per-logo tile styling**: `appearance.itemBackground`, `appearance.borderWidth`, `appearance.borderColor`
  - **changes**: background/border for each logo tile wrapper
  - **how**: root CSS vars `--ls-item-bg`, `--ls-border-w`, `--ls-border-color`

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
If a future Type removes a feature entirely (e.g., no CTA), then switching into that Type must **force-disable** the feature (`cta.enabled=false`) via a deterministic op emitted by the type picker.

### Shared rule: Type sets recommended Pod defaults (required)
Type selection must also set a **recommended Pod preset** for that Type, by emitting deterministic WidgetOps that update `pod.*`.
- This is required because competitor widgets treat “width” as part of the experience, and in Clickeen “width” belongs to Stage/Pod.
- Users can still override Pod later; the Type preset is the starting point.

### Content panel structure (always, for all types)
Below the Type picker, always show:
- **Strips** (`strips[]`) using `repeater` (each item is one strip)
- Inside each strip item, **Logos** (`strips[i].logos[]`) using `object-manager`

#### Logo item editor (required, global pattern)
Each logo item must use `dropdown-upload` for the file, and nest additional actions in the popover using `template`:
- **File**: `dropdown-upload` bound to `strips[i].logos[j].fileKey`
  - `accept=".svg,.png,.jpg,.jpeg,.webp"`
  - `grantUrl="/api/assets/grant"`
  - `resolveUrl="/api/assets/resolve"`
  - `template="..."` includes:
    - `textfield` for `strips[i].logos[j].href`
    - `toggle` for `strips[i].logos[j].nofollow`
    - `textfield` for `strips[i].logos[j].caption`
    - (optional) `textfield` for `strips[i].logos[j].name` if we want name editable in the same popover

Then, below the strips editor, show the Type-specific controls listed in each Type section below.

### Type = `grid`
#### Content panel (below Type picker)
- **Grid columns**
  - `typeConfig.grid.columnsDesktop`
  - `typeConfig.grid.columnsMobile`
- **Row gap (grid-only)**
  - `spacing.rowGap`

#### Other panels when `grid` is selected
- **Pod preset (applied on type change)**:
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
- **Pod preset (applied on type change)**:
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
- **Pod preset (applied on type change)**:
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
- **Pod preset (applied on type change)**:
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
- **Tint implementation** for `appearance.logoLook='customColor'`:
  - CSS filter approximation (works for raster, imperfect), OR
  - SVG-only tint (best quality, requires SVG assets), OR
  - other deterministic approach (must be specified)
- **Random order seed**: deterministic seed rule (recommended: stable per instance, e.g. `publicId`)
- **Assets APIs required for `dropdown-upload`**:
  - `POST /api/assets/grant` must return `{ uploadUrl, fileKey }` where `fileKey` is the value stored in widget state
  - `GET /api/assets/resolve?key=<fileKey>` must return `{ previewUrl?, mimeType?, ext?, fileName? }` for editor preview
  - `fileKey` must be a path-like string that can be used directly as `img.src` without extra network work in the widget runtime (keeps runtime deterministic)

### Global defaults (apply to all types)
The full defaults object (used verbatim as `spec.json.defaults`):

```json
{
  "header": { "enabled": true, "title": "Some of our clients", "textHtml": "", "alignment": "center" },
  "strips": [
    {
      "id": "s1",
      "logos": [
        { "id": "l1", "name": "Acme", "fileKey": "/assets/logo1.svg", "href": "", "nofollow": false, "caption": "" }
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
    "logoCustomColor": "var(--color-system-black)",
    "logoOpacity": 0.9,
    "logoRadius": "md",
    "itemBackground": "transparent",
    "borderColor": "color-mix(in oklab, var(--color-system-black), transparent 88%)",
    "borderWidth": 0,
    "shadow": "none",
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
    "paddingLinked": true,
    "padding": 0,
    "paddingTop": 0,
    "paddingRight": 0,
    "paddingBottom": 0,
    "paddingLeft": 0
  },
  "pod": {
    "background": "transparent",
    "paddingLinked": true,
    "padding": 24,
    "paddingTop": 24,
    "paddingRight": 24,
    "paddingBottom": 24,
    "paddingLeft": 24,
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
      "title": { "scale": "md", "style": "regular", "weight": 700 },
      "body": { "scale": "sm", "style": "regular", "weight": 400 }
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
- When the user switches Types, the Type picker must apply the corresponding Pod preset via WidgetOps (as specified in Section 4).

---

## Appendix A: Why EACH PRD must be written like this (the rule)
This PRD format prevents repeated failures by forcing a complete, deterministic mapping from “what the user sees” → “what the controls are” → “what paths change” → “how runtime applies state”.

1) **High-level widget behavior first** ensures the implementer understands the user-visible contract before touching schema.

2) **Types second** prevents the most common failure mode: implementing a single layout and pretending it covers multiple types. Type is a miniwidget; it must be defined up front.

3) **Common controls by panel with “what they change and how”** eliminates “dead controls” and stops drift:
   - every common control has a state path
   - every path has a binding mechanism (DOM/text, CSS var, data-attr, or shared module)
   - controls are placed deterministically in panels

4) **Type-specific spec in Content panel + cross-panel implications** prevents “wrong controls showing” and “stale config” bugs:
   - Type selection becomes the single gate for type-specific controls
   - the PRD explicitly states what disappears/appears when type changes
   - if a type removes a feature, the PRD forces an explicit disable op

5) **Defaults last** enforces “no fallbacks” and keeps compilation + runtime deterministic:
   - all state paths exist
   - all types have defined config objects
   - editors and runtimes don’t invent missing state

## Appendix B: Competitor analysis artifacts (source material)
Captured under `documentation/widgets/LogoShowcase/CompetitorAnalysis/`:
- `Responsive Logo Showcase widget — Features (15+ custom settings).html`
- `Logo Showcase — Add Logo Carousel widget to your website [2025].html`
- `15+ Top Logo Showcase Templates for Websites [free].html`
- screenshots showing: type picker, size/spacing sliders, random order, logo look options

