# Countdown Widget Agent

Editable paths for the countdown widget configuration.

## Timer
- `timer.mode`: date | personal | number
- `timer.targetDate`: string (ISO date)
- `timer.headline`: string
- `timer.timezone`: UTC | EST | PST
- `timer.timeAmount`: number
- `timer.timeUnit`: hours | minutes | days | weeks | months
- `timer.repeat`: never | 1 minute | 5 minutes | 1 hour | 1 day | 1 week
- `timer.targetNumber`: number
- `timer.startingNumber`: number
- `timer.countDuration`: number

## Layout
- `layout.position`: inline | sticky-top | sticky-bottom
- `layout.width`: auto | full
- `layout.alignment`: left | center | right

## Appearance
- `appearance.background`: color
- `appearance.textColor`: color
- `appearance.timerBoxColor`: color
- `appearance.separator`: : | /

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