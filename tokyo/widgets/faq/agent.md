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

Appearance:
- `appearance.iconStyle` (`plus` | `chevron` | `arrow` | `arrowshape`; accordion only)
- `appearance.itemCard.shadow` (object; item card shadow)
  - `enabled` (boolean)
  - `inset` (boolean)
  - `x` (number; px)
  - `y` (number; px)
  - `blur` (number; px)
  - `spread` (number; px)
  - `color` (string; hex)
  - `alpha` (number; 0..100)

Behavior:
- `behavior.expandFirst` (boolean; accordion only)
- `behavior.multiOpen` (boolean; accordion only)
- `behavior.expandAll` (boolean; accordion only)
- `behavior.displayImages` (boolean)
- `behavior.displayVideos` (boolean)
- `behavior.showBacklink` (boolean; controls global branding badge)

Stage/Pod (layout spacing lives here; no widget-level padding):
- `stage.background`, `stage.alignment`, `stage.padding*`
- `pod.background`, `pod.widthMode`, `pod.contentWidth`, `pod.padding*`, `pod.radius*`

## Rendering Notes
- Inline HTML is sanitized; allowed tags: `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br` (links require `http(s)://`).
- When enabled, `answer` URLs can embed images (`.png/.jpg/.gif/.webp/.svg`) and YouTube/Vimeo videos.

## Branding (global)
- The "Made with Clickeen" badge is NOT part of the widget markup.
- It is injected globally by `tokyo/widgets/shared/branding.js` into the closest `.pod` as `.ck-branding`.
- Visibility is driven by `behavior.showBacklink`.

## Safe List Operations (recommended)
- Add section: append to `sections`
- Remove section: delete `sections[i]`
- Add question: append to `sections[i].faqs`
- Reorder question: move within `sections[i].faqs`
