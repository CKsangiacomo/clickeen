# content.countdown — Countdown Widget PRD

STATUS: PRD

## What this widget does (1 sentence)
Renders a configurable countdown / personal countdown / number counter with optional CTA and “after end” behavior, edited in Bob and rendered deterministically in the embed.

## 0) Non-negotiables (Architecture)
1. **Starter designs are instances**: curated designs are Clickeen-owned instances that users clone.
2. **No silent fixups**: editor + runtime must not invent state, merge defaults, coerce invalid values, or generate IDs at render time.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **CSS-first variants**: variants are driven by `data-*` + CSS variables; JS only sets attributes/vars and updates text/visibility.

## Entitlements + limits (v1)

- Tier values live in the global matrix: `config/entitlements.matrix.json`.
- Widget enforcement lives in `tokyo/widgets/countdown/limits.json` (create this when the widget ships).
- The PRD lists entitlement keys and how they map to state paths; do not repeat per-tier matrices here.

### Limits mapping (initial)

```text
key                 | kind | path(s)                        | metric/mode        | enforce                    | notes
------------------- | ---- | ------------------------------ | ------------------ | -------------------------- | -----------------------------
seoGeo.enabled      | flag | seoGeo.enabled                 | boolean (deny true)| load sanitize; ops+publish | SEO/GEO toggle
branding.remove     | flag | behavior.showBacklink          | boolean (deny false)| load sanitize; ops+publish | Remove branding
links.enabled       | flag | actions.*.url (TBD)            | nonempty-string    | ops+publish                | CTA links require link access
```

Budgets are global, per-session counters (no per-widget matrices):
- `budget.copilot.turns` (Copilot send)
- `budget.edits` (any successful edit)
- `budget.uploads` (file inputs; not used by Countdown unless uploads are added)

If Countdown needs tier-gated modes (date/personal/number), add a new global flag key in `config/entitlements.matrix.json` and map it in `limits.json` (no per-widget tier tables).

## 1) Where the widget lives (authoritative)
Widget definition (the software): `tokyo/widgets/countdown/`
- `spec.json` — defaults + ToolDrawer markup
- `widget.html` — semantic scaffold + stable `data-role` hooks
- `widget.css` — scoped styles (Dieter tokens)
- `widget.client.js` — deterministic `applyState(state)`
- `agent.md` — AI editing contract (editable paths + enums + array semantics)

## 2) Types available (core framework)
In Clickeen terms, **Type = miniwidget**.

Countdown has 3 Types (selected by `timer.mode`):
- `date` — countdown to a specific date/time + timezone
- `personal` — per-visitor countdown starting at first view (optional repeat)
- `number` — count up/down toward a target over a duration

Rule: `timer.mode` is the only Type axis. Everything else is a normal control binding.

## 3) Canonical state (authoritative)
Defaults are the state contract. No runtime merges.

Top-level groups:
- `timer.*` — type + mode settings + headline
- `layout.*` — arrangement and spacing
- `appearance.*` — paint (fills, borders, colors)
- `behavior.*` — backlink + small toggles
- `actions.*` — “during” CTA + “after end” behavior
- `seoGeo.*` — embed optimization toggle (policy-gated)
- `typography.*` — roles (compiler-injected)
- `stage.*`, `pod.*` — Stage/Pod v2 (desktop+mobile padding objects)

Note: `workspace.websiteUrl` is a workspace setting (persistent on the workspace). It is not part of widget instance config; Copilot may use it as context.

## 4) DOM contract (stable hooks)
All runtime selectors must be scoped within `[data-ck-widget="countdown"]`.

Required roles (minimum):
- Root: `[data-ck-widget="countdown"]`
- Heading: `[data-role="heading"]`
- Timer container: `[data-role="timer"]`
- Unit tiles: `[data-role="unit"][data-unit="days|hours|minutes|seconds"]`
  - value: `[data-role="value"]`
  - label: `[data-role="label"]`
- CTA: `[data-role="cta"]` (anchor/button)
- After-end message: `[data-role="after-message"]`

## 5) Runtime requirements (deterministic)
`widget.client.js` must:
- Validate state shape up front (throw clear errors; no merges).
- Set `data-mode="<date|personal|number>"` on root.
- Update all text/visibility via stable `data-role` hooks.
- Drive all visual differences via CSS vars + `data-*`.
- Apply platform globals:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`

Personal countdown persistence rule (deterministic):
- Store start time in `localStorage` keyed by **widget instance id** (use `state.instanceId` once we have it, otherwise `publicId` injected by embed; do not invent random ids).
- If the key is missing: set it once and reuse.

## 6) ToolDrawer panels (required mapping)
Panels:
- **Content**: `timer.*` (mode picker + mode settings)
- **Layout**: `layout.*` + Stage/Pod controls (injected via defaults)
- **Appearance**: `appearance.*` (colors/borders/shadows where applicable)
- **Typography**: injected (roles: `heading`, `timer`, `label`, `button`)
- **Behavior**: `behavior.showBacklink` + small toggles
- **Actions**: `actions.*` (CTA during + after-end behavior)
- **Settings**: workspace website URL setting (policy-gated; not widget instance state)
- **Advanced**: only if we ship `settings.*` (avoid custom CSS/JS in v1)

## 7) Defaults (authoritative `spec.json` → `defaults`)
The implementer must translate this PRD into a complete defaults object in `tokyo/widgets/countdown/spec.json`.
Defaults must include:
- `seoGeo: { enabled: false }`
- `behavior: { showBacklink: true }`
- Stage/Pod v2 padding shape: `padding.desktop` + `padding.mobile` objects

## Links
- `documentation/architecture/CONTEXT.md`
- `documentation/widgets/WidgetBuildProcess.md`
