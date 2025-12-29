# Bob — Editor (Widget Builder)

Bob is Clickeen's **editor**: it loads a widget definition ("Widget JSON") and an instance ("state tree"), renders spec-driven controls, applies strict edits in memory, and streams state updates to a sandboxed preview.

This document describes the **current** repo implementation.

---

## 🔑 CRITICAL: The Two-Place Rule

**Bob is the temporary owner of instance config during editing.** (In Bob code, this working copy is stored in React state as `instanceData`.)

### config exists in EXACTLY 2 places:

1. **Michael (database)** — Published version (production source of truth; accessed via Paris)
2. **Bob's React state** — Working copy (during editing session)

**NOT in:**
- Database on every keystroke ❌
- Database on every field change ❌
- localStorage ❌
- ToolDrawer state ❌
- Some intermediate cache ❌

### The Two-API-Call Pattern

Bob makes EXACTLY 2 calls to Paris per editing session:

1. **Load** — `GET /api/instance/:publicId` → gets published config
2. **Publish** — `PUT /api/instance/:publicId` → saves working copy

**Between load and publish:**
- User edits in ToolDrawer → Bob updates React state
- Bob sends updated config to preview via postMessage
- Preview updates in real-time
- ZERO API calls to Paris
- ZERO database writes

### Operational Benefits

**Scalability:**
- 1 user or 10,000 users editing simultaneously → no server load difference
- All editing happens client-side in memory
- Only published widgets hit the database

**Database Efficiency:**
- Old model: Every visitor to clickeen.com playing with widgets → database instance created
- New model: Only users who click Publish → database instance created
- Landing page with 100 widgets + millions of visitors → ZERO database pollution

**Data Quality:**
- Database only contains published widgets users actually care about
- No abandoned experiments
- No half-edited drafts
- Clean, maintainable data

---

## Widget Definition Architecture

**Widget Definition (Tokyo) = 50% of the software**

Each widget type provides a widget definition folder in Tokyo/CDN that contains:
1. `spec.json` — defaults + ToolDrawer spec (`html[]` with `<bob-panel>` + `<tooldrawer-field>`) compiled by Bob into `panels[]` + `controls[]`
2. `widget.html` / `widget.css` / `widget.client.js` — runtime assets loaded in a sandboxed preview iframe
3. (Optional) `agent.md` — AI-facing contract for safe edits

**Bob = the other 50% of the software**

Bob provides:
- Container and layout (ToolDrawer, Workspace, TopDrawer)
- `instanceData` state management (React state + updates)
- Data binding layer (`data-bob-path`, `data-bob-showif`)
- Preview sync (postMessage to iframe)
- Save to Paris (on publish only)

Together, **Bob + Widget Definition = complete widget instance editor**.

### Dieter Strategy

**Dieter is the mama of all HTML/CSS.**

Dieter contains:
- **Primitives** — button.css, toggle.css, textfield.css, etc.
- **Widget-specific compositions** — widget-specific styling
- **Bob-specific** — bob-basetooldrawer.css

**Code splitting:** Each widget only loads the CSS/JS for components it actually uses. Dieter can have 10 components or 1,000 components—doesn't matter. Each widget stays efficient.

---

## Core Invariants

### Editing is in-memory (two-place model)
During an edit session, instance state exists in exactly two places:
1. **Published state** in Paris/Michael (database).
2. **Working state** in Bob React state (`instanceData`).

Between load and publish, Bob does not write intermediate edits to Paris.

### Spec-driven + control-driven (not UI-driven)
The widget definition (`tokyo/widgets/{widget}/spec.json`) is the source of truth for:
- Defaults (`defaults`)
- Editor UI structure (`html[]` using `<bob-panel>` + `<tooldrawer-*>` DSL)

Bob compiles the spec into a deterministic contract:
- `compiled.panels[]` (rendered panel HTML)
- `compiled.controls[]` (strict editable allowlist + type/constraints metadata)

### Bob is strict (no “silent fixing” of invalid state)
- Instance load fails fast if `instanceData` is invalid.
- All edits are ops; ops are validated and applied fail-closed.
- Widget runtimes assume state is canonical and do not merge defaultState at runtime.

---

## Boot Flow

### DevStudio harness (current repo behavior)
DevStudio fetches:
- `compiled` (via Bob compile API)
- `instanceData` (via Bob → Paris proxy)

Then DevStudio posts into Bob:
```js
{
  type: 'devstudio:load-instance',
  widgetname,
  compiled,
  instanceData,
  publicId,
  label
}
```

Bob listens in `bob/lib/session/useWidgetSession.tsx` and:
- Requires `compiled.controls[]` (must be present and non-empty)
- Uses `compiled.defaults` when `instanceData` is null
- Validates `instanceData` strictly (`validateWidgetData`)
- Stores `{ compiled, instanceData }` in React state

### Intended product shape (still aligned)
The intended “two API calls per session” model is:
1. `GET /api/widgets/[widgetname]/compiled` (Bob → Tokyo spec → compile)
2. `GET /api/paris/instance/:publicId` (Bob proxy → Paris)
…then edits happen in memory until Publish.

---

## Widget Definition (Tokyo)

Each widget lives at:
```
tokyo/widgets/{widget}/
  spec.json
  widget.html
  widget.css
  widget.client.js
  (optional) agent.md
```

### Preview contract (Bob ↔ runtime)
Bob loads `compiled.assets.htmlUrl` into an iframe and posts:
```js
{ type: 'ck:state-update', widgetname, state, device, theme }
```

Widget runtime code (`tokyo/widgets/{widget}/widget.client.js`) must:
- Resolve a widget root (scoped; no global selectors for internals).
- Listen for `ck:state-update` and apply state deterministically.
- Avoid runtime default merges and random ID generation.
- Treat shared runtime modules as required when used (e.g. `CKStagePod`, `CKTypography`).

---

## Compiler (server-only)

### Compile API
`bob/app/api/widgets/[widgetname]/compiled/route.ts`:
- Fetches `spec.json` over HTTP from `NEXT_PUBLIC_TOKYO_URL` (even locally).
- Compiles via `compileWidgetServer(widgetJson)`.
- Returns `CompiledWidget` JSON.

### Source layout
- Entrypoint: `bob/lib/compiler.server.ts`
- Internals: `bob/lib/compiler/*`
  - `assets.ts` — Tokyo URL building + Dieter asset list
  - `controls.ts` — Collect controls from markup + metadata inference
  - `stencil-renderer.ts` — Shared moustache-style stencil rendering (used by Bob + Admin)
  - `stencils.ts` — Load and render component stencils
  - `modules/stagePod.ts` — Stage/Pod panel generation
  - `modules/typography.ts` — Typography panel generation
- Shared parsing: `bob/lib/compiler.shared.ts`

### What the compiler does
1. Builds final `html[]` with injected global modules (Stage/Pod + Typography panels).
2. Parses `<bob-panel>` blocks into `compiled.panels[]`.
3. Expands `<tooldrawer-field ...>` macros into Dieter component markup using stencils:
   - Stencil HTML lives in `tokyo/dieter/components/{component}/{component}.html`
4. Emits `compiled.controls[]` by walking spec markup + stencils.
5. Builds `compiled.assets`:
   - Widget runtime URLs (`widget.html`, `widget.css`, `widget.client.js`)
   - Dieter assets required by this widget’s controls (`tokens.css` + per-component CSS/JS)

### Strict compiler rules (authoring constraints)
- `<tooldrawer-divider />` is forbidden (compile error).
- `<tooldrawer-cluster>` is the grouping primitive; it expands into a cluster wrapper.
- `<tooldrawer-cluster>` does not support `gap` / `space-after` attributes (compile error).
- Controls must compile with a known `kind` (missing/unknown kind is a compile error).
- `options="..."` must be valid JSON arrays (invalid JSON is a compile error).

### Guardrails
Golden compiler fixtures live in:
- `admin/tests/compiled-fixtures.test.ts`
- `admin/tests/fixtures/compiled-faq.json`
- `admin/tests/fixtures/compiled-countdown.json`

Use them to catch accidental compiler drift during refactors.

---

## ToolDrawer (render + bind)

### Key components
- `bob/components/ToolDrawer.tsx`: panel selection + manual/copilot mode switch.
- `bob/components/TdMenuContent.tsx`: injects compiled panel HTML and binds it to `instanceData`.

### Rendering + Dieter hydration
`TdMenuContent`:
1. Injects `panelHtml` into `.tdmenucontent__fields`.
2. Loads Dieter assets declared by `compiled.assets.dieter` (styles + scripts).
3. Runs Dieter hydrators within the injected scope.

### Binding contract (compiled HTML → ops)
Compiled controls expose paths through `data-bob-path`. ToolDrawer:
- Sets DOM field values from `instanceData`.
- Listens to `input`/`change` and emits strict ops:
  - `applyOps([{ op: 'set', path, value }])`
- Evaluates `data-bob-showif` expressions against `instanceData` and hides/shows elements.

### Grouping + rhythm
The compiler and ToolDrawer support:
- **Groups**: `data-bob-group` + `data-bob-group-label` (used for “Widget layout”, “Stage/Pod layout”, etc).
- **Clusters**: `<tooldrawer-cluster>` expands to a tight wrapper in compiled HTML; ToolDrawer can also auto-nest dependent clusters based on `show-if`.

### Built-in editor actions (current)
- “Generate answer with AI” exists for FAQ answer fields (UI in `bob/components/TdMenuContent.tsx`, calls `/api/ai/faq-answer` and applies returned ops).
- Undo is supported for the last applied ops batch (`undoSnapshot` in `useWidgetSession`).

---

## Edit Engine (Ops + validation)

### Contract
Edits are expressed as ops (no direct mutation paths):
```ts
type WidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };
```

### How ops are applied
- Entrypoint: `bob/lib/ops.ts`
- Ops must match `compiled.controls[]` (fail-closed allowlist).
- Values are strictly coerced by `control.kind` (`bob/lib/edit/controls.ts`).
- `validateWidgetData()` runs on:
  - Instance load (`useWidgetSession`)
  - After every op apply

If validation fails:
- Instance load fails and Bob shows an “Instance load error”.
- Edits are rejected and Bob shows an “Edit rejected” error panel.

### Control metadata (the machine contract)
`compiled.controls[]` includes (as available):
- `path`, `label`, `panelId`
- `kind` (`string|number|boolean|enum|color|array|object|json`)
- `enumValues` / `options`
- `min` / `max`
- `itemIdPath` (arrays/repeaters)
- `allowImage` (fill controls representing `background` vs `color`)

This is the foundation for both strict manual editing and future Copilot editing.

---

## Preview (Workspace)

`bob/components/Workspace.tsx`:
- Loads the widget runtime iframe at `compiled.assets.htmlUrl`.
- Waits for iframe `load`.
- Posts `ck:state-update` with `{ widgetname, state: instanceData, device, theme }`.

The iframe is sandboxed (`allow-scripts allow-same-origin`).

---

## Bob vs MiniBob

**MiniBob:**
- Bob embedded in Prague (marketing site) via iframe with `?minibob=true` query param
- Anonymous users (no login required)
- Bob conditionally hides UI elements when `minibob=true`:
  - NO Save button
  - NO SecondaryDrawer
  - Only "Publish" button visible
- Goal: Get people to sign up

**Bob (authenticated):**
- Accessed at `app.clickeen.com/bob` without `minibob` param
- Registered users only (requires login)
- Full UI:
  - "Copy Code" button always visible
  - "Save" button appears when dirty
  - SecondaryDrawer available (Phase-1: off by default)
- Goal: Convert free users to paid, retain customers

**User flow:**
1. Browse gallery on clickeen.com (Prague)
2. Click widget card → Prague creates draft instance with default template
3. Prague opens MiniBob with `?publicId=wgt_xxx`
4. Edit config and/or switch templates in MiniBob
5. Click "Publish" → Sign up
6. Redirected to authenticated Bob with widget claimed to workspace

**Technical implementation:**
- Single codebase (`bob/`)
- Detects `?minibob=true` query param
- Conditionally renders UI based on `isMiniBob` context
- NO separate MiniBob deployment

---

## UI Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  TopDrawer: Widget name + Publish button            │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Tool     │   Workspace              │  Secondary    │
│ Drawer   │   (Live Preview)         │  Drawer       │
│ (Left)   │   [iframe showing        │  (Right)      │
│          │    widget]               │               │
│ Edit     │                          │  Future:      │
│ controls │   Theme: Light/Dark      │  Assist       │
│ go here  │   Device: Desktop/Mobile │               │
│          │                          │               │
└──────────┴──────────────────────────┴───────────────┘
```

### CSS Grid Structure

**Root Container:**
- `.root` — Main grid: top bar + body

**TopDrawer (Top Bar):**
- `.topdrawer` — Top bar container
- `.topbar` — Horizontal layout: left + right
- `.topdmain` — Left area (widget name)
- `.topdright` — Right area (Publish button)

**Body Grid (Three Columns):**
- `.grid` — Three-column grid: 280px | fluid | 280px

**Left Column (ToolDrawer):**
- `.tooldrawer` — Left drawer container
- `.tdheader` — Sticky header (Assist toggle)
- `.tdcontent` — Scrollable content

**Center Column (Workspace):**
- `.workspace` — Center container
- `.wsheader` — Sticky header (Theme/Device toggles)
- `.wsheaderRow` — Three-part header: left | center | right
- `.widget_preview` — Iframe container

**Right Column (SecondaryDrawer):**
- `.secondarydrawer` — Right drawer container
- `.sdheader` — Sticky header
- `.sdcontent` — Scrollable content

---

## Key UX Features

### 1. Live Preview
- Center of the screen, always visible
- Shows the **real widget runtime** (Tokyo `widget.html` + `widget.client.js`) in a sandboxed iframe
- **Instant feedback**: Bob streams `instanceData` via `postMessage` (no iframe reload on each change)
- Shows exactly what will appear on their website
- Prefer tokenized widgets (CSS vars) for patchable fields

### 2. Publish UX Model

**MiniBob (on clickeen.com website):**
- NO Save button
- Only "Publish" button → triggers signup flow → widget saved to account
- Anonymous editing with all instanceData in memory (no database writes)

**In-App Bob (authenticated users):**
- "Copy Code" button always visible
- "Publish" button always visible
- Clicking Publish:
  1. Sends PUT to Paris with instanceData from Bob's React state
  2. Saves to database (first database write of the session)
  3. Triggers preview iframe refresh to show published state
  4. User can copy embed code
- NO auto-save (explicit user action only)

### 3. Widget Naming
- Top left: Editable widget name
- Click to rename inline (uses Dieter `textrename` component)
- Enter to save, Escape to cancel

### 4. Theme & Device Toggles
- Center top: Switch between Desktop/Mobile view
- Right top: Switch between Light/Dark theme
- Changes are instant (postMessage patches in preview iframe)

### 5. Assist Mode (Manual + Copilot)
- Left drawer header: Toggle between "Manual" and "Copilot"
- **Manual mode**: User edits `instanceData` via ToolDrawer controls; FAQ answers include "Generate with AI"
- **Copilot mode**: AI-assisted editing via ops (chat Copilot is planned)
- **AI is always fail-closed**: AI returns structured ops; Bob validates against compiled `controls[]` before applying

---

## Deployment

| Aspect | Value |
|--------|-------|
| **Platform** | Cloudflare Pages + Workers |
| **Source** | `bob/` |
| **Domain** | `app.clickeen.com` |
| **Route** | `/bob` |

---

## Environment & Dev Setup

### Required
- `NEXT_PUBLIC_TOKYO_URL` (hard-required in `bob/app/layout.tsx` and compile route)

### Paris proxy (current code)
Bob proxies Paris via:
- `bob/app/api/paris/instances/route.ts`
- `bob/app/api/paris/instance/[publicId]/route.ts`

The proxy currently supports:
- `PARIS_BASE_URL` (preferred)
- `NEXT_PUBLIC_PARIS_URL` / `http://localhost:3001` default (present in code today)

Optional:
- `PARIS_DEV_JWT` (dev auth passthrough)

### Dev-up
Run:
```bash
bash scripts/dev-up.sh
```
It:
- Builds Dieter into `tokyo/dieter`
- Clears stale Next chunks (`bob/.next`)
- Starts Tokyo (4000), Paris (3001), Bob (3000), DevStudio (5173)

---

## Repo Map (Bob kernel)

```
bob/lib/
├── compiler/
│   ├── assets.ts              # Tokyo URL building + Dieter asset list
│   ├── controls.ts            # Collect controls from markup
│   ├── stencil-renderer.ts    # Shared moustache-style stencil rendering
│   ├── stencils.ts            # Load and render component stencils
│   └── modules/
│       ├── stagePod.ts        # Stage/Pod panel generation
│       └── typography.ts      # Typography panel generation
├── edit/
│   ├── controls.ts            # Control matching + value coercion
│   ├── ops.ts                 # Op application logic
│   ├── typography-fonts.ts    # Font validation + weight/style lookup
│   └── validate.ts            # Widget data validation
├── session/
│   └── useWidgetSession.tsx   # React hook for editor session
├── compiler.server.ts         # Compiler entrypoint (server-only)
├── compiler.shared.ts         # Shared parsing helpers
├── ops.ts                     # Edit engine entrypoint (re-exports edit/ops)
├── types.ts                   # CompiledWidget/CompiledControl types
├── icons.ts                   # Icon lookup
└── utils/
    └── paths.ts               # getAt/setAt path helpers
```

**Key files:**

| Area | Files |
|------|-------|
| Editor session + ops | `session/useWidgetSession.tsx`, `ops.ts`, `edit/*` |
| Compiler | `compiler.server.ts`, `compiler/*` |
| ToolDrawer | `bob/components/ToolDrawer.tsx`, `TdMenuContent.tsx` |
| Preview | `bob/components/Workspace.tsx` |
| API routes | `bob/app/api/widgets/[widgetname]/compiled/route.ts` |

---

## Paris Proxy (Server-Side)

Bob uses a server-side proxy to call Paris API without exposing JWTs to the browser.

### How it works

1. Client calls `/api/paris/instance/:publicId` (local Bob route)
2. Proxy forwards request to Paris at `PARIS_BASE_URL`
3. Proxy adds server-side `PARIS_DEV_JWT` for authentication (dev only)
4. Returns Paris response to client

### Client usage

```typescript
// ✅ Correct - uses proxy (relative path)
const res = await fetch(`/api/paris/instance/${publicId}`);

// ❌ Wrong - calls Paris directly (exposes JWT, causes CORS)
const res = await fetch(`http://localhost:3001/api/instance/${publicId}`);
```

### Common Proxy Issues

**Issue:** Tool drawer controls don't save (401 Unauthorized)
**Cause:** Bob proxy missing `PARIS_DEV_JWT` env var
**Fix:** Restart Bob with JWT set

**Issue:** Saves fail with "Loading..." in tool drawer
**Cause:** Client calling Paris directly instead of using proxy
**Fix:** Ensure client-side calls use `/api/paris/instance/:publicId` path

---

## Using Dieter Components in Bob

Bob's tool drawer uses Dieter design system components for all controls.

### Button Usage

**Trigger buttons** (primary actions):
```tsx
<button
  className="diet-btn diet-btn--block diet-btn--split"
  data-variant="primary"
  data-size="md"
>
  <span className="diet-btn__label">Label</span>
  <span className="diet-btn__icon" aria-hidden="true">{/* SVG */}</span>
</button>
```

### Text Field Component

```tsx
<label className="diet-input" data-size="md">
  <span className="diet-input__label">Field Label</span>
  <div className="diet-input__inner">
    <input
      className="diet-input__field"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  </div>
</label>
```

### Common Mistakes

**❌ WRONG: Wrapping dropdown in text field**
```tsx
<label className="diet-input">
  <div className="diet-input__inner">
    <div className="diet-dropdown">...</div>  <!-- WRONG -->
  </div>
</label>
```

**✅ RIGHT: Dropdown standalone with simple label**
```tsx
<div>
  <label style={labelStyles}>Color</label>
  <div className="diet-dropdown">...</div>
</div>
```

**❌ WRONG: Missing button structure classes**
```tsx
<button className="diet-btn" data-variant="primary">  <!-- Missing --block --split -->
```

**✅ RIGHT: Full structure for split buttons**
```tsx
<button className="diet-btn diet-btn--block diet-btn--split" data-variant="primary">
```

---

## AI Assist / Copilot Architecture

Bob's AI editing is built on the same contracts as Manual editing.

### Current State
- Compiler emits `controls[]` so machines know exactly what's editable
- Ops engine applies `{ op, path, ... }` to in-memory `instanceData`, validates fail-closed against `controls[]`, and supports Undo
- Field-level AI: FAQ answers can be generated via Bob API route that returns ops
- Copilot pane is an "Ops Sandbox" for testing ops payloads

### Planned (San Francisco Integration)
- Chat Copilot that sees `compiled.controls[]`, `tokyo/widgets/{widget}/agent.md`, and current `instanceData`
- Copilot outputs ops; Bob validates/applies them via the same fail-closed engine
- Publish remains an explicit user action; Copilot must not write to Paris directly

---

## For AIs Reading This

**Key principles:**
1. Bob is a **builder app** for registered users (not the marketing playground)
2. Bob **never touches the database directly** — all data through Paris API
3. Preview iframe shows the **real widget runtime** from Tokyo (not mocks)
4. **Always check before creating** — never silently POST new widgets
5. **Always include `?ts=` param** on iframe refreshes
6. **Use pure Dieter component patterns** — don't wrap components in inappropriate containers
7. **Client calls use proxy routes** — never expose JWTs to browser

**When implementing Dieter components:**
- Check `dieter/dieteradmin/src/html/dieter-showcase/*.html` for canonical structure
- Don't nest components incorrectly (e.g., dropdown inside text field)
- Don't conditionally style option buttons — they're always neutral
- Include all required CSS classes (`diet-btn--block`, `diet-btn--split`, etc.)

**When confused:**
- Check actual code in `bob/app/bob/bob.tsx`
- Look at Paris API contracts in `documentation/systems/paris.md`
- Look at Venice preview contracts in `documentation/systems/venice.md`
- Look at Dieter showcase HTML for component patterns

---

## Not solved yet (intentionally)
- Backward compatibility / legacy instance migration.
- Hardened embed runtime surface (Venice) as a product contract.
- Full Copilot chat UX (we only have a narrow FAQ "generate answer" endpoint + ops pathway).
