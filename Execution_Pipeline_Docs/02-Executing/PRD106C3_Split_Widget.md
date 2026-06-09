# PRD106C3_Split_Widget

Status: Superseded execution correction - the single polymorphic `split` widget
is rejected. Execute four concrete Split-family widgets instead.
Owner: Widget system + Bob/Roma materialization
Date: 2026-06-08
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.1
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Conditional dependency: `PRD106B_PageComposer.md` and a product-owner-approved
account-instance selector component for embedded-instance widgets only.
Unlocks: Split-family widget instances for PRD106D route migration.
Authority owned by this PRD: Split-family widget Core state, controls,
defaults, DOM, CSS, runtime, editable fields, and deletion of the rejected
polymorphic Split model.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer
dependency indexing/recomposition, account-instance selector product design,
Cards, Big Bang, Call to Action, Prague route cutover.

## Critical Correction

The previous single `split` widget tried to make these two product axes mutable
inside one Core:

```text
content source: media | embedded instance
behavior: static | carousel
```

That creates four different products with different required data, preview
dependencies, runtime semantics, and Builder UX. Modeling those four products
as one widget produced invalid intermediate state, stale preview DOM, fake
control infrastructure, and a Builder panel that exposed impossible operations.

The surviving architecture is four widget identities:

| Widget type | User promise | Core source | Behavior |
| --- | --- | --- | --- |
| `split-media` | One text/media split section. | One image or video asset. | Static. |
| `split-instance` | One text/widget split section. | One account-owned embedded widget instance. | Static. |
| `split-carousel-media` | A text/media split with a visual carousel. | 2-6 image/video assets. | Carousel. |
| `split-carousel-instance` | A text/widget split with an embedded widget carousel. | 2-6 account-owned embedded widget instances. | Carousel. |

The old `split` widget is not the destination. It is a legacy
deletion/migration source only: no new instances, no duplication, no publishing,
no Widget Defaults exposure, and no compatibility alias. Existing dev/account
data may retain the old source only long enough to open, inspect, unpublish, or
delete it without orphaning stored instances.

## Product Tenets

- Each widget identity has one Core contract.
- Shell is the same for all four widgets.
- Media widgets do not know about embedded widget packages.
- Instance widgets do not know about image/video asset fields.
- Static widgets do not expose carousel controls.
- Carousel widgets do not expose an "enable carousel" toggle.
- No widget depends on `instance-picker`. That is not a product-owner-approved
  Builder/Dieter component.
- Invalid state fails at the named boundary. Do not silently heal, duplicate,
  delete, or auto-create items.
- Bob edits one resolved instance state in memory. Preview must not invent a
  second truth.

## Mandatory PRD106 Execution Contract

This PRD is step-gated. Execute exactly one numbered slice at a time.

Before executing any slice:

1. Read `106__Umbrella__Composition_Vision.md`.
2. Confirm PRD106A2 is green or explicitly fenced.
3. Name the widget identity being changed.
4. Name the surviving authority for every touched concern.
5. Execute only the current slice.

A slice is green only when its named completion evidence exists. A blocker
report stops execution; it does not unlock the next slice.

## Dependency Gate

| Dependency | Required green evidence | Applies to |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | All four widgets. |
| PRD106C | Split-family target map accepted. | All four widgets. |
| PRD106B | Embedded package contribution, dependency rebuild, and page refresh accepted. | `split-instance`, `split-carousel-instance`. |
| Product-owner selector component | Account-instance selection control designed and approved by Pietro. | `split-instance`, `split-carousel-instance` Builder editing. |

## Current Step Gate

Current executable status:

```text
Slices 0-5 are implemented for the media Split-family path.
Slice 6 is the remaining controlled account-data cleanup/migration gate.
```

Slice 0 is green only when:

- PRD106C3 no longer describes one `split` widget with `split.carousel.enabled`.
- PRD106C/A2 references name the four Split-family widgets.
- Widget build docs no longer list `instance-picker` as an approved control.
- The current `tokyo/product/widgets/split/**` implementation is legacy-only
  and fenced from new product state, not preserved as architecture.

## Execution Slices

| Slice | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 0 | Correct PRD106 truth. | PRD/doc diff. | Four widget identities are the only approved Split-family target. | Any doc still blesses one polymorphic Split as destination. |
| 1 | Inventory and delete fake infrastructure. | `rg` evidence and deletion diff. | `instance-picker` docs/spec usage and Bob custom hydrator are removed or fenced outside product. | Any widget still depends on `instance-picker`. |
| 2 | Build `split-media`. | Source diff, explicit registry/codebook decision, compile, Bob preview, save/package evidence. | One image/video media split renders and edits through real controls only. | Embedded instance or carousel paths appear. |
| 3 | Build `split-carousel-media`. | Source diff, explicit registry/codebook decision, compile, Bob preview, save/package evidence. | 2-6 image/video items render with carousel behavior, and item-count/identity invariants fail at create/save before persistence. | Static mode toggle, embedded instance paths, or runtime-only structural validation appear. |
| 4 | Stop at embedded-widget selector gate. | `rg` evidence. | No `split-instance`, `split-carousel-instance`, or `instance-picker` source exists until a real selector contract is approved. | AI invents a selector or Bob-only hydrator. |
| 5 | Fence legacy `split` exposure. | Roma/defaults/source audit. | New creation and Widget Defaults expose `split-media` and `split-carousel-media`, not the old polymorphic `split`. Existing dev `split` source remains legacy-only until data migration deletes it. | New product state can still be born as `split`. |
| 6 | Account data cleanup. | R2/Tokyo source audit and controlled updates. | Existing dev instances point to approved widget identities only. | Old `split` remains a customer-visible widget. |
| 7 | Full verification. | End-to-end evidence across Bob/Roma/Tokyo/package/page. | Built media widgets pass compile, preview, save, publish/materialize where applicable, and composed page safety. Instance widgets remain gated. | Any widget needs another compatibility path. |

## Shared Shell Contract

All four widgets consume the same shared Shell from PRD106A2:

```text
Stage
  Pod
    ck-headerLayout
      Header
      Widget Core
```

They all use the shared Shell systems:

- `header.*`
- `headerCta.*`
- `stage.*`
- `pod.*`
- `coreSize.*`
- `appearance.headerCta.*`
- `appearance.localeSwitcher*`
- `localeSwitcher.*`
- `typography.*`
- `behavior.showBacklink`
- `behavior.socialShare.*`

None of the four widgets may define duplicate Header, Header CTA, Stage, Pod,
Core size, locale switcher, typography, branding, or social-share controls.

Widget registry/codebook entries are implementation-slice decisions. Do not let
AI pick hidden codes, aliases, compatibility names, or display names without
making the registry/codebook diff explicit in that slice.

## Widget Core Contracts

### `split-media`

Core namespace: `splitMedia.*`

Required Core defaults:

- `splitMedia.media.kind`: `image` or `video`
- `splitMedia.media.image` using the existing `dropdown-fill` image/media shape
- `splitMedia.media.video` using the existing `dropdown-fill` video/media shape
- `splitMedia.media.alt`
- `splitMedia.media.fit`
- `splitMedia.media.position`
- `splitMedia.appearance.cardwrapper.*`

Content panel:

- shared Header content
- Media cluster
  - `splitMedia.media.kind`
  - image fill when kind is `image`
  - video fill when kind is `video`
  - alt text

Layout panel:

- shared Header layout
- shared Core size
- Media fit/position
- shared Stage/Pod layout

No carousel controls. No embedded instance controls.

### `split-carousel-media`

Core namespace: `splitCarouselMedia.*`

Required Core defaults:

- `splitCarouselMedia.items[]` with 2-6 items
- `splitCarouselMedia.items[].id`
- `splitCarouselMedia.items[].media.kind`: `image` or `video`
- `splitCarouselMedia.items[].media.image`
- `splitCarouselMedia.items[].media.video`
- `splitCarouselMedia.items[].media.alt`
- `splitCarouselMedia.media.fit`
- `splitCarouselMedia.media.position`
- `splitCarouselMedia.carousel.transition`
- `splitCarouselMedia.carousel.autoplay`
- `splitCarouselMedia.carousel.intervalMs`
- `splitCarouselMedia.carousel.loop`
- `splitCarouselMedia.carousel.showArrows`
- `splitCarouselMedia.carousel.showDots`
- `splitCarouselMedia.appearance.cardwrapper.*`

Content panel:

- shared Header content
- Visuals repeater for 2-6 media items

Layout panel:

- shared Header layout
- shared Core size
- Media fit/position
- Carousel controls
- shared Stage/Pod layout

No static/carousel toggle. No embedded instance controls.

### `split-instance`

Core namespace: `splitInstance.*`

Required Core defaults:

- `splitInstance.instance.instanceId`
- `splitInstance.appearance.cardwrapper.*`

Content panel:

- shared Header content
- Embedded widget cluster with a product-owner-approved account-instance
  selector component.

Layout panel:

- shared Header layout
- shared Core size
- shared Stage/Pod layout

No image/video controls. No carousel controls. No `instance-picker`.

Hard gate: this widget cannot ship a working Builder editing experience until
the account-instance selector component exists as a real Dieter/Bob control.

### `split-carousel-instance`

Core namespace: `splitCarouselInstance.*`

Required Core defaults:

- `splitCarouselInstance.items[]` with 2-6 items
- `splitCarouselInstance.items[].id`
- `splitCarouselInstance.items[].instance.instanceId`
- `splitCarouselInstance.carousel.transition`
- `splitCarouselInstance.carousel.autoplay`
- `splitCarouselInstance.carousel.intervalMs`
- `splitCarouselInstance.carousel.loop`
- `splitCarouselInstance.carousel.showArrows`
- `splitCarouselInstance.carousel.showDots`
- `splitCarouselInstance.appearance.cardwrapper.*`

Content panel:

- shared Header content
- Embedded widgets object-manager for 2-6 account-owned instances, using the
  product-owner-approved account-instance selector component.

Layout panel:

- shared Header layout
- shared Core size
- Carousel controls
- shared Stage/Pod layout

No image/video controls. No static/carousel toggle. No `instance-picker`.

Hard gate: this widget cannot ship a working Builder editing experience until
the account-instance selector component exists as a real Dieter/Bob control.

## Embedded Instance Package Contract

Embedded widgets are package dependencies, not nested authoring state.

For `split-instance` and `split-carousel-instance`:

- The Core stores only account-owned child `instanceId` references.
- Roma materialization loads the child instance package through the approved
  account instance package path.
- The public package includes `embeddedInstances` payload keyed by child
  `instanceId`.
- The parent runtime renders embedded packages from that payload.
- Missing, malformed, unowned, self-referential, cyclic, unpublished when public
  readiness is required, or unmaterialized child packages fail visibly at
  Roma/package/publish boundaries.
- Bob preview must use the same package payload semantics. It must not fake
  child state or silently leave stale DOM.

PRD106B/Roma owns dependency indexing, parent rebuild after child save, affected
page refresh, and delete blocking. Split-family widgets only declare their
package dependencies.

## Forbidden State And Controls

Forbidden in all four Split-family widgets:

- `split.carousel.enabled`
- `split.items[].kind` with `image|video|instance`
- one widget that switches between static and carousel
- one widget that switches between media and embedded instance
- `split.display.mode`
- `split.item.*`
- `split.instance.*` as a global mixed-mode object
- Prague `accountInstanceRef`
- `hero`
- `visual.*`
- `layout.variant`
- local Header/CTA/Stage/Pod copies
- `instance-picker`
- Bob-only instance selector hydration
- fake embedded package payloads
- runtime fallbacks that keep old DOM after invalid state

## Editable Fields

Shell contributes:

```text
header.title
header.subtitleHtml
headerCta.label
```

Core contributes:

```text
split-media: splitMedia.media.alt
split-carousel-media: splitCarouselMedia.items[].media.alt
split-instance: none; embedded instance carries its own editable fields
split-carousel-instance: none; embedded instances carry their own editable fields
```

Array editable fields must use stable item identity.

## Prague Evidence Map

| Prague source | New widget target |
| --- | --- |
| `hero` with media visual | `split-media` |
| `hero` with embedded widget visual | `split-instance` |
| `split` media block | `split-media` |
| `split-carousel` media carousel | `split-carousel-media` |
| `embed-carousel` / embedded carousel behavior | `split-carousel-instance` |

Prague does not define state paths, Builder controls, runtime shape, locale
behavior, or compatibility aliases.

## Verification Gates

Each widget must pass before the next slice starts:

- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/bob lint`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm audit:106 --skip-r2`
- `pnpm validate:widgets`
- Bob compile route returns 200 for the widget.
- Builder preview renders nonblank output with no console runtime errors.
- ToolDrawer shows only controls that can affect the current widget.
- Save/materialization succeeds for valid state.
- Save/materialization fails with a named reason for invalid required state.
- Public package contains no duplicate Shell source and no old `split` alias.

For embedded-instance widgets, additional gates:

- same-account child selection data comes from Roma, not Bob discovery;
- current parent instance cannot be selected;
- self-reference and cycles fail visibly;
- missing child package fails visibly;
- child save rebuilds affected parent package or marks it stale/failed through
  the approved PRD106B path;
- composed pages with parent widgets refresh through Roma/Page Composer.

## Acceptance

- The single polymorphic `split` widget is deleted or fully fenced from customer
  widget targets.
- `split-media` and `split-carousel-media` are the shipped Split-family media
  widget targets.
- `split-instance` and `split-carousel-instance` are approved future targets,
  but they remain blocked until the account-instance selector component is
  product-owner-approved and implemented as a real Dieter/Bob control.
- Shipped Split-family widgets consume the shared Shell.
- Media widgets ship without embedded package dependencies.
- `split-carousel-media` rejects invalid item counts or missing/duplicate item
  IDs at Roma create/save before Tokyo stores source or package artifacts.
- No docs or widget specs list `instance-picker` as an approved control.
- No Builder UI exposes a control that cannot render, preview, save, and
  materialize through the same product path.
