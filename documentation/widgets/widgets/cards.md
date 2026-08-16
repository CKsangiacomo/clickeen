# Cards Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Cards renders a repeatable set of cards with text, media metadata, and optional
links inside the shared widget Shell.

## Source

```text
tokyo/product/widgets/cards/
```

Files:

```text
spec.json
editable-fields.json
limits.json
cards_tooldrawer_l10n_labels/
  en.json
widget.html
widget.css
widget.client.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `cards` |
| display name | Cards |
| Core namespace | `cards.*` |
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

Core defaults live under:

```text
cards
typography
uiLabels
```

Core state families:

```text
cards.appearance
cards.betweenCards
cards.cardPadding
cards.columns
cards.customCardStyles
cards.gap
cards.items
cards.treatment
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
cards.items[].title
cards.items[].copy
cards.items[].media.imageAlt
cards.items[].link.label
```

`header.title`, `header.subtitleHtml`, `cards.items[].title`, and
`cards.items[].copy` are rich-text Dropdown Edit fields. Their saved inline
HTML supports emphasis, `br`, and `http(s)` links.

`cards.items[]` entries carry stable `id` values in widget Core state.
The Content Repeater's declared new-card object carries the same nested field
shape as a saved card, including `media.image: { "type": "none" }`, and leaves
only its declared `id` empty for Repeater to assign.

## Editor Composition

Cards follows the canonical ToolDrawer sequence:

1. **Content** — shared Header plus the initially open Cards section. Each
   repeated card owns title, copy, media, image alt text, and link values.
   `linked-cards` already makes every card a link, so that treatment exposes
   Link URL and Link label directly and omits the otherwise optional Add link
   to card toggle.
2. **Layout** — shared Header/Core/Stage/Pod layout, Card format, Columns,
   exact pixel gap/padding, and connector enable/type/geometry.
3. **Appearance** — shared Header/Stage/Pod appearance, optional per-card
   styling, and the existing connector line/icon colors. Color controls remain
   in Appearance; connector arrangement remains in Layout.
4. **Typography** — the Card title and Card copy roles after the shared roles.
5. **Settings** — shared branding and social-share behavior only.

Only shared Header and the primary Cards Content section start open. Every
Layout, Appearance, Typography, and Settings section starts collapsed.

## Limits

```text
items.group.small.max -> cards.items[]
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Shared Widget Utilities

Cards uses the presentation frame for Stage/Pod, the Shell for Header/Core
composition, and shared utilities for Core sizing, typography, branding,
social share, and locale switching. Card visual surfaces are Core-owned under
`cards.*`.

Runtime requires these Core DOM hooks:

```text
[data-role="cards"]
[data-role="cards-core"]
```

`widget.client.js` registers as `cards`, validates `cards.*`, renders cards
into `cards-core`, applies shared widget utilities, and binds `ck:state-update`
for the current instance id.

Runtime invariants:

- `cards.items[]` must contain 2-16 cards.
- `cards.items[]` must contain stable, unique item ids.
- Card `title` and `copy` are required non-empty rich-text values.
- `cards.items[].media.kind` is `none`, `icon`, or `image`.
- Image cards require `cards.items[].media.image.src`.
- Icon cards require a Dieter icon name.
- Linked-card treatment requires each rendered card link to have both href and label.
- Card action URLs are validated as empty, `#`, root-relative, `http(s)`,
  `mailto`, or `tel`.
- Card wrapper styling uses shared `CKSurface.applyCardWrapper`, not a
  widget-local surface helper.

Presentation invariants:

- Header title typography remains owned by the shared Header role; Card title
  typography applies only to rendered cards.
- Card-title and Card-copy rich-text links inherit their exact role color.
- Complete titles, copy, and link labels wrap inside the available card width.
- Steps removes the browser's native ordered-list marker/margin/padding and
  uses only the existing Cards step marker.
- Responsive card composition follows the Pod's existing inline-size
  container: two columns at `900px` or less and one column at `620px` or less.
  Connector placement follows that effective column count rather than the
  wider configured column value.

## Current Frozen-Functionality Boundaries

This Widget-system presentation pass deliberately does not reinterpret these
existing product contracts:

- Selecting Image exposes its asset control before an image source exists, so
  exact runtime validation can reject that intermediate preview state. A
  different draft-validity law requires a separate product decision.
- Per-card Fill value `type: "none"` means exact transparent fill. It is not an
  inheritance marker. Enabling per-card styles with untouched `none` values
  therefore does not preserve the shared card border/accent.
- The current `textTone` choices do not override the exact Card title/Card copy
  typography colors, and `inherit`/`default` are not yet distinct visible
  outcomes. Defining those meanings is product behavior, not a presentation
  cleanup.
- A whole-card link can currently contain rich-text links from title/copy.
  Resolving that nested-interaction model requires a deliberate link contract.
- The non-structural Appearance Object Manager currently renders repeated
  per-card controls without visible item headings. That behavior belongs to
  the shared Object Manager contract, not Cards-local markup.

Treatment and layout state:

```text
cards.treatment -> cards|linked-cards|steps
cards.columns -> 2|3|4
cards.gap
cards.cardPadding
cards.betweenCards
cards.customCardStyles
cards.appearance.cardwrapper
```

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/bob test:editor-contract
```
