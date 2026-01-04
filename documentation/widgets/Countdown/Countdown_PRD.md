# content.countdown — Countdown Widget PRD

STATUS: NORMATIVE — IN PROGRESS (Refactor)

This is the canonical PRD for the Countdown widget in the current Clickeen model.
For deep competitor feature inventory, see `documentation/widgets/Countdown/Countdown_competitoranalysis.md`.

## 0) Non-negotiables (Architecture)
1. **Starter designs are instances**: there is no separate preset system; curated designs are Clickeen-owned instances that users clone.
2. **No silent fixups**: editor + runtime must not invent state, merge defaults, coerce invalid values, or generate IDs at render time.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **CSS-first variants**: variants are driven by `data-*` + CSS variables; JS only sets attributes/vars and updates content.

## Subject Policy — Flags / Caps / Budgets (Matrices)

X-axis is the policy profile: **DevStudio**, **MiniBob**, **Free**, **Tier 1**, **Tier 2**, **Tier 3**.

Notes:
- This widget is not yet a Tokyo 5-file package in this repo; **exact state paths are TBD** until `tokyo/widgets/countdown/spec.json` exists.
- Use `?` in the matrices where product decisions are not finalized yet; replace `?` with `A/B` or numbers before implementation.

### Matrix A — Flags (ALLOW/BLOCK)

```text
Legend: A=ALLOW, B=BLOCK, ?=TBD

Row                | DS | MB | F  | T1 | T2 | T3
------------------ |----|----|----|----|----|----
seoGeoEnabled      | A  | ?  | ?  | ?  | ?  | ?
removeBranding     | A  | ?  | ?  | ?  | ?  | ?
modePersonalAllowed| A  | ?  | ?  | ?  | ?  | ?
modeNumberAllowed  | A  | ?  | ?  | ?  | ?  | ?
```

**Flag key (details)**

```text
Flag key
Row               | Path                         | Enforcement | Upsell | Meaning
----------------- | ---------------------------- | ----------- | ------ | -------------------------
seoGeoEnabled     | seoGeo.enabled (TBD)         | OPS+LOAD    | UP     | SEO/GEO optimization toggle
removeBranding    | behavior.showBacklink=false (TBD) | UI+OPS  | UP     | Remove branding
modePersonalAllowed | timer.mode='personal' (TBD) | UI+OPS     | UP     | Personal countdown mode
modeNumberAllowed   | timer.mode='number' (TBD)   | UI+OPS     | UP     | Number counter mode
```

### Matrix B — Caps (numbers)

```text
Legend: ∞ means “no cap”, ? means “TBD”

Row            |  DS |  MB |   F |  T1 |  T2 |  T3
-------------- |-----|-----|-----|-----|-----|-----
maxActions     |   ∞ |   ? |   ? |   ? |   ∞ |   ∞
maxMessageChars|   ∞ |   ? |   ? |   ? |   ∞ |   ∞
```

**Cap key (details)**

```text
Cap key
Row           | Path | Enforcement      | Violation | Upsell | Meaning
------------- | ---- | --------------- | --------- | ------ | -------------------------
maxActions    | (TBD)| OPS(set/insert)  | REJECT    | UP     | Max CTA buttons (during + after)
maxMessageChars | (TBD) | OPS(set)     | REJECT    | UP     | Max custom message length (chars)
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
uploads      | — (Countdown has no uploads) | —               | —      | —
```

## 1) Where the widget lives
- Widget definition (the software): `tokyo/widgets/countdown/`
  - `spec.json` (defaults + ToolDrawer markup)
  - `widget.html` (semantic scaffold)
  - `widget.css` (scoped styles; Dieter tokens)
  - `widget.client.js` (applyState)
- Canonical state shape for editing is `tokyo/widgets/countdown/spec.json` → `defaults`.

## 2) Scope (Phase-1)
Target: **70%+ core parity** with a clean path to full parity.
Execution plan: `CurrentlyExecuting/Countdown_Widget_Refactor_Plan.md`.

## 2.1) Functional scope (what the widget must do)
### Timer modes
- **Countdown to date**: count down to a specific date/time + timezone.
- **Personal countdown**: starts on first view per visitor; supports optional repeat.
- **Number counter**: counts up/down toward a target over a duration.

### Optional actions
- **Button during**: optional CTA button (text, URL, style, open-in-new-tab).
- **After action**: what happens at end (hide, do nothing, show button, message).

### Layout / placement
- Layout types as declared in `tokyo/widgets/countdown/spec.json` (`layout.type`).
- Consistent spacing via `layout.gap`.

### Visual system
- Theme presets + individual colors.
- Timer style + separators + animation.
- Visibility toggles for units + labels and time format.
- Typography roles: `heading`, `timer`, `label`, `button`.

## 3) Model: starter designs (curated instances)
Competitor “gallery presets” are implemented as **curated instances**:
- Clickeen team creates `ck-countdown-*` source instances using Bob/DevStudio.
- Prague shows those source instances in a gallery.
- “Use this” clones the source instance config into the user’s workspace and opens Bob on the cloned instance.

This keeps one system (instances) and avoids separate preset CRUD, versioning, or migration logic.

## 4) Canonical state (current)
The Countdown instance state is grouped as:
- `timer.*` — mode + mode-specific settings (date/personal/number) + heading
- `actions.*` — during/after behavior (CTA + after-action)
- `layout.*` — placement + widget layout values
- `theme.*` — preset + colors + timer style + animation + separator + time format
- `typography.*` — global family + per-role selections (compiler-injected panel)
- `stage.*` + `pod.*` — stage/pod layout and appearance (compiler-injected panel)
- `settings.*` — language + advanced fields (e.g. custom CSS/JS)
- `behavior.*` — backlink on/off

Source of truth: `tokyo/widgets/countdown/spec.json`.

## 5) ToolDrawer panels (current)
Panels are defined in `tokyo/widgets/countdown/spec.json` and augmented by compiler modules:
- `content` — `timer.*`
- `layout` — `layout.*` + stage/pod controls (injected because defaults include `stage`/`pod`)
- `appearance` — `theme.preset` + color picks
- `style` — `theme.*` style controls (timer style, animation, separator, time format, unit visibility)
- `typography` — injected because defaults include `typography.roles` (compiler strips any author-defined typography panel)
- `behavior` — `actions.*` + `behavior.showBacklink`
- `advanced` — `settings.*`

## 6) Runtime requirements
Widget runtime (`tokyo/widgets/countdown/widget.client.js`) must:
- Query within the widget root (no global selectors for internals)
- Apply state deterministically (no default merges; missing required state is an editor bug)
- Use shared runtime modules when applicable (`tokyo/widgets/shared/*`)

## 7) Acceptance criteria (refactor)
See `CurrentlyExecuting/Countdown_Widget_Refactor_Plan.md` for detailed P0/P1 items; the minimum is:
- Correct timer math (carry-down for hidden units; no modulo bugs)
- Correct layout behavior (fixed top/bottom bars, not sticky)
- Deterministic personal countdown persistence (per-instance key)
- Clean DOM/CSS contract (stable wrapper elements referenced by CSS and JS)

---
Links:
- `documentation/architecture/CONTEXT.md` (canonical concepts)
- `documentation/widgets/WidgetArchitecture.md` (widget system)
