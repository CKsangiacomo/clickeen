# Call To Action Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Call to Action renders a focused action block with eyebrow, headline,
supporting text, and an optional body action.

## Source

```text
tokyo/product/widgets/calltoaction/
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
| `widgetname` | `calltoaction` |
| display name | Call to Action |
| Core namespace | `calltoaction.*` |
| `itemKey` | `calltoaction.item` |
| panels | `content`, `typography`, `layout`, `appearance`, `settings` |

Core defaults live under:

```text
calltoaction
typography
uiLabels
```

Core state families:

```text
calltoaction.action
calltoaction.actionStyle
calltoaction.eyebrow
calltoaction.headline
calltoaction.layout
calltoaction.showEyebrow
calltoaction.showSupportingText
calltoaction.supportingTextHtml
```

Operator controls:

```text
calltoaction.showEyebrow
calltoaction.showSupportingText
calltoaction.layout.alignment
calltoaction.layout.textWidth
calltoaction.layout.gap
calltoaction.action.enabled
calltoaction.action.href
calltoaction.action.openMode
calltoaction.action.iconName
calltoaction.action.iconPlacement
calltoaction.actionStyle
```

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
calltoaction.eyebrow
calltoaction.headline
calltoaction.supportingTextHtml
calltoaction.action.label
```

## Limits

```text
branding.remove -> behavior.showBacklink
widget.socialShare.enabled -> behavior.socialShare.enabled
```

## Shell Utilities

Call to Action uses the shared Shell for Header, Header CTA, Stage/Pod, Core
size, typography, social share, and locale switcher. Current runtime applies
branding only when `CKBranding.applyBacklink` is present; it does not fail when
branding is missing.

Runtime requires these Core DOM hooks:

```text
[data-role="calltoaction"]
[data-role="calltoaction-content"]
[data-role="calltoaction-eyebrow"]
[data-role="calltoaction-headline"]
[data-role="calltoaction-supporting-text"]
[data-role="calltoaction-action"]
[data-role="calltoaction-action-label"]
[data-role="calltoaction-action-icon"]
```

`widget.client.js` registers as `calltoaction`, validates `calltoaction.*`,
normalizes action URLs, applies shared Shell utilities, and binds
`ck:state-update` for the current instance id.

Allowed action URL forms are empty, `#`, root-relative, `http(s)`, `mailto`,
and `tel`. Do not add URL fallback behavior that silently rewrites an invalid
action.

Runtime constraints:

```text
calltoaction.action.openMode -> same-tab|new-tab|new-window
calltoaction.layout.alignment -> left|center|right
calltoaction.action.iconPlacement -> left|right
```

Action style state owns background, text color, border, radius, padding, and
icon size. Header CTA style remains Shell-owned under `appearance.headerCta.*`.

## Clickeen Pages Usage

Call to Action appears in Clickeen Page source as a saved account widget
instance placement. The body action belongs to `calltoaction.*`; the shared
Header CTA remains Shell-owned. Public page package serving depends on Roma
writing real page packages.

## Verification

```bash
pnpm validate:widgets
```
