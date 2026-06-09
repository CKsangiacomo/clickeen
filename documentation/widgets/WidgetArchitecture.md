# Widget Architecture

STATUS: REFERENCE (AI-executable)

Purpose: system-level reference for widget runtime and data flow.

Related:

- `documentation/widgets/WidgetBuildContract.md`
- `documentation/ai/BUILD_Widget.md`
- `documentation/architecture/CONTEXT.md`
- `Execution_Pipeline_Docs/02-Executing/PRD106A2_WidgetShellExtraction.md`
- `Execution_Pipeline_Docs/02-Executing/PRD106A3_AccountWidgetDefaults.md`

---

## Non-Negotiable: Builder Panels Are Mixed

The Builder panels are mixed, not "shell panel then core panel":

- `content`: shared header content controls plus widget core content controls.
- `layout`: shared header/core-size/stage-pod controls plus widget core layout
  controls.
- `appearance`: shared header/header CTA/stage-pod appearance plus widget core
  appearance controls.
- `typography`: shared typography panel, but it edits roles declared by both
  shell and core.
- `settings`: shared behavior plus widget-specific runtime behavior if needed.

Panel placement is organized by the user's editing job. Ownership still matters:
Shell paths stay in shared nodes, and widget-specific body paths stay in
the widget's own namespace.

Shared controls in a mixed panel are not cosmetic. Every shared Shell control
that appears in Builder must bind through defaults, editor state, preview
runtime, save/materialization, public runtime, and policy when policy applies.

---

## System Invariants

- A widget is software. An instance is account-owned saved source plus generated
  browser artifacts.
- Normal widgets are `Widget Shell + Widget Core`.
- `packages/widget-shell/` is the Shell contract authority.
- `tokyo/product/widgets/{widgetType}/` stores widget product source files.
- `packages/widget-shell/` owns global Shell factory defaults. Widget
  `spec.json.defaults` owns only widget-specific Core factory defaults.
- Tokyo stores account widget defaults at
  `accounts/{accountPublicId}/widget-defaults.json`. New instances are created
  from those account defaults, not from widget product folder defaults.
- Account-owned instance source and generated public files live under
  `accounts/{accountPublicId}/instances/{instanceId}/`.
- Roma lists live account instances from the instance registry, not by scanning
  raw R2 prefixes. A raw R2 folder is stored bytes only; orphan prefix cleanup
  is data operations work, not widget source truth.
- `spec.json` owns the widget primitive variable graph used by Bob controls,
  preview, translation declarations, limits, and materialization.
- Runtime state violations fail visibly at the named boundary. Runtime must not
  repair, heal, or infer product meaning.
- `widgetCode` is metadata/codebook identity only. It is never a storage
  locator.
- The Builder label `Full` for Stage is stored as
  `stage.canvas.mode: "viewport"`. Normal widgets default to this value.
  Stage `wrap` is an explicit PRD-owned exception, not a starter default.
- Pod width is a separate inner-wrapper decision. Pod/Core controls own inner
  content width; Stage owns the host section canvas.

---

## Product Truth

The real authoring path is:

```text
Roma account opens one instance -> Bob edits in memory -> Roma saves/materializes -> Tokyo stores exact submitted source/artifacts
```

Builder is the only real authoring surface. Demo, Prague, Minibob, and funnel
surfaces are not account authoring truth.

Tokyo stores widget software and account artifacts. Tokyo does not own Shell
architecture, Page Composer behavior, editor UX, readiness, SEO/GEO, or product
policy.

Default flow is a separate pre-authoring step:

```text
Shell factory defaults + widget Core factory defaults -> account widget defaults
account Shell defaults + account widget Core defaults -> new instance source
Bob edits the new instance source in memory -> Roma/Tokyo save that instance
```

Factory defaults seed accounts. After an account has widget defaults, new
instance creation uses account defaults. Bob never fetches account defaults and
does not maintain a live fallback ladder.

Source metadata travels with the instance source. `baseLocale`, `targetLocales`,
and `meta` are not account default policy and must not be dropped, silently
defaulted, or inferred during create/save/materialization.

Roma Widget Defaults is not a second editor contract. It renders account
defaults through the compiled Builder control contract. Any Shell or Core
default path that is not covered by a Builder control is a contract error that
must be fixed in Widget Shell or the widget spec; Roma must not invent fallback
controls for it.

Software metadata is not account-editable default truth. `uiLabels.core.*`,
`typography.roleScales.*`, and widget-owned hidden metadata leaves used only to
parameterize runtime/software behavior are canonicalized from widget software at
the account defaults boundary. Roma does not render fallback editors for those
paths, and Tokyo rejects non-metadata default leaves that are not covered by
compiled Builder controls.

---

## Shell/Core Model

The Shell/Core model is two ownership layers in one widget, not two separate
Builder panels.

FAQ is the proven Shell/runtime source example. It is gold for Shell DOM shape,
strict runtime registration, state-update binding, editable text declarations,
repeated content behavior, and preview localization.

Call to Action proves the intended Core naming rule: widget-specific product
content, layout, and behavior live under a widget-specific namespace such as
`calltoaction.*`, while shared Stage/Pod/Header/CoreSize/Typography utilities
stay in Shell-owned paths.

### Shell

Shell is the reusable widget substrate:

- Stage.
- Pod.
- Header title/subtitle.
- Optional Header CTA primitive.
- Header placement/alignment.
- Stage/Pod layout and appearance.
- Typography.
- Theme hook.
- Locale switcher.
- Preview localization plumbing.
- Branding/backlink.
- Social share.
- Runtime registration/update binding.
- Shared script/style module list.
- Shared surface helper when a Core uses the primitive.
- Core sizing.

Shell state families:

- `header.*`
- `headerCta.*` for the optional Header CTA primitive.
- `stage.*`
- `pod.*`
- `appearance.headerCta.*`
- `appearance.localeSwitcher*`
- `appearance.podBorder`
- shared typography leaves for Shell roles: `title`, `body`, `button`, and
  `localeSwitcher`
- `localeSwitcher.*`
- `behavior.showBacklink`
- `behavior.socialShare.*`
  - `behavior.socialShare.enabled`
  - `behavior.socialShare.channels.*`
- `coreSize.*`

`uiLabels.core.*` is a widget Core extension contract for user-facing Core
labels. It is not Shell default styling or behavior.

`{widgetNamespace}.appearance.cardwrapper.*` is widget Core, not Shell. The
shared Shell has no card element. Widgets that render repeated cards/items may
use the shared surface helper, but the card-wrapper values are part of that
widget's Core defaults.

Runtime must preserve that ownership. A shared surface helper may be reused,
but the value passed to it must come from the widget namespace that declared the
surface, such as `cards.appearance.cardwrapper.*`,
`splitMedia.appearance.cardwrapper.*`,
`splitCarouselMedia.appearance.cardwrapper.*`,
`faq.appearance.cardwrapper.*`, or `countdown.appearance.cardwrapper.*`. Root
`appearance.cardwrapper.*` is not a valid Shell path.

### Shared Stage And Settings Runtime

Stage and Pod are shared Shell. `stage.canvas.mode` controls the host canvas.
The default is `"viewport"` because widgets are embeddable sections in Builder,
Page Composer, and public embeds. The pod and Core then control the visible
content width. Shrink-wrapping the Stage by default makes background, padding,
measurement, and public-page composition depend on the body content instead of
the host section contract.

`pod.widthMode` controls the inner wrapper. New and refactored section-style
widgets usually default it to `"full"` so `pod.contentWidth`, `coreSize.*`, and
Core layout own the content constraint. `wrap` or `fixed` pod defaults are
widget-specific layout decisions and must be named in the widget manifest/PRD.

`behavior.showBacklink` is shared Shell behavior for the Clickeen branding
badge/backlink. The Settings control is functional only when the default is a
boolean, the editor can mutate the path, `shared/branding.js` receives the
posted state, and both Builder preview and public output show/hide the badge.
Removing branding is entitlement-gated through `branding.remove`.

`behavior.socialShare.enabled` is shared Shell behavior for social sharing. It
is not widget Core content and widgets must not invent one-off share DOM or
runtime. The control is functional only when the default is a boolean, editor
state and save policy use the `widget.socialShare.enabled` entitlement, the
widget Shell loads `shared/socialShare.css` and `shared/socialShare.js` in
Builder preview, and Roma public package assembly chunks the same shared
modules. `shared/socialShare.js` owns the share trigger/menu DOM: it creates the
shared social-share root when `behavior.socialShare.enabled === true` and
removes it when false.

Social-share channel settings are also Shell state:

- `behavior.socialShare.channels.copy`
- `behavior.socialShare.channels.sms`
- `behavior.socialShare.channels.email`
- `behavior.socialShare.channels.whatsapp`
- `behavior.socialShare.channels.telegram`
- `behavior.socialShare.channels.signal`
- `behavior.socialShare.channels.messenger`
- `behavior.socialShare.channels.wechat`
- `behavior.socialShare.channels.line`
- `behavior.socialShare.channels.slack`
- `behavior.socialShare.channels.teams`
- `behavior.socialShare.channels.discord`
- `behavior.socialShare.channels.x`
- `behavior.socialShare.channels.linkedin`
- `behavior.socialShare.channels.facebook`
- `behavior.socialShare.channels.reddit`
- `behavior.socialShare.channels.instagram`
- `behavior.socialShare.channels.tiktok`

When `behavior.socialShare.enabled === true`, Builder shows these channel
settings through the shared `settings-behavior` editor node. Missing channel
leaves default to enabled for saved-instance compatibility. Turning every
channel off removes the shared social-share root. Builder preview must not
attempt real popup or clipboard actions; public embeds must include iframe
clipboard and popup permissions so the same Shell utility works outside
Builder.

### Core

Core is the widget-specific part. Every normal Shell/Core widget has a
widget-owned state namespace for the product body that makes that widget
different. The shared Header can frame the body, but it is not a substitute for
Core.

- FAQ Core: FAQ sections/questions/answers and FAQ behavior.
- Split Media Core: one image/video visual.
- Split Instance Core: one embedded account-owned widget instance.
- Split Carousel Media Core: 2-6 image/video visuals plus carousel behavior.
- Split Carousel Instance Core: 2-6 embedded account-owned widget instances
  plus carousel behavior.

As of PRD106C3 execution, `split-media` and `split-carousel-media` are the
shipped Split-family widgets. `split-instance` and
`split-carousel-instance` are future gated targets and must not be built with a
fake `instance-picker` or Bob-only selector.
- Cards Core: cards, card media/link/style options, and between-card graphics.
- Big Bang Core: large typographic statement content.
- Call to Action Core: action eyebrow/headline/supporting text/action content,
  body layout, and body action styling.

Core DOM lives inside `.ck-headerLayout__body`. In Bob's UI, the Core should be
labeled with the widget-appropriate noun through `uiLabels.core.*`, not exposed
to users as "Core".

Core must not read product meaning from Shell-only paths. `header.*` and
`headerCta.*` remain the optional shared Header region. If the widget's actual
body has a call-to-action, that action is widget Core state such as
`calltoaction.action.*`, not shared Header CTA state.

Core factory defaults live in `tokyo/product/widgets/{widgetType}/spec.json`.
They must not include Shell-owned defaults such as Header, Header CTA, Stage,
Pod, Core Size, branding, social share, locale switcher, or Shell typography
roles. Bob compiles widgets against composed factory defaults
(`Widget Shell + Widget Core`) for software/control rendering only. Product
new-instance creation uses account defaults.

Core must also be visible under the shared default `coreSize.mode: "auto"`.
If a Core renders media, canvas, or embedded instances through absolutely
positioned children, the widget Core CSS must provide intrinsic auto sizing.
The fix is Core CSS, not widget-specific Shell `coreSize` defaults.

### Naming Taxonomy

Shell Header taxonomy is fixed:

- Header region: `header.*`
- Header title: `header.title`
- Header subtitle: `header.subtitleHtml`
- Header action/button: `headerCta.*`
- Header action appearance: `appearance.headerCta.*`

Widget Core taxonomy must be widget-specific. Do not create body paths named
only `title`, `subtitle`, `cta`, `button`, `body`, or generic `core.*` when a
similar Shell element exists. Use a product namespace and specific nouns:
`calltoaction.headline`, `calltoaction.supportingTextHtml`,
`calltoaction.action.*`, `cards.items[]`, `split.visual.*`, and similar. This
keeps saved state, editable fields, translations, and ToolDrawer labels
deterministic.

User-facing labels must also carry context when similar controls appear in the
same mixed panel. A Header control can say "Header CTA label"; a Call to Action
body control can say "Action label". Never show users internal labels like
"core.cta".

---

## Current Widget Model Inventory

Use this table before changing an existing widget. Active callers do not prove
that an old body namespace is correct product architecture.

| Widget | Current model | Body state authority | What to copy |
| --- | --- | --- | --- |
| `calltoaction` | New widget-specific Core model | `calltoaction.*` | Copy for Shell/Header CTA separation, widget-specific body action naming, mixed panels, and Core DOM bindings. |
| `big-bang` | Widget-specific Core model | `bigBang.*` | Copy for simple statement/copy Core paths and Shell composition. |
| `cards` | Widget-specific Core model | `cards.*` plus Core cardwrapper appearance where declared | Copy for repeated-item Core paths and stable item identity. |
| `countdown` | Widget-specific Core model | `countdown.*` | Copy for widget-owned timing/action/SEO metadata under one namespace. |
| `faq` | Widget-specific Core model | `faq.*` | Copy for repeated sections/questions and Shell runtime behavior. |
| `logoshowcase` | Widget-specific Core model | `logoshowcase.*` | Copy for nested repeated logo collections. |
| `split` | Widget-specific Core model | `split.*` plus Core cardwrapper appearance where declared | Copy for mixed media/instance item Core paths. |

New widgets and refactored widgets must use a widget-specific body namespace.
Legacy generic Core paths, legacy Header CTA paths, private CTA paths, root
`title`, and old body namespaces are not acceptable surviving widget source
language.

---

## Saved Instance Compatibility

Changing widget source does not rewrite every saved account instance. Existing
instances may post runtime state that lacks newly added or renamed body paths,
typography roles, role scales, or appearance objects.

Generated public files are stored artifacts, not live views of widget source.
Changing `spec.json`, `widget.client.js`, shared Shell code, or account defaults
does not update existing `index.html`, `styles.css`, `runtime.js`, or
`package.json`. Any live widget refactor must include a package regeneration or
recomposition plan for affected account instances and Page Composer pages, or it
must stop with a named blocker. Stale generated artifacts are a data migration
problem, not proof that the source change failed.

Bob session normalization deep-merges compiled widget defaults into loaded
instance state before Builder preview receives it, then applies declared
normalization rules. This is the named load compatibility boundary for adding
new defaulted paths to old saved instances. Therefore a widget refactor that
adds or renames body namespace, Shell namespace, or typography roles must
include one explicit compatibility path:

- Migrate saved account instance source at the account/storage boundary.
- Add a named load/materialization normalization that creates the missing
  parent state before preview/runtime receives it. Builder session load already
  deep-merges compiled defaults; server/public materialization must match when
  old saved source is published.
- Add a temporary widget-local runtime bridge that renders the old saved state
  shape while new instances use the new Core state.

A compatibility bridge is not permission to create a second product truth. It
must be scoped to the old saved shape, keep the new widget-specific body
namespace as the surviving authority, and be removed when stored instances have
been migrated.

Pre-GA contract renames should use a one-time data rewrite rather than
long-lived runtime aliases. The Header CTA Shell rename and Call to Action
widget rename require rewriting saved instance config, content paths,
translation overlays, and registry widget type rows:

- legacy Header CTA state -> `headerCta.*`
- legacy Header CTA appearance -> `appearance.headerCta.*`
- `appearance.ctaBorder` -> `appearance.headerCta.border`
- `appearance.ctaRadius` -> `appearance.headerCta.radius`
- `appearance.ctaSizePreset` -> `appearance.headerCta.sizePreset`
- `appearance.ctaPaddingLinked|Inline|Block` ->
  `appearance.headerCta.paddingLinked|paddingInline|paddingBlock`
- `appearance.ctaIconSizePreset|IconSize` ->
  `appearance.headerCta.iconSizePreset|iconSize`
- widget type `cta` -> `calltoaction`
- body paths `core.*` in the old CTA widget ->
  `calltoaction.*` in the Call to Action widget

Typography has the same rule. If a refactor adds `typography.roles.eyebrow`,
the widget runtime must not ask `CKTypography` to apply `eyebrow` against old
state unless old state has that role, or the state must be migrated before the
runtime call.

---

## No Fourth Noun

Clickeen product architecture uses widgets, instances, and Page Composer pages.

Do not add another product noun such as `block`, `section`, `slot`, `fragment`,
`accountInstanceRef`, `blockId`, or `blockType`.

Prague blocks are migration input only. Prague-derived output becomes normal
widgets with widget-specific Cores inside the Shell.

---

## Widget Source Location

Widget source files live in:

```text
tokyo/product/widgets/{widgetType}/
```

Canonical files:

- `spec.json`: defaults + structured Builder editor contract.
- `widget.html`: DOM skeleton and script/style references.
- `widget.css`: styles using Dieter tokens, Shell vars, and Core vars.
- `widget.client.js`: deterministic runtime.
- `editable-fields.json`: editable/translatable text contract when needed.
- `limits.json`: widget path/op mapping to policy keys when needed.

`pages/*.json`, Prague block files, `agent.md`, and catalog sidecars are not
active widget architecture.

---

## Builder Editor Contract

`spec.json.editor.panels[]` is the only widget-owned Builder control contract.
Panels are mixed by product job: a panel can contain both shared Shell nodes and
widget Core controls.

Panels contain explicit clusters and field/shared nodes. Bob no longer reads
widget-authored `<bob-panel>`, `<tooldrawer-cluster>`,
`<tooldrawer-field>`, or `@slot:` strings from `spec.json`.

Shared Shell controls are declared with shared nodes:

- `header-content`
  - `header-content-no-header-cta`
- `header-layout`
  - `header-layout-no-header-cta`
- `core-size`
- `header-appearance`
  - `header-appearance-no-header-cta`
- `stagepod-layout`
- `stagepod-appearance`
- `stagepod-corners`
- `settings-behavior`
- shared `typography` panel

Widget Core controls are normal field nodes, but every field path must exist in
the widget-owned body namespace and have one Binding Map row. Existing generic
`core.*` or legacy widget body paths are migration targets, not the model for
new or refactored widgets.

Widget Core field nodes must participate in Bob's ToolDrawer grouping layer.
Use `groupId` for related controls inside each Core cluster and set
`attrs["group-label"]` to `""` when the group is only for rhythm and should not
show a nested label. Shared Shell controls already do this. Ungrouped Core
fields render with different vertical rhythm and are non-compliant.

The normal panel pattern is:

- `content`: shared Header content node, then Core content controls.
- `layout`: shared Header/CoreSize/StagePod nodes, then Core layout controls.
- `appearance`: shared Header/Header CTA/StagePod nodes, then Core appearance controls.
- `typography`: shared typography panel for all declared Shell and Core text
  roles.
- `settings`: shared behavior plus Core runtime behavior controls.

Clusters and groups define ToolDrawer spacing. Widgets must not invent editor
spacing through margins, spacers, ungrouped fields, or fake groups.

### Panel Ownership

Panels are part of product architecture:

- `content`: authored content, item managers, media choices, and content
  toggles.
- `layout`: placement, arrangement, sizing, fit, gaps, carousel behavior, and
  responsive behavior.
- `appearance`: fills, borders, shadows, radius, per-item styles, and visual
  graphics.
- `typography`: shared typography panel.
- `settings`: runtime behavior toggles.

Moving controls to the wrong panel is product drift because it makes widgets
harder to operate and harder for AI to reason about.

### Dieter Control Model

Widgets use Dieter through Bob field nodes in `spec.json`. They do not paste raw
`<diet-*>` markup into widget source.

Use existing field types for the matching job:

- rich customer-visible text: `textedit` or `dropdown-edit`
- one-line text/URL: `textfield`
- boolean: `toggle`
- number: `valuefield`
- enum: `dropdown-actions`, `choice-tiles`, or `segmented`
- fill/media/color: `dropdown-fill`
- border: `dropdown-border`
- shadow: `dropdown-shadow`
- flat primary repeated item lists: `repeater`
- grouped containers, nested lists, or secondary per-object settings:
  `object-manager`
Account-instance selection is not a generic field type. It requires a
product-owner-approved Dieter/Bob component and a Roma-provided account instance
data source. Do not use or document `instance-picker` as an approved widget
control.

Nested controls inside `repeater` and `object-manager` templates are not
second-class HTML. They use the same Builder control language as top-level
controls: `showIf` must survive compilation and all nested controls must be
real supported Dieter/Bob controls.

Every dependent control uses structured `showIf`. Every field path exists in
`defaults`. Every runtime-read path exists in `defaults`.

---

## Runtime Modules

Shell shared modules are named by `packages/widget-shell/src/modules.ts`.

Important shared runtime/style files include:

| Module | Purpose |
| --- | --- |
| `shared/runtime.js` | Runtime registration and Bob preview state binding |
| `shared/stagePod.js` / `shared/stagePod.css` | Stage/Pod layout and appearance |
| `shared/header.js` / `shared/header.css` | Header title/subtitle/CTA layout and behavior |
| `shared/typography.js` / `shared/typography-data.js` | Typography roles and locale/script-aware stacks |
| `shared/fill.js` / `shared/appearance.js` | Fill and appearance helpers |
| `shared/localeSwitcher.js` / `shared/localeSwitcher.css` | Locale switcher behavior and styling |
| `shared/coreSize.js` | Core sizing behavior |
| `shared/surface.js` | Shared surface/card-wrapper vars |
| `shared/previewL10n.js` | Bob translated-preview value application |
| `shared/branding.js` | Backlink behavior; owns badge creation/removal through `behavior.showBacklink` |
| `shared/socialShare.js` / `shared/socialShare.css` | Social-share shell utility; owns trigger/menu creation/removal through `behavior.socialShare.enabled` and channel filtering through `behavior.socialShare.channels.*` |

Widget Core runtime must not replace these modules.

---

## Data Flow

### Editor Flow

```text
Tokyo widget source -> Bob compiles controls/package -> Roma opens account instance
-> Bob holds working state -> Bob postMessage preview updates -> widget.client.js applies state
```

Bob preview may load the iframe before state is available. Widget clients must
bind state updates and apply initial state only when present.

Preview update payload includes the active state plus locale context:

```js
{
  type: 'ck:state-update',
  widgetname: 'faq',
  instanceId: 'ABC123DEFG',
  state: { /* full instance JSON */ },
  locale: 'ja',
  baseLocale: 'en',
  previewMode: 'translated',
  translatedLocaleValues: { /* editable path -> string */ },
  device: 'desktop',
  theme: 'light'
}
```

### Save/Materialization Flow

```text
Bob compiled widget package + current instance state
-> Roma builds index.html/styles.css/runtime.js
-> Roma saves source/artifacts through Tokyo product operation
-> Tokyo stores exact submitted objects
```

Roma package assembly strips authoring scripts from `widget.html`, stamps the
instance id, chunks CSS/runtime modules, embeds `CK_WIDGETS`, and writes
`index.html`, `styles.css`, and `runtime.js`.

Agents must not invent a second package format or ask Tokyo to render widget
internals from private source files.

### Public Embed Flow

```text
Browser -> clk.live/{accountPublicId}/{instanceId}
-> static serving reads generated browser files from the account instance folder
-> widget runtime applies saved state from runtime payload
```

Public runtime reads generated artifacts. It does not fetch product databases or
authoring source at request time.

### Theme Flow

```text
tokyo/product/themes/themes.json -> Bob compiles theme options
-> selection previews in editor
-> Apply theme writes final state values
-> runtime reads final state only
```

Widget work uses the existing theme hook. It does not create widget-specific
theme systems.

---

## Page Composer Compatibility

Page Composer stacks ordered instances. It consumes the same materialized output
model that standalone instances use.

Therefore every widget must:

- Produce stable `index.html`, `styles.css`, and `runtime.js` artifacts.
- Keep instance runtime state isolated.
- Use shared Shell module boundaries so Page Composer can concatenate and dedupe
  common Shell CSS/runtime.
- Avoid singleton global state outside documented `CK_*` registries.

Page Composer belongs to Roma. Tokyo stores the resulting files; it does not
compose pages.

---

## Media And Asset Origin

Widgets use canonical root-relative paths:

- `/assets/account/{accountPublicId}/*` for account-owned assets backed by
  `accounts/{accountPublicId}/assets/`.
- `/dieter/*` for design-system media.
- `/widgets/*` for widget package media.

Runtime must not depend on `window.CK_ASSET_ORIGIN`.

---

## System Responsibilities

| System | Does | Does NOT |
| --- | --- | --- |
| `packages/widget-shell` | Own Shell contract/defaults/helpers/module lists/validators | Own widget-specific Core behavior |
| Tokyo | Store widget software and account runtime objects | Own Shell architecture, compose pages, or use `widgetCode` as storage locator |
| Bob | Compile specs, render ToolDrawer, hold working state, preview via postMessage | Apply widget-specific defaults at runtime or invent Shell controls |
| Roma | Open/save account editor state and build saved widget public packages | Transform product meaning or compose via Tokyo |
| `clk.live` | Serve stored static public package files | Modify widget state or fetch authoring data at request time |
| Michael | Persist account/registry metadata and relational state | Validate per-widget runtime or assemble embeds |

---

## Forbidden Drift

Do not add:

- Widget-specific Shell aliases.
- Hand-authored Header/Header CTA/CoreSize controls.
- Local translation resolvers/fetchers.
- Alternate package formats.
- Public locale assumptions beyond the current runtime payload.
- Duplicate editable-field schemas.
- Prague block/accountInstanceRef architecture.
- Runtime healing for missing state.
