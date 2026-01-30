# FAQ Widget (Agent Contract)

## Identity
- `widgetname`: `faq`
- Root element: `[data-ck-widget="faq"]`
- Scope rule: query parts within the root (no `document.querySelector(...)` for internals)

## State Encoding (DOM `data-*` enums)
Set on the main element `[data-role="faq"]`:
- `data-layout`: `accordion` | `list` | `multicolumn`
- `data-state`: `ready` | `empty`

## Parts (query within root)
- Main: `[data-role="faq"]`
- Title: `[data-role="faq-title"]`
- Empty state: `[data-role="faq-empty"]`
- Items list: `[data-role="faq-list"]`
- Section title (generated): `[data-role="faq-section-title"]`
- Item (generated): `[data-role="faq-item"]`
- Question button (generated): `[data-role="faq-question"]`
- Answer region (generated): `[data-role="faq-answer"]`

## Editable Schema (high-signal paths)
Content:
- `sections[].title` (string)
- `sections[].faqs[].question` (string; supports limited inline HTML)
- `sections[].faqs[].answer` (string; supports limited inline HTML; URLs auto-link, and optionally embed images/videos)
- `sections[].faqs[].defaultOpen` (boolean; accordion only)

Widget:
- `title` (string)
- `showTitle` (boolean)
- `displayCategoryTitles` (boolean)

Layout:
- `layout.type` (`accordion` | `list` | `multicolumn`)
- `layout.gap` (number; px)
- `layout.columns.desktop|mobile` (number; >= 1, `multicolumn` only)
- Item card padding (layout spacing):
  - `layout.itemPaddingLinked` (boolean)
  - `layout.itemPadding` (number; px; when linked)
  - `layout.itemPaddingTop|Right|Bottom|Left` (number; px; when unlinked)

Appearance:
- `appearance.iconStyle` (`plus` | `chevron` | `arrow` | `arrowshape`; accordion only)
- `appearance.iconColor` (fill; color only; accordion only)
- `appearance.itemBackground` (fill; color/gradient/image; Q&A card background)
- `appearance.itemCard.border` (object; Q&A card border)
  - `enabled` (boolean)
  - `width` (number; px)
  - `color` (string; CSS color)
- `appearance.itemCard.shadow` (object; item card shadow)
  - `enabled` (boolean)
  - `inset` (boolean)
  - `x` (number; px)
  - `y` (number; px)
  - `blur` (number; px)
  - `spread` (number; px)
  - `color` (string; hex)
  - `alpha` (number; 0..100)
- Item card radius (appearance):
  - `appearance.itemCard.radiusLinked` (boolean)
  - `appearance.itemCard.radius` (`none` | `2xl` | `4xl` | `6xl` | `10xl`; when linked)
  - `appearance.itemCard.radiusTL|TR|BR|BL` (same enum; when unlinked)
  - `enabled` (boolean)
  - `width` (number; px)
  - `color` (string; CSS color)
- `appearance.podBorder` (object; pod border)
  - `enabled` (boolean)
  - `width` (number; px)
  - `color` (string; CSS color)

Behavior:
- `behavior.expandFirst` (boolean; accordion only)
- `behavior.multiOpen` (boolean; accordion only)
- `behavior.expandAll` (boolean; accordion only)
- `behavior.displayImages` (boolean)
- `behavior.displayVideos` (boolean)
- `behavior.showBacklink` (boolean; controls global branding badge)

Context:
- `context.websiteUrl` (string; AI context only, runtime ignores)

Stage/Pod (layout spacing lives here; no widget-level padding):
- `stage.background` (fill object), `stage.alignment`, `stage.padding*`
- `pod.background` (fill object), `pod.shadow` (shadow object), `pod.widthMode`, `pod.contentWidth`, `pod.padding*`, `pod.radius*`

## Rendering Notes
- Inline HTML is sanitized; allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br` (links require `http(s)://`).
- When enabled, `answer` URLs can embed images (`.png/.jpg/.gif/.webp/.svg`) and YouTube/Vimeo videos.

## Branding (global)
- The "Made with Clickeen" badge is NOT part of the widget markup.
- It is injected globally by `tokyo/widgets/shared/branding.js` into the closest `.pod` as `.ck-branding`.
- Visibility is driven by `behavior.showBacklink`.

## Binding Map Summary (anti-dead-controls)
| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |
| `title` | `[data-role="faq-title"]` | dom | `titleEl.textContent = state.title` |
| `showTitle` | `.ck-faq__header` | dom | `titleEl.hidden/headerEl.hidden` |
| `displayCategoryTitles` | `[data-role="faq-list"]` | dom | `renderItems(..., displayCategoryTitles, ...)` |
| `sections` | `[data-role="faq-list"]` | dom | `renderItems(state.sections, ...)` |
| `layout.type` | `[data-role="faq"]` | data-attr | `faqRoot.setAttribute('data-layout', state.layout.type)` |
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
| `appearance.itemCard.border` | `[data-role="faq"]` | css-var | `--faq-card-border-width/--faq-card-border-color` |
| `appearance.itemCard.shadow` | `[data-role="faq"]` | css-var | `--faq-item-shadow` |
| `appearance.itemCard.radiusLinked` | `[data-role="faq"]` | css-var | chooses linked vs per-corner radius |
| `appearance.itemCard.radius` | `[data-role="faq"]` | css-var | `--faq-item-radius` (linked) |
| `appearance.itemCard.radiusTL` | `[data-role="faq"]` | css-var | `--faq-item-radius` (TL) |
| `appearance.itemCard.radiusTR` | `[data-role="faq"]` | css-var | `--faq-item-radius` (TR) |
| `appearance.itemCard.radiusBR` | `[data-role="faq"]` | css-var | `--faq-item-radius` (BR) |
| `appearance.itemCard.radiusBL` | `[data-role="faq"]` | css-var | `--faq-item-radius` (BL) |
| `appearance.linkStyle` | `[data-role="faq"]` | data-attr | `faqRoot.setAttribute('data-link-style', state.appearance.linkStyle)` |
| `appearance.linkUnderlineColor` | `[data-role="faq"]` | css-var | `--faq-link-underline-color` |
| `appearance.linkHighlightColor` | `[data-role="faq"]` | css-var | `--faq-link-highlight-color` |
| `appearance.linkTextColor` | `[data-role="faq"]` | css-var | `--faq-link-text-color` |
| `appearance.iconStyle` | `[data-role="faq"]` | css-var | `--faq-icon-expand/--faq-icon-collapse` |
| `appearance.iconColor` | `[data-role="faq"]` | css-var | `--faq-icon-color` |
| `appearance.podBorder` | `.pod` | css-var | `--pod-border-width/--pod-border-color` |
| `stage.background` | `.stage` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` |
| `pod.background` | `.pod` | css-var | `CKStagePod.applyStagePod(state.stage, state.pod, widgetRoot)` |
| `typography.roles.title.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.section.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.question.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `typography.roles.answer.color` | `[data-role="faq"]` | css-var | `CKTypography.applyTypography(state.typography, faqRoot, ...)` |
| `behavior.multiOpen` | runtime | dom | accordion click handler collapse rules |
| `behavior.expandAll` | runtime | dom | initial expand behavior in `applyState` |
| `behavior.expandFirst` | runtime | dom | initial expand behavior in `applyState` |
| `behavior.displayImages` | answer rendering | dom | `renderAnswerHtml` embeds images when enabled |
| `behavior.displayVideos` | answer rendering | dom | `renderAnswerHtml` embeds videos when enabled |
| `behavior.showBacklink` | `.ck-branding` | dom | `tokyo/widgets/shared/branding.js` |
| `geo.enableDeepLinks` | runtime | dom | `accordionRuntime.deepLinksEnabled` + writes `window.location.hash` |
| `seoGeo.enabled` | Venice schema | schema | `venice/lib/schema/faq.ts` gates schema emission |
| `seo.enableSchema` | Venice schema | schema | `venice/lib/schema/faq.ts` gates schema emission |
| `seo.canonicalUrl` | Venice schema | schema | `venice/lib/schema/faq.ts` sets FAQPage `@id/url` |
| `appearance.theme` | Bob editor | editor | theme preset selector; runtime ignores |
| `context.websiteUrl` | AI agent | agent | AI context only; runtime ignores |

## Reserved / no-op keys (kept for backwards-compat)
- `seo.businessType` (no runtime/schema effect)
- `geo.answerFormat` (no runtime/schema effect)

## Safe List Operations (recommended)
- Add section: append to `sections`
- Remove section: delete `sections[i]`
- Add question: append to `sections[i].faqs`
- Reorder question: move within `sections[i].faqs`
