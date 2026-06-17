# Widget Build Contract

STATUS: CANONICAL (AI-executable)
OWNER: Platform / Widget System

This contract defines how Clickeen widgets are built.

Normal widgets are not standalone inventions. They are:

```text
Widget Shell + Widget Core
```

Default authority is split:

```text
packages/widget-shell -> global Shell factory defaults
tokyo/product/widgets/{widgetType}/spec.json -> widget Core factory defaults
accounts/{accountPublicId}/widget-defaults.json -> account defaults used for new instances
```

Factory defaults seed account defaults. New instances are created from account
defaults. Bob edits one resolved instance state in browser memory and saves
that state through Roma/Tokyo. Bob does not fetch account defaults and does not
merge factory defaults as live account fallback.

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

Panels are organized by the user's editing job. Ownership is enforced by path:
Shell-owned paths come from shared nodes, and widget-specific body paths live in
the widget's own namespace.

Shared Shell controls in mixed panels are live product controls. A widget is not
compliant if `behavior.showBacklink`, `behavior.socialShare.*`, Stage/Pod,
Header, Header CTA, Typography, or CoreSize controls appear in Builder but do
not bind through preview, save/materialization, public runtime, and policy when
policy applies.

The FAQ widget proves the Shell/runtime model. `packages/widget-shell/` is the
named Shell contract authority. The Call to Action widget proves the
widget-specific Core namespace model. Cards, Split-family widgets, FAQ, Countdown, Logo
Showcase, Big Bang, and Call to Action now use widget-specific Core namespaces.
A widget folder under `tokyo/product/widgets/` is the product source location
for that widget's Core plus its materialized source files.

---

## Product Boundary

The real authoring path is:

```text
Roma account opens one instance -> Bob edits in memory -> Roma saves/materializes -> Tokyo stores exact submitted source/artifacts
```

Tokyo stores widget software and account artifacts. Tokyo does not own widget
architecture, Shell decisions, editor UX, Page Composer behavior, SEO/GEO, or
product policy.

Account-owned runtime data lives under
`accounts/{accountPublicId}/instances/{instanceId}/`, never under
`tokyo/product/widgets/{widgetType}/`.

Instance source metadata travels with the instance. `baseLocale`,
`targetLocales`, and `meta` are source metadata, not account default policy.
Create/save/materialization code must carry them through explicitly and must not
drop them or silently invent fallback values.

Account-owned widget defaults live under:

```text
accounts/{accountPublicId}/widget-defaults.json
```

That document stores one shared account Shell defaults object plus per-widget
Core defaults. New instance creation materializes:

```text
account.shell + account.widgets[widgetType].core = full instance source
```

Changing account defaults does not rewrite existing saved instances. Duplicates
preserve the source instance state.

Roma Widget Defaults edits account defaults through the compiled Builder
control contract. Every account Shell default path and every account widget Core
default path must be covered by a real Builder control path. If a path is not
covered, Roma must stop with a contract error listing the missing paths. It must
not infer a generic field, hide the path, or save through the broken contract.

The only exception is software metadata, not account-editable defaults:
`uiLabels.core.*` and `typography.roleScales.*`. These families exist so Builder
can name Core groups and resolve typography presets. Hidden widget runtime
constants such as SEO/GEO answer formats, business types, workspace URLs, or
fixed action types must not live in account defaults. Non-metadata leaves
without compiled Builder control coverage are rejected server-side.

Roma lists live account instances from the instance registry, not from raw R2
prefixes. R2 folders are stored bytes only. Orphan R2 cleanup is data
operations work and does not prove widget source truth.

`widgetCode` is metadata/codebook identity only. It is never an R2 storage
locator.

---

## Inputs

- Explicit `widgetType`.
- Relevant PRD and current step gate.
- `documentation/architecture/CONTEXT.md`.
- `documentation/strategy/WhyClickeen.md`.
- This contract.
- `documentation/widgets/WidgetArchitecture.md`.
- `packages/widget-shell/src/*`.
- FAQ widget source as the Shell/runtime example:
  `tokyo/product/widgets/faq/*`.
- Call to Action widget source as the simple widget-specific Core example:
  `tokyo/product/widgets/calltoaction/*`.
- Cards widget source as the repeated-item Core example:
  `tokyo/product/widgets/cards/*`.
- Split media widget sources as media Core examples:
  `tokyo/product/widgets/split-media/*` and
  `tokyo/product/widgets/split-carousel-media/*`.
- Target widget source:
  `tokyo/product/widgets/{widgetType}/`.
- Entitlement matrix only when binding `limits.json`:
  `packages/ck-policy/entitlements.matrix.json`.

---

## Outputs

Canonical widget files:

- `spec.json`
- `widget.html`
- `widget.css`
- `widget.client.js`
- `editable-fields.json` when the widget has customer-visible text.
- `limits.json` when the widget has limited arrays/operations/controls.

No widget-local helper file is allowed unless the PRD explicitly names it.

---

## Stop Conditions

Stop if:

- `widgetType` is not explicit.
- PRD is missing or conflicts with this contract.
- The current PRD step is not green for its dependencies.
- You cannot classify every requested behavior as Shell-owned or Core-owned.
- Core cannot be isolated from Shell without changing shared behavior.
- You cannot provide the pre-code Core manifest.
- You are changing state shape and cannot name how existing saved instances
  will keep rendering.
- Binding Map rows are incomplete.
- Editable text paths cannot be mapped.
- Limits cannot be mapped to existing entitlement keys.
- The change requires Shell mutation, new shared controls, new shared runtime,
  new theme behavior, locale-switcher behavior, preview-localization behavior,
  branding behavior, runtime message behavior, Bob/Roma/Tokyo-worker/Venice/
  Prague/Dieter edits, or package assembly changes, and the PRD does not
  explicitly own that shared surface.
- The change alters social-share behavior, branding/backlink behavior, package
  assembly, or shared Settings semantics without PRD ownership of that shared
  surface.
- Validation cannot run or fails.

---

## Shell/Core Boundary

### Shell-Owned

Shell state and behavior are owned by `packages/widget-shell/` and the shared
runtime/compiler modules it names.

Shell-owned state families:

- `header.*`
- `headerCta.*`
- `stage.*`
- `pod.*`
- `appearance.headerCta.*`
- `appearance.localeSwitcher*`
- `appearance.podBorder`
- Shell typography leaves for shared roles: `title`, `body`, `button`, and
  `localeSwitcher`
- `localeSwitcher.*`
- `behavior.showBacklink`
- `behavior.socialShare.*`
- `coreSize.*`

Shell-owned UX/runtime:

- Stage/Pod DOM, CSS, defaults, and shared primitive calls.
- Header title/subtitle and the optional Header CTA primitive.
- Header CTA styling and behavior.
- Typography primitive and locale-aware typography context.
- Theme hook/control.
- Locale switcher and preview localization plumbing.
- Branding/backlink behavior.
- Social-share package/runtime behavior.
- Runtime registration, update binding, and message plumbing.
- Shared script/style load order.
- Shared surface helper when a Core uses the primitive.
- Core sizing.

Not Shell-owned:

- `uiLabels.core.*`: widget Core extension labels for Bob's user-facing Core
  noun.
- `{widgetNamespace}.appearance.cardwrapper.*`: widget Core frame/surface
  defaults for widgets that render cards/items. Shell has no card element.

### Core-Owned

Core is the actual different part of the widget.

Core owns:

- Widget-specific content/state structure.
- Widget-specific product actions, buttons, links, and body CTAs.
- Widget-specific arrays/items and stable item identity.
- Widget-specific DOM inside `.ck-headerLayout__body`.
- Widget-specific rendering and deterministic updates.
- Widget-specific layout behavior inside the Core.
- Widget-specific CSS classes/vars.
- Binding Map rows for widget-specific controls.
- Editable/translatable paths for widget-specific customer-visible text.
- Limits mappings for widget-specific arrays/operations/counts.

Core-owned appearance must be rendered from the widget namespace that declares
it. For example, Cards must render card surfaces from
`cards.appearance.cardwrapper.*`, Split Media must render its visual frame from
`splitMedia.appearance.cardwrapper.*`, and Split Carousel Media must render its
visual frame from `splitCarouselMedia.appearance.cardwrapper.*`. A runtime that reads
`state.appearance.cardwrapper` is wrong: root `appearance.*` is reserved for
Shell appearance families such as `appearance.headerCta.*`,
`appearance.localeSwitcher*`, and `appearance.podBorder`.

`cardwrapper.*` is not just a saved control family. The rendered widget must
consume the shared `--ck-cardwrapper-radius`, `--ck-cardwrapper-border-*`, and
`--ck-cardwrapper-shadow` variables on the visible Core surface that the controls
name. If the panel says "Visual frame", those variables must style the visual
frame, not an invisible parent or root placeholder.

Corner controls must use corner language in the ToolDrawer. The state paths stay
`radiusLinked`, `radius`, and `radiusTL|TR|BR|BL`, but the UI labels must read
`Link ... corners`, `Corner radius`, and `... top-left corner` / `... top-right
corner` / `... bottom-right corner` / `... bottom-left corner`. Do not label the
linked toggle as `Link ... radius`.

Core must render with `coreSize.mode: "auto"`. If the Core uses absolutely
positioned media, canvas, or embedded children, the Core CSS must provide an
intrinsic auto size such as an aspect ratio/min-height keyed by the shared
CoreSize mode. Do not solve a zero-height Core by giving that widget private
Shell `coreSize` defaults.

The shared Shell `coreSize` default may keep `mode: "auto"`, but the latent
values for the other modes must be positive: `fixedHeight`, `minHeight`,
`preferredVw`, and `maxHeight`. Builder switches modes by applying the selected
mode immediately. If those latent values are `0`, Fixed or Responsive mode can
collapse the Core before the user sees a useful sizing field.

The user-facing UI must not show the word "Core" unless the PRD explicitly asks
for it. Use `uiLabels.core.*` so Bob can display "FAQs", "Visual", "Cards",
"Logos", or another widget-appropriate label.

Core is an ownership layer, not a required state root named `core`. New and
refactored widgets must use a widget-specific body namespace:
`calltoaction.*`, `cards.*`, `splitMedia.*`, `splitCarouselMedia.*`, `faq.*`,
or another PRD-owned product namespace. Legacy `split.*` is a deletion/cleanup
input, not a namespace to copy. Existing generic `core.*` sources are
transitional and must not be copied into new widgets. If `core.*` appears in
source, it is a migration blocker unless the PRD explicitly fences it as
temporary saved-state compatibility.

Shell Header controls and Core controls live together in the same product
panels. For example, Content contains the shared Header content node and then
the widget-owned Core content controls; Layout contains shared Header/CoreSize/
StagePod controls and then Core layout controls. The panel is organized by user
job, not by ownership.

`spec.json.defaults` must not author Shell-owned defaults. Widget specs declare
shared Shell editor nodes, but Shell default values come from
`packages/widget-shell`. Widget specs author only widget Core defaults and Core
extension labels/roles. Bob composes Shell factory defaults plus widget Core
factory defaults so the Builder control contract can render.

### Naming Taxonomy

Shared Header element paths are fixed:

- `header.title`
- `header.subtitleHtml`
- `headerCta.enabled`
- `headerCta.label`
- `headerCta.href`
- `headerCta.openMode`
- `headerCta.iconEnabled`
- `headerCta.iconName`
- `headerCta.iconPlacement`
- `appearance.headerCta.*`

Widget Core element paths must not reuse Shell names or generic names for
similar things. Do not create body paths named only `title`, `subtitle`, `cta`,
`button`, `body`, or new generic `core.*` paths. Use a widget-specific
namespace and specific nouns, for example:

```text
calltoaction.headline
calltoaction.supportingTextHtml
calltoaction.action.label
calltoaction.action.href
calltoaction.actionStyle.background
```

ToolDrawer labels must disambiguate similar elements in the same mixed panel:
"Header CTA label" for Shell and "Action label" for Call to Action body. Do
not expose internal terms such as `core.cta` or `body.title` to users.

`headerCta.*` is the optional shared Header CTA. It is not the body action for
a Call to Action widget or any other widget whose primary product action
belongs to the Core. Body actions must use widget-owned paths such as
`calltoaction.action.*`.

---

## No Fourth Noun

Do not invent another product architecture noun.

Allowed product concepts:

- Widget
- Instance
- Page Composer page made from ordered instances

Forbidden as architecture nouns:

- `block`
- `section`
- `slot`
- `fragment`
- `accountInstanceRef`
- `blockId`
- `blockType`

Prague blocks are migration source evidence only. Prague-derived output becomes
normal widgets with widget-specific Cores inside the Shell.

---

## Contracts

### 1) Pre-Code Core Manifest

Before coding, enumerate a Core Manifest. This is the surviving authority for
the widget-specific body. If it cannot be filled out, do not edit code.

- Shell-owned paths kept intact.
- Core-owned paths introduced/changed.
- Array paths and stable item identity fields.
- Core DOM role map.
- Panel placement for every Core control.
- Dieter field type for every Core control.
- Binding Map rows for all Core editor controls.
- `editable-fields.json` paths.
- `limits.json` paths and entitlement keys.
- Typography roles and required `roleScales`.
- Default value for every Core path and why that value is the starter state.

Template:

```text
Widget type:
Model classification: new-core | old-body | transitional | shell-only bug

Shell paths kept:
- header.*
- headerCta.* only for optional Header CTA
- stage.*
- pod.*
- coreSize.*
- Shell typography roles: title, body, button, localeSwitcher
- localeSwitcher.*
- shared appearance.*
- shared behavior.*

Shared shell invariants:
- stage.canvas.mode defaults to "viewport" (Builder label: Full)
- pod.widthMode is explicit; use "full" for section-style widgets unless the
  PRD/manifest owns a wrap/fixed inner-wrapper decision
- behavior.showBacklink is a boolean and is bound to shared branding runtime
- behavior.socialShare.enabled is a boolean and is bound to the shared
  social-share shell runtime
- behavior.socialShare.attachTo is "stage" or "pod"; social share is floating
  Shell chrome and must attach to that host, not to widget Core content
- behavior.socialShare.position is one shared Shell position token
- behavior.socialShare.channels.* booleans are shared Shell channel settings;
  they default on for compatibility and filter the shared social-share menu
- Settings uses the shared `settings-behavior` editor node; widgets do not
  hand-author branding or social-share controls

Core paths:
- {widgetType}.* product body paths, for example calltoaction.headline or
  calltoaction.action.label

Legacy body paths:
- path: migrate now | defer with reason

Core DOM roles:
- path -> data-role -> update mechanism

Panels:
- content: shared node(s) + core controls
- layout: shared node(s) + core controls
- appearance: shared node(s) + core controls
- typography: shared panel roles
- settings: shared behavior + core runtime behavior

Binding Map:
| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |

Editable fields:
- path, type, role

Limits:
- path/op, entitlement key, enforcement boundary

Typography:
- role, global/non-global, roleScales required?

Saved instance compatibility:
- New paths/roles added:
- Old saved state shape:
- Compatibility path: storage migration | load/materialization normalization | temporary runtime bridge
- Old-state smoke payload:
```

If this cannot be completed, stop.

### 2) State Model

MUST

- Keep the Shell contract intact for Shell widgets.
- Do not author Shell defaults in widget `spec.json.defaults`; consume them from
  `packages/widget-shell`.
- Do not author Shell normalization in widget `spec.json.normalization`.
  Widget-local `normalization.idRules` and `normalization.coerceRules` are
  Core-only and must target the widget namespace.
- Define a widget-specific body namespace for every normal Shell/Core widget.
- Put widget-specific state in Core-owned paths under that namespace.
- Define arrays as `path[]` and items as `path[i]`.
- Provide stable item identity for repeated content.
- Provide a stable DOM Array Container role and DOM Item Container role for each
  array.
- Provide stable `data-role` for every runtime-mutated element.
- Define `uiLabels.core.singular`, `uiLabels.core.plural`, and
  `uiLabels.core.sizeCluster` as widget Core extension labels.
- Verify the composed defaults include Shell values for `coreSize.*`,
  `stage.canvas.mode`, `pod.widthMode`, `behavior.showBacklink`, and
  `behavior.socialShare.*`. Those values come from the Shell factory defaults,
  not the widget spec.

MUST NOT

- Use widget root as an item.
- Update DOM elements without stable `data-role`.
- Add duplicate Shell paths under Core.
- Use `header.*` or `headerCta.*` as the widget's only visible product body.
- Add old aliases: `headline`, `subheadline`, `copy`, `button`,
  `primaryCta`, `secondaryCta`, `ctaText`, `ctaUrl`, `layout.copyWidth`,
  `layout.bodyWidth`, or `layout.variant`.
- Add fallback/healing logic for missing state.

### 2A) Saved Instance Compatibility

Existing account instances are saved source. New widget Core defaults do not
automatically appear in old saved state just because widget
`spec.json.defaults` changed.

Generated account package files are stored artifacts. Existing `index.html`,
`styles.css`, and `runtime.js` do not update when widget source, shared Shell
code, or account defaults change. Any refactor that changes saved state
language, package assembly, public runtime, or Page Composer output MUST include
one explicit package regeneration/recomposition path for affected live instances
and pages, or stop with a named blocker.

Builder session load deep-merges compiled widget defaults (Shell factory
defaults plus widget Core `spec.json.defaults`) into the saved instance state
before ToolDrawer hydration and preview postMessage. This is the Builder-side
load compatibility boundary for new defaulted paths. Widget runtime should not
hide missing Core forever when the intended fix is load or materialization
normalization.

Widget spec normalization is not a Shell fallback ladder. It may repair
Core-owned saved state, such as widget item IDs or widget namespace scalar
types. It must not repair `behavior.showBacklink`, `behavior.socialShare.*`,
`header.*`, `headerCta.*`, `stage.*`, `pod.*`, `coreSize.*`, or shared Shell
appearance/typography paths. The compiler rejects Shell paths in widget
`normalization.coerceRules`.

When a widget refactor adds, renames, or moves state paths, the build MUST name
one compatibility path:

- Storage migration: update saved account instance source to the new state
  shape.
- Load/materialization normalization: create missing parent objects and leaves
  before Builder preview and public runtime receive state.
- Temporary runtime bridge: detect the old saved shape and render it without
  treating it as the surviving model.

Runtime bridges are allowed only as migration compatibility. They MUST be
scoped to the old shape, documented in the Core Manifest, and tested with an
old-state payload. They MUST NOT silently invent product meaning for arbitrary
invalid state.

Typography roles follow the same compatibility rule. Adding a role to
`defaults.typography.roles` does not add that role to existing saved instances.
If `applyTypography` is called with a role key missing from the posted state,
the shared typography runtime fails visibly. Either migrate the state first or
omit optional role keys from the runtime role map until the posted state has
them.

### 3) Defaults

Defaults are product starter state. They are not placeholders and not optional
scaffolding.

There are two factory default files:

- Shell factory defaults in `packages/widget-shell/src/defaults.ts`.
- Widget Core factory defaults in `tokyo/product/widgets/{widgetType}/spec.json`.

Account widget defaults are seeded from those factories and are the only source
used for new instance creation after the account exists.

MUST

- Define every Core editor-controlled path in widget `spec.json.defaults`
  before adding the Core control.
- Define every Core runtime-read path in widget `spec.json.defaults` before
  reading it.
- Use shared Shell nodes for Shell controls and rely on Shell factory defaults
  for Shell paths.
- Keep every default JSON-serializable. No `undefined`, functions, DOM-shaped
  values, or environment-dependent values.
- Use the same value shape as the matching existing control family. For example,
  Stage/Pod backgrounds use the existing dropdown-fill shape, borders use the
  existing dropdown-border shape, shadows use the existing dropdown-shadow
  shape, and option fields use exact string values from their option list.
- Set toggle defaults to the intended starter UX. A toggle that reveals required
  starter content should default on; a toggle for advanced/custom behavior
  should default off.
- Give every repeatable item a stable `id` or equivalent item identity.
- Reject structural Core invariants that can break package/runtime output at
  the create/save boundary before persistence. Examples: carousel array min/max
  counts, required stable item IDs, and item kind constraints. Runtime may fail
  loudly too; runtime must not be the only enforcement.
- Include starter items when the widget would otherwise render as a blank broken
  product. Starter content must be useful product starter content, not lorem
  ipsum or hidden test data.
- Keep Core defaults aligned with the Shell/Core boundary. Core defaults extend
  the widget; they do not rename or duplicate Shell state.
- Verify Shell factory defaults set `stage.canvas.mode` to `"viewport"`. The
  Builder displays this as `Full`.
- Verify Shell factory defaults set `pod.widthMode` explicitly.
- Verify Shell factory defaults include boolean `behavior.showBacklink`,
  boolean `behavior.socialShare.enabled`, and each
  `behavior.socialShare.channels.*` leaf.
- Map `behavior.showBacklink` to `branding.remove` and
  `behavior.socialShare.enabled` to `widget.socialShare.enabled` in
  `limits.json` when the widget uses the normal Shell.
- Verify account Widget Defaults can map every stored Shell/Core default path to
  compiled Builder controls. Missing coverage is a contract failure.

MUST NOT

- Add a ToolDrawer control for a path missing from defaults.
- Add a Roma-only fallback/defaults editor for paths missing from Builder
  controls.
- Add runtime guards that silently fill missing defaults.
- Use empty defaults to dodge required schema work.
- Store account-owned asset bytes or private account references in product
  defaults.
- Author Shell defaults in a widget spec.

### 3A) Shared Stage And Settings Defaults

Stage defaults are Shell product truth. `stage.canvas.mode: "viewport"` is the
canonical Full stage default for normal widgets. A widget whose Stage defaults
to `wrap` will shrink the host canvas to body content and make section
background, Stage padding, measurement, and Page Composer/public embed behavior
depend on the Core body. That is an explicit PRD exception, never the default
for a new or refactored widget.

Pod defaults are inner-content truth, not the Stage canvas contract.
`pod.widthMode: "full"` keeps section-style widgets aligned to the host section
while `pod.contentWidth`, `coreSize.*`, and Core layout controls constrain the
visible content. `wrap` or `fixed` pod defaults are allowed only as named
widget-specific layout decisions.

Shared Settings defaults must be executable:

- `behavior.showBacklink`: controls shared Clickeen branding/backlink through
  `shared/branding.js`; removing it is gated by `branding.remove`.
- `behavior.socialShare.enabled`: controls the social-share feature through
  `shared/socialShare.js` and `shared/socialShare.css`; enabling it is gated by
  `widget.socialShare.enabled`. The shared runtime creates/removes the share
  trigger/menu DOM from this state path in both Builder preview and public
  output. The trigger/menu floats from the selected Stage or Pod host through
  `behavior.socialShare.attachTo` and `behavior.socialShare.position`; widgets
  do not attach social-share DOM to Core content.
- `behavior.socialShare.channels.*`: controls which shared share actions appear
  once social share is enabled. These are Shell settings, not Core behavior,
  and they are rendered by the shared `settings-behavior` editor node.

Locale switcher display state is Shell-owned, but locale availability is not.
Tier policy decides locale capacity, Account Settings decides
`baseLocale`/`selectedTargetLocales`/`localePolicy`, and the runtime package
delivers the locale list available to a rendered widget. The Shell locale
switcher may show only the locales delivered by that runtime package; selected
target locales are not readiness.

Supported social-share channel leaves are `copy`, `sms`, `email`, `whatsapp`,
`telegram`, `signal`, `messenger`, `wechat`, `line`, `slack`, `teams`,
`discord`, `x`, `linkedin`, `facebook`, `reddit`, `instagram`, and `tiktok`.
Missing channel leaves default to enabled for saved-instance compatibility.
If every channel is false, the shared social-share root is removed.

These Settings controls are dead controls unless Builder preview, Roma
save/materialization, public package assembly, and public runtime all respond to
the same state path.

Builder preview must show the social-share menu but suppress real popup and
clipboard actions. Public iframe snippets must include clipboard and popup
permissions (`allow="clipboard-write"` plus sandbox popup permissions) so
social-share actions work when the saved widget is embedded outside Builder.

Shared branding and social share are Shell utilities, not widget Core content.
Do not implement either in `widget.client.js` except by calling the shared
primitive API when the existing shell pattern requires it; do not create
widget-local backlink or share markup.

`{widgetNamespace}.appearance.cardwrapper.*` belongs to widget Core. If a widget
renders repeated cards/items, its Core defaults may include card-wrapper values
and may call the shared surface helper. Do not add card-wrapper defaults to the
global Shell.

### 4) Shell DOM

MUST use this hierarchy:

```text
[data-role="stage"]
  [data-role="pod"]
    [data-role="root"][data-ck-widget="{widgetType}"]
      .ck-headerLayout
        .ck-header
          [data-role="header-title"]
          [data-role="header-subtitle"]
          [data-role="header-cta"]
        .ck-headerLayout__body
          Core DOM
```

Core DOM lives inside `.ck-headerLayout__body`.
Because `.ck-headerLayout__body` lives inside `[data-role="pod"]`, widget Core
must stay inside the shared Pod. Do not render Core as a sibling of the Pod,
outside the Shell, or in a page-section wrapper that creates a second layout
truth.

MUST NOT

- Reparent Header/Header CTA per widget.
- Redesign Stage/Pod/Header Shell markup per widget.
- Put widget Core DOM outside `[data-role="pod"]`.

### 5) Panels

Bob panels are product UX, not arbitrary buckets. Use this placement:

| Panel | Owns | Must not own |
| --- | --- | --- |
| `content` | Header content shared node; Core text/content; Core media choice; repeatable Core items; content toggles that change what exists | spacing, colors, borders, typography, stage/pod layout |
| `layout` | Header layout shared node; Core sizing shared node; Core arrangement, placement, columns, gaps, fit, carousel behavior, responsive behavior | authored copy, colors, borders, font controls |
| `appearance` | Header/Header CTA appearance shared node; Stage/Pod appearance shared nodes; Core visual styling such as card styles, media surface, between-card graphics | content text, item counts, typography roles |
| `typography` | Shared typography panel only | custom text-color controls unless PRD explicitly requires them |
| `settings` | Behavior that affects product/runtime behavior, for example backlink/social-share toggles | styling, layout, authored content |

Rules:

- Content panel comes first because users create/edit content before tuning the
  shell.
- Shell shared nodes and Core controls are mixed in the relevant panel. Shell
  shared nodes appear before Core controls unless the PRD explicitly says the
  Core control must lead.
- Advanced Core controls must be gated behind toggles or mode dropdowns with
  explicit `showIf`.
- Do not put layout controls in Content because it makes the editor look like a
  pile of fields instead of a product.
- Do not put content controls in Appearance because it breaks translation and
  editable-field reasoning.

### 6) Shared Editor Controls

`spec.json.editor.panels[]` is the widget-owned Builder control contract.

MUST

- Use only panels: `content`, `layout`, `appearance`, `typography`,
  `settings`.
- Add controls only for paths defined in `defaults`.
- Gate variant-specific controls via structured `showIf`.
- Use shared nodes for Shell controls:
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
- Use the shared `typography` panel.
- Define `itemKey` and matching i18n strings when the widget has repeatable
  items.
- Put related custom Core field nodes in a `groupId`. Use
  `attrs["group-label"]: ""` when the group exists only to match shared
  ToolDrawer rhythm and should not show a nested group label.

MUST NOT

- Hand-author fields for `header.*`, `headerCta.*`, `coreSize.*`,
  `behavior.showBacklink`, or `behavior.socialShare.*`.
- Put widget-authored `<bob-panel>`, `<tooldrawer-cluster>`,
  `<tooldrawer-field>`, `@slot:`, or escaped editor HTML in `spec.json`.
- Duplicate entire panels per variant.
- Use custom margins/spacers/gaps as editor layout.
- Leave custom Core fields ungrouped inside a cluster when sibling shared
  controls use grouped rhythm.

Clusters own ToolDrawer spacing between sections. Groups own spacing between
related controls inside a section. Groups may be visually unlabeled via
`group-label=""`; that is the correct rhythm mechanism, not a spacing hack.

`settings-behavior` renders the shared Clickeen Branding cluster:
`behavior.showBacklink`, `behavior.socialShare.enabled`, and the gated
`behavior.socialShare.channels.*` toggles. Widgets may add widget-specific
Settings clusters, such as SEO/GEO or runtime behavior, beside this shared
node. They must not duplicate or relabel the shared branding/share controls in
their own Core contract.

### 7) Dieter Field Usage

Widgets do not paste Dieter component markup directly. Widgets declare Bob
field nodes in `spec.json`; Bob compiles those field nodes into Dieter
components.

Field node shape:

```json
{
  "kind": "field",
  "groupId": "example",
  "type": "toggle",
  "path": "faq.example.enabled",
  "label": "Enable example",
  "attrs": { "group-label": "" },
  "showIf": { "path": "faq.mode", "op": "equals", "value": "advanced" }
}
```

Use the existing field type that matches the product job:

| Product job | Field type |
| --- | --- |
| Rich customer-visible text | `textedit` or `dropdown-edit` where the existing Shell/Core pattern uses it |
| Plain one-line string or URL | `textfield` |
| Boolean on/off | `toggle` |
| Numeric value | `valuefield` |
| Pick one enum value | `dropdown-actions`, `choice-tiles`, or `segmented` according to the existing UX pattern |
| Background/fill/color/media fill | `dropdown-fill` with explicit `fill-modes` |
| Border | `dropdown-border` |
| Shadow | `dropdown-shadow` |
| Flat primary repeated item list | `repeater` with `default-item` and an item template |
| Grouped containers, nested lists, or secondary per-object settings | `object-manager` with `default-item`, `label-path`, and an item template |

Account-instance selection is not an approved generic field type. A widget that
references another account-owned instance must wait for a product-owner-approved
Dieter/Bob account-instance selector component and the corresponding Roma
account data contract.

PRD106C3 Split-family media rule: `split-media` uses one real `dropdown-fill`
media field at `splitMedia.media` with `fill-modes: "image,video"` only.
`split-carousel-media` uses a `repeater` at `splitCarouselMedia.items`; each
item template uses exactly one real `dropdown-fill` media field at
`splitCarouselMedia.items.__INDEX__.media` with
`fill-modes: "image,video"` only. Do not use a fake media kind picker, separate
image/video sibling controls, `object-manager` for carousel visuals, or any
instance selector.

When a repeater has hard product cardinality, declare the same `min`/`max`
attrs in the Builder control and enforce them at create/save. For
`split-carousel-media`, the repeater is `min: "2"` and `max: "6"`.
Item IDs are created by the repeater add action for newly added rows; do not
use generic Bob normalization `idRules` to heal missing IDs in saved/imported
state.

MUST

- Use only field types supported by current Bob/Dieter code.
- Provide `path` for every state-bound field.
- Provide `label` for every visible field.
- Provide `groupId` for custom Core fields in clusters, with
  `attrs["group-label"]` empty or meaningful according to whether the group
  should show a nested label.
- Provide `options` for enum controls and ensure the default value is one of
  those options.
- Provide explicit `fill-modes` for every `dropdown-fill`.
- Use `repeater` for flat primary content arrays, even when each item has
  multiple fields, media, links, or per-item styling. Cards, FAQ questions, Logo
  Showcase logos, and carousel visuals are repeater-shaped.
- Use `object-manager` for grouped containers, arrays that contain nested
  repeated lists, or secondary per-object settings. FAQ sections and Logo
  Showcase strips are object-manager-shaped.
- Put repeater/object-manager item fields under the array item path using
  `__INDEX__`, for example `{widgetNamespace}.items.__INDEX__.title`.
- Repeater/object-manager item templates may contain normal supported Builder
  fields, including `showIf`-gated variant fields. The compiler must preserve
  nested `showIf`. A widget is broken if every variant field appears at once.
- Repeater/object-manager Dieter runtime must forward Bob's hydrator
  dependencies to child controls. Nested `dropdown-fill` media fields require
  the same `accountAssets` context as top-level media fields; rendering the row
  without that context creates an inert control.
- Keep value-control row rhythm consistent. `dropdown-fill`, including media
  selectors, aligns as label-left/value-right like the other drawer dropdown
  controls.
- Keep Dieter control choice boring and consistent with FAQ/Shell patterns.

MUST NOT

- Add raw `<diet-*>` markup to widget source.
- Add a new field type as a workaround.
- Use `textfield` for rich translated copy.
- Use `dropdown-fill` without `fill-modes`.
- Use direct CSS or runtime-only controls that Bob cannot represent.

### 8) showIf And Dependency Rules

Variant controls must be visible only when they apply.

Supported condition shapes:

- `{ "path": "x.y", "op": "isTrue" }`
- `{ "path": "x.y", "op": "isFalse" }`
- `{ "path": "x.y", "op": "equals", "value": "value" }`
- `{ "path": "x.y", "op": "notEquals", "value": "value" }`
- `{ "path": "x.y", "op": "in", "value": ["a", "b"] }`
- `{ "all": [ ...conditions ] }`
- `{ "any": [ ...conditions ] }`
- `{ "call": "hasLinks", "args": [{ "path": "..." }] }`

MUST

- Gate every dependent field behind its controlling toggle or mode.
- Gate array manager fields when the array is inactive.
- Gate media fields by media kind.
- Gate carousel controls behind the carousel-enabled toggle only when a widget
  PRD explicitly supports an optional carousel mode. Concrete carousel widgets,
  such as `split-carousel-media`, are always carousel widgets and must not add
  an enable-carousel toggle.
- Gate custom sizing fields behind `coreSize.mode`.
- Linked-value controls must use the shared Shell paths and the shared Bob
  linked-op expander. Turning a link toggle on/off must reveal the relevant
  one-value or per-side/per-corner controls immediately through `show-if`.
- Ensure hidden controls still have valid defaults because they may become
  visible later.

MUST NOT

- Duplicate panels for variants.
- Rely on runtime to ignore irrelevant controls.
- Use string-based `show-if` in `spec.json`; use structured `showIf`.

### 9) Stage/Pod Appearance

Global appearance surface rule:

Stage:

- Background fill: color, gradient, image, video.
- Inside shadow only.
- No border.
- No radius.

Pod:

- Background fill: color, gradient, image, video.
- Border.
- Outside shadow and inside shadow layer control.
- Radius.

Item/card surfaces:

- Background fill: color and gradient only unless PRD says otherwise.
- Border.
- Outside shadow and inside shadow layer control.
- Radius.

If a widget exposes `{widgetNamespace}.appearance.cardwrapper.*`, it must use
`window.CKSurface.applyCardWrapper(...)` and the shared `--ck-cardwrapper-*`
CSS vars.

### 10) Header And Header CTA

Shell widgets MUST use the shared Header/Header CTA primitive.

Required composed state paths include:

- `header.enabled`
- `header.title`
- `header.showSubtitle`
- `header.subtitleHtml`
- `header.alignment`
- `header.placement`
- `header.ctaPlacement`
- `header.gap`
- `header.innerGap`
- `header.textGap`
- `headerCta.enabled`
- `headerCta.label`
- `headerCta.href`
- `headerCta.openMode`
- `headerCta.iconEnabled`
- `headerCta.iconName`
- `headerCta.iconPlacement`
- `appearance.headerCta.background`
- `appearance.headerCta.textColor`
- `appearance.headerCta.border`
- `appearance.headerCta.radius`
- `appearance.headerCta.sizePreset`
- `appearance.headerCta.paddingLinked`
- `appearance.headerCta.paddingInline`
- `appearance.headerCta.paddingBlock`
- `appearance.headerCta.iconSizePreset`
- `appearance.headerCta.iconSize`

`header.title`, `header.subtitleHtml`, and `headerCta.label` belong in
`editable-fields.json` when the shared Header/Header CTA content is exposed.

The shared Header CTA is not a Core body action. If the widget itself is a Call
to Action body, or if the widget Core exposes a primary body button, the content
and behavior for that action must be widget-owned Core state such as:

```text
calltoaction.action.enabled
calltoaction.action.label
calltoaction.action.href
calltoaction.action.openMode
calltoaction.action.iconEnabled
calltoaction.action.iconName
calltoaction.action.iconPlacement
```

Those Core paths need normal Core controls, Binding Map rows, runtime bindings,
and editable-field declarations for customer-visible text.

Header placement uses the Shell system. Do not invent widget-specific header
placement names.

Canonical Call to Action Core example:

```json
{
  "calltoaction": {
    "headline": "Build your next section in minutes",
    "showSupportingText": true,
    "supportingTextHtml": "Start with a polished Clickeen widget.",
    "action": {
      "enabled": true,
      "label": "Get started",
      "href": "#",
      "openMode": "same-tab",
      "iconEnabled": true,
      "iconName": "arrowshape.turn.up.right",
      "iconPlacement": "right"
    },
    "layout": {
      "alignment": "center",
      "gap": 18,
      "textWidth": 760
    }
  }
}
```

The matching editor controls belong in mixed panels:

- `content`: shared `header-content`, then `calltoaction.headline`,
  `calltoaction.supportingTextHtml`, `calltoaction.action.*`.
- `layout`: shared `header-layout`, shared `core-size`, then
  `calltoaction.layout.alignment`, `calltoaction.layout.gap`,
  `calltoaction.layout.textWidth`.
- `appearance`: shared `header-appearance`, then any Core-specific body action
  appearance paths such as `calltoaction.actionStyle.*`.

### 11) Typography

MUST

- Define `defaults.typography.roles` for every visible text role.
- Always include Shell roles: `title`, `body`, `button`, `localeSwitcher`.
- Define `defaults.typography.roleScales` for every non-global role.
- Call `window.CKTypography.applyTypography(state.typography, root, roleMap,
  runtimeContext?)`.
- Pass runtime locale when available.
- Use typography CSS vars in `widget.css`.

Global roles with built-in scale behavior are `title`, `body`, `section`,
`question`, `answer`, and `button`. Other roles need explicit role scales.

MUST NOT

- Add separate text color controls outside typography unless PRD requires it.
- Invent typography behavior per widget.

### 12) Themes

Themes are global, editor-only, and already sourced from
`tokyo/product/themes/themes.json`.

Widget work MUST include the existing theme hook/control through the shared
appearance contract.

Widget work MUST NOT create or change global themes unless the PRD explicitly
owns theme changes.

Runtime does not interpret themes. Runtime reads final state values.

### 13) Preview And Runtime

MUST

- Register with `window.CKWidgetRuntime.register(widgetType, init)`.
- Bind Bob preview updates with `runtime.bindStateUpdates(...)`.
- Accept that `runtimeContext.state` can be absent when Bob first loads the
  iframe.
- Apply initial state only when present.
- Use shared preview localization when translated preview values are provided.
- Apply shared Shell primitives, then Core-specific DOM updates.
- Scope all selectors to the widget root.
- Keep `applyState(state)` deterministic.

MUST NOT

- Require initial state during iframe boot.
- Fetch product state from runtime.
- Use timers, randomness, or network fetches inside `applyState`.
- Build local translation or locale fallback systems.

### 14) Editable Fields

`editable-fields.json` is the widget Core declaration for customer-visible
editable/translatable text. Shared Shell editable text paths are declared by
the Shell contract.

MUST

- Declare every customer-visible text primitive.
- Use `[]` for repeatable declarations, for example
  `{widgetNamespace}.items[].title`.
- Keep Core paths aligned with widget Core `spec.json.defaults`. Shared Shell
  text paths must align with Shell factory defaults and Shell editable-field
  declarations.
- Reject prohibited segments: `__proto__`, `constructor`, `prototype`.

MUST NOT

- Declare translation fields in `spec.json.overlays.text[]`.
- Create `localization.json`, layer path sidecars, or a second path schema.
- Send repeatable declaration paths to producers.

### 15) Limits

`limits.json` maps widget Core operations/counts to existing
`packages/ck-policy/entitlements.matrix.json` keys.

MUST

- Use existing entitlement keys.
- Map repeatable Core arrays and operations that affect plan limits.
- Fail visibly if a required entitlement key does not exist.

MUST NOT

- Invent new policy keys during widget work unless the PRD explicitly owns
  policy changes.
- Enforce plan limits through runtime hiding or product-side guesswork.

### 16) Assets

MUST

- Store account-owned asset bytes under `accounts/{accountPublicId}/assets/`.
- Materialize runtime asset references as root-relative
  `/assets/account/{accountPublicId}/{assetRef}` paths.
- Authoring media fills use `assetRef` for account-owned assets. Product-owned
  widget defaults may use an already-materialized declared `src` only when the
  source belongs to the widget/runtime asset contract.

MUST NOT

- Ship defaults containing `data:` or `blob:` URLs.
- Store account-owned assets under widget software folders.

### 17) Binding Map

Every ToolDrawer control path has exactly one Binding Map row.

Mechanism is one of:

- CSS var.
- Data attribute variant.
- Deterministic DOM update.

Template:

| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |
| `{widgetNamespace}.layout` | Core root | data-attr | `coreRoot.setAttribute('data-layout', state[widgetNamespace].layout)` |
| `{widgetNamespace}.items[].title` | `[data-role="item-title"]` | dom | `el.textContent = item.title` |
| `{widgetNamespace}.gap` | Core root | css-var | `root.style.setProperty('--ck-core-gap', value)` |

---

## Page Composer Compatibility

Every widget package must be stackable by Page Composer.

MUST

- Materialize into stable browser files: `index.html`, `styles.css`,
  `runtime.js`.
- Keep per-instance runtime state isolated.
- Use stable Shell/Core CSS and runtime module boundaries so Page Composer can
  concatenate and dedupe shared Shell code.
- Avoid singleton global state except documented `CK_*` runtime registries.

MUST NOT

- Add Page Composer-specific branches inside widget Core.
- Add duplicate Shell code per widget.
- Require Tokyo to compose pages.

---

## Verification Gates

Required before final response:

- Pre-code Core manifest exists.
- Every editor path exists in defaults.
- Every editor path has one Binding Map row.
- Every runtime-read path exists in defaults.
- Every customer-visible text path exists in `editable-fields.json`.
- Every non-global typography role has `roleScales`.
- `limits.json` maps to existing entitlement keys when limits apply.
- No Shell aliases are introduced.
- `settings-behavior` is present for Shell widgets and no widget-authored
  editor fields control `behavior.showBacklink` or `behavior.socialShare.*`.
- Branding smoke proves `behavior.showBacklink: false` removes/hides the shared
  badge and `true` restores it.
- Social-share smoke proves `behavior.socialShare.enabled` creates/removes the
  shared menu, `behavior.socialShare.channels.*` filters actions, Builder
  preview does not attempt popup/clipboard actions, and public iframe snippets
  include clipboard/popup permissions.
- No shared runtime/Bob/Roma/Tokyo-worker/Prague/Venice/Dieter edits were made
  unless the PRD explicitly owned that shared surface.
- `pnpm validate:widgets` passes.
- `pnpm cf:preflight` passes before Cloudflare R2 operations.
- Relevant workspace typecheck passes.
- Bob compile/preview for the touched widget is verified on desktop and mobile,
  or the missing verification is reported as a blocker.
