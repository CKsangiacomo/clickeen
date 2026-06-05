# PRD106C3_Split_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.1
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: Split widget instances for PRD106D route migration.
Authority owned by this PRD: Split widget Core state, controls, defaults, DOM, CSS, runtime, and editable fields.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Cards, Big Bang, CTA, Prague route cutover.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- The current step is the only execution permission.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- The goal is not to accommodate old drift. If existing code contradicts this
  PRD's intended architecture, delete it, fence it, or stop; do not preserve it
  and work around it.

## Mandatory PRD106 Execution Contract

This PRD is step-gated. Execute exactly one numbered step at a time.

Before executing any step:

1. Read `106__Umbrella__Composition_Vision.md`.
2. Confirm PRD106A2 is green or explicitly fenced.
3. Confirm PRD106C assigns Split/hero behavior to this PRD.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | REQUIRED |
| PRD106C | Split target and Prague source scope accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Define Split Core contract.
```

Required evidence before marking green:

- Split Core state paths are listed.
- Split validation rules are listed.
- Split embedded-instance dependency contribution is listed.
- Shell-owned paths are excluded.
- Prague hero/split source behavior is mapped to Split Core or defaults.

Stop conditions:

- Split requires new Header/CTA/Stage/Pod state.
- Split requires page-level layout or columns.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Split state, labels, and forbidden paths. | State table, label defaults, forbidden path list. | Only `core.items[]`, `core.media.*`, `core.carousel.*`, `coreSize.*`, and `uiLabels.core.*` are added. | Shell path or duplicate state shape needed. |
| 2 | Define validation, policy limits, and dependency contract. | Validation table, `limits.json` mapping, and embedded dependency rules. | Invalid item counts/kinds/refs fail visibly; `core.items[]` maps to `items.group.small.max`; embedded refs are reported to materialization. | Silent healing, untracked embedded ref, or per-widget tier table. |
| 3 | Confirm shared Shell dependency. | A2 green/fence evidence for Core div, `coreSize.*`, `uiLabels.core.*`, and Layout order. | Split consumes Shell sizing/labels; no local Core sizing fork. | A2 cannot provide required Shell behavior. |
| 4 | Build Content controls: static mode. | Spec/control diff and Bob compile evidence. | `core.carousel.enabled=false` shows only `core.items.0.*` static editor. | Repeater visible or duplicate `core.item.*` state appears. |
| 5 | Build Content controls: carousel mode. | Spec/control diff and Bob compile evidence. | `core.carousel.enabled=true` shows `core.items[]` object-manager with per-item kind controls. | Item-count `showIf`, wildcard path, or unstable identity. |
| 6 | Build Layout controls: Visual size and Media Fit. | Spec/control diff and Bob compile evidence. | `Visual size` uses shared `coreSize.*`; Media Fit follows it and applies to image/video. | `core.height`, `visual.height`, or complex mixed-item `showIf`. |
| 7 | Build Layout controls: Carousel. | Spec/control diff and Bob compile evidence. | Carousel cluster shows only when enabled; interval shows only when autoplay true. | `core.display.mode` or item-count `showIf`. |
| 8 | Build static image/video runtime. | DOM/CSS/runtime diff and preview evidence. | One image/video renders in `.ck-headerLayout__body`; `coreSize.*` and `core.media.*` apply. | Runtime bypasses Shell or assumes singleton instance. |
| 9 | Build carousel runtime. | DOM/CSS/runtime diff, accessibility notes, preview evidence. | Multiple items render with transition/autoplay/loop/arrows/dots without collisions. | No keyboard/ARIA behavior or global singleton state. |
| 10 | Build embedded-instance runtime and package contribution. | Runtime/materialization diff and dependency evidence. | Embedded instances render as account-owned materialized packages and are exposed as dependencies. | Embedded ref is untracked, auto-created, forked, or page-owned. |
| 11 | Validate editable fields and translations. | Editable-fields diff/tests. | `core.items[].image.alt` and `core.items[].video.alt` use stable item identity; embedded instance text stays in embedded instance. | Missing stable identity or fake wildcard. |
| 12 | Verify Bob/Roma materialization and composed-page safety. | Compile/save/package/page-composition evidence. | Static, carousel, and embedded Split packages materialize; two Split instances on one page do not collide. | Duplicate Shell code, stale embedded dependency, or page recomposition miss. |

## Purpose

Build the surviving `split` widget. Split absorbs the useful Prague `hero` and
Prague `split` media/embedded-widget behavior, but Prague is not the
implementation base.

The implementation base is the shared Widget Shell extracted from FAQ.

```text
FAQ:
Stage -> Pod -> ck-headerLayout(Header + FAQ Core)

Split:
Stage -> Pod -> ck-headerLayout(Header + Split Core)
```

Split is not a new editor architecture. It is the shared Widget Shell with one
Split-specific Core added.

`hero` is not a separate migrated widget. It is Split with top-of-page defaults:
larger typography, Header placed left, and Split Core on the right.

## Implementation Reference

FAQ is the approved proof/source for the Widget Shell extraction, but
`PRD106A2_WidgetShellExtraction.md` owns that extraction. Split must consume
`packages/widget-shell/`.

Do not use current `split`, `hero`, `countdown`, `logoshowcase`, or Prague block
state as the starting point. Countdown and LogoShowcase are not approved bases
for this migration. Prague blocks are product/visual evidence only.

Relevant Shell source, owned by PRD106A2:

- `tokyo/product/widgets/faq/spec.json`
- `tokyo/product/widgets/faq/editable-fields.json`
- `tokyo/product/widgets/faq/widget.html`
- `tokyo/product/widgets/faq/widget.css`
- `tokyo/product/widgets/faq/widget.client.js`
- `bob/lib/compiler/modules/header.ts`
- `bob/lib/compiler/modules/stagePod.ts`
- `bob/lib/compiler/editor-contract.ts`
- `tokyo/product/widgets/shared/header.js`
- `tokyo/product/widgets/shared/header.css`
- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/surface.js`
- `tokyo/product/widgets/shared/previewL10n.js`

## Execution Rule

Build Split by using the shared Widget Shell:

1. Consume `packages/widget-shell/`.
2. Keep the shared Header, CTA, Stage/Pod, Appearance, Typography, Behavior,
   locale switcher, and editable-fields mechanisms.
3. Add only Split-specific Core state, controls, DOM, CSS, and runtime.

This is the safest execution path because FAQ is known to compile, render, edit,
translate, and save correctly in Bob/Roma.

## Do Not Carry FAQ Core

Do not carry FAQ-specific Core state and controls:

- `sections[]`
- `displayCategoryTitles`
- `layout.type`
- `layout.columns.*`
- `layout.cardsLayout`
- `layout.gap`
- `layout.itemQaGap*`
- `layout.itemPadding*`
- `appearance.itemBackground`
- `appearance.iconStyle`
- `appearance.iconColor`
- `appearance.link*`
- FAQ `seoGeo.*`, `seo.*`, and `geo.*` controls for question schema/deep links
- `behavior.expandFirst`
- `behavior.multiOpen`
- `behavior.expandAll`

Do not carry FAQ-specific Core runtime:

- Q/A section rendering
- accordion/list/multicolumn behavior
- accordion icon behavior
- FAQ deep links
- FAQ answer link parsing
- FAQ copy override paths for questions/answers

Keep shared runtime calls that FAQ already proves:

- `CKStagePod.applyStagePod`
- `CKTypography.applyTypography`
- `CKHeader.applyHeader`
- `CKLocaleSwitcher.applyLocaleSwitcher`
- `CKSurface.applyCardWrapper`
- `CK_PREVIEW_L10N.loadLocalizedState` through the same preview localization
  mechanism

## Keep From FAQ

Split must keep FAQ's working shared model.

### State Kept

- `header.*`
- `cta.*`
- `stage.*`
- `pod.*`
- `appearance.theme`
- `appearance.cta*`
- `appearance.podBorder`
- `appearance.cardwrapper.*`
- `localeSwitcher.*`
- `appearance.localeSwitcher*`
- `typography.*`
- `behavior.showBacklink`
- `behavior.socialShare.enabled`

### Editor Panels Kept

Layout, Appearance, Typography, and Settings are almost the same as FAQ.

Keep these shared clusters:

- `header-content`
- `header-layout`
- `header-appearance`
- `stagepod-layout`
- `stagepod-appearance`
- standardized `typography` panel

Keep FAQ's settings placement for shared behavior:

- `behavior.showBacklink`
- `behavior.socialShare.enabled`

## Add For Split

The only Split-specific surface is the Split Core div. Core is the generic
widget-owned slot where Split software begins; it is not the carousel itself.

The Split software inside the Core div can render one or more Split items. Each
Split item can only be:

- an image;
- a video;
- an embedded widget instance.

Carousel is optional Split software inside the Core div. It is not a separate
widget, not a separate page-composition feature, and not the definition of
Core.

It must not be a decorative fill. Color, gradient, background, border, radius,
and shadow belong to the shared Shell/Stage/Pod/Surface appearance controls.

Approved Split-specific state:

| Path | Owner | Meaning |
| --- | --- | --- |
| `core.items[]` | content/config | Ordered Core item manager. Minimum 1 item; default maximum 6 items. |
| `core.items[].id` | identity | Stable item identity for editing, translation, and carousel runtime. |
| `core.items[].kind` | config | One of `image`, `video`, or `instance`. |
| `core.items[].image.*` | config/content | Existing image asset/reference shape plus image alt text. Used only when item kind is `image`. |
| `core.items[].video.*` | config/content | Existing video asset/reference shape plus poster/alt text when supported. Used only when item kind is `video`. |
| `core.items[].instance.instanceId` | reference | Account-owned widget instance embedded in this Core item. Used only when item kind is `instance`. |
| `core.media.fit` | config | How image/video items fit inside the Core div. Allowed values: `cover`, `contain`. |
| `core.media.position` | config | Image/video object position. Allowed values: `center`, `top`, `bottom`, `left`, `right`. |
| `core.carousel.enabled` | config | Enables carousel authoring and carousel runtime behavior. |
| `core.carousel.transition` | config | Carousel transition. Allowed values: `slide`, `fade`. |
| `core.carousel.autoplay` | config | Whether the carousel advances automatically. |
| `core.carousel.intervalMs` | config | Autoplay interval in milliseconds. |
| `core.carousel.loop` | config | Whether next/previous wraps at ends. |
| `core.carousel.showArrows` | config | Shows previous/next controls. |
| `core.carousel.showDots` | config | Shows position dots. |

State validity:

```text
core.carousel.enabled == false -> core.items.length must be exactly 1
core.carousel.enabled == true  -> core.items.length must be 2-6
```

Do not silently delete extra items when carousel is disabled. If state violates
the rule, Bob/Roma validation must fail visibly at save/publish.

Validation rules:

| Condition | Required result |
| --- | --- |
| `core.carousel.enabled == false` and `core.items.length != 1` | Fail save/publish visibly. |
| `core.carousel.enabled == true` and `core.items.length < 2` | Fail save/publish visibly. |
| `core.carousel.enabled == true` and `core.items.length > 6` | Fail save/publish visibly. |
| Any `core.items[].id` is missing or duplicated | Fail save/publish visibly. |
| Any `core.items[].kind` is not `image`, `video`, or `instance` | Fail save/publish visibly. |
| Image item lacks a valid image reference | Fail save/publish visibly. |
| Video item lacks a valid video reference | Fail save/publish visibly. |
| Instance item lacks a valid account-owned materialized instance reference | Fail save/publish visibly. |
| Instance item references the Split instance itself | Fail save/publish visibly. |

## Entitlements And Limits

Tier values live only in
`packages/ck-policy/entitlements.matrix.json`. Split must not define a
per-widget tier table.

Split maps its item count to the existing small item-group policy key:

```json
{
  "kind": "limit",
  "key": "items.group.small.max",
  "path": "core.items[]",
  "metric": "count"
}
```

This mapping belongs in `tokyo/product/widgets/split/limits.json`.

What this means:

- Static Split mode has exactly one item and naturally stays under the small
  item cap.
- Carousel Split mode has 2-6 product-valid items, but account policy may set a
  lower cap.
- With the current policy matrix, free accounts may save/publish at most 3
  Split carousel items because `items.group.small.max.free = 3`.
- Bob may use resolved policy for UX gating and upsell display.
- Roma save/publish validation must enforce the same limit through the generic
  widget `limits.json` + `evaluateLimits()` path. Bob-only enforcement is not
  enough.

## Embedded Instance Dependency Rules

- Split materialization must expose every
  `core.items[].instance.instanceId` as package dependency metadata.
- Split must not auto-create, auto-save, fork, snapshot, or page-own embedded
  instances. It only references existing account-owned materialized instances.
- The embedded instance keeps its own editable fields, translations, publish
  state, and materialized package.
- If an embedded instance is unpublished but materialized, the Split instance
  may save as draft/materialized. Any public publish flow that includes the
  Split instance must block until the embedded instance is publish-eligible.
- When an embedded instance updates, Roma must be able to find parent Split
  instances that depend on it, re-materialize those parent instances, and then
  recompose any pages affected by those parent instances. Tokyo owns none of
  this dependency knowledge.
- Split Step 10 is not green unless this transitive freshness path is proven or
  explicitly fenced as blocked.

Do not add a new Split layout object. The intended layout is already available
through:

- `header.placement`: top, bottom, left, right
- `header.gap`: Header to Core gap
- `pod.widthMode`
- `pod.contentWidth`
- `pod.padding.*`
- `stage.alignment`
- `stage.padding.*`

## Forbidden State

The current old `split/spec.json` and `hero/spec.json` are drift. Do not carry
these paths forward:

- `headline`
- `subheadline`
- `primaryCta`
- `secondaryCta`
- `layout.variant`
- `layout.maxWidth`
- `layout.copyWidth`
- `layout.bodyWidth`
- `layout.gap`
- `layout.copyGap`
- `visual.radius`
- `visual.*`
- `core.kind`
- `core.image.*`
- `core.video.*`
- `core.instance.*`
- `core.height`
- `core.item.*`
- `core.display.mode`
- Prague `accountInstanceRef`

Header copy belongs to `header.title` and `header.subtitleHtml`.
CTA belongs to `cta.*`.
Layout belongs to shared Header and Stage/Pod controls.
Core framing belongs to `appearance.cardwrapper.*`.
Embedded widget references belong to `core.items[].instance.instanceId`; do not revive
Prague `accountInstanceRef`.

## DOM Contract

Split must use the same structural contract as FAQ:

```html
<div class="stage" data-role="stage">
  <div class="pod" data-role="pod">
    <div class="ck-widget ck-split-widget" data-ck-widget="split" data-role="root">
      <section class="ck-split ck-headerLayout" data-role="split">
        <header class="ck-split__header ck-header">
          ...
        </header>
        <div class="ck-split__core ck-headerLayout__body" data-role="split-core">
          ...
        </div>
      </section>
    </div>
  </div>
</div>
```

The direct `.ck-header` and `.ck-headerLayout__body` children are required
because `CKHeader.applyHeader` and `shared/header.css` depend on that structure.
The class name `.ck-headerLayout__body` is an implementation class inherited
from FAQ; in this PRD it means the Widget Core slot.

## Bob Panels And Controls

### Content Panel

Same as FAQ, except FAQ's section/Q&A manager is replaced by Split Core
controls.

Required clusters:

- shared `header-content`
- `Visual`

`Visual` is the Bob-facing label for Split's Core controls. The architecture
name remains Core; the user-facing panel must not display "Core".

Visual controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Enable carousel | `core.carousel.enabled` | `toggle` | When off, edit one fixed Split item. When on, activate the item repeater. |
| Static item type | `core.items.0.kind` | `dropdown-actions` | Shown when `core.carousel.enabled == false`. Allowed values: `image`, `video`, `instance`. |
| Static image | `core.items.0.image.*` | existing asset picker shape | Shown when carousel is off and first item kind is `image`. |
| Static image alt text | `core.items.0.image.alt` | `textfield` | Translatable image alt text. |
| Static video | `core.items.0.video.*` | existing media/video shape | Shown when carousel is off and first item kind is `video`. |
| Static video alt text | `core.items.0.video.alt` | `textfield` | Translatable video/presentation alt text when applicable. |
| Static embedded instance | `core.items.0.instance.instanceId` | instance picker | Shown when carousel is off and first item kind is `instance`. |
| Carousel items | `core.items[]` | `object-manager` | Shown when `core.carousel.enabled == true`; add, reorder, duplicate, and remove Split items. Valid count is 2-6. |
| Carousel item type | `core.items.__INDEX__.kind` | `dropdown-actions` | Shown inside the repeater. Allowed values: `image`, `video`, `instance`. |
| Carousel image | `core.items.__INDEX__.image.*` | existing asset picker shape | Shown when repeater item kind is `image`. Must not create a new media store. |
| Carousel image alt text | `core.items.__INDEX__.image.alt` | `textfield` | Translatable image alt text. |
| Carousel video | `core.items.__INDEX__.video.*` | existing media/video shape | Shown when repeater item kind is `video`. Must reuse existing asset/embed conventions. |
| Carousel video alt text | `core.items.__INDEX__.video.alt` | `textfield` | Translatable video/presentation alt text when applicable. |
| Carousel embedded instance | `core.items.__INDEX__.instance.instanceId` | instance picker | Shown when repeater item kind is `instance`; references a saved account-owned widget instance. |

Split does not expose color or gradient Core controls.

Content-panel `showIf` rules:

```text
core.carousel.enabled == false
  show static item controls for core.items.0.*

core.carousel.enabled == true
  show carousel object-manager controls for core.items[]

core.items.0.kind == 'image'
  show static image controls

core.items.0.kind == 'video'
  show static video controls

core.items.0.kind == 'instance'
  show static embedded instance control

core.items.__INDEX__.kind == 'image'
  show repeater image controls

core.items.__INDEX__.kind == 'video'
  show repeater video controls

core.items.__INDEX__.kind == 'instance'
  show repeater embedded instance control
```

Do not use `core.items.length` or ad hoc count expressions in `showIf`.
Item count is validation, not UI visibility logic.

Do not introduce `core.item.*` as a second static-item state shape. Static and
carousel authoring both edit the same `core.items[]` array. If Bob cannot bind
concrete numeric paths like `core.items.0.kind`, extend the editor contract
narrowly for concrete numeric array paths or stop; do not duplicate state.

### Layout Panel

Same as FAQ, minus FAQ item layout.

Required clusters:

- shared `header-layout`
- shared `Visual size`
- Media Fit
- Carousel
- shared `stagepod-layout`

`Visual size` is the shared Shell `core-size` cluster rendered with Split's
`uiLabels.core.sizeCluster`.

Split `uiLabels.core`:

```text
uiLabels.core.singular = "Visual"
uiLabels.core.plural = "Visuals"
uiLabels.core.sizeCluster = "Visual size"
```

Split-specific Media Fit controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Fit | `core.media.fit` | `dropdown-actions` | `cover` or `contain`. Applies only to image/video items. Ignored for embedded instances. |
| Position | `core.media.position` | `dropdown-actions` | `center`, `top`, `bottom`, `left`, `right`. Applies only to image/video items. Ignored for embedded instances. |

The Media Fit cluster is always visible in Split Layout. Do not add complex
`showIf` rules for mixed carousel items; image/video items apply the values,
embedded instances ignore them.

Carousel controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Transition | `core.carousel.transition` | `dropdown-actions` | Allowed values: `slide`, `fade`. |
| Autoplay | `core.carousel.autoplay` | `toggle` | Enables automatic slide advance. |
| Interval | `core.carousel.intervalMs` | `valuefield` | Recommended range 2000-12000 ms. |
| Loop | `core.carousel.loop` | `toggle` | Wraps next/previous at ends. |
| Show arrows | `core.carousel.showArrows` | `toggle` | Shows previous/next controls. |
| Show dots | `core.carousel.showDots` | `toggle` | Shows position dots. |

Layout-panel `showIf` rules:

```text
Carousel cluster:
  show-if core.carousel.enabled == true

Transition:
  inherits Carousel cluster show-if

Autoplay:
  inherits Carousel cluster show-if

Interval:
  show-if core.carousel.enabled == true
       && core.carousel.autoplay == true

Loop:
  inherits Carousel cluster show-if

Show arrows:
  inherits Carousel cluster show-if

Show dots:
  inherits Carousel cluster show-if
```

Do not add `core.display.mode`. The Content-panel `core.carousel.enabled`
toggle is the only static/carousel switch:

```text
core.carousel.enabled == false -> static single item
core.carousel.enabled == true  -> carousel repeater and carousel layout controls
```

Do not add `layout.variant`, `copyWidth`, `bodyWidth`, max-width, or Split gap
controls. Header placement, shared `coreSize.*`, and Stage/Pod already own that
behavior.

### Runtime And Accessibility Contract

Static image/video runtime:

- Renders exactly one `core.items[0]` when `core.carousel.enabled == false`.
- Applies shared `coreSize.*` to the Core div.
- Applies `core.media.fit` and `core.media.position` to image/video media.
- Uses the item's alt text for image/video accessibility.
- Does not render carousel arrows, dots, autoplay timers, or slide wrappers that
  affect semantics.

Carousel runtime:

- Runs only when `core.carousel.enabled == true`.
- Requires 2-6 valid items.
- Renders all items inside the Split Core div.
- Applies `core.carousel.transition`, `autoplay`, `intervalMs`, `loop`,
  `showArrows`, and `showDots`.
- Does not use global singleton state. Multiple Split instances on the same
  page must have isolated carousel state and event listeners.
- Provides keyboard navigation for previous/next controls.
- Provides accessible labels for previous, next, and dot controls.
- Pauses autoplay when the user interacts with carousel controls or focuses a
  carousel control.
- Respects `prefers-reduced-motion` by disabling autoplay and using the least
  animated transition.

Embedded instance runtime:

- Renders the referenced account-owned materialized instance inside the Split
  Core div.
- Does not create iframes unless an existing approved widget package contract
  requires one.
- Does not edit, fork, snapshot, or override the embedded instance.
- Embedded instance CSS/runtime must not collide with the parent Split instance
  or sibling instances on the same page.
- If the embedded instance package is missing, malformed, unowned, or not
  materialized, Split materialization fails visibly. It must not render an empty
  placeholder as if current.

### Appearance Panel

Same as FAQ, minus FAQ link/icon/question-card controls.

Required clusters:

- Theme selector
- shared `header-appearance`
- Locale switcher appearance
- Core frame controls using `appearance.cardwrapper.*`
- shared `stagepod-appearance`

Core frame controls should reuse the existing surface/card controls and
runtime:

- `appearance.cardwrapper.radiusLinked`
- `appearance.cardwrapper.radius`
- `appearance.cardwrapper.radiusTL|TR|BR|BL`
- `appearance.cardwrapper.border`
- `appearance.cardwrapper.shadow`
- `CKSurface.applyCardWrapper`

Do not add `visual.radius`, `visual.border`, `visual.shadow`, or any
`core.radius`/`core.border`/`core.shadow` duplicate. Framing belongs to the
shared Surface/CardWrapper controls.

### Typography Panel

Same mechanism as FAQ.

Required roles:

- `title` for `header.title`
- `body` for `header.subtitleHtml`; this is the existing FAQ typography role
  name, not widget Core terminology
- `button` for `cta.label`

Split Core captions are not part of PRD106C3.

### Settings Panel

Same shared behavior placement as FAQ:

- `behavior.showBacklink`
- `behavior.socialShare.enabled`

No FAQ-specific SEO/GEO controls ship in Split under PRD106C3.

## Editable Fields

Use the exact same editable-fields mechanism as FAQ.

`editable-fields.json` must declare only concrete translatable paths:

- `header.title`
- `header.subtitleHtml`
- `cta.label`
- `core.items[].image.alt`
- `core.items[].video.alt`

Do not add `localization.json`, text packs, wildcard paths, layer sidecars, or
Prague translation files. Bob preview and San Francisco translation must use the
same path-based mechanism FAQ uses.

`core.items[].id` provides stable item identity for editable fields.
`core.items[].instance.instanceId` is not translatable. The embedded instance
carries its own editable-fields and translations through the normal instance
system.

## Defaults

Fresh Split instances must render non-blank output.

Required useful defaults:

- `header.enabled`: `true`
- `header.title`: "One widget. One line of code. Everywhere it belongs."
- `header.showSubtitle`: `true`
- `header.subtitleHtml`: "Add a polished Clickeen section to any site, then update it from Builder whenever your message changes."
- `header.placement`: `left`
- `header.alignment`: `left`
- `header.ctaPlacement`: `below`
- `cta.enabled`: `true`
- `cta.label`: "Get started"
- `cta.href`: "#"
- `uiLabels.core.singular`: "Visual"
- `uiLabels.core.plural`: "Visuals"
- `uiLabels.core.sizeCluster`: "Visual size"
- `core.items`: one useful non-empty image item using the existing
  asset/default convention
- `core.items[0].id`: stable generated ID
- `core.items[0].kind`: `image`
- `core.items[0].image.alt`: "Product preview"
- `coreSize.mode`: `responsive`
- `coreSize.minHeight`: `260`
- `coreSize.preferredVw`: `34`
- `coreSize.maxHeight`: `620`
- `coreSize.fixedHeight`: `420`
- `core.media.fit`: `cover`
- `core.media.position`: `center`
- `core.carousel.enabled`: `false`
- `core.carousel.transition`: `slide`
- `core.carousel.autoplay`: `false`
- `core.carousel.intervalMs`: `5000`
- `core.carousel.loop`: `true`
- `core.carousel.showArrows`: `true`
- `core.carousel.showDots`: `true`

No visible enabled string may be empty.

## Prague Evidence

Prague only proves which product outcomes Split must cover:

| Prague block | Split coverage |
| --- | --- |
| `hero` | Header left, Split Core right, larger typography defaults; Core may be embedded widget instance. |
| `split` | Header plus image/video Core, with Header placement controlled by shared `header.placement`. |
| `split-carousel` | Source evidence for optional carousel behavior inside the Split Core div; not a separate widget. |
| `embed-carousel` | Source evidence for optional carousel behavior with embedded instances inside the Split Core div; not a separate widget. |

Prague does not define Split state, Bob controls, runtime shape, or translation
mechanism.

## Acceptance

- Split is implemented by deriving from FAQ's working architecture.
- Split declares `defaults.header` and `defaults.cta`.
- Split uses shared `header-content`, `header-layout`, `header-appearance`,
  `stagepod-layout`, `stagepod-appearance`, and standardized `typography`.
- Split removes FAQ-specific sections, Q/A manager, accordion/list/multicolumn
  runtime, FAQ item layout, FAQ link/icon/card controls, and FAQ SEO/GEO
  question controls.
- Split Content panel contains shared Header controls plus `Visual` controls.
- Split Layout, Appearance, Typography, Settings, and editable-fields mechanisms
  match FAQ except for removed FAQ-specific controls and added Split Core
  controls.
- Split declares `uiLabels.core.singular = "Visual"`,
  `uiLabels.core.plural = "Visuals"`, and
  `uiLabels.core.sizeCluster = "Visual size"`.
- Split uses shared Shell `coreSize.*` for Visual/Core div sizing; it does not
  define `core.height`, `visual.height`, or duplicate sizing paths.
- Split defaults `coreSize.mode` to `responsive` with min/preferred/max values
  for modern viewport resizing.
- Split Layout includes a `Media Fit` cluster after `Visual size`; it is always
  visible, applies to image/video items, and is ignored by embedded instances.
- Split DOM has `.ck-headerLayout`, direct `.ck-header`, and direct
  `.ck-headerLayout__body`.
- Split calls `CKStagePod.applyStagePod`, `CKTypography.applyTypography`,
  `CKHeader.applyHeader`, and Split-specific Core runtime in that order.
- Split uses `header.placement` for top/bottom/left/right layout.
- Split Core supports only `image`, `video`, and embedded widget `instance`.
- Split Core is one generic Core div; carousel is optional Split software
  inside that div, not the Core itself.
- Content panel has `core.carousel.enabled`.
- When `core.carousel.enabled == false`, Content shows one fixed item editor
  for `core.items.0.*`, the repeater is hidden, and validation requires exactly
  one item.
- When `core.carousel.enabled == true`, Content shows the `core.items[]`
  repeater, Layout shows the `Carousel` cluster, and validation requires 2-6
  items.
- Split validation fails visibly for missing/duplicate item IDs, invalid item
  kinds, missing image/video refs, missing embedded instance refs, self-embedded
  references, and unpublished/unmaterialized embedded refs when publish requires
  public readiness.
- Split `limits.json` maps `core.items[]` to `items.group.small.max` with
  `metric: count`; free accounts are capped at 3 Split carousel items through
  the global policy matrix, not a per-widget tier table.
- Roma save/publish enforcement applies the generic widget limits path for Split
  item counts. Bob-only policy gating is not sufficient.
- Layout `Carousel` controls are shown only when
  `core.carousel.enabled == true`; `core.carousel.intervalMs` is shown only
  when autoplay is true.
- Split does not define `core.display.mode`; `core.carousel.enabled` is the
  only static/carousel switch.
- Split never uses `core.items.length` or ad hoc count expressions in Bob
  `showIf`; item count is validation only.
- Carousel runtime provides isolated per-instance state, keyboard navigation,
  accessible controls, autoplay pause on interaction/focus, and
  `prefers-reduced-motion` behavior.
- Embedded instance runtime contributes dependency metadata, renders only
  existing account-owned materialized instances, and fails visibly when the
  embedded package is missing or malformed.
- Updating an embedded child instance re-materializes the parent Split instance
  and recomposes every affected page through Roma's flattened dependency index,
  or marks the dependency path stale/failed visibly.
- Split Core does not support color/gradient/decorative fill.
- Split does not ship old Prague/current-Split paths listed in Forbidden State.
- Split materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two Split instances on one composed page do not collide in CSS/runtime.
