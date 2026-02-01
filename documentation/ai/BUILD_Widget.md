# AI Execution Guide — Build a Widget (Tokyo Definition)

STATUS: EXECUTION GUIDE (AI ONLY)

This is a strict, step-by-step guide for AI agents. It is **not** a design doc. Do not improvise, explore, or invent beyond the explicit inputs below.

If anything is unclear or missing, stop and ask the human.

---

## 0) Stop Conditions (ask before changing anything)

Stop and ask if:
- The widget type (e.g. `faq`, `logoshowcase`) is not explicitly provided.
- There is no widget PRD or the PRD conflicts with these contracts.
- The request requires changing shared runtime, Bob, Paris, Venice, Prague, Dieter, or any file outside `tokyo/widgets/{widgetType}/`.
- You need new UI primitives or tokens (must go through Dieter PRD first).

---

## 1) Allowed Inputs (read-only)

Only read these:
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetArchitecture.md`
- `tokyo/widgets/{widgetType}/spec.json`
- `tokyo/widgets/{widgetType}/widget.html`
- `tokyo/widgets/{widgetType}/widget.css`
- `tokyo/widgets/{widgetType}/widget.client.js`
- `tokyo/widgets/{widgetType}/agent.md`
- `tokyo/widgets/shared/stagePod.js`
- `tokyo/widgets/shared/typography.js`
- `tokyo/widgets/shared/branding.js`
- `tokyo/widgets/shared/fill.js`
- `tokyo/widgets/shared/header.js`
- `tokyo/widgets/shared/header.css`
- `tokyo/widgets/shared/surface.js`
- `tokyo/widgets/{widgetType}/limits.json` (read-only unless PRD requires edits)
- `tokyo/widgets/{widgetType}/localization.json` (read-only unless PRD requires edits)
- `tokyo/widgets/{widgetType}/layers/*.allowlist.json` (read-only unless PRD requires edits)

Do **not** repo-grep or read other folders unless explicitly instructed.

---

## 2) Allowed Outputs (files you may edit)

Default scope:
- `tokyo/widgets/{widgetType}/spec.json`
- `tokyo/widgets/{widgetType}/widget.html`
- `tokyo/widgets/{widgetType}/widget.css`
- `tokyo/widgets/{widgetType}/widget.client.js`
- `tokyo/widgets/{widgetType}/agent.md`

Only if the PRD explicitly says so:
- `tokyo/widgets/{widgetType}/limits.json`
- `tokyo/widgets/{widgetType}/localization.json`
- `tokyo/widgets/{widgetType}/layers/*.allowlist.json`

Do **not** create new files outside `tokyo/widgets/{widgetType}/`.

---

## 3) Forbidden Actions (non-negotiable)

- Do not edit shared runtime (`tokyo/widgets/shared/*`).
- Do not touch Bob/Paris/Venice/Prague/Dieter code.
- Do not add new fonts, colors, or tokens.
- Do not introduce locale into any IDs or filenames.
- Do not add “smart” fallback logic or defensive defaults.
- Do not invent copy or content outside the PRD.
- Do not change file formats or add new config schemas.

---

## 4) Execution Steps (do in order)

### Step 1 — Confirm widget type + state model

Input required:
- `widgetType` (e.g. `faq`)
- PRD with required features and UI structure

Output you must produce:
- A **short list of state paths** (arrays, items, fields) that will exist in `spec.json` and be mirrored in runtime.

If any path is ambiguous, stop and ask.

---

### Step 2 — Update `spec.json` (state + editor panels)

Rules:
- **Stage/Pod defaults are mandatory** (see `documentation/widgets/WidgetBuildContract.md`).
- Keep **one breakpoint** (900px). Do not add other breakpoints.
- Paths must be consistent across `spec.json`, `agent.md`, and runtime code.
- Use 2‑space indentation (Prettier).

Checklist:
- `defaults.stage` and `defaults.pod` exist.
- `defaults.typography.roles` exist for any text roles in the widget.
- Arrays are defined under `defaults` and referenced by panel fields.
- Panels only expose paths that exist in `defaults`.
- No new panel IDs unless required by the PRD.

---

### Step 3 — Update `widget.html` (DOM + data-role map)

Rules:
- Must include the **Stage/Pod wrapper**.
- All dynamic areas must have stable `data-role` attributes.
- Script tags must include shared runtime + `widget.client.js`.

Checklist:
- `data-role="stage"`, `data-role="pod"`, `data-role="root"` exist.
- Arrays have a container role and item role.
- Subparts that change with state have a stable role.
- No inline styles or inline scripts.
- Shared modules are loaded when used:
  - Always: `../shared/stagePod.js`, `../shared/typography.js`, `../shared/branding.js`
  - If any fill controls exist: `../shared/fill.js`
  - If using the shared header primitive: `../shared/header.css` + `../shared/header.js`
  - If exposing `appearance.cardwrapper.*`: `../shared/surface.js`

---

### Step 4 — Update `widget.css` (tokens + layout)

Rules:
- Use Dieter tokens and CSS variables (no hard-coded colors).
- Use BEM-like class naming scoped to the widget.
- **One breakpoint** at 900px.

Checklist:
- All visual styles live in CSS (not HTML).
- Typography is applied via CSS variables controlled by `typography.js`.
- No new fonts outside Dieter tokens.

---

### Step 5 — Update `widget.client.js` (deterministic runtime)

Rules:
- `applyState(state)` is a **pure** DOM update (no fetch, no timers, no randomness).
- Call shared modules:
  - `window.CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `window.CKTypography.applyTypography(state.typography, root, roleMap)`
- Use `data-role` selectors only.
 - If used by the widget:
   - Shared header: `window.CKHeader.applyHeader(state, root)`
   - Card wrapper: `window.CKSurface.applyCardWrapper(state.appearance.cardwrapper, scopeEl)`
   - Fill resolution: `window.CKFill.toCssBackground(...)` / `toCssColor(...)`

Checklist:
- All state paths referenced in JS exist in `spec.json`.
- Array updates are deterministic (no partial mutation without re-render).
- No side effects outside the widget root.

---

### Step 6 — Update `agent.md` (AI editing contract)

Rules:
- List all editable paths and allowed ops.
- Arrays must define insert/remove/move behavior explicitly.
- Disallow any structural change not supported by the widget.

Checklist:
- Every path in `agent.md` exists in `spec.json`.
- Examples show valid ops and invalid ops.
- Non-editable paths are listed.

---

### Step 7 — Validation (only when asked)

Run only if the human asks:
- `node scripts/compile-all-widgets.mjs`

If validation fails, fix the widget files only (no cross-repo edits).

---

## 5) Final Output Checklist

Before you finish:
- Core widget files + contract files are consistent and compile.
- No new files were created.
- No shared runtime or system files were touched.
- All state paths are consistent across `spec.json`, HTML, CSS, JS, and `agent.md`.

If any requirement is unmet, stop and ask.

---

## References (do not expand scope)

- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetArchitecture.md`
