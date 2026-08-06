# Countdown Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Countdown renders date, personal, or number countdown/counter behavior. Runtime
reads and validates its generated behavior settings and binds the clock/number
behavior to the generated markup.

## Source

```text
tokyo/product/widgets/countdown/
```

Files:

```text
spec.json
editable-fields.json
limits.json
index.html
styles.css
runtime.js
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
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
```

## Runtime Notes

Web Code Generator writes the complete timer, number, and action markup.
`runtime.js` registers the Countdown initializer and updates the generated
timer/number/action values. Personal countdown storage requires an instance id.

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

`runtime.js` registers as `countdown` through `CKWidgetRuntime`, resolves the
required generated hooks, and binds timer behavior. It does not accept generic
state updates or render the initial customer content.

Runtime failure rules:

- Date mode requires exact ISO `YYYY-MM-DDTHH:MM(:SS)` target date shape.
- Timezone is `browser`, `UTC`, or a value accepted by `Intl.DateTimeFormat`.
  `browser` interprets the authored target date in the visitor's local timezone.
- Personal mode uses `localStorage` keyed by the runtime instance id and fails
  when storage is unavailable or stored state is corrupt.
- Runtime rejects unknown timer mode, time format, after-timer action, personal
  duration unit/repeat, and missing/non-numeric generated number settings.

Appearance state includes timer style, time format, labels, separator, text
color, item background, and card-wrapper radius/border/shadow.

## Shell Utilities

Countdown uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher. Timer tile surfaces
are Core-owned under `countdown.appearance.*`.

## Verification

```bash
pnpm validate:widgets
```
