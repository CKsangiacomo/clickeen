# FAQ Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

FAQ renders grouped questions and answers inside the shared widget Shell. Runtime
supports list, accordion, and multicolumn/card layouts.

## Source

```text
tokyo/product/widgets/faq/
```

Files:

```text
spec.json
editable-fields.json
limits.json
faq_tooldrawer_l10n_labels/
  en.json
widget.html
widget.css
widget.client.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `faq` |
| display name | FAQ |
| Core namespace | `faq.*` |
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

Core defaults live under:

```text
faq
typography
uiLabels
```

`spec.json` includes widget-local normalization for FAQ Core state.

Core state families:

```text
faq.appearance
faq.behavior
faq.displayCategoryTitles
faq.geo
faq.layout
faq.sections
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
faq.sections[].title
faq.sections[].faqs[].question
faq.sections[].faqs[].answer
```

`header.title`, `header.subtitleHtml`, `faq.sections[].faqs[].question`, and
`faq.sections[].faqs[].answer` are rich-text Dropdown Edit fields. Their saved
inline HTML supports emphasis, `br`, and `http(s)` links.

`faq.sections[]` and `faq.sections[].faqs[]` entries carry stable `id` values
in widget Core state.

## Editor Composition

FAQ follows the canonical ToolDrawer sequence:

1. **Content** — shared Header plus the initially open primary Content section.
   **Show section titles** sits directly above the Sections Object Manager in
   that section. Object Manager owns sections; each section contains one nested
   Repeater for its questions and answers.
2. **Layout** — shared Header/Core/Stage/Pod layout plus FAQ layout type,
   content gap, multicolumn arrangement, columns, question-and-answer spacing,
   and linked or per-side Q&A-card padding.
3. **Appearance** — shared Header appearance first, then Accordion Icon, rich
   link treatment, Q&A-card surface, and shared Stage/Pod appearance. The
   Accordion section is present only for Accordion layout.
4. **Typography** — exact Section title, Question, and Answer roles after the
   shared roles.
5. **Settings** — Accordion behavior and question deep links when Accordion is
   selected, followed by shared locale, branding, and social-share behavior.

Only shared Header and the primary FAQ Content section start open. Every other
section starts collapsed.

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
items.group.small.max -> faq.sections[]
items.group.medium.max -> faq.sections[].faqs[]
items.group.large.max -> faq.sections[].faqs[]
```

## Shared Widget Utilities

FAQ uses the presentation frame for Stage/Pod, the Shell for Header/Core
composition, and shared utilities for Core sizing, typography, and locale
switching. Branding and social share are required shared runtime contracts; a
missing `CKBranding.applyBacklink` or `CKSocialShare.apply` fails closed, and
FAQ applies both on every state render.

Runtime requires these Core DOM hooks:

```text
[data-role="faq"]
[data-role="faq-core"]
[data-role="faq-empty"]
[data-role="faq-list"]
```

`widget.client.js` registers as `faq`, validates `faq.*`, renders section and
question DOM into `faq-list`, applies shared widget utilities, and binds
`ck:state-update` for the current instance id.

Runtime invariants:

- `faq.sections[]` ids must be stable and unique.
- `faq.sections[].faqs[]` ids must be stable and unique inside each section.
- Each FAQ item contains only its stable `id`, `question`, and `answer`; startup
  expansion is global behavior rather than per-question content state.
- Runtime validates 1-20 sections and 1-100 FAQs per section.
- Question and answer fields are customer-visible rich text and must stay in
  `editable-fields.json`.
- Question and answer HTML is limited to the supported inline tags and
  `http(s)` links. In accordion layout, the question row and its dedicated
  expand control are siblings of the rich-text link target, so following a
  question link does not toggle the accordion.
- The runtime handles `ck:copy-overrides` for exact FAQ copy paths and replies
  with `ck:copy-overrides-applied`; do not turn that into a generic mutation
  channel.
- The static Header/list/empty hooks carry no invented customer copy before
  exact saved state is applied. The empty hook starts hidden; valid FAQ state
  requires at least one section and one question in every section.

Presentation invariants:

- Multicolumn grid and masonry composition responds to the existing Pod
  inline-size container at `900px`, not to the outer browser viewport. The
  exact declared desktop/mobile column values remain the layout authority on
  either side of that boundary.
- Section titles, questions, answers, and their rich links preserve complete
  localized content inside the available Q&A-card width.
- List, Accordion, multicolumn Grid, and multicolumn Masonry retain their
  existing layout values and runtime behavior.

Accordion behavior applies only when `faq.layout.type` is `accordion`.
Accordion-specific state includes:

```text
faq.behavior.expandAll
faq.behavior.expandFirst
faq.behavior.multiOpen
faq.geo.enableDeepLinks
```

Startup expansion has one global authority: `expandAll` opens every question;
otherwise `expandFirst` opens the first question; otherwise every question
starts closed. `multiOpen` governs subsequent user interaction. Deep links use
the existing exact question anchor and respect `multiOpen` when opening their
target.

Limit metrics:

```text
items.group.small.max -> faq.sections[] count
items.group.medium.max -> faq.sections[].faqs[] per-section count
items.group.large.max -> faq.sections[].faqs[] total count
```

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/bob test:editor-contract
```
