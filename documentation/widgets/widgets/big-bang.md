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
big-bang_tooldrawer_l10n_labels/
  en.json
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

`header.title`, `header.subtitleHtml`, `bigBang.statement`, and
`bigBang.supportingCopy` are rich-text Dropdown Edit fields. Their saved inline
HTML supports emphasis, `br`, and `http(s)` links.

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Shared Widget Utilities

Big Bang uses the presentation frame for Stage/Pod, the Shell for Header/Core
composition, and shared utilities for Core sizing, typography, branding,
social share, and locale switching.

Runtime requires these Core DOM hooks:

```text
[data-role="big-bang"]
[data-role="big-bang-core"]
[data-role="big-bang-statement"]
[data-role="big-bang-support"]
```

`widget.client.js` registers as `big-bang`, validates `bigBang.*`, requires a
non-empty `bigBang.statement`, applies shared widget utilities, and binds
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

## Verification

```bash
pnpm validate:widgets
```
