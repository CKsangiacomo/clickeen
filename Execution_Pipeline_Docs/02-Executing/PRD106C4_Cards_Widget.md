# PRD106C4_Cards_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.2
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: Cards widget instances for PRD106D route migration.
Authority owned by this PRD: Cards widget Core state, controls, defaults, DOM,
CSS, runtime, and editable fields.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Split,
Big Bang, CTA, Prague route cutover.

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
3. Confirm PRD106C assigns card/step/moat behavior to this PRD.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | REQUIRED |
| PRD106C | Cards target and Prague source scope accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Define Cards Core contract.
```

Required evidence before marking green:

- Cards Core state paths are listed.
- Cards validation rules are listed.
- Steps is represented as a Cards treatment, not a new widget.
- Shell-owned paths are excluded.
- Prague card/step/moat source behavior is mapped to Cards Core or defaults.

Stop conditions:

- Cards requires new Header/CTA/Stage/Pod state.
- Prague columns become page-level layout architecture.
- Cards requires a second item state shape outside `core.items[]`.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Cards state, labels, and forbidden paths. | State table, label defaults, forbidden path list. | Only `core.items[]`, `core.treatment`, `core.columns`, `core.gap`, `core.cardPadding`, `core.steps.*`, `coreSize.*`, and `uiLabels.core.*` are added. | Shell path or duplicate item state needed. |
| 2 | Define validation and policy limits contract. | Validation table and `limits.json` mapping. | Invalid item counts, IDs, media, links, and treatment values fail visibly; `core.items[]` maps to `items.group.small.max`. | Silent healing, Prague route helper, or per-widget tier table. |
| 3 | Confirm shared Shell dependency. | A2 green/fence evidence for Core div, `coreSize.*`, `uiLabels.core.*`, and Layout order. | Cards consumes Shell sizing/labels; no local Core sizing fork. | A2 cannot provide required Shell behavior. |
| 4 | Build Content controls: card manager. | Spec/control diff and Bob compile evidence. | `Cards` object-manager edits `core.items[]` with stable IDs and 2-6 item validation. | Bare `items[]`, wildcard paths, or unstable identity. |
| 5 | Build Content controls: per-card media and links. | Spec/control diff and Bob compile evidence. | Media/link show-if rules are concrete and conflict-free. | Separate icon/image toggles create invalid mixed media state. |
| 6 | Build Layout controls: Cards size and grid. | Spec/control diff and Bob compile evidence. | `Cards size` uses shared `coreSize.*`; grid controls use `core.columns`, `core.gap`, and `core.cardPadding`. | `core.height`, `layout.maxWidth`, or page-level columns appear. |
| 7 | Build Layout controls: treatment and steps. | Spec/control diff and Bob compile evidence. | Treatment controls switch cards/linked-cards/steps; connector controls show only for steps. | Steps becomes a separate widget. |
| 8 | Build Cards runtime. | DOM/CSS/runtime diff and preview evidence. | Cards render in `.ck-headerLayout__body`, responsive grid works, and cards do not collide across instances. | Runtime bypasses Shell or assumes singleton instance. |
| 9 | Build linked-cards runtime. | DOM/CSS/runtime diff and accessibility notes. | Linked-card treatment renders valid anchors and accessible labels. | Route-specific Prague helpers or invalid nested anchors. |
| 10 | Build steps runtime. | DOM/CSS/runtime diff and accessibility notes. | Steps treatment renders ordered sequence and optional connectors from the same `core.items[]`. | New step item model or page-level layout dependency. |
| 11 | Validate editable fields and translations. | Editable-fields diff/tests. | Card title/copy/link labels/image alt use stable item identity. | Missing stable identity or fake wildcard. |
| 12 | Verify Bob/Roma materialization and composed-page safety. | Compile/save/package/page-composition evidence. | Cards packages materialize; two Cards instances on one page do not collide. | Duplicate Shell code, stale package, or page composition miss. |

## Purpose

Build the surviving `cards` widget. Cards absorbs Prague `subpage-cards`,
`steps`, `global-moat`, `platform-strip`, and `control-moat`.

Cards uses the shared Widget Shell extracted from FAQ:

```text
Stage -> Pod -> ck-headerLayout(Header + Cards Core)
```

Cards is not a new editor architecture. It is the shared Widget Shell with one
Cards-specific Core added. A `steps` section is a Cards treatment, not a
separate widget.

## Implementation Reference

FAQ is the approved proof/source for the Widget Shell extraction, but
`PRD106A2_WidgetShellExtraction.md` owns that extraction. Cards must consume
`packages/widget-shell/`.

Do not use current `cards`, `steps`, `countdown`, `logoshowcase`, or Prague
block state as the starting point. Countdown and LogoShowcase are not approved
bases for this migration. Prague blocks are product/visual evidence only.

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

Build Cards by using the shared Widget Shell:

1. Consume `packages/widget-shell/`.
2. Keep the shared Header, CTA, Stage/Pod, Appearance, Typography, Behavior,
   locale switcher, and editable-fields mechanisms.
3. Add only Cards-specific Core state, controls, DOM, CSS, and runtime.

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

Cards must keep FAQ's working shared model.

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
- `core-size`
- `stagepod-layout`
- `stagepod-appearance`
- standardized `typography` panel

Keep FAQ's settings placement for shared behavior:

- `behavior.showBacklink`
- `behavior.socialShare.enabled`

## Add For Cards

The only Cards-specific surface is the Cards Core div. Core is the generic
widget-owned slot where Cards software begins; it is not the card grid itself.

The Cards software inside the Core div renders an ordered set of cards. The
same `core.items[]` array powers standard cards, linked cards, and steps.

Approved Cards-specific state:

| Path | Owner | Meaning |
| --- | --- | --- |
| `core.items[]` | content/config | Ordered card manager. Minimum 2 cards, maximum 6 cards. |
| `core.items[].id` | identity | Stable item identity for reorder, translation, and runtime keys. |
| `core.items[].title` | content | Card title. |
| `core.items[].copy` | content | Card supporting copy. |
| `core.items[].media.kind` | config | One of `none`, `icon`, or `image`. |
| `core.items[].media.iconName` | config | Dieter icon name. Used only when media kind is `icon`. |
| `core.items[].media.image` | config | Existing widget/account media reference. Used only when media kind is `image`. |
| `core.items[].media.imageAlt` | content | Authored alt text for image media. |
| `core.items[].link.enabled` | config | Enables card destination fields. |
| `core.items[].link.href` | config | Card URL. |
| `core.items[].link.label` | content | Card CTA label. |
| `core.treatment` | config | One of `cards`, `linked-cards`, or `steps`. |
| `core.columns` | config | Desktop card columns. Allowed values: `2`, `3`, `4`. |
| `core.gap` | config | Gap between cards. |
| `core.cardPadding` | config | Padding inside each card. |
| `core.steps.showConnectors` | config | Shows connector icons between cards when treatment is `steps`. |
| `core.steps.connectorIcon` | config | Dieter icon name for step connectors. Used only when connectors are enabled. |

Cards `uiLabels.core`:

```text
uiLabels.core.singular = "Card"
uiLabels.core.plural = "Cards"
uiLabels.core.sizeCluster = "Cards size"
```

`Cards` is the Bob-facing label for Cards controls. The architecture name
remains Core; the user-facing panel must not display "Core".

State validity:

```text
core.items.length must be 2-6
core.treatment must be cards, linked-cards, or steps
```

Validation rules:

| Condition | Required result |
| --- | --- |
| `core.items.length < 2` | Fail save/publish visibly. |
| `core.items.length > 6` | Fail save/publish visibly. |
| Any `core.items[].id` is missing or duplicated | Fail save/publish visibly. |
| Any enabled visible string is empty | Fail save/publish visibly. |
| Any `core.items[].media.kind` is not `none`, `icon`, or `image` | Fail save/publish visibly. |
| Media kind is `icon` and `media.iconName` is missing | Fail save/publish visibly. |
| Media kind is `image` and `media.image` is missing | Fail save/publish visibly. |
| Media kind is `image` and `media.imageAlt` is missing | Fail save/publish visibly. |
| `core.treatment == linked-cards` and any card link is disabled or missing `href` | Fail save/publish visibly. |
| Any enabled card link has empty `href` or `label` | Fail save/publish visibly. |
| `core.steps.showConnectors == true` and `core.steps.connectorIcon` is missing | Fail save/publish visibly. |

Do not silently delete, merge, or repair cards to fit the 2-6 count. If state
violates the rule, Bob/Roma validation must fail visibly at save/publish.

## Entitlements And Limits

Tier values live only in
`packages/ck-policy/entitlements.matrix.json`. Cards must not define a
per-widget tier table.

Cards maps its card count to the existing small item-group policy key:

```json
{
  "kind": "limit",
  "key": "items.group.small.max",
  "path": "core.items[]",
  "metric": "count"
}
```

This mapping belongs in `tokyo/product/widgets/cards/limits.json`.

What this means:

- Cards has a product-valid range of 2-6 cards.
- Account policy may set a lower cap than the product maximum.
- With the current policy matrix, free accounts may save/publish at most 3
  cards because `items.group.small.max.free = 3`.
- The same cap applies to standard Cards, linked Cards, and Steps because all
  treatments use the same `core.items[]` array.
- Bob may use resolved policy for UX gating and upsell display.
- Roma save/publish validation must enforce the same limit through the generic
  widget `limits.json` + `evaluateLimits()` path. Bob-only enforcement is not
  enough.

Do not add a new Cards layout object outside `core.*`. The intended surrounding
layout is already available through:

- `header.placement`: top, bottom, left, right
- `header.gap`: Header to Core gap
- `pod.widthMode`
- `pod.contentWidth`
- `pod.padding.*`
- `stage.alignment`
- `stage.padding.*`

## Forbidden State

The current old card/step/widget or Prague block paths are drift. Do not carry
these paths forward:

- bare `items[]`
- `items[].body`
- `items[].href`
- `items[].ctaLabel`
- `items[].iconEnabled`
- `items[].imageEnabled`
- `layout.treatment`
- `layout.columns`
- `layout.cardGap`
- `layout.cardPadding`
- `layout.maxWidth`
- `layout.variant`
- `page`
- `pageName`
- `route`
- `market`
- `locale`
- Prague route helper paths such as `resolvePragueHref`

Header copy belongs to `header.title` and `header.subtitleHtml`.
Header CTA belongs to `cta.*`.
Cards supporting text belongs to `core.items[].copy`.
Card destinations belong to `core.items[].link.*`.
Layout belongs to shared Header/Stage/Pod plus Cards-owned `core.*` layout.
Card framing belongs to `appearance.cardwrapper.*`.

## DOM Contract

Cards must use the same structural contract as FAQ:

```html
<div class="stage" data-role="stage">
  <div class="pod" data-role="pod">
    <div class="ck-widget ck-cards-widget" data-ck-widget="cards" data-role="root">
      <section class="ck-cards ck-headerLayout" data-role="cards">
        <header class="ck-cards__header ck-header">
          ...
        </header>
        <div class="ck-cards__core ck-headerLayout__body" data-role="cards-core">
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

Same as FAQ, except FAQ's section/Q&A manager is replaced by Cards controls.

Required clusters:

- shared `header-content`
- `Cards`

Cards controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Cards | `core.items[]` | `object-manager` | Add, reorder, duplicate, and remove cards. Valid count is 2-6. |
| Card title | `core.items.__INDEX__.title` | `textfield` | Translatable card title. |
| Card copy | `core.items.__INDEX__.copy` | `textedit` | Translatable supporting copy. |
| Media type | `core.items.__INDEX__.media.kind` | `dropdown-actions` | `none`, `icon`, or `image`. Prevents conflicting icon+image state. |
| Icon | `core.items.__INDEX__.media.iconName` | existing Dieter icon control or `textfield` | Shown when media kind is `icon`. |
| Image | `core.items.__INDEX__.media.image` | existing asset picker shape | Shown when media kind is `image`. Must not create a new media store. |
| Image alt text | `core.items.__INDEX__.media.imageAlt` | `textfield` | Shown when media kind is `image`. Translatable image alt text. |
| Enable link | `core.items.__INDEX__.link.enabled` | `toggle` | Enables per-card link fields. |
| Link URL | `core.items.__INDEX__.link.href` | `textfield` | Shown when card link is enabled. |
| Link label | `core.items.__INDEX__.link.label` | `textfield` | Shown when card link is enabled. Translatable card CTA text. |

Content-panel `showIf` rules:

```text
core.items.__INDEX__.media.kind == 'icon'
  show icon control

core.items.__INDEX__.media.kind == 'image'
  show image and image alt controls

core.items.__INDEX__.link.enabled == true
  show link URL and link label controls
```

Do not use `core.items.length` or ad hoc count expressions in `showIf`.
Item count is validation, not UI visibility logic.

Do not introduce bare `items[]` or `core.item.*` as a second item state shape.
All Cards treatments edit the same `core.items[]` array.

### Layout Panel

Same as FAQ, minus FAQ item layout.

Required clusters:

- shared `header-layout`
- shared `Cards size`
- Cards Layout
- Steps
- shared `stagepod-layout`

`Cards size` is the shared Shell `core-size` cluster rendered with Cards'
`uiLabels.core.sizeCluster`. Cards defaults this cluster to `auto`; the control
still exists because Core div sizing is a shared Shell contract.

Cards Layout controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Treatment | `core.treatment` | `choice-tiles` | `cards`, `linked-cards`, `steps`. |
| Columns | `core.columns` | `choice-tiles` | `2`, `3`, `4`. Desktop only; mobile stacks. |
| Card gap | `core.gap` | `valuefield` | Recommended range 8-64 px, step 2. |
| Card padding | `core.cardPadding` | `valuefield` | Recommended range 16-64 px, step 2. |

Steps controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Show connectors | `core.steps.showConnectors` | `toggle` | Shown only when `core.treatment == 'steps'`. |
| Connector icon | `core.steps.connectorIcon` | existing Dieter icon control or `textfield` | Shown only when treatment is `steps` and connectors are enabled. |

Layout-panel `showIf` rules:

```text
Steps cluster:
  show-if core.treatment == 'steps'

Show connectors:
  inherits Steps cluster show-if

Connector icon:
  show-if core.treatment == 'steps'
       && core.steps.showConnectors == true
```

Do not add `layout.maxWidth`, `layout.columns`, or page-level columns. Header
placement, shared `coreSize.*`, and Stage/Pod already own the surrounding
layout; Cards owns only the grid inside the Core div.

### Runtime And Accessibility Contract

Standard Cards runtime:

- Renders 2-6 cards from `core.items[]` inside the Cards Core div.
- Applies `core.columns`, `core.gap`, and `core.cardPadding`.
- Stacks cards to one column on narrow viewports.
- Applies shared `coreSize.*` to the Core div.
- Applies `appearance.cardwrapper.*` to each rendered card surface.
- Does not use Prague route helpers, page names, locale names, or market names.

Linked Cards runtime:

- Runs when `core.treatment == linked-cards`.
- Requires every card to have an enabled, valid link.
- Renders each card as one accessible link target or renders a clearly scoped
  link inside the card. It must not create invalid nested anchors.
- Uses `core.items[].link.label` for visible CTA text when the design shows a
  CTA.

Steps runtime:

- Runs when `core.treatment == steps`.
- Renders the same `core.items[]` as an ordered sequence.
- May show connector icons between cards only when
  `core.steps.showConnectors == true`.
- Does not create a second steps item model.
- Hides or stacks connectors on narrow viewports when needed to avoid overlap.

All Cards runtimes:

- Use isolated per-instance selectors/state. Multiple Cards instances on one
  page must not collide.
- Preserve source order for keyboard and screen reader navigation.
- Provide useful alt text for image media.
- Avoid empty anchors, empty headings, and empty enabled visible strings.

### Appearance Panel

Same as FAQ, minus FAQ link/icon/question-card controls.

Required clusters:

- Theme selector
- shared `header-appearance`
- Locale switcher appearance
- Card frame controls using `appearance.cardwrapper.*`
- shared `stagepod-appearance`

Card frame controls should reuse the existing surface/card controls and runtime:

- `appearance.cardwrapper.radiusLinked`
- `appearance.cardwrapper.radius`
- `appearance.cardwrapper.radiusTL|TR|BR|BL`
- `appearance.cardwrapper.border`
- `appearance.cardwrapper.shadow`
- `CKSurface.applyCardWrapper`

Do not add `appearance.cardRadius`, `appearance.cardShadow`,
`core.radius`, `core.border`, or `core.shadow` duplicate paths. Framing belongs
to the shared Surface/CardWrapper controls.

### Typography Panel

Same mechanism as FAQ.

Required roles:

- `title` for `header.title`
- `body` for `header.subtitleHtml`; this is the existing FAQ typography role
  name, not widget Core terminology
- `cardTitle` for `core.items[].title`
- `cardCopy` for `core.items[].copy`
- `button` for `cta.label` and `core.items[].link.label`

### Settings Panel

Same shared behavior placement as FAQ:

- `behavior.showBacklink`
- `behavior.socialShare.enabled`

No FAQ-specific SEO/GEO controls ship in Cards under PRD106C4.

## Editable Fields

Use the exact same editable-fields mechanism as FAQ.

`editable-fields.json` must declare only concrete translatable paths:

- `header.title`
- `header.subtitleHtml`
- `cta.label`
- `core.items[].title`
- `core.items[].copy`
- `core.items[].media.imageAlt`
- `core.items[].link.label`

Do not add `localization.json`, text packs, wildcard paths, layer sidecars, or
Prague translation files. Bob preview and San Francisco translation must use the
same path-based mechanism FAQ uses.

`core.items[].id` provides stable item identity for editable fields.

## Defaults

Fresh Cards instances must render non-blank output.

Required useful defaults:

- `header.enabled`: `true`
- `header.title`: "Everything visitors need to know"
- `header.showSubtitle`: `true`
- `header.subtitleHtml`: "Use cards to explain benefits, steps, links, or key details in a clean responsive section."
- `header.placement`: `top`
- `header.alignment`: `center`
- `header.ctaPlacement`: `below`
- `cta.enabled`: `false`
- `uiLabels.core.singular`: "Card"
- `uiLabels.core.plural`: "Cards"
- `uiLabels.core.sizeCluster`: "Cards size"
- `core.items`: three useful non-empty cards
- `core.items[].id`: stable generated IDs
- `core.items[0].title`: "Clear answers"
- `core.items[0].copy`: "Give visitors the information they need without making them search."
- `core.items[1].title`: "Easy updates"
- `core.items[1].copy`: "Edit once in Clickeen and keep every embedded section current."
- `core.items[2].title`: "Built to scale"
- `core.items[2].copy`: "Use the same pattern for links, features, or step-by-step flows."
- Each default card `media.kind`: `icon`
- `core.items[0].media.iconName`: "check"
- `core.items[1].media.iconName`: "refresh-cw"
- `core.items[2].media.iconName`: "layers"
- Each default card `link.enabled`: `false`
- `core.treatment`: `cards`
- `core.columns`: `3`
- `core.gap`: `24`
- `core.cardPadding`: `32`
- `core.steps.showConnectors`: `false`
- `core.steps.connectorIcon`: "arrow-right"
- `coreSize.mode`: `auto`
- `coreSize.minHeight`: `0`
- `coreSize.preferredVw`: `0`
- `coreSize.maxHeight`: `0`
- `coreSize.fixedHeight`: `0`

The object-manager default item must create a non-empty card with a stable
generated ID. No visible enabled string may be empty.

## Prague Evidence

Prague only proves which product outcomes Cards must cover:

| Prague block | Cards coverage |
| --- | --- |
| `subpage-cards` | Header plus linked Cards treatment. |
| `steps` | Same card data rendered as ordered Steps treatment. |
| `global-moat` | Standard Cards treatment with feature copy. |
| `platform-strip` | Standard Cards treatment with platform/value copy. |
| `control-moat` | Standard Cards or Steps treatment depending on source copy. |

Prague route helpers (`market`, `locale`, `resolvePragueHref`, fixed
`features/examples/pricing` page names) do not become widget truth.

Prague does not define Cards state, Bob controls, runtime shape, or translation
mechanism.

## Acceptance

- Cards is implemented by deriving from FAQ's working architecture.
- Cards declares `defaults.header` and `defaults.cta`.
- Cards uses shared `header-content`, `header-layout`, `header-appearance`,
  `core-size`, `stagepod-layout`, `stagepod-appearance`, and standardized
  `typography`.
- Cards removes FAQ-specific sections, Q/A manager, accordion/list/multicolumn
  runtime, FAQ item layout, FAQ link/icon/card controls, and FAQ SEO/GEO
  question controls.
- Cards Content panel contains shared Header controls plus `Cards` controls.
- Cards Layout, Appearance, Typography, Settings, and editable-fields
  mechanisms match FAQ except for removed FAQ-specific controls and added Cards
  controls.
- Cards declares `uiLabels.core.singular = "Card"`,
  `uiLabels.core.plural = "Cards"`, and
  `uiLabels.core.sizeCluster = "Cards size"`.
- Cards uses shared Shell `coreSize.*` for Cards/Core div sizing; it does not
  define `core.height`, `visual.height`, or duplicate sizing paths.
- Cards defaults `coreSize.mode` to `auto`.
- Cards DOM has `.ck-headerLayout`, direct `.ck-header`, and direct
  `.ck-headerLayout__body`.
- Cards calls `CKStagePod.applyStagePod`, `CKTypography.applyTypography`,
  `CKHeader.applyHeader`, and Cards-specific Core runtime in that order.
- Cards uses `header.placement` for top/bottom/left/right Header layout.
- Cards Core uses one `core.items[]` array for standard cards, linked cards,
  and steps.
- Cards Core supports only `none`, `icon`, and `image` media per card.
- Cards Core does not support embedded widget instances.
- `steps` is a Cards treatment, not a separate widget.
- Content panel never uses `core.items.length` or ad hoc count expressions in
  Bob `showIf`; item count is validation only.
- Layout `Steps` controls are shown only when `core.treatment == steps`;
  connector icon is shown only when connectors are enabled.
- Cards validation fails visibly for missing/duplicate item IDs, invalid item
  counts, invalid treatment values, missing media refs, missing link fields, and
  empty enabled visible strings.
- Cards `limits.json` maps `core.items[]` to `items.group.small.max` with
  `metric: count`; free accounts are capped at 3 cards through the global policy
  matrix, not a per-widget tier table.
- Roma save/publish enforcement applies the generic widget limits path for Cards
  item counts. Bob-only policy gating is not sufficient.
- Linked Cards treatment requires valid card links and never renders invalid
  nested anchors.
- Steps treatment renders the same `core.items[]` as an ordered sequence and
  does not create a second steps item model.
- Cards does not ship old Prague/current-Cards paths listed in Forbidden State.
- Cards materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two Cards instances on one composed page do not collide in CSS/runtime.
