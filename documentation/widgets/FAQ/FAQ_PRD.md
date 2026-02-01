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

## Subject Policy — Entitlements (v1)

Tier values are defined globally in `config/entitlements.matrix.json`.

Widget-specific enforcement lives in:
- `tokyo/widgets/faq/limits.json`

Use the limits mapping for paths + metrics; do not duplicate per-tier matrices here.

Entitlements mapping (must match `tokyo/widgets/faq/limits.json`):

```text
Key                      | Kind | Path(s)                    | Metric/Mode            | Enforcement        | Notes
------------------------ | ---- | -------------------------- | ---------------------- | ------------------ | ----------------------------
seoGeo.enabled           | flag | seoGeo.enabled             | boolean (deny true)    | load+ops+publish   | sanitize to false on load
branding.remove          | flag | behavior.showBacklink      | boolean (deny false)   | load+ops+publish   | sanitize to true on load
media.images.enabled     | flag | behavior.displayImages     | boolean (deny true)    | load+ops+publish   | sanitize to false on load
media.videos.enabled     | flag | behavior.displayVideos     | boolean (deny true)    | load+ops+publish   | sanitize to false on load
list.primary.max         | cap  | sections[]                 | count                  | ops+publish        | section count cap
list.secondary.rich.max  | cap  | sections[].faqs[]          | count                  | ops+publish        | per-section Q/A count cap
list.secondary.rich.total.max | cap | sections[].faqs[]       | count-total            | ops+publish        | total Q/A count cap
text.question.max        | cap  | sections[].faqs[].question | chars                  | ops+publish        | question length cap
text.answer.max          | cap  | sections[].faqs[].answer   | chars                  | ops+publish        | answer length cap
```

## 1) Where the widget lives
Widget definition (the software): `tokyo/widgets/faq/`
- `spec.json` — defaults + ToolDrawer markup
- `widget.html` — semantic scaffold
- `widget.css` — scoped styles (Dieter tokens)
- `widget.client.js` — `applyState(state)` runtime
- `agent.md` — AI editing contract
- `limits.json` — entitlements caps/flags (Paris validation)
- `localization.json` — locale-layer allowlist
- `layers/*.allowlist.json` — non-locale layer allowlists (when used)

Source of truth for editor state is `tokyo/widgets/faq/spec.json` → `defaults`.

## 2) Functional spec

### Content
- Widget renders 1+ sections. Each section has:
  - `id` (string; required, stable)
  - `title`
  - ordered list of `faqs[]` (question/answer items)
- Each FAQ item has:
  - `id` (string; required, stable)
  - `question` (supports a small allowed set of inline tags; links are not allowed)
  - `answer` (supports the same inline tags + links; URLs auto-link + optional image/video embedding)
  - `defaultOpen` (boolean; accordion only)

### Canonical IDs (required)
FAQ is strict: `sections[].id` and `sections[].faqs[].id` must exist at runtime.

Why:
- Stable list keys (editor + runtime)
- Deterministic deep links when enabled (`geo.enableDeepLinks`)

Rules:
- IDs are generated **at edit-time** (Bob) when creating sections/items.
- AI ops that create a section/item must include an `id` (use a stable uuid-like string).
- Never “rename” ids as a styling/content change; treat ids as persistent identifiers.
Deep-link DOM id contract (accordion):
- Question item: `faq-q-<publicId>-<item.id>`
- Answer region: `faq-a-<publicId>-<item.id>`

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
Icon color is controlled via `appearance.iconColor` (color fill).

## 4) Canonical state (current)
Grouped state (source of truth: `tokyo/widgets/faq/spec.json`):
- `sections[]` — content tree (section title + list of Q/A items)
- `layout.*` — layout type, responsive columns, gap
- `appearance.*` — link styling + accordion icon choice/color + Q&A card styling (background/border/radius/shadow) + pod border + `appearance.theme` (global theme selector; editor-only shortcut)
- `behavior.*` — accordion toggles + media toggles + backlink
- `seoGeo.*` + `seo.*` + `geo.*` — SEO/GEO controls (schema, canonical URL, deep links)
- `context.*` — Copilot context (editor-only; runtime may ignore)
- `typography.*` — global family + per-role selections (including text colors; compiler-injected panel)
- `stage.*` + `pod.*` — stage/pod layout and appearance (including pod shadow)

## 5) ToolDrawer panels (current)
Panels defined in `tokyo/widgets/faq/spec.json`:
- `content` — section manager + Q/A editing + global header controls (compiler-injected)
- `layout` — widget layout + accordion behaviors + responsive columns (+ shared stage/pod layout injected by compiler)
- `appearance` — theme dropdown (global) + widget appearance + stage/pod appearance
- `settings` — AI context (website URL) + SEO/GEO toggles + media toggles + backlink

ToolDrawer spacing rule (authoring):
- Vertical rhythm is **clusters + groups only**. Use `<tooldrawer-cluster>` to segment sections and group keys for labels.
- No custom spacing wrappers or per-control margins; only cluster/group labels add bottom margin.

## 5.0) Panel-by-panel contract (AI, deterministic)
This section is the “what goes where” contract. If controls drift across panels, AIs will make incorrect edits.

### Panel: Content (`content`)
Source: `tokyo/widgets/faq/spec.json`

Controls:
- `sections[]` (object manager)
  - Section shape: `{ id, title, faqs[] }`
  - Item shape: `{ id, question, answer, defaultOpen }`
- Global header (compiler-injected when `defaults.header` + `defaults.cta` exist):
  - `header.enabled`
  - `header.title`
  - `header.showSubtitle`
  - `header.subtitleHtml`
  - `cta.enabled`
  - `cta.label`
  - `cta.href`
  - `cta.iconEnabled`
  - `cta.iconName` (allowed: `checkmark`, `arrow.right`, `chevron.right`, `arrowshape.forward`, `arrowshape.turn.up.right`)
  - `cta.iconPlacement` (`left|right`)
- `displayCategoryTitles` (toggle)

Localization:
- Localization/translation UI lives in Content (Translate mode).
- The allowlist is `tokyo/widgets/faq/localization.json`.
  - `header.title` (richtext)
  - `header.subtitleHtml` (richtext)
  - `cta.label` (string)
  - `sections.*.title` (string)
  - `sections.*.faqs.*.question` (string)
  - `sections.*.faqs.*.answer` (richtext)

### Panel: Layout (`layout`)
Source: `tokyo/widgets/faq/spec.json` + compiler injection

Widget layout controls (spec-defined):
- `layout.type` (choice tiles): `accordion | list | multicolumn`
- `layout.gap` (px number)
- Accordion-only:
  - `behavior.expandFirst`
  - `behavior.multiOpen`
  - `behavior.expandAll`
- Multicolumn-only:
  - `layout.columns.desktop`
  - `layout.columns.mobile`
- Item padding:
  - `layout.itemPaddingLinked`
  - `layout.itemPadding` (when linked)
  - `layout.itemPaddingTop|Right|Bottom|Left` (when unlinked)

Header layout controls (compiler-injected when `defaults.header` + `defaults.cta` exist):
- `header.placement`
- `header.alignment`
- `header.ctaPlacement` (show-if `cta.enabled == true`)

Stage/Pod layout controls (compiler-injected for all widgets):
- `pod.widthMode`, `pod.contentWidth`
- `stage.alignment`
- `pod.padding.desktop.*`, `pod.padding.mobile.*`
- `stage.canvas.*`
- `stage.padding.desktop.*`, `stage.padding.mobile.*`

### Panel: Appearance (`appearance`)
Source: `tokyo/widgets/faq/spec.json` + compiler injection

Widget appearance controls (spec-defined):
- `appearance.theme` (editor-only theme selector; runtime ignores)
- Links (only shown when content contains links):
  - `appearance.linkStyle`
  - `appearance.linkUnderlineColor` (when `linkStyle == 'underline'`)
  - `appearance.linkHighlightColor` (when `linkStyle == 'highlight'`)
  - `appearance.linkTextColor` (when `linkStyle == 'color'`)
- Accordion-only:
  - `appearance.iconStyle`
  - `appearance.iconColor`
- Q&A card:
  - `appearance.itemBackground`
  - `appearance.cardwrapper.radiusLinked` + radius fields
  - `appearance.cardwrapper.border`
  - `appearance.cardwrapper.shadow`
- Header CTA (compiler-injected when `defaults.header` + `defaults.cta` exist):
  - `appearance.ctaBackground`
  - `appearance.ctaTextColor`
  - `appearance.ctaBorder`
  - `appearance.ctaRadius`
  - `appearance.ctaSizePreset` (editor preset selector; expands to button typography size + CTA padding)
  - `appearance.ctaPaddingLinked`
  - `appearance.ctaPaddingInline`
  - `appearance.ctaPaddingBlock`
  - `appearance.ctaIconSizePreset` (editor preset selector; expands to `appearance.ctaIconSize`)
  - `appearance.ctaIconSize`
- Stage/Pod (background + pod border):
  - `stage.background`
  - `pod.background`
  - `appearance.podBorder`

Stage/Pod corner appearance (compiler-injected for all widgets):
- `pod.shadow`
- `pod.radiusLinked`, `pod.radius`, `pod.radiusTL|TR|BR|BL`

Typography note:
- Text styling (fonts + text colors) is only in the Typography panel (see below). Do not duplicate text controls into Appearance.

### Panel: Settings (`settings`)
Source: `tokyo/widgets/faq/spec.json`

Controls:
- Copilot context:
  - `context.websiteUrl` (AI-only; runtime ignores)
- SEO/GEO:
  - `seoGeo.enabled`
  - `seo.enableSchema` (shown when `seoGeo.enabled == true`)
  - `seo.canonicalUrl` (shown when `seoGeo.enabled == true`)
  - `geo.enableDeepLinks` (shown when `seoGeo.enabled == true`)
- Behavior:
  - `behavior.displayVideos`
  - `behavior.displayImages`
  - `behavior.showBacklink`

Entitlements enforcement:
- Enforced by `tokyo/widgets/faq/limits.json` (Paris validates load/ops/publish).

### Panel: Typography (`typography`, compiler-injected)
Why it exists:
- Widgets that declare `defaults.typography.roles` get a standardized Typography panel.
- This is the only supported place for text styling (including text colors).

Controls (FAQ roles):
- `typography.roles.title.*`
- `typography.roles.body.*`
- `typography.roles.section.*`
- `typography.roles.question.*`
- `typography.roles.answer.*`
- `typography.roles.button.*`

## 5.1) AI behavior (Copilot, uses `context.websiteUrl`)
If `context.websiteUrl` is present and policy allows it, Copilot may:
- Rewrite or propose FAQ content (sections/questions/answers) based on the website URL.
- Preserve the widget’s deterministic render: this is content generation only; runtime does not “fetch the website”.

Compiler-injected (because defaults include `typography.roles`):
- `typography` — standardized typography controls (this is the only place for text styling; compiler strips any author-defined typography panel)

## 5.2) Themes (global, editor-only)
- Theme is a **global** dropdown in Appearance (`appearance.theme`).
- Selection previews in-editor; only **Apply theme** commits changes to state.
- Themes apply only: `stage.background`, `pod.background`, `appearance.itemBackground`, and `typography.globalFamily`.

## 6) Runtime requirements
Widget runtime (`tokyo/widgets/faq/widget.client.js`) must:
- Render from state deterministically (no default merges; missing required state is an editor bug)
- Sanitize any inline HTML allowed in questions/answers
- Convert URLs in answers to links and optionally embed images/videos
- Use Dieter tokens + Dieter icon system for visuals

## 7) Gold standard checklist (AI)
When changing FAQ state/controls/runtime, keep the system coherent:
1. `tokyo/widgets/faq/spec.json`: update defaults + panel controls (do not duplicate Typography controls into Appearance).
2. `tokyo/widgets/faq/widget.client.js`: update `assertFaqState(...)` + `applyState(...)` so every control has a deterministic effect.
3. `tokyo/widgets/faq/agent.md`: update the Editable Schema + Binding Map rows for any new/changed paths (no dead controls).
4. `tokyo/widgets/faq/localization.json`: update allowlist if you add/move any localized content fields.
5. `tokyo/widgets/faq/limits.json`: update entitlements limits if you add gated controls/metrics.
6. Venice SEO/GEO: update `venice/lib/schema/faq.ts` (schema + excerpt) if SEO/GEO outputs change.
7. Verify: `node scripts/compile-all-widgets.mjs` must pass.
