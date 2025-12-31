# content.faq — FAQ Widget PRD

STATUS: PRD — IMPLEMENTED (v1) / Iterating

This is the canonical PRD for the FAQ widget in the Clickeen model.
For competitor feature inventory, see `documentation/widgets/FAQ/FAQ_competitoranalysis.md`.

## What this widget does (1 sentence)

Renders an FAQ section (questions + answers) with an optional accordion interaction, with content managed in Bob and rendered deterministically in the embed.

## Types available (core framework)

FAQ has **one Type**: **FAQ**.

Why this matters:
- With one Type, the content model is fixed (sections → questions/answers).
- The main variation axis is **Layout**, not Type.

How it differs from other widgets:
- Content is structured text (sections + Q/A items) and the runtime can optionally make it interactive (accordion).

Layout choices (inside the same Type):
- `layout.type = accordion | list | multicolumn`

## 0) Non-negotiables (Architecture)
1. **Starter designs are instances**: curated designs are Clickeen-owned instances that users clone.
2. **Editor is strict**: no silent fixups, no coercing bad values, no inventing missing state.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **Scoped runtime**: runtime queries inside the widget root (no global selectors for internals).

## 1) Where the widget lives
Widget definition (the software): `tokyo/widgets/faq/`
- `spec.json` — defaults + ToolDrawer markup
- `widget.html` — semantic scaffold
- `widget.css` — scoped styles (Dieter tokens)
- `widget.client.js` — `applyState(state)` runtime

Source of truth for editor state is `tokyo/widgets/faq/spec.json` → `defaults`.

## 2) Functional spec

### Content
- Widget renders 1+ sections. Each section has:
  - `title`
  - ordered list of `faqs[]` (question/answer items)
- Each FAQ item has:
  - `question` (supports a small allowed set of inline tags)
  - `answer` (plain text with URL auto-linking + optional image/video embedding)

### Layouts
State: `layout.type`
- `accordion`: interactive expand/collapse
- `list`: all answers visible, no interaction
- `multicolumn` (“Cards”): all answers visible, multi-column layout (responsive columns)

### Accordion behavior
State: `behavior.*`
- `expandFirst`
- `multiOpen`
- `expandAll`

### Media behavior in answers
State: `behavior.displayImages`, `behavior.displayVideos`
- If enabled, image/video URLs in answers render as media; otherwise they render as links.

## 3) Accordion icon system (single choice, deterministic pairs)
State: `appearance.iconStyle`
- `plus` → expand `plus`, collapse `minus`
- `chevron` → expand `chevron.down`, collapse `chevron.up`
- `arrow` → expand `arrow.down`, collapse `arrow.up`
- `arrowshape` → expand `arrowshape.down`, collapse `arrowshape.up`

Icons are Dieter icons and should be rendered as `diet-btn-ic` (neutral).

## 4) Canonical state (current)
Grouped state (source of truth: `tokyo/widgets/faq/spec.json`):
- `sections[]` — content tree (section title + list of Q/A items)
- `layout.*` — layout type, responsive columns, gap
- `appearance.*` — item background + question/answer colors + accordion icon choice
- `behavior.*` — accordion toggles + media toggles + backlink
- `typography.*` — global family + per-role selections (compiler-injected panel)
- `stage.*` + `pod.*` — stage/pod layout and appearance

## 5) ToolDrawer panels (current)
Panels defined in `tokyo/widgets/faq/spec.json`:
- `content` — section manager + Q/A editing + show title controls
- `layout` — widget layout + accordion behaviors + responsive columns (+ shared stage/pod layout injected by compiler)
- `appearance` — widget appearance + stage/pod appearance
- `settings` — media toggles + backlink

Compiler-injected (because defaults include `typography.roles`):
- `typography` — standardized typography controls (compiler strips any author-defined typography panel)

## 6) Runtime requirements
Widget runtime (`tokyo/widgets/faq/widget.client.js`) must:
- Render from state deterministically (no default merges; missing required state is an editor bug)
- Sanitize any inline HTML allowed in questions
- Convert URLs in answers to links and optionally embed images/videos
- Use Dieter tokens + Dieter icon system for visuals
