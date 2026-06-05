# PRD106C5_BigBang_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.3
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: Big Bang widget instances for PRD106D route migration.
Authority owned by this PRD: Big Bang widget Core state, controls, defaults, DOM, CSS, runtime, and editable fields.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Split, Cards, CTA, Prague route cutover.

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
3. Confirm PRD106C assigns `big-bang` behavior to this PRD.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | REQUIRED |
| PRD106C | Big Bang target and Prague source scope accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Define Big Bang Core contract.
```

Required evidence before marking green:

- Big Bang Core paths are listed.
- Header remains `header.*`/`cta.*`.
- Prague statement/supporting copy maps to Core paths.

Stop conditions:

- Big Bang introduces `headline`, root `supportingCopy`, `primaryCta`, or
  alternate Header/CTA paths.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define Big Bang Core contract. | State/control/editable-field table. | Only `bigBang.*` Core paths are added. | Duplicate Header/CTA path appears. |
| 2 | Build Big Bang defaults and controls. | Spec/Core diff. | Non-empty editorial defaults compile. | Blank scaffold or root headline path. |
| 3 | Build Big Bang DOM/CSS/runtime Core. | Diff and preview evidence. | Large text renders inside `.ck-headerLayout__body`. | Core bypasses Shell. |
| 4 | Validate translation/editable fields. | Editable-fields diff/tests. | Concrete Core text paths translate. | Core text omitted from editable fields. |
| 5 | Verify Bob/Roma materialization. | Compile/save/package evidence. | Big Bang package is Shell plus Core. | Duplicate Shell code appears. |

## Purpose

Build the surviving `big-bang` widget that absorbs Prague `big-bang`.

Big Bang uses the shared Widget Shell extracted from FAQ:

```text
Stage -> Pod -> ck-headerLayout(Header + Big Bang Core)
```

Big Bang is not a new editor architecture. It is the shared Widget Shell with a
large typography/content treatment added as the Widget Core.

Header still means title, optional subtitle, and optional CTA through
`header.*` and `cta.*`. Big Bang's special value is the large editorial content
inside `.ck-headerLayout__body`.

## Implementation Base

Consume `packages/widget-shell/`. The package owns:

- `header.*`
- `cta.*`
- `stage.*`
- `pod.*`
- shared `header-content`
- shared `header-layout`
- shared `header-appearance`
- shared `stagepod-layout`
- shared `stagepod-appearance`
- standardized `typography`
- locale switcher pattern
- branding/settings placement
- `editable-fields.json` translation mechanism

Do not carry FAQ-specific sections, Q/A manager, accordion/list/multicolumn
runtime, FAQ deep links, FAQ question/answer paths, or FAQ item controls.

## Prague Evidence

Prague `big-bang` proves the desired visual outcome:

- a large editorial statement;
- optional supporting copy;
- optional CTA through the shared Header CTA;
- strong surface/background;
- large vertical rhythm.

## Target Files

Create:

- `tokyo/product/widgets/big-bang/spec.json`
- `tokyo/product/widgets/big-bang/editable-fields.json`
- `tokyo/product/widgets/big-bang/limits.json`
- `tokyo/product/widgets/big-bang/widget.html`
- `tokyo/product/widgets/big-bang/widget.css`
- `tokyo/product/widgets/big-bang/widget.client.js`

## Instance Shape

Shell state comes from `packages/widget-shell/`. Big Bang-specific state:

| Path | Owner | Meaning |
| --- | --- | --- |
| `bigBang.statement` | content | Main large editorial text. |
| `bigBang.supportingCopy` | content | Optional supporting copy inside the Big Bang Core. |
| `bigBang.showSupportingCopy` | config | Shows/hides supporting copy. |
| `bigBang.alignment` | config | `left`, `center`. |
| `bigBang.textWidth` | config | Text measure for the large Big Bang Core. |
| `bigBang.gap` | config | Gap inside the Big Bang Core. |

Do not add `headline`, `supportingCopy` at root, `primaryCta`,
`secondaryCta`, `layout.maxWidth`, `layout.textWidth`, `layout.alignment`,
`layout.gap`, or `appearance.tone`. Header/CTA belongs to the Widget Shell;
outer width/surface belongs to Stage/Pod.

## Defaults

Required defaults:

- `bigBang.statement`: "Make the important message impossible to miss."
- `bigBang.showSupportingCopy`: `true`
- `bigBang.supportingCopy`: "Use a Big Bang section when a page needs one bold statement with enough rhythm to stop the scroll."
- `bigBang.alignment`: `left`
- `header.enabled`: `true`
- `header.title`: "Big announcement"
- `header.showSubtitle`: `false`
- `header.placement`: `top`
- `header.alignment`: `left`
- `cta.enabled`: `true`
- `cta.label`: "Start now"
- `cta.href`: "#"

No default visible string may be empty.

## Bob Panels And Controls

### Content Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header | Shared Header content | shared `header-content` | shared | Widget Shell package. |
| Big Bang content | Statement | `bigBang.statement` | `textedit` | Main authored typography content. |
| Big Bang content | Show supporting copy | `bigBang.showSupportingCopy` | `toggle` | Controls supporting copy visibility. |
| Big Bang content | Supporting copy | `bigBang.supportingCopy` | `textedit` | Shown when enabled. |

### Layout Panel

| Cluster | Control | Path | Type | Values / bounds | Why |
| --- | --- | --- | --- | --- | --- |
| Header | Shared Header layout | shared `header-layout` | shared | Widget Shell package. |
| Big Bang layout | Alignment | `bigBang.alignment` | `choice-tiles` | `left`, `center` | Controls editorial posture inside the Big Bang Core. |
| Big Bang layout | Text width | `bigBang.textWidth` | `valuefield` | 480-1280, step 10 | Prevents unreadable long lines. |
| Big Bang layout | Gap | `bigBang.gap` | `valuefield` | 8-80, step 2 | Internal Big Bang content spacing. |
| Shared | Stage/Pod layout | shared `stagepod-layout` | shared | Widget Shell package. |

### Appearance Panel

| Cluster | Control | Path | Type | Values | Why |
| --- | --- | --- | --- | --- | --- |
| Header CTA | Shared Header CTA appearance | shared `header-appearance` | shared | Widget Shell package. |
| Shared | Stage/Pod appearance | shared `stagepod-appearance` | shared | Widget Shell package. |

Behavior toggles stay in Settings, matching FAQ.

### Settings Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Clickeen Branding | Show Made with Clickeen | `behavior.showBacklink` | `toggle` | Existing widget behavior. |
| Clickeen Branding | Enable social share | `behavior.socialShare.enabled` | `toggle` | Existing widget behavior. |

### Typography Panel

Required typography roles:

| Role | Applies to |
| --- | --- |
| `title` | Header title |
| `body` | Header subtitle and Big Bang supporting copy |
| `bigBang` | Big Bang statement |
| `button` | CTA labels |

The `bigBang` typography role must default larger than the Header `title` and
CTA `button` roles.

## Editable Fields

`editable-fields.json` must include:

- `bigBang.statement`
- `bigBang.supportingCopy`
- `cta.label`

## Acceptance

- Fresh Big Bang instance renders non-blank high-emphasis typography.
- Big Bang is implemented as Widget Shell package plus Big Bang content.
- Big Bang does not bypass Header/CTA/Stage/Pod shell controls.
- Old root `headline`, root `supportingCopy`, `appearance.tone`, and
  `layout.*` Big Bang paths do not ship.
- Bob exposes the controls above with correct paths and show/hide behavior.
- Big Bang materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two Big Bang instances on one composed page do not collide in CSS/runtime.
