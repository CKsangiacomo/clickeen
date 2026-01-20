# Countdown Widget Agent

Editable paths for the countdown widget configuration.

## Timer
- `timer.mode`: date | personal | number
- `timer.targetDate`: string (ISO YYYY-MM-DDTHH:MM)
- `timer.timezone`: IANA timezone or browser
- `timer.headline`: rich text (inline HTML)
- `timer.timeAmount`: number
- `timer.timeUnit`: minutes | hours | days | weeks | months
- `timer.repeat`: never | 1 minute | 5 minutes | 1 hour | 1 day | 1 week
- `timer.targetNumber`: number
- `timer.startingNumber`: number
- `timer.countDuration`: number (seconds)

## Layout
- `layout.position`: inline | full-width | top-bar | bottom-bar | static-top
- `layout.width`: auto | full | custom
- `layout.customWidth`: number (px; when width == custom)
- `layout.alignment`: left | center | right

## Appearance
- `appearance.theme`: custom | light | dark | gradient | pastel | halloween | thanksgiving | black-friday | cyber-monday | christmas | new-year | valentines | easter | summer
- `appearance.animation`: fade
- `appearance.background`: fill object (type: color | gradient | image)
- `appearance.textColor`: fill object (type: color)
- `appearance.timerBoxColor`: fill object (type: color)
- `appearance.separator`: string (: | / | -)

## Behavior
- `behavior.showBacklink`: boolean

## Actions
- `actions.during.type`: link
- `actions.during.url`: string
- `actions.during.text`: string
- `actions.during.style`: primary | secondary
- `actions.during.newTab`: boolean
- `actions.after.type`: hide | link
- `actions.after.url`: string
- `actions.after.text`: string
