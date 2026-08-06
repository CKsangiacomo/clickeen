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
widget.html
widget.css
widget.client.js
```

Countdown has no widget-local runtime files outside the six-file contract.

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `countdown` |
| display name | Countdown |
| Core namespace | `countdown.*` |
| `itemKey` | `countdown.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

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
applies shared Shell utilities, and updates timer/number/action DOM. Personal
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
date/timezone/action URL state, applies shared Shell utilities, and binds
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

## Shell Utilities

Countdown uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. Timer tile surfaces
are Core-owned under `countdown.appearance.*`.

## Clickeen Pages Usage

Countdown appears in Clickeen Page source as a saved account widget instance
placement. Timer runtime behavior belongs to the instance package served from
the account folder. Public page package serving depends on Roma writing real
page packages.

## Verification

```bash
pnpm validate:widgets
```
