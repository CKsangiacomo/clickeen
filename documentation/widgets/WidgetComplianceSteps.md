# Widget Compliance Steps (AI)

Purpose: the execution checklist for building/refactoring a widget definition folder in
`tokyo/widgets/{widgetType}/` so it is compliant with the **shipped** platform.

Canonical contracts (must match runtime):
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetArchitecture.md`
- `documentation/capabilities/seo-geo.md` (only if the widget exposes SEO/GEO)
- `documentation/widgets/sdr-allowlist-guide.md` (only if the widget supports Minibob SDR personalization)

INPUTS
- `widgetType` (explicit)
- PRD (required)
- Entitlements keys from `config/entitlements.matrix.json`

OUTPUTS
- A compliant widget definition folder in `tokyo/widgets/{widgetType}/`.

---

## Step -2 - Scope + stop conditions
OUTPUT
- A clear declaration of scope:
  - Which widgetType(s) are being modified.
  - Which system(s) need changes: Tokyo only vs Tokyo+Bob/Venice/Paris/Prague.

STOP / ASK (do not proceed blindly)
- Change requires a new Dieter primitive/token.
- Change requires `tokyo/widgets/shared/*` edits.
- Change requires Bob/Paris/Venice/Prague edits and you don’t have an explicit PRD direction.

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
cap.group.items.small.max | cap | sections[]            | count                | ops+publish reject       | cap binding
cap.group.items.large.max | cap | sections[].faqs[]     | count-total          | ops+publish reject       | cap binding
```

NOTES
- Every row must correspond to an entry in `tokyo/widgets/{widgetType}/limits.json` (Paris validates against it).
- If the PRD expects UI gating (e.g. disabling a control), it must be explicit; otherwise keep UI generic and enforce only at Paris.

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
  - Read from `window.CK_WIDGET` / `window.CK_WIDGETS[publicId]` (embed + Bob preview).
- Richtext safety:
  - If inline HTML is supported, sanitize deterministically and strip unsafe tags/attrs.

GATE
- All Binding Map rows are implemented and visibly update DOM/CSS.

---

## Step 5 - ToolDrawer (`spec.json` html[])
OUTPUT
- Panels: `content`, `layout`, `appearance`, `typography`, `settings` (no extras).
- Panels are composed of one or more `<tooldrawer-cluster>` blocks.
  - Use `label`/`labelKey` on clusters for meaningful collapsible section headers.
- Controls only for bound paths; gate variant-specific controls via `show-if`.
- No `<tooldrawer-eyebrow>` (use cluster labels instead).
- Vertical rhythm is **clusters + groups only** (no manual spacing; no cluster `gap`/`space-after`).
- Themes:
  - Appearance includes a dropdown-actions control bound to `appearance.theme`.
  - Any manual edits to theme-controlled fields must reset `appearance.theme` to `custom` (editor behavior; runtime reads only final state).

Compiler notes (current codebase behavior)
- Bob injects shared Stage/Pod layout fields when `defaults.stage` / `defaults.pod` exist.
- Bob injects shared Header fields when `defaults.header` + `defaults.cta` exist and you didn’t define them.
- Bob injects a standardized Typography panel when `defaults.typography.roles` exist (author-defined typography panel is stripped).

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
  - Anything outside allowlists (`localization.json`, `layers/*.allowlist.json`, `sdr.allowlist.json` as applicable).

GATE
- Contract matches defaults, DOM hooks, and runtime behavior.

---

## Step 7 - Contract files
OUTPUT
- `limits.json` (unless PRD opts out).
- `localization.json` with all translatable paths.
- `sdr.allowlist.json` (required if the widget supports Minibob SDR personalization; fail-closed by design).
- `layers/*.allowlist.json` only when that layer exists and is used.
- `pages/*.json` (Prague widget pages: overview/features/examples/templates/pricing).

GATE
- Valid JSON.
- No forbidden path segments (`__proto__`, `constructor`, `prototype`).
- Allowlist paths resolve against `spec.json` defaults.

---

## Step 7.1 - Prague pages + l10n pipeline
OUTPUT
- `tokyo/widgets/{widgetType}/pages/*.json` exist and contain valid `blocks[]`.
- `curatedRef.publicId` references a real curated instance.
- Page copy is compatible with Prague l10n allowlists.

GATE (local)
- `node scripts/prague-l10n/verify.mjs`

---

## Step 7.2 - SEO/GEO (Iframe++)
Only applicable if the widget exposes `seoGeo.enabled` / an SEO/GEO toggle.

OUTPUT
- Venice schema/excerpt implementation:
  - `venice/lib/schema/{widgetType}.ts` (schemaJsonLd + excerptHtml)
  - registered in `venice/lib/schema/index.ts`
- Gating matches `documentation/capabilities/seo-geo.md`:
  - `seoGeo.enabled !== true` → emit empty strings
  - widget-specific schema only when semantically safe

GATE
- `GET /r/:publicId?meta=1` returns expected `schemaJsonLd`/`excerptHtml` when enabled and empty strings when disabled.

---

## Step 8 - Verification (local)
Required checks
- Start stack: `bash scripts/dev-up.sh`
- Widget compile (Bob):
  - `curl -s http://localhost:3000/api/widgets/{widgetType}/compiled | head`
- Compile all widgets:
  - `node scripts/compile-all-widgets.mjs`
- Defaults safety:
  - Defaults must not ship `data:` or `blob:` URLs (allowed only as user-edited/runtime values, never in `spec.json` defaults).
- Prague pages/l10n verification (if pages changed):
  - `node scripts/prague-l10n/verify.mjs`

Manual smoke (fast)
- Bob preview: each panel control updates the preview deterministically.
- Venice embed: `/e/:publicId` loads without console errors.
- Localization: switching locale uses best-available overlays without breaking runtime.
