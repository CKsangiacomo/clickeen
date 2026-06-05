# PRD106C3_Split_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.1
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: Split widget instances for PRD106D route migration.
Authority owned by this PRD: Split widget body state, controls, defaults, DOM, CSS, runtime, and editable fields.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Cards, Big Bang, CTA, Prague route cutover.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- The current step is the only execution permission.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.

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
Step 1: Define Split body contract.
```

Required evidence before marking green:

- Split body state paths are listed.
- Shell-owned paths are excluded.
- Prague hero/split source behavior is mapped to Split body or defaults.

Stop conditions:

- Split requires new Header/CTA/Stage/Pod state.
- Split requires page-level layout or columns.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Split body contract. | State/control/editable-field table. | Only `visual.*` and approved body paths are added. | Shell path needed. |
| 2 | Build Split defaults and controls. | Spec/body diff. | Non-empty defaults and concrete controls compile. | Blank scaffold or wildcard path. |
| 3 | Build Split DOM/CSS/runtime body. | Diff and preview evidence. | Body renders inside `.ck-headerLayout__body`. | Runtime assumes singleton instance. |
| 4 | Validate translation/editable fields. | Editable-fields diff/tests. | Only concrete translatable body paths plus Shell fields. | Missing stable identity or fake wildcard. |
| 5 | Verify Bob/Roma materialization. | Compile/save/package evidence. | Split package is Shell plus body. | Duplicate Shell code appears. |

## Purpose

Build the surviving `split` widget. Split absorbs the useful Prague `hero` and
Prague `split` visual behavior, but Prague is not the implementation base.

The implementation base is the shared Widget Shell extracted from FAQ.

```text
FAQ:
Stage -> Pod -> ck-headerLayout(Header + FAQ content body)

Split:
Stage -> Pod -> ck-headerLayout(Header + Visual body)
```

Split is not a new editor architecture. It is the shared Widget Shell with one
Split-specific Visual body added.

`hero` is not a separate migrated widget. It is Split with top-of-page defaults:
larger typography, Header placed left, and Visual on the right.

## Implementation Reference

FAQ is the approved proof/source for the Widget Shell extraction, but
`PRD106A2_WidgetShellExtraction.md` owns that extraction. Split must consume
`packages/widget-shell/`.

Do not use current `split`, `hero`, `countdown`, `logoshowcase`, or Prague block
state as the starting point. Countdown and LogoShowcase are not approved bases
for this migration. Prague blocks are visual evidence only.

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
3. Add only Split-specific Visual body state, controls, DOM, CSS, and runtime.

This is the safest execution path because FAQ is known to compile, render, edit,
translate, and save correctly in Bob/Roma.

## Do Not Carry FAQ Body

Do not carry FAQ-specific body state and controls:

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

Do not carry FAQ-specific body runtime:

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

The only Split-specific content is the Visual body.

Approved Split-specific state:

| Path | Owner | Meaning |
| --- | --- | --- |
| `visual.enabled` | config | Shows/hides the Visual body. |
| `visual.fill` | config | Existing `dropdown-fill` value for color, gradient, image, or video visual fill. |
| `visual.height` | config | Visual body height in px. |
| `visual.alt` | content | Alt text for image/video visual modes when applicable. |

Do not add a new Split layout object. The intended layout is already available
through:

- `header.placement`: top, bottom, left, right
- `header.gap`: Header to Visual gap
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
- Prague `accountInstanceRef`

Header copy belongs to `header.title` and `header.subtitleHtml`.
CTA belongs to `cta.*`.
Layout belongs to shared Header and Stage/Pod controls.
Visual framing belongs to `appearance.cardwrapper.*`.

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
        <div class="ck-split__visual ck-headerLayout__body" data-role="split-visual">
          ...
        </div>
      </section>
    </div>
  </div>
</div>
```

The direct `.ck-header` and `.ck-headerLayout__body` children are required
because `CKHeader.applyHeader` and `shared/header.css` depend on that structure.

## Bob Panels And Controls

### Content Panel

Same as FAQ, except FAQ's section/Q&A manager is replaced by Visual controls.

Required clusters:

- shared `header-content`
- `Visual`

Visual controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Show visual | `visual.enabled` | `toggle` | Allows Header-only Split. |
| Visual fill | `visual.fill` | `dropdown-fill` | Use existing fill shape; approved modes are color, gradient, image, video. |
| Visual alt text | `visual.alt` | `textfield` | Shown when the visual fill is image/video and Visual is enabled. |

`visual.instanceRef` is not part of PRD106C3. The core widget-inside-widget
feature must define that separately before Split exposes embedded instances.

### Layout Panel

Same as FAQ, minus FAQ item layout.

Required clusters:

- shared `header-layout`
- Visual size cluster
- shared `stagepod-layout`

Visual size controls:

| Control | Path | Type | Notes |
| --- | --- | --- | --- |
| Visual height | `visual.height` | `valuefield` | Recommended range 180-760 px. |

Do not add `layout.variant`, `copyWidth`, `bodyWidth`, max-width, or Split gap
controls. Header placement and Stage/Pod already own that behavior.

### Appearance Panel

Same as FAQ, minus FAQ link/icon/question-card controls.

Required clusters:

- Theme selector
- shared `header-appearance`
- Locale switcher appearance
- Visual frame controls using `appearance.cardwrapper.*`
- shared `stagepod-appearance`

Visual frame controls should reuse the existing surface/card controls and
runtime:

- `appearance.cardwrapper.radiusLinked`
- `appearance.cardwrapper.radius`
- `appearance.cardwrapper.radiusTL|TR|BR|BL`
- `appearance.cardwrapper.border`
- `appearance.cardwrapper.shadow`
- `CKSurface.applyCardWrapper`

Do not add `visual.radius`, `visual.border`, or `visual.shadow`.

### Typography Panel

Same mechanism as FAQ.

Required roles:

- `title` for `header.title`
- `body` for `header.subtitleHtml`
- `button` for `cta.label`

Visual captions are not part of PRD106C3.

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
- `visual.alt`

Do not add `localization.json`, text packs, wildcard paths, layer sidecars, or
Prague translation files. Bob preview and San Francisco translation must use the
same path-based mechanism FAQ uses.

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
- `visual.enabled`: `true`
- `visual.fill`: neutral visible fill using the existing `dropdown-fill` shape
- `visual.height`: `420`

No visible enabled string may be empty.

## Prague Evidence

Prague only proves which visual outcomes Split must cover:

| Prague block | Split coverage |
| --- | --- |
| `hero` | Header left, Visual right, larger typography defaults. |
| `split` | Header plus Visual, with Header placement controlled by shared `header.placement`. |

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
- Split Content panel contains shared Header controls plus Visual controls.
- Split Layout, Appearance, Typography, Settings, and editable-fields mechanisms
  match FAQ except for removed FAQ-specific controls and added Visual controls.
- Split DOM has `.ck-headerLayout`, direct `.ck-header`, and direct
  `.ck-headerLayout__body`.
- Split calls `CKStagePod.applyStagePod`, `CKTypography.applyTypography`,
  `CKHeader.applyHeader`, and Split-specific Visual runtime in that order.
- Split uses `header.placement` for top/bottom/left/right layout.
- Split does not ship old Prague/current-Split paths listed in Forbidden State.
- Split materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two Split instances on one composed page do not collide in CSS/runtime.
