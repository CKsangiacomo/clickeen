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
Cards implementation gates are green for the first executable widget package.
```

Green evidence:

- `tokyo/product/widgets/cards/**` exists as the surviving `cards` widget.
- Cards uses shared Shell structure: Stage, Pod, Header, CTA, CoreSize,
  typography, locale switcher, branding, and CardWrapper surface runtime.
- Cards Core state is only `core.items[]`, `core.treatment`, `core.columns`,
  `core.gap`, `core.cardPadding`, `core.customCardStyles.*`,
  `core.items[].style.*`, and `core.betweenCards.*`.
- Content panel uses one `core.items[]` object-manager for cards, links, icon,
  image, and alt text.
- Layout panel uses shared `Cards size`, Cards grid controls, and the
  `Graphic between cards` line/icon controls.
- Appearance panel includes `Custom card styles` and per-card style controls
  nested inside the same `core.items[]` item model.
- Runtime supports standard cards, linked cards, and steps from the same
  `core.items[]` array.
- `tokyo/product/widgets/cards/limits.json` maps `core.items[]` to
  `items.group.small.max`.
- Two Cards instances compose on one page without duplicate runtime failure.

Stop conditions:

- Do not add `cardgrid` aliases or compatibility paths to make old state work.
- Do not add bare `items[]`, `layout.*`, old `appearance.card*`, or
  Prague-route helper state.
- Do not split `steps` into a separate widget.
- Do not add page-level columns to solve Cards layout.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Cards state, labels, and forbidden paths. | State table, label defaults, forbidden path list. | Only `core.items[]`, `core.treatment`, `core.columns`, `core.gap`, `core.cardPadding`, `core.customCardStyles.*`, `core.items[].style.*`, `core.betweenCards.*`, `coreSize.*`, and `uiLabels.core.*` are added. | Shell path or duplicate item state needed. |
| 2 | Define validation and policy limits contract. | Validation table and `limits.json` mapping. | Invalid item counts, IDs, media, links, style overrides, graphic controls, and treatment values fail visibly; `core.items[]` maps to `items.group.small.max`. | Silent healing, Prague route helper, or per-widget tier table. |
| 3 | Confirm shared Shell dependency. | A2 green/fence evidence for Core div, `coreSize.*`, `uiLabels.core.*`, and Layout order. | Cards consumes Shell sizing/labels; no local Core sizing fork. | A2 cannot provide required Shell behavior. |
| 4 | Build Content controls: card manager. | Spec/control diff and Bob compile evidence. | `Cards` object-manager edits `core.items[]` with stable IDs and 2-16 item validation, subject to account policy caps. | Bare `items[]`, wildcard paths, unstable identity, or a new translation identity model. |
| 5 | Build Content controls: per-card media and links. | Spec/control diff and Bob compile evidence naming reused media/icon/link contracts. | Media/link show-if rules are concrete and conflict-free; existing asset picker, CTA icon source, and safe-anchor/link behavior are reused. | Separate icon/image toggles, new media store, new icon taxonomy, or Cards-specific link subsystem. |
| 6 | Build Layout controls: Cards size and grid. | Spec/control diff and Bob compile evidence. | `Cards size` uses shared `coreSize.*`; grid controls use `core.columns`, `core.gap`, and `core.cardPadding`. | `core.height`, `layout.maxWidth`, or page-level columns appear. |
| 7 | Build Layout controls: treatment and graphics between cards. | Spec/control diff and Bob compile evidence. | Treatment controls switch cards/linked-cards/steps; `Graphic between cards` is off by default and reveals only valid line/icon controls. | Steps becomes a separate widget or duplicates graphic connector state. |
| 8 | Build Appearance controls: custom card styles. | Spec/control diff and Bob compile evidence. | `Custom card styles` toggle creates per-card Appearance sections keyed by stable card ID; overrides inherit from shared CardWrapper style. | Per-card styles duplicate Shell paths, appear in Content, or require a new editor subsystem. |
| 9 | Build Cards runtime. | DOM/CSS/runtime diff and preview evidence. | Cards render in `.ck-headerLayout__body`, responsive grid works, custom style overrides apply through scoped CSS variables, and cards do not collide across instances. | Runtime bypasses Shell or assumes singleton instance. |
| 10 | Build linked-cards runtime. | DOM/CSS/runtime diff and accessibility notes. | Linked-card treatment renders valid anchors and accessible labels. | Route-specific Prague helpers or invalid nested anchors. |
| 11 | Build steps runtime. | DOM/CSS/runtime diff and accessibility notes. | Steps treatment renders ordered sequence and optional graphics between cards from the same `core.items[]`. | New step item model or page-level layout dependency. |
| 12 | Validate editable fields and translations. | Editable-fields diff and compile/typecheck evidence. | Card title/copy/link labels/image alt use stable item identity; style overrides are not translatable fields. | Missing stable identity or fake wildcard. |
| 13 | Verify Bob/Roma materialization and composed-page safety. | Compile/save/package/page-composition evidence. | Cards packages materialize; two Cards instances on one page do not collide. | Duplicate Shell code, stale package, or page composition miss. |

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
| `core.items[]` | config | Ordered card manager. Minimum 2 cards, maximum 16 cards, subject to account policy caps. |
| `core.items[].id` | identity | Stable item identity for reorder, translation, and runtime keys. |
| `core.items[].title` | content | Card title. |
| `core.items[].copy` | content | Card supporting copy. |
| `core.items[].media.kind` | config | One of `none`, `icon`, or `image`. |
| `core.items[].media.iconName` | config | Dieter icon name from the same icon source used by CTA icons. Used only when media kind is `icon`. |
| `core.items[].media.image` | config | Existing widget/account media reference using the existing asset picker/media contract. Used only when media kind is `image`. |
| `core.items[].media.imageAlt` | content | Authored alt text for image media. |
| `core.items[].link.enabled` | config | Enables card destination fields. |
| `core.items[].link.href` | config | Card URL using the existing CTA/safe-anchor link behavior. |
| `core.items[].link.label` | content | Card CTA label. |
| `core.customCardStyles.enabled` | config | Enables per-card Appearance sections. Default `false`. |
| `core.items[].style.background` | config | Optional per-card background override. Inherits shared CardWrapper background when omitted or custom styles are disabled. |
| `core.items[].style.borderColor` | config | Optional per-card border color override. Inherits shared CardWrapper border when omitted or custom styles are disabled. |
| `core.items[].style.radius` | config | Optional per-card radius override. Inherits shared CardWrapper radius when omitted or custom styles are disabled. |
| `core.items[].style.shadow` | config | Optional per-card shadow override. Inherits shared CardWrapper shadow when omitted or custom styles are disabled. |
| `core.items[].style.accentColor` | config | Optional per-card accent color override for card-local affordances. Inherits widget/global accent when omitted or custom styles are disabled. |
| `core.items[].style.textTone` | config | Optional per-card text tone override. Allowed values: `inherit`, `default`, `muted`, `inverse`. |
| `core.treatment` | config | One of `cards`, `linked-cards`, or `steps`. |
| `core.columns` | config | Desktop card columns. Allowed values: `2`, `3`, `4`. |
| `core.gap` | config | Gap between cards. |
| `core.cardPadding` | config | Padding inside each card. |
| `core.betweenCards.enabled` | config | Shows a decorative graphic between adjacent cards. Default `false`. |
| `core.betweenCards.kind` | config | One of `line` or `icon`. Shown only when between-card graphics are enabled. |
| `core.betweenCards.line.widthPt` | config | Vertical line width in points. Used only when graphics are enabled and kind is `line`. |
| `core.betweenCards.line.color` | config | Vertical line color. Used only when graphics are enabled and kind is `line`. |
| `core.betweenCards.icon.name` | config | Dieter icon name, using the same icon picker source as CTA icons. Used only when graphics are enabled and kind is `icon`. |
| `core.betweenCards.icon.sizePt` | config | Icon size in points. Used only when graphics are enabled and kind is `icon`. |
| `core.betweenCards.icon.color` | config | Icon color. Used only when graphics are enabled and kind is `icon`. |

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
core.items.length must be 2-16, subject to account policy caps
core.treatment must be cards, linked-cards, or steps
core.items[].style.* applies only when core.customCardStyles.enabled == true
core.betweenCards.* applies only when core.betweenCards.enabled == true
```

Validation rules:

| Condition | Required result |
| --- | --- |
| `core.items.length < 2` | Fail save/publish visibly. |
| `core.items.length > 16` | Fail save/publish visibly. |
| Any `core.items[].id` is missing or duplicated | Fail save/publish visibly. |
| Any enabled visible string is empty | Fail save/publish visibly. |
| Any `core.items[].media.kind` is not `none`, `icon`, or `image` | Fail save/publish visibly. |
| Media kind is `icon` and `media.iconName` is missing | Fail save/publish visibly. |
| Media kind is `image` and `media.image` is missing | Fail save/publish visibly. |
| Media kind is `image` and `media.imageAlt` is missing | Fail save/publish visibly. |
| `core.treatment == linked-cards` and any card link is disabled or missing `href` | Fail save/publish visibly. |
| Any enabled card link has empty `href` or `label` | Fail save/publish visibly. |
| `core.betweenCards.enabled == true` and `core.betweenCards.kind` is not `line` or `icon` | Fail save/publish visibly. |
| `core.betweenCards.kind == line` and line width or color is missing | Fail save/publish visibly. |
| `core.betweenCards.kind == line` and `core.betweenCards.line.widthPt` is outside 1-24 | Fail save/publish visibly. |
| `core.betweenCards.kind == icon` and icon name, size, or color is missing | Fail save/publish visibly. |
| `core.betweenCards.kind == icon` and `core.betweenCards.icon.sizePt` is outside 8-96 | Fail save/publish visibly. |
| `core.items[].style.textTone` is not `inherit`, `default`, `muted`, or `inverse` | Fail save/publish visibly. |
| Any style override tries to store layout, spacing, typography scale, Header, Stage, Pod, or global CardWrapper state | Fail save/publish visibly. |

Do not silently delete, merge, or repair cards to fit the 2-16 count. If state
violates the rule, Bob/Roma validation must fail visibly at save/publish.

Canonical validation owner:

- Bob may preflight validation so the editor can show missing links, media,
  item-count, and style errors before save.
- Roma materialization/save/publish is the canonical product boundary for Cards
  validation because Roma owns account context, policy, materialized packages,
  and save/publish decisions.
- Tokyo remains storage validation only and must not interpret Cards Core state,
  card links, item counts, style overrides, or treatment readiness.

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

- Cards has a product-valid range of 2-16 cards.
- Account policy may set a lower cap, a higher cap, or no cap, but Cards
  product validation still clamps the widget to 16 cards maximum.
- With the intended PRD106 policy values, free accounts may save/publish at
  most 3 cards because `items.group.small.max.free = 3`.
- If the current policy matrix still has stale higher-tier values for
  `items.group.small.max` such as tier1 10, tier2 25, or unlimited higher
  tiers, Step 2 is not green until the matrix is updated to the accepted
  3/9/16 values or the mismatch is explicitly fenced. Do not document stale
  policy values as product truth.
- The same cap applies to standard Cards, linked Cards, and Steps because all
  treatments use the same `core.items[]` array.
- Bob may use resolved policy for UX gating and upsell display.
- Roma save/publish validation must enforce the same limit through the generic
  widget `limits.json` + `evaluateLimits()` path. Bob-only enforcement is not
  enough.
- Current policy registry may still mark `items.group.small.max` server
  save/publish enforcement as a gap. Cards Step 2 is not green until generic
  Roma enforcement is implemented, explicitly owned by a green prerequisite, or
  the Cards item cap is fenced as blocked.

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
- `core.steps.showConnectors`
- `core.steps.connectorIcon`
- `core.connector*`
- `core.graphics*`
- `appearance.cardBackground`
- `appearance.cardBorderColor`
- `appearance.cardRadius`
- `appearance.cardShadow`
- `appearance.cardAccentColor`
- `core.cardBackground`
- `core.cardBorderColor`
- `core.cardRadius`
- `core.cardShadow`
- `core.itemStyle`
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
Shared card framing belongs to `appearance.cardwrapper.*`. Per-card style
exceptions belong only to `core.items[].style.*` and are active only when
`core.customCardStyles.enabled == true`.

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
| Cards | `core.items[]` | `object-manager` | Add, reorder, duplicate, and remove cards. Product-valid count is 2-16, subject to `items.group.small.max`. |
| Card title | `core.items.__INDEX__.title` | `textfield` | Translatable card title. |
| Card copy | `core.items.__INDEX__.copy` | `textedit` | Translatable supporting copy. |
| Media type | `core.items.__INDEX__.media.kind` | `dropdown-actions` | `none`, `icon`, or `image`. Prevents conflicting icon+image state. |
| Icon | `core.items.__INDEX__.media.iconName` | existing CTA/Dieter icon picker source | Shown when media kind is `icon`. Must not create a second icon taxonomy. |
| Image | `core.items.__INDEX__.media.image` | existing asset picker/media reference shape | Shown when media kind is `image`. Must not create a new media store. |
| Image alt text | `core.items.__INDEX__.media.imageAlt` | `textfield` | Shown when media kind is `image`. Translatable image alt text. |
| Enable link | `core.items.__INDEX__.link.enabled` | `toggle` | Enables per-card link fields. |
| Link URL | `core.items.__INDEX__.link.href` | `textfield` | Shown when card link is enabled. Reuse existing CTA/safe-anchor link behavior. |
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

If `core.treatment == linked-cards`, Bob must surface missing link URL/label
requirements clearly in the card manager. It must not auto-fill links, silently
disable links, or downgrade the treatment to avoid validation.

### Layout Panel

Same as FAQ, minus FAQ item layout.

Required clusters:

- shared `header-layout`
- shared `Cards size`
- Cards Layout
- Graphic between cards
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

Graphic between cards controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Graphic between cards | `core.betweenCards.enabled` | `toggle` | Default off. When off, no line or icon controls are shown and no graphic renders between cards. |
| Graphic type | `core.betweenCards.kind` | dropdown | `line` or `icon`. Shown only when graphics are enabled. |
| Line width | `core.betweenCards.line.widthPt` | valuefield | Width in points. Shown only when graphics are enabled and type is `line`. Recommended range 1-24 pt. |
| Line color | `core.betweenCards.line.color` | color selector | Shown only when graphics are enabled and type is `line`. |
| Icon | `core.betweenCards.icon.name` | same icon dropdown/source as CTA icons | Shown only when graphics are enabled and type is `icon`. Must not create a second icon taxonomy. |
| Icon size | `core.betweenCards.icon.sizePt` | valuefield | Size in points. Shown only when graphics are enabled and type is `icon`. Recommended range 8-96 pt. |
| Icon color | `core.betweenCards.icon.color` | color selector | Shown only when graphics are enabled and type is `icon`. |

Layout-panel `showIf` rules:

```text
Graphic type:
  show-if core.betweenCards.enabled == true

Line width and Line color:
  show-if core.betweenCards.enabled == true
       && core.betweenCards.kind == 'line'

Icon, Icon size, and Icon color:
  show-if core.betweenCards.enabled == true
       && core.betweenCards.kind == 'icon'
```

Do not add `layout.maxWidth`, `layout.columns`, or page-level columns. Header
placement, shared `coreSize.*`, and Stage/Pod already own the surrounding
layout; Cards owns only the grid inside the Core div.

Do not create separate `core.steps.*` connector controls. Steps is a Cards
treatment and uses the same `core.betweenCards.*` graphic controls as standard
Cards and linked Cards.

### Runtime And Accessibility Contract

Standard Cards runtime:

- Renders 2-16 cards from `core.items[]` inside the Cards Core div, subject to
  account policy caps.
- Applies `core.columns`, `core.gap`, and `core.cardPadding`.
- Stacks cards to one column on narrow viewports.
- Applies shared `coreSize.*` to the Core div.
- Applies `appearance.cardwrapper.*` to each rendered card surface.
- Renders a decorative graphic between adjacent cards only when
  `core.betweenCards.enabled == true`.
- Applies `core.items[].style.*` only when
  `core.customCardStyles.enabled == true`, using scoped CSS variables on the
  rendered card element and shared CardWrapper values as fallbacks.
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
- Uses the same `core.betweenCards.*` graphic controls as the other Cards
  treatments.
- Does not create a second steps item model.
- Hides, stacks, or reflows between-card graphics on narrow viewports when
  needed to avoid overlap.

Graphic between cards runtime:

- Renders only between adjacent cards; never before the first card or after the
  last card.
- Is decorative by default and must be `aria-hidden="true"` unless a later PRD
  explicitly makes it semantic.
- Uses the Cards grid/source order, not page layout state.
- In multi-column desktop layout, renders in the gap between cards that are
  adjacent in the same row.
- In stacked/mobile layout, renders in the vertical gap between cards.
- For `line`, renders a vertical line using `core.betweenCards.line.widthPt`
  and `core.betweenCards.line.color`.
- For `icon`, renders the selected Dieter icon using
  `core.betweenCards.icon.name`, `core.betweenCards.icon.sizePt`, and
  `core.betweenCards.icon.color`.
- Does not create translatable fields, links, item identity, or a second card
  item model.

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
- Custom card styles
- Per-card style sections when custom card styles are enabled
- shared `stagepod-appearance`

Card frame controls should reuse the existing surface/card controls and runtime:

- `appearance.cardwrapper.radiusLinked`
- `appearance.cardwrapper.radius`
- `appearance.cardwrapper.radiusTL|TR|BR|BL`
- `appearance.cardwrapper.border`
- `appearance.cardwrapper.shadow`
- `CKSurface.applyCardWrapper`

Custom card style controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Custom card styles | `core.customCardStyles.enabled` | `toggle` | Default off. When off, every card inherits the shared CardWrapper style and no per-card sections are shown. |

When `core.customCardStyles.enabled == true`, Bob must create one Appearance
ToolDrawer section per card. The section label must derive from the current
card title and stable identity:

```text
Card: {core.items[].title}
```

If the title is empty while editing, Bob may display `Card: Untitled`, but
save/publish validation still rejects empty enabled visible strings. Sections
must be keyed by `core.items[].id`, not by array index, so reordering cards
does not move style overrides to the wrong card.

If current Bob ToolDrawer/control compilation cannot support per-card
Appearance sections keyed by stable item ID without creating a new editor
framework, Step 8 stops and custom card styles are fenced. Do not build a
parallel Appearance system for Cards.

Per-card style section controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Background | `core.items.__INDEX__.style.background` | color/control matching existing color field patterns | Optional. Empty means inherit shared CardWrapper background. |
| Border color | `core.items.__INDEX__.style.borderColor` | color/control matching existing color field patterns | Optional. Empty means inherit shared CardWrapper border color. |
| Radius | `core.items.__INDEX__.style.radius` | radius/value control | Optional. Empty means inherit shared CardWrapper radius. This is a single per-card radius override, not four independent corner paths. |
| Shadow | `core.items.__INDEX__.style.shadow` | shadow control matching existing shadow field patterns | Optional. Empty means inherit shared CardWrapper shadow. |
| Accent color | `core.items.__INDEX__.style.accentColor` | color/control matching existing color field patterns | Optional. Applies only to card-local affordances. |
| Text tone | `core.items.__INDEX__.style.textTone` | choice/dropdown | `inherit`, `default`, `muted`, `inverse`. Default `inherit`. |
| Reset card style | action | action | Clears that card's `style.*` overrides without changing card content. |

Custom-card-style behavior:

- Off by default.
- When off, Bob shows only shared CardWrapper controls and no per-card style
  sections.
- When on, Bob shows per-card Appearance sections below the shared CardWrapper
  controls and before shared `stagepod-appearance`.
- Adding a card creates a new per-card section only while the toggle is on.
- Removing a card removes its style overrides with that card.
- Duplicating a card may duplicate the source card's style overrides because
  the user explicitly duplicated that card.
- Reordering cards keeps style overrides attached to stable `core.items[].id`.
- Renaming a card updates only the section label.
- Turning the toggle off does not need to delete overrides immediately; runtime
  ignores `core.items[].style.*` while the toggle is off so turning it back on
  can restore the user's previous work.
- Per-card controls inherit from the shared card style unless the user sets an
  override.
- Per-card style overrides are presentation only. They are not translatable
  fields and must not affect item identity.

Runtime must prefer scoped CSS variables on each rendered card over generating
one CSS class or style block per card:

```html
<article
  class="ck-cards__item"
  style="--ck-card-bg: #F7FAFF; --ck-card-border-color: #B7D4FF;"
>
  ...
</article>
```

Shared card CSS then consumes variables with shared fallback values:

```css
.ck-cards__item {
  background: var(--ck-card-bg, var(--ck-cardwrapper-bg));
  border-color: var(--ck-card-border-color, var(--ck-cardwrapper-border-color));
}
```

The exact variable names may follow the Widget Shell/CardWrapper naming
contract from PRD106A2, but the behavior must stay the same: global shared card
style first, optional per-card override second.

Do not add `appearance.cardRadius`, `appearance.cardShadow`,
`core.radius`, `core.border`, or `core.shadow` duplicate paths. Framing belongs
to the shared Surface/CardWrapper controls. The only approved per-card
exception is the controlled `core.items[].style.*` override set listed above.

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
Step 12 is not green until reorder/duplicate/remove behavior proves translated
card title, copy, image alt, and link label remain attached to the same stable
item identity. If that proof requires a new translation identity subsystem,
stop and fence the feature; do not redesign translation inside C4.

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
- `core.customCardStyles.enabled`: `false`
- Each default card `style.textTone`: `inherit`
- Each default card has no background, border, radius, shadow, or accent
  override
- `core.betweenCards.enabled`: `false`
- `core.betweenCards.kind`: `line`
- `core.betweenCards.line.widthPt`: `1`
- `core.betweenCards.line.color`: current shared border/accent fallback
- `core.betweenCards.icon.name`: "arrow-right"
- `core.betweenCards.icon.sizePt`: `24`
- `core.betweenCards.icon.color`: current shared accent fallback
- `core.treatment`: `cards`
- `core.columns`: `3`
- `core.gap`: `24`
- `core.cardPadding`: `32`
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
- Layout has a `Graphic between cards` toggle. It is off by default.
- When `Graphic between cards` is on, Bob shows a `line` or `icon` dropdown.
- Line controls show only for `line`: width in points and line color.
- Icon controls show only for `icon`: the same icon picker source used by CTA,
  icon size in points, and icon color.
- Steps uses the same `core.betweenCards.*` graphic controls as standard Cards
  and linked Cards; it does not define `core.steps.*` connector state.
- Cards validation fails visibly for missing/duplicate item IDs, invalid item
  counts, invalid treatment values, missing media refs, missing link fields, and
  empty enabled visible strings, and invalid graphic controls.
- Cards graphic between cards is decorative, not translatable, and renders only
  between adjacent cards.
- Cards Appearance panel has a `Custom card styles` toggle. It is off by
  default.
- When `Custom card styles` is on, Bob shows one per-card Appearance ToolDrawer
  section keyed by stable card ID and labeled from the card title.
- Per-card style controls are limited to background, border color, radius,
  shadow, accent color, and text tone. They do not control layout, spacing,
  typography scale, Header, Stage, Pod, or global CardWrapper state.
- Per-card style overrides inherit from shared CardWrapper controls when empty
  or when `core.customCardStyles.enabled == false`.
- Runtime applies per-card style overrides through scoped CSS variables on each
  card element, not by generating repetitive per-card CSS blocks.
- Turning `Custom card styles` off ignores per-card overrides without changing
  card content.
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
