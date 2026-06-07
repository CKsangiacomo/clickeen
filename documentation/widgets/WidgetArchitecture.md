# Widget Architecture

STATUS: REFERENCE (AI-executable)

Purpose: system-level reference for widget runtime and data flow.

Related:

- `documentation/widgets/WidgetBuildContract.md`
- `documentation/ai/BUILD_Widget.md`
- `documentation/architecture/CONTEXT.md`
- `Execution_Pipeline_Docs/02-Executing/PRD106A2_WidgetShellExtraction.md`

---

## Non-Negotiable: Builder Panels Are Mixed

The Builder panels are mixed, not "shell panel then core panel":

- `content`: shared header content controls plus widget core content controls.
- `layout`: shared header/core-size/stage-pod controls plus widget core layout
  controls.
- `appearance`: shared header/CTA/stage-pod appearance plus widget core
  appearance controls.
- `typography`: shared typography panel, but it edits roles declared by both
  shell and core.
- `settings`: shared behavior plus widget-specific runtime behavior if needed.

Panel placement is organized by the user's editing job. Ownership still matters:
Shell paths stay in shared nodes, and widget-specific body paths stay in
`defaults.core`.

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
- Account-owned instance source and generated public files live under
  `accounts/{accountPublicId}/instances/{instanceId}/`.
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

---

## Shell/Core Model

The Shell/Core model is two ownership layers in one widget, not two separate
Builder panels.

FAQ is the proven Shell/runtime source example. It is gold for Shell DOM shape,
strict runtime registration, state-update binding, editable text declarations,
repeated content behavior, and preview localization.

CTA, Cards, and Split prove the intended Core namespace: widget-specific product
content, layout, and behavior live under `defaults.core`, while shared
Stage/Pod/Header/CoreSize/Typography utilities stay in Shell-owned paths.

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
- Runtime registration/update binding.
- Shared script/style module list.
- Shared surface/card-wrapper primitive.
- Core sizing.

Shell state families:

- `header.*`
- `cta.*` for the optional Header CTA primitive.
- `stage.*`
- `pod.*`
- `appearance.cta*`
- `appearance.localeSwitcher*`
- `appearance.podBorder`
- `appearance.cardwrapper.*`
- `typography.*`
- `localeSwitcher.*`
- `behavior.showBacklink`
- `behavior.socialShare.enabled`
- `uiLabels.core.*`
- `coreSize.*`

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
state and save policy use the `widget.socialShare.enabled` entitlement, public
package assembly includes share markup plus `shared/socialShare.css` and
`shared/socialShare.js`, and Builder preview has an equivalent preview surface.

### Core

Core is the widget-specific part. Every normal Shell/Core widget has a
`defaults.core` object for the product body that makes that widget different.
The shared Header can frame the body, but it is not a substitute for Core.

- FAQ Core: FAQ sections/questions/answers and FAQ behavior.
- Split Core: image/video/embedded-widget visual items and carousel behavior.
- Cards Core: cards, card media/link/style options, and between-card graphics.
- Big Bang Core: large typographic statement content.
- CTA Core: CTA eyebrow/title/copy/button content, CTA body layout, and CTA
  body button styling.

Core DOM lives inside `.ck-headerLayout__body`. In Bob's UI, the Core should be
labeled with the widget-appropriate noun through `uiLabels.core.*`, not exposed
to users as "Core".

Core must not read product meaning from Shell-only paths. `header.*` and
top-level `cta.*` remain the optional shared Header region. If the widget's
actual body has a call-to-action, that action is widget Core state such as
`core.button.*`.

---

## Current Widget Model Inventory

Use this table before changing an existing widget. Active callers do not prove
that an old body namespace is correct product architecture.

| Widget | Current model | Body state authority | What to copy |
| --- | --- | --- | --- |
| `cta` | New Core model | `defaults.core` | Copy for simple body CTA state, mixed panels, and Core DOM bindings. |
| `cards` | New Core model | `defaults.core` | Copy for repeated Core items and Core appearance/layout controls. |
| `split` | New Core model | `defaults.core` | Copy for media/visual Core state inside the shared Shell. |
| `faq` | Shell-proven, legacy body namespace | `sections[]` | Copy Shell runtime and repeated-content behavior, not the body namespace. |
| `big-bang` | Transitional | `bigBang.*` | Migrate to `core.*` when refactored; do not copy `bigBang.*` for new work. |
| `countdown` | Old body namespace | `timer.*` | Migration target; do not copy for new work. |
| `logoshowcase` | Old body namespace | `strips[]` | Migration target; do not copy for new work. |

New widgets and refactored widgets must use `defaults.core` for the widget body.
Legacy body namespaces may remain only when a task explicitly defers their
migration.

---

## Saved Instance Compatibility

Changing widget source does not rewrite every saved account instance. Existing
instances may post runtime state that lacks newly added `core.*` paths,
typography roles, role scales, or appearance objects.

Bob session normalization deep-merges compiled widget defaults into loaded
instance state before Builder preview receives it, then applies declared
normalization rules. This is the named load compatibility boundary for adding
new defaulted paths such as `core.*` to old saved instances. Therefore a widget
refactor that adds a new body namespace or typography role must include one
explicit compatibility path:

- Migrate saved account instance source at the account/storage boundary.
- Add a named load/materialization normalization that creates the missing
  parent state before preview/runtime receives it. Builder session load already
  deep-merges compiled defaults; server/public materialization must match when
  old saved source is published.
- Add a temporary widget-local runtime bridge that renders the old saved state
  shape while new instances use the new Core state.

A compatibility bridge is not permission to create a second product truth. It
must be scoped to the old saved shape, keep the new `defaults.core` model as the
surviving authority, and be removed when stored instances have been migrated.

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
- `header-content-no-cta`
- `header-layout`
- `header-layout-no-cta`
- `core-size`
- `header-appearance`
- `header-appearance-no-cta`
- `stagepod-layout`
- `stagepod-appearance`
- `stagepod-corners`
- shared `typography` panel

Widget Core controls are normal field nodes, but every field path must exist in
`defaults.core` and have one Binding Map row. Existing non-`core.*` widget body
paths are legacy migration targets, not the model for new or refactored widgets.

The normal panel pattern is:

- `content`: shared Header content node, then Core content controls.
- `layout`: shared Header/CoreSize/StagePod nodes, then Core layout controls.
- `appearance`: shared Header/CTA/StagePod nodes, then Core appearance controls.
- `typography`: shared typography panel for all declared Shell and Core text
  roles.
- `settings`: shared behavior plus Core runtime behavior controls.

Clusters and groups define ToolDrawer spacing. Widgets must not invent editor
spacing through margins, spacers, or fake groups.

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
- complex repeated items: `object-manager`
- embedded instance selection: `instance-picker`

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
| `shared/branding.js` | Backlink behavior |
| `shared/socialShare.js` / `shared/socialShare.css` | Optional social share support |

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
- Hand-authored Header/CTA/CoreSize controls.
- Local translation resolvers/fetchers.
- Alternate package formats.
- Public locale assumptions beyond the current runtime payload.
- Duplicate editable-field schemas.
- Prague block/accountInstanceRef architecture.
- Runtime healing for missing state.
