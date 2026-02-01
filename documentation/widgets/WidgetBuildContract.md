# Widget Build Contract

STATUS: CANONICAL (AI-executable)
OWNER: Platform / Widget System

SCOPE
- This contract applies to widget definitions in `tokyo/widgets/{widgetType}/`.

INPUTS
- `widgetType` (explicit)
- PRD (required)
- Entitlements matrix keys from `config/entitlements.matrix.json`

OUTPUTS
- `spec.json`
- `widget.html`
- `widget.css`
- `widget.client.js`
- `agent.md`
- `limits.json` (unless PRD opts out)
- `localization.json` (unless PRD opts out)
- `layers/*.allowlist.json` (only when non-locale layers are used)

STOP CONDITIONS
- `widgetType` not explicit
- PRD missing or conflicts with this contract
- change requires new Dieter primitive/token
- change requires `tokyo/widgets/shared/*`
- change requires Bob/Paris/Venice/Prague/Dieter edits
- cannot enumerate final state paths before ToolDrawer
- cannot provide Binding Map rows for all new controls

---

## CONTRACTS (MUST / MUST NOT)

### 1) State model
MUST
- Define arrays as `path[]` and items as `path[i]`.
- Provide a stable DOM Array Container role and DOM Item Container role for each array.
- Provide stable `data-role` for every runtime-mutated element.

MUST NOT
- Use widget root as an item.
- Update DOM elements without stable `data-role`.

### 2) Stage/Pod (required)
MUST
- `defaults.stage` includes: `background`, `alignment`, `canvas.mode`, `padding.desktop`, `padding.mobile`.
- Each padding object includes: `linked, all, top, right, bottom, left`.
- `defaults.pod` includes: `background`, `padding.desktop`, `padding.mobile`, `widthMode`, `contentWidth`, radius fields (`radiusLinked`, `radius`, `radiusTL/TR/BR/BL`).
- `widget.html` hierarchy:
  - `[data-role="stage"]` contains `[data-role="pod"]` contains `[data-role="root"][data-ck-widget="{widgetType}"]`.
- `widget.client.js` calls `window.CKStagePod.applyStagePod(state.stage, state.pod, root)` on load and every update.
- Appearance panel exposes `stage.background` and `pod.background` via dropdown-fill with explicit `fill-modes`.

MUST NOT
- Reimplement Stage/Pod layout logic in widget CSS or JS.
- Add fallback/healing logic for missing Stage/Pod fields.

### 2.1) Global appearance surface rule (required)
**Stage (canvas wrapper)**
- ✅ Background fill (all fill types)
- ❌ Border, ❌ Shadow, ❌ Radius

**Pod (container surface)**
- ✅ Background fill (all fill types)
- ✅ Border, ✅ Shadow, ✅ Radius

**Item (array item/card)**
- ✅ Background fill (**color + gradient only**)
- ✅ Border, ✅ Shadow, ✅ Radius

If a widget needs anything outside this rule, it must be explicitly required by the PRD.

### 2.2) Item card surface (optional global primitive)
If a widget exposes `appearance.itemCard.*` controls (border/shadow/radius for items), it MUST use the shared Surface primitive:
- Runtime: `tokyo/widgets/shared/surface.js` (`window.CKSurface.applyItemCard(state.appearance.itemCard, scopeEl)`)
- CSS vars set on `scopeEl`:
  - `--ck-item-card-border-width`
  - `--ck-item-card-border-color`
  - `--ck-item-card-shadow`
  - `--ck-item-card-radius`

MUST
- Load `../shared/surface.js` in `widget.html` (before `widget.client.js`).
- Apply item card vars via `CKSurface.applyItemCard(...)` on every state update.
- Reference only `--ck-item-card-*` vars in `widget.css` for item card styling.

MUST NOT
- Reimplement border/shadow/radius math per widget (use `CKSurface`).
- Put any layout logic (grid/list/accordion/masonry) inside `CKSurface`.

### 3) Typography (required if any text renders)
MUST
- Define `defaults.typography.roles` for all visible text parts.
- Call `window.CKTypography.applyTypography(state.typography, root, roleMap)`.
- Use typography CSS vars in `widget.css` (no ad-hoc fonts).

MUST NOT
- Create separate text color controls outside typography unless PRD requires it.

### 3.1) Header (optional global primitive)
If a widget needs a reusable title/subtitle/CTA “header block”, it MUST use the shared Header primitive:
- Runtime: `tokyo/widgets/shared/header.js` (`window.CKHeader.applyHeader(state, widgetRoot)`)
- Styles: `tokyo/widgets/shared/header.css` (loaded in `widget.html`)

MUST
- Declare these state paths in `defaults` (strict; no fallbacks):
  - `header.enabled` (boolean)
  - `header.title` (richtext string)
  - `header.showSubtitle` (boolean)
  - `header.subtitleHtml` (richtext string)
  - `header.alignment` (`left|center|right`)
  - `header.placement` (`top|bottom|left|right`)
  - `header.ctaPlacement` (`right|below`)
  - `cta.enabled` (boolean)
  - `cta.label` (string)
  - `cta.href` (string)
  - `cta.iconEnabled` (boolean)
  - `cta.iconName` (string; Dieter icon id without `.svg`; allowed: `checkmark`, `arrow.right`, `chevron.right`, `arrowshape.forward`, `arrowshape.turn.up.right`)
  - `cta.iconPlacement` (`left|right`)
  - `appearance.ctaBackground` (fill **or** CSS color string; color only)
  - `appearance.ctaTextColor` (fill **or** CSS color string; color only)
  - `appearance.ctaBorder` (object; Dieter `dropdown-border` schema)
  - `appearance.ctaRadius` (`none|sm|md|lg|xl|2xl`)
  - `appearance.ctaSizePreset` (`xs|s|m|l|xl|custom`; editor preset selector for CTA sizing)
  - `appearance.ctaPaddingLinked` (boolean; editor-only link/unlink for CTA padding)
  - `appearance.ctaPaddingInline` (number; px)
  - `appearance.ctaPaddingBlock` (number; px)
  - `appearance.ctaIconSizePreset` (`xs|s|m|l|xl|custom`; editor preset selector for CTA icon sizing)
  - `appearance.ctaIconSize` (number; px)
- Use this DOM structure (inside the widget root):
  - `.ck-headerLayout` contains:
    - `.ck-header` (direct child)
      - `[data-role="header-title"]`
      - `[data-role="header-subtitle"]`
      - `[data-role="header-cta"]`
    - `.ck-headerLayout__body` (direct child; holds widget-specific content)
- Localize `header.title`, `header.subtitleHtml`, and `cta.label` in `localization.json`.
- Keep all header layout variations purely via `data-*` + CSS (no DOM reparenting).
- Note on CTA sizing presets:
  - In Bob, `appearance.ctaSizePreset` and `appearance.ctaIconSizePreset` are **preset selectors** (editor convenience). Selecting a preset expands into concrete state writes (typography button size + CTA padding/icon size). If any of the target values are edited manually, Bob resets the preset selector to `custom`.

MUST NOT
- Reimplement header layout/CTA styling per widget (use the shared primitive).

### 4) Determinism
MUST
- Implement `applyState(state)` as a pure DOM update.
- Scope all selectors to the widget root.
- Apply Stage/Pod, then Typography, then widget-specific bindings.

MUST NOT
- Use timers, randomness, or network fetches in `applyState`.
- Heal or coerce missing state (fix the source instead).

### 5) ToolDrawer
MUST
- Use only these panels: `content`, `layout`, `appearance`, `typography`, `settings`.
- Add controls only for paths already defined in `defaults`.
- Gate variant-specific controls via `show-if`.
- Remove `<tooldrawer-eyebrow>`; no eyebrow under panel headers. Use optional cluster labels (`<tooldrawer-cluster label="...">`) when you need section eyebrows inside a panel.
- Use `<tooldrawer-cluster>` as the primary grouping container. Panels MUST be composed of one or more clusters (clusters can wrap any markup/controls).
- Cluster header (optional): a cluster has a header only when `label`/`labelKey` is set. Bob renders it as:
  - left: Label (overline)
  - right: XS Dieter icon button (chevron) that collapses/expands the cluster body
- Cluster spacing is owned globally by Bob (widgets MUST NOT invent spacing):
  - top-level cluster spacing: `space-4` after each cluster (except last)
  - header → body spacing: `space-2` (only when header exists)
  - inside cluster body: `space-2` vertical gap between controls/groups
- Group is optional and secondary. Declare a group key via the tag name `<tooldrawer-field-{groupKey} ...>`; adjacent fields with the same group key become one group. Use `group-label` only when you need a group header inside a cluster.
- Groups MUST NOT be used as a spacing/layout primitive; they exist only to add optional sub-section labels inside a cluster.
- Define the user-facing item noun: set `itemKey` in `spec.json` (e.g., `faq.item`) and ensure the i18n bundle defines it (plural forms required).

MUST NOT
- Duplicate entire panels per variant.
- Add custom vertical spacing via margins/spacer elements or `gap`/`space-after` attributes. Clusters own spacing and collapsibility.

### 5.1) Themes (global, editor-only)
MUST
- Define global themes in `tokyo/themes/themes.json` (single source of truth).
- Theme values may only touch: `stage.*`, `pod.*`, `appearance.*`, and `typography.*` (font family only).
- Themes are always enabled: every widget must include `appearance.theme` in `defaults` and render a dropdown-actions control for it in the Appearance panel.
- Theme selection is staged; selection previews in-editor and only "Apply theme" commits ops to instance state.
- Themes must apply Stage/Pod/Item appearance + typography font family.
- Any manual edit to `stage.*`, `pod.*`, `appearance.*`, or `typography.*` after applying a theme must reset `appearance.theme` to `custom`.

MUST NOT
- Interpret themes at runtime; runtime reads only the final state values.
- Add widget-specific theme lists in `spec.json`.

### 6) Dropdown-fill
MUST
- Declare `fill-modes` for every dropdown-fill control.
- Default matrix:
  - Stage/Pod backgrounds: `color,gradient,image,video`
  - Other surfaces: `color,gradient` unless PRD requires media

### 7) Localization and layers
MUST
- `localization.json` includes all translatable paths.
- Use `*` for array indices (`sections.*.faqs.*.question`).
- Reject prohibited segments: `__proto__`, `constructor`, `prototype`.
- `layers/*.allowlist.json` only when that layer is used.

### 8) Binding Map (anti-dead-controls)
MUST
- Every ToolDrawer control path has exactly one Binding Map row.
- Mechanism is one of:
  - CSS var
  - data-attr variant
  - deterministic DOM update

Binding Map template:
| Path | Target | Mechanism | Implementation |
| --- | --- | --- | --- |
| `layout.type` | root | data-attr | `root.setAttribute('data-layout', state.layout.type)` |
| `appearance.item.fill` | item wrapper | css-var | `root.style.setProperty('--item-fill', ...)` |
| `content.title` | `[data-role="title"]` | dom | `el.textContent = state.content.title` |

### 9) Assets
MUST NOT
- Ship defaults containing `data:` or `blob:` URLs.

---

## Minimal templates

### widget.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/dieter/tokens/tokens.css" />
    <link rel="stylesheet" href="./widget.css" />
  </head>
  <body>
    <div class="stage" data-role="stage">
      <div class="pod" data-role="pod">
        <div class="ck-widget" data-ck-widget="WIDGETTYPE" data-role="root">
          <div data-role="title"></div>

          <script src="../shared/typography.js" defer></script>
          <script src="../shared/stagePod.js" defer></script>
          <script src="../shared/branding.js" defer></script>
          <script src="./widget.client.js" defer></script>
        </div>
      </div>
    </div>
  </body>
</html>
```

### widget.client.js
```js
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript;
  if (!(scriptEl instanceof HTMLElement)) return;

  const root = scriptEl.closest('[data-role="root"]');
  if (!(root instanceof HTMLElement)) {
    throw new Error('[widget] widget.client.js must execute inside [data-role="root"]');
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;

    if (window.CKStagePod) window.CKStagePod.applyStagePod(state.stage, state.pod, root);
    if (window.CKTypography) {
      window.CKTypography.applyTypography(state.typography, root, {
        title: { varKey: 'title' },
        body: { varKey: 'body' }
      });
    }

    const title = root.querySelector('[data-role="title"]');
    if (title instanceof HTMLElement && typeof state.title === 'string') {
      title.textContent = state.title;
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'ck:state-update') return;
    applyState(msg.state);
  });

  if (window.CK_WIDGET && window.CK_WIDGET.state) {
    applyState(window.CK_WIDGET.state);
  }
})();
```

### agent.md
```md
# {widgetType} - Agent Contract

## Editable Paths
- (list paths from defaults)

## Arrays and Ops
- (arrays + insert/remove/move rules)

## Binding Map Summary
| Path | Target | Mechanism |
| --- | --- | --- |
| ... | ... | css-var / data-attr / dom |

## Prohibited
- (paths that must never be edited)
```
