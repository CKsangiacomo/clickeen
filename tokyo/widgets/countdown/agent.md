# Countdown Widget (Agent Contract)

## Identity
- `widgetname`: `countdown`
- Root element: `[data-ck-widget="countdown"]`
- Main element: `[data-role="countdown"]`
- Scope rule: query parts within the root (no `document.querySelector(...)` for internals)

## State Encoding (DOM `data-*` enums)
Set on `[data-role="countdown"]`:
- `data-mode`: `date` | `personal` | `number` (`timer.mode`)
- `data-layout-position`: `inline` | `full-width` | `top-bar` | `bottom-bar` | `static-top` (`layout.position`)
- `data-layout-align`: `left` | `center` | `right` (derived from `stage.alignment`)
- `data-animation`: `fade` (`appearance.animation`)

## Parts (query within root)
- Root: `[data-role="countdown"]`
- Heading: `[data-role="heading"]`
- Timer container: `[data-role="timer"]`
- Units display: `[data-role="units-display"]`
  - Unit tile: `[data-role="unit"][data-unit="days|hours|minutes|seconds"]`
    - value: `[data-role="value"]`
    - label: `[data-role="label"]`
  - Separator: `[data-role="separator"]`
- Number display: `[data-role="number-display"]`
  - Number value: `[data-role="number-value"]`
- CTA link: `[data-role="cta"]`
- After message: `[data-role="after-message"]`
  - After link: `[data-role="after-link"]`

## Editable Schema (high-signal paths)
Timer:
- `timer.mode`: `date` | `personal` | `number`
- `timer.headline`: richtext string (inline HTML; sanitized)
- Date mode:
  - `timer.targetDate`: ISO `YYYY-MM-DDTHH:MM(:SS)`
  - `timer.timezone`: `browser` or IANA timezone (e.g. `America/Los_Angeles`)
- Personal mode:
  - `timer.timeAmount`: number (> 0)
  - `timer.timeUnit`: `minutes` | `hours` | `days` | `weeks` | `months`
  - `timer.repeat`: `never` | `1 minute` | `5 minutes` | `1 hour` | `1 day` | `1 week`
- Number mode:
  - `timer.startingNumber`: number
  - `timer.targetNumber`: number
  - `timer.countDuration`: number (seconds; > 0)

Actions:
- `actions.during.type`: `link`
- `actions.during.url`: string (http(s) required to be clickable)
- `actions.during.text`: string
- `actions.during.style`: `primary` | `secondary`
- `actions.during.newTab`: boolean
- `actions.after.type`: `hide` | `link`
- `actions.after.url`: string
- `actions.after.text`: string

Layout:
- `layout.position`: `inline` | `full-width` | `top-bar` | `bottom-bar` | `static-top`

Appearance:
- `appearance.theme`: `custom` | `light` | `dark` | `gradient` | `pastel` | `halloween` | `thanksgiving` | `black-friday` | `cyber-monday` | `christmas` | `new-year` | `valentines` | `easter` | `summer`
- `appearance.animation`: `fade`
- `appearance.textColor`: fill (color only)
- `appearance.itemBackground`: fill (color/gradient)
- `appearance.separator`: string (`:` | `/` | `-`)
- `appearance.cardwrapper.*`: border/shadow/insideShadow + radius controls
- `appearance.podBorder`: border object

Behavior:
- `behavior.showBacklink`: boolean (applied by `tokyo/widgets/shared/branding.js`)

SEO/GEO:
- `seoGeo.enabled`: boolean (controls Venice excerpt emission; UI remains iframe)

Stage/Pod + Typography (shared primitives):
- `stage.*`, `pod.*` (applied by `CKStagePod.applyStagePod`)
- `typography.*` (applied by `CKTypography.applyTypography`)

## Runtime contract (what state changes do)
- `applyState(state)` is deterministic and must not create timers/intervals.
- Ticking runs outside `applyState`:
  - `date`/`personal`: 1-second interval updates the timer tiles and phase.
  - `number`: requestAnimationFrame animation updates the number value.
- `timer.headline` → `[data-role="heading"]` innerHTML (sanitized)
- `timer.mode` → `[data-role="countdown"]` `data-mode` + toggles units vs number display
- `actions.during.*` → `[data-role="cta"]` href/text/target + hidden when invalid URL
- `actions.after.*` → end behavior:
  - `hide`: hide the whole stage
  - `link`: show `[data-role="after-message"]` only when URL is valid
- `appearance.separator` → all `[data-role="separator"]` text
- Card wrapper: `CKSurface.applyCardWrapper(state.appearance.cardwrapper, root)` sets `--ck-cardwrapper-*`

## Messages
- Accept `ck:state-update`: `{ type, widgetname: 'countdown', state }`

## Allowlists (prohibited paths)
- Only write content to paths allowed by:
  - `tokyo/widgets/countdown/localization.json`
  - `tokyo/widgets/countdown/layers/user.allowlist.json`
  - `tokyo/widgets/countdown/sdr.allowlist.json` (Minibob personalization)
- Never write forbidden path segments: `__proto__`, `constructor`, `prototype`
