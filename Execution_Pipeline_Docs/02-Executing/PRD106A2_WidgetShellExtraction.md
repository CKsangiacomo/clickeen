# PRD106A2_WidgetShellExtraction

Status: Draft execution PRD
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
| PRD106A | Drift affecting Shell extraction is audited or fenced. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Extract and prove the FAQ Shell inventory.
```

Required evidence before marking green:

- `file:line` inventory of FAQ Shell source files.
- Explicit list of Shell-owned paths.
- Explicit list of FAQ Core paths excluded from Shell.

Stop conditions:

- A shared control cannot be traced to FAQ's working implementation.
- A path is ambiguous between Shell and Core ownership.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Extract and prove FAQ Shell inventory. | `file:line` source inventory; path ownership list. | Shell/Core boundary is explicit. | Any path ownership is ambiguous. |
| 2 | Create `packages/widget-shell/` contract surface. | Diff showing package files and exported responsibilities. | Package owns contract/defaults/controls/render/runtime/css/validators. | Package starts owning Widget Core behavior. |
| 3 | Rebase FAQ onto shared Shell with no behavior change. | Diff plus FAQ compile/render/save evidence. | FAQ output remains gold standard. | FAQ behavior changes outside intentional package import. |
| 4 | Prove Core extension with CTA. | CTA diff plus compile/render evidence. | CTA is Shell plus empty Core. | CTA defines duplicate Shell paths. |
| 5 | Prove Core extension with one non-trivial widget. | Split or Cards diff plus compile/render evidence. | Core contributes only Core state/controls/runtime. | Core redefines Header/CTA/Stage/Pod. |
| 6 | Add validation/search guards. | Tests or `rg` guard output. | Forbidden duplicate paths fail. | Guards allow copied Shell logic. |

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
cta.*
stage.*
pod.*
appearance.cta*
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

cta.enabled
cta.label
cta.href
cta.openMode
cta.iconEnabled
cta.iconPlacement
cta.iconName
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
| `cta.enabled` | toggle | Show/hide CTA. |
| `cta.label` | textfield | CTA label. |
| `cta.href` | textfield | CTA target URL. |
| `cta.openMode` | dropdown-actions | Same tab/new tab/new window. |
| `cta.iconEnabled` | toggle | Show/hide CTA icon. |
| `cta.iconPlacement` | dropdown-actions | Left/right. |
| `cta.iconName` | dropdown-actions | Approved icon choices. |

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

CTA appearance controls:

| Path | Control | Meaning |
| --- | --- | --- |
| `appearance.ctaSizePreset` | dropdown-actions | CTA size preset. |
| `appearance.ctaPaddingLinked` | toggle | Link CTA padding. |
| `appearance.ctaPaddingInline` | valuefield | Inline CTA padding. |
| `appearance.ctaPaddingBlock` | valuefield | Block CTA padding. |
| `appearance.ctaBackground` | dropdown-fill | CTA background. |
| `appearance.ctaTextColor` | dropdown-fill | CTA text color. |
| `appearance.ctaBorder` | dropdown-border | CTA border. |
| `appearance.ctaRadius` | dropdown-actions | CTA corner radius. |
| `appearance.ctaIconSizePreset` | dropdown-actions | CTA icon size preset. |
| `appearance.ctaIconSize` | valuefield | Custom CTA icon size. |

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
- `cta.*`
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
| CTA | no Core state. |
| Big Bang | `bigBang.*`. |

## Editable Fields

The Shell contributes only shared Header/CTA editable fields:

```text
header.title
header.subtitleHtml
cta.label
```

Widget Cores contribute their Core text fields:

```text
FAQ: sections[].title, sections[].faqs[].question, sections[].faqs[].answer
Cards: items[].title, items[].body, items[].ctaLabel
Split: image/video alt text
Big Bang: bigBang.statement, bigBang.supportingCopy
Countdown: countdown labels and expired copy
Logo Showcase: logo captions/alt text if visible/editable
CTA: none beyond Shell Header/CTA
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

## Execution Sequence

1. Create `packages/widget-shell/`.
2. Move or wrap existing shared Bob compiler modules for Header, Stage/Pod, and
   Typography under the package boundary.
3. Move or wrap shared runtime/CSS helpers under the package boundary while
   preserving package output bytes for FAQ.
4. Define Shell defaults and validation from FAQ's working shared state.
5. Rebase FAQ onto `packages/widget-shell/` with no user-visible behavior
   change.
6. Add parity tests proving FAQ preview/materialization output still compiles,
   renders, saves, and publishes.
7. Convert one simple Core widget, CTA, to prove empty-Core reuse.
8. Convert one non-trivial Core widget, Split or Cards, to prove Core
   extension.
9. Mark Countdown and Logo Showcase gold-standard repair as Shell rebase tasks.
10. Block new widget execution that does not consume `packages/widget-shell/`.

## Blast Radius

Expected touched areas:

- `packages/widget-shell/**`
- `bob/lib/compiler/modules/header.ts`
- `bob/lib/compiler/modules/stagePod.ts`
- `bob/lib/compiler/modules/typography.ts`
- `bob/lib/compiler/editor-contract.ts`
- `bob/lib/compiler.server.ts`
- `bob/lib/session/publicPackage.ts`
- `tokyo/product/widgets/shared/**`
- `tokyo/product/widgets/faq/**`
- `tokyo/product/widgets/cta/**`
- `tokyo/product/widgets/split/**` or `tokyo/product/widgets/cards/**`
- Page Composer package contribution tests
- Widget validation scripts

Do not move account-owned instance source or generated account artifacts in this
PRD. Tokyo/R2 paths remain unchanged.

## Acceptance

- `packages/widget-shell/` exists and is the named authority for shared widget
  architecture.
- FAQ consumes the shared Shell and has no user-visible regression.
- CTA consumes the shared Shell with an empty Core.
- One non-trivial Core widget consumes the shared Shell.
- Bob preview, Roma materialization, and Page Composer package input use the
  same Shell + Core contract.
- Shell Layout includes the shared `core-size` cluster between Header and
  widget-specific layout controls.
- Bob renders Core div sizing with `uiLabels.core.sizeCluster`; the word
  "Core" does not appear in user-facing Bob labels.
- Widget specs provide `uiLabels.core.*` and `coreSize.*` defaults.
- Widget Core validation rejects duplicate Header/CTA/Stage/Pod/layout
  taxonomies and duplicate Core div sizing paths.
- Page Composer can identify stable root, Shell CSS/runtime modules, Core
  CSS/runtime modules, instance identity, and per-instance runtime payload.
- Countdown and Logo Showcase PRDs can be written as Core rebase work instead
  of full widget architecture rewrites.
- Active docs no longer tell agents to copy FAQ architecture into each widget.

## OPEN QUESTIONS (BLOCKERS) FOR PIETRO, PRODUCT OWNER

None currently. The product decision is made: FAQ is the proof, the Shell
becomes `packages/widget-shell/`, widgets contribute bodies, and Tokyo stores
artifacts only.
