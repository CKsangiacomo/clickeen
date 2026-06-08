# PRD106C6_CTA_Widget

Status: Implemented through PRD106A2 Step 4; keep as CTA acceptance spec
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.4
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: CTA widget instances for PRD106D route migration.
Authority owned by this PRD: historical CTA acceptance; final authority is
`calltoaction.*` Core defaults, package proof, and validation.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Split, Cards, Big Bang, Prague route cutover.

## PRD106 Closure Note

This historical PRD predates the final PRD106 naming correction. The surviving
widget type is `calltoaction`, not generic `cta`, and the widget has
widget-specific Core state under `calltoaction.*`. Shared Header action state is
Shell-owned as `headerCta.*` with appearance at `appearance.headerCta.*`. Do not
copy historical Header CTA, private CTA, or Shell-only body language as current
architecture.

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
3. Confirm PRD106C assigns `cta-bottom-block` behavior to this PRD.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A2 | Shared Widget Shell package accepted. | REQUIRED |
| PRD106C | CTA target and Prague source scope accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
No current executable step. Historical CTA was replaced by the surviving
`calltoaction` widget with widget-specific Core state.
```

Green evidence:

- Call to Action uses shared Shell state plus widget-specific `calltoaction.*`
  Core state.
- Header/Header CTA/Stage/Pod are all Shell-owned.
- Call to Action body controls live under `calltoaction.*`.
- Existing CTA root `title`, `body`, `primaryCta`, `secondaryCta`, and
  private `layout.*` paths were deleted/rebased.
- "Bottom" remains page placement, not widget identity.
- Bob/Roma typechecks passed.
- `pnpm validate:widgets` passed.
- Call to Action compile/materialization smoke passed with Shell controls plus
  `calltoaction.*` Core DOM.

Stop conditions:

- Call to Action introduces root CTA/copy paths outside `calltoaction.*`.
- CTA adds page-placement logic to widget state.
- CTA keeps a compatibility mapper, legacy state normalizer, local Shell copy,
  second CTA support, or CTA-specific placement/variant model.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Confirm Call to Action Core contract. | State/control table and old-state deletion list. | Body state lives under `calltoaction.*`; old CTA paths are deleted/rebased, not bridged. | Root CTA/copy path, compatibility mapper, or legacy state normalizer appears. |
| 2 | Build Call to Action defaults. | Spec/Core diff with account Shell defaults and `calltoaction.*` Core defaults. | Non-empty Header/Header CTA and body action defaults compile. | Blank scaffold, duplicate Shell paths, or fake Shell-owned body sizing. |
| 3 | Build/verify Core package. | Preview/package evidence. | Call to Action renders Shell plus `.ck-calltoaction__body` from `calltoaction.*`. | Widget bypasses Shell or retains private CTA DOM/runtime. |
| 4 | Validate editable fields. | Editable-fields diff/tests. | Shell Header/Header CTA fields plus `calltoaction.*` body fields exist. | Old `primaryCta`/`secondaryCta` fields appear. |
| 5 | Verify product discovery and Bob/Roma materialization. | Regenerated widget source evidence, compile/save/package evidence. | `calltoaction` remains reachable through widget code `CTA` and package is Shell plus widget Core. | Missing source regeneration, duplicate Shell code, or stale old CTA path still compiles. |

## Implementation Evidence

Implemented by commit scope under PRD106A2 Step 4.

Changed files:

- `tokyo/product/widgets/calltoaction/spec.json`
- `tokyo/product/widgets/calltoaction/editable-fields.json`
- `tokyo/product/widgets/calltoaction/widget.html`
- `tokyo/product/widgets/calltoaction/widget.css`
- `tokyo/product/widgets/calltoaction/widget.client.js`

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

Compile/materialization smoke output:

```json
{
  "widget": "calltoaction",
  "panels": ["content", "typography", "layout", "appearance", "settings"],
  "controls": 125,
  "shellControls": ["header.title", "headerCta.label"],
  "stylesBytes": 13520,
  "runtimeBytes": 110815
}
```

## Purpose

Finish the surviving `calltoaction` widget that absorbs Prague
`cta-bottom-block`.

Call to Action uses the shared Widget Shell extracted from FAQ:

```text
Stage -> Pod -> ck-headerLayout(Header + Call to Action Core)
```

Call to Action consumes the shared Header, Header CTA, Stage/Pod, Appearance,
Typography, Settings, locale, runtime, and editable-fields mechanisms from
`packages/widget-shell/`. Its widget-specific body/action state lives under
`calltoaction.*`.

"Bottom" is page placement, not widget identity. Page Composer decides where a
CTA instance sits.

CTA is not a compatibility bridge for the current old CTA source. Existing
`title`, `body`, `primaryCta`, `secondaryCta`, private `layout.*`, private CTA
DOM, and private CTA runtime are drift to delete/rebase, not a state model to
preserve.

## Prague Evidence

Prague `cta-bottom-block` renders:

- centered Header title;
- Header subtitle;
- CTA button;
- clean section surface.

## Target Files

Surviving widget source:

- `tokyo/product/widgets/calltoaction/spec.json`
- `tokyo/product/widgets/calltoaction/editable-fields.json`
- `tokyo/product/widgets/calltoaction/limits.json`
- `tokyo/product/widgets/calltoaction/widget.html`
- `tokyo/product/widgets/calltoaction/widget.css`
- `tokyo/product/widgets/calltoaction/widget.client.js`

Also regenerate existing widget discovery source after the CTA rebase:

- `tokyo-worker/src/generated/widget-definition-sources.ts`

CTA already owns the product-approved `CTA` overlay code in
`packages/ck-contracts/src/overlay-codebooks.ts`; keep that code. Do not create
a new widget code or rename the widget to `bottom-cta`.

## Instance Shape

Call to Action uses the shared Widget Shell state:

- `header.*`
- `headerCta.*`
- `stage.*`
- `pod.*`
- `appearance.headerCta.*`
- `localeSwitcher.*`
- `appearance.localeSwitcher*`
- `typography.*`
- `behavior.showBacklink`
- `behavior.socialShare.enabled`

Call to Action-specific Core state:

```text
calltoaction.showEyebrow
calltoaction.eyebrow
calltoaction.headline
calltoaction.showSupportingText
calltoaction.supportingTextHtml
calltoaction.action.*
calltoaction.layout.*
calltoaction.actionStyle.*
```

Imported Shell controls are exactly the PRD106A2 Widget Shell controls. Do not
add root `copy`, `button`, `ctaText`, `primaryCta`, `secondaryCta`,
`layout.maxWidth`, `layout.bodyWidth`, or `layout.gap`.

Call to Action still renders a Shell Core div because every Shell widget has
one. Core-size remains Shell-owned through `coreSize.*`; Call to Action body
layout and action styling live under `calltoaction.*`.

Existing account/dev CTA instances that still use old `title`, `body`,
`primaryCta`, `secondaryCta`, or private `layout.*` state are invalid after this
rebase. Regenerate or reset current dev/starter data through the real product
path. Do not silently heal those old paths into the new CTA shape.

## Defaults

Required defaults:

- `header.enabled`: `true`
- `header.title`: "Build your next section in minutes"
- `header.showSubtitle`: `true`
- `header.subtitleHtml`: "Start with a polished Clickeen widget, customize it in Builder, and publish it anywhere your site needs it."
- `header.placement`: `top`
- `header.alignment`: `center`
- `header.ctaPlacement`: `below`
- `headerCta.enabled`: `true`
- `headerCta.label`: "Get started"
- `headerCta.href`: "#"
- `uiLabels.core.singular`: "Call to Action"
- `uiLabels.core.plural`: "Call to Action"
- `uiLabels.core.sizeCluster`: "Call to Action size"
- `coreSize.mode`: `auto`
- `coreSize.minHeight`: `0`
- `coreSize.preferredVw`: `0`
- `coreSize.maxHeight`: `0`
- `coreSize.fixedHeight`: `0`
- `calltoaction.showEyebrow`: `true`
- `calltoaction.eyebrow`: useful non-empty eyebrow text
- `calltoaction.headline`: useful non-empty body headline
- `calltoaction.showSupportingText`: `true`
- `calltoaction.supportingTextHtml`: useful non-empty body copy
- `calltoaction.action.enabled`: `true`
- `calltoaction.action.label`: useful non-empty body action label

No default visible string may be empty.

## Bob Panels And Controls

### Content Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header | Shared Header content | shared `header-content` | shared | Widget Shell package. |
| Call to Action | Eyebrow/headline/copy/action content | `calltoaction.*` | widget Core | Body content belongs to the widget-specific namespace. |

### Layout Panel

| Cluster | Control | Path | Type | Values / bounds | Why |
| --- | --- | --- | --- | --- | --- |
| Header | Shared Header layout | shared `header-layout` | shared | Widget Shell package. |
| Shared | Stage/Pod layout | shared `stagepod-layout` | shared | Widget Shell package. |
| Call to Action | Body layout | `calltoaction.layout.*` | widget Core | Body alignment, width, and spacing are widget-owned. |

### Appearance Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header CTA | Shared Header CTA appearance | shared `header-appearance` | shared | Widget Shell package. |
| Shared | Stage/Pod appearance | shared `stagepod-appearance` | shared | Widget Shell package. |
| Call to Action | Body action appearance | `calltoaction.actionStyle.*` | widget Core | Body action styling is not the Shell Header CTA. |

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
| `body` | Header subtitle |
| `button` | Header CTA and body action labels |
| `eyebrow` | Call to Action eyebrow |

## Editable Fields

`editable-fields.json` must include:

- `header.title`
- `header.subtitleHtml`
- `headerCta.label`
- `calltoaction.eyebrow`
- `calltoaction.headline`
- `calltoaction.supportingTextHtml`
- `calltoaction.action.label`

## Acceptance

- Fresh Call to Action instance renders non-blank output.
- Call to Action is implemented as Widget Shell plus `calltoaction.*` Widget
  Core.
- Prague `cta-bottom-block` can be represented by Call to Action.
- The widget name and controls do not include page-placement language such as "bottom".
- Call to Action does not define duplicate Header/Header CTA/Stage/Pod Shell
  state.
- Existing old CTA root paths `title`, `body`, `primaryCta`, `secondaryCta`,
  and private `layout.*` do not compile as product-valid CTA state after the
  rebase.
- Call to Action does not include a compatibility mapper, legacy normalizer, page
  placement enum, CTA variant model, action group model, second CTA support, or
  Prague block adapter.
- Call to Action DOM uses shared `.ck-headerLayout`, direct `.ck-header`, and
  widget-owned `.ck-calltoaction__body`; retained old private CTA DOM such as
  `.ck-cta__title`, `.ck-cta__body`, or `.ck-cta__actions` fails this PRD.
- Call to Action keeps existing product discovery via the `CTA` widget code and
  regenerated widget definition source evidence.
- Bob exposes the controls above with correct paths and show/hide behavior.
- CTA materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two CTA instances on one composed page do not collide in CSS/runtime; this is
  required instance-scope evidence, not visual QA.
