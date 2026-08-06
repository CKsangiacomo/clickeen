# Big Bang Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Big Bang renders a high-impact statement block with supporting copy inside the
shared widget Shell.

## Source

```text
tokyo/product/widgets/big-bang/
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
| `widgetname` | `big-bang` |
| display name | Big Bang |
| Core namespace | `bigBang.*` |
| `itemKey` | `bigBang.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
bigBang
typography
uiLabels
```

Core state families:

```text
bigBang.alignment
bigBang.gap
bigBang.showSupportingCopy
bigBang.statement
bigBang.supportingCopy
bigBang.textWidth
```

Operator controls:

```text
bigBang.showSupportingCopy
bigBang.alignment
bigBang.textWidth
bigBang.gap
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
bigBang.statement
bigBang.supportingCopy
```

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
embed.seoGeo.enabled -> behavior.seoGeoAeoEnabled
```

## Shell Utilities

Big Bang uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher.

Generated `index.html` contains the complete Big Bang markup and customer
content. Its stable Core hooks are:

```text
[data-role="big-bang"]
[data-role="big-bang-core"]
[data-role="big-bang-statement"]
[data-role="big-bang-support"]
```

`runtime.js` has no Widget-local interaction. Web Code Generator renders the
structured values into `index.html`; shared runtime behavior binds only to
generated shared controls.

The structured editor contract exposes:

```text
bigBang.alignment -> left|center
bigBang.textWidth -> 480..1280
bigBang.gap -> 8..80
```

Do not add a local Header, typography, branding, share, or locale switcher
path.

## Verification

```bash
pnpm validate:widgets
```
