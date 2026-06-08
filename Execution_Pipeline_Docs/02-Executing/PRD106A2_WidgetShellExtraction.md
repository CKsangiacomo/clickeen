# PRD106A2_WidgetShellExtraction

Status: Implementation checkpoint - A2 implementation gates green in code.
Owner: Widget system + Bob/Roma materialization
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`
Series step: 3
Depends on: `106__Umbrella__Composition_Vision.md`, `PRD106A_realignment.md`
Unlocks: `PRD106B_PageComposer.md`, `PRD106C_Prague astro blocks migration to widget instances.md`, `PRD106C3`-`PRD106C6`
Authority owned by this PRD: shared Widget Shell extraction and Widget Core extension contract.
Authority explicitly not owned by this PRD: Page Composer, Prague block inventory, Prague route cutover, Widget Core product decisions.

## Critical Path Warning

PRD106A2 is the foundation under the rest of the 106 series. A subtly wrong
Shell extraction propagates into FAQ, Split, Cards, Big Bang, CTA, Countdown,
Logo Showcase, and Page Composer CSS/runtime dedupe. Treat Step 3, "Rebase FAQ
onto shared Shell with no behavior change," as the program's critical path.
Nothing Core-specific should proceed until FAQ proves zero visible regression
through compile, preview, save/materialization, and package output evidence.

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
2. Confirm dependencies are green or explicitly fenced.
3. Name the surviving authority for the concern being changed.
4. Refresh required `file:line` evidence.
5. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. If evidence is
missing, contradictory, stale, or points to another PRD's authority, stop. Do
not continue to the next step. Do not invent product behavior to keep moving.

If a product decision is missing, add it under
`OPEN QUESTIONS (BLOCKERS) FOR PIETRO, PRODUCT OWNER` and stop.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| Umbrella | Product tenets and authority table are current. | REQUIRED |
| PRD106A | Step 2 Dependency And Cutover Plan is green: Shell-affecting drift has surviving authority, owner PRD, delete/fence/block decision, and blast-radius gate. | REQUIRED |

## Current Step Gate

Current executable step:

```text
A2 implementation gates are green.
```

Green evidence:

- `packages/widget-shell/src/validators.ts` rejects old Shell aliases in Shell
  widget defaults.
- `bob/lib/compiler.server.ts` runs the guard at the real widget-source compile
  boundary.
- The guard rejects custom editor fields for Header/CTA/CoreSize; those controls
  must come from shared Shell editor nodes.
- No root PRD scripts, broad repo scripts, or fake self-checking product flows
  were added.

Stop conditions:

- Downstream PRDs may not preserve old Header/CTA/layout aliases as
  compatibility state.
- Downstream PRDs may not add custom Header/CTA/CoreSize editor controls instead
  of using shared Shell nodes.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Extract and prove FAQ Shell inventory. | `file:line` source inventory; path ownership list. | Shell/Core boundary is explicit. | Any path ownership is ambiguous. |
| 2 | Create `packages/widget-shell/` contract surface. | Diff showing package files and exported responsibilities. | Package owns contract/defaults/controls/render/runtime/css/validators. | Package starts owning Widget Core behavior. |
| 3 | Rebase FAQ onto shared Shell with no behavior change. | Diff plus FAQ compile/render/save evidence. | FAQ output remains gold standard. | FAQ behavior changes outside intentional package import. |
| 4 | Prove Core extension with Call to Action. | Call to Action diff plus compile/render evidence. | Call to Action is shared Shell plus `calltoaction.*` Core. | Call to Action defines duplicate Shell paths. |
| 5 | Implement Split Core on the shared Shell. | Split diff plus compile/render/package evidence. | Split contributes only Core state/controls/runtime and uses shared Header/Header CTA/Stage/Pod. | Split redefines Header/Header CTA/Stage/Pod or changes FAQ/Call to Action behavior. |
| 6 | Add validation/search guards. | Targeted verification or `rg` guard output. | Forbidden duplicate paths fail without adding repo-wide PRD scripts or preserving copied Shell logic. | Guards allow copied Shell logic or recreate deleted PRD-script behavior. |

## Purpose

Extract FAQ's working widget architecture into one shared repo package:

```text
packages/widget-shell/
```

This PRD exists because the Widget Shell is now a product primitive. It must not
remain copied FAQ code, scattered helper files, or a Tokyo-owned concept.

The execution goal is simple:

```text
shared Widget Shell + Widget Core = materialized widget package
```

FAQ proves the Shell. `packages/widget-shell/` becomes the surviving authority.
Widgets then contribute only Core-specific schema, defaults, controls, editable
fields, DOM, CSS, and runtime.

## Product Boundary

The Shell package is build/materialization authority, not a live public service.

Allowed:

- Bob compiler imports Shell controls/helpers for preview.
- Roma materialization imports the same Shell controls/helpers for package
  output.
- Page Composer consumes already-materialized Shell-based instance packages.
- Tokyo-worker may validate/store generated files and account source.

Not allowed:

- Tokyo owns or decides Widget Shell architecture.
- Browser output depends on a separate request-time Shell service.
- Each widget copies Shell code into its own private implementation.
- Widget Cores define duplicate Header, CTA, Stage, Pod, layout, appearance,
  typography, locale selector, branding, or translation systems.

## Source Of Truth

FAQ is the extraction source because it is the working gold-standard widget.

Read and preserve behavior from:

- `tokyo/product/widgets/faq/spec.json`
- `tokyo/product/widgets/faq/editable-fields.json`
- `tokyo/product/widgets/faq/widget.html`
- `tokyo/product/widgets/faq/widget.css`
- `tokyo/product/widgets/faq/widget.client.js`
- `bob/lib/compiler/modules/header.ts`
- `bob/lib/compiler/modules/stagePod.ts`
- `bob/lib/compiler/modules/typography.ts`
- `bob/lib/compiler/editor-contract.ts`
- `tokyo/product/widgets/shared/header.js`
- `tokyo/product/widgets/shared/header.css`
- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/stagePod.css`
- `tokyo/product/widgets/shared/runtime.js`
- `tokyo/product/widgets/shared/surface.js`
- `tokyo/product/widgets/shared/appearance.js`
- `tokyo/product/widgets/shared/fill.js`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/shared/typography-data.js`
- `tokyo/product/widgets/shared/localeSwitcher.js`
- `tokyo/product/widgets/shared/localeSwitcher.css`
- `tokyo/product/widgets/shared/branding.js`
- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/product/widgets/shared/socialShare.js`
- `tokyo/product/widgets/shared/socialShare.css`

## Step 1 Evidence: FAQ Shell Inventory

Status: Step 1 green evidence, captured before any package extraction.

This inventory proves the Shell/Core boundary from current FAQ code. It does not
grant permission to create the package, rebase FAQ, or edit other widgets until
the Current Step Gate moves to the next step.

### FAQ Shell Source Inventory

| Concern | Evidence |
| --- | --- |
| Shell state defaults: `headerCta.*`, `localeSwitcher.*`, `pod.*`, `stage.*`, `header.*`, `behavior.*`, `appearance.*`, `typography.*` | `tokyo/product/widgets/faq/spec.json:44`, `tokyo/product/widgets/faq/spec.json:57`, `tokyo/product/widgets/faq/spec.json:64`, `tokyo/product/widgets/faq/spec.json:165`, `tokyo/product/widgets/faq/spec.json:259`, `tokyo/product/widgets/faq/spec.json:294`, `tokyo/product/widgets/faq/spec.json:335`, `tokyo/product/widgets/faq/spec.json:454` |
| Shell editor clusters in FAQ spec | `tokyo/product/widgets/faq/spec.json:615`, `tokyo/product/widgets/faq/spec.json:1721`, `tokyo/product/widgets/faq/spec.json:1727`, `tokyo/product/widgets/faq/spec.json:1731`, `tokyo/product/widgets/faq/spec.json:2081`, `tokyo/product/widgets/faq/spec.json:2086`, `tokyo/product/widgets/faq/spec.json:2160`, `tokyo/product/widgets/faq/spec.json:2682`, `tokyo/product/widgets/faq/spec.json:2687` |
| Shell DOM structure: Stage, Pod, widget root, `ck-headerLayout`, Header, Core slot | `tokyo/product/widgets/faq/widget.html:15`, `tokyo/product/widgets/faq/widget.html:16`, `tokyo/product/widgets/faq/widget.html:17`, `tokyo/product/widgets/faq/widget.html:19`, `tokyo/product/widgets/faq/widget.html:24`, `tokyo/product/widgets/faq/widget.html:35` |
| Header DOM roles | `tokyo/product/widgets/faq/widget.html:26`, `tokyo/product/widgets/faq/widget.html:27`, `tokyo/product/widgets/faq/widget.html:30` |
| FAQ Core DOM role inside Shell Core slot | `tokyo/product/widgets/faq/widget.html:39` |
| Shared Header Bob controls | `bob/lib/compiler/modules/header.ts:55`, `bob/lib/compiler/modules/header.ts:58`, `bob/lib/compiler/modules/header.ts:66`, `bob/lib/compiler/modules/header.ts:80`, `bob/lib/compiler/modules/header.ts:100` |
| Shared Stage/Pod Bob controls | `bob/lib/compiler/modules/stagePod.ts:48`, `bob/lib/compiler/modules/stagePod.ts:97`, `bob/lib/compiler/modules/stagePod.ts:122` |
| Shared Typography Bob panel builder | `bob/lib/compiler/modules/typography.ts:45` |
| Bob editor contract recognizes Shell clusters | `bob/lib/compiler/editor-contract.ts:49`, `bob/lib/compiler/editor-contract.ts:216` |
| Shared runtime calls from FAQ | `tokyo/product/widgets/faq/widget.client.js:255`, `tokyo/product/widgets/faq/widget.client.js:355`, `tokyo/product/widgets/faq/widget.client.js:360`, `tokyo/product/widgets/faq/widget.client.js:377`, `tokyo/product/widgets/faq/widget.client.js:382`, `tokyo/product/widgets/faq/widget.client.js:510` |
| Shared runtime implementations | `tokyo/product/widgets/shared/surface.js:95`, `tokyo/product/widgets/shared/stagePod.js:349`, `tokyo/product/widgets/shared/header.js:142`, `tokyo/product/widgets/shared/localeSwitcher.js:184`, `tokyo/product/widgets/shared/typography.js:628`, `tokyo/product/widgets/shared/previewL10n.js:70`, `tokyo/product/widgets/shared/branding.js:143`, `tokyo/product/widgets/shared/socialShare.js:238` |
| Roma package/page extraction already expects style/runtime module boundaries | `roma/lib/widget-public-package.ts:120`, `roma/lib/widget-public-package.ts:280`, `roma/lib/widget-public-package.ts:328`, `roma/lib/page-package-composer.ts:36`, `roma/lib/page-package-composer.ts:39`, `roma/lib/page-package-composer.ts:253`, `roma/lib/page-package-composer.ts:262` |
| Bob compiled widget route fetches widget source files and currently includes shared social-share files | `bob/lib/api/compiled-widget-route.ts:96`, `bob/lib/api/compiled-widget-route.ts:125`, `bob/lib/api/compiled-widget-route.ts:170`, `bob/lib/api/compiled-widget-route.ts:323` |
| Shell editable fields from FAQ | `tokyo/product/widgets/faq/editable-fields.json:6`, `tokyo/product/widgets/faq/editable-fields.json:14`, `tokyo/product/widgets/faq/editable-fields.json:22` |

### Shell-Owned Paths Proved By FAQ

These paths are Shell-owned because FAQ already uses them for shared widget
state, controls, DOM/runtime, or editable-field behavior:

```text
header.enabled
header.title
header.showSubtitle
header.subtitleHtml
header.placement
header.alignment
header.gap
header.textGap
header.ctaPlacement
header.innerGap

headerCta.enabled
headerCta.label
headerCta.href
headerCta.openMode
headerCta.iconEnabled
headerCta.iconPlacement
headerCta.iconName

stage.*
pod.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder
typography.*
localeSwitcher.*
behavior.showBacklink
behavior.socialShare.enabled
```

Core frame/surface state is widget-specific Core, not Shell. Widgets may use
shared `CKSurface.applyCardWrapper`, but the surviving state path must live
under the widget namespace, such as `cards.appearance.cardwrapper.*` or
`split.appearance.cardwrapper.*`.

### FAQ Core Paths Excluded From Shell

These paths remain FAQ Core. They must not be promoted into the Shell package:

```text
sections[]
sections[].id
sections[].title
sections[].faqs[]
sections[].faqs[].id
sections[].faqs[].question
sections[].faqs[].answer
displayCategoryTitles
layout.type
layout.columns.*
layout.cardsLayout
layout.gap
layout.itemQaGap*
layout.itemPadding*
appearance.itemBackground
appearance.iconStyle
appearance.iconColor
appearance.link*
behavior.expandFirst
behavior.multiOpen
behavior.expandAll
seoGeo.*
seo.*
geo.*
```

FAQ Core editable fields are excluded from Shell and keep stable array identity:

```text
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

Evidence: `tokyo/product/widgets/faq/editable-fields.json:30`,
`tokyo/product/widgets/faq/editable-fields.json:34`,
`tokyo/product/widgets/faq/editable-fields.json:40`,
`tokyo/product/widgets/faq/editable-fields.json:44`,
`tokyo/product/widgets/faq/editable-fields.json:51`,
`tokyo/product/widgets/faq/editable-fields.json:55`.

### Product-Approved Shell Additions Not Proved By FAQ

These are approved Shell responsibilities even though FAQ does not currently
prove them as implemented behavior:

```text
uiLabels.core.singular
uiLabels.core.plural
uiLabels.core.sizeCluster
coreSize.mode
coreSize.fixedHeight
coreSize.minHeight
coreSize.preferredVw
coreSize.maxHeight
```

Reason:

- `uiLabels.core.*` is required so Bob can render user-facing Core labels such
  as "FAQs", "Visual", "Cards", "Statement", and "CTA" without displaying the
  architecture term "Core".
- `coreSize.*` is required because every normal widget has one Shell-owned Core
  slot and child widgets must not invent private height/visual/body sizing
  paths.

Implementation rule for later steps: these additions default to non-disruptive
`auto` behavior for FAQ. They are not to be described as FAQ-proven extraction,
and FAQ must show no visible regression when Step 3 rebases it onto the Shell.

## Package Shape

Create the shared package as the surviving implementation coordinate:

```text
packages/widget-shell/
  src/
    contract.ts
    defaults.ts
    controls.ts
    editable-fields.ts
    render.ts
    runtime.ts
    css.ts
    validators.ts
```

The exact file split can follow existing repo conventions, but the package must
provide these named responsibilities:

- Shell state contract.
- Shell default state.
- Shell editor panel/control builders.
- Shell editable-field conventions.
- Shell DOM renderer/wrapper.
- Shell CSS/runtime module keys.
- Shell package contribution validator.
- Core extension validator.

Do not create empty academic files just to match the sketch above. The
responsibilities are required; the file split is allowed to stay boring and
local-convention-shaped.

## Step 2 Evidence: Widget Shell Package Contract Surface

Status: Step 2 green evidence, captured before any FAQ rebase.

Created the package coordinate:

```text
packages/widget-shell/
```

Workspace registration:

```text
pnpm-workspace.yaml
```

Package responsibility map:

| File | Responsibility |
| --- | --- |
| `packages/widget-shell/src/contract.ts` | Shell version, Shell-owned path families, DOM role/class contract, editor cluster ids, forbidden duplicate aliases, Core extension contract. |
| `packages/widget-shell/src/defaults.ts` | Non-disruptive Shell defaults, including product-approved Core div sizing and UI Core label defaults. |
| `packages/widget-shell/src/controls.ts` | Shell control path inventory and Shell editor cluster/control metadata. |
| `packages/widget-shell/src/editable-fields.ts` | Shared editable-field definitions for Header title, Header subtitle, and CTA label plus composition helper for Core editable fields. |
| `packages/widget-shell/src/modules.ts` | Shell CSS/runtime module keys and package contribution helper for materialization/dedupe. |
| `packages/widget-shell/src/render.ts` | Shell DOM wrapper renderer for Stage, Pod, widget root, Header layout, Header slot, and Core slot. |
| `packages/widget-shell/src/validators.ts` | Shell/Core boundary validators: Core labels, Core sizing, extension contract, and stable Shell DOM checks. |
| `packages/widget-shell/src/index.ts` | Public package exports. |

The package intentionally does not own FAQ Core behavior. Widget Cores still
own their own Core schema/defaults/controls/editable fields/DOM/CSS/runtime.

Verification:

```text
pnpm --filter @clickeen/widget-shell typecheck
```

Result:

```text
@clickeen/widget-shell typecheck passed with tsc -p tsconfig.json --noEmit
```

## Step 3 Evidence: FAQ Rebased Onto Shared Shell Contract

Status: Step 3 green evidence.

Changed assembly ownership without changing FAQ product source:

- Bob imports `@clickeen/widget-shell` for the shared editor node id type.
- Bob fetches optional Shell support files from the Shell package constant
  instead of hard-coded local strings.
- Roma widget package materialization imports Shell chunk marker constants and
  Shell social-share module keys.
- Roma Page Composer imports the same Shell chunk marker constants when parsing
  widget package contributions.
- FAQ source files were not edited.

Source diff guard:

```text
git diff --name-only -- tokyo/product/widgets/faq tokyo/product/widgets/shared
```

Result:

```text
no output
```

Typecheck evidence:

```text
pnpm --filter @clickeen/widget-shell typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
```

Result:

```text
all passed
```

FAQ compile/materialization smoke:

```text
compileWidgetServer(faq spec) with local Tokyo product fetch stub
buildSavedWidgetPublicPackage(faq package)
```

Assertions proved:

- `compiled.widgetname == "faq"`.
- Bob panel order stayed `content`, `typography`, `layout`, `appearance`,
  `settings`.
- FAQ compiled control count is `203`.
- Shell control path `header.title` is still present.
- FAQ Core paths `sections.__SECTION__.title` and
  `sections.__SECTION__.faqs.__INDEX__.question` are still present.
- Saved package HTML still contains `data-ck-widget="faq"`,
  `data-role="root"`, and `data-ck-instance-id`.
- Saved package CSS still contains current style module markers including
  `shared-header.css` and `faq-widget-css`.
- Saved package runtime still contains the runtime payload marker,
  `window.CK_WIDGETS[payload.instanceId]`, `shared-header.js`, and
  `faq-widget-client.js`.

Smoke output:

```json
{
  "widget": "faq",
  "panels": ["content", "typography", "layout", "appearance", "settings"],
  "controls": 203,
  "indexHasRoot": true,
  "stylesBytes": 20787,
  "runtimeBytes": 140186
}
```

Behavior statement:

FAQ remains the gold-standard widget. Step 3 did not move `sections[]`, FAQ
item controls, FAQ runtime, FAQ CSS, or FAQ DOM into the Shell package. It only
rebased shared compiler/materialization contract constants onto
`@clickeen/widget-shell`.

## Step 4 Evidence: Call To Action Shell/Core Proof

Status: Step 4 green evidence.

106 closure supersedes the early CTA Shell proof. Current Call to Action
is shared Shell plus widget-specific Core under `calltoaction.*`:

- Deleted root `title`, root `body`, `primaryCta`, `secondaryCta`, and private
  `layout.*` state from `tokyo/product/widgets/calltoaction/spec.json`.
- Replaced Call to Action Content/Layout/Appearance Shell controls with shared
  Shell controls.
- Replaced Header CTA editable fields with `header.title`,
  `header.subtitleHtml`, and `headerCta.label`.
- Replaced private CTA DOM with `ck-headerLayout`, `.ck-header`, and a
  `.ck-calltoaction__body` Core region.
- Replaced private CTA runtime/link logic with shared Shell helper calls:
  `CKStagePod`, `CKTypography`, `CKHeader`, `CKLocaleSwitcher`, and
  `CKBranding`.

Old-path guard:

```text
rg "primaryCta|secondaryCta|layout\.maxWidth|layout\.bodyWidth|layout\.gap|ck-cta__body|ck-cta__actions|cta-primary|cta-secondary|data-role=\"cta-body\"|data-role=\"cta-actions\"" tokyo/product/widgets/calltoaction
```

Result:

```text
no output
```

Verification:

```text
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
pnpm validate:widgets
```

Result:

```text
all passed
```

CTA compile/materialization smoke:

```text
compileWidgetServer(cta spec) with local Tokyo product fetch stub
buildSavedWidgetPublicPackage(cta package)
```

Assertions proved:

- `compiled.widgetname == "calltoaction"`.
- Bob panel order is `content`, `typography`, `layout`, `appearance`,
  `settings`.
- Call to Action compiled controls include shared Shell plus `calltoaction.*`
  Core body/action controls.
- Shell control paths `header.title` and `headerCta.label` are present.
- No compiled controls include `primaryCta`, `secondaryCta`,
  `layout.maxWidth`, `layout.bodyWidth`, or `layout.gap`.
- Saved package HTML contains `data-ck-widget="calltoaction"`,
  `class="ck-calltoaction ck-headerLayout"`, and
  `class="ck-calltoaction__content ck-headerLayout__body"`.
- Saved package HTML does not contain retired private CTA body/action DOM
  classes.
- Saved package CSS/runtime contain current shared markers
  `shared-header.css`, `shared-header.js`, and Call to Action widget
  CSS/runtime contribution markers.

Smoke output:

```json
{
  "widget": "calltoaction",
  "panels": ["content", "typography", "layout", "appearance", "settings"],
  "shellControls": ["header.title", "headerCta.label"],
  "coreControls": ["calltoaction.headline", "calltoaction.action.label"],
  "stylesBytes": 13520,
  "runtimeBytes": 110815
}
```

Behavior statement:

Call to Action now uses the `calltoaction` widget name, shared Shell, and
`calltoaction.*` Core. It does not keep the old CTA product model or bridge old
invalid state.

## Shell DOM Contract

Every normal widget renders this structure:

```text
Stage
  Pod
    ck-widget root
      ck-headerLayout
        Header
        Widget Core slot
```

The generated HTML must expose stable roles:

```text
data-role="stage"
data-role="pod"
data-role="root"
class contains "ck-headerLayout"
class contains "ck-header"
class contains "ck-headerLayout__body"
```

The direct children of `.ck-headerLayout` are:

```text
Header
Widget Core slot
```

The existing implementation class name `.ck-headerLayout__body` may remain as a
CSS/runtime compatibility detail, but the architecture noun is Widget Core.

Page Composer depends on this stable package contribution shape. It must not
parse private widget layouts.

## Shell State Contract

The Shell owns these state families:

```text
header.*
headerCta.*
stage.*
pod.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder
typography.*
localeSwitcher.*
behavior.showBacklink
behavior.socialShare.enabled
```

The Shell also owns shared runtime state interpretation for:

- Header enabled/hidden.
- Header title/subtitle/CTA rendering.
- Header placement/alignment/gaps.
- CTA link behavior and icon behavior.
- Stage canvas, alignment, padding, background, shadows.
- Pod width, padding, background, border, radius, shadows.
- Locale switcher rendering and appearance.
- Branding/backlink rendering.
- Social share rendering when enabled.
- Typography roles and role scales.

## Header Meaning

Header has one meaning across normal widgets:

```text
Header = title + optional subtitle + optional CTA
```

Approved paths:

```text
header.enabled
header.title
header.showSubtitle
header.subtitleHtml
header.placement
header.alignment
header.gap
header.textGap
header.ctaPlacement
header.innerGap

headerCta.enabled
headerCta.label
headerCta.href
headerCta.openMode
headerCta.iconEnabled
headerCta.iconPlacement
headerCta.iconName
```

Forbidden duplicate paths:

```text
headline
subheadline
copy
button
primaryCta
secondaryCta
ctaText
ctaUrl
layout.copyWidth
layout.bodyWidth
layout.variant
```

## Shell Panels

The Shell owns these Bob editor clusters/panels.

### Content Panel

Shell cluster:

```text
shared: header-content
```

Controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `header.enabled` | toggle | Show/hide Header. |
| `header.title` | dropdown-edit | Header title. |
| `header.showSubtitle` | toggle | Show/hide subtitle. |
| `header.subtitleHtml` | dropdown-edit | Header subtitle. |
| `headerCta.enabled` | toggle | Show/hide Header CTA. |
| `headerCta.label` | textfield | Header CTA label. |
| `headerCta.href` | textfield | Header CTA target URL. |
| `headerCta.openMode` | dropdown-actions | Same tab/new tab/new window. |
| `headerCta.iconEnabled` | toggle | Show/hide Header CTA icon. |
| `headerCta.iconPlacement` | dropdown-actions | Left/right. |
| `headerCta.iconName` | dropdown-actions | Approved icon choices. |

Core controls follow this cluster in the same Content panel. FAQ Core controls
such as `sections[]` are not Shell controls.

### Layout Panel

Shell clusters:

```text
shared: header-layout
shared: core-size
shared: stagepod-layout
```

Header layout controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `header.placement` | dropdown-actions | Top/bottom/left/right. |
| `header.alignment` | dropdown-actions | Left/center/right. |
| `header.gap` | valuefield | Header/Core gap. |
| `header.textGap` | valuefield | Title/subtitle gap. |
| `header.ctaPlacement` | dropdown-actions | CTA right of title or below title. |
| `header.innerGap` | valuefield | Header text/CTA gap. |

### Core Div Sizing

Every normal widget has one Core div. Shell owns generic Core div sizing because
the Shell owns the Header/Core layout boundary.

`coreSize.*` is an explicit product-approved Shell addition if Step 1 cannot
trace equivalent behavior to FAQ's current implementation. It exists because
all normal widgets need one consistent way to size the Core slot inside the
Header/Stage/Pod Shell. Implement it with default `auto` and no visible FAQ
regression. Do not fake FAQ evidence to justify it, and do not let individual
Widget Cores create private height/visual-size paths instead.

Bob UI must not say "Core". Each widget must define user-facing labels:

```text
uiLabels.core.singular
uiLabels.core.plural
uiLabels.core.sizeCluster
```

Examples:

```text
FAQ: uiLabels.core.sizeCluster = "FAQs size"
Split: uiLabels.core.sizeCluster = "Visual size"
Cards: uiLabels.core.sizeCluster = "Cards size"
Logo Showcase: uiLabels.core.sizeCluster = "Logos size"
Countdown: uiLabels.core.sizeCluster = "Timer size"
Big Bang: uiLabels.core.sizeCluster = "Statement size"
```

The shared Layout panel order is:

```text
Header
[uiLabels.core.sizeCluster]
Widget-specific layout controls
Stage/Pod
```

Core div sizing state:

| Path | Control | Meaning |
| --- | --- | --- |
| `coreSize.mode` | dropdown-actions | `auto`, `fixed`, or `responsive`. |
| `coreSize.fixedHeight` | valuefield | Exact Core div height in px when mode is `fixed`. |
| `coreSize.minHeight` | valuefield | Minimum Core div height in px when mode is `responsive`. |
| `coreSize.preferredVw` | valuefield | Preferred viewport-width scale for responsive clamp. |
| `coreSize.maxHeight` | valuefield | Maximum Core div height in px when mode is `responsive`. |

Core div sizing `showIf` rules:

```text
coreSize.mode == fixed
  show coreSize.fixedHeight

coreSize.mode == responsive
  show coreSize.minHeight
  show coreSize.preferredVw
  show coreSize.maxHeight
```

Rendering behavior:

```text
auto:
  height: auto

fixed:
  height: coreSize.fixedHeight px

responsive:
  min-height: clamp(coreSize.minHeight px, coreSize.preferredVw vw, coreSize.maxHeight px)
```

Default `coreSize.mode` is `auto` unless a widget PRD explicitly chooses a
different default.

Stage/Pod layout controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `pod.widthMode` | dropdown-actions | Wrap/full/fixed. |
| `pod.contentWidth` | valuefield | Fixed pod width. |
| `pod.padding.desktop.*` | toggle/valuefield | Desktop pod padding. |
| `pod.padding.mobile.*` | toggle/valuefield | Mobile pod padding. |
| `stage.alignment` | dropdown-actions | Pod alignment in stage. |
| `stage.canvas.mode` | dropdown-actions | Full/wrap/fixed stage. |
| `stage.canvas.width` | valuefield | Fixed stage width. |
| `stage.canvas.height` | valuefield | Fixed stage height. |
| `stage.padding.desktop.*` | toggle/valuefield | Desktop stage padding. |
| `stage.padding.mobile.*` | toggle/valuefield | Mobile stage padding. |

Widget Core layout controls sit between `header-layout` and `stagepod-layout`
when needed. They must not redefine Header/Stage/Pod concerns.

### Appearance Panel

Shell clusters:

```text
shared: header-appearance
shared: stagepod-appearance
```

Header CTA appearance controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `appearance.headerCta.sizePreset` | dropdown-actions | Header CTA size preset. |
| `appearance.headerCta.paddingLinked` | toggle | Link Header CTA padding. |
| `appearance.headerCta.paddingInline` | valuefield | Inline Header CTA padding. |
| `appearance.headerCta.paddingBlock` | valuefield | Block Header CTA padding. |
| `appearance.headerCta.background` | dropdown-fill | Header CTA background. |
| `appearance.headerCta.textColor` | dropdown-fill | Header CTA text color. |
| `appearance.headerCta.border` | dropdown-border | Header CTA border. |
| `appearance.headerCta.radius` | dropdown-actions | Header CTA corner radius. |
| `appearance.headerCta.iconSizePreset` | dropdown-actions | Header CTA icon size preset. |
| `appearance.headerCta.iconSize` | valuefield | Custom Header CTA icon size. |

Locale switcher appearance controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `appearance.localeSwitcherBackground` | dropdown-fill | Switcher background. |
| `appearance.localeSwitcherTextColor` | dropdown-fill | Switcher text color. |
| `appearance.localeSwitcherBorder` | dropdown-border | Switcher border. |
| `appearance.localeSwitcherRadius` | dropdown-actions | Switcher radius. |
| `appearance.localeSwitcherPaddingInline` | valuefield | Switcher horizontal padding. |
| `appearance.localeSwitcherPaddingBlock` | valuefield | Switcher vertical padding. |

Stage/Pod appearance controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `stage.background` | dropdown-fill | Stage background. |
| `stage.shadow` | dropdown-shadow | Stage outside shadow. |
| `stage.insideShadow.*` | toggle/dropdown-shadow | Stage inside shadow. |
| `pod.background` | dropdown-fill | Pod background. |
| `appearance.podBorder` | dropdown-border | Pod border. |
| `pod.shadow` | dropdown-shadow | Pod outside shadow. |
| `pod.insideShadow.*` | toggle/dropdown-shadow | Pod inside shadow. |
| `pod.radiusLinked` | toggle | Link pod corners. |
| `pod.radius` | dropdown-actions | Linked pod radius. |
| `pod.radiusTL|TR|BR|BL` | dropdown-actions | Per-corner pod radius. |

FAQ-specific Q&A card controls are Core controls unless the product owner
explicitly approves a generic reusable card-frame Shell submodule.

### Typography Panel

Shell owns the standardized typography panel builder.

Required Shell roles:

```text
title
body
button
localeSwitcher
```

Widget Cores may add roles:

```text
question
answer
section
cardTitle
cardBody
bigBang
countdownNumber
countdownLabel
logoCaption
```

The Shell owns role rendering mechanics. Widget Cores own only the additional
Core role names they need.

### Settings Panel

Shell-owned settings:

| Path | Control | Meaning |
| --- | --- | --- |
| `behavior.showBacklink` | toggle | Show Made with Clickeen. |
| `behavior.socialShare.enabled` | toggle | Enable social share. |

FAQ-specific SEO/GEO controls such as `seoGeo.enabled`, `seo.enableSchema`,
`seo.canonicalUrl`, and `geo.enableDeepLinks` must not be blindly promoted to
the Shell for every widget. They require the future instance/page SEO/GEO PRD.

### Locale Selector Controls

Shell owns the existing locale switcher state and runtime:

```text
localeSwitcher.enabled
localeSwitcher.byIp
localeSwitcher.alwaysShowLocale
localeSwitcher.attachTo
localeSwitcher.position
appearance.localeSwitcher*
typography.roles.localeSwitcher
```

Page-level localization controls remain Page Composer concerns. The Shell only
renders an instance/page-owned switcher when the materialized state asks it to.

## Widget Core Extension Contract

Every widget has one Core div. The Core div is the Shell boundary where
widget-specific software begins.

Every widget spec must provide:

- `uiLabels.core.*` user-facing labels for shared Core div controls.
- `coreSize.*` defaults.

Every widget-specific Core implementation must provide:

- Core state schema.
- Core defaults.
- Core editor controls.
- Core editable fields.
- Core DOM renderer for `.ck-headerLayout__body`.
- Core CSS contribution.
- Core runtime contribution, if behavior is needed.
- Core typography roles, if additional roles are needed.
- Core validation.

The Core must not define:

- `header.*`
- `headerCta.*`
- `stage.*`
- `pod.*`
- `localeSwitcher.*`
- `behavior.showBacklink`
- `behavior.socialShare.enabled`
- duplicate layout/appearance paths for Shell-owned concepts.
- duplicate sizing paths for the Core div. Use Shell-owned `coreSize.*`.

Approved Core div examples:

| Widget | Software inside the Core div |
| --- | --- |
| FAQ | `sections[]`, FAQ layout, FAQ item/card appearance, FAQ runtime. |
| Split | image/video/embedded-instance item software; optional carousel behavior. |
| Cards | `items[]`, cards layout/treatment, cards frame/card-copy controls. |
| Countdown | timer target, labels, expired behavior. |
| Logo Showcase | logos/items, row/grid/marquee behavior. |
| Call to Action | `calltoaction.*`. |
| Big Bang | `bigBang.*`. |

## Editable Fields

The Shell contributes only shared Header/Header CTA editable fields:

```text
header.title
header.subtitleHtml
headerCta.label
```

Widget Cores contribute their Core text fields:

```text
FAQ: sections[].title, sections[].faqs[].question, sections[].faqs[].answer
Cards: items[].title, items[].body, items[].ctaLabel
Split: image/video alt text
Big Bang: bigBang.statement, bigBang.supportingCopy
Countdown: countdown labels and expired copy
Logo Showcase: logo captions/alt text if visible/editable
Call to Action: calltoaction.eyebrow, calltoaction.headline, calltoaction.supportingTextHtml, calltoaction.action.label
```

Array fields must declare stable item identity. No wildcard paths are allowed in
compiled Bob controls.

## Materialization Contract

Bob preview, Roma save/materialization, and Page Composer input must use the
same composition path:

```text
Shell state + Core state + Shell renderer + Core renderer -> index.html/styles.css/runtime.js
```

The output remains edge-friendly:

- static `index.html`;
- static `styles.css`;
- static `runtime.js`;
- no request-time composition;
- no request-time database read;
- no separate browser fetch for "the Shell" as product logic.

Page Composer may dedupe Shell CSS/runtime modules by stable module key because
all normal widgets share the same Shell package. It may also dedupe Core
CSS/runtime modules by stable widget/version key when multiple instances use
the same Core implementation.

## Validation

Add validation that fails at build/materialization time when a widget Core:

- defines forbidden Header/CTA aliases;
- defines Shell-owned paths;
- omits required Shell state defaults;
- omits direct `.ck-header` or `.ck-headerLayout__body` structure;
- introduces singleton runtime state that breaks multiple instances per page;
- uses non-concrete control paths;
- declares editable fields that are not present in content state;
- stores Core-specific state in Shell paths.

Invalid state must fail at the named boundary. Do not heal Core mistakes into
new Shell behavior.

## Non-Executable Sequence Reference

This section is planning context only. It does not override the Current Step
Gate or the numbered Execution Steps table.

1. Step 1 inventories FAQ Shell/Core ownership and separately marks any
   product-approved Shell additions such as `coreSize.*`.
2. Step 2 creates `packages/widget-shell/` and moves/wraps shared compiler,
   runtime, CSS, defaults, editable-field, and validation responsibilities under
   that package boundary.
3. Step 3 rebases FAQ onto `packages/widget-shell/` with no user-visible
   behavior change and proves compile, preview, save/materialization, and
   package output evidence.
4. Step 4 converts Call to Action to prove Shell plus widget Core reuse.
5. Step 5 implements Split Core on the shared Shell. Use Cards only if the
   owning Cards PRD first resolves the `cards`/`cardgrid` naming authority
   without aliases or compatibility shims.
6. Step 6 adds product-shaped validation/search guards that reject copied Shell
   logic and duplicate Shell-owned paths without adding root PRD scripts.
7. Countdown and Logo Showcase gold-standard repair remain downstream Shell
   rebase tasks after FAQ, Call to Action, and Split Core are green.

## Blast Radius

Expected touched areas:

- `packages/widget-shell/**`
- `bob/lib/compiler/modules/header.ts`
- `bob/lib/compiler/modules/stagePod.ts`
- `bob/lib/compiler/modules/typography.ts`
- `bob/lib/compiler/editor-contract.ts`
- `bob/lib/compiler.server.ts`
- `bob/lib/api/compiled-widget-route.ts`
- `roma/lib/widget-public-package.ts`
- `roma/lib/page-package-composer.ts` only for package contribution
  compatibility/handoff evidence; PRD106B owns Page Composer behavior.
- `tokyo/product/widgets/shared/**`
- `tokyo/product/widgets/faq/**`
- `tokyo/product/widgets/calltoaction/**`
- `tokyo/product/widgets/split/**` for Split Core implementation, or
  `tokyo/product/widgets/cards/**` only after the owning Cards PRD resolves
  `cards` versus `cardgrid`.
- Widget validation/search guards scoped to Shell/Core boundaries.

Do not move account-owned instance source or generated account artifacts in this
PRD. Tokyo/R2 paths remain unchanged.

## Acceptance

- `packages/widget-shell/` exists and is the named authority for shared widget
  architecture.
- FAQ consumes the shared Shell and has no user-visible regression.
- Call to Action consumes the shared Shell with `calltoaction.*` Core.
- Split Core consumes the shared Shell.
- Bob preview and Roma materialization use the same Shell + Core contract.
- A2 emits stable package contribution metadata/module keys sufficient for
  PRD106B Page Composer consumption; PRD106B proves actual Page Composer
  behavior.
- Shell Layout includes the shared `core-size` cluster between Header and
  widget-specific layout controls.
- Bob renders Core div sizing with `uiLabels.core.sizeCluster`; the word
  "Core" does not appear in user-facing Bob labels.
- Widget specs provide `uiLabels.core.*` and `coreSize.*` defaults.
- Widget Core validation rejects duplicate Header/CTA/Stage/Pod/layout
  taxonomies and duplicate Core div sizing paths.
- Shell output marks stable root, Shell CSS/runtime modules, Core CSS/runtime
  modules, instance identity, and per-instance runtime payload without requiring
  Page Composer implementation inside A2.
- Countdown and Logo Showcase PRDs can be written as Core rebase work instead
  of full widget architecture rewrites.
- Active docs no longer tell agents to copy FAQ architecture into each widget.

## OPEN QUESTIONS (BLOCKERS) FOR PIETRO, PRODUCT OWNER

None currently. The product decision is made: FAQ is the proof, the Shell
becomes `packages/widget-shell/`, widgets contribute bodies, and Tokyo stores
artifacts only.
