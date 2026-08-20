# Countdown Widget

STATUS: CANONICAL CORE DEPLOYED — SHARED ARCHITECTURE GATES PASS

## Purpose

Countdown renders fixed-date, visitor-relative personal, or numeric countdown
behavior inside the shared Widget Shell.

## Architecture Status

Countdown uses the canonical Widget contract in cloud-dev. `widget.html`
composes shared Stage, Pod, Header, and shared capabilities with one Countdown
Core. `core/core.html` owns the complete initial timer, labels, and actions;
`core/core.css` owns Countdown presentation and its Timer/Unit label typography
roles; `core/core.js` owns only the changing timer, number, and finished-state
visitor behavior.

Bob preview and explicit allowed Publish use the same compiled Widget
software. Publish materializes the exact saved configuration and customer text
into semantic HTML and data attributes. Core JavaScript does not reconstruct
the saved state, localize content, invoke shared utilities, or receive Bob
state updates. There is no flat-source compatibility path or Widget-specific
shared-service branch.

The source, generated artifacts, and cloud-dev deploy proof are complete. The
agent-executed shared lifecycle, materialization, and serving gates pass. A
fresh per-Widget Republish is not a separate architecture-closure requirement.

## Source

```text
tokyo/product/widgets/countdown/
```

Files:

```text
spec.json
editable-fields.json
discovery.json
limits.json
labels/
  en.json
upsell/
  en.json
widget.html
core/
  core.html
  core.css
  core.js
```

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

Timer modes and their exact mode-specific state:

```text
date -> countdown.timer.targetDate, countdown.timer.timezone
personal -> countdown.timer.timeAmount, countdown.timer.timeUnit, countdown.timer.repeat
number -> countdown.timer.targetNumber, countdown.timer.startingNumber, countdown.timer.countDuration
```

The source contract authors date targets as ISO local date-time values and
timezones as `browser` or IANA identifiers. Personal duration/repeat values and
number duration are exact declared control options. Downstream materialization
and Core behavior trust that accepted saved state; they do not add a second
Widget-state validator or fallback table.

## Editor Composition

Content presents the three existing jobs first: fixed Date, visitor-relative
Countdown, and Number counter. Remaining sections are mode-specific and keep
the existing timer, unit-label, during-action, and after-action paths. Header
and primary Content start open; other sections start collapsed.

Layout is composed from shared Header, Countdown area, Pod, and Stage controls.
Appearance exposes Timer display for Date and Personal modes. Display surface
is available for Number and for separated Date/Personal tiles. Visible value
and label colors are owned by the exact Timer and Unit label typography roles,
not duplicate Appearance controls. Settings uses shared SEO/GEO, branding, and
social-share behavior.

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

The four unit labels and both action labels are materialized with stable
content coordinates so locale overlays replace their exact semantic text
before public visitor JavaScript starts.

## Discovery

`discovery.json` identifies Countdown as a `countdown`. It marks days, hours,
minutes, and seconds labels as timer-unit labels and marks the active and
finished action text as action labels.

This file is internal Widget software; users do not edit it. Free and Tier 1
use its system baseline, including Clickeen identification. When a Tier 2+
account enables SEO/GEO, Publish may optimize technical discovery output from
the exact saved Countdown content. Only Publish materialization writes public
files.

## Limits

```text
branding.remove -> behavior.showBacklink -> branding.remove
widget.socialShare.enabled -> behavior.socialShare.enabled -> social-share.enable
embed.seoGeo.enabled -> behavior.seoGeo.enabled -> seo-geo.enable
```

The final value on each line is the exact message identity in
`upsell/en.json`. That file owns the complete Countdown-specific denial
context; account policy owns the entitlement decision and current/target
plans, and Roma owns the system CTA and Popup. Core and public runtime consume
none of this product UI contract.

## Materialized Core And Visitor Behavior

Core HTML contains these stable operator hooks:

```text
[data-role="countdown-core"]
[data-role="timer"]
[data-role="number-display"]
[data-role="number-value"]
[data-role="units-display"]
[data-role="cta"]
[data-role="after-message"]
[data-role="after-link"]
```

Publish writes the initial number or timer values, exact unit labels, and both
action texts into those semantic elements. Core JavaScript then performs only
time progression, numeric interpolation, unit visibility, and the active or
finished phase:

- Date resolves the saved target in the saved browser/IANA timezone.
- Personal stores its first visitor start under the materialized instance id.
  Missing storage truth is created by that explicit visitor behavior; corrupt
  stored truth fails visibly instead of being replaced.
- Number interpolates from the saved starting value to target over the saved
  duration.

The Core keeps exactly one active timer or animation for the current rendered
preview body. On the next initialization it clears its prior interval or
animation frame before binding the replacement body, so ordinary Bob edits do
not accumulate detached Countdown work. Removed-root event listeners require
no separate lifecycle machinery.

The timer owns its responsive presentation through the Pod's existing inline-
size container. A wide row keeps configured separators. Narrow layouts remove
standalone separators and compose tiles in two columns, then one. Hidden Days
does not leave a leading separator, and long numbers/localized labels wrap
inside the available surface.

Shared Header, Stage, Pod, branding, social share, and locale switching remain
generic shared services. Core neither invokes nor revalidates them.

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/widget-foundation typecheck
node --check tokyo/product/widgets/countdown/core/core.js
```
