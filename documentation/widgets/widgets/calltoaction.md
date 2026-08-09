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
calltoaction_tooldrawer_l10n_labels/
  en.json
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

## Shared Widget Utilities

Call to Action uses the presentation frame for Stage/Pod, the Shell for
Header/Core composition, and shared utilities for Core sizing, typography,
social share, and locale switching. Branding and social share are required
shared runtime contracts; a missing `CKBranding.applyBacklink` or
`CKSocialShare.apply` fails closed.

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
normalizes action URLs, applies shared widget utilities, and binds
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
icon size. Header CTA style remains Header-owned under
`appearance.headerCta.*`.

## Verification

```bash
pnpm validate:widgets
```
