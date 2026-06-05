# PRD106C6_CTA_Widget

Status: Draft execution PRD
Owner: Widget system + Bob
Date: 2026-06-05
Parent: `PRD106C_Prague astro blocks migration to widget instances.md`
Series step: 7.4
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C_Prague astro blocks migration to widget instances.md`
Unlocks: CTA widget instances for PRD106D route migration.
Authority owned by this PRD: CTA empty-Core defaults, package proof, and validation.
Authority explicitly not owned by this PRD: Widget Shell, Page Composer, Split, Cards, Big Bang, Prague route cutover.

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
Step 1: Confirm CTA empty-Core contract.
```

Required evidence before marking green:

- CTA adds no widget-specific state.
- Header/CTA/Stage/Pod are all Shell-owned.
- CTA-specific controls are none; imported controls are exactly the A2 Shell
  contract.
- Existing CTA root `title`, `body`, `primaryCta`, `secondaryCta`, and
  private `layout.*` paths are listed as delete/rebase targets.
- "Bottom" is confirmed as page placement, not widget identity.

Stop conditions:

- CTA introduces root CTA/copy paths.
- CTA adds page-placement logic to widget state.
- CTA keeps a compatibility mapper, legacy state normalizer, local Shell copy,
  second CTA support, or CTA-specific placement/variant model.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Confirm CTA empty-Core contract. | State/control table and old-state deletion list. | No Core state beyond Shell; old CTA paths are deleted/rebased, not bridged. | Root CTA/copy path, compatibility mapper, or legacy state normalizer appears. |
| 2 | Build CTA defaults. | Spec/Core diff with Shell defaults, `uiLabels.core.*`, and `coreSize.*`. | Non-empty Header/CTA defaults compile; empty Core sizing is Shell-owned auto/no-op. | Blank scaffold, duplicate Shell paths, or fake CTA body sizing. |
| 3 | Build/verify empty Core package. | Preview/package evidence. | CTA renders as Header-only Shell with empty `.ck-headerLayout__body`. | Widget bypasses Shell or retains private CTA DOM/runtime. |
| 4 | Validate editable fields. | Editable-fields diff/tests. | Only Shell Header/CTA fields exist. | Extra CTA Core fields or old `primaryCta`/`secondaryCta` fields appear. |
| 5 | Verify product discovery and Bob/Roma materialization. | Regenerated widget source evidence, compile/save/package evidence. | CTA remains reachable through existing `CTA` widget code and package is Shell plus empty Core. | Missing source regeneration, duplicate Shell code, or stale old CTA path still compiles. |

## Purpose

Finish the surviving `cta` widget that absorbs Prague `cta-bottom-block`.

CTA uses the shared Widget Shell extracted from FAQ:

```text
Stage -> Pod -> ck-headerLayout(Header + empty Core)
```

CTA is the Header-only case of the Widget Shell. It consumes the shared Header,
CTA, Stage/Pod, Appearance, Typography, Settings, locale, runtime, and
editable-fields mechanisms from `packages/widget-shell/`. Its Widget Core is
empty.

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

- `tokyo/product/widgets/cta/spec.json`
- `tokyo/product/widgets/cta/editable-fields.json`
- `tokyo/product/widgets/cta/limits.json`
- `tokyo/product/widgets/cta/widget.html`
- `tokyo/product/widgets/cta/widget.css`
- `tokyo/product/widgets/cta/widget.client.js`

Also regenerate existing widget discovery source after the CTA rebase:

- `tokyo-worker/src/generated/widget-definition-sources.ts`

CTA already owns the product-approved `CTA` overlay code in
`packages/ck-contracts/src/overlay-codebooks.ts`; keep that code. Do not create
a new widget code or rename the widget to `bottom-cta`.

## Instance Shape

CTA adds no widget-specific state. It uses the shared Widget Shell state:

- `header.*`
- `cta.*`
- `stage.*`
- `pod.*`
- `appearance.cta*`
- `localeSwitcher.*`
- `appearance.localeSwitcher*`
- `typography.*`
- `behavior.showBacklink`
- `behavior.socialShare.enabled`

CTA-specific controls:

```text
none
```

Imported controls are exactly the PRD106A2 Widget Shell controls. Do not add
`copy`, `button`, `ctaText`, `primaryCta`, `secondaryCta`, `layout.maxWidth`,
`layout.bodyWidth`, or `layout.gap`.

CTA still renders a Shell Core div because every Shell widget has one, but the
Core is empty. CTA inherits Shell `coreSize.*` defaults with `coreSize.mode =
auto`; any Core-size UI for CTA must be hidden or clearly Shell-owned/no-op. It
must not become fake CTA body sizing.

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
- `cta.enabled`: `true`
- `cta.label`: "Get started"
- `cta.href`: "#"
- `uiLabels.core.singular`: "CTA"
- `uiLabels.core.plural`: "CTAs"
- `uiLabels.core.sizeCluster`: "CTA size"
- `coreSize.mode`: `auto`
- `coreSize.minHeight`: `0`
- `coreSize.preferredVw`: `0`
- `coreSize.maxHeight`: `0`
- `coreSize.fixedHeight`: `0`

No default visible string may be empty.

## Bob Panels And Controls

### Content Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
| Header | Shared Header content | shared `header-content` | shared | Widget Shell package. |

### Layout Panel

| Cluster | Control | Path | Type | Values / bounds | Why |
| --- | --- | --- | --- | --- | --- |
| Header | Shared Header layout | shared `header-layout` | shared | Widget Shell package. |
| Shared | Stage/Pod layout | shared `stagepod-layout` | shared | Widget Shell package. |

### Appearance Panel

| Cluster | Control | Path | Type | Why |
| --- | --- | --- | --- | --- |
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
| `body` | Header subtitle |
| `button` | CTA labels |

## Editable Fields

`editable-fields.json` must include:

- `header.title`
- `header.subtitleHtml`
- `cta.label`

## Acceptance

- Fresh CTA instance renders non-blank output.
- CTA is implemented as Widget Shell package with empty Widget Core.
- Prague `cta-bottom-block` can be represented by CTA.
- The widget name and controls do not include page-placement language such as "bottom".
- CTA does not define duplicate Header/CTA/Stage/Pod shell state.
- Existing old CTA root paths `title`, `body`, `primaryCta`, `secondaryCta`,
  and private `layout.*` do not compile as product-valid CTA state after the
  rebase.
- CTA does not include a compatibility mapper, legacy normalizer, page
  placement enum, CTA variant model, action group model, second CTA support, or
  Prague block adapter.
- CTA DOM uses shared `.ck-headerLayout`, direct `.ck-header`, and an empty
  direct `.ck-headerLayout__body`; retained private CTA DOM such as
  `.ck-cta__title`, `.ck-cta__body`, `.ck-cta__actions`, or CTA-specific
  max/body width CSS fails this PRD.
- CTA keeps existing product discovery via the `CTA` widget code and regenerated
  widget definition source evidence.
- Bob exposes the controls above with correct paths and show/hide behavior.
- CTA materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two CTA instances on one composed page do not collide in CSS/runtime; this is
  required instance-scope evidence, not visual QA.
