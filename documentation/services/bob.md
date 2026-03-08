# Bob — Editor (Widget Builder)

Bob is Clickeen’s **editor**: it loads a widget definition (“Widget JSON”) and an instance (“state tree”), renders spec-driven controls, applies strict edits in memory, and streams state updates to a sandboxed preview.

This document describes the **current** repo implementation.

---

## Core Invariants

### Editing is in-memory (two-place model)
During an edit session, instance state exists in exactly two places:
1. **Persisted base state** in Paris/Michael (database).
2. **Working state** in Bob React state (`instanceData`).

Between load and save, Bob does not write intermediate edits to Paris.

### Save + Publish affordances
Bob intentionally separates:
- **Saving config** (writes to Paris): appears as **Save / Discard** buttons only when the base config is dirty.
- **Publishing in Bob** is only the embed-code affordance: the **Publish** button opens a modal containing embed snippets (safe iframe + gated iframe++ SEO/GEO).
- **Bob has no live/unlive toggle** and does not manage published/unpublished state.

The Settings panel is widget-defined behavior controls; it must not contain embed code.

### Builder chrome ownership (current)
- Host surfaces (Roma/DevStudio) own widget-level navigation and host-only orchestration actions.
- Roma Builder embeds Bob via iframe and keeps only the standard Roma domain header above it (no ad-hoc middle toolbars).
- Bob TopDrawer owns current-instance context (instance selector + account-instance rename).
- Translation status is shown in Bob’s Localization panel header (not in host page headers).

### Spec-driven + control-driven (not UI-driven)
The widget definition (`tokyo/widgets/{widget}/spec.json`) is the editor source of truth for:
- Defaults (`defaults`)
- Editor UI structure (`html[]` using `<bob-panel>` + `<tooldrawer-*>` DSL)

Bob compiles the spec into a deterministic contract:
- `compiled.panels[]` (rendered panel HTML)
- `compiled.controls[]` (editor binding metadata + AI context)

### Bob does not “heal” state
- Bob does not coerce values or perform orchestrator-owned schema validation.
- State errors are surfaced by the widget runtime (Tokyo) and fixed at the source (Tokyo widget package + our own code).

### Entitlements + limits (v1)
- Paris returns entitlements from the global matrix (`config/entitlements.matrix.json`).
- Widget-specific limits live in `tokyo/widgets/{widget}/limits.json` and are loaded with the compiled payload.
- Bob enforces limits on ops and sanitizes blocked values on load (no widget-specific branches).

---

## Boot Flow

### Host bootstrap contract (current repo behavior)
Host surfaces (Roma/DevStudio) fetch:
- `compiled` (via Bob compile API)
- `instanceData` (via Paris)

Then they wait for Bob session readiness and post into Bob:
```js
// Bob -> host
{ type: 'bob:session-ready', sessionId, bootMode: 'message' }

// host -> Bob
{
  type: 'ck:open-editor',
  requestId,
  sessionId,
  subjectMode, // 'account' | 'minibob'
  widgetname,
  compiled,
  instanceData,
  accountId,
  publicId,
  label
}
```

Bob listens in `bob/lib/session/useWidgetSession.tsx` and:
- Requires `compiled.controls[]` (must be present and non-empty)
- Uses `compiled.defaults` when `instanceData` is null
- Stores `{ compiled, instanceData }` in React state
- Never auto-picks a different instance when `publicId` is missing.
- Replies with `bob:open-editor-ack`, then terminal `bob:open-editor-applied` or `bob:open-editor-failed`.
- Keeps request idempotency state per `requestId` so repeated host sends do not apply duplicate open operations.
- In cloud, relies on shared httpOnly session cookies set by Roma (no tokens bridged through browser JS).
- Local DevStudio/Bob are tool-trusted only for the explicit `surface=devstudio` toolchain: there is **no local browser login** and **no local session bootstrap** for that tool path. Bob proxies to Paris using `PARIS_DEV_JWT` server-side (plus `x-ck-internal-service: bob.local`) only when the local request resolves to the DevStudio surface. All other Bob requests resolve real Berlin-backed session auth.

### URL bootstrap (deterministic, no auto-pick)
Bob bootstraps from URL only when `?boot=url` and both `accountId` + `publicId` are present.
If URL mode is selected and either is missing, Bob stays unmounted.
In `?boot=message`, Bob ignores URL instance params and waits for host `ck:open-editor`.
Current architecture direction: Roma/DevStudio use `boot=message`; URL mode remains for explicit URL-bootstrap surfaces.
Host intent is explicit via `surface` query param on the Bob iframe (`surface=roma` or `surface=devstudio`).

### Hybrid dev (DevStudio in cloud, Bob local)
DevStudio’s widget sandbox tool supports overriding the embedded Bob origin with a query param:

- `?bob=http://localhost:3000` (example)

This allows a fast loop where DevStudio runs from Cloudflare Pages while Bob runs locally.
The write plane does **not** move to Cloudflare DevStudio in this setup; writes still go through the attached local Bob/Paris stack and its selected Supabase target.

### Runtime status (local authoring clarity)
- `GET /api/dev/runtime` returns Bob runtime hints for Widget Workspace (`envStage`, `supabaseTarget`, `localToolAuthEnabled`).
- DevStudio uses this to show whether the attached local Bob toolchain is pointed at `local` or `remote` Supabase.

Source: `admin/src/html/tools/dev-widget-workspace.html` (historical filename; see the “configurable via `?bob=`” comment).

### Instance write surfaces (current)
- Roma user flows can create/duplicate/delete account user instances via Paris (`/api/roma/*` + account instance endpoints).
- When Bob is hosted by Roma (`surface=roma`, `boot=message`, `subject=account`), Bob does not own the account mutation transport. It emits explicit editor commands back to the Roma host, and Roma executes the named same-origin account routes (`/api/accounts/...`) on Bob's behalf.
- DevStudio Local remains the superadmin surface for curated/main authoring actions through Bob’s same-origin named API routes on `localhost`/`127.0.0.1`.
- MiniBob and explicit URL-bootstrap surfaces still use Bob’s own named routes directly when there is no Roma host boundary.

### Dev subjects and policy (durable)
Bob resolves a single subject mode and computes a single policy object:
- **Subject input**: `subjectMode` from the bootstrap message, or URL `?subject=account|minibob`.
- **Policy output**: `policy = { flags, caps, budgets }` used to gate controls and reject ops deterministically.

Example enforcement (today):
- `minibob` cannot create/save account instances (`can(policy, 'instance.create'|'instance.update')` denies with upsell).
- Uploads + Copilot are bounded by budgets/caps (server-enforced; Bob uses policy for UX gating).

Read-only mode (DevStudio cloud):
- Passing `?readonly=1` (or `?role=viewer`) forces `policy.role = viewer`.
- Bob blocks edits and saves when in viewer role (read-only DevStudio experience).

### Intended product shape (still aligned)
Core base-config lifecycle per open session:
1. One instance load `GET /api/accounts/:accountId/instance/:publicId?subject=account` (performed by host in message boot or by Bob in URL boot).
2. In-memory edits only (no base-config API writes).
3. One save/write command on explicit Save. In Roma-hosted flows, the command is delegated to Roma and Roma calls `PUT /api/accounts/:accountId/instance/:publicId?subject=account`; in URL/local flows Bob calls the named route directly. Base persistence remains immediate; mirror/l10n convergence stays async and is observed via l10n status routes.

Compiled payload fetch (`GET /api/widgets/[widgetname]/compiled`) can be done by host or Bob depending on boot mode/caching strategy.

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
  limits.json
  localization.json
  layers/*.allowlist.json
  pages/*.json
```
Bob consumes `spec.json` + runtime assets and loads `limits.json` for entitlements; the other contract files are used by Paris/Prague.

### Preview contract (Bob ↔ runtime)
Bob loads `compiled.assets.htmlUrl` into an iframe and posts:
```js
{ type: 'ck:state-update', widgetname, state, device, theme }
```

Preview readiness behavior:
- Bob keeps the preview in a loading state until runtime sends `ck:ready`.
- A bounded fallback timer reveals the iframe even if `ck:ready` is delayed, to avoid permanent blank-canvas states.

Widget runtime code (`tokyo/widgets/{widget}/widget.client.js`) must:
- Resolve a widget root (scoped; no global selectors for internals).
- Listen for `ck:state-update` and apply state deterministically.
- Avoid runtime default merges and random ID generation.
- Treat shared runtime modules as required when used (e.g. `CKStagePod`, `CKTypography`).

### Tokyo asset proxy (preview)

Bob serves widget and Dieter assets through same-origin routes so the preview iframe can load canonical asset URLs safely:
- `bob/app/widgets/[...path]/route.ts` (`/widgets/*`)
- `bob/app/dieter/[...path]/route.ts` (`/dieter/*`)

### Preview shadow (Venice)

Bob’s preview-shadow route (`/bob/preview-shadow`) is a diagnostic/internal embed-parity surface (not triggered by standard preview).

Modes (shipped):
- Default: passes `data-force-shadow="true"` to preview shadow DOM rendering via Venice `/r/:publicId` (diagnostics only).
- `?mode=seo-geo`: previews the **iframe++ SEO/GEO optimized embed** by passing `data-ck-optimization="seo-geo"` (UI stays iframe; loader injects host metadata).

Requires `NEXT_PUBLIC_VENICE_URL` (or `VENICE_URL`) to resolve the loader origin.

---

## Compiler (server-only)

### Compile API
`bob/app/api/widgets/[widgetname]/compiled/route.ts`:
- Fetches `spec.json` over HTTP from `NEXT_PUBLIC_TOKYO_URL` (even locally).
- Compiles via `compileWidgetServer(widgetJson)`.
- Returns `CompiledWidget` JSON.
- Maintains an in-memory hot cache (10 minute TTL) keyed by widget + freshness validators/hash.
- Emits `X-Bob-Compiled-Cache: hot|hit|miss|bypass` to support runtime latency diagnostics.

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
- `<tooldrawer-cluster>` may include an optional label via `label="..."` (or `label-key` + `label-params`) to render a small section eyebrow inside the panel.
- Controls must compile with a known `kind` (missing/unknown kind is a compile error).
- `options="..."` must be valid JSON arrays (invalid JSON is a compile error).

### Guardrails
There are no golden compiler fixtures yet. The current sanity check is to compile every widget via Bob:
- `pnpm compile:widgets` (runs `scripts/compile-all-widgets.mjs`, defaults `BOB_ORIGIN=http://localhost:3000`)

This catches missing/unknown control kinds, invalid JSON in `options="..."`, and asset contract regressions before they ship.

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

### Grouping + rhythm (vertical spacing model)
ToolDrawer has a single, global vertical rhythm. **Only clusters and groups define spacing.**
- **Vertical spacing**: owned by ToolDrawer containers (`.tdmenucontent__fields` and `.tdmenucontent__cluster-body` gaps). Controls do not add external margins. Only eyebrow labels (cluster/group labels) add a bottom margin.
- **Clusters**: `<tooldrawer-cluster>` expands to `.tdmenucontent__cluster` + `.tdmenucontent__cluster-body` and can wrap any markup/controls. `gap`/`space-after` are forbidden; use clusters to segment sections.
- **Groups**: `data-bob-group` + `data-bob-group-label` are per-field wrappers created from `<tooldrawer-field-{groupKey}>` or `group-label`. ToolDrawer merges **adjacent** fields with the same group into `.tdmenucontent__group`. Groups appear inside a cluster only if those fields are inside that cluster.
- ToolDrawer may auto-nest dependent clusters based on `show-if` for cleaner layout, without changing the spacing model.

### Built-in editor actions (current)
- Undo is supported for the last applied ops batch (`undoSnapshot` in `useWidgetSession`).

### Asset uploads (account-owned, immediate)

Asset controls (`dropdown-upload`, `dropdown-fill`) upload immediately on file pick through Bob:
- `POST /api/assets/upload` (Bob proxy) -> Tokyo-worker `POST /assets/upload`
- Bob forwards Berlin session bearer and account/public/widget trace headers.
- Tokyo-worker validates auth + account membership, applies upload budgets/caps, writes R2 + metadata, and returns canonical URL.

Asset-aware controls persist immutable refs (`asset.ref` / `poster.ref`) on canonical media fields; runtime URLs are derived from those refs (no publish-time crawl/rewrite step).

Contracts:
- **Canonical ownership**: uploads are account-owned and stored at:
  - key: `assets/versions/{accountId}/{assetId}/{filename}`
  - runtime path derived from ref: `/assets/v/:assetRef`
- **Trace context**: `accountId`, `publicId`, `widgetType`, `source` remain provenance fields.
- Legacy Tokyo asset paths (`/workspace-assets/**`, `/curated-assets/**`, `/assets/accounts/**`) are unsupported on writes.

Operational baseline (local smoke, 2026-02-17):
- `POST /api/assets/upload` (1x1 PNG, account/public/widget trace headers): `~55ms`
- End-to-end with Roma account asset APIs (list/delete) remained sub-100ms on warm services.

Editor UX note:
- `dropdown-upload` now surfaces an inline preview error when a persisted asset URL is unreachable (e.g. stale/deleted asset), so missing assets are explicit instead of appearing as a silent blank preview.

---

## Copilot (chat-first, ops-based)

Bob includes a chat-only Copilot panel in ToolDrawer (`bob/components/CopilotPane.tsx`).

Behavior:
- Sends prompts to `/api/ai/widget-copilot` with `{ prompt, widgetType, currentConfig, controls, sessionId, instancePublicId }`.
- Applies returned `ops[]` locally as pure state transforms (no orchestrator-owned schema validation/coercion).
- Requires an explicit **Keep** or **Undo** decision for any applied ops (blocks new prompts while pending; no auto-commit).
- Reports outcomes (keep/undo/CTA clicks) via `/api/ai/outcome` (best-effort).
- Server-side hardening in `/api/ai/widget-copilot`:
  - Accepts only widget-copilot agent IDs (`widget.copilot.v1`, `sdr.widget.copilot.v1`, `cs.widget.copilot.v1`).
  - Normalizes `subject` on the server. Only `account|minibob` are accepted (`account` requires `accountId`).
  - For widget-copilot IDs (alias or canonical), grant routing is policy-resolved server-side (`free|minibob` -> SDR, `tier1|tier2|tier3` -> CS).

Minibob keep gate (public UX):
- In Minibob (`subject=minibob`), edits are preview-only until signup.
- After a change, the UI shows a **signup CTA** (“Create a free account to keep this change”) instead of “Keep”.
- Undo remains available locally; “Keep” is gated behind signup/publish.
- On publish/signup, the current draft snapshot is claimed into the new account-owned instance; draft context such as `context.websiteUrl` remains part of that instance when present.

### AI routes (current)
- `/api/ai/widget-copilot`: Widget Copilot execution (Paris grant → San Francisco execute). Returns `422` for invalid payloads; returns `200 { message }` for upstream failures to avoid noisy “Failed to load resource” console errors.
- `/api/ai/outcome`: Outcome attach proxy (Bob → Paris → San Francisco). Always returns `200` (best-effort).

Deployment note (verified on February 11, 2026):
- Local Bob uses `/api/ai/widget-copilot` as primary.
- Cloud-dev Bob (`bob.dev.clickeen.com`) serves `/api/ai/widget-copilot` as the only Copilot execution endpoint.
- Cloud-dev verification confirms profile routing works through this endpoint (`free -> SDR`, `tier3 -> CS`) via `meta.promptRole`.

### User-Facing Controls (PRD 041)
- **Provider/Model Selection:** For agents and tiers that allow choice, Bob surfaces provider/model options from the policy grant metadata (for example OpenAI/Claude/DeepSeek/Groq/Amazon Nova, profile-dependent). Bob passes the selected values in the Copilot payload, and San Francisco enforces them against the grant’s `ai.profile`.

### Copilot env vars (local + Cloud-dev)
- `PARIS_BASE_URL` is used by Bob’s AI routes to request grants and attach outcomes.
- `SANFRANCISCO_BASE_URL` should point at the San Francisco Worker. (`/api/ai/widget-copilot` also has local fallbacks + health probing.)

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
- Ops are applied as pure state transforms with **fail-closed control allowlisting**.
- Validation rules:
  - reject empty/invalid ops arrays
  - reject prohibited path segments (`__proto__`, `constructor`, `prototype`)
  - reject paths not allowlisted by `compiled.controls`
  - enforce control-kind semantics (arrays for `insert/remove/move`)
  - strict value coercion based on `compiled.controls.kind`

### Control metadata (the machine contract)
`compiled.controls[]` includes (as available):
- `path`, `label`, `panelId`
- `kind` (`string|number|boolean|enum|color|array|object|json`)
- `enumValues` / `options`
- `min` / `max`
- `itemIdPath` (arrays/repeaters)
- `allowImage` (dropdown-fill only; derived from `fill-modes`/`allow-image` markup and signals whether image/video modes are allowed)

This is the foundation for both strict manual editing and future Copilot editing.

---

## Preview (Bob Workspace component)

`bob/components/Workspace.tsx`:
- Loads the widget runtime iframe at `compiled.assets.htmlUrl` (canonical preview path).
- Standard preview is Tokyo-runtime only; SEO/GEO “iframe++” is a **Venice embed optimization** and does not change the Bob preview engine.
- Waits for iframe `load`.
- Posts `ck:state-update` with `{ widgetname, state: instanceData, device, theme }`.
- Supports **preview host modes** (`preview.host`) to resize/reposition the preview viewport: `canvas | column | banner | floating` (UI label “Inline” maps to `canvas`).

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
- Resolves locale (`?locale=`, `ck_locale` cookie, then primary language from `navigator.language` (`fr-FR` → `fr`), then `en`)
- Loads `coreui` + current widget bundle
- Replaces text content for elements with `[data-i18n-key]`

Implementation:
- Loader: `bob/lib/i18n/loader.ts`
- DOM applier: `bob/lib/i18n/dom.ts`

See also:
- `documentation/capabilities/localization.md`

---

## l10n (Instance content overlays)

Bob supports instance-content localization (not editor chrome):

- Locale preview uses layered overlays via `/api/accounts/:accountId/instances/:publicId/layers/user/:locale?subject=account`.
- Manual overrides are stored in layer=user (`/layers/user/:locale` or `/layers/user/global`) and merged last at runtime.
- In Translate mode, edits are saved as per-field overrides (layer=user) and never change structure.
- Structural edits (add/remove items) happen only in the base locale (Edit mode), then publish to regenerate locale overlays.
- "Revert to auto-translate" deletes the layer=user overlay for the active locale.
- Localization status is derived from **materialized overlays**, not configured locale count:
  - `EN only` = base locale only
  - `Configured` = locales configured but no usable non-base overlays yet
  - `Ready` = at least one usable non-base overlay exists
  - `Stale` = overlay fingerprint mismatch with base
- If a locale is selected but no usable overlay exists, Bob must show explicit "not generated yet" state (no silent fallback-as-ready).

Note: localization writes are separate from the base-config two-call pattern; overlays persist through Paris's l10n storage layer (`OVERLAYS_R2` + `L10N_STATE_KV`) without publishing the base config.
In Roma-hosted account flows, those localization writes also traverse the Roma host command boundary instead of Bob writing straight through itself.

Reference:
- `documentation/capabilities/localization.md`

---

## Environment & Dev Setup

### Required
- `NEXT_PUBLIC_TOKYO_URL` (required in deployed environments; local `product` profile defaults to `https://tokyo.dev.clickeen.com`, local `source` profile defaults to `http://localhost:4000`)
### Optional
- `NEXT_PUBLIC_VENICE_URL` or `VENICE_URL` (used by the diagnostic `/bob/preview-shadow` route; local dev defaults to `http://localhost:3003`)

### Paris proxy (current code)
Bob keeps only named Paris routes, with no wildcard proxy:
- `bob/app/api/roma/bootstrap/route.ts`
- `bob/app/api/roma/templates/route.ts`

Bob editor routes are explicit and non-`/api/paris`:
- `bob/app/api/instance/[publicId]/route.ts` (minibob read shortcut; `subject=minibob`)
- `bob/app/api/accounts/[accountId]/instance/[publicId]/route.ts`
- `bob/app/api/accounts/[accountId]/instances/[publicId]/layers/user/[locale]/route.ts`
- `bob/app/api/accounts/[accountId]/instances/[publicId]/l10n/status/route.ts`
- `bob/app/api/accounts/[accountId]/instances/[publicId]/l10n/enqueue-selected/route.ts`
- `bob/app/api/accounts/[accountId]/locales/route.ts` (`GET` direct Michael read + `PUT` Paris orchestration)

The proxy currently supports:
- `PARIS_BASE_URL` (preferred)
- `NEXT_PUBLIC_PARIS_URL` / `http://localhost:3001` default (present in code today)

Account-scoped proxy calls require `subject=account|minibob` to resolve policy.

**Security rule (executed):**
- Bob’s Paris and AI proxy routes forward Berlin session bearer tokens. Product auth does not use `PARIS_DEV_JWT` passthrough.
- Local `PARIS_DEV_JWT` is supplied by `bash scripts/dev-up.sh` / `.env.local` for DevStudio-local tooling only. It must not be committed in Bob Pages config.

### Dev-up
Run:
```bash
bash scripts/dev-up.sh
```
It:
- Builds Dieter into `tokyo/dieter`
- Builds i18n bundles into `tokyo/i18n`
- Verifies Prague l10n overlays (repo base + `tokyo/l10n/prague/**`); if stale and San Francisco is available, auto-runs translate + verify in background
- Clears stale Next chunks (`bob/.next`)
- Starts Tokyo (4000), Tokyo Worker (8791), Berlin (3005), Paris (3001), Venice (3003), (optional) SanFrancisco (3002), Bob (3000), DevStudio (5173), Prague (4321), Pitch (8790)
- Uses **local Supabase by default**; to point the local stack at a remote Supabase project, set `DEV_UP_USE_REMOTE_SUPABASE=1` and provide `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ANON_KEY` in `.env.local`
- Passes Bob the resolved Supabase target explicitly, so Widget Workspace and Bob locale reads use the same local-vs-remote Michael target as Berlin/Paris.
- Bob resolves product auth bearer through local Berlin by default (`BERLIN_BASE_URL=http://localhost:3005`).

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
- Copilot rollout/auth: Paris grant issuance is currently a dev-gated surface in this repo snapshot; production user/account auth + allowlists/flags evolve with the release model.
- Copilot policy hardening: post-model “light edits only” caps + scope confirmation + deeper grounding to per-widget `agent.md` contracts (in progress).
