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

## Step -2 - Scope + stop conditions

OUTPUT

- A clear declaration of scope:
  - Which widgetType(s) are being modified.
  - Which system(s) need changes: Tokyo only vs Tokyo+Bob/Roma/Tokyo-worker/Prague/public serving.

STOP / ASK (do not proceed blindly)

- Change requires a new Dieter primitive/token.
- Change requires `tokyo/product/widgets/shared/*` edits.
- Change requires Bob/Roma/Tokyo-worker/Prague/public-serving edits and you don’t have an explicit PRD direction.

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

## Step 0 - State model + Binding Map (before ToolDrawer)

OUTPUT

- State model summary:
  - Arrays list (`path[]`) and required stable IDs (`path[].id`).
  - Item pieces list (subparts) and whether each piece is `string` vs `richtext`.
  - Variant axes (type/layout/position) and which fields they gate.
- DOM parts map (selectors + `data-role`s) for:
  - array containers
  - item containers
  - item pieces that are mutated at runtime
- Binding Map (anti-dead-controls): for every editable path, define how it is applied:
  - DOM text/HTML
  - DOM attribute / `data-*`
  - CSS var on a specific scope element

GATE

- One item can be described (render + update) without opening Bob.

---

## Step 1 - Defaults (`spec.json`)

OUTPUT

- Full `defaults` state shape (no runtime fallbacks/healing).
- Required platform fields:
  - Stage/Pod defaults (`stage.*`, `pod.*`)
  - Typography roles for all visible text (`typography.roles`)
  - Themes (`appearance.theme` defaults to `custom`)
  - Branding (`behavior.showBacklink`)
- `itemKey` declared in `spec.json` (`{widgetType}.item`) with pluralization support.
- Defaults are structural state, not demo/customer content. Do not seed saved account content with product marketing copy, fake Q&A rows, `https://example.com` links, or "New item" text. Repeated content starts empty; add-item templates may create blank valid rows using existing object-manager/repeater `default-item`.

GATE

- Every control path exists in defaults (compile-time and runtime strictness depend on it).

---

## Step 2 - DOM (`widget.html`)

OUTPUT

- Required wrapper hierarchy:
  - `[data-role="stage"]` contains `[data-role="pod"]` contains `[data-role="root"][data-ck-widget="{widgetType}"]`
- Stable `data-role` hooks for every runtime-mutated element.
- Shared runtime scripts inside root (as required by the widget features):
  - `../shared/fill.js`
  - `../shared/stagePod.js`
  - `../shared/typography.js`
  - `../shared/branding.js`
  - plus `../shared/surface.js` / `../shared/header.js` / `../shared/header.css` when those primitives are used

GATE

- Every runtime selector exists and is stable.

---

## Step 3 - Styling (`widget.css`)

OUTPUT

- Variants implemented via `data-*` selectors and CSS vars (no DOM reparenting).
- Dieter tokens only (no ad-hoc values).
- One breakpoint: `900px` (desktop vs mobile).

GATE

- Toggling variant/layout fields changes the visual output.

---

## Step 4 - Runtime (`widget.client.js`)

OUTPUT

- Deterministic `applyState(state)`:
  - Strict state assertions (fail-fast; fix the source).
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

---

## Step 5 - Builder Editor Contract (`spec.json.editor`)

OUTPUT

- Panels: `content`, `layout`, `appearance`, `typography`, `settings` (no extras).
- Panels are composed of one or more explicit cluster objects and field/shared nodes.
  - Use `label`/`labelKey` on clusters for meaningful collapsible section headers.
- Controls only for bound paths; gate variant-specific controls via structured `showIf`.
- No widget-authored `<bob-panel>`, `<tooldrawer-cluster>`, `<tooldrawer-field>`, `@slot:`, or escaped editor HTML in `spec.json`.
- Vertical rhythm is **clusters + groups only** (no manual spacing; no cluster `gap`/`space-after`).
- Themes:
  - Appearance includes a dropdown-actions control bound to `appearance.theme`.
  - Any manual edits to theme-controlled fields must reset `appearance.theme` to `custom` (editor behavior; runtime reads only final state).

Compiler notes (current codebase behavior)

- Bob renders shared Stage/Pod layout and appearance fields only when `spec.json.editor` declares the matching shared nodes.
- Every widget has Stage/Pod as its universal wrapper. Do not inline expanded Stage/Pod control blobs in widget specs; use Bob's shared editor nodes.
- Bob renders shared Header fields only when `spec.json.editor` declares the matching shared node.
- Bob renders a standardized Typography panel only when `spec.json.editor` declares the `typography` shared panel and `defaults.typography.roles` exists.
- Bob compiles theme controls from local `tokyo/product/themes/themes.json`; missing or malformed theme truth is a compiler error.

GATE

- Zero dead controls (validated via compile step in Step 8).

---

## Step 6 - Runtime binding map

OUTPUT

- DOM parts map in the implementation notes or PRD execution record (scoped selectors; query within widget root).
- Editable paths are declared in `spec.json` and, for customer-visible text, `editable-fields.json`.
- Array ops semantics (add/remove/reorder + required `id` fields) are enforced by editor controls/runtime, not a separate `agent.md` file.
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
- `node scripts/validate-widget-source.mjs` validates widget source without writing generated product authority.

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

## Step 8 - Verification (local)

Required checks

- Start stack: `bash scripts/dev-up.sh`
- Repo validation:
  - `pnpm typecheck`
  - `pnpm build:dieter`
- Defaults safety:
  - Defaults must not ship `data:` or `blob:` URLs (allowed only as user-edited/runtime values, never in `spec.json` defaults).
- Prague pages verification (if pages changed):
  - `pnpm --filter @clickeen/prague typecheck`
  - `pnpm --filter @clickeen/prague build`

Manual smoke (fast)

- Bob preview: each panel control updates the preview deterministically.
- Static embed: `clk.live/{accountPublicId}/{instanceId}` loads without console errors.
- Localization: Prague locale routes localize Prague page copy through page sidecars; account-widget locales are served only as generated public artifacts. Missing required Prague page sidecars fail visibly instead of silently falling back.
