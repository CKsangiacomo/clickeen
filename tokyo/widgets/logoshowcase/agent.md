# LogoShowcase Widget (Agent Contract)

## Identity
- `widgetname`: `logoshowcase`
- Root element: `[data-ck-widget="logoshowcase"]`
- Scope rule: query parts within the root (no `document.querySelector(...)` for internals)

## State Encoding (DOM `data-*` enums)
Set on the main element `[data-role="logoshowcase"]`:
- `data-type`: `grid` | `carousel`
- `data-motion`: `paged` | `continuous` (only when `data-type="carousel"`)

Set on the header element `[data-role="header"]`:
- `data-align`: `left` | `center` | `right`

## Parts (query within root)
- Root: `[data-role="logoshowcase"]`
- Header: `[data-role="header"]`
  - Title: `[data-role="title"]`
  - Subtitle: `[data-role="subtitle"]` (renders sanitized inline HTML)
  - CTA: `[data-role="cta"]`
- Strips container: `[data-role="strips"]`
- Strip (generated): `[data-role="strip"]`
  - Viewport: `[data-role="strip-viewport"]`
  - Track: `[data-role="strip-track"]`
  - Logos list: `[data-role="logos"]`
  - Ticker copies (mode=continuous): `[data-role="ticker-a"]`, `[data-role="ticker-b"]`
- Logo tile (generated): `[data-role="logo"]`
  - Visual: `[data-role="logo-visual"]` (background-image from `logoFill`)
  - Caption: `[data-role="logo-caption"]`

## Editable Schema (high-signal paths)
Content:
- Header:
  - `header.enabled` (boolean)
  - `header.title` (string)
  - `header.textHtml` (string; supports limited inline HTML)
  - `header.alignment` (`left` | `center` | `right`)
- Strips / Logos:
  - `strips[]` (array)
  - `strips[].logos[]` (array)
- `strips[].logos[].name` (string)
- `strips[].logos[].logoFill` (string CSS fill from `dropdown-upload`, e.g. `url("...") center / contain no-repeat` or `transparent`)
  - `strips[].logos[].asset` (object; file metadata for editor display, e.g. `{ name, mime, source }`)
  - `strips[].logos[].caption` (string; hover label; falls back to `name` if empty)
  - `strips[].logos[].href` (string; only valid `http(s)://` becomes clickable)
  - `strips[].logos[].targetBlank` (boolean)
  - `strips[].logos[].nofollow` (boolean)
  - `strips[].logos[].alt` (string; used for `aria-label` fallback)
  - `strips[].logos[].title` (string; tooltip/title attribute)
- CTA:
  - `cta.enabled` (boolean)
  - `cta.label` (string)
  - `cta.href` (string; only valid `http(s)://` is clickable)
  - `cta.style` (`filled` | `outline`)

Type:
- `type` (`grid` | `carousel`)
- `typeConfig.carousel.mode` (`paged` | `continuous`)
- `typeConfig.carousel.step` (`logo` | `page`)
- `typeConfig.carousel.showArrows|allowSwipe|autoplay|pauseOnHover` (boolean)
- `typeConfig.carousel.autoSlideDelayMs|transitionMs` (number; ms)
- `typeConfig.carousel.speed` (number; px/sec)
- `typeConfig.carousel.direction` (`left` | `right`)

Layout:
- `spacing.gap|mobileGap` (number; px)
- `spacing.stripGap|mobileStripGap` (number; px)
- `spacing.rowGap` (number; px; grid only)
- `spacing.logoHeight` (number; px; drives grid density)

Appearance:
- `appearance.logoLook` (`original` | `grayscale`)
- `appearance.logoOpacity` (number; 0..1)
- `appearance.itemBackground` (string; CSS fill)
- Tile card:
  - `appearance.itemCard.radiusLinked` (boolean)
  - `appearance.itemCard.radius|radiusTL|radiusTR|radiusBR|radiusBL` (radius token, e.g. `none|2xl|4xl|6xl|10xl`)
  - `appearance.itemCard.border` (object; Dieter `dropdown-border` schema)
  - `appearance.itemCard.shadow` (object; Dieter `dropdown-shadow` schema)
- Header colors:
  - `appearance.titleColor` (string; CSS fill)
  - `appearance.textColor` (string; CSS fill)
- CTA appearance:
  - `appearance.ctaBackground` (string; CSS fill)
  - `appearance.ctaTextColor` (string; CSS fill)
  - `appearance.ctaRadius` (radius token, e.g. `none|sm|md|lg|xl|2xl`)

Behavior / Settings:
- `behavior.randomOrder` (boolean; deterministic shuffle per strip using ids)
- `behavior.showBacklink` (boolean; controls global branding badge)
- `seoGeo.enabled` (boolean)

Stage/Pod (layout spacing lives here; no widget-level width/padding):
- `stage.background`, `stage.alignment`, `stage.padding*`
- `pod.background`, `pod.widthMode`, `pod.contentWidth`, `pod.padding*`, `pod.radius*`

## Rendering Notes
- Breakpoint: widgets use a single breakpoint at `900px`.
- Inline HTML (`header.textHtml`) is sanitized; allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br` (links require `http(s)://`).
- `logoFill` accepts `blob:`, `data:`, or `http(s)` URLs. Runtime extracts the primary URL and applies it as `background-image` on `[data-role="logo-visual"]`.
- Links: `href` is normalized; only valid `http(s)://` makes a logo/CTA clickable (else it renders inert).

## Branding (global)
- The "Made with Clickeen" badge is NOT part of the widget markup.
- It is injected globally by `tokyo/widgets/shared/branding.js` into the closest `.pod` as `.ck-branding`.
- Visibility is driven by `behavior.showBacklink`.

## Safe List Operations (recommended)
- Add strip: append to `strips`
- Remove strip: delete `strips[i]`
- Add logo: append to `strips[i].logos`
- Remove logo: delete `strips[i].logos[j]`
- Reorder logos: move within `strips[i].logos`
