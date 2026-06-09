# AI Execution Guide - Build A Widget

STATUS: EXECUTION GUIDE (AI ONLY)

This is a strict execution guide. It is not a design doc.

The AI does not design a widget from scratch. A normal Clickeen widget is:

```text
FAQ-proven Widget Shell + widget-specific Core
```

The Shell is the shared product substrate. The Core is the actual different
part of the widget.

If anything is unclear or missing, stop and ask the human before coding.

---

## Product Truth

The real authoring path is:

```text
Roma account opens one instance -> Bob edits in memory -> Roma saves/materializes -> Tokyo stores exact submitted source/artifacts
```

Tokyo stores widget software and account artifacts. Tokyo does not own widget
architecture, Page Composer behavior, editor UX, or product decisions.

Builder is the only real authoring surface. Demo, Prague, Minibob, and funnel
surfaces are not account authoring truth.

---

## Step Gate

If a PRD has a Current Step Gate, execute exactly that step. Do not start the
next step until the required green evidence exists.

Long reference sections are context, not execution permission. A blocker report
does not unlock the next step.

The goal is not to accommodate old drift. If current code contradicts the
intended architecture, delete it, fence it behind the named surviving boundary,
or stop. Do not preserve it with compatibility paths.

---

## Shell/Core Boundary

The FAQ widget is the proven Shell source. `packages/widget-shell/` is the named
Shell contract authority.

Shell-owned:

- Stage/Pod state, DOM, CSS, defaults, and shared primitive calls.
- Header title/subtitle/CTA behavior.
- CTA state and editor controls.
- Typography primitive, locale-aware typography context, and required role
  scale rules.
- Theme hook/control. Runtime reads final state only.
- Locale switcher and preview localization plumbing.
- Branding/backlink behavior.
- Runtime registration, state-update binding, and message plumbing.
- Shared script/style load order.
- Shared surface/card-wrapper primitive usage.
- Core sizing state and shared editor control.

Core-owned:

- Widget-specific content structure.
- Widget-specific arrays/items and stable item identity.
- Widget-specific DOM inside `.ck-headerLayout__body`.
- Widget-specific render/update logic.
- Widget-specific layout behavior inside the Core.
- Widget-specific CSS classes/vars.
- Binding Map rows for widget-specific controls.
- `editable-fields.json` paths for customer-visible Core text.
- `limits.json` mappings to existing entitlement keys.

If a requirement cannot be placed cleanly in Core, stop. Do not modify or
reinvent Shell.

---

## Stop Conditions

Stop before changing files if:

- `widgetType` is not explicit.
- The relevant PRD is missing or conflicts with
  `documentation/widgets/WidgetBuildContract.md`.
- You cannot classify every requested behavior as Shell-owned or Core-owned.
- You cannot produce the pre-code manifest listed below.
- The request requires Shell changes, new shared controls, new shared runtime,
  new theme behavior, locale-switcher behavior, preview-localization behavior,
  branding behavior, runtime message behavior, or package assembly changes, and
  the PRD does not explicitly own that shared surface.
- The request needs a new Dieter primitive/token.
- Validation cannot be run or fails.

---

## Allowed Inputs

Read these first:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetArchitecture.md`
- Relevant PRD/current step gate.
- `packages/widget-shell/src/*`
- `tokyo/product/widgets/faq/*` as the Shell/Core gold example.
- Target widget folder: `tokyo/product/widgets/{widgetType}/`
- Bob shared compiler nodes only when proving editor behavior:
  `bob/lib/compiler/editor-contract.ts` and `bob/lib/compiler/modules/*`.
- Roma package assembly only when proving materialized output:
  `roma/lib/widget-public-package.ts`.
- Entitlement matrix only when binding `limits.json`:
  `packages/ck-policy/entitlements.matrix.json`.

Do not browse unrelated code to invent a new architecture.

---

## Allowed Outputs

Default widget work may edit only:

- `tokyo/product/widgets/{widgetType}/spec.json`
- `tokyo/product/widgets/{widgetType}/widget.html`
- `tokyo/product/widgets/{widgetType}/widget.css`
- `tokyo/product/widgets/{widgetType}/widget.client.js`
- `tokyo/product/widgets/{widgetType}/editable-fields.json` when the widget has
  customer-visible text.
- `tokyo/product/widgets/{widgetType}/limits.json` when Core controls or arrays
  affect limits.

Do not create widget-local helper files unless the PRD explicitly names them.

Do not edit shared runtime, Bob, Roma, Tokyo-worker, Venice, Prague, Dieter, or
`packages/widget-shell/` during normal Core work. Shared edits require their own
PRD step and green evidence.

---

## Forbidden Actions

- Do not reimplement Stage/Pod, Header, Header CTA, Core sizing, Typography,
  Locale switcher, Branding, themes, preview localization, or runtime binding per
  widget.
- Do not hand-author editor fields for `header.*`, `headerCta.*`, or
  `coreSize.*`; use shared nodes.
- Do not add Shell aliases such as `headline`, `subheadline`, `copy`, `button`,
  `primaryCta`, `secondaryCta`, `ctaText`, `ctaUrl`, `layout.copyWidth`,
  `layout.bodyWidth`, or `layout.variant`.
- Do not add `block`, `section`, `slot`, `accountInstanceRef`, `blockId`, or
  `blockType` as product architecture nouns.
- Do not add fallback/healing defaults in runtime.
- Do not add local translation resolvers/fetchers.
- Do not create another editable-field schema.
- Do not invent package assembly, public locale policy, or page composition
  behavior inside a widget.
- Do not use `widgetCode` or widget folder names as account instance storage
  locators.

---

## Execution Steps

### Step 1 - Produce The Pre-Code Manifest

Before coding, write a short manifest for the current step:

- Shell-owned paths kept from the Shell contract.
- Core-owned paths introduced or changed by this widget, under a
  widget-specific namespace such as `calltoaction.*`.
- Array paths and stable item identity fields.
- DOM role map for Core containers/items/subparts.
- Panel placement for every Core control.
- Dieter field type for every Core control.
- Binding Map row for every Core editor control.
- `editable-fields.json` paths for every customer-visible Core text field.
- `limits.json` paths and existing entitlement keys.
- Typography roles and required `roleScales` for non-global roles.
- Default value for every Core path and why that value is the intended starter
  state.

If any row is ambiguous, stop.

### Step 2 - Update `spec.json`

Rules:

- Keep Shell defaults intact: `header`, `headerCta`, `stage`, `pod`, `appearance`,
  `typography`, `localeSwitcher`, `behavior`, `uiLabels.core`, and `coreSize`
  when the widget uses the Shell contract.
- Core state must live in widget-owned Core paths under a widget-specific
  namespace. Do not introduce new generic `core.*` body paths when similar
  Shell elements exist.
- Every editor path must exist in `defaults`.
- Header/Header CTA/CoreSize controls must use shared editor nodes:
  `header-content`, `header-layout`, `core-size`, `header-appearance`,
  `stagepod-layout`, `stagepod-appearance`, `stagepod-corners`.
- `typography.roles` must include Shell roles `title`, `body`, `button`, and
  `localeSwitcher`.
- Any typography role outside global roles must define
  `typography.roleScales.{role}`.
- `appearance.theme` uses the existing theme hook only. Creating or changing
  global themes is out of scope.
- Defaults are product starter state, not placeholders. Every control path and
  every runtime-read path must exist in `defaults`.
- Repeatable Core items must have stable identity and useful starter content
  when the widget would otherwise render blank.
- Toggle defaults must match the intended starter UX.
- Dropdown defaults must be valid option values.
- Fill/border/shadow defaults must use the existing value shape used by the
  matching Shell or FAQ control family.
- Core editor controls must sit in the correct panel:
  - `content`: authored content, item managers, media kind/content, content
    toggles.
  - `layout`: arrangement, placement, fit, gaps, sizing, carousel behavior.
  - `appearance`: fills, borders, shadows, radius, per-item visual styling,
    between-item graphics.
  - `typography`: shared typography panel only.
  - `settings`: runtime behavior toggles.
- Dieter components are used through Bob field nodes only. Do not paste raw
  Dieter markup.
- Use the correct existing field type: `textedit`/`dropdown-edit` for rich
  customer-visible text, `textfield` for one-line strings/URLs, `toggle` for
  booleans, `valuefield` for numbers, `dropdown-actions`/`choice-tiles`/
  `segmented` for enums, `dropdown-fill` for fills, `dropdown-border` for
  borders, `dropdown-shadow` for shadows, `repeater` for flat primary repeated
  item lists, and `object-manager` for grouped containers, nested lists, or
  secondary per-object settings.
- Do not use `instance-picker`. Account-instance selection requires a
  product-owner-approved Dieter/Bob component and Roma account-data contract
  before any widget can depend on it.
- For PRD106C3 Split-family media widgets, use real media controls only:
  `split-media` gets one `dropdown-fill` at `splitMedia.media` with
  `fill-modes: "image,video"`; `split-carousel-media` gets one `repeater` at
  `splitCarouselMedia.items`, and each item gets exactly one `dropdown-fill` at
  `splitCarouselMedia.items.__INDEX__.media` with
  `fill-modes: "image,video"`. Declare `min: "2"` and `max: "6"` on the
  carousel repeater, and enforce the same count plus required stable item IDs
  at create/save. Do not add a media kind picker, separate image/video sibling
  controls, generic normalization `idRules` that heal saved-state item IDs, or
  fake instance selector.
- Every dependent control must have structured `showIf`; do not rely on runtime
  to ignore irrelevant controls.

### Step 3 - Update `widget.html`

Rules:

- Use the Shell hierarchy:

```text
stage -> pod -> root -> ck-headerLayout -> ck-header + ck-headerLayout__body
```

- Core DOM lives inside `.ck-headerLayout__body`, and therefore inside the
  shared Pod. Do not render widget Core as a sibling of `pod` or in a
  page-section wrapper outside the Shell.
- Every dynamic Core part has a stable `data-role`.
- Keep shared script/style order aligned with FAQ and `packages/widget-shell`.
- Do not redesign Shell markup per widget.

### Step 4 - Update `widget.css`

Rules:

- Scope classes to the widget.
- Use Dieter tokens and Shell CSS vars.
- Core CSS may style only Core-owned DOM/classes/vars.
- Use the global `900px` breakpoint.
- Do not duplicate Shell layout/appearance CSS.

### Step 5 - Update `widget.client.js`

Runtime shape:

- Register with `window.CKWidgetRuntime.register(widgetType, init)`.
- Bind preview updates with `runtime.bindStateUpdates(...)`.
- Do not read `runtimeContext.state` as required during Bob iframe boot; Bob
  may send state after iframe load.
- Apply initial state only when it exists.
- Use the shared preview localization path (`CK_PREVIEW_L10N`) when translated
  preview values are provided.
- Apply shared Shell primitives in the FAQ-proven order, then Core rendering.
- Core code updates only Core DOM inside this widget root.

`applyState(state)` must be deterministic: no fetch, no randomness, no hidden
state, no runtime healing.

### Step 6 - Update Editable Fields And Limits

Rules:

- Every customer-visible text field must appear in `editable-fields.json`.
- Repeated text paths use `[]` in declarations and stable item identity in the
  widget state.
- `limits.json` maps Core arrays/operations/counts to existing policy keys.
- Do not list non-text behavior/config paths as translatable text.

### Step 7 - Verify

Required before final response:

- `pnpm validate:widgets`
- Relevant typecheck for touched workspace packages.
- Bob compile probe or equivalent for the touched widget.
- Desktop and mobile preview at the `900px` breakpoint, or explicitly report
  that browser preview was not run and why.

Do not finish with failing validation.

---

## Final Checklist

- Shell/Core boundary is explicit.
- Shell was not modified during Core work.
- Every editor path exists in defaults.
- Every control is in the correct panel.
- Every control uses an existing Dieter field type through a Bob field node.
- Every editor path has one Binding Map row.
- Every runtime-read path exists in defaults.
- Every customer-visible text path is in `editable-fields.json`.
- `limits.json` uses existing entitlement keys.
- No new shared runtime, Bob, Roma, Tokyo-worker, Prague, Venice, or Dieter
  edits were made unless the PRD explicitly owned that shared surface.
