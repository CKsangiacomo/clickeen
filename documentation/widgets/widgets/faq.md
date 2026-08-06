# FAQ Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

FAQ renders grouped questions and answers inside the shared widget Shell. Web
Code Generator renders every layout; runtime binds accordion and deep-link
behavior to the generated markup.

## Source

```text
tokyo/product/widgets/faq/
```

Files:

```text
spec.json
editable-fields.json
limits.json
index.html
styles.css
runtime.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `faq` |
| display name | FAQ |
| Core namespace | `faq.*` |
| `itemKey` | `faq.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

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

`faq.sections[]` and `faq.sections[].faqs[]` entries carry stable `id` values
in widget Core state.

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
items.group.small.max -> faq.sections[]
items.group.medium.max -> faq.sections[].faqs[]
items.group.large.max -> faq.sections[].faqs[]
```

## Shell Utilities

FAQ uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher.

Generated `index.html` contains the complete section, question, and answer DOM.
Its stable Core hooks include:

```text
[data-role="faq"]
[data-role="faq-core"]
[data-role="faq-empty"]
[data-role="faq-list"]
```

`runtime.js` registers as `faq` through `CKWidgetRuntime` and binds accordion
and deep-link behavior to the generated questions. It does not accept generic
state or copy-override messages and does not render FAQ content.

Question and answer fields are customer-visible text and stay in
`editable-fields.json`. Web Code Generator sanitizes answer rich text before it
writes the complete FAQ DOM. Runtime rejects an unknown layout or malformed
generated boolean behavior settings.

Accordion behavior applies only when `faq.layout.type` is `accordion`.
Accordion-specific state includes:

```text
faq.behavior.defaultOpen
faq.behavior.expandFirst
faq.behavior.multiOpen
faq.behavior.expandAll
faq.behavior.deepLink
```

Limit metrics:

```text
items.group.small.max -> faq.sections[] count
items.group.medium.max -> faq.sections[].faqs[] per-section count
items.group.large.max -> faq.sections[].faqs[] total count
```

## Clickeen Pages Usage

FAQ appears in Clickeen Page source as a saved account widget instance
placement. FAQ sections and questions remain widget Core state inside the
instance.

## Verification

```bash
pnpm validate:widgets
```
