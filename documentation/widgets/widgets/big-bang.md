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
widget.html
widget.css
widget.client.js
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
```

## Shell Utilities

Big Bang uses the shared Shell for Header, Header CTA, Stage/Pod, Core size,
typography, branding, social share, and locale switcher.

Runtime requires these Core DOM hooks:

```text
[data-role="big-bang"]
[data-role="big-bang-core"]
[data-role="big-bang-statement"]
[data-role="big-bang-support"]
```

`widget.client.js` registers as `big-bang`, validates `bigBang.*`, requires a
non-empty `bigBang.statement`, applies shared Shell utilities, and binds
`ck:state-update` for the current instance id.

Runtime constraints:

```text
bigBang.statement -> non-empty
bigBang.alignment -> left|center
bigBang.textWidth -> 480..1280
bigBang.gap -> 8..80
```

Do not add a local Header, typography, branding, share, or locale switcher
path. Missing shared helpers or missing required DOM hooks must remain explicit
runtime errors.

## Clickeen Pages Usage

Big Bang appears in Clickeen Page source as a saved account widget instance
placement. The page stores a placement reference to the instance; the widget
software remains under `tokyo/product/widgets/big-bang/`. Public page package
serving depends on Roma writing real page packages.

## Verification

```bash
pnpm validate:widgets
```
