# Widget Compliance Steps (AI)

Purpose: the execution checklist. The rules live in `documentation/widgets/WidgetBuildContract.md`.

INPUTS
- `widgetType` (explicit)
- PRD (required)
- Entitlements keys from `config/entitlements.matrix.json`

OUTPUTS
- A compliant widget definition folder in `tokyo/widgets/{widgetType}/`.

---

## Step -1 - PRD and entitlements mapping
OUTPUT
- PRD includes entitlements mapping for this widget.
- Mapping format (fixed-width table in code block):

```text
Key                      | Kind  | Path(s)                    | Metric/Mode      | Enforcement       | Notes
------------------------ | ----- | -------------------------- | ---------------- | ----------------- | ----------------
branding.remove          | flag  | behavior.showBacklink      | boolean (deny F) | load+ops+publish  | sanitize on load
cap.group.items.small.max  | cap | items[] / sections[]       | count            | ops+publish       | cap group binding
cap.group.items.large.max  | cap | items[]                    | count-total      | ops+publish       | cap group binding
```

GATE
- PRD exists and mapping is present.

---

## Step 0 - State model
OUTPUT
- Arrays list (`path[]`).
- Items list (`path[i]`).
- Item pieces list (subparts).
- DOM roles for arrays, items, pieces.

GATE
- One Item can be described without ToolDrawer.

---

## Step 1 - Defaults (`spec.json`)
OUTPUT
- Full `defaults` state shape.
- Stage/Pod defaults.
- Typography roles for all text.
- `itemKey` declared in `spec.json` (`{widgetType}.item`).
- Themes are always enabled: `appearance.theme` default set to `custom`.

GATE
- Every control path exists in defaults.

---

## Step 2 - DOM (`widget.html`)
OUTPUT
- Stage/Pod/root wrappers.
- `data-role` hooks for arrays, items, pieces.
- Shared runtime scripts inside root.

GATE
- Every runtime selector exists and is stable.

---

## Step 3 - Styling (`widget.css`)
OUTPUT
- Variants implemented via `data-*` selectors and CSS vars.
- Tokens only. One breakpoint.

GATE
- Toggling `data-type` or `data-layout` changes the visual output.

---

## Step 4 - Runtime (`widget.client.js`)
OUTPUT
- Deterministic `applyState(state)`.
- Stage/Pod and Typography applied first.
- All Binding Map rows implemented.

GATE
- All bound paths visibly update DOM/CSS.

---

## Step 5 - ToolDrawer (`spec.json` html[])
OUTPUT
- Panels: `content`, `layout`, `appearance`, `typography`, `settings`.
- Controls only for bound paths.
- `show-if` gates for variants.
- No `<tooldrawer-eyebrow>`.
- Use `<tooldrawer-cluster label="...">` for long or repetitive control groups instead of repeating the role in every label.
- Vertical rhythm is **clusters + groups only**. Controls must not add external margins or spacing wrappers.
- Clusters can wrap any markup; `gap`/`space-after` attributes are forbidden.
- Groups are formed from adjacent grouped fields; they appear inside a cluster only when those fields are inside that cluster.
- Themes are always enabled: Appearance panel includes a global Theme dropdown (dropdown-actions on `appearance.theme`).
- Any manual edit to `stage.*`, `pod.*`, `appearance.*`, or `typography.*` must reset `appearance.theme` to `custom`.

GATE
- Zero dead controls.

---

## Step 6 - `agent.md`
OUTPUT
- Editable paths list.
- Array ops semantics.
- Binding Map summary.
- Prohibited paths.

GATE
- Matches defaults and DOM hooks.

---

## Step 7 - Contract files
OUTPUT
- `limits.json` (unless PRD opts out).
- `localization.json` with all translatable paths.
- `layers/*.allowlist.json` only when used.

GATE
- Valid JSON and no forbidden segments.

---

## Step 8 - Verification
CHECKS
- `node scripts/compile-all-widgets.mjs`
- No `data:` or `blob:` URLs in defaults
- Localization paths include all translatable text
