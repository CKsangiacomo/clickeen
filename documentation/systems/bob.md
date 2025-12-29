# Bob — Editor (Widget Builder)

Bob is Clickeen’s **editor**: it loads a widget definition (“Widget JSON”) and an instance (“state tree”), renders spec-driven controls, applies strict edits in memory, and streams state updates to a sandboxed preview.

This document describes the **current** repo implementation.

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

Editor session + ops:
- `bob/lib/session/useWidgetSession.tsx`
- `bob/lib/ops.ts`
- `bob/lib/edit/*`

Compiler:
- `bob/lib/compiler.server.ts`
- `bob/lib/compiler/*`
- `bob/app/api/widgets/[widgetname]/compiled/route.ts`

ToolDrawer:
- `bob/components/ToolDrawer.tsx`
- `bob/components/TdMenuContent.tsx`

Preview:
- `bob/components/Workspace.tsx`

---

## Not solved yet (intentionally)
- Backward compatibility / legacy instance migration.
- Hardened embed runtime surface (Venice) as a product contract.
- Full Copilot chat UX (we only have a narrow FAQ “generate answer” endpoint + ops pathway).
