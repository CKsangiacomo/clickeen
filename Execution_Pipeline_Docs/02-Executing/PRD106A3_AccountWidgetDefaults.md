# PRD106A3_AccountWidgetDefaults

## Core Tenet

The widget default model is intentionally simple:

```text
factory defaults seed accounts
account defaults create new instances
Bob loads one full instance state in browser memory
user edits that in-memory state
user saves
Roma/Tokyo store the saved instance
```

There are three default authorities, and they must not be confused:

- Global Shell factory defaults are shared for every widget. They cover Header,
  Header CTA, Stage, Pod, shared appearance, shared typography, locale switcher,
  branding, social share, behavior, and Shell-owned Core Size. They live in the
  shared Shell system and are the same for every widget.
- Widget Core factory defaults are specific to the widget software. They cover
  what makes FAQ different from Cards, Countdown, Split, Big Bang, Logo
  Showcase, or Call to Action: FAQ sections/questions, card items, countdown
  time, split media, logos, or any widget-specific body/action state.
- Account widget defaults are the live defaults used to create new instances
  for that account. They are seeded from factory defaults at account creation.
  From that moment on, new instances use account defaults, not factory defaults.

New instance creation materializes one full state object:

```text
account Shell defaults + account widget Core defaults = new instance state
```

After creation, Bob works exactly as it works today. Bob is not editing account
defaults. Bob is editing one widget instance in browser memory. Account defaults
are an input to new instance creation, not a live dependency, not a runtime
lookup, not a fallback system, and not a second widget truth.

## Simplicity Tenet

Execution must protect the simple architecture from accidental complexity.

Do not invent new subsystems for this PRD:

- no new policy system;
- no new entitlement model;
- no new sanitization model;
- no new fallback ladder;
- no new defaults runtime lookup;
- no new validation framework beyond the existing widget/build/account
  boundaries needed to preserve the Shell/Core split.

`Settings > Widget Defaults` reuses the same control language and existing
control behavior as Builder. If a control already behaves a certain way in
Builder, Widget Defaults mirrors that behavior. If a detail is unclear, stop
and ask instead of inventing a product rule.

## Bob Panel Tenet

Bob's Builder panels are mixed editing surfaces. They are not "Shell panels"
followed by "Core panels." Each panel can edit shared Shell values and
widget-specific Core values in the same user-facing panel:

```text
content: shared Header content controls plus widget Core content controls.
layout: shared Header, Core Size, Stage, and Pod controls plus widget Core layout controls.
appearance: shared Header, Header CTA, Stage, and Pod appearance plus widget Core appearance controls.
typography: shared typography panel, editing roles declared by both Shell and Core.
settings: shared Shell behavior plus widget-specific runtime behavior if needed.
```

This matters because Roma Widget Defaults edits account defaults with the same
control language, but it does not change Bob's instance-editing model. A normal
Bob instance edit still shows the mixed panel: shared Shell controls for that
instance plus that widget's Core controls.

## Scale Tenet

This is true for every normal widget:

```text
one shared Shell system
many widget-specific Cores
one account default source
one consistent Bob editing model
```

That is what makes Clickeen scalable. Every widget inherits the same global
Shell goodness: Header, Header CTA, Stage, Pod, appearance, typography,
branding, social share, locale switcher, behavior, and sizing. Each widget only
defines what makes it unique in Core.

New widgets should therefore be smaller and more deterministic:

- they consume the shared Shell;
- they define only widget-specific Core factory defaults and Core controls;
- they seed account widget Core defaults at account creation;
- they appear in Bob through the same mixed panel model;
- they create new instances from account defaults.

Status: Draft execution PRD - Step 1 inventory/blocker closure only
Owner: Roma + Widget Shell
Date: 2026-06-07
Parent: `106__Umbrella__Composition_Vision.md`
Depends on: `PRD106A2_WidgetShellExtraction.md`
Unlocks: account-owned widget defaults, smaller widget specs, deterministic new widget instance creation.
Authority owned by this PRD: account default seeding, account-editable widget defaults, global Shell factory defaults, widget Core factory default extraction, and the Roma navigation/page needed to edit account defaults.
Authority explicitly not owned by this PRD: themes, applying new defaults to existing saved instances, public runtime behavior, Page Composer behavior, or Bob editor behavior.

## Current Readiness Gate

This PRD is not ready for broad implementation yet.

Current executable work is limited to:

```text
Step 1: Inventory factory default split and close blocker questions.
```

Do not implement storage, seeding, Roma UI, create-route changes, widget-spec
shrinking, or Bob compile changes until the blocker questions below are closed.

### Blocker Questions To Close Before Step 2

These are evidence-backed boundary questions, not invitations to invent new
systems:

1. Where is `account.widgetDefaults` stored and served from?
   - The answer must name one existing product owner/boundary.
   - Do not create a new settings subsystem.
2. What exact payload does Roma submit to Tokyo when creating a new instance?
   - Current target is `widgetType + full resolved config`.
   - Close whether account locale metadata is also submitted as existing
     `baseLocale`/`targetLocales`/`meta` data.
3. What does Bob compile against after widget specs stop authoring Shell
   defaults?
   - Bob still needs a composed factory defaults object to render controls.
   - Instance editing must not become a live factory-default fallback.
4. Which exact current values become the global Shell factory defaults?
   - `packages/widget-shell` is currently partial.
   - Current widget specs carry divergent Shell starter values.
   - Resolve path-by-path without inventing new visual values.
5. How does Roma render Widget Defaults controls with the same control language
   as Builder?
   - Either reuse an existing Builder control representation or name the minimal
     structured representation needed.
   - Do not create a second UI/control language.
6. Is the Settings IA change route movement or nav grouping?
   - Current Roma routes are flat.
   - Close whether routes remain flat with grouped nav, or move under
     `/settings/*`.
7. What validation evidence proves widget specs no longer own Shell defaults?
   - `pnpm validate:widgets` alone only proves generated widget-definition
     source sync.
   - Add the existing `packages/widget-shell` validation boundary or a targeted
     equivalent.

## Product Truth

The real authoring path does not change:

```text
Roma account -> Bob edits one widget instance -> Roma saves -> Tokyo stores files
```

This PRD changes only the source used before Bob opens a brand-new instance:

```text
factory defaults seed account defaults
account defaults create instance config
Bob edits instance config
save stores instance config
```

The current Tokyo widget folder defaults are not the live source for new
instances after the account has defaults. They are factory seed material.

## Factory Versus Account Defaults

Factory defaults exist so accounts can be seeded.

```text
packages/widget-shell
  owns global Shell factory defaults

widget software
  owns widget-specific Core factory defaults

account settings
  owns live account widget defaults
```

After an account is seeded, the system works off account defaults.

```text
factory defaults -> account defaults -> new instance -> Bob memory -> saved instance
```

Factory defaults are not a runtime fallback ladder. If an account is missing
defaults, the account must be seeded before new instance creation proceeds. For
existing accounts, this PRD needs one explicit seeding/migration step before the
new create path depends on account defaults.

## Reconciliation With Tokyo Widget Folders

Today widget folders contain `spec.json.defaults`. That was acceptable while
widget software was the only default source. It becomes wrong if those defaults
continue to include Shell values after account defaults exist.

The corrected model is:

- Widget folders may provide widget Core factory defaults.
- Widget folders must not author private Shell defaults.
- Global Shell factory defaults come from `packages/widget-shell/`.
- Account defaults are seeded from global Shell factory defaults plus each
  widget's Core factory defaults.
- New instance creation reads account defaults, not widget-folder factory
  defaults.

This prevents the failure mode where every widget keeps inventing Header,
Header CTA, Stage, Pod, typography, social share, branding, or locale defaults
again.

## Account Default Shape

Roma must persist one account-owned widget defaults document.

Recommended shape:

```text
account.widgetDefaults.shell
account.widgetDefaults.widgets[widgetType].core
```

Meaning:

- `account.widgetDefaults.shell` is one shared Shell defaults object used for
  every widget type in that account.
- `account.widgetDefaults.widgets[widgetType].core` is that account's default
  Core state for that widget type.

`core` is the architecture bucket in the account defaults document. It does not
mean every widget-owned path must be renamed to `core.*`. It contains all
approved non-Shell state paths for that widget, such as `sections`,
`displayCategoryTitles`, `timer`, `cards`, `logos`, `split`, or `calltoaction`
depending on the widget.

The stored account defaults should be complete enough to create a new instance
without querying widget factory defaults. The only exception is the explicit
account seeding/migration step.

## New Instance Resolution

When the user creates a new widget instance:

```text
account.widgetDefaults.shell
  + account.widgetDefaults.widgets[widgetType].core
  = full instance state sent to Tokyo and Bob
```

Rules:

- Account Shell defaults are the only Shell defaults used by new instance
  creation.
- Account widget Core defaults are the only Core defaults used by new instance
  creation.
- Widget Core defaults do not override Shell paths.
- Widget specs do not define Shell default values.
- The resolved new instance state includes all Shell and Core values Bob needs.
- Saving the instance stores the resolved state.
- Later changes to account defaults do not silently rewrite already saved
  instances.
- Duplicate preserves the source instance state. It does not reapply account
  defaults.

## Creation Boundary

Roma owns account default policy and new-instance orchestration. Tokyo stores
the exact instance config Roma submits.

Execution must change the current product create seam so new instance creation
does not call Tokyo widget factory defaults as live product truth. Current code
to replace/fence:

```text
roma/app/api/account/instances/route.ts
  currently sends widgetType/displayName only

tokyo-worker/src/domains/account-instances/operations.ts
  createAccountInstanceFromDefaults currently calls resolveWidgetDefaults(widgetType)
```

Target behavior:

```text
Roma reads account widget defaults
Roma materializes full instance config
Roma submits widgetType + full config to Tokyo create
Tokyo writes that submitted config
Bob opens the created instance as usual
```

Tokyo may still expose factory widget definitions for account seeding and
software validation. Tokyo must not decide live account default policy.

## Roma IA

Roma top-level navigation remains a short main menu:

```text
Home
Widgets
Pages
Builder
Assets
Settings
```

`Settings` becomes collapsible. Its second-level menu is:

```text
Account
User Settings
Team
Billing
Usage
AI
Widget Defaults
```

The current Roma `Settings` page becomes `Settings > Account`.

`Settings > Widget Defaults` is the new page owned by this PRD.

## Widget Defaults UX

`Settings > Widget Defaults` edits account defaults, not factory defaults and
not saved instances.

It should be long, grouped, and boring. Users set it up once, then new widget
instances inherit their account defaults.

The page has two conceptual areas:

```text
Global Shell Defaults
Widget Core Defaults
```

Global Shell Defaults:

- shown once;
- not repeated per widget;
- uses the same control language as Builder;
- covers the Shell side of Builder panels.

Widget Core Defaults:

- grouped by widget type;
- uses the same control language as that widget's Builder Core controls;
- does not show Shell controls again;
- stores the account's starting Core state for that widget type.

Do not call the UI "Core" where users see it if the widget's own noun is
clearer. For example: FAQ defaults, Cards defaults, Countdown defaults, Logos
defaults.

## Builder Panel Mapping

The Widget Defaults UI uses the same control language as Builder and mirrors
the mixed Shell/Core panel model:

```text
Global Shell Defaults:
  content: shared Header content controls and shared Header CTA content controls.
  layout: shared Header layout, Core Size, Stage, and Pod controls.
  appearance: shared Header, Header CTA, Stage, and Pod appearance controls.
  typography: shared typography defaults for Shell roles.
  settings: shared behavior, branding, locale switcher, and social share defaults.

Widget Core Defaults:
  content/layout/appearance/typography/settings controls that belong only to that widget Core.
```

The page must avoid per-widget Shell tabs. Per-widget sections are for Core
defaults only.

## Shell Defaults To Remember

This PRD inherits the Shell extraction from
`PRD106A2_WidgetShellExtraction.md`, with current naming corrections:

- old `cta.*` is now `headerCta.*`;
- old `appearance.cta*` is now `appearance.headerCta.*`;
- old `behavior.socialShare.enabled` is now the full
  `behavior.socialShare.*` family, including channel defaults.

The account Widget Defaults page must cover every defaultable shared Shell path
owned by `packages/widget-shell/`, including these families:

```text
header.*
headerCta.*
stage.*
pod.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder
appearance.cardwrapper.*
typography.*
localeSwitcher.*
behavior.showBacklink
behavior.socialShare.*
coreSize.*
```

`uiLabels.core.*` remains part of the Widget Core extension contract. Those
labels name each widget's Core noun in the Builder UI, such as FAQ, Cards, or
Split. They are not account-level Shell styling or behavior defaults.

## Explicit Shell Control Coverage

The implementation must generate or list the exact Shell control inventory from
`packages/widget-shell/`. Current extracted shared Shell controls already
include:

```text
header.enabled
header.title
header.showSubtitle
header.subtitleHtml

headerCta.enabled
headerCta.label
headerCta.href
headerCta.openMode
headerCta.iconEnabled
headerCta.iconPlacement
headerCta.iconName

header.placement
header.alignment
header.gap
header.textGap
header.ctaPlacement
header.innerGap

coreSize.mode
coreSize.fixedHeight
coreSize.minHeight
coreSize.preferredVw
coreSize.maxHeight

behavior.showBacklink
behavior.socialShare.enabled
behavior.socialShare.channels.copy
behavior.socialShare.channels.sms
behavior.socialShare.channels.email
behavior.socialShare.channels.whatsapp
behavior.socialShare.channels.telegram
behavior.socialShare.channels.signal
behavior.socialShare.channels.messenger
behavior.socialShare.channels.wechat
behavior.socialShare.channels.line
behavior.socialShare.channels.slack
behavior.socialShare.channels.teams
behavior.socialShare.channels.discord
behavior.socialShare.channels.x
behavior.socialShare.channels.linkedin
behavior.socialShare.channels.facebook
behavior.socialShare.channels.reddit
behavior.socialShare.channels.instagram
behavior.socialShare.channels.tiktok
```

This extracted package list is not enough by itself. Execution must extend the
inventory until it also covers the A2 Shell surface below, using current path
names:

```text
stage.alignment
stage.canvas.mode
stage.canvas.width
stage.canvas.height
stage.padding.desktop.*
stage.padding.mobile.*
stage.background
stage.shadow
stage.insideShadow.*

pod.widthMode
pod.contentWidth
pod.padding.desktop.*
pod.padding.mobile.*
pod.background
pod.shadow
pod.insideShadow.*
pod.radiusLinked
pod.radius
pod.radiusTL
pod.radiusTR
pod.radiusBR
pod.radiusBL

appearance.headerCta.background
appearance.headerCta.textColor
appearance.headerCta.border
appearance.headerCta.radius
appearance.headerCta.sizePreset
appearance.headerCta.paddingLinked
appearance.headerCta.paddingInline
appearance.headerCta.paddingBlock
appearance.headerCta.iconSizePreset
appearance.headerCta.iconSize

appearance.localeSwitcherBackground
appearance.localeSwitcherTextColor
appearance.localeSwitcherBorder
appearance.localeSwitcherRadius
appearance.localeSwitcherPaddingInline
appearance.localeSwitcherPaddingBlock
appearance.podBorder
appearance.cardwrapper.*

typography.globalFamily
typography.roles.title.*
typography.roles.body.*
typography.roles.button.*
typography.roles.localeSwitcher.*
typography.roleScales.*

localeSwitcher.enabled
localeSwitcher.byIp
localeSwitcher.alwaysShowLocale
localeSwitcher.attachTo
localeSwitcher.position
```

Widget Core typography roles, such as FAQ question/answer roles or countdown
number/label roles, are account widget Core defaults for that widget type. They
are not global Shell defaults unless a later PRD promotes them into the shared
Shell contract.

## Initial Factory Defaults

The initial global Shell factory defaults must come from the current product's
shared Shell starter values. Do not invent new visual defaults during this PRD.

Stage must default to full for all widgets. A widget is a section-level product
surface, so the shared Stage should occupy the available width by default, and
the Pod/Core controls decide the contained presentation. Per-widget stage width
factory defaults would recreate the scattered Shell-default problem this PRD is
removing.

Widget Core factory defaults come from each widget's current Core-specific
starter state after Shell paths have been removed.

## UX Requirements

`Settings > Widget Defaults` must:

- use the same control language as Builder;
- group controls by Builder panel vocabulary;
- make it clear these defaults apply to new widget instances;
- include save and discard-unsaved-change affordances;
- avoid theme-system language;
- avoid repeating Shell controls per widget;
- allow social share settings to expand under `Enable social share`;
- allow `Show Made with Clickeen` to control the account Shell branding default;
- make widget Core default sections clearly per widget type.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Inventory factory default split. | List of global Shell factory paths and per-widget Core factory paths. | Every current default path is Shell or Core; no ambiguous owner remains. | Work tries to choose better defaults instead of splitting authority. |
| 2 | Complete global Shell factory defaults in `packages/widget-shell/`. | Diff showing one complete shared Shell defaults object. | Shell factory defaults are centralized and same for every widget. | Any widget keeps authored Shell defaults as source truth. |
| 3 | Extract widget Core factory defaults. | Spec/source diffs for each widget. | Widget software keeps only Core factory defaults and Core controls. | Shell paths remain live in widget default source. |
| 4 | Define account widget defaults schema and seeding. | Schema/API/storage diff. | New accounts are seeded from global Shell factory defaults plus widget Core factory defaults. | New instance creation can run with missing account defaults. |
| 5 | Seed existing accounts. | Migration or first-access seeding evidence. | Existing accounts have account widget defaults before new create uses them. | Runtime factory fallback is added instead of seeding. |
| 6 | Add Roma Settings IA. | Diff/screenshot. | `Settings` is collapsible and includes `Account` plus `Widget Defaults`. | Current main nav becomes noisy or the current Settings page is lost. |
| 7 | Build `Settings > Widget Defaults`. | Diff/screenshot. | Page renders global Shell defaults once and per-widget Core defaults by widget type. | Core sections repeat Shell controls or a global theme system appears. |
| 8 | Change new instance creation to use account defaults. | Diff/evidence for Roma and Tokyo create seam. | Roma submits full resolved config; Tokyo stores submitted config. | Tokyo calls widget factory defaults as live account default policy. |
| 9 | Preserve Bob instance behavior. | Bob smoke/typecheck evidence. | Bob opens one full state, edits in memory, saves as before. | Bob fetches account defaults or changes merge semantics for this PRD. |
| 10 | Update widget docs. | Diffs to widget architecture/build/compliance docs. | Docs explain factory defaults, account defaults, Shell/Core split, and new instance resolution. | Docs still teach widget-local Shell defaults. |

## Validation

Required verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/widget-shell typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
```

Manual checks:

- Create or seed an account and confirm account widget defaults exist.
- Change Header title/subtitle defaults in Roma Widget Defaults.
- Change one widget Core default, such as FAQ starter content or Countdown
  starter time.
- Create a new FAQ instance and confirm Bob opens with account Shell defaults
  and FAQ account Core defaults.
- Create a new Call to Action instance and confirm it receives the same account
  Shell defaults and its own account Core defaults.
- Save both instances and confirm the saved instance state contains resolved
  Shell and Core values.
- Change Widget Defaults again and confirm already saved instances do not
  silently change.
- Duplicate an existing instance and confirm duplicate preserves source state
  instead of reapplying account defaults.
- Toggle `Show Made with Clickeen` default off and confirm new instances start
  with branding hidden.
- Enable social share defaults and confirm channel settings are visible and new
  instances inherit them.

## Stop Conditions

Stop and ask for product direction if:

- implementation needs a new default value that does not already exist in the
  current product starter values;
- any Shell default appears to need different values per widget;
- a widget Core default needs to overwrite a Shell path;
- Widget Defaults needs behavior that differs from the same control in Builder;
- existing saved instances would need to be rewritten;
- Bob would need to know account defaults directly;
- Tokyo would need to decide live account defaults;
- new instance creation needs a runtime fallback to widget factory defaults;
- theme selection becomes part of the work.

## Open Questions

- Exact account settings storage implementation for `account.widgetDefaults`.
- Whether "restore factory defaults" should be part of this PRD or a later
  explicit action. Discarding unsaved changes is in scope; applying factory
  defaults after account seeding is optional product behavior.
- Whether future "apply these defaults to existing instances" needs its own PRD.
