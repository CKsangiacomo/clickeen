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
  - Which system(s) need changes: Tokyo only vs Tokyo+Bob/Roma/Tokyo-worker/Venice/Prague.

STOP / ASK (do not proceed blindly)

- Change requires a new Dieter primitive/token.
- Change requires `tokyo/product/widgets/shared/*` edits.
- Change requires Bob/Roma/Tokyo-worker/Venice/Prague edits and you don’t have an explicit PRD direction.

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

- Every row must correspond to an entry in `tokyo/product/widgets/{widgetType}/limits.json`; shared policy/ops/publish enforcement consumes that mapping.
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
  - Read from `window.CK_WIDGET` / `window.CK_WIDGETS[instanceId]` (embed + Bob preview).
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

- Bob renders shared Stage/Pod fields only when `spec.json.editor` declares the matching shared node.
- Bob renders shared Header fields only when `spec.json.editor` declares the matching shared node.
- Bob renders a standardized Typography panel only when `spec.json.editor` declares the `typography` shared panel and `defaults.typography.roles` exists.
- Bob compiles theme controls from local `tokyo/product/themes/themes.json`; missing or malformed theme truth is a compiler error.

GATE

- Zero dead controls (validated via compile step in Step 8).

---

## Step 6 - `agent.md`

OUTPUT

- DOM parts map (scoped selectors; query within widget root).
- Editable paths list (grouped by intent).
- Array ops semantics (add/remove/reorder + required `id` fields).
- Binding Map summary (how each path affects DOM/CSS).
- Prohibited paths:
  - Anything outside the widget primitive graph in `spec.json.overlays.text[]` for text overlays.
  - Any second path schema for translation, layer authoring, or runtime overlays.

GATE

- Contract matches defaults, DOM hooks, and runtime behavior.

---

## Step 7 - Contract files

OUTPUT

- `catalog.json` with label, description, category, display order, and capabilities.
- `limits.json` (unless PRD opts out).
- `spec.json.overlays.text[]` with all translatable primitive text paths.
- `pages/*.json` (Prague widget pages: overview/features/examples/templates/pricing).

GATE

- Valid JSON.
- No forbidden path segments (`__proto__`, `constructor`, `prototype`).
- Allowlist paths resolve against `spec.json` defaults.
- `node scripts/build-widget-catalog.mjs` regenerates `tokyo/product/widgets/manifest.json` and the Tokyo-worker SEO/GEO registry without hand-editing worker source.

---

## Step 7.1 - Prague pages

OUTPUT

- `tokyo/prague/pages/{widgetType}/*.json` exist and contain valid `blocks[]`; repo-authored Prague page JSON syncs to R2 under `prague/pages/{widgetType}/*.json`.
- `accountInstanceRef.accountPublicId` and `accountInstanceRef.instanceId` are present only when a Prague page intentionally points at a real account widget instance.
- Admin/example instance refs use `accountPublicId: "00000001"` and resolve to normal instances under `accounts/00000001/instances/{instanceId}/`.
- `accountInstanceRef.instanceId` uses the current compact instance ID.
- Prague pages must not use old `wgt_*` / `ins_*` identities, private UUID account folders, root `l10n/`, an admin-specific storage lane, or hidden instance-only lookup.
- Prague page copy is page JSON truth. Account-widget overlays are not Prague page overlays; they are served by Venice from Tokyo published overlay IDs.

GATE (local)

- `pnpm --filter @clickeen/prague typecheck`
- `pnpm --filter @clickeen/prague build`

---

## Step 7.2 - SEO/GEO (Iframe++)

Only applicable if the widget exposes `seoGeo.enabled` / an SEO/GEO toggle.

OUTPUT

- Widget-owned schema/excerpt implementation:
  - `tokyo/product/widgets/{widgetType}/seo-geo.ts` (excerptHtml required; schemaJsonLd only when semantically implemented)
  - `catalog.json` declares `capabilities.seoGeo: true`
  - `node scripts/build-widget-catalog.mjs` regenerates `tokyo-worker/src/generated/widget-seo-geo-registry.ts`
- Gating matches `documentation/capabilities/seo-geo.md`:
  - `seoGeo.enabled !== true` → emit empty strings
  - widget-specific schema only when semantically safe

GATE

- PRD 101 will define generated static SEO/GEO payloads for `clk.live` output when enabled (`excerptHtml` and optional `schemaJsonLd`), and empty strings when disabled.

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
- Localization: switching locale uses only current ready overlays for the active base fingerprint; missing current overlays fail visibly instead of silently falling back.
