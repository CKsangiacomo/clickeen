# FAQ Widget (Agent Contract)

## Identity
- `widgetname`: `faq`
- Root element: `[data-ck-widget="faq"]`
- Scope rule: query parts within the root (no `document.querySelector(...)` for internals)

## State Encoding (DOM `data-*` enums)
Set on the main element `[data-role="faq"]`:
- `data-layout`: `accordion` | `list` | `multicolumn`
- `data-cards-layout`: `grid` | `masonry` (only when `data-layout="multicolumn"`)
- `data-state`: `ready` | `empty`

## Parts (query within root)
- Main: `[data-role="faq"]`
- Header layout container: `.ck-headerLayout` (inside `[data-role="faq"]`)
- Header: `.ck-header` (direct child of `.ck-headerLayout`)
- Header title: `[data-role="header-title"]`
- Header subtitle: `[data-role="header-subtitle"]`
- Header CTA: `[data-role="header-cta"]`
- Empty state: `[data-role="faq-empty"]`
- Sections list: `[data-role="faq-list"]`
- Section wrapper (generated): `[data-role="faq-section"]`
- Section header (generated): `[data-role="faq-section-header"]`
- Section title (generated): `[data-role="faq-section-title"]`
- Section body list (generated): `[data-role="faq-section-body"]`
- Item (generated): `[data-role="faq-item"]`
- Question button (generated): `[data-role="faq-question"]`
- Answer region (generated): `[data-role="faq-answer"]`

## Editable Schema (high-signal paths)
Content:
- `sections[].title` (string)
- `sections[].faqs[].question` (string; supports limited inline HTML)
- `sections[].faqs[].answer` (string; supports limited inline HTML; URLs auto-link, and optionally embed images/videos)
- `sections[].faqs[].defaultOpen` (boolean; accordion only)
Required IDs:
- `sections[].id` (string; stable; required)
- `sections[].faqs[].id` (string; stable; required)

Widget:
- `displayCategoryTitles` (boolean)

Header (global primitive):
- `header.enabled` (boolean)
- `header.title` (richtext string; sanitized at runtime)
- `header.showSubtitle` (boolean)
- `header.subtitleHtml` (richtext string; sanitized at runtime; links allowed)
- `header.alignment` (`left` | `center` | `right`)
- `header.placement` (`top` | `bottom` | `left` | `right`)
- `header.ctaPlacement` (`right` | `below`)
- Header spacing (layout; px):
  - `header.gap` (number; header ↔ content)
  - `header.textGap` (number; title ↔ subtitle)
  - `header.innerGap` (number; text ↔ CTA)

CTA (global primitive):
- `cta.enabled` (boolean)
- `cta.label` (string)
- `cta.href` (string; must be `http(s)://` to be clickable)
- `cta.openMode` (`same-tab` | `new-tab` | `new-window`)
- `cta.iconEnabled` (boolean; when true, CTA renders a Dieter icon)
- `cta.iconName` (string; Dieter icon id without `.svg`; allowed: `checkmark`, `arrow.right`, `chevron.right`, `arrowshape.forward`, `arrowshape.turn.up.right`)
- `cta.iconPlacement` (`left` | `right`)

Layout:
- `layout.type` (`accordion` | `list` | `multicolumn`)
- `layout.gap` (number; px)
- `layout.columns.desktop|mobile` (number; >= 1, `multicolumn` only)
- `layout.cardsLayout` (`grid` | `masonry`; `multicolumn` only; masonry is column-first visual flow)
- Item card padding (layout spacing):
  - `layout.itemPaddingLinked` (boolean)
  - `layout.itemPadding` (number; px; when linked)
  - `layout.itemPaddingTop|Right|Bottom|Left` (number; px; when unlinked)

Appearance:
- `appearance.iconStyle` (`plus` | `chevron` | `arrow` | `arrowshape`; accordion only)
- `appearance.iconColor` (fill; color only; accordion only)
- `appearance.itemBackground` (fill; color/gradient/image; Q&A card background)
- `appearance.cardwrapper.border` (object; Q&A card border)
  - `enabled` (boolean)
  - `width` (number; px)
  - `color` (string; CSS color)
- `appearance.cardwrapper.shadow` (object; Q&A card shadow)
  - `enabled` (boolean)
  - `inset` (boolean)
  - `x` (number; px)
  - `y` (number; px)
  - `blur` (number; px)
  - `spread` (number; px)
  - `color` (string; hex)
  - `alpha` (number; 0..100)
- Card wrapper radius (appearance):
  - `appearance.cardwrapper.radiusLinked` (boolean)
  - `appearance.cardwrapper.radius` (`none` | `2xl` | `4xl` | `6xl` | `10xl`; when linked)
  - `appearance.cardwrapper.radiusTL|TR|BR|BL` (same enum; when unlinked)
- `appearance.podBorder` (object; pod border)
  - `enabled` (boolean)
  - `width` (number; px)
  - `color` (string; CSS color)
- Header CTA (appearance):
  - `appearance.ctaBackground` (fill; color only)
  - `appearance.ctaTextColor` (fill; color only)
  - `appearance.ctaBorder` (object; Dieter `dropdown-border` schema)
  - `appearance.ctaRadius` (`none` | `sm` | `md` | `lg` | `xl` | `2xl`)
  - `appearance.ctaSizePreset` (`xs` | `s` | `m` | `l` | `xl` | `custom`; editor preset selector; see Binding Map)
  - `appearance.ctaPaddingLinked` (boolean; editor-only link/unlink for CTA padding)
  - `appearance.ctaPaddingInline` (number; px)
  - `appearance.ctaPaddingBlock` (number; px)
  - `appearance.ctaIconSizePreset` (`xs` | `s` | `m` | `l` | `xl` | `custom`; editor preset selector; see Binding Map)
  - `appearance.ctaIconSize` (number; px)

Behavior:
- `behavior.expandFirst` (boolean; accordion only)
- `behavior.multiOpen` (boolean; accordion only)
- `behavior.expandAll` (boolean; accordion only)
- `behavior.showBacklink` (boolean; controls global branding badge)

Context:
- `context.websiteUrl` (string; AI context only, runtime ignores)

SEO/GEO (Settings panel):
- `seoGeo.enabled` (boolean; enables Venice schema/excerpt when the host opts in)
- `seo.enableSchema` (boolean; if false, suppress JSON‑LD even when `seoGeo.enabled` is true)
- `seo.canonicalUrl` (string; optional canonical URL for schema `@id/url`)
- `geo.enableDeepLinks` (boolean; enables `#` deep links for FAQ questions in accordion mode)

Stage/Pod (layout spacing lives here; no widget-level padding):
- `stage.background` (fill object), `stage.shadow` (outside shadow channel), `stage.insideShadow.*` (inside shadow channel), `stage.alignment`, `stage.padding*`
- `pod.background` (fill object), `pod.shadow` (outside shadow channel), `pod.insideShadow.*` (inside shadow channel), `pod.widthMode`, `pod.contentWidth`, `pod.padding*`, `pod.radius*`

## Rendering Notes
- Inline HTML is sanitized.
  - In `question`: allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `br` (no links).
  - In `answer`: allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br` (links require `http(s)://`).
- Header richtext is sanitized by `tokyo/widgets/shared/header.js`:
  - `header.title`: allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `br` (no links).
  - `header.subtitleHtml`: allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br` (links require `http(s)://`).
- When enabled, `answer` URLs can embed images (`.png/.jpg/.gif/.webp/.svg`) and YouTube/Vimeo videos.

## Branding (global)
- The "Made with Clickeen" badge is NOT part of the widget markup.
- It is injected globally by `tokyo/widgets/shared/branding.js` into the closest `.pod` as `.ck-branding`.
- Visibility is driven by `behavior.showBacklink`.

## Binding Map Summary (anti-dead-controls)
| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |
| `header.enabled` | `.ck-headerLayout` | data-attr | `CKHeader.applyHeader(state, widgetRoot)` sets `data-has-header` + hides `.ck-header` |
| `header.title` | `[data-role="header-title"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` sets sanitized `innerHTML` |
| `header.showSubtitle` | `[data-role="header-subtitle"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` toggles visibility |
| `header.subtitleHtml` | `[data-role="header-subtitle"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` sets sanitized `innerHTML` |
| `header.alignment` | `.ck-header` | data-attr | `CKHeader.applyHeader(state, widgetRoot)` sets `data-align` |
| `header.placement` | `.ck-headerLayout` | data-attr | `CKHeader.applyHeader(state, widgetRoot)` sets `data-header-placement` |
| `header.ctaPlacement` | `.ck-header` | data-attr | `CKHeader.applyHeader(state, widgetRoot)` sets `data-cta-placement` |
| `header.gap` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-gap` (header ↔ content) |
| `header.textGap` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-text-gap` (title ↔ subtitle) |
| `header.innerGap` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-inner-gap` (text ↔ CTA) |
| `cta.enabled` | `[data-role="header-cta"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` toggles visibility |
| `cta.label` | `[data-role="header-cta"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` sets `.ck-header__ctaLabel.textContent` |
| `cta.href` | `[data-role="header-cta"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` sets clickable `href` only for `http(s)://` |
| `cta.openMode` | `[data-role="header-cta"]` | dom | `CKHeader.applyHeader(state, widgetRoot)` sets link target behavior (`same-tab` / `new-tab` / `new-window`) |
| `cta.iconEnabled` | `.ck-header__ctaIcon` | dom | `CKHeader.applyHeader(state, widgetRoot)` toggles icon visibility |
| `cta.iconName` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-icon` to Dieter `mask-image` url |
| `cta.iconPlacement` | `[data-role="header-cta"]` | data-attr | `CKHeader.applyHeader(state, widgetRoot)` sets `data-icon-placement` |
| `displayCategoryTitles` | `[data-role="faq-list"]` | dom | `renderItems(..., displayCategoryTitles, ...)` |
| `sections` | `[data-role="faq-list"]` | dom | `renderItems(state.sections, ...)` |
| `layout.type` | `[data-role="faq"]` | data-attr | `faqRoot.setAttribute('data-layout', state.layout.type)` |
| `layout.cardsLayout` | `[data-role="faq"]` | data-attr | `faqRoot.setAttribute('data-cards-layout', state.layout.cardsLayout)` (only when `layout.type === 'multicolumn'`; defaults to `grid`) |
| `layout.gap` | `[data-role="faq"]` | css-var | `--layout-gap` |
| `layout.columns.desktop` | `[data-role="faq"]` | css-var | `--faq-columns-desktop` |
| `layout.columns.mobile` | `[data-role="faq"]` | css-var | `--faq-columns-mobile` |
| `layout.itemPaddingLinked` | `[data-role="faq"]` | css-var | chooses linked vs per-side padding |
| `layout.itemPadding` | `[data-role="faq"]` | css-var | `--faq-item-pad-*` (linked) |
| `layout.itemPaddingTop` | `[data-role="faq"]` | css-var | `--faq-item-pad-top` |
| `layout.itemPaddingRight` | `[data-role="faq"]` | css-var | `--faq-item-pad-right` |
| `layout.itemPaddingBottom` | `[data-role="faq"]` | css-var | `--faq-item-pad-bottom` |
| `layout.itemPaddingLeft` | `[data-role="faq"]` | css-var | `--faq-item-pad-left` |
| `appearance.itemBackground` | `[data-role="faq"]` | css-var | `--faq-item-bg` |
| `appearance.cardwrapper.border` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-border-width/--ck-cardwrapper-border-color` |
| `appearance.cardwrapper.shadow` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-shadow` |
| `appearance.cardwrapper.radiusLinked` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` chooses linked vs per-corner radius |
| `appearance.cardwrapper.radius` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-radius` (linked) |
| `appearance.cardwrapper.radiusTL` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-radius` (TL) |
| `appearance.cardwrapper.radiusTR` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-radius` (TR) |
| `appearance.cardwrapper.radiusBR` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-radius` (BR) |
| `appearance.cardwrapper.radiusBL` | `[data-role="faq"]` | css-var | `CKSurface.applyCardWrapper(state.appearance.cardwrapper, faqRoot)` sets `--ck-cardwrapper-radius` (BL) |
| `appearance.linkStyle` | `[data-role="faq"]` | data-attr | `faqRoot.setAttribute('data-link-style', state.appearance.linkStyle)` |
| `appearance.linkUnderlineColor` | `[data-role="faq"]` | css-var | `--faq-link-underline-color` |
| `appearance.linkHighlightColor` | `[data-role="faq"]` | css-var | `--faq-link-highlight-color` |
| `appearance.linkTextColor` | `[data-role="faq"]` | css-var | `--faq-link-text-color` |
| `appearance.iconStyle` | `[data-role="faq"]` | css-var | `--faq-icon-expand/--faq-icon-collapse` |
| `appearance.iconColor` | `[data-role="faq"]` | css-var | `--faq-icon-color` |
| `appearance.podBorder` | `.pod` | css-var | `--pod-border-width/--pod-border-color` |
| `appearance.ctaSizePreset` | Bob editor | editor | Selecting a preset expands to: `typography.roles.button.sizePreset` + CTA padding values; editing any target resets it to `custom` |
| `appearance.ctaPaddingLinked` | Bob editor | editor | When linking, Bob sets `appearance.ctaPaddingBlock` to match `appearance.ctaPaddingInline` |
| `appearance.ctaPaddingInline` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-padding-inline` |
| `appearance.ctaPaddingBlock` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-padding-block` |
| `appearance.ctaBackground` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-bg` |
| `appearance.ctaTextColor` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-fg` |
| `appearance.ctaBorder` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-border-width/--ck-header-cta-border-color` |
| `appearance.ctaRadius` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-radius` |
| `appearance.ctaIconSizePreset` | Bob editor | editor | Selecting a preset expands to `appearance.ctaIconSize`; editing it resets to `custom` |
| `appearance.ctaIconSize` | `.ck-headerLayout` | css-var | `CKHeader.applyHeader(state, widgetRoot)` sets `--ck-header-cta-icon-size` |
| `stage.background` | `.stage` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` |
| `stage.shadow` | `.stage` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` sets outside shadow in `--stage-shadow` |
| `stage.insideShadow.*` | `.stage` | dom | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` applies inside shadows between background and pod |
| `pod.background` | `.pod` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` |
| `pod.shadow` | `.pod` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` sets outside shadow in `--pod-shadow` |
| `pod.insideShadow.*` | `.pod` | dom | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` applies inside shadows between background and content |
| `typography.roles.title.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.body.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` sets `--typo-body-*` vars consumed by `.ck-header__subtitle` |
| `typography.roles.section.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.question.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.answer.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.button.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `behavior.multiOpen` | runtime | dom | accordion click handler collapse rules |
| `behavior.expandAll` | runtime | dom | initial expand behavior in `applyState` |
| `behavior.expandFirst` | runtime | dom | initial expand behavior in `applyState` |
| `behavior.showBacklink` | `.ck-branding` | dom | `tokyo/widgets/shared/branding.js` |
| `geo.enableDeepLinks` | runtime | dom | `accordionRuntime.deepLinksEnabled` + writes `window.location.hash` |
| `seoGeo.enabled` | Venice schema | schema | `venice/lib/schema/faq.ts` gates schema emission |
| `seo.enableSchema` | Venice schema | schema | `venice/lib/schema/faq.ts` gates schema emission |
| `seo.canonicalUrl` | Venice schema | schema | `venice/lib/schema/faq.ts` sets FAQPage `@id/url` |
| `appearance.theme` | Bob editor | editor | theme preset selector; runtime ignores |
| `context.websiteUrl` | AI agent | agent | AI context only; runtime ignores |

## Safe List Operations (recommended)
- Add section: append to `sections` (must include `id`)
- Remove section: delete `sections[i]`
- Add question: append to `sections[i].faqs` (must include `id`)
- Reorder question: move within `sections[i].faqs`

## Prohibited
- Do not write ops for paths outside this widget’s allowlists (`localization.json`, `layers/*.allowlist.json`); they are rejected fail-closed.
- Do not include non-allowed HTML tags/attrs in `sections[].faqs[].question|answer` (only the allowed inline tags listed above are supported).
