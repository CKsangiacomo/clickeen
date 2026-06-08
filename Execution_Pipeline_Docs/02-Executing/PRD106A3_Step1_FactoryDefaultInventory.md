# PRD106A3 Step 1 Factory Default Inventory

Status: Green
Date: 2026-06-07

## Extraction Coordinate

Initial global Shell factory defaults come from the current Call to Action
account instance:

```text
accountPublicId: CLICKEEN
instanceId: SZBSB5HHFJ
config: accounts/CLICKEEN/instances/SZBSB5HHFJ/instance.config.json
content: accounts/CLICKEEN/instances/SZBSB5HHFJ/instance.content.json
```

R2 evidence:

```text
pnpm cf:preflight
node scripts/cloudflare/r2.mjs get accounts/CLICKEEN/instances/SZBSB5HHFJ/instance.config.json
node scripts/cloudflare/r2.mjs get accounts/CLICKEEN/instances/SZBSB5HHFJ/instance.content.json
```

The instance config declares `widgetType: calltoaction`. The content document
contains Shell text fields (`header.title`, `header.subtitleHtml`,
`headerCta.label`) and Call to Action Core text fields
(`calltoaction.*`). Shell extraction must use both config and content.

## Global Shell Factory Paths

The current widget default inventory produced 286 Shell-owned leaf paths. They
belong to these global Shell families:

```text
header.*
headerCta.*
stage.*
pod.*
coreSize.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder.*
typography.globalFamily
typography.roles.title.*
typography.roles.body.*
typography.roles.button.*
typography.roles.localeSwitcher.*
typography.roleScales.title.*
typography.roleScales.body.*
typography.roleScales.button.*
typography.roleScales.localeSwitcher.*
localeSwitcher.*
behavior.showBacklink
behavior.socialShare.*
```

Important typography rule:

- Shell owns only shared typography roles: `title`, `body`, `button`, and
  `localeSwitcher`.
- Widget-specific typography roles are Core defaults for that widget, even
  though they live under `typography.*`.

This corrects the old overly broad interpretation where all `typography.*`
looked Shell-owned.

`{widgetNamespace}.appearance.cardwrapper.*` is Core, not Shell. The shared
Shell has no card element; card wrapper styling is owned by widgets that render
repeated cards/items.

## Per-Widget Core Factory Paths

These are the current widget Core default families after removing Shell-owned
paths.

```text
big-bang:
  bigBang
  typography.roleScales.bigBang
  typography.roles.bigBang
  uiLabels.core

calltoaction:
  calltoaction
  typography.roleScales.eyebrow
  typography.roles.eyebrow
  uiLabels.core

cards:
  cards.appearance.cardwrapper
  cards
  typography.roleScales.cardCopy
  typography.roleScales.cardTitle
  typography.roles.cardCopy
  typography.roles.cardTitle
  uiLabels.core

countdown:
  countdown.actions
  countdown.appearance.animation
  countdown.appearance.cardwrapper
  countdown.appearance.itemBackground
  countdown.appearance.separator
  countdown.appearance.showLabels
  countdown.appearance.textColor
  countdown.appearance.theme
  countdown.appearance.timeFormat
  countdown.appearance.timerStyle
  countdown.geo
  countdown.layout
  countdown.seo
  countdown.seoGeo
  countdown.timer
  typography.roleScales.label
  typography.roleScales.timer
  typography.roles.label
  typography.roles.timer

faq:
  faq.appearance.cardwrapper
  faq.appearance.iconColor
  faq.appearance.iconStyle
  faq.appearance.itemBackground
  faq.appearance.linkHighlightColor
  faq.appearance.linkStyle
  faq.appearance.linkTextColor
  faq.appearance.linkUnderlineColor
  faq.appearance.theme
  faq.behavior.expandAll
  faq.behavior.expandFirst
  faq.behavior.multiOpen
  faq.context
  faq.displayCategoryTitles
  faq.geo
  faq.layout
  faq.sections
  faq.seo
  faq.seoGeo
  typography.roleScales.answer
  typography.roleScales.question
  typography.roleScales.section
  typography.roles.answer
  typography.roles.question
  typography.roles.section

logoshowcase:
  logoshowcase.appearance.cardwrapper
  logoshowcase.appearance.itemBackground
  logoshowcase.appearance.logoLook
  logoshowcase.appearance.logoOpacity
  logoshowcase.behavior.randomOrder
  logoshowcase.seoGeo
  logoshowcase.spacing
  logoshowcase.strips
  logoshowcase.type
  logoshowcase.typeConfig

split:
  split.appearance.cardwrapper
  split
  uiLabels.core
```

## Green Criteria

Every current widget default leaf path is classified as either shared Shell or
widget Core.

```text
ambiguousPaths: 0
```

No new default values were chosen in this step. This was an inventory and
authority split only.

Stage "Full" uses the current Builder/runtime stored value
`stage.canvas.mode: "viewport"`. Do not write a raw `"full"` value unless the
control/runtime contract is changed first.
