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
Note: content alignment follows `stage.alignment` (left/center/right). Pod sizing is driven by stage/pod layout controls.
Legacy layout fields are ignored by runtime (use Stage/Pod layout controls instead).

## Appearance
- `appearance.theme`: custom | light | dark | gradient | pastel | halloween | thanksgiving | black-friday | cyber-monday | christmas | new-year | valentines | easter | summer
  - Global theme preset (editor-only): selection is staged until "Apply theme" is clicked. Cancel restores the prior theme.
  - Applying a theme sets Stage/Pod/Item appearance values plus typography family. Editing any theme-controlled field resets theme to `custom`.
- `appearance.animation`: fade
- `appearance.textColor`: fill object (type: color)
- `appearance.itemBackground`: fill object (type: color | gradient)
- `appearance.itemCard.border`: object (enabled, width, color)
- `appearance.itemCard.shadow`: object (enabled, inset, x, y, blur, spread, color, alpha)
- `appearance.itemCard.radiusLinked`: boolean
- `appearance.itemCard.radius`: none | 2xl | 4xl | 6xl | 10xl
- `appearance.itemCard.radiusTL|TR|BR|BL`: none | 2xl | 4xl | 6xl | 10xl
- `appearance.podBorder`: object (enabled, width, color)
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
