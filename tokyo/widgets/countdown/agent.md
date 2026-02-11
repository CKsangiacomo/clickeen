# Countdown Widget (Agent Contract)

## Identity
- `widgetname`: `countdown`
- Root element: `[data-ck-widget="countdown"]`
- Main element: `[data-role="countdown"]`
- Scope rule: query parts within widget root only (no global selectors for internals)

## State Encoding (DOM `data-*`)
Set on `[data-role="countdown"]`:
- `data-mode`: `date` | `personal` | `number` (`timer.mode`)
- `data-layout-position`: `inline` | `full-width` | `top-bar` | `bottom-bar` | `static-top` (`layout.position`)
- `data-layout-align`: `left` | `center` | `right` (derived from `stage.alignment`)
- `data-animation`: `fade` (`appearance.animation`)

Set by shared Header primitive (`tokyo/widgets/shared/header.js`):
- On `.ck-headerLayout`: `data-has-header`, `data-header-placement`
- On `.ck-header`: `data-align`, `data-cta-placement`

Set by shared Stage/Pod primitive (`tokyo/widgets/shared/stagePod.js`):
- On `.stage`: `data-stage-floating`, `data-stage-floating-anchor`, `data-stage-floating-offset`

## Parts (query within root)
- Main: `[data-role="countdown"]`
- Header layout: `.ck-headerLayout` (same node as main)
- Header: `.ck-header`
  - Title: `[data-role="header-title"]`
  - Subtitle: `[data-role="header-subtitle"]`
  - Header CTA: `[data-role="header-cta"]`
- Countdown body: `.ck-countdown__body.ck-headerLayout__body`
- Timer container: `[data-role="timer"]`
- Units display: `[data-role="units-display"]`
  - Unit tile: `[data-role="unit"][data-unit="days|hours|minutes|seconds"]`
    - Value: `[data-role="value"]`
    - Label: `[data-role="label"]`
  - Separator: `[data-role="separator"]`
- Number display: `[data-role="number-display"]`
  - Number value: `[data-role="number-value"]`
- During CTA: `[data-role="cta"]`
- After message: `[data-role="after-message"]`
  - After link: `[data-role="after-link"]`

## Editable Schema (high-signal)
Header/CTA (shared):
- `header.enabled`, `header.title`, `header.showSubtitle`, `header.subtitleHtml`
- `header.alignment` (`left|center|right`)
- `header.placement` (`top|bottom|left|right`)
- `header.ctaPlacement` (`right|below`)
- `header.gap`, `header.textGap`, `header.innerGap`
- `cta.enabled`, `cta.label`, `cta.href`, `cta.openMode`, `cta.iconEnabled`, `cta.iconName`, `cta.iconPlacement`

Timer:
- `timer.mode`: `date` | `personal` | `number`
- Date mode: `timer.targetDate`, `timer.timezone`
- Personal mode: `timer.timeAmount`, `timer.timeUnit`, `timer.repeat`
- Number mode: `timer.startingNumber`, `timer.targetNumber`, `timer.countDuration`
- Unit labels: `timer.labels.days`, `timer.labels.hours`, `timer.labels.minutes`, `timer.labels.seconds`

Actions:
- Running CTA: `actions.during.type|url|text|style|newTab`
- End state: `actions.after.type|url|text`

Layout/Appearance:
- `layout.position`
- `stage.floating.enabled`, `stage.floating.anchor`, `stage.floating.offset` (shared global floating utility; opt-in per widget)
- `appearance.theme`, `appearance.animation`, `appearance.textColor`, `appearance.itemBackground`, `appearance.separator`
- `appearance.cardwrapper.*`, `appearance.podBorder`
- Header CTA appearance: `appearance.ctaBackground`, `appearance.ctaTextColor`, `appearance.ctaBorder`, `appearance.ctaRadius`, `appearance.ctaSizePreset`, `appearance.ctaPaddingLinked`, `appearance.ctaPaddingInline`, `appearance.ctaPaddingBlock`, `appearance.ctaIconSizePreset`, `appearance.ctaIconSize`

Behavior/Settings:
- `behavior.showBacklink`
- `seoGeo.enabled`
- `seo.enableSchema`, `seo.canonicalUrl`, `geo.enableDeepLinks`

Shared primitives:
- `stage.*`, `pod.*` via `CKStagePod.applyStagePod`
- `typography.*` via `CKTypography.applyTypography`

## Runtime Contract
- `applyState(state)` is deterministic and does not create timers itself.
- Scheduler/ticking:
  - `date`/`personal`: 1-second interval updates units and phase.
  - `number`: `requestAnimationFrame` updates number.
- Header is applied by `CKHeader.applyHeader(state, widgetRoot)`.
- During CTA (`actions.during.*`) is shown only when URL is valid.
- End behavior (`actions.after.*`):
  - `hide`: hide stage
  - `link`: show after-message only when URL is valid
- Floating layout is handled globally by `CKStagePod` via `stage.floating.*` when the widget opts in.
- `appearance.separator` updates all `[data-role="separator"]` text.
- Card wrapper controls are applied by `CKSurface.applyCardWrapper(state.appearance.cardwrapper, countdownRoot)`.

## Messages
- Accept `ck:state-update`: `{ type, widgetname: 'countdown', state }`

## Allowlists
Only write content paths allowed by:
- `tokyo/widgets/countdown/localization.json`
- `tokyo/widgets/countdown/layers/user.allowlist.json`
- `tokyo/widgets/countdown/sdr.allowlist.json`

Forbidden path segments remain prohibited: `__proto__`, `constructor`, `prototype`.
