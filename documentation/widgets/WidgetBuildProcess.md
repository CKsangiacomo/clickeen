### Widget Build Process (AI-Safe)

### Purpose
This document defines a **universal, step-by-step process** for building any Clickeen widget in `tokyo/widgets/{widgetType}/`.

It exists to prevent the most common failure mode when AI (or humans) build widgets: **Type/Layout drift** and **dead controls** (controls that compile but don’t change the widget).

This process is designed to be **AI-legible**: each step has a clear output and a gate.

---

### Canonical Widget Definition (core runtime files + contracts)
Every widget type is a folder in Tokyo:

```text
tokyo/widgets/{widgetType}/
  spec.json
  widget.html
  widget.css
  widget.client.js
  agent.md
  limits.json
  localization.json
  layers/*.allowlist.json
  pages/*.json
```

---

### Key Vocabulary (do not mix terms)
- **Array**: a list in state, written as `path[]` (example: `sections[]`, `sections[].faqs[]`).
- **Item**: one element of an array, written as `path[i]` (example: `sections[i]`, `sections[i].faqs[j]`).
- **Item pieces**: the stable subparts inside one Item (example: `question`, `answer`, `icon`, `media`, `cta`).
- **Type**: what the widget *is* (changes content model + behavior; often changes pieces and/or DOM blocks).
- **Layout**: how a Type is arranged/placed (changes array/item arrangement).

Rule: **Type and Layout are the only top-level variant axes.** Everything else is a normal control binding.

---

### The Build Steps (universal)

#### Step -1 — Write the PRD (including Subject Policy)
Before implementing a widget, the PRD must exist and must be complete.

**Policy rule (durable):**
- Widgets are implemented and tested with **everything enabled** in the editor (DevStudio / highest-tier profile).
- Tier values live in a single global matrix: `config/entitlements.matrix.json`.
- Widget-specific enforcement lives in `tokyo/widgets/{widget}/limits.json` (paths + metrics + enforcement points).
- The PRD must declare **which entitlement keys** the widget uses and **how they map to state paths**.
- Budgets are **per-session counters**; caps/flags are enforced on ops + publish, and blocked flags may be sanitized on load.

**Formatting rule (limits mapping):**
- Do not use wide Markdown tables (they wrap and stop reading like a matrix).
- Use a fixed-width mapping table in a code block:

```text
Key                      | Kind  | Path(s)                         | Metric/Mode      | Enforcement       | Notes
------------------------ | ----- | ------------------------------- | ---------------- | ----------------- | ----------------
seoGeo.enabled           | flag  | seoGeo.enabled                  | boolean (deny T) | load+ops+publish  | sanitize on load
list.primary.max         | cap   | sections[]                      | count            | ops+publish        | —
text.question.max        | cap   | sections[].faqs[].question      | chars            | ops+publish        | —
budget.copilot.turns     | budget| (consumed in Copilot send)      | per prompt       | session            | global budget
```

Gate: the PRD specifies widget behavior + the entitlements mapping (no per-widget tier matrices).

#### Step 0 — Define the content model (Arrays → Items → Item pieces)
For each Array:
- **Array path** (state): `...[]`
- **Item path**: `...[i]`
- **DOM array container** (where Items render): stable `data-role="..."`
- **DOM item container** (one Item wrapper): stable `data-role="..."`

For each Item:
- **Pieces list** (subparts inside the item)
- **Behavior** (what interactions exist; what state drives them)
- **Editable fields** (what the user can change)
- **DOM hooks** (`data-role` per piece that runtime touches)

Gate: you can answer “what is one Item?” and “what pieces does it have?” without mentioning ToolDrawer.

#### Step 1 — Define top-level variants (Type + Layout)
If the widget has multiple Types:
- Define each Type as a mini-spec:
  - which Arrays exist and what the Item pieces are
  - what behavior changes
  - what DOM blocks exist (if different)

For Layout:
- Define the layouts that change arrangement/placement of Arrays/Items.
- Declare the driving attributes:
  - `data-type="{...}"`
  - `data-layout="{...}"`

Gate: for each Type/Layout, you can name the **DOM/CSS difference** and the **state paths** that drive it.

#### Step 2 — Write `spec.json` defaults (state shape)
Create the full state shape under `spec.json` → `defaults`:
- Platform globals when applicable: `stage`, `pod`, `typography`, `behavior`
- Copilot context (cross-widget): `websiteUrl` (used by Copilot only; runtime can ignore)
- Arrays/items defaults + piece defaults
- Type/Layout fields + per-type/per-layout subtrees

Gate: every control path you will add in ToolDrawer already exists in defaults.

#### Step 3 — Write `widget.html` (DOM skeleton + stable hooks)
Add:
- Stage/Pod wrapper (platform contract)
- Widget root `[data-ck-widget="{widgetType}"]`
- `data-role` hooks for:
  - array containers
  - item containers
  - item pieces that runtime updates
- Shared runtime scripts + `widget.client.js`

Gate: every runtime selector exists and is stable.

#### Step 4 — Write `widget.css` (rendering rules)
Implement:
- Type/Layout rendering via selectors on the widget root
- Appearance via CSS variables (tokens by default)
- Responsive rules for arrays/items/pieces (desktop + mobile)

Gate: if you manually toggle `data-type`/`data-layout`, you would see a visible change.

#### Step 5 — Write `widget.client.js` (deterministic bindings)
Implement deterministic `applyState(state)`:
- Set `data-type` / `data-layout` on the root
- Render arrays/items into the DOM array containers
- Update item piece DOM (text/html/visibility) via `data-role` hooks
- Set CSS variables on the root
- Call platform globals as needed:
  - `CKStagePod.applyStagePod(state.stage, state.pod, root)`
  - `CKTypography.applyTypography(state.typography, root, roleMap)`

Gate: changing state values changes DOM/CSS immediately (no dead paths).

#### Step 6 — Write ToolDrawer (`spec.json.html[]`) (controls)
Now add editor controls by panel, scoped by Type/Layout:
- **Content**: Type selector (if any) + array/item editing + piece fields (`show-if` by Type)
- **Layout**: layout selector + arrangement controls (`show-if` by Layout)
- **Appearance**: surface controls for root/array/item/pieces (and Stage/Pod appearance group)
- **Typography**: auto-generated from `defaults.typography.roles` (don’t hand-author)
- **Settings (common)**: Website URL field (policy-gated)

Gate: every control has a real binding target (CSS var / data attr / DOM update).

#### Step 7 — Write `agent.md` (AI editing contract)
Declare:
- Editable paths (safe list)
- Enums and allowed values
- Array semantics (insert/remove/move rules)
- Parts map (selectors for pieces)

Gate: `agent.md` matches defaults + DOM hooks exactly.

---

### Required Binding Map (anti-dead-controls)
Before adding any ToolDrawer field, write a row:

| Path | Target | Mechanism | Implementation |
|---|---|---|---|
| `layout.type` | widget root | data attr | `root.setAttribute('data-layout', state.layout.type)` |
| `appearance.itemBg` | item container | CSS var | `root.style.setProperty('--item-bg', ...)` |
| `content.items[i].title` | `[data-role="item-title"]` | DOM text | `el.textContent = ...` |

If a control cannot be described as a row, it should not exist yet.

---

### Minimal Verification Checklist
- Changing Type/Layout changes visible output (not just attributes).
- Every ToolDrawer field affects the widget immediately in preview.
- No runtime default merges or random ID generation.
- `node scripts/compile-all-widgets.mjs` stays green.
