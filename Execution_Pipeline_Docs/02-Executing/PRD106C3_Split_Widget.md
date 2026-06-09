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

The surviving architecture names four concrete widget identities, but only the
media identities are executable in this PRD pass. The embedded-instance
identities are reserved future targets and must not get source folders,
defaults, specs, Builder controls, runtime, package payloads, or migration work
until a real account-instance selector contract exists.

| Widget type | User promise | Core source | Behavior |
| --- | --- | --- | --- |
| `split-media` | One text/media split section. | One image or video asset. | Static. |
| `split-instance` | One text/widget split section. | One account-owned embedded widget instance. | Static. |
| `split-carousel-media` | A text/media split with a visual carousel. | 2-6 image/video assets. | Carousel. |
| `split-carousel-instance` | A text/widget split with an embedded widget carousel. | 2-6 account-owned embedded widget instances. | Carousel. |

The old `split` widget is not the destination and is not a compatibility
surface. Delete the legacy `split` widget source, registry/codebook/defaults
exposure, generated definition import, and new-instance paths. Any existing
dev/account data that still names `split` is controlled cleanup input: migrate
it to an approved Split-family target or mark it invalid for deletion through a
data operation. Do not preserve old `split` source so the product can keep
opening, duplicating, publishing, or silently materializing it.

## Product Tenets

- Each widget identity has one Core contract.
- Shell is the same for all four widgets.
- Media widgets do not know about embedded widget packages.
- Instance widgets do not know about image/video asset fields.
- Static widgets do not expose carousel controls.
- Carousel widgets do not expose an "enable carousel" toggle.
- No widget depends on `instance-picker`. That is not a product-owner-approved
  Builder/Dieter component.
- Core DOM stays inside the shared Shell Pod, specifically inside
  `.ck-headerLayout__body`. Split-family widgets must not render a separate
  full-width sibling, preview-only body, or page-section wrapper outside the
  Pod.
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
Documentation has been corrected before the next execution pass.

Next implementation execution:
1. Delete the legacy `split` widget source/exposure.
2. Repair `split-media` and `split-carousel-media` to use real media controls.
3. Keep `split-instance` and `split-carousel-instance` deferred until a real
   account-instance selector exists.
4. Run controlled account-data cleanup only after source/default truth is clean.
```

Slice 0 is green only when:

- PRD106C3 no longer describes one `split` widget with `split.carousel.enabled`.
- PRD106C/A2 references name the four Split-family widgets.
- Widget build docs no longer list `instance-picker` as an approved control.
- The current `tokyo/product/widgets/split/**` implementation is deleted from
  product source/exposure, not fenced as a long-lived architecture.

## Execution Slices

| Slice | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 0 | Correct PRD106 truth. | PRD/doc diff. | Four widget identities are the only approved Split-family target. | Any doc still blesses one polymorphic Split as destination. |
| 1 | Delete fake and legacy infrastructure. | `rg` evidence and deletion diff. | `instance-picker` docs/spec usage, Bob custom hydrator paths, and `tokyo/product/widgets/split/**` product source/exposure are removed. | Any widget still depends on `instance-picker`, or old `split` can still be created, duplicated, published, compiled, or listed as a customer target. |
| 2 | Build/repair `split-media`. | Source diff, explicit registry/codebook decision, compile, Bob preview, save/package evidence. | One image/video media split renders and edits through one real `dropdown-fill` media control at `splitMedia.media` with `fill-modes: "image,video"` only. | Embedded instance paths, carousel paths, a fake media kind picker, or separate image/video sibling controls appear. |
| 3 | Build/repair `split-carousel-media`. | Source diff, explicit registry/codebook decision, compile, Bob preview, save/package evidence. | A `repeater` at `splitCarouselMedia.items` manages 2-6 items; each item has stable identity, one real `dropdown-fill` media control at `splitCarouselMedia.items.__INDEX__.media` with `fill-modes: "image,video"` only, and item alt text. Item-count/identity invariants fail at create/save before persistence. | Static mode toggle, embedded instance paths, object-manager carousel visuals, a fake media kind picker, separate image/video sibling controls, or runtime-only structural validation appear. |
| 4 | Stop at embedded-widget selector gate. | `rg` evidence. | No `split-instance`, `split-carousel-instance`, `instance-picker`, fake selector, or Bob-only hydrator source/default/spec/runtime exists until a real selector contract is approved. | AI invents a selector, package payload, or Builder-only child-instance hydrator. |
| 5 | Confirm legacy `split` deletion in product exposure. | Roma/defaults/source audit. | New creation, Widget Defaults, codebook/registry, generated widget definitions, and Prague migration maps expose `split-media` and `split-carousel-media`, not the old polymorphic `split`. | New product state can still be born as `split`. |
| 6 | Account data cleanup. | R2/Tokyo source audit and controlled updates. | Existing dev instances point to approved widget identities only or are explicitly marked invalid for deletion. | Old `split` remains a customer-visible widget or depends on preserved legacy source. |
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

- `splitMedia.media`: one standard `dropdown-fill` media payload written by a
  real Dieter/Bob media fill control with `fill-modes: "image,video"` only
- `splitMedia.alt`
- `splitMedia.fit`
- `splitMedia.position`
- `splitMedia.appearance.cardwrapper.*`

Content panel:

- shared Header content
- Media cluster
  - one `dropdown-fill` field bound to `splitMedia.media`
  - `attrs["fill-modes"] = "image,video"`
  - alt text

Layout panel:

- shared Header layout
- shared Core size
- Media fit/position
- shared Stage/Pod layout

No carousel controls. No embedded instance controls. No media kind picker. No
separate image/video controls outside the one `dropdown-fill` bound to
`splitMedia.media`.

### `split-carousel-media`

Core namespace: `splitCarouselMedia.*`

Required Core defaults:

- `splitCarouselMedia.items[]` with 2-6 items
- `splitCarouselMedia.items[].id`
- `splitCarouselMedia.items[].media`: one standard `dropdown-fill` media
  payload written by a real Dieter/Bob media fill control with
  `fill-modes: "image,video"` only
- `splitCarouselMedia.items[].alt`
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
- Visuals `repeater` bound to `splitCarouselMedia.items` with 2-6 media items,
  stable item IDs, and a `default-item`
- Each repeater item template contains exactly one media fill field:
  `type: "dropdown-fill"`, `path:
  "splitCarouselMedia.items.__INDEX__.media"`, `attrs["fill-modes"]:
  "image,video"`
- Each repeater item template may contain item alt text bound to
  `splitCarouselMedia.items.__INDEX__.alt`
- The repeater control exposes `min: "2"` and `max: "6"`. Add/remove UX should
  stop users from creating invalid item counts, while Roma create/save remains
  the authoritative failure boundary.
- Item IDs are created by the repeater add action when the user intentionally
  adds an item. `split-carousel-media` must not use Bob normalization `idRules`
  to silently fill missing IDs in arbitrary saved/imported state.

Layout panel:

- shared Header layout
- shared Core size
- Media fit/position
- Carousel controls
- shared Stage/Pod layout

No static/carousel toggle. No embedded instance controls. No media kind picker.
No separate image/video controls outside each item's one `dropdown-fill` bound
to `splitCarouselMedia.items.__INDEX__.media`. No object-manager for carousel
visuals.

### `split-instance` (Reserved, Deferred)

Core namespace: `splitInstance.*`

This widget is a reserved future target only. Do not create
`tokyo/product/widgets/split-instance/**`, Core defaults, widget-defaults seed
state, generated widget definitions, Bob controls, runtime, package payload
code, or Prague migration output for this identity until the account-instance
selector component exists as a real Dieter/Bob control backed by Roma account
instance data.

Future implementation must use the reserved `splitInstance.*` namespace, no
image/video controls, no carousel controls, and no `instance-picker`.

### `split-carousel-instance` (Reserved, Deferred)

Core namespace: `splitCarouselInstance.*`

This widget is a reserved future target only. Do not create
`tokyo/product/widgets/split-carousel-instance/**`, Core defaults,
widget-defaults seed state, generated widget definitions, Bob controls,
runtime, package payload code, or Prague migration output for this identity
until the account-instance selector component exists as a real Dieter/Bob
control backed by Roma account instance data.

Future implementation must use the reserved `splitCarouselInstance.*`
namespace, stable item identity, 2-6 account-owned child instance references,
carousel behavior, no image/video controls, no static/carousel toggle, and no
`instance-picker`.

## Embedded Instance Package Contract

Embedded widgets are package dependencies, not nested authoring state. This
section is a future contract note only; it is not execution permission before
the account-instance selector exists.

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
split-media: splitMedia.alt
split-carousel-media: splitCarouselMedia.items[].alt
split-instance: none; embedded instance carries its own editable fields
split-carousel-instance: none; embedded instances carry their own editable fields
```

Array editable fields must use stable item identity.

## Prague Evidence Map

| Prague source | New widget target |
| --- | --- |
| `hero` with media visual | `split-media` |
| `hero` with embedded widget visual | Deferred; future `split-instance` only after selector approval |
| `split` media block | `split-media` |
| `split-carousel` media carousel | `split-carousel-media` |
| `embed-carousel` / embedded carousel behavior | Deferred; future `split-carousel-instance` only after selector approval |

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

- The single polymorphic `split` widget is deleted from customer widget targets
  and product source/exposure.
- `split-media` and `split-carousel-media` are the shipped Split-family media
  widget targets.
- `split-instance` and `split-carousel-instance` are approved future targets,
  but they remain blocked until the account-instance selector component is
  product-owner-approved and implemented as a real Dieter/Bob control.
- `split-media` uses one real media `dropdown-fill` field at `splitMedia.media`
  with `fill-modes: "image,video"` only.
- `split-carousel-media` uses a `repeater` at `splitCarouselMedia.items`; each
  item uses one real media `dropdown-fill` field at
  `splitCarouselMedia.items.__INDEX__.media` with `fill-modes: "image,video"`
  only.
- Split-family Core DOM stays inside the shared Shell Pod and
  `.ck-headerLayout__body`.
- Shipped Split-family widgets consume the shared Shell.
- Media widgets ship without embedded package dependencies.
- `split-carousel-media` rejects invalid item counts or missing/duplicate item
  IDs at Roma create/save before Tokyo stores source or package artifacts.
- `split-carousel-media` uses repeater add-time identity creation, not generic
  saved-state ID healing, and the Builder repeater enforces the same 2-6 count
  limits in the panel.
- No docs or widget specs list `instance-picker` as an approved control.
- No Builder UI exposes a control that cannot render, preview, save, and
  materialize through the same product path.
