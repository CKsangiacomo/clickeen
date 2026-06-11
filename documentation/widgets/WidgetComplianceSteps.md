# Widget Compliance Steps (AI)

Purpose: the execution checklist for building/refactoring a widget definition folder in
`tokyo/product/widgets/{widgetType}/` so it is compliant with the **shipped** platform.

Canonical contracts (must match runtime):

- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetArchitecture.md`
- `documentation/capabilities/seo-geo.md` (only if the widget exposes SEO/GEO)

INPUTS

- `widgetType` (explicit)
- PRD (required)
- Entitlements keys from `packages/ck-policy/entitlements.matrix.json`

OUTPUTS

- A compliant widget definition folder in `tokyo/product/widgets/{widgetType}/`.

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

Do not create separate shell panels and core panels. Declare shared Shell nodes
and widget Core controls in the same panel for the same user job.

Naming is part of compliance:

- Shared Header title/subtitle live under `header.*`.
- Shared Header action/button lives under `headerCta.*`.
- Shared Header action appearance lives under `appearance.headerCta.*`.
- Widget body paths must use a widget-specific namespace such as
  `calltoaction.*`.
- Do not introduce body paths named only `title`, `subtitle`, `cta`, `button`,
  `body`, or new generic `core.*` paths when similar Shell elements exist.
- ToolDrawer labels must disambiguate same-panel controls: "Header CTA label"
  for Shell, "Action label" for a Call to Action body.

Default authority is also non-negotiable:

```text
packages/widget-shell owns Shell factory defaults
widget spec.json owns widget Core factory defaults
Tokyo account widget-defaults.json owns live account defaults for new instances
```

Widget specs must not author Shell defaults. New instances are created from
account defaults (`account.shell + account.widgets[widgetType].core`), then Bob
edits that resolved instance state in browser memory and Roma/Tokyo save it.
Widget specs also must not author Shell normalization. `spec.json.normalization`
is only for widget Core paths under the widget namespace.

---

## Step -2 - Scope + stop conditions

OUTPUT

- A clear declaration of scope:
  - Which widgetType(s) are being modified.
  - Which system(s) need changes: Tokyo only vs Tokyo+Bob/Roma/Tokyo-worker/Prague/public serving.

STOP / ASK (do not proceed blindly)

- Change requires a new Dieter primitive/token.
- Change requires `tokyo/product/widgets/shared/*` edits.
- Change requires Bob/Roma/Tokyo-worker/Prague/public-serving edits and you don’t have an explicit PRD direction.
- Change alters shared branding/backlink behavior, social-share behavior,
  package assembly, or shared Settings semantics without explicit PRD direction.

GATE

- `widgetType` is explicit and PRD exists.

---

## Step -1 - PRD and entitlements mapping

OUTPUT

- PRD includes an entitlements mapping for this widget (what is tier-gated, capped, or sanitized).
- Mapping format (fixed-width table in code block):

```text
Key                     | Kind | Path(s)                | Metric/Mode          | Enforcement              | Notes
----------------------- | ---- | ---------------------- | -------------------- | ------------------------ | ----------------
branding.remove         | flag | behavior.showBacklink  | boolean (deny false) | load=sanitize ops=reject | sanitize on load
widget.socialShare.enabled | flag | behavior.socialShare.enabled | boolean (deny true) | load=sanitize ops=reject | sanitize disabled on load
items.group.small.max | limit | sections[]          | count                | ops+publish reject       | limit binding
items.group.large.max | limit | sections[].faqs[]   | count-total          | ops+publish reject       | limit binding
```

NOTES

- Every row must correspond to an entry in `tokyo/product/widgets/{widgetType}/limits.json`; shared policy evaluation consumes that mapping. Current proven widget enforcement is Bob editor ops unless a server boundary is explicitly implemented and tested.
- Use active global entitlement keys from `packages/ck-policy/entitlements.matrix.json`. If a limit is product truth but enforcement is missing, mark that enforcement gap in `packages/ck-policy/src/registry.ts` instead of deleting the limit.
- If the PRD expects UI gating (e.g. disabling a control), it must be explicit; otherwise keep UI generic and rely on shared policy plus owner-correct server enforcement.

GATE

- PRD exists and mapping is present.

---

## Step -0.5 - Existing widget model classification

OUTPUT

- Classification for the target widget:
  - `new-widget-namespace`: widget body already lives under a widget-specific
    namespace such as `calltoaction.*`.
  - `transitional-generic-core`: widget body currently lives under generic
    `core.*`.
  - `old-body`: widget body uses a legacy namespace such as `sections[]`,
    `timer.*`, or `strips[]`.
  - `transitional`: widget has Shell/Core labels or sizing but the body is not
    under a widget-specific namespace.
  - `shell-only bug`: widget renders meaningful product body only from Shell
    paths such as `header.*` or `headerCta.*`.
- Decision:
  - migrate body paths to a widget-specific namespace now, or
  - defer migration with a named reason and no new code copying the legacy
    namespace.

GATE

- The surviving body authority is named before ToolDrawer, DOM, runtime, or
  editable-field work begins.

---

## Step -0.25 - Saved instance compatibility

OUTPUT

- List every new, moved, or renamed state path, including:
  - widget-specific body paths
  - typography roles and role scales
  - appearance objects
  - behavior/settings leaves
- Describe the old saved state shape that existing account instances may still
  post to preview/public runtime.
- Pick exactly one compatibility path:
  - storage migration
  - load/materialization normalization
  - temporary widget-local runtime bridge
- If using a temporary runtime bridge, document:
  - the old shape it accepts
  - the new widget-specific body shape that remains the surviving authority
  - what test proves old state still renders
  - when the bridge can be removed

NOTES

- Bob session load deep-merges compiled defaults (Shell factory defaults plus
  widget Core `spec.json.defaults`) into old saved instance state before
  ToolDrawer hydration and Builder preview postMessage, then applies
  Core-owned widget normalization rules and scalar coercion.
- Widget normalization is not a Shell fallback ladder. Do not add coerce rules
  for `behavior.showBacklink`, `behavior.socialShare.*`, `header.*`,
  `headerCta.*`, `stage.*`, `pod.*`, `coreSize.*`, or shared Shell
  appearance/typography paths. Shell compatibility belongs to the shared
  Shell/account/materialization boundary.
- Publishing/materializing old saved source still needs an explicit matching
  compatibility path when the server/public boundary can receive the old shape.
- Generated package files are stored artifacts. Existing account
  `index.html`, `styles.css`, `runtime.js`, and `package.json` do not change
  just because widget source, shared Shell code, or account defaults changed.
  Any refactor that changes saved state language, package assembly, public
  runtime, or Page Composer output must include package regeneration or
  recomposition for affected live instances/pages, or stop with a named blocker.
- Roma lists account instances from the registry, not by scanning raw R2
  prefixes. If a widget type rename leaves raw R2 folders behind, clean them as
  orphaned data only after the registry/source migration decision is explicit.
- Adding a widget Core typography role in `spec.json.defaults` does not make
  that role exist in old saved instance state. Do not pass optional new roles
  to `CKTypography.applyTypography` unless the posted state has them, or
  migrate the state first.
- Pre-GA contract renames should use a one-time storage/translation rewrite,
  not long-lived runtime aliases. For the Header CTA and Call to Action rename:
  move legacy Header CTA state to `headerCta.*`, move legacy Header CTA
  appearance to `appearance.headerCta.*`, change the legacy Call to Action
  widget type to `calltoaction`, move old CTA widget body state to
  `calltoaction.*`, rewrite legacy Header CTA editable/content paths to
  `headerCta.label`, and recompute or mark translation overlays
  out of sync.

GATE

- Fresh defaults and one representative old saved state can both be rendered or
  the task is blocked at a named migration boundary.

---

## Step 0 - State model + Binding Map (before ToolDrawer)

OUTPUT

- Ownership map:
  - Shell paths consumed from the shared contract (`header.*`, `headerCta.*`,
    `stage.*`, `pod.*`, `coreSize.*`, shared Shell typography roles,
    `localeSwitcher.*`, shared Shell `appearance.*`, shared Shell `behavior.*`).
  - Core paths introduced or changed under the widget-specific body namespace.
  - Any existing generic `core.*` or legacy widget body path that remains, why
    it is transitional/legacy, and whether this task migrates or defers it.
- State model summary:
  - Arrays list (`path[]`) and required stable IDs (`path[].id`).
  - Item pieces list (subparts) and whether each piece is `string` vs `richtext`.
  - Variant axes (type/layout/position) and which fields they gate.
- Panel placement for every Core control:
  - Content controls go in the Content panel after the relevant shared Header node.
  - Layout controls go in the Layout panel alongside shared Header/CoreSize/StagePod nodes.
  - Appearance controls go in the Appearance panel alongside shared Header/Header CTA/StagePod nodes.
  - Typography roles are declared in defaults and edited by the shared Typography panel.
- DOM parts map (selectors + `data-role`s) for:
  - array containers
  - item containers
  - item pieces that are mutated at runtime
- Binding Map (anti-dead-controls): for every editable path, define how it is applied:
  - DOM text/HTML
  - DOM attribute / `data-*`
  - CSS var on a specific scope element
  - Shared Shell primitive/runtime/package behavior
- Every editor path must have exactly one Binding Map row. A path with no row
  is a dead control. A path with two rows is duplicate truth.

GATE

- One item can be described (render + update) without opening Bob.

---

## Step 1 - Defaults (`spec.json`)

OUTPUT

- Full widget Core `defaults` state shape (no runtime fallbacks/healing).
- Confirmation that Shell defaults come from `packages/widget-shell`, not this
  widget spec.
- Required widget Core fields:
  - Core defaults in the widget-specific namespace for the product body.
  - Widget Core typography roles for Core visible text (`typography.roles`).
  - Widget Core appearance/layout/behavior defaults only.
  - `uiLabels.core.*` labels so the ToolDrawer names the widget body correctly.
- `itemKey` declared in `spec.json` (`{widgetType}.item`) with pluralization support.
- Defaults are product starter state. Simple non-repeat widgets must include useful starter Core content so the first preview is not blank. Repeated content may include starter items only when an empty array would render as a broken product; add-item templates may create blank valid rows using existing object-manager/repeater `default-item`.
- Do not seed fake content, lorem ipsum, `https://example.com` links, hidden test rows, or account-owned/private references.
- Do not use Shell Header/Header CTA content as the widget's only visible product body. The widget-specific body must be represented in its own namespace.

GATE

- Every Core control path exists in widget `spec.json.defaults`.
- Every Shell control path exists in Shell factory defaults.
- Composed factory defaults (`Shell + Core`) include
  `stage.canvas.mode: "viewport"` unless a named PRD exception is recorded in
  the Shell contract. Builder displays this as `Full`.
- Composed factory defaults include explicit `pod.widthMode`.
- `pnpm --filter @clickeen/widget-shell validate` passes, proving no Shell
  default paths remain authored in widget specs.

Widget specs must not contain these Shell default families:

```text
header.*
headerCta.*
stage.*
pod.*
coreSize.*
localeSwitcher.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder
behavior.showBacklink
behavior.socialShare.*
typography roles/scales for Shell roles title/body/button/localeSwitcher
```

`{widgetNamespace}.appearance.cardwrapper.*` is Core, not Shell. It belongs only
to widgets that render card/item surfaces. `uiLabels.core.*` is widget Core
extension metadata, not Shell default styling or behavior.

---

## Step 2 - DOM (`widget.html`)

OUTPUT

- Required wrapper hierarchy:
  - `[data-role="stage"]` contains `[data-role="pod"]` contains `[data-role="root"][data-ck-widget="{widgetType}"]`
- Shared Shell hierarchy:
  - `.ck-headerLayout` contains `.ck-header` and `.ck-headerLayout__body`
  - Core DOM lives inside `.ck-headerLayout__body`, and therefore inside the
    shared Pod. Do not render widget Core as a sibling of `[data-role="pod"]`
    or in a page-section wrapper outside the Shell.
- Stable `data-role` hooks for every runtime-mutated element.
- Shared runtime scripts inside root (as required by the widget features):
  - `../shared/fill.js`
  - `../shared/appearance.js`
  - `../shared/runtime.js`
  - `../shared/header.js`
  - `../shared/localeSwitcher.js`
  - `../shared/typography-data.js`
  - `../shared/stagePod.js`
  - `../shared/typography.js`
  - `../shared/coreSize.js`
  - `../shared/branding.js`
  - `../shared/socialShare.js`
  - `../shared/previewL10n.js`
  - plus `../shared/surface.js` when that primitive is used
- Shared Shell styles:
  - `../shared/header.css`
  - `../shared/localeSwitcher.css`
  - `../shared/stagePod.css`
  - `../shared/socialShare.css`
- Social-share support:
  - The widget must not create a widget-local social-share implementation.
  - `shared/socialShare.js` owns the shared social-share root/markup. It must
    create the trigger/menu when `behavior.socialShare.enabled === true` and
    remove it when false in both Builder preview and public output.
  - `shared/socialShare.js` filters the menu from
    `behavior.socialShare.channels.*`. Missing channel leaves are treated as
    enabled for compatibility; all channels false removes the share root.
  - Builder preview shows the menu but suppresses real popup and clipboard
    actions. Public iframe snippets must allow clipboard write and popup
    opening for embedded social-share actions.
  - Roma package assembly may chunk/dedupe the shared social-share CSS/runtime,
    but it must not be the only place that creates social-share UI.

GATE

- Every runtime selector exists and is stable.
- Shared branding and social-share shell modules load in Builder preview and
  public output, or the task is blocked at the named preview/package boundary.

---

## Step 3 - Styling (`widget.css`)

OUTPUT

- Variants implemented via `data-*` selectors and CSS vars (no DOM reparenting).
- Dieter tokens only (no ad-hoc values).
- One breakpoint: `900px` (desktop vs mobile).
- Core bodies that rely on absolutely positioned children must still have an
  intrinsic size when shared `coreSize.mode` is `auto`. Use the shared
  CoreSize mode marker plus Core CSS aspect-ratio/min-height. Do not create
  widget-private Shell sizing defaults to make a blank Core visible.
- Shared `coreSize` latent values for fixed/responsive modes must be positive
  (`fixedHeight`, `minHeight`, `preferredVw`, `maxHeight`). `mode: "auto"` is
  the default behavior, but zero latent values are invalid because switching to
  Fixed or Responsive immediately applies them.

GATE

- Toggling variant/layout fields changes the visual output.
- Fresh defaults render visible Core content in Builder preview with
  `coreSize.mode: "auto"`.
- Switching Core size to Fixed reveals the fixed-height field and does not
  collapse the Core.
- Toggling linked Shell controls reveals the correct linked/unlinked control
  set immediately and expands saved values to the dependent paths.

---

## Step 4 - Runtime (`widget.client.js`)

OUTPUT

- Deterministic `applyState(state)`:
  - Strict state assertions (fail-fast; fix the source).
  - Shared Shell primitives read Shell paths only.
  - Core appearance reads the widget namespace that declared it, such as
    `cards.appearance.cardwrapper.*`,
    `splitMedia.appearance.cardwrapper.*`, or
    `splitCarouselMedia.appearance.cardwrapper.*`.
    Runtime must not read root `state.appearance.cardwrapper`.
    The visible Core surface must consume the shared `--ck-cardwrapper-*`
    variables. A "Visual frame" control that writes state but does not change the
    visual frame fails compliance.
    Corner labels must use corner language: `Link ... corners`, `Corner radius`,
    and per-corner labels such as `top-left corner`.
  - Apply Stage/Pod and Typography first, then shared primitives, then widget-specific bindings.
  - No network fetches, timers, randomness, or “healing” logic inside `applyState`.
- postMessage support:
  - Accept `ck:state-update` payloads `{ type, widgetname, state }`.
- Initial state:
  - Register with `window.CKWidgetRuntime.register(widgetType, init)` and read state from the root-scoped runtime context backed by `window.CK_WIDGETS[instanceId]`.
  - Do not read or write `window.CK_WIDGET`.
- Richtext safety:
  - If inline HTML is supported, sanitize deterministically and strip unsafe tags/attrs.

GATE

- All Binding Map rows are implemented and visibly update DOM/CSS.
- `behavior.showBacklink` visibly shows/hides shared branding in Builder
  preview and public output.
- `behavior.socialShare.enabled` visibly creates/removes the shared social-share
  UI in Builder preview and public output, or the missing surface is recorded as
  a blocker before shipping.
- `behavior.socialShare.channels.*` visibly filters the shared social-share
  menu without console errors.

---

## Step 5 - Builder Editor Contract (`spec.json.editor`)

OUTPUT

- Panels: `content`, `layout`, `appearance`, `typography`, `settings` (no extras).
- Panels are mixed by user job, not separated by ownership:
  - Content contains shared Header content plus Core content.
  - Layout contains shared Header/CoreSize/StagePod plus Core layout.
  - Appearance contains shared Header/Header CTA/StagePod plus Core appearance.
  - Typography uses the shared panel for Shell and Core roles.
  - Settings contains shared behavior plus Core runtime behavior.
- Panels are composed of one or more explicit cluster objects and field/shared nodes.
  - Use `label`/`labelKey` on clusters for meaningful collapsible section headers.
- Custom Core fields inside clusters use `groupId`; use `attrs["group-label"]:
  ""` for unlabeled rhythm groups and a meaningful value only when a visible
  nested group label is needed.
- Controls only for bound paths; gate variant-specific controls via structured `showIf`.
- `repeater` is for flat primary repeated item lists. `object-manager` is for
  grouped containers, nested lists, or secondary per-object settings.
- Repeater/object-manager templates are real Builder controls. Nested item
  controls must preserve `showIf`; do not accept a panel where every item
  variant field is visible at once. Account-instance selection is not a generic
  field type and requires a product-owner-approved component before any widget
  may depend on it.
- Repeater/object-manager nested controls must hydrate with the same Bob
  dependency context as top-level controls. Media `dropdown-fill` fields inside
  repeaters must open and mutate exactly like a top-level `dropdown-fill`, not
  render as inert labels.
- Value controls in the ToolDrawer align label-left/value-right. A
  `dropdown-fill` media selector must follow that rhythm; do not make it look
  like a selected section row or custom card.
- PRD106C3 Split-family media widgets use real media controls only:
  `split-media` has one `dropdown-fill` at `splitMedia.media` with
  `fill-modes: "image,video"` only; `split-carousel-media` has one `repeater`
  at `splitCarouselMedia.items`, and each item template has exactly one
  `dropdown-fill` at `splitCarouselMedia.items.__INDEX__.media` with
  `fill-modes: "image,video"` only. Declare `min: "2"` and `max: "6"` on that
  repeater, and enforce the same count plus required stable item IDs at
  create/save. Do not use a media kind picker, separate image/video sibling
  controls, generic normalization `idRules` that heal missing IDs,
  `object-manager` carousel visuals, `instance-picker`, or a fake
  account-instance selector.
- Settings controls for `behavior.showBacklink` and
  `behavior.socialShare.*` are shared Shell controls from the
  `settings-behavior` shared node and must be backed by defaults,
  `limits.json`, preview behavior, and public-package behavior.
  Widget-specific Settings clusters may sit beside the shared node, but widgets
  must not hand-author or relabel the shared branding/share controls.
- No widget-authored `<bob-panel>`, `<tooldrawer-cluster>`, `<tooldrawer-field>`, `@slot:`, or escaped editor HTML in `spec.json`.
- Vertical rhythm is **clusters + groups only**. No manual spacing, cluster
  `gap`/`space-after`, or ungrouped Core fields that visually drift from shared
  Shell controls.
- Themes:
  - Appearance includes a dropdown-actions control bound to `appearance.theme`.
  - Any manual edits to theme-controlled fields must reset `appearance.theme` to `custom` (editor behavior; runtime reads only final state).

Compiler notes (current codebase behavior)

- Bob renders shared Stage/Pod layout and appearance fields only when `spec.json.editor` declares the matching shared nodes.
- Every widget has Stage/Pod as its universal wrapper. Do not inline expanded Stage/Pod control blobs in widget specs; use Bob's shared editor nodes.
- Bob renders shared Header fields only when `spec.json.editor` declares the matching shared node.
- Bob renders widget Core controls only from explicit field nodes in the same panel contract.
- Bob renders a standardized Typography panel only when `spec.json.editor` declares the `typography` shared panel and `defaults.typography.roles` exists.
- Bob compiles theme controls from local `tokyo/product/themes/themes.json`; missing or malformed theme truth is a compiler error.

GATE

- Zero dead controls (validated via compile step in Step 8).

---

## Step 6 - Runtime binding map

OUTPUT

- DOM parts map in the implementation notes or PRD execution record (scoped selectors; query within widget root).
- Editable paths are declared in `spec.json` and, for customer-visible text, `editable-fields.json`.
- Every Core control path has one implementation mechanism: DOM text/HTML, DOM attribute, CSS var, or shared primitive call.
- Every runtime-read Core path exists in defaults under the widget-specific body namespace.
- Every runtime-read Shell path exists in the shared Shell factory defaults.
- Array ops semantics (add/remove/reorder + required `id` fields) are enforced
  by editor controls and by the create/save boundary when they are structural
  package invariants. Runtime may fail loudly too; runtime cannot be the only
  enforcement for invalid persisted state.
- Binding map summary: how each path affects DOM/CSS.
- Prohibited paths:
  - Anything outside `editable-fields.json` for translatable text.
  - Any second path schema for translation, layer authoring, or runtime overlays.

GATE

- Contract matches defaults, DOM hooks, and runtime behavior.

---

## Step 7 - Contract files

OUTPUT

- `limits.json` (unless PRD opts out).
- `editable-fields.json` with all editable/translatable primitive text paths when the widget has customer-visible content. `spec.json.overlays.text[]` is deleted translation-field authority and must not be reintroduced.
- `pages/*.json` (Prague widget pages: overview/features/examples/templates/pricing).

GATE

- Valid JSON.
- No forbidden path segments (`__proto__`, `constructor`, `prototype`).
- Allowlist paths resolve against `spec.json` defaults.
- `pnpm validate:widgets` verifies the generated Tokyo-worker widget definition index is in sync.

---

## Step 7.1 - Prague pages

OUTPUT

- `tokyo/prague/pages/{widgetType}/*.json` exist and contain valid `blocks[]`; repo-authored Prague page JSON syncs to R2 under `prague/pages/{widgetType}/*.json`.
- `accountInstanceRef.accountPublicId` and `accountInstanceRef.instanceId` are present only when a Prague page intentionally points at a real account widget instance.
- Admin/example instance refs use `accountPublicId: "CLICKEEN"` and resolve to normal instances under `accounts/CLICKEEN/instances/{instanceId}/`.
- `accountInstanceRef.instanceId` uses the current compact instance ID.
- `accountInstanceRef.locale`, when present, selects a concrete published public artifact. Prague must not infer account-widget locale availability from market config, route locale, or private translation state.
- Prague pages must not use old `wgt_*` / `ins_*` identities, private UUID account folders, root `l10n/`, an admin-specific storage lane, or hidden instance-only lookup.
- Prague page copy is page JSON truth. Account-widget translated locale values are not Prague page sidecars; published account widgets are served as generated static artifacts from `clk.live`.

GATE (local)

- `pnpm --filter @clickeen/prague typecheck`
- `pnpm --filter @clickeen/prague build`

---

## Step 7.2 - SEO/GEO

Widget `seo-geo.ts` files and `catalog.capabilities.seoGeo` are deleted from the widget source model. Do not add them in widget build work.

PRD 101 will define generated static SEO/GEO payloads for `clk.live` output when enabled (`excerptHtml` and optional `schemaJsonLd`), and empty strings when disabled.

---

## Step 8 - Verification

Required checks

- Repo validation:
  - `pnpm typecheck`
  - `pnpm build:dieter`
- Shell/Core defaults validation:
  - `pnpm --filter @clickeen/widget-shell validate`
  - `pnpm validate:widgets`
  - `pnpm audit:106 -- --skip-r2` when touching the Shell/Core/default
    contract locally
- Live account/R2 closure when touching account defaults, saved instances, or
  generated account packages:
  - `pnpm cf:preflight`
  - `pnpm audit:106`
- Cloud-dev Builder closure when touching Bob controls or preview hydration:
  - source `e2e/.auth/e2e.env`
  - run the targeted authenticated Playwright certification for the changed
    widgets against the Cloudflare surfaces
- Defaults safety:
  - Defaults must not ship `data:` or `blob:` URLs (allowed only as user-edited/runtime values, never in `spec.json` defaults).
- Prague pages verification (if pages changed):
  - `pnpm --filter @clickeen/prague typecheck`
  - `pnpm --filter @clickeen/prague build`

Manual smoke (fast)

- Browser smoke: serve `tokyo/product`, load `widgets/{widgetType}/widget.html`,
  post `spec.defaults` with `ck:state-update`, and verify the Core body is
  nonblank with no console or page errors.
- Old-state smoke for refactors: post one representative pre-change saved state
  and verify it either renders through the named compatibility path or fails at
  the named migration boundary. It must not blank the preview with an uncaught
  optional-role or missing-parent error.
- Bob preview: each panel control updates the preview deterministically.
- ToolDrawer rhythm smoke: custom Core clusters visually match shared Shell
  clusters such as Header and Stage/Pod. Related Core fields are wrapped in one
  Bob group with an empty or meaningful group label.
- Stage default smoke: new widget instance opens with Stage set to `Full`
  (`stage.canvas.mode: "viewport"`) from account Shell defaults.
- Pod width smoke: `pod.widthMode` matches the widget's declared inner-wrapper
  decision after Shell/Core composition; non-`full` defaults have a
  manifest/PRD reason.
- Branding smoke: toggle `Show Made with Clickeen` off/on and verify the
  branding badge hides/shows in Builder preview and public output. Verify
  `branding.remove` blocks removal when the account is not entitled.
- Social-share smoke: toggle `Enable social share` on/off and verify the shared
  social-share trigger/menu appears/disappears in Builder preview and public
  output. Toggle individual share channels and verify the menu filters without
  console errors. In Builder preview, share action clicks must not attempt
  popups or clipboard writes. Verify `widget.socialShare.enabled` blocks
  enabling when the account is not entitled.
- Static embed: `clk.live/{accountPublicId}/{instanceId}` loads without console errors.
- Localization: Prague locale routes localize Prague page copy through page sidecars; account-widget locales are served only as generated public artifacts. Missing required Prague page sidecars fail visibly instead of silently falling back.
- Docs truth: when behavior or model changes, update
  `WidgetArchitecture.md`, `WidgetBuildContract.md`, and
  `WidgetComplianceSteps.md` together.

Account defaults smoke:

- `accounts/{accountPublicId}/widget-defaults.json` exists or is seeded before
  creating a new instance.
- Creating a new instance submits resolved `source.config` from Roma to Tokyo.
  Tokyo derives `instance.content.json` from that config and must not call
  widget factory defaults during product create.
- Create/save/materialization carries source metadata such as `baseLocale`,
  `targetLocales`, and `meta`; those are not account defaults policy and must
  not be dropped or silently defaulted.
- Changing account defaults affects only future new instances. Existing saved
  instances and duplicates keep their saved source.
- Roma Widget Defaults maps every account Shell/Core default path to compiled
  Builder controls. Missing coverage must show a contract error, not a generic
  fallback editor.
- Software metadata in account defaults is limited to `uiLabels.core.*` and
  `typography.roleScales.*`. Hidden widget runtime constants such as SEO/GEO
  answer formats, business types, workspace URLs, or fixed action types must
  not live in account defaults.
