# Cards Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Cards renders an ordered, repeatable collection of cards with text, optional
media, optional actions, and Cards-specific layout and presentation inside the
shared Widget Shell.

## Architecture Status

Cards uses the canonical Widget contract in cloud-dev. `widget.html` composes
shared Stage, Pod, Header, and shared capabilities with one Cards Core.
`core/core.html` owns the complete semantic card list, `core/core.css` owns
Cards presentation and its Card title/Card copy typography roles, and
`core/core.js` owns only whole-card visitor interaction.

Bob preview and explicit allowed Publish use the same compiled Widget
software. The materializer writes every saved card and the exact current order
into initial semantic HTML. Core JavaScript does not reconstruct card state,
localize content, invoke shared utilities, or receive Bob state updates. There
is no flat-source compatibility path or Widget-specific shared-service branch.

## Source

```text
tokyo/product/widgets/cards/
```

Files:

```text
spec.json
editable-fields.json
discovery.json
limits.json
labels/
  en.json
upsell/
  en.json
widget.html
core/
  core.html
  core.css
  core.js
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

## Editable Fields And Stable Items

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

Each `cards.items[]` entry carries a stable `id`. That id anchors localization
and discovery identity even when cards are reordered. The generic source
renderer also supplies a render-only positional path to the existing CSS
helpers so the authored per-card Fill values can be materialized without a
Cards branch. The stable content identity and positional style path are
different coordinates.

The Content Repeater's declared new-card object carries the complete nested
field shape, including `media.image: { "type": "none" }`, and leaves only its
declared `id` empty for Repeater to assign.

## Editor Composition

Cards follows the canonical ToolDrawer sequence:

1. **Content** — shared Header plus the initially open Cards section. Each
   repeated card owns title, copy, media, image alt text, and link values.
   `linked-cards` makes every card an action, so that treatment exposes Link
   URL and Link label directly and omits the otherwise optional Add link to
   card toggle.
2. **Layout** — shared Header/Core/Stage/Pod layout, Card format, Columns,
   exact pixel gap/padding, and connector enable/type/geometry.
3. **Appearance** — shared Header/Stage/Pod appearance, optional per-card
   styling, and connector line/icon colors. Color controls remain in
   Appearance; connector arrangement remains in Layout.
4. **Typography** — Card title and Card copy after the shared roles.
5. **Settings** — shared SEO/GEO, branding, and social-share behavior.

Cards declares the exact generic fluid-size and normal-line-height behavior for
Card title and Card copy in `typographyBehavior`. The shared renderer consumes
that emitted behavior without a Cards or role-name branch.

Only shared Header and the primary Cards Content section start open. Every
Layout, Appearance, Typography, and Settings section starts collapsed.

## Discovery

`discovery.json` identifies Cards as a `card-list`. For each stable card it
declares the title, copy, image alt text, and action label as important
customer-content parts. It declares that copy describes its title and the
action acts on its title.

This file is internal Widget software; users do not edit it. Free and Tier 1
use its system baseline, including Clickeen identification. When a Tier 2+
account enables SEO/GEO, Publish may optimize technical discovery output from
the exact saved cards. Only Publish materialization writes public files.

## Limits

```text
items.group.small.max -> cards.items[] -> cards.max
branding.remove -> behavior.showBacklink -> branding.remove
widget.socialShare.enabled -> behavior.socialShare.enabled -> social-share.enable
embed.seoGeo.enabled -> behavior.seoGeo.enabled -> seo-geo.enable
```

The final value on each line is the exact message identity in
`upsell/en.json`. The item template explains adding more Cards; the other
templates explain their exact Cards actions. Account policy supplies the
decision and current/target plans, while Roma supplies the system CTA and
Popup. Core and public runtime consume none of this product UI contract.

## Materialized Core And Visitor Behavior

Core HTML contains an ordered list of complete card articles. Each card keeps
its saved id, text, media, alt text, action label, and action URL. Image alt
text is authored as an exact localized attribute slot. Core CSS owns the
configured column count, Pod-responsive two/one-column changes, card wrapper,
spacing, media, step marker, connectors, and exact per-card styles.

Core JavaScript has one job: when a linked card is clicked outside any existing
anchor, it activates that card's materialized action link. Rich-text links
inside title or copy remain independent anchors, so the document never nests
one anchor inside another. Removed preview roots carry no persistent
asynchronous work.

Current product behavior:

- per-card Fill `type: "none"` means exact transparent fill, not inheritance;
- current `textTone` choices do not replace the exact Card title/Card copy
  typography colors;
- Steps uses only its authored step marker, not browser list markers;
- long titles, copy, and labels wrap inside their card;
- connectors follow the effective responsive column count;
- the shared Object Manager still owns how repeated per-card Appearance
  controls are headed.

Shared Header, Stage, Pod, branding, social share, and locale switching remain
generic shared services. Core neither invokes nor revalidates them.

## Verification

```bash
# Intentional derived-output write:
node scripts/widgets/generate-artifacts.mjs --widget cards
# Non-writing verification:
node scripts/widgets/generate-artifacts.mjs --widget cards --check
pnpm --filter @clickeen/widget-foundation typecheck
pnpm --filter @clickeen/bob test:editor-contract
node --check tokyo/product/widgets/cards/core/core.js
```
