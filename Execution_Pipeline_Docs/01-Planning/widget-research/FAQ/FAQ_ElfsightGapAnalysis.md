# FAQ — Elfsight Gap Analysis (Post-Build)

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research. Defines no scope and authorizes no build.

Relationship to existing docs in this folder:

- `FAQ_PRD.md` — the canonical Clickeen FAQ product definition. Unchanged by this file.
- `FAQ_competitoranalysis.md` — the earlier pre-build analysis, written from saved
  screenshots. It is generic by design ("competitors typically…"). This document
  supersedes nothing; it adds a control-by-control record of what Elfsight ships
  **today**, measured against what Clickeen **actually built**.

## Method

Elfsight side: a live authenticated Elfsight account driven in-browser on
2026-07-31. Every panel, every disclosure, every dropdown in the FAQ editor was
opened and read. Editor URL pattern `dash.elfsight.com/widget/{uuid}`.

Clickeen side: full source read of `tokyo/product/widgets/faq/` plus the widget
foundation (`packages/widget-foundation/src/`) and the Builder compiler
(`bob/lib/compiler/`). Control counts are the **composed** counts the Builder
actually renders, not the `spec.json` declaration count.

Not covered: Elfsight's public runtime output. Their CDN and marketing domains
were unreachable from the inspection surface, so claims about their rendered
HTML are marked as inference where they appear.

## Headline

The two products are inverted along a single axis.

| | Elfsight FAQ | Clickeen FAQ |
| --- | --- | --- |
| Total editor controls | **~15** | **233** |
| Typography controls | **0** | **71** (7 roles × 10 + 1 hidden) |
| Escape hatches | Custom CSS + Custom JS | none |
| Content features | search, media embeds, category icons, rich lists | none of these |

Clickeen has roughly 15× the design surface and Elfsight has the content
features. Every gap in this document is a *content or behavior* gap, not a
styling gap — and every Elfsight advantage listed is one they built because they
had no design system to solve it properly.

## Part 1 — Elfsight's complete FAQ surface

Exhaustive. This is the entire product.

**Editor shape:** icon rail (Content / Layout / Appearance / Settings) + panel +
live preview. Top bar carries editable title, Publish, Close. A device toggle
sits over the preview. Structurally identical to Bob.

### Content panel

Hierarchical drill-in: Content → Category → Question.

| Level | Control | Type | Notes |
| --- | --- | --- | --- |
| Root | Display Category Titles | toggle | — |
| Root | QUESTION CATEGORIES | list | each row has an overflow menu |
| Root | + Add Category | action | — |
| Root | Widget Title | text | — |
| Category | Title | text | — |
| Category | **Icon** | dropdown | observed value "Attention" — categories carry an icon |
| Category | QUESTIONS | list | each row has an overflow menu |
| Category | + Add Question | action | — |
| Question | Question | text | plain |
| Question | **Answer** | **rich text** | full toolbar, see below |

**Answer rich-text toolbar (complete):** Bold, Italic, Link, Bulleted list,
Numbered list, overflow → Underline / Strikethrough / Clear Formatting, plus a
`<>` HTML source view and a fullscreen expand.

Helper text under the answer field, verbatim: *"You can add YouTube, Vimeo and
images URLs to be displayed as media content."*

### Layout panel — controls are conditional on layout

| Layout | Controls exposed |
| --- | --- |
| **Accordion** | Accordion Icon (Plus / Arrow), Open First Question by Default, Multiple Active Questions, Show Search Bar |
| **List** | Show Search Bar only |
| **Multicolumn** | Show Search Bar only |

Layout itself is three visual preset tiles. Notably there is **no column-count
control** for Multicolumn.

### Appearance panel

| Control | Type | Values |
| --- | --- | --- |
| Template | dropdown | **Clear**, Background, Background & Shadow, Background & Border |
| Item Background Color | color | hidden when Template = Clear |
| Question Text Color | color | — |
| Answer Text Color | color | — |
| Custom CSS | code editor | line-numbered, with expand |

The color set is template-dependent: `Clear` drops Item Background Color,
leaving two colors. Maximum three colors in the entire product.

**Color picker:** a fixed ~8×8 preset swatch grid, an eyedropper for custom
values, and a transparent option. Solid only — no gradient, no image, no opacity
slider.

**Inside the Custom CSS panel**, two promotional cards ship as part of the UI:

- *"Missing the settings you need? Request widget features, and we'll consider
  them in future updates!"* → **Request a Feature**
- *"Looking for ready-to-use CSS? Find the CSS you need on our forum, where users
  share their solutions."* → **Explore the Forum**

That second card is the clearest statement of their design philosophy available
anywhere: when the controls run out, the answer is a community forum of
copy-paste CSS.

### Settings panel

| Control | Type | Helper text |
| --- | --- | --- |
| Display Videos | toggle | "Transform YouTube and Vimeo links to Videos." |
| Display Images | toggle | "Transform image links to images." |
| Custom JS | code editor | with a **Validate** button |

Custom JS helper text, verbatim: *"Important: Custom JS operates only upon widget
installation, not in preview mode."* and *"…to learn about our widget's API
events and methods, feel free to contact our support"* — so a widget API exists
but is not publicly documented.

## Part 2 — Clickeen's complete FAQ surface

233 composed controls across five panels. 36 declared in `spec.json`, 184 from
shared shell clusters, 13 auto-injected.

| Panel | Controls | Contents |
| --- | --- | --- |
| content | 15 | header cluster (11), section manager + question repeater + per-item `defaultOpen` (3), show section title (1) |
| typography | 71 | 7 roles × 10 properties + 1 hidden global family |
| layout | 44 | header layout (6), core size (5), widget layout (8), item layout (8), stage/pod layout (30 — counted once) |
| appearance | 60 | accordion icon + colour (2), header CTA (11), links (4), Q&A card (9), locale switcher (6), Q&A inside-shadow (7), stage/pod appearance (25) |
| settings | 26 | deep links (1), locale switcher (3), branding (1), social share (21) |

**Typography roles:** `title`, `body` (Subtitle), `section` (Section title),
`question`, `answer`, `button`, `localeSwitcher` — each with family (18 curated
Google fonts + account custom fonts), size preset + custom, font style, weight
(9), colour, line-height preset + custom, tracking preset + custom.

**Layouts:** `accordion` (real `<button>` + `aria-expanded`/`aria-controls`),
`list` (answers always visible), `multicolumn` (Cards) with `grid` or `masonry`
sub-layout, desktop columns 1–4, mobile columns 1–2.

**Accordion behavior:** `expandFirst`, `multiOpen`, `expandAll`, per-item
`defaultOpen`, with documented precedence (`expandAll` → any `defaultOpen` →
`expandFirst`).

**Accordion icons:** plus, chevron, arrow, arrowshape — each an expand/collapse
pair from the Dieter icon set, applied as CSS masks with a tint control.

**Fill system:** stage and pod backgrounds accept color / gradient (linear,
radial, conic) / image (fit, position, repeat) / video (poster, loop, muted,
autoplay, `playsinline`). Q&A card background accepts color + gradient.

**Borders and shadows:** border `{enabled,width,color}` on Q&A card, header CTA,
pod, locale switcher. Outside shadows on Q&A card / stage / pod. Three
inside-shadow groups of 7 controls each (linked, layer above/below content, and
all/top/right/bottom/left slots).

**Corner radius:** per-corner when unlinked, on Q&A card and pod, on a token
scale.

**Link styling:** three mutually exclusive styles — underline (with colour),
highlight (pill background), or colour — each with its own colour control.

**Deep links:** `faq.geo.enableDeepLinks`, default on. Every question gets
`id="faq-q-{instanceId}-{itemId}"`; the runtime reads `location.hash` on load and
expands the match, and writes the hash on open.

**Sanitizer:** allowlist `STRONG, B, EM, I, U, S, BR` plus `A` only in answers.
Questions cannot contain links. Anchors keep only `http(s)` hrefs and force
`rel="noopener noreferrer"` on `target="_blank"`.

**Entitlement limits** (free / tier1 / tier2): sections 3 / 10 / 25; questions
per section 9 / 25 / 50; questions total 16 / 50 / 100. Plus hard runtime caps
of 20 sections and 100 questions per section regardless of tier.

## Part 3 — What Elfsight has that Clickeen does not

Ranked by product impact. All seven are content or behavior, not styling.

### 1. Search bar

Elfsight: a `Show Search Bar` toggle available in **all three** layouts.

Clickeen: no search input, no search control, no filtering logic. `widget.css`
defines `.ck-faq__noresults` — dead CSS with nothing that can trigger it.

For any FAQ with more than ~15 questions this is the primary navigation
mechanism. The dead class suggests it was scoped and dropped.

### 2. Media inside answers

Elfsight: pasting a YouTube, Vimeo, or image URL into an answer renders it as
embedded media, governed by two Settings toggles.

Clickeen: `widget.css` styles `.ck-faq__a-img` and `.ck-faq__a-video` — including
a 56.25% aspect-ratio iframe wrapper — but the sanitizer's allowlist has no `IMG`
and no `IFRAME`, so both are unwrapped and discarded. The CSS is unreachable.

Same pattern as search: built the styling, never wired the capability.

### 3. Rich-text lists in answers

Elfsight: bulleted and numbered lists in the answer toolbar.

Clickeen: `UL`, `OL`, `LI` are stripped by the sanitizer. An answer explaining a
multi-step process cannot be formatted as steps.

### 4. Category icons

Elfsight: each category carries an Icon field.

Clickeen: sections have `id` and `title` only.

### 5. Structured data

Elfsight: a `Schema.org` settings section exists in their reviews app (verified
in the Google Reviews editor), and their own marketing pages ship `FAQPage`
markup (verified in the saved competitor assets already in this folder).

Clickeen: a repo-wide grep for `FAQPage`, `application/ld+json`, `schema.org`,
`itemprop`, and `acceptedAnswer` returns **zero hits in product code**.

This is the single largest strategic gap in the FAQ widget. Rich results are the
main SEO reason a business buys an FAQ widget at all. And it interacts with the
serving-model advantage recorded in
`planning_Research__Elfsight_Competitive_Breakdown.md` §5.4: Clickeen serves
crawlable HTML while Elfsight serves an empty div. Clickeen is one JSON-LD block
away from being the only FAQ widget whose structured data is visible to
non-JS crawlers — and currently emits none.

### 6. Expand/collapse animation

Elfsight: an Animation control exists in their Countdown app; the FAQ accordion
animates.

Clickeen: grep for `transition`, `animation`, and `@keyframes` in
`faq/widget.css` returns nothing. The accordion is an instant `display` flip.

### 7. HTML source view in the editor

Elfsight: a `<>` toggle exposing raw HTML for an answer.

Clickeen: rich-text popover only. Consistent with the no-customer-code position,
so this is a deliberate difference rather than a gap.

## Part 4 — What Clickeen has that Elfsight does not

- **Typography.** 71 controls versus zero. Elfsight FAQ offers no font, size,
  weight, line-height, or tracking control at any tier.
- **Fill system.** Gradient, image, and video backgrounds versus a 64-swatch
  solid-colour palette.
- **Borders, shadows, inside shadows, per-corner radius.** None of this exists in
  their FAQ.
- **Three link styles** with independent colour controls.
- **Column control** for card layouts — desktop 1–4, mobile 1–2, plus a masonry
  option. Their Multicolumn has no column control at all.
- **Per-question deep links** with hash restore.
- **Locale overlays and an in-widget locale switcher.** Elfsight FAQ has no
  locale dimension; their language setting (seen in Google Reviews) localizes
  chrome, not authored content.
- **Entitlement-gated content limits** enforced at both editor-op and save time.
- **A real accordion button** with `aria-expanded`/`aria-controls`.
- **No customer CSS or JS**, which is why the above is possible.

## Part 5 — Defects found in the Clickeen FAQ during this review

Reported as findings; fixing them is not this document's call.

1. **`openMode` will throw at runtime.** The editor offers `same-tab`,
   `new-tab`, and `new-window`; `widget.client.js` validates against
   `['same-tab','new-tab']` only. Selecting "New window" in the Builder should
   make the runtime throw.
2. **Social share renders 21 controls that do nothing.** `widget.html` loads
   `socialShare.js` and `socialShare.css`, `limits.json` gates the entitlement,
   the settings panel renders all 21 controls — and `faq/widget.client.js` never
   calls `CKSocialShare.apply`. Toggling channels consumes an entitlement gate
   and produces no output. Already recorded in
   `documentation/widgets/widgets/faq.md`.
3. **Three blocks of dead CSS**: `.ck-faq__noresults` (no search),
   `.ck-faq__a-img` / `.ck-faq__a-video` (sanitizer strips the tags).
4. **Masonry reading order.** CSS `columns` produces column-first order, so a
   visitor reading left-to-right sees a non-sequential question order.
   Acknowledged in a source comment.
5. **Deep-link hash writes are unconditional** when enabled (the default), so
   opening a question rewrites the host page's `location.hash` with no
   `replaceState` alternative.

## Part 6 — Observations for the team

Not decisions.

**The gaps cluster.** Search, media-in-answers, and lists are all *content
capability*. Clickeen's 233 controls are almost entirely *presentation*. A user
with 40 questions and a video walkthrough is better served by Elfsight's 15
controls than by Clickeen's 233 — which is worth sitting with.

**Two of the three biggest gaps are half-built.** Search has its empty-state CSS;
media has its image and video CSS with an aspect-ratio wrapper. Someone scoped
both and stopped before the runtime. The remaining work is smaller than a
from-scratch feature.

**Structured data is the asymmetric one.** It is a contained addition to the
materializer output, it is the reason FAQ widgets get bought, and it is worth
disproportionately more to Clickeen than to Elfsight because Clickeen's output is
actually crawlable. Their JSON-LD, if any, is injected client-side into a
lazy-loaded div.

**Their forum card is the competitive summary.** "Find the CSS you need on our
forum, where users share their solutions" is what a product says when it has no
design system. Clickeen's 71 typography controls are the answer to that — but
only for a user whose problem is styling, not one whose problem is finding an
answer among 40 questions.
