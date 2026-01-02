# Widget Architecture

> **Purpose**: System-level reference for how widgets move through Clickeen (Tokyo → Bob/Paris/Venice) and the runtime contracts (shared modules + `postMessage` protocol).
>
> For implementation steps + templates, see [HowWeBuildWidgets.md](./HowWeBuildWidgets.md).

---

## Core Tenets (system behavior)

| Tenet | Rule |
|-------|------|
| Widget Files = Truth | 5 files in Tokyo define everything |
| Orchestrators = Dumb Pipes | Bob, Paris, Venice pass data unchanged |
| Visible Failure | The system fails visibly when contracts are broken |
| No Fallbacks | Orchestrators apply zero widget defaults at runtime |

---

## Widget definition (what Tokyo stores)

Location: `tokyo/widgets/{widgetname}/`

| File | Purpose |
|------|---------|
| `spec.json` | Defaults + ToolDrawer UI definition (compiled by Bob) |
| `widget.html` | Static DOM skeleton + script tags |
| `widget.css` | Widget styling (CSS variables + variants) |
| `widget.client.js` | Runtime that applies `state` to DOM/CSS |
| `agent.md` | AI editing contract for this widget |

---

## Widget mental model (how to think about “Type” and “Layout”)

- **Everything is rendered inside Pod**. Pod is the container holding the widget root.
- The two top-level axes that define a widget experience are:
  - **Type**: the content model + runtime behavior (what it is)
  - **Layout**: how that type is arranged/placed (where/how it lives on the page)

### Pod sizing rule (default: content-driven)

By default, **Pod expands/shrinks based on widget content** (content-driven height). Only constrain/lock Pod sizing when a specific Type/Layout requires a fixed viewport experience, and expose that constraint as an explicit setting (typically in the Layout panel).

### Desktop/Mobile contract (Pod frames it; widget CSS defines it)

Pod (width mode, padding, content width, radius, alignment) strongly influences how a widget feels on desktop vs mobile, but **responsive behavior must still be explicitly defined by the widget**. Each widget must specify how its arrays/items/subparts reflow under the Pod’s constraints in `widget.css` (and supporting DOM structure in `widget.html`).

---

## Arrays + Items (global taxonomy)

In addition to Stage/Pod and Type/Layout, every widget must describe its content in the same universal units:

- **Array**: a list in state (`path[]`) — e.g. `sections[]`, `sections[].faqs[]`, `reviews[]`, `strips[]`, `strips[].logos[]`
- **Item**: one element of an array (`path[i]`)
- **DOM item container**: the DOM element that renders one Item (a stable “piece” wrapper)

**Why this matters:** at scale, widget code stays simple only if insert/remove/reorder ops always target Arrays in state, and DOM updates always target the corresponding Item containers (no brittle DOM traversal).

### Multiple arrays and nesting are normal

Widgets often have more than one array and can be nested:
- FAQ: `sections[] → sections[i].faqs[]`
- LogoShowcase: `strips[] → strips[i].logos[]`

### Convention (recommended)

- Use `data-role` for runtime/editor hooks and keep it stable:
  - array container: `data-role="{widget}-list"` (or similar)
  - item container: `data-role="{widget}-item"`
- Use widget-scoped classes for styling (BEM-like), e.g. `.ck-faq__item`.

---

## Panel distribution (Stage/Pod is the template)

Stage/Pod is the canonical example of how Clickeen exposes settings: **the same kind of setting always lives in the same panel**, and settings are grouped by **which surface** they affect.

We apply this same system to all widget-owned surfaces (when present):

- **Widget root surface** (inside Pod)
- **Array container surface** (list/grid/track container that lays out items)
- **Item surface** (the repeated “piece” container)
- **Subpart surfaces** (optional: specific inner roles like title, body, icon, badge)

**Panel rule (consistent across all widgets):**
- **Content**: content model and arrays/items (what exists)
- **Layout**: spacing/arrangement (gap/padding/columns/density/alignment; layout-type selectors)
- **Appearance**: colors/fills/borders/radius/shadow/dividers per surface
- **Typography**: role-based font settings per surface/subpart (via `defaults.typography.roles`)

This is how we keep the editor cohesive across 100s of widgets: users learn Stage/Pod once, and the same panel taxonomy applies to every other surface in every widget.

### Type = miniwidget (the practical definition)

Treat each Type as a **miniwidget** because it changes the widget across:

- **Primary user experience** (what the widget feels like)
- **Runtime behavior** (different interaction/timer logic)
- **DOM/CSS structure** (different blocks/layout systems must exist)
- **Relevant controls** (a different control set is meaningful)

In the editor, this maps cleanly to panels:
- **Type → Content panel** (because Type determines which content fields/blocks exist)
- **Layout → Layout panel** (because Layout determines arrangement/placement)
- **Stage/Pod Layout → Layout panel** (auto-generated by Bob when `defaults.stage` / `defaults.pod` exist)
- **Stage/Pod Appearance → Appearance panel** (authored using `tooldrawer-field-podstageappearance` fields)

---

## Data flow

### Editor flow (Bob)

```
Tokyo spec.json → Bob compiles controls → Bob loads instance JSON (Paris) → Bob holds working state
→ Bob posts { type:'ck:state-update', widgetname, state } to preview iframe → widget.client.js applies state
```

### Embed flow (Venice)

```
Browser → Venice /e/{publicId} → Venice loads instance JSON (Paris) + widget files (Tokyo)
→ Venice injects window.CK_WIDGET.state → browser runs widget.client.js → applyState(window.CK_WIDGET.state)
```

---

## System responsibilities

| System | Does | Does NOT |
|--------|------|----------|
| **Tokyo** | Store widget definitions (5 files) | Store instance data |
| **Bob** | Compile `spec.json`, render ToolDrawer, hold working state, send preview `postMessage` | Apply widget-specific defaults/fallbacks at runtime |
| **Paris** | CRUD instance JSON (Michael) | Transform widget state |
| **Venice** | Compose instance JSON + widget files for embed | Modify widget state |
| **Michael** | Persist instance JSON blob | Store JSON only (no per-widget validation) |

---

## Runtime contracts

### Shared runtime modules (available to all widgets)

Location: `tokyo/widgets/shared/`

| Module | Export | Purpose |
|--------|--------|---------|
| `typography.js` | `window.CKTypography.applyTypography(typo, el, roleMap)` | Apply typography roles to CSS variables |
| `stagePod.js` | `window.CKStagePod.applyStagePod(stage, pod, el)` | Apply stage/pod layout + appearance |
| `branding.js` | `window.CKBranding.applyBranding(behavior, el)` | Apply backlink / branding |

### `postMessage` protocol (Bob → preview iframe)

```javascript
{
  type: 'ck:state-update',
  widgetname: 'faq',
  state: { /* full instance JSON */ },
  device: 'desktop', // or 'mobile'
  theme: 'light'     // or 'dark'
}
```

Preview listener (inside `widget.client.js`):

```javascript
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'ck:state-update') return;
  if (msg.widgetname && msg.widgetname !== 'mywidget') return;
  applyState(msg.state);
});
```
