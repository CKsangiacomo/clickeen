# content.countdown — Countdown Widget PRD

STATUS: PRD

## What this widget does (1 sentence)
Renders a configurable countdown / personal countdown / number counter with optional CTA and “after end” behavior, edited in Bob and rendered deterministically in the embed.

## 0) Non-negotiables (Architecture)
1. **Starter designs are instances**: curated designs are Clickeen-owned instances that users clone.
2. **No silent fixups**: editor + runtime must not invent state, merge defaults, coerce invalid values, or generate IDs at render time.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **CSS-first variants**: variants are driven by `data-*` + CSS variables; JS only sets attributes/vars and updates text/visibility.

## Subject Policy — Flags / Caps / Budgets (Matrices)

X-axis is the policy profile: **DevStudio**, **MiniBob**, **Free**, **Tier 1**, **Tier 2**, **Tier 3**.

### Matrix A — Flags (ALLOW/BLOCK)

```text
Legend: A=ALLOW, B=BLOCK

Row                 | DS | MB | F  | T1 | T2 | T3
------------------- |----|----|----|----|----|----
seoGeoEnabled       | A  | B  | B  | A  | A  | A
removeBranding      | A  | B  | B  | A  | A  | A
websiteUrlAllowed   | A  | B  | A  | A  | A  | A
modeDateAllowed     | A  | A  | A  | A  | A  | A
modePersonalAllowed | A  | B  | B  | A  | A  | A
modeNumberAllowed   | A  | B  | B  | A  | A  | A
```

**Flag key (details)**

```text
Flag key
Row                 | Path                     | Enforcement | Upsell | Meaning
------------------- | ------------------------ | ----------- | ------ | -------------------------
seoGeoEnabled       | seoGeo.enabled           | OPS+LOAD    | UP     | SEO/GEO optimization toggle
removeBranding      | behavior.showBacklink=false | UI+OPS   | UP     | Remove branding
websiteUrlAllowed   | ai.websiteUrl            | UI+OPS      | UP     | Website URL for Copilot/AI content generation
modeDateAllowed     | timer.mode='date'        | UI+OPS      | —      | Countdown to a date/time
modePersonalAllowed | timer.mode='personal'    | UI+OPS      | UP     | Personal countdown (per-visitor start)
modeNumberAllowed   | timer.mode='number'      | UI+OPS      | UP     | Number counter (count up/down)
```

### Matrix B — Caps (numbers)

```text
Legend: ∞ means “no cap”

Row              |  DS |  MB |   F |  T1 |  T2 |  T3
---------------- |-----|-----|-----|-----|-----|-----
maxActions       |   ∞ |   1 |   1 |   2 |   ∞ |   ∞
maxMessageChars  |   ∞ |  80 | 140 | 300 |   ∞ |   ∞
```

**Cap key (details)**

```text
Cap key
Row             | Path                         | Enforcement | Violation | Upsell | Meaning
--------------- | ---------------------------- | ---------- | --------- | ------ | -------------------------
maxActions      | actions.during.enabled + actions.after.* | UI+OPS | REJECT | UP | Max enabled actions (CTA and/or after-action)
maxMessageChars | actions.after.messageText    | OPS(set)    | REJECT    | UP     | Max “after end” message length (chars)
```

### Matrix C — Budgets (numbers)

```text
Legend: ∞ means “no budget limit”

Row          |  DS |  MB |   F |  T1 |  T2 |  T3
------------ |-----|-----|-----|-----|-----|-----
copilotTurns |   ∞ |   4 |  20 | 100 | 300 |   ∞
edits        |   ∞ |  10 |   ∞ |   ∞ |   ∞ |   ∞
uploads      |   ∞ |   5 |   ∞ |   ∞ |   ∞ |   ∞
```

**Budget key (details)**

Budgets are **per-session counters**. When a budget reaches 0, the consuming action is blocked and the Upsell popup is shown.

```text
Budget key
Row          | Consumed when              | Counts as          | Upsell | Notes
------------ | -------------------------- | ------------------ | ------ | -------------------------
copilotTurns | Copilot prompt submit      | 1 per user prompt  | UP     | —
edits        | any successful edit        | 1 per state change | UP     | continue editing your widget by creating a free account
uploads      | — (Countdown has no uploads) | —                | —      | —
```

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
- `ai.*` — AI context (Copilot-only; runtime may ignore)
- `seoGeo.*` — embed optimization toggle (policy-gated)
- `typography.*` — roles (compiler-injected)
- `stage.*`, `pod.*` — Stage/Pod v2 (desktop+mobile padding objects)

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
- **Settings**: `ai.websiteUrl` (policy-gated)
- **Advanced**: only if we ship `settings.*` (avoid custom CSS/JS in v1)

## 7) Defaults (authoritative `spec.json.defaults`)
The implementer must translate this PRD into a complete defaults object in `tokyo/widgets/countdown/spec.json`.
Defaults must include:
- `seoGeo: { enabled: false }`
- `behavior: { showBacklink: true }`
- `ai: { websiteUrl: "" }`
- Stage/Pod v2 padding shape: `padding.desktop` + `padding.mobile` objects

## Links
- `documentation/architecture/CONTEXT.md`
- `documentation/widgets/WidgetBuildProcess.md`
