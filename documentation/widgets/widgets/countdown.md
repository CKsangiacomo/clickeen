# Countdown Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Countdown renders date, personal, or number countdown/counter behavior. Runtime
validates deterministic timer configuration and fails fast on invalid timer
state.

## Source

```text
tokyo/product/widgets/countdown/
```

Files:

```text
spec.json
editable-fields.json
limits.json
countdown_tooldrawer_l10n_labels/
  en.json
widget.html
widget.css
widget.client.js
```

Countdown has no widget-local runtime files outside the canonical six files;
its adjacent English label file is compiler input, not runtime code.

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `countdown` |
| display name | Countdown |
| Core namespace | `countdown.*` |
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

Core defaults live under:

```text
countdown
typography
uiLabels
```

Core state families:

```text
countdown.actions
countdown.appearance
countdown.timer
```

## Editor Composition

Content presents the three existing timer jobs first: fixed Date, visitor-relative
Countdown, and Number counter. The remaining sections are mode-specific and keep
the existing timer, unit-label, during-action, and after-action paths unchanged.
The Header and primary Content sections are initially open; all other sections are
collapsed.

Layout is composed entirely from the shared Header, Countdown area, Pod, and
Stage controls. Appearance exposes Timer display only for Date and Countdown
modes. Display surface is available for the Number counter and for separated
Date/Countdown tiles. Visible timer-value and unit-label colors are owned by
their exact Typography roles; Appearance does not expose a duplicate color
control.

Typography exposes `Timer values` and `Unit labels`. Settings remains the shared
locale-switcher, branding, and social-share composition.

Countdown declares complete `label` and `timer` typography roles, including
explicit normal tracking and line-height presets. Runtime does not infer those
values when state is incomplete.

## Editable Fields

```text
header.title
header.subtitleHtml
countdown.timer.labels.days
countdown.timer.labels.hours
countdown.timer.labels.minutes
countdown.timer.labels.seconds
headerCta.label
countdown.actions.during.text
countdown.actions.after.text
```

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Runtime Notes

`widget.client.js` validates state, resolves required Countdown DOM hooks,
applies shared widget utilities, and updates timer/number/action DOM. Personal
countdown storage requires an instance id.

Timer modes:

```text
date
personal
number
```

Mode-specific state:

```text
date -> countdown.timer.targetDate, countdown.timer.timezone
personal -> countdown.timer.timeAmount, countdown.timer.timeUnit, countdown.timer.repeat
number -> countdown.timer.targetNumber, countdown.timer.startingNumber, countdown.timer.countDuration
```

Runtime requires these Core DOM hooks:

```text
[data-role="countdown"]
[data-role="countdown-core"]
[data-role="timer"]
[data-role="number-display"]
[data-role="number-value"]
[data-role="units-display"]
[data-role="cta"]
[data-role="after-message"]
[data-role="after-link"]
```

`widget.client.js` registers as `countdown`, validates `countdown.*`, validates
date/timezone/action URL state, applies shared widget utilities, and binds
`ck:state-update` for the current instance id.

The DOM resolver is part of `widget.client.js`. Do not reintroduce
`widget.dom.js` or another widget-local runtime helper.

Timer failure rules:

- Date mode requires exact ISO `YYYY-MM-DDTHH:MM(:SS)` target date shape.
- Timezone is a valid IANA timezone or `browser`.
- Personal mode uses `localStorage` keyed by the runtime instance id and fails
  when storage is unavailable or stored state is corrupt.
- During-action URL accepts empty, `#`, root-relative, `http(s)`, `mailto`, or
  `tel`.
- Finished-action link requires valid text and URL when
  `countdown.actions.after.type` is `link`.

Appearance state includes timer style, time format, labels, separator, text
color, item background, and card-wrapper radius/border/shadow.

The static package keeps customer-text hooks empty and the Header/timer hidden
until exact saved state is applied. Timer values and separators use the complete
Timer typography role; unit labels use the complete Unit labels role without a
second color transformation.

The timer owns its responsive presentation through a local inline-size
container inside the existing Pod boundary. A complete wide row keeps the
chosen separators. Narrow rows remove
standalone separators and compose tiles in two columns, then one column when the
available width cannot hold two tiles. Hidden Days never leaves a leading
separator. Long numeric values and localized labels remain complete and wrap
inside the available surface instead of widening the page.

## Shared Widget Utilities

Countdown uses the presentation frame for Stage/Pod, the Shell for Header/Core
composition, and shared utilities for Core sizing, typography, branding,
social share, and locale switching. Timer tile surfaces are Core-owned under
`countdown.appearance.*`.

## Verification

```bash
pnpm validate:widgets
```
