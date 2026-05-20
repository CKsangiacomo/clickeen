# Widget Architecture

STATUS: REFERENCE (AI-executable)

PRD 103_00 NOTE: this doc now uses the product-operation vocabulary required before PRD 103 resumes. Final resume still requires the manual product smoke and Product + Architecture signoff recorded in `Execution_Pipeline_Docs/02-Executing/103_00__EXEC__Pre_103_Architecture_Gate.md`.

Purpose: system-level reference for widget runtime and data flow.
Related:
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetComplianceSteps.md`

---

## System invariants
- Widget software files in `tokyo/product/widgets/{widgetType}/` are the product software source of truth.
- Account-owned widget instance runtime data lives under `accounts/{accountPublicId}/instances/{instanceId}/`; accounts have instances and assets, not widget folders.
- `spec.json` owns the widget primitive variable graph. ToolDrawer, Copilot, Babel, Tokyo validation, Bob preview, and Venice runtime must use that same graph.
- Orchestrators avoid widget-specific logic; they may route calls and apply shared translated-value resolution only at the named boundary.
- Base config/content and translated-value contract violations must fail visibly. Runtime must not substitute another locale value map, repair values, or infer product meaning from private storage bodies.

---

## Widget definition (Tokyo)
Location: `tokyo/product/widgets/{widgetType}/`

Files:
- `spec.json` (defaults + structured Builder editor contract)
- `widget.html` (DOM skeleton + script tags)
- `widget.css` (styles using tokens + CSS vars)
- `widget.client.js` (applyState runtime)
- `editable-fields.json` (editable/translatable text contract when needed)
- `limits.json` (widget path/op mapping to ck-policy entitlement keys)
- `pages/*.json` (Prague pages)

`editable-fields.json` declares editable/translatable text primitives. Repeatable paths use `[]` only as a widget-owned declaration form; producers receive extracted concrete paths such as `sections.0.faqs.0.question`. `spec.json.overlays.text[]` is deleted authored translation-field authority.

---

## Core terms
- Type: changes content model or behavior.
- Layout: changes arrangement/placement only.
- Array: list in state (`path[]`).
- Item: element in an array (`path[i]`).
- Item noun: `spec.json` declares `itemKey` (i18n key for user-facing item label).

Rule: Type and Layout are the only top-level variant axes.

---

## Builder editor contract model
- `spec.json.editor.panels[]` is the only widget-owned Builder control contract.
- Panels contain explicit clusters and field/shared nodes; Bob no longer reads widget-authored `<bob-panel>`, `<tooldrawer-cluster>`, `<tooldrawer-field>`, or `@slot:` strings from `spec.json`.
- **Only clusters + groups define vertical spacing.** ToolDrawer container gaps set the rhythm; controls do not add external margins.
- **Eyebrow labels only.** Cluster/group labels are the only elements that add a bottom margin.
- **Clusters**: explicit `editor.panels[].clusters[]` objects. Cluster labels must be declared in `spec.json.editor`; Bob does not infer labels from paths like `stage.*` or `pod.*`.
- **Groups**: field nodes may declare `groupId` and optional `attrs["group-label"]`; Bob merges adjacent grouped fields into a `.tdmenucontent__group`.
- **Shared controls**: widget contracts opt into shared controls with explicit shared nodes such as `header-content`, `stagepod-layout`, and `typography`. Bob renders only the shared nodes the widget declares.
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
tokyo/product/themes/themes.json -> Bob compiles theme dropdown/presets from local checked-in theme truth
-> selection previews (no state change)
-> Apply theme writes ops to instance state
-> runtime reads final state only
```

Embed flow (PRD 100 static):
```
Browser -> clk.live/{accountPublicId}/{instanceId}
-> static serving reads generated browser files from the account instance folder
-> widget client behavior runs from the generated support files only
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

## Media And Asset Origin
Widgets must use canonical root-relative paths:
- `/assets/account/{accountPublicId}/*` for account-owned assets backed by `accounts/{accountPublicId}/assets/`
- `/dieter/*` for design-system media
- `/widgets/*` for widget package media

Runtime must not depend on `window.CK_ASSET_ORIGIN`; Venice owns proxying these paths on the public embed origin.

---

## System responsibilities

| System | Does | Does NOT |
| --- | --- | --- |
| Tokyo | Store widget software under `product/widgets/` and account runtime objects under `accounts/{accountPublicId}/instances/` | Treat account instances as widget software or use `widgetCode` as a storage locator |
| Bob | Compile spec, render ToolDrawer, hold working state | Apply widget-specific defaults at runtime |
| Roma | Open/save account editor state through same-origin routes backed by Tokyo | Transform widget state |
| `clk.live` public serving | Serve generated public visitor artifacts for published account instances | Modify widget state, expose authoring config/content, expose translated-locale storage objects, or fetch product databases at request time |
| Michael | Persist account/registry metadata and relational state | Per-widget validation or public embed assembly |
