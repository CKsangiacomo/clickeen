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
- When `layout.type = multicolumn` (“Cards”), cards packing is controlled by `layout.cardsLayout = grid | masonry`.

## 0) Non-negotiables (Architecture)

1. **Account instances are the authoring unit**: Bob edits one account widget instance at a time.
2. **Editor is strict**: no silent fixups, no coercing bad values, no inventing missing state.
3. **Deterministic render**: the same instance state produces the same output every time.
4. **Scoped runtime**: runtime queries inside the widget root (no global selectors for internals).

## Subject Policy — Entitlements (v1)

Tier values are defined globally in `packages/ck-policy/entitlements.matrix.json`.

Widget-specific enforcement lives in:

- `tokyo/product/widgets/faq/limits.json`

Use the limits mapping for paths + metrics; do not duplicate per-tier matrices here.

Entitlements mapping (must match `tokyo/product/widgets/faq/limits.json`):

```text
Key                        | Kind | Path(s)                    | Metric/Mode          | Enforcement        | Notes
-------------------------- | ---- | -------------------------- | -------------------- | ------------------ | ----------------------------
branding.remove            | flag | behavior.showBacklink      | boolean (deny false) | load sanitize; ops | Bob gates/rejects editor ops; server save/publish is a named gap
items.group.small.max  | limit | sections[]                 | count                | ops+publish        | section count limit group
items.group.medium.max | limit | sections[].faqs[]          | count                | ops+publish        | per-section Q/A count limit group
items.group.large.max  | limit | sections[].faqs[]          | count-total          | ops+publish        | total Q/A count limit group
```

Current implementation note: `limits.json` maps FAQ state paths to real `ck-policy` keys. Bob enforces the mapping during editor operations today. Server save/publish enforcement is a named `ck-policy` gap and must not be implied until implemented.

## 1) Where the widget lives

Widget definition (the software): `tokyo/product/widgets/faq/`

- `spec.json` — defaults + structured Builder editor contract
- `editable-fields.json` — editable/translatable text field contract
- `widget.html` — semantic scaffold
- `widget.css` — scoped styles (Dieter tokens)
- `widget.client.js` — `applyState(state)` runtime
- `limits.json` — entitlement limits/flags

Source of truth for editor state is `tokyo/product/widgets/faq/spec.json` → `defaults`.
Source of truth for translation fields is `tokyo/product/widgets/faq/editable-fields.json`.

## 2) Functional spec

### Content

- Widget renders 1+ sections. Each section has:
  - `id` (string; required, stable)
  - `title`
  - ordered list of `faqs[]` (question/answer items)

Runtime DOM contract (sections):

- Each section renders as a **wrapper**:
  - Section header (optional; controlled by `displayCategoryTitles`)
  - Section body container that holds **only items** (enables Cards grid/masonry without mixing section metadata into the item flow)
- Each FAQ item has:
  - `id` (string; required, stable)
  - `question` (supports a small allowed set of inline tags; links are not allowed)
  - `answer` (supports the same inline tags + links; URLs auto-link to anchors only)
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
- Question item: `faq-q-<instanceId>-<item.id>`
- Answer region: `faq-a-<instanceId>-<item.id>`

### Layouts

State: `layout.type`

- `accordion`: interactive expand/collapse
- `list`: all answers visible, no interaction
- `multicolumn` (“Cards”): all answers visible, multi-column layout (responsive columns)

Cards packing (only when `layout.type = multicolumn`):

- `layout.cardsLayout = grid` (row/column grid; DOM order maps to row-scan)
- `layout.cardsLayout = masonry` (CSS columns; visual scan order is column-first top→bottom per column)

### Accordion behavior

State: `behavior.*`

- `expandFirst`
- `multiOpen`
- `expandAll`

### Media behavior in answers

State: no media toggles.

- Answers do not embed image/video media.
- URL-like text in answers is sanitized and rendered as safe links.

## 3) Accordion icon system (single choice, deterministic pairs)

State: `appearance.iconStyle`

- `plus` → expand `plus`, collapse `minus`
- `chevron` → expand `chevron.down`, collapse `chevron.up`
- `arrow` → expand `arrow.down`, collapse `arrow.up`
- `arrowshape` → expand `arrowshape.down`, collapse `arrowshape.up`

Icons are Dieter icons and should be rendered as `diet-btn-ic` (neutral).
Icon color is controlled via `appearance.iconColor` (color fill).

## 4) Canonical state (current)

Grouped state (source of truth: `tokyo/product/widgets/faq/spec.json`):

- `sections[]` — content tree (section title + list of Q/A items)
- `layout.*` — layout type, responsive columns, gap
- `appearance.*` — link styling + accordion icon choice/color + Q&A card styling (background/border/radius/shadow) + pod border + `appearance.theme` (global theme selector stored in the canonical authored document; runtime ignores it)
- `behavior.*` — accordion toggles + backlink
- `seoGeo.*` + `seo.*` + `geo.*` — SEO/GEO controls (schema, canonical URL, deep links)
- `context.*` — Copilot/product context stored in the canonical authored document (runtime ignores it)
- `typography.*` — global family + per-role selections (including text colors; explicitly declared shared typography panel)
- `stage.*` + `pod.*` — stage/pod layout and appearance (including pod shadow)

## 5) Builder editor panels (current)

Panels defined in `tokyo/product/widgets/faq/spec.json`:

- `content` — section manager + Q/A editing + explicitly declared shared header controls
- `layout` — widget layout + accordion behaviors + responsive columns + explicitly declared shared stage/pod layout
- `appearance` — theme dropdown (global) + widget appearance + stage/pod appearance
- `settings` — AI context (website URL) + SEO/GEO toggles + backlink

Builder editor spacing rule (authoring):

- Vertical rhythm is **clusters + groups only**. Use explicit cluster objects and field `groupId` values in `spec.json.editor`.
- No custom spacing wrappers or per-control margins; only cluster/group labels add bottom margin.

## 5.0) Panel-by-panel contract (AI, deterministic)

This section is the “what goes where” contract. If controls drift across panels, AIs will make incorrect edits.

### Panel: Content (`content`)

Source: `tokyo/product/widgets/faq/spec.json`

Controls:

- `sections[]` (object manager)
  - Section shape: `{ id, title, faqs[] }`
  - Item shape: `{ id, question, answer, defaultOpen }`
- Global header (declared with shared header controls when `defaults.header` + `defaults.headerCta` exist):
  - `header.enabled`
  - `header.title`
  - `header.showSubtitle`
  - `header.subtitleHtml`
  - `headerCta.enabled`
  - `headerCta.label`
  - `headerCta.href`
  - `headerCta.iconEnabled`
  - `headerCta.iconName` (allowed: `checkmark`, `arrow.right`, `chevron.right`, `arrowshape.forward`, `arrowshape.turn.up.right`)
  - `headerCta.iconPlacement` (`left|right`)
- `displayCategoryTitles` (toggle)

Translation fields:

- Localization/translation UI lives in Content (Translate mode).
- The source is `tokyo/product/widgets/faq/editable-fields.json`.
- Required coverage:
  - `header.title`
  - `header.subtitleHtml`
  - `headerCta.label`
  - `sections[].title`
  - `sections[].faqs[].question`
  - `sections[].faqs[].answer`
- Before producer calls, repeatable declarations are expanded against the saved config into concrete paths such as `sections.0.faqs.0.question`.
- FAQ must not add `localization.json`, layer sidecars, text packs, or wildcard producer payloads.
- In Builder preview, selecting a translated locale must change FAQ title, subtitle, CTA text, section titles, every question, and every answer together. A target language without translated values for the current save must not display old FAQ text.

### Panel: Layout (`layout`)

Source: `tokyo/product/widgets/faq/spec.json.editor`

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
  - `layout.cardsLayout` (`grid | masonry`)
- Item padding:
  - `layout.itemPaddingLinked`
  - `layout.itemPadding` (when linked)
  - `layout.itemPaddingTop|Right|Bottom|Left` (when unlinked)

Header layout controls (declared with shared header nodes when `defaults.header` + `defaults.headerCta` exist):

- `header.placement`
- `header.alignment`
- `header.ctaPlacement` (show-if `headerCta.enabled == true`)
- Header spacing (px; declared shared header controls):
  - `header.gap` (header ↔ content)
  - `header.textGap` (title ↔ subtitle; show-if `header.showSubtitle == true`)
  - `header.innerGap` (text ↔ CTA; show-if `headerCta.enabled == true`)

Stage/Pod layout controls (declared with shared stage/pod nodes):

- `pod.widthMode`, `pod.contentWidth`
- `stage.alignment`
- `pod.padding.desktop.*`, `pod.padding.mobile.*`
- `stage.canvas.*`
- `stage.padding.desktop.*`, `stage.padding.mobile.*`

### Panel: Appearance (`appearance`)

Source: `tokyo/product/widgets/faq/spec.json.editor`

Widget appearance controls (spec-defined):

- `appearance.theme` (canonical authoring theme selector; runtime ignores it)
- Links (only shown when content contains links):
  - `appearance.linkStyle`
  - `appearance.linkUnderlineColor` (when `linkStyle == 'underline'`)
  - `appearance.linkHighlightColor` (when `linkStyle == 'highlight'`)
  - `appearance.linkTextColor` (when `linkStyle == 'color'`)
- Accordion-only:
  - `appearance.iconStyle`
  - `appearance.iconColor`
- Q&A card:
  - `faq.appearance.itemBackground`
  - `faq.appearance.cardwrapper.radiusLinked` + radius fields
  - `faq.appearance.cardwrapper.border`
  - `faq.appearance.cardwrapper.shadow`
- Header CTA (declared with shared header controls when `defaults.header` + `defaults.headerCta` exist):
  - `appearance.headerCta.background`
  - `appearance.headerCta.textColor`
  - `appearance.headerCta.border`
  - `appearance.headerCta.radius`
  - `appearance.headerCta.sizePreset` (editor preset selector; expands to button typography size + CTA padding)
  - `appearance.headerCta.paddingLinked`
  - `appearance.headerCta.paddingInline`
  - `appearance.headerCta.paddingBlock`
  - `appearance.headerCta.iconSizePreset` (editor preset selector; expands to `appearance.headerCta.iconSize`)
  - `appearance.headerCta.iconSize`
- Stage/Pod (background + pod border):
  - `stage.background`
  - `pod.background`
  - `appearance.podBorder`

Stage/Pod corner appearance (declared with shared stage/pod controls):

- `pod.shadow`
- `pod.radiusLinked`, `pod.radius`, `pod.radiusTL|TR|BR|BL`

Typography note:

- Text styling (fonts + text colors) is only in the Typography panel (see below). Do not duplicate text controls into Appearance.

### Panel: Settings (`settings`)

Source: `tokyo/product/widgets/faq/spec.json`

Controls:

- SEO/GEO:
  - `seoGeo.enabled`
  - `seo.enableSchema` (shown when `seoGeo.enabled == true`)
  - `seo.canonicalUrl` (shown when `seoGeo.enabled == true`)
  - `geo.enableDeepLinks` (shown when `seoGeo.enabled == true`)
- Behavior:
  - `behavior.showBacklink`

Entitlements enforcement:

- `tokyo/product/widgets/faq/limits.json` maps FAQ paths to `ck-policy` keys.
- Bob uses policy/limits for editor UX gating and operation rejection today.
- Tokyo/Roma save/publish server enforcement is not currently proven; it remains a named `ck-policy` enforcement gap.

### Panel: Typography (`typography`, explicitly declared shared panel)

Why it exists:

- Widgets that declare `defaults.typography.roles` must explicitly declare the standardized Typography panel in `spec.json.editor`.
- This is the only supported place for text styling (including text colors).

Controls (FAQ roles):

- `typography.roles.title.*`
- `typography.roles.body.*` (Header subtitle; shown as “Subtitle” in the Typography panel)
- `typography.roles.section.*`
- `typography.roles.question.*`
- `typography.roles.answer.*`
- `typography.roles.button.*`

## 5.1) AI behavior (Copilot, uses account website context)

If the account/workspace website URL is present and policy allows it, Copilot
may:

- Rewrite or propose FAQ content (sections/questions/answers) based on the website URL.
- Preserve the widget’s deterministic render: this is content generation only; runtime does not “fetch the website”.

Compiler-injected (because defaults include `typography.roles`):

- `typography` — standardized typography controls (this is the only place for text styling; compiler strips any author-defined typography panel)

## 5.2) Themes (global, editor-only)

- Theme is a **global** dropdown in Appearance (`appearance.theme`).
- Selection previews in-editor; only **Apply theme** commits changes to state.
- Themes apply only: `stage.background`, `pod.background`, `appearance.itemBackground`, and `typography.globalFamily`.
- Canonical non-runtime fields:
  - `appearance.theme` remains part of the canonical authored FAQ document when
    explicitly supported by the editor.
  - Website URL is account/workspace context, not FAQ widget default or instance
    config.
  - FAQ runtime must not depend on either field.

## 6) Runtime requirements

Widget runtime (`tokyo/product/widgets/faq/widget.client.js`) must:

- Render from state deterministically (no default merges; missing required state is an editor bug)
- Sanitize any inline HTML allowed in questions/answers
- Convert URLs in answers to links only (no media embedding)
- Use Dieter tokens + Dieter icon system for visuals

Saved/open boundary requirements:

- Tokyo-worker must reject invalid FAQ config before it is written, and Roma must surface the named write-boundary error without healing the document.
- Bob must open the document it was given and must not heal missing FAQ state on load.

## 7) Gold standard checklist (AI)

When changing FAQ state/controls/runtime, keep the system coherent:

1. `tokyo/product/widgets/faq/spec.json`: update defaults + panel controls (do not duplicate Typography controls into Appearance).
   - If any customer-visible text path is added or moved, update `tokyo/product/widgets/faq/editable-fields.json`.
2. `tokyo/product/widgets/faq/widget.client.js`: update `assertFaqState(...)` + `applyState(...)` so every control has a deterministic effect.
3. Do not create `tokyo/product/widgets/faq/agent.md`; it is deleted widget source and not schema authority.
4. `tokyo/product/widgets/faq/limits.json`: update policy-key mappings if you add gated controls/metrics.
5. Do not add widget `seo-geo.ts` or `catalog.capabilities.seoGeo`; SEO/GEO output belongs to a later named static publish/SEO operation.
6. Verify with repo typecheck/build and the relevant Cloudflare verification; do not use a localhost Bob HTTP compile gate.
