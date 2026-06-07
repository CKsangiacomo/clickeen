# Widget Build Contract

STATUS: CANONICAL (AI-executable)
OWNER: Platform / Widget System

This contract defines how Clickeen widgets are built.

Normal widgets are not standalone inventions. They are:

```text
Widget Shell + Widget Core
```

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

Panels are organized by the user's editing job. Ownership is enforced by path:
Shell-owned paths come from shared nodes, and widget-specific body paths live in
`defaults.core`.

The FAQ widget proves the Shell/runtime model. `packages/widget-shell/` is the
named Shell contract authority. CTA, Cards, and Split prove the intended
`defaults.core` namespace. A widget folder under `tokyo/product/widgets/` is
the product source location for that widget's Core plus its materialized source
files.

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
- CTA widget source as the simple `defaults.core` example:
  `tokyo/product/widgets/cta/*`.
- Cards and Split widget source as repeated-item and media Core examples:
  `tokyo/product/widgets/cards/*`, `tokyo/product/widgets/split/*`.
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
- Validation cannot run or fails.

---

## Shell/Core Boundary

### Shell-Owned

Shell state and behavior are owned by `packages/widget-shell/` and the shared
runtime/compiler modules it names.

Shell-owned state families:

- `header.*`
- `cta.*`
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

Shell-owned UX/runtime:

- Stage/Pod DOM, CSS, defaults, and shared primitive calls.
- Header title/subtitle and the optional Header CTA primitive.
- Header CTA styling and behavior.
- Typography primitive and locale-aware typography context.
- Theme hook/control.
- Locale switcher and preview localization plumbing.
- Branding/backlink behavior.
- Runtime registration, update binding, and message plumbing.
- Shared script/style load order.
- Shared surface/card-wrapper primitive.
- Core sizing.

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

The user-facing UI must not show the word "Core" unless the PRD explicitly asks
for it. Use `uiLabels.core.*` so Bob can display "FAQs", "Visual", "Cards",
"Logos", or another widget-appropriate label.

Shell Header controls and Core controls live together in the same product
panels. For example, Content contains the shared Header content node and then
the widget-owned Core content controls; Layout contains shared Header/CoreSize/
StagePod controls and then Core layout controls. The panel is organized by user
job, not by ownership.

Top-level `cta.*` is the optional shared Header CTA. It is not the body action
for a CTA widget or any other widget whose primary product action belongs to
the Core. Body actions must use Core-owned paths such as `core.button.*`.

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
- cta.* only for optional Header CTA
- stage.*
- pod.*
- coreSize.*
- typography.*
- localeSwitcher.*
- shared appearance.*
- shared behavior.*

Core paths:
- core...

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

- Keep Shell defaults intact for Shell widgets.
- Define `defaults.core` for every normal Shell/Core widget.
- Put widget-specific state in Core-owned paths under `core.*`.
- Define arrays as `path[]` and items as `path[i]`.
- Provide stable item identity for repeated content.
- Provide a stable DOM Array Container role and DOM Item Container role for each
  array.
- Provide stable `data-role` for every runtime-mutated element.
- Define `uiLabels.core.singular`, `uiLabels.core.plural`, and
  `uiLabels.core.sizeCluster`.
- Define `coreSize.mode`, `coreSize.fixedHeight`, `coreSize.minHeight`,
  `coreSize.preferredVw`, and `coreSize.maxHeight` when the Shell contract is
  used.

MUST NOT

- Use widget root as an item.
- Update DOM elements without stable `data-role`.
- Add duplicate Shell paths under Core.
- Use `header.*` or top-level `cta.*` as the widget's only visible product body.
- Add old aliases: `headline`, `subheadline`, `copy`, `button`,
  `primaryCta`, `secondaryCta`, `ctaText`, `ctaUrl`, `layout.copyWidth`,
  `layout.bodyWidth`, or `layout.variant`.
- Add fallback/healing logic for missing state.

### 2A) Saved Instance Compatibility

Existing account instances are saved source. New widget defaults do not
automatically appear in old saved state just because `spec.json.defaults`
changed.

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

MUST

- Define every editor-controlled path in `defaults` before adding the control.
- Define every runtime-read path in `defaults` before reading it.
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
- Include starter items when the widget would otherwise render as a blank broken
  product. Starter content must be useful product starter content, not lorem
  ipsum or hidden test data.
- Keep Shell defaults aligned with the Shell contract. Core defaults extend the
  widget; they do not rename Shell state.

MUST NOT

- Add a ToolDrawer control for a path missing from defaults.
- Add runtime guards that silently fill missing defaults.
- Use empty defaults to dodge required schema work.
- Store account-owned asset bytes or private account references in product
  defaults.

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

MUST NOT

- Reparent Header/CTA per widget.
- Redesign Stage/Pod/Header Shell markup per widget.

### 5) Panels

Bob panels are product UX, not arbitrary buckets. Use this placement:

| Panel | Owns | Must not own |
| --- | --- | --- |
| `content` | Header content shared node; Core text/content; Core media choice; repeatable Core items; content toggles that change what exists | spacing, colors, borders, typography, stage/pod layout |
| `layout` | Header layout shared node; Core sizing shared node; Core arrangement, placement, columns, gaps, fit, carousel behavior, responsive behavior | authored copy, colors, borders, font controls |
| `appearance` | Header/CTA appearance shared node; Stage/Pod appearance shared nodes; Core visual styling such as card styles, media surface, between-card graphics | content text, item counts, typography roles |
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
  - `header-content-no-cta`
  - `header-layout`
  - `header-layout-no-cta`
  - `core-size`
  - `header-appearance`
  - `header-appearance-no-cta`
  - `stagepod-layout`
  - `stagepod-appearance`
  - `stagepod-corners`
- Use the shared `typography` panel.
- Define `itemKey` and matching i18n strings when the widget has repeatable
  items.

MUST NOT

- Hand-author fields for `header.*`, `cta.*`, or `coreSize.*`.
- Put widget-authored `<bob-panel>`, `<tooldrawer-cluster>`,
  `<tooldrawer-field>`, `@slot:`, or escaped editor HTML in `spec.json`.
- Duplicate entire panels per variant.
- Use custom margins/spacers/gaps as editor layout.

Clusters own ToolDrawer spacing. Groups are optional labels, not spacing hacks.

### 7) Dieter Field Usage

Widgets do not paste Dieter component markup directly. Widgets declare Bob
field nodes in `spec.json`; Bob compiles those field nodes into Dieter
components.

Field node shape:

```json
{
  "kind": "field",
  "type": "toggle",
  "path": "core.example.enabled",
  "label": "Enable example",
  "attrs": {},
  "showIf": { "path": "core.mode", "op": "equals", "value": "advanced" }
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
| Manage repeatable complex items | `object-manager` with `default-item`, `label-path`, and an item template |
| Simple repeatable item editing where an existing widget already uses it | `repeater` |
| Select another account instance | `instance-picker` |

MUST

- Use only field types supported by current Bob/Dieter code.
- Provide `path` for every state-bound field.
- Provide `label` for every visible field.
- Provide `options` for enum controls and ensure the default value is one of
  those options.
- Provide explicit `fill-modes` for every `dropdown-fill`.
- Use `object-manager` for arrays whose item has multiple fields, media, links,
  or per-item styling.
- Put object-manager item fields under the array item path using
  `__INDEX__`, for example `core.items.__INDEX__.title`.
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
- `{ "call": "hasLinks", "args": [{ "path": "..." }] }`

MUST

- Gate every dependent field behind its controlling toggle or mode.
- Gate array manager fields when the array is inactive.
- Gate media fields by media kind.
- Gate carousel controls behind the carousel-enabled toggle.
- Gate custom sizing fields behind `coreSize.mode`.
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

If a widget exposes `appearance.cardwrapper.*`, it must use
`window.CKSurface.applyCardWrapper(...)` and the shared `--ck-cardwrapper-*`
CSS vars.

### 10) Header And CTA

Shell widgets MUST use the shared Header/CTA primitive.

Required state paths include:

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
- `cta.enabled`
- `cta.label`
- `cta.href`
- `cta.openMode`
- `cta.iconEnabled`
- `cta.iconName`
- `cta.iconPlacement`
- `appearance.ctaBackground`
- `appearance.ctaTextColor`
- `appearance.ctaBorder`
- `appearance.ctaRadius`
- `appearance.ctaSizePreset`
- `appearance.ctaPaddingLinked`
- `appearance.ctaPaddingInline`
- `appearance.ctaPaddingBlock`
- `appearance.ctaIconSizePreset`
- `appearance.ctaIconSize`

`header.title`, `header.subtitleHtml`, and `cta.label` belong in
`editable-fields.json` when the shared Header/CTA content is exposed.

The shared Header CTA is not a Core body CTA. If the widget itself is a CTA
body, or if the widget Core exposes a primary body button, the content and
behavior for that action must be Core state such as:

```text
core.button.enabled
core.button.label
core.button.href
core.button.openMode
core.button.iconEnabled
core.button.iconName
core.button.iconPlacement
```

Those Core paths need normal Core controls, Binding Map rows, runtime bindings,
and editable-field declarations for customer-visible text.

Header placement uses the Shell system. Do not invent widget-specific header
placement names.

Canonical CTA Core example:

```json
{
  "core": {
    "title": "Build your next section in minutes",
    "showCopy": true,
    "copyHtml": "Start with a polished Clickeen widget.",
    "button": {
      "enabled": true,
      "label": "Get started",
      "href": "#",
      "openMode": "same-tab",
      "iconEnabled": true,
      "iconName": "arrowshape.turn.up.right",
      "iconPlacement": "right"
    },
    "alignment": "center",
    "gap": 18,
    "textWidth": 760
  }
}
```

The matching editor controls belong in mixed panels:

- `content`: shared `header-content`, then `core.title`, `core.copyHtml`,
  `core.button.*`.
- `layout`: shared `header-layout`, shared `core-size`, then
  `core.alignment`, `core.gap`, `core.textWidth`.
- `appearance`: shared `header-appearance`, then any Core-specific button/body
  appearance paths.

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

`editable-fields.json` is the only widget-owned declaration for
customer-visible editable/translatable text.

MUST

- Declare every customer-visible text primitive.
- Use `[]` for repeatable declarations, for example
  `core.items[].title`.
- Keep paths aligned with `spec.json.defaults`.
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
| `core.layout` | Core root | data-attr | `coreRoot.setAttribute('data-layout', state.core.layout)` |
| `core.items[].title` | `[data-role="card-title"]` | dom | `el.textContent = item.title` |
| `core.gap` | Core root | css-var | `root.style.setProperty('--ck-core-gap', value)` |

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
- No shared runtime/Bob/Roma/Tokyo-worker/Prague/Venice/Dieter edits were made
  unless the PRD explicitly owned that shared surface.
- `pnpm validate:widgets` passes.
- Relevant workspace typecheck passes.
- Bob compile/preview for the touched widget is verified on desktop and mobile,
  or the missing verification is reported as a blocker.
