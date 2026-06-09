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
  what makes FAQ different from Cards, Countdown, Split-family media, Big Bang,
  Logo Showcase, or Call to Action: FAQ sections/questions, card items,
  countdown time, `splitMedia.*`, `splitCarouselMedia.*`, logos, or any
  widget-specific body/action state.
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

There is no Roma-only fallback editor for defaults. Every account default path
must be covered by the compiled Builder control contract. If a stored Shell or
Core default has no matching Builder control path, `Settings > Widget Defaults`
must stop and show a contract error listing the missing paths. It must not hide
the value, infer a generic control, or save through the broken contract.

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

Status: Ready for controlled execution
Owner: Roma + Widget Shell
Date: 2026-06-07
Parent: `106__Umbrella__Composition_Vision.md`
Depends on: `PRD106A2_WidgetShellExtraction.md`
Unlocks: account-owned widget defaults, smaller widget specs, deterministic new widget instance creation.
Authority owned by this PRD: account default seeding, account-editable widget defaults, global Shell factory defaults, widget Core factory default extraction, and the Roma navigation/page needed to edit account defaults.
Authority explicitly not owned by this PRD: themes, applying new defaults to existing saved instances, public runtime behavior, Page Composer behavior, or Bob editor behavior.

## Execution Readiness

This PRD is ready for controlled execution.

Start with:

```text
Step 1: Inventory the factory default split using the closed product decisions below.
```

After Step 1 produces the Shell/Core path inventory, continue through the
execution steps in order. Do not implement storage, seeding, Roma UI,
create-route changes, widget-spec shrinking, or Bob compile changes by
reopening the closed product decisions below.

### Closed Product Decisions For Step 1

These are product decisions, not invitations to invent new systems:

1. `account.widgetDefaults` is stored in Tokyo under the account folder.
   - Exact R2 key: `accounts/{accountPublicId}/widget-defaults.json`.
   - Tokyo is the storage owner because widget defaults are account-owned
     widget source material, like `instances/`, `assets/`, `pages/`, and
     account website serving files.
   - Roma may read/write the document through account-authenticated product
     routes, but Roma does not become a second storage truth.
2. New instance create submits a resolved instance state, not just widget type.
   - Current create sends only `widgetType/displayName`; Tokyo then calls
     widget factory defaults. This PRD removes that live factory-default path.
   - Target create payload is:
     `widgetType + displayName + source.config + baseLocale + targetLocales +
     meta`.
   - `source.config` is the resolved Shell + Core instance state from account
     defaults.
   - Roma does not submit `source.content`. Tokyo derives editable text content
     from submitted `source.config`, stores text in `instance.content.json`, and
     strips those content paths from persisted `instance.config.json`.
   - `baseLocale`, `targetLocales`, and `meta` are source metadata, not defaults
     policy. They must not be dropped at create.
3. Bob compiles against composed factory defaults only for software/control
   rendering.
   - Compilation uses `global Shell factory defaults + widget Core factory
     defaults`.
   - Bob instance editing still opens one resolved instance state from Roma.
   - Bob does not fetch account defaults and does not merge factory defaults as
     a live account fallback during editing.
4. Initial global Shell factory defaults come from the current Call to Action
   account instance `SZBSB5HHFJ`.
   - Step 1 must record the exact owning `accountPublicId + instanceId` before
     extraction. Tokyo storage is account-first, so an instance ID alone is not
     a storage coordinate.
   - Extract only shared Shell paths from that instance.
   - Ignore `calltoaction.*` Core paths when building global Shell defaults.
   - Read the composed authoring state, not only raw `instance.config.json`,
     because user-visible text may live in `instance.content.json`.
5. Roma Widget Defaults uses Builder's existing control language.
   - The question is implementation representation, not product behavior.
   - The page must consume the same Builder control contract/compiled control
     language used by Bob, including Dieter hydration behavior.
   - Do not hand-code a second set of Roma-only controls.
6. Settings IA is nav grouping, not a product-state subsystem.
   - Roma's main menu becomes short: Home, Widgets, Pages, Builder, Assets,
     Settings.
   - Settings is expandable and shows Account, User Settings, Team, Billing,
     Usage, AI, and Widget Defaults.
   - Existing flat routes may remain for existing pages. Current `/settings`
     is the Account page. New Widget Defaults may live at
     `/settings/widget-defaults`.
7. Validation must prove Shell defaults were extracted.
   - `pnpm validate:widgets` is not enough by itself; it only proves generated
     widget-definition source sync.
   - Add/use a `packages/widget-shell` validation check that scans widget specs
     and fails if Shell-owned default paths remain authored in widget defaults.

## Product Truth

The real authoring path does not change:

```text
Roma account -> Bob edits one widget instance -> Roma saves -> Tokyo stores files
```

This PRD changes only the source used before Bob opens a brand-new instance:

```text
factory defaults seed account defaults
account defaults create instance source
Bob edits one resolved instance state
save stores instance source
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

tokyo account folder
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

Tokyo must persist one account-owned widget defaults document in the account
folder.

Canonical account key:

```text
accounts/{accountPublicId}/widget-defaults.json
```

Why this belongs in Tokyo:

- defaults are account-owned widget source material;
- the account folder already owns instances, assets, pages, and website serving
  files;
- new instance creation is a Tokyo-owned account product operation;
- storing defaults beside account instances prevents Bob, Roma, Michael, or
  widget software folders from becoming duplicate defaults truth;
- the key uses `accountPublicId`, matching the rest of account-owned Tokyo
  storage.

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
`displayCategoryTitles`, `timer`, `cards`, `logos`, `splitMedia`,
`splitCarouselMedia`, or `calltoaction` depending on the widget. Legacy
`split` is not an approved current Core namespace; PRD106C3 makes it a
deletion/cleanup input.

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

Roma owns the account defaults UX and new-instance orchestration. Tokyo owns the
stored account defaults document and stores the exact instance source Roma
submits.

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
Roma materializes full resolved config
Roma submits widgetType + displayName + source.config + baseLocale + targetLocales + meta to Tokyo create
Tokyo derives content from submitted config and writes instance.config.json + instance.content.json
Bob opens the created instance as usual
```

Payload meaning:

- `widgetType`: the widget software to instantiate.
- `displayName`: optional instance label.
- `source.config`: resolved Shell + Core instance state from account defaults.
- `source.content`: not submitted by Roma. Tokyo derives it from
  `source.config` using the editable-fields contract.
- `baseLocale`: current account base locale.
- `targetLocales`: current account target locales.
- `meta`: source metadata needed by the existing account instance source
  document.

Tokyo may still expose factory widget definitions for account seeding and
software validation. Tokyo must not call widget factory defaults as live account
default policy after account defaults exist.

Step 8 cannot run until Step 4 and Step 5 are green. New instance creation must
have account defaults available before it reaches the create boundary. If
account defaults are missing, execution must seed the account before create or
fail at the account-default boundary; it must not add a runtime fallback to
widget factory defaults.

Locale wiring must be explicit. Either the create/write boundary accepts
`baseLocale` and `targetLocales` directly, or Roma puts those values into the
existing `meta` contract before Tokyo writes source. Do not rely on Tokyo's
current default locale behavior as an accidental fallback.

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

The page uses Builder's existing control contract. It must not hand-code a
parallel Roma-only form language for Shell or Core defaults. If code needs to
move to make this reusable, extract/reuse the existing Builder control
rendering/hydration path instead of inventing a new control model.

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

Every displayed field on this page must come from the compiled Builder control
contract. Unmapped defaults are a build/product contract failure, not an
alternate UI mode. Roma must surface the missing paths and block save/editing
until Widget Shell or the widget spec exposes the correct control.

## Shell Defaults To Remember

This PRD inherits the Shell extraction from
`PRD106A2_WidgetShellExtraction.md`, with current naming corrections:

- legacy Header CTA state is now `headerCta.*`;
- legacy Header CTA appearance is now `appearance.headerCta.*`;
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
coreSize.*
```

`uiLabels.core.*` remains part of the Widget Core extension contract. Those
labels name each widget's Core noun in the Builder UI, such as FAQ, Cards,
Split Media, or Split Carousel Media. They are not account-level Shell styling
or behavior defaults.

`{widgetNamespace}.appearance.cardwrapper.*` is widget Core, not Shell. The
shared Shell has no card element. Card wrapper styling belongs to widgets that
render repeated cards/items, such as Cards, FAQ, Countdown, Logo Showcase, or
Split-family media. Existing widgets already disagree on these values, which
proves they are not one global Shell default.

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

typography.globalFamily
typography.roles.title.*
typography.roles.body.*
typography.roles.button.*
typography.roles.localeSwitcher.*
typography.roleScales.title.*
typography.roleScales.body.*
typography.roleScales.button.*
typography.roleScales.localeSwitcher.*

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

The initial global Shell factory defaults must come from the current Call to
Action account instance `SZBSB5HHFJ`. Do not invent new visual defaults during
this PRD.

Extraction rule:

```text
record the owning accountPublicId for instance SZBSB5HHFJ
read composed authoring state from accounts/{accountPublicId}/instances/SZBSB5HHFJ
extract every Shell-owned path
ignore every calltoaction.* Core-owned path
write extracted Shell values into packages/widget-shell factory defaults
```

Use the composed authoring state, not only raw `instance.config.json`, because
Tokyo splits customer-visible text into `instance.content.json`.

Stage must default to the Builder "Full" option for all widgets. In the current
control/runtime contract, that option is stored as `stage.canvas.mode:
"viewport"`. A widget is a section-level product surface, so the shared Stage
should occupy the available width by default, and the Pod/Core controls decide
the contained presentation. Per-widget stage width factory defaults would
recreate the scattered Shell-default problem this PRD is removing.

Widget Core factory defaults come from each widget's current Core-specific
starter state after Shell paths have been removed.

## UX Requirements

`Settings > Widget Defaults` must:

- use the same control language as Builder;
- group controls by Builder panel vocabulary;
- make it clear these defaults apply to new widget instances;
- include save and discard-unsaved-change affordances;
- protect unsaved changes across Settings navigation, section switching, browser
  unload, and save responses;
- avoid theme-system language;
- avoid repeating Shell controls per widget;
- allow social share settings to expand under `Enable social share`;
- allow `Show Made with Clickeen` to control the account Shell branding default;
- make widget Core default sections clearly per widget type.
- block editing with an explicit contract error when any account default path is
  not covered by the compiled Builder control contract.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Inventory factory default split. | List of global Shell factory paths, per-widget Core factory paths, and the `accountPublicId + SZBSB5HHFJ` extraction coordinate. | Every current default path is Shell or Core; no ambiguous owner remains. | Work tries to choose better defaults instead of splitting authority. |
| 2 | Complete global Shell factory defaults in `packages/widget-shell/`. | Diff showing one complete shared Shell defaults object. | Shell factory defaults are centralized and same for every widget. | Any widget keeps authored Shell defaults as source truth. |
| 3 | Extract widget Core factory defaults. | Spec/source diffs for each widget. | Widget software keeps only Core factory defaults and Core controls. | Shell paths remain live in widget default source. |
| 4 | Define account widget defaults schema and seeding. | Schema/API/storage diff. | New accounts are seeded from global Shell factory defaults plus widget Core factory defaults. | New instance creation can run with missing account defaults. |
| 5 | Seed existing accounts. | Migration or first-access seeding evidence. | Existing accounts have account widget defaults before new create uses them. | Runtime factory fallback is added instead of seeding. |
| 6 | Add Roma Settings IA. | Diff/screenshot. | `Settings` is collapsible and includes `Account` plus `Widget Defaults`. | Current main nav becomes noisy or the current Settings page is lost. |
| 7 | Build `Settings > Widget Defaults`. | Diff/screenshot plus dirty-state check. | Page renders global Shell defaults once and per-widget Core defaults by widget type; every rendered field comes from compiled Builder controls; unsaved edits are protected. | Core sections repeat Shell controls, a global theme system appears, unmapped defaults get generic fallback controls, or dirty edits can be lost. |
| 8 | Change new instance creation to use account defaults. | Diff/evidence for Roma and Tokyo create seam. | Roma submits full resolved config; Tokyo derives content and stores `instance.config.json` plus `instance.content.json`. | Tokyo calls widget factory defaults as live account default policy, Roma tries to submit `source.content`, or locale metadata falls back accidentally. |
| 9 | Preserve Bob instance behavior. | Bob smoke/typecheck evidence. | Bob opens one full state, edits in memory, saves as before. | Bob fetches account defaults or changes merge semantics for this PRD. |
| 10 | Update widget docs. | Diffs to widget architecture/build/compliance docs. | Docs explain factory defaults, account defaults, Shell/Core split, and new instance resolution. | Docs still teach widget-local Shell defaults. |

## Validation

Required verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/widget-shell validate
pnpm --filter @clickeen/widget-shell typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
```

If `@clickeen/widget-shell validate` does not exist yet, this PRD must add the
targeted validation command. It must scan all widget specs and fail when a
Shell-owned path is still authored in widget defaults. This is the proof that
new widgets cannot accidentally keep the old scattered Shell-default model.

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

## Future Scope Not In This PRD

- "Restore factory defaults" after account seeding. Discarding unsaved changes
  is in scope; applying factory defaults to saved account defaults is not.
- Applying new defaults to existing saved instances. This needs its own explicit
  PRD if the product ever wants it.
