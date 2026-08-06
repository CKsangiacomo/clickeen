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
items.group.small.max -> faq.sections[]
items.group.medium.max -> faq.sections[].faqs[]
items.group.large.max -> faq.sections[].faqs[]
```

## Shell Utilities

FAQ uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, and locale switcher. Current runtime applies branding only when
`CKBranding.applyBacklink` is present; it does not fail when branding is
missing. `widget.html` loads the shared social-share asset and `limits.json`
contains the social-share entitlement path, but current FAQ runtime does not
call `CKSocialShare.apply`.

Runtime requires these Core DOM hooks:

```text
[data-role="faq"]
[data-role="faq-core"]
[data-role="faq-empty"]
[data-role="faq-list"]
```

`widget.client.js` registers as `faq`, validates `faq.*`, renders section and
question DOM into `faq-list`, applies shared Shell utilities, and binds
`ck:state-update` for the current instance id.

Runtime invariants:

- `faq.sections[]` ids must be stable and unique.
- `faq.sections[].faqs[]` ids must be stable and unique inside each section.
- Runtime validates 1-20 sections and 1-100 FAQs per section.
- Question and answer fields are customer-visible text and must stay in
  `editable-fields.json`.
- Answer HTML is sanitized to inline tags and `http(s)` links. Question display
  strips unsafe link behavior.
- The runtime handles `ck:copy-overrides` for exact FAQ copy paths and replies
  with `ck:copy-overrides-applied`; do not turn that into a generic mutation
  channel.

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
instance. Public page package serving depends on Roma writing real page
packages.

## Verification

```bash
pnpm validate:widgets
```
