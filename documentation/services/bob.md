# Bob — Editor (Widget Builder)

PRD 105 NOTE: this doc uses the current product-operation vocabulary and instance-folder/runtime authority from `Execution_Pipeline_Docs/03-Executed/105_Instance_Runtime_And_Verification_Batch/105__PRD__Instance_Folder_Tenets.md`.

Bob is Clickeen’s **editor**: it loads a widget definition (“Widget JSON”) and an instance (“state tree”), renders spec-driven controls, applies strict edits in memory, and streams state updates to a sandboxed preview.

For the canonical account-management model Bob must consume rather than own, see `documentation/architecture/AccountManagement.md`.

This document describes the **current** repo implementation.

For the 075 authoring simplification track, Bob's governing product path is Roma-hosted account editing: Roma opens one saved widget document for the current account, Bob edits it in memory, and save delegates back to Roma. Non-account boot paths do not define account authoring truth. Public/embed references generated from Bob must carry the account-scoped coordinate `accountPublicId + instanceId`; instance-only public URLs are not the surviving PRD 099 contract.

---

## Core Invariants

### Editing is in-memory (two-place model)

During an edit session, instance state exists in exactly two places:

1. **Persisted saved revision** in Tokyo.
2. **Working state** in Bob React state (`instanceData`).

Between load and save, Bob does not write intermediate edits to the saved revision plane.

### Save + copy-code affordances

Bob intentionally separates:

- **Saving config** (delegated to Roma same-origin routes, then to Tokyo): appears as a plain **Save** action. Save persists the one widget document currently open in Builder. Builder no longer treats localization as a second save lane and no longer carries a shadow saved-document model just to drive dirty/discard UI.
- **Copy code in Bob** is only the embed-code affordance for published instances: the **Copy code** button opens a modal containing the snippets needed to place the widget on a website using `https://clk.live/{accountPublicId}/{instanceId}` static public references. Unpublished instances show no live snippets.
- **Bob has no live/unlive toggle** and does not manage published/unpublished state.
- Active account routes authorize from the Berlin-issued bootstrap account authz capsule carried by Roma/Bob. They do not re-read account membership on normal editor open/save paths; DB Pivot target account role truth lives on `users`.

The Settings panel is widget-defined behavior controls; it must not contain embed code.

### Builder chrome ownership (current)

- Host surfaces own widget-level navigation and host-only orchestration actions. In active product/account mode, that host is Roma.
- Roma Builder embeds Bob via iframe and keeps only the standard Roma domain header above it (no ad-hoc middle toolbars).
- Bob TopDrawer shows current-instance context and the copy-code affordance, but does not own instance metadata actions such as rename or publish/unpublish.

### Spec-driven + control-driven (not UI-driven)

The widget definition (`tokyo/product/widgets/{widget}/spec.json`) is the editor source of truth for:

- Defaults (`defaults`)
- Editor UI structure (`html[]` using `<bob-panel>` + `<tooldrawer-*>` DSL)

Bob compiles the spec into a deterministic contract:

- `compiled.panels[]` (rendered panel HTML)
- `compiled.controls[]` (editor binding metadata + AI context)

### Bob does not “heal” saved state

- Bob validates the host-opened `instanceData` against the compiled widget default-owned shape and fails open when saved truth is malformed.
- Bob does not merge `compiled.defaults` into account-hosted config and does not coerce invalid saved primitive values to defaults during open.
- Post-open editor-operation normalization may still keep user edits in control-compatible shape after a valid saved document is loaded.
- State errors are surfaced by the widget runtime (Tokyo) and fixed at the source (Tokyo widget package + our own code).

### Entitlements + limits (v1)

- Product/backend grant issuers resolve entitlements from the global matrix (`packages/ck-policy/entitlements.matrix.json`).
- Widget-specific limits live in `tokyo/product/widgets/{widget}/limits.json` and are loaded with the compiled payload.
- Bob may surface UX guidance from policy, but the account save/open boundary belongs to Roma. Bob does not run a second authoritative save gate on the hot edit path.

---

## Boot Flow

### Host bootstrap contract (current repo behavior)

Active account authoring host path: Roma Builder fetches the saved document envelope (`compiled`, `instanceData`, `policy`, `accountPublicId`, `instanceId`, `displayName`, `source`, `meta`), then waits for Bob session readiness and sends `ck:open-editor`.

That open envelope carries the saved authoring document plus Tokyo-owned `publishStatus` for copy-code gating. It does not give Bob authority to publish or unpublish.

Then they wait for Bob session readiness and post into Bob:

```js
// Bob -> host
{ type: 'bob:session-ready' }

// host -> Bob
{
  type: 'ck:open-editor',
  requestId,
  widgetname,
  compiled,
  instanceData,
  policy,
  accountPublicId,
  instanceId,
  label,
  source,
  meta
}
```

Bob’s session runtime is now composed from explicit modules under `bob/lib/session/`.
`useWidgetSession.tsx` is now only the public barrel for the active account Builder path. Provider ownership is split across `WidgetDocumentSession.tsx`, `WidgetSessionChrome.tsx`, `WidgetSessionCopilot.tsx`, and `WidgetSessionProvider.tsx`. They split:

- one document session surface (`compiled`, `instanceData`, save/edit/load)
- one chrome surface (`policy`, `meta`, `preview`, `upsell`)
- one copilot-thread surface

Boot/open lives in `useSessionBoot.ts`, transport in `sessionTransport.ts`, editing in `useSessionEditing.ts`, saving in `useSessionSaving.ts`, and copilot thread state in `useSessionCopilot.ts`.
Together they:

- Consumes the one host-opened compiled widget contract
- Requires an explicit `instanceData` document on open; Bob does not promote `compiled.defaults` into visible widget truth
- Fails the open request when `instanceData` is missing or invalid; Bob does not invent `{}` as a replacement widget
- Stores `{ compiled, instanceData }` in React state
- Never auto-picks a different instance when `accountPublicId` or `instanceId` is missing.
- Replies with terminal `bob:open-editor-applied` or `bob:open-editor-failed` for the current host request.
- In cloud, relies on shared httpOnly session cookies set by Roma (no tokens bridged through browser JS).
- Local Bob may run as an editor runtime for debugging, but it is not a product account shell. Hosted account product requests still require the Berlin-issued bootstrap account capsule on the Roma account routes. When Bob uses Tokyo local internal routes, it must identify itself explicitly as `x-ck-internal-service: bob.local`; a bare `TOKYO_DEV_JWT` is not valid account-route authority.
- Bob must not auto-upgrade any local end-user token into Michael service-role access inside shared helpers or normal product routes.

### Builder boot (current)

Shared Builder opens through one host message. Roma opens Bob with one explicit `ck:open-editor` payload. Shared Builder core no longer models runtime subject switching or alternate account authoring modes.

### Hybrid dev (Roma in cloud, Bob local)

The old DevStudio widget-authoring workspace is removed.
Bob’s active account-mode host surface is Roma.

### Instance write surfaces (current)

- Roma user flows can duplicate, rename, publish, unpublish, and delete account instances through Roma same-origin routes plus canonical account instance routes. Account instance creation is not an active Bob-owned surface; accounts own instances, not widget software.
- In hosted account mode, Bob does not own account transport. It emits explicit editor read/write intents back to the parent host, and the host executes the named account/tool routes on Bob's behalf.
- Roma hosts customer account sessions through Roma same-origin current-account routes (`/api/account/...`).
- Prague demo no longer boots Bob as a second editor. Public playback is served from generated `clk.live` artifacts; Bob no longer exposes MiniBob helper routes or a public editor boot path.

### Policy in shared Builder core

Bob still receives one policy object with the open payload. In the shared Builder core, that policy is used for UX and Copilot/account capability context. Shared Builder no longer computes or switches a runtime subject/boot mode before deciding what product it is.

### Intended product shape (still aligned)

Core base-config lifecycle per open session:

1. One core instance load performed by the host before Bob receives `ck:open-editor`.
2. In-memory edits only (no base-config API writes).
3. One save action on explicit Save, delegated back to the host. In Roma-hosted flows, Roma executes `PUT /api/account/instances/:instanceId` for the one widget document Bob is editing. Builder localization is read-only preview; translation is async follow-up work, not a second save lane inside Bob.
   Bob sends the current document metadata back with the save (`widgetType`, `displayName`, `source`, `meta`, `config`) so Roma/Tokyo do not reconstruct sibling identity from the previously saved row.
   Base save success clears the base dirty state and keeps the same in-memory widget truth; Bob does not swap in a server-returned replacement copy of the widget. Save does not enqueue translation. Translation generation is explicit user intent from the Translations panel through Roma/Tokyo.
4. Bob opens the saved document it was given. It does not merge missing widget defaults into account-hosted config on load. If Roma/Tokyo surface malformed saved widget payload, Builder fails open at that boundary instead of healing or masking the bad row.
5. Bob carries Tokyo-owned `publishStatus` in session metadata only to gate public embed copy. Unpublished instances do not expose live snippets; publish/unpublish remains a Widgets-domain action. Published snippets must carry `accountPublicId + instanceId`.
6. Bob does not own instance rename. Widgets-domain rename mutates the Tokyo saved document separately, and Bob save does not re-author identity through a second authority.

Copilot account path:

- Bob posts prompt, current config, controls, and session metadata to Roma.
- Bob does not restate widget identity in the request body; Roma resolves widget type from the current saved instance for that `instanceId`.

Within Bob, explicit save ownership stays in `useSessionSaving.ts`. Builder no longer mounts a localization overlay/session subsystem on the active account editing path.

Compiled payload fetch (`GET /api/widgets/[widgetname]/compiled`) can be done by host or Bob depending on caching strategy, but account Builder still opens through one Roma host-open envelope.

---

## Widget Definition (Tokyo)

Each widget lives at:

```
tokyo/product/widgets/{widget}/
  spec.json
  widget.html
  widget.css
  widget.client.js
  editable-fields.json
  limits.json
  pages/*.json
```

Bob consumes compiled widget payloads + runtime media from product widget media and loads `limits.json` for entitlement UX. The authored repo source is `tokyo/product/widgets/{widget}/`; the deployed Tokyo/R2 software authority is `product/widgets/{widget}/`, even when served through friendly `/widgets/{widget}/...` routes. Authored widget `editable-fields.json` is the editable/translatable field contract; Bob preview consumes validated translated locale values rather than owning translation truth. Widget `localization.json` files and layer sidecars are not active product truth.

Widget spec contract:

- `spec.json` carries an explicit top-level `v`.
- Bob compile route fails closed on unsupported spec versions instead of caching malformed compiled output.

### Preview contract (Bob ↔ runtime)

Bob loads `compiled.media.htmlUrl` into an iframe and posts:

```js
{
  type: ('ck:state-update', widgetname, state, device, theme);
}
```

Preview readiness behavior:

- Bob keeps the preview in a loading state until runtime sends `ck:ready`.
- A bounded fallback timer reveals the iframe even if `ck:ready` is delayed, to avoid permanent blank-canvas states.

Widget runtime code (`tokyo/product/widgets/{widget}/widget.client.js`) must:

- Resolve a widget root (scoped; no global selectors for internals).
- Listen for `ck:state-update` and apply state deterministically.
- Avoid runtime default merges and random ID generation.
- Treat shared runtime modules as required when used (e.g. `CKStagePod`, `CKTypography`).

### Tokyo Media Proxy (Preview)

Bob serves widget and Dieter media through same-origin routes so the preview iframe can load canonical media URLs safely:

- `bob/app/widgets/[...path]/route.ts` (`/widgets/*`)
- `bob/app/dieter/[...path]/route.ts` (`/dieter/*`)

### Public Embed Preview

Bob standard preview remains the editor iframe fed from the in-memory working copy. Public embed snippets point at `clk.live` static files only; SEO/GEO preview belongs to the PRD 101 coding-agent build shape and is not a Venice loader route.

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
   - Stencil HTML lives in `tokyo/product/dieter/components/{component}/{component}.html`
4. Emits `compiled.controls[]` by walking spec markup + stencils.
5. Builds `compiled.media`:
   - Widget runtime URLs (`widget.html`, `widget.css`, `widget.client.js`)
   - Dieter media required by this widget’s controls (`tokens/tokens.css` + per-component CSS/JS)

### Strict compiler rules (authoring constraints)

- `<tooldrawer-divider />` is forbidden (compile error).
- `<tooldrawer-cluster>` is the grouping primitive; it expands into a cluster wrapper.
- `<tooldrawer-cluster>` does not support `gap` / `space-after` attributes (compile error).
- `<tooldrawer-cluster>` may include an optional label via `label="..."` (or `label-key` + `label-params`) to render a small section eyebrow inside the panel.
- Controls must compile with a known `kind` (missing/unknown kind is a compile error).
- `options="..."` must be valid JSON arrays (invalid JSON is a compile error).

### Guardrails

There are no golden compiler fixtures yet. The surviving guardrails are repo-local type/build checks plus Cloudflare verification. Bob is not verified by booting a localhost editor server and querying its HTTP compile route anymore.

---

## ToolDrawer (render + bind)

### Key components

- `bob/components/ToolDrawer.tsx`: panel selection + manual/copilot mode switch.
- `bob/components/TdMenuContent.tsx`: render shell for ToolDrawer panel content.
- `bob/components/td-menu-content/*`: show-if parsing, DOM hydration, field binding, linked-op expansion, and field-value helpers.

### Rendering + Dieter hydration

`TdMenuContent` and `bob/components/td-menu-content/*` together:

1. Injects `panelHtml` into `.tdmenucontent__fields`.
2. Loads Dieter media declared by `compiled.media.dieter` (styles + scripts).
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

- Undo is supported for the last applied ops batch in Bob’s document session path.

### Asset uploads (account-owned, immediate)

Asset authoring is restored on the active account Builder path through one current-account route family.

- `dropdown-fill` and `dropdown-upload` use Roma current-account asset routes only:
  - `GET /api/account/assets`
  - `POST /api/account/assets/resolve`
  - `POST /api/account/assets/upload`
- In hosted Builder, Bob installs one explicit account asset transport with three methods only: `listAssets`, `resolveAssets`, and `uploadAsset`. Bob delegates those concerns through one hosted asset-command seam: `list-assets`, `resolve-assets`, and `upload-asset`. Bob does not expose a hosted asset bridge, dataset fallback, consumer-owned route selection logic, route-table round-tripping, or ambient fetch patching.
- Authored media identity stays as account asset references (`assetRef`, optional `posterAssetRef`). Bob/Dieter resolve those refs through the Roma account asset boundary for editor preview and assignment.
- `dropdown-upload` is asset-backed only. It requires `meta-path`, persists logical asset identity in meta only, and uses resolved URLs for preview without writing the uploaded delivery URL back into widget state.
- Asset resolve now uses one shared Builder helper, and asset denial now uses one shared `bob-upsell` emitter path. Builder no longer emits a parallel host-only asset denial event.
- Account assets remain account-owned library files on this path. Upload creates or replaces a stable asset reference under the owning account, and delete is the destructive lifecycle action. Bob must not derive asset storage paths from private `accountId`; account-owned asset references resolve through Roma/Tokyo using `accountPublicId`.

Operational baseline (local smoke, 2026-02-17):

- Host-owned upload -> Tokyo-worker (1x1 PNG, account/public/widget trace headers): `~55ms`
- End-to-end with Roma account asset APIs (list/delete) remained sub-100ms on warm services.

Editor UX note:

- Missing asset truth comes from Roma/Tokyo-worker resolve only. Local preview render failures remain inline UI errors and do not relabel the asset as deleted/missing.

---

## Copilot (chat-first, ops-based)

Bob includes a chat-first Copilot surface in ToolDrawer.
Current product truth:

- Bob exposes one live account-Builder Copilot surface.
- The browser sends Copilot requests through Roma instance routes, not Bob same-origin AI routes.
- Bob keeps only the local thread / staged-ops mechanics and does not own a public MiniBob Copilot path.

Behavior:

- Sends prompts to Roma instance Copilot routes with `{ prompt, currentConfig, controls, sessionId }`.
- Applies returned `ops[]` locally as pure state transforms (no orchestrator-owned schema validation/coercion).
- Requires an explicit **Keep** or **Undo** decision for any applied ops (blocks new prompts while pending; no auto-commit).
- Reports outcomes (keep/undo/CTA clicks) through Roma-owned outcome attach paths.
- Account-mode Builder requests execute only through Roma-owned instance-scoped routes.
- Account Builder widget-copilot routing resolves to the CS editor copilot on the live product path.

### AI routes (current)

- `/api/ai/widget-copilot`: not a live product execution path anymore; Bob returns a conflict and tells the caller to reopen Builder from Roma.
- `/api/ai/outcome`: not a live product execution path anymore; Bob returns a conflict and tells the caller outcomes must attach through Roma.

Deployment note (verified on February 11, 2026):

- Local and cloud-dev account Builder Copilot now execute through Roma instance routes, not Bob same-origin AI routes.

### User-Facing Controls (PRD 041)

- **Model Selection:** For agents and tiers that allow choice, Bob surfaces one combined model dropdown derived from the Roma-open runtime policy metadata. Bob passes the selected `{provider, model}` in the Copilot payload, Roma signs it only if account policy allows it, and San Francisco enforces it against the signed `AgentRuntimePolicy`.

### Copilot env vars (local + Cloud-dev)

- Bob no longer mints grants or calls San Francisco directly on the live product path.
- Roma owns `AI_GRANT_HMAC_SECRET` and `SANFRANCISCO_BASE_URL` for account-mode Copilot execution.

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
  - reject paths not allowexternally referenced by `compiled.controls`
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

- Loads the widget runtime iframe at `compiled.media.htmlUrl` (canonical preview path).
- Standard preview is Tokyo-runtime only; SEO/GEO public output is a static artifact build shape and does not change the Bob preview engine.
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

## l10n (Translated Locale Values)

Builder no longer owns localization generation, translation job assembly, localization snapshot rehydrate, or durable user-layer writes on the active account editing path.

Current product truth:

- Bob edits one account instance in memory.
- Roma saves that account instance through Tokyo product operations.
- Account locale policy/settings remain Roma-owned.
- Translation work happens only when the Translations panel asks Tokyo to generate missing/changed translated locale values.
- When `Translations` is open, the top summary comes from Roma's account context: base locale, plan translation allowance, and active account translations.
- Bob populates the preview dropdown from translated locale summaries through Roma. Payloads expose locale codes and labels, not storage object IDs or file paths.
- Bob reads one translated value map by locale and applies it with the shared resolver before posting preview state to the widget iframe.
- If translated values for a locale do not exist, that locale is absent from the dropdown. Bob does not invent policy-derived unavailable rows.
- Save remains visible for both published and unpublished instances. Publish state only gates public embed-code copy, not editing or saving.
- Commercial upsell copy stays outside the translation panel.

Reference:

- `documentation/capabilities/localization.md`

---

## Environment & Dev Setup

### Deploy plane (cloud-dev/prod)

- Bob is a Cloudflare Pages app with **one deploy plane**: Git-connected Cloudflare Pages build.
- Canonical cloud-dev host: `https://bob.dev.clickeen.com`
- Bob’s authenticated runtime host must be the custom `*.clickeen.com` domain shape. `*.pages.dev` is not a valid public runtime host for Builder flows.
- GitHub Actions may verify Bob’s build contract, but must not create Pages projects, sync Pages secrets, or deploy Bob artifacts.
- Bob’s Pages build contract is app-local:
  - root: `bob/`
  - build command: `pnpm build:cf`
  - output: `bob/.cloudflare/output/static`
- Bob’s build script still applies an **ephemeral repo-root `.vercel/project.json` shim** with `rootDirectory: 'bob'` because Vercel’s monorepo Next.js builder requires that metadata to resolve traces correctly. This is a builder prerequisite only; the final Pages artifact path stays app-local.
- Manual Cloudflare project/env alignment is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.

### Required

- `NEXT_PUBLIC_TOKYO_URL` (required in deployed environments; local `product` profile defaults to `https://tokyo.dev.clickeen.com`, local `source` profile defaults to `http://localhost:4000`)
- `BERLIN_BASE_URL` (required for authenticated account-scoped editor routes so Bob can verify Roma account capsules against Berlin JWKS)

### Optional

- `NEXT_PUBLIC_CLK_LIVE_URL` (configured per environment for copied public embed snippets: cloud-dev `https://dev.clk.live`, production `https://clk.live`)

Important boundary:

- Roma product example/externally referenced-instance discovery is Roma-owned through `/api/account/widgets`.
- DevStudio must not use Roma example routes for instance discovery.

Bob editor routes are explicit:

- `bob/app/api/ai/widget-copilot/route.ts`
- `bob/app/api/ai/outcome/route.ts`

Account-mode Builder reads/writes do not proxy through Bob. They delegate to Roma same-origin routes through the Builder host message channel, and account-mode bootstrap truth comes from the Roma host open-editor payload rather than any Bob bootstrap route.

Bob does not own account language policy/settings. Enabled languages, base locale, and locale policy are managed in Roma Settings.

**Security rule (executed):**

- Bob’s remaining AI/public helper routes use explicit backend calls; product auth does not use shared-secret bearer passthrough.
- Bob does not own customer account product routes. Hosted account-mode reads/writes delegate through the Roma host message channel and use the Roma current-account contract.
- Local Prague string translation uses HMAC-signed San Francisco requests; Bob Pages config must not carry internal AI tooling secrets.

### Dev-up

Run:

```bash
bash scripts/dev-up.sh
```

It:

- Builds Dieter into `tokyo/product/dieter`
- Builds i18n bundles from `tokyo/roma/i18n/source` into `tokyo/roma/i18n/public`
- Clears stale Next chunks (`bob/.next`)
- Starts Tokyo (4000), Tokyo Worker (8791), Berlin (3005), and Bob (3000)
- DB Pivot blocks `dev-up` from managing Supabase lifecycle or switching between local and remote Supabase targets. Supabase schema changes must go through reviewed migrations and the approved deploy path.
- Local Bob uses Berlin/Roma/Tokyo product boundaries; it must not depend on a script-selected Supabase target.
- Bob resolves product auth bearer through local Berlin by default (`BERLIN_BASE_URL=http://localhost:3005`).
- Verifies Roma account capsules against Berlin JWKS; there is no separate account-capsule secret in local dev.

### Deterministic compilation contract (executed)

Bob compilation must remain deterministic (no classname heuristics). The contract is enforced by the compiler, the Dieter bundling manifest, repo build/typecheck, and Cloudflare verification. There is no longer a localhost Bob HTTP compile gate.

**Bundling contract (executed):**

- Dieter emits `tokyo/product/dieter/manifest.json` with `components[]`, `helpers[]`, `aliases{}`, and `deps{}`.
- Bob compiler consumes this manifest to build Dieter asset lists.

---

## Repo Map (Bob kernel)

Editor session + ops:

- `bob/lib/session/useWidgetSession.tsx` (composition shell with separate document/chrome/copilot surfaces)
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/useSessionCopilot.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/ops.ts`
- `bob/lib/edit/*`

Compiler:

- `bob/lib/compiler.server.ts`
- `bob/lib/compiler/*`
- `bob/app/api/widgets/[widgetname]/compiled/route.ts`

ToolDrawer:

- `bob/components/ToolDrawer.tsx`
- `bob/components/TdMenuContent.tsx`
- `bob/components/td-menu-content/*`

Preview:

- `bob/components/Workspace.tsx`

---

## Not solved yet (intentionally)

- Copilot rollout/auth: account-mode Copilot now runs through Roma-owned backend routes. Production allowlists/flags still evolve with the release model.
- Copilot policy hardening: post-model “light edits only” caps + scope confirmation + deeper grounding to approved widget package contracts (in progress).
