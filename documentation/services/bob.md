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
- `compiled.controls[]` (editor binding metadata + AI context)

### Bob does not “heal” state
- Bob does not coerce values or perform orchestrator-owned schema validation.
- State errors are surfaced by the widget runtime (Tokyo) and fixed at the source (Tokyo widget package + our own code).

---

## Boot Flow

### DevStudio harness (current repo behavior)
DevStudio fetches:
- `compiled` (via Bob compile API)
- `instanceData` (via Paris)

Then DevStudio posts into Bob:
```js
{
  type: 'devstudio:load-instance',
  subjectMode, // 'devstudio' | 'minibob' (dev subjects)
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
- Stores `{ compiled, instanceData }` in React state

### Hybrid dev (DevStudio in cloud, Bob local)
DevStudio’s widget workspace supports overriding the embedded Bob origin with a query param:

- `?bob=http://localhost:3000` (example)

This allows a fast loop where DevStudio runs from Cloudflare Pages while Bob runs locally.

Source: `admin/src/html/tools/dev-widget-workspace.html` (see the “configurable via `?bob=`” comment).

### Instance writes (DevStudio Local only)
- DevStudio is an internal harness that can create/update instances, but **writes happen only in DevStudio Local**.
- The DevStudio tool page exposes superadmin actions only on `localhost`/`127.0.0.1` and uses Bob’s `/api/paris/*` proxy to call Paris.
- `POST /api/instance` in Paris is **dev-auth gated** (requires `PARIS_DEV_JWT`) and is intended for these internal flows, not for end users.

### Dev subjects and policy (durable)
Bob resolves a single subject mode and computes a single policy object:
- **Subject input**: `subjectMode` from the bootstrap message, or URL `?subject=minibob|devstudio` (with backward compatibility for `?minibob=true`).
- **Policy output**: `policy = { flags, caps, budgets }` used to gate controls and reject ops deterministically.

Example enforcement (today): `minibob` cannot enable `seoGeo.enabled`.

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
4. Applies i18n to the injected DOM (if `data-i18n-key` is present).

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
- Undo is supported for the last applied ops batch (`undoSnapshot` in `useWidgetSession`).

---

## Copilot (chat-first, ops-based)

Bob includes a chat-only Copilot panel in ToolDrawer (`bob/components/CopilotPane.tsx`).

Behavior:
- Sends prompts to `/api/ai/sdr-copilot` with `{ prompt, widgetType, currentConfig, controls, sessionId, instancePublicId }`.
- Applies returned `ops[]` locally as pure state transforms (no orchestrator-owned schema validation/coercion).
- Requires an explicit **Keep** or **Undo** decision for any applied ops (blocks new prompts while pending; no auto-commit).
- Reports outcomes (keep/undo/CTA clicks) via `/api/ai/outcome` (best-effort).

### AI routes (current)
- `/api/ai/sdr-copilot`: Widget Copilot execution (Paris grant → San Francisco execute). Returns `422` for invalid payloads; returns `200 { message }` for upstream failures to avoid noisy “Failed to load resource” console errors.
- `/api/ai/outcome`: Outcome attach proxy (Bob → Paris → San Francisco). Always returns `200` (best-effort).

### Copilot env vars (local + Cloud-dev)
- `PARIS_BASE_URL` and `PARIS_DEV_JWT` (local/dev only) are used by Bob’s AI routes to request grants and attach outcomes.
- `SANFRANCISCO_BASE_URL` should point at the San Francisco Worker. (`/api/ai/sdr-copilot` also has local fallbacks + health probing.)

---

## Edit Engine (Ops)

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
- Ops are applied as pure state transforms (no coercion, no schema validation).
- Minimal protocol safety:
  - reject empty/invalid ops arrays
  - reject prohibited path segments (`__proto__`, `constructor`, `prototype`)
  - enforce array semantics for `insert/remove/move`

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
- Loads the widget runtime iframe at `compiled.assets.htmlUrl` (default) or `/bob/preview-shadow?publicId=...` when `instanceData.seoGeo.enabled === true` (Shadow DOM preview path).
- Waits for iframe `load`.
- Posts `ck:state-update` with `{ widgetname, state: instanceData, device, theme }`.
- Supports **workspace modes** (`preview.host`) to resize/reposition the preview viewport: `canvas | column | banner | floating` (UI label “Inline” maps to `canvas`).

The iframe is sandboxed (`allow-scripts allow-same-origin`).

---

## i18n (Editor chrome + widget UI strings)

Bob supports localization via Tokyo-hosted catalogs and DOM attributes.

### Catalog structure (Tokyo)
- Base URL: `${NEXT_PUBLIC_TOKYO_URL}/i18n`
- Manifest: `/i18n/manifest.json`
- Hashed bundles: `/i18n/{locale}/{bundle}.{hash}.json`

Namespaces (contract):
- `coreui.*` — shared editor/product chrome
- `{widgetName}.*` — widget-specific strings (e.g. `faq.*`)

### How translations are applied
Compiled Dieter stencils can emit:
- `data-i18n-key="coreui.actions.save"`
- `data-i18n-params="{'item':{'$t':'faq.item','count':1}}"` (JSON string)

At runtime, Bob:
- Resolves locale (`?locale=`, `ck_locale` cookie, then `navigator.language`, then `en`)
- Loads `coreui` + current widget bundle
- Replaces text content for elements with `[data-i18n-key]`

Implementation:
- Loader: `bob/lib/i18n/loader.ts`
- DOM applier: `bob/lib/i18n/dom.ts`

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

**Security rule (executed):**
- `PARIS_DEV_JWT` is **local/dev-worker-only**. It must never be set in Cloudflare Pages production env vars.

### Dev-up
Run:
```bash
bash scripts/dev-up.sh
```
It:
- Builds Dieter into `tokyo/dieter`
- Clears stale Next chunks (`bob/.next`)
- Starts Tokyo (4000), Paris (3001), Venice (3003), (optional) SanFrancisco (3002), Bob (3000), DevStudio (5173), Prague (4321)
- Uses **local Supabase by default**; to point local Workers at a remote Supabase project, set `DEV_UP_USE_REMOTE_SUPABASE=1` and provide `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Deterministic compilation gate (executed)

Bob compilation must remain deterministic (no classname heuristics). Run:
```bash
node scripts/compile-all-widgets.mjs
```

This compiles every widget under `tokyo/widgets/*` via Bob’s compile endpoint and asserts `compiled.assets.dieter.styles[]` and `compiled.assets.dieter.scripts[]` are present.

**Bundling contract (executed):**
- Dieter emits `tokyo/dieter/manifest.json` with `components[]`, `helpers[]`, `aliases{}`, and `deps{}`.
- Bob compiler consumes this manifest to build Dieter asset lists.

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
- Copilot rollout/auth: Paris grant issuance is currently a dev-gated surface in this repo snapshot; production user/workspace auth + allowlists/flags evolve with the release model.
- Copilot policy hardening: post-model “light edits only” caps + scope confirmation + deeper grounding to per-widget `agent.md` contracts (in progress).
