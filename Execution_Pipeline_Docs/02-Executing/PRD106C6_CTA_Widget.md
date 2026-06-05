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
- "Bottom" is confirmed as page placement, not widget identity.

Stop conditions:

- CTA introduces root CTA/copy paths.
- CTA adds page-placement logic to widget state.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Confirm CTA empty-Core contract. | State/control table. | No Core state beyond Shell. | Root CTA/copy path appears. |
| 2 | Build CTA defaults. | Spec/Core diff. | Non-empty Header/CTA defaults compile. | Blank scaffold or duplicate Shell paths. |
| 3 | Build/verify empty Core package. | Preview/package evidence. | CTA renders as Header-only Shell. | Widget bypasses Shell. |
| 4 | Validate editable fields. | Editable-fields diff/tests. | Only Shell Header/CTA fields exist. | Extra CTA Core fields appear. |
| 5 | Verify Bob/Roma materialization. | Compile/save/package evidence. | CTA package is Shell plus empty Core. | Duplicate Shell code appears. |

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
- Bob exposes the controls above with correct paths and show/hide behavior.
- CTA materializes to `index.html`, `styles.css`, and `runtime.js`.
- Two CTA instances on one composed page do not collide in CSS/runtime.
