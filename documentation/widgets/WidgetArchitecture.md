# Widget Architecture

STATUS: REFERENCE (AI-executable)

Purpose: system-level reference for widget runtime and data flow.
Related:
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetComplianceSteps.md`

---

## System invariants
- Widget files in Tokyo are the source of truth.
- Orchestrators avoid widget-specific logic; they may apply generic, contract-driven transforms (e.g. overlay composition, snapshot patching).
- Base-config contract violations must fail visibly (no silent fallback). Localization overlays are consumer-visible only when current for the active base fingerprint; runtime must not substitute base, stale, or other-locale output and must not lie about locale.

---

## Widget definition (Tokyo)
Location: `tokyo/product/widgets/{widgetType}/`

Files:
- `spec.json` (defaults + ToolDrawer markup)
- `widget.html` (DOM skeleton + script tags)
- `widget.css` (styles using tokens + CSS vars)
- `widget.client.js` (applyState runtime)
- `agent.md` (AI editing contract)
- `limits.json` (entitlements caps/flags)
- `localization.json` (locale allowlist)
- `layers/*.allowlist.json` (non-locale layers)
- `pages/*.json` (Prague pages)

---

## Core terms
- Type: changes content model or behavior.
- Layout: changes arrangement/placement only.
- Array: list in state (`path[]`).
- Item: element in an array (`path[i]`).
- Item noun: `spec.json` declares `itemKey` (i18n key for user-facing item label).

Rule: Type and Layout are the only top-level variant axes.

---

## ToolDrawer layout model (vertical rhythm)
- **Only clusters + groups define vertical spacing.** ToolDrawer container gaps set the rhythm; controls do not add external margins.
- **Eyebrow labels only.** Cluster/group labels are the only elements that add a bottom margin.
- **Clusters**: `<tooldrawer-cluster>` expands into `.tdmenucontent__cluster` + `.tdmenucontent__cluster-body` and can wrap any markup/controls.
- **Groups**: created from `<tooldrawer-field-{groupKey}>` or `group-label`; ToolDrawer merges **adjacent** grouped fields into a `.tdmenucontent__group`. Groups appear inside a cluster only if those fields are inside the cluster.
- **Components**: Dieter controls must not add external vertical spacing; they only manage internal layout.

---

## Global breakpoint
- Single breakpoint: `900px` (desktop vs mobile).
- Stage/Pod and widget CSS must switch at the same breakpoint.

---

## Data flow

Editor flow (Bob):
```
Tokyo spec.json -> Bob compiles controls -> Bob loads instance (Roma same-origin route backed by Tokyo)
-> Bob holds working state -> Bob postMessage -> widget.client.js applyState
```

Theme flow (global, editor-only; always enabled):
```
tokyo/themes/themes.json -> Bob injects theme dropdown
-> selection previews (no state change)
-> Apply theme writes ops to instance state
-> runtime reads final state only
```

Embed flow (Venice):
```
Browser -> Venice /e/{publicId}?locale=... -> Venice loads live pointer + config pack + text pack + widget files (Tokyo)
-> Venice injects window.CK_WIDGET (state + locale) -> widget.client.js applyState
```

postMessage payload (Bob -> preview):
```js
{
  type: 'ck:state-update',
  widgetname: 'faq',
  state: { /* full instance JSON */ },
  locale: 'ja',
  device: 'desktop',
  theme: 'light'
}
```

---

## Runtime modules (shared)
Location: `tokyo/product/widgets/shared/`

| Module | Export | Purpose |
| --- | --- | --- |
| `typography.js` | `window.CKTypography.applyTypography(typo, el, roleMap, runtimeContext?)` | Apply typography roles with locale/script-aware fallback stacks that respect the selected family class (`sans` vs `serif`); CJK locales use script-first stacks and tuned default line-height values for readability |
| `stagePod.js` | `window.CKStagePod.applyStagePod(stage, pod, el)` | Apply Stage/Pod layout |
| `fill.js` | `window.CKFill.*` | Fill normalization + color/gradient/image/video helpers |
| `header.js` | `window.CKHeader.applyHeader(state, widgetRoot)` | Shared header block (title/subtitle/CTA) |
| `header.css` | *(stylesheet)* | Shared header layout styles |
| `surface.js` | `window.CKSurface.applyCardWrapper(cardwrapper, scopeEl)` | Shared card wrapper vars (border/shadow/radius) |
| `branding.js` | *(self-managed)* | Injects/toggles backlink via `state.behavior.showBacklink` |

---

## Asset origin
Widgets must use canonical root-relative asset paths:
- `/assets/v/*` for account-owned immutable assets
- `/dieter/*` for design-system assets
- `/widgets/*` for widget package assets

Runtime must not depend on `window.CK_ASSET_ORIGIN`; Venice owns proxying these paths on the public embed origin.

---

## System responsibilities

| System | Does | Does NOT |
| --- | --- | --- |
| Tokyo | Store widget definitions | Store instance data |
| Bob | Compile spec, render ToolDrawer, hold working state | Apply widget-specific defaults at runtime |
| Roma | Open/save account editor state through same-origin routes backed by Tokyo | Transform widget state |
| Venice | Serve published pointer/config/text/widget bytes for public embeds | Modify widget state or fetch product databases at request time |
| Michael | Persist account/registry metadata and relational state | Per-widget validation or public embed assembly |
