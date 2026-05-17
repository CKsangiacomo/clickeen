# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `documentation/strategy/WhyClickeen.md`.

**PRE‑GA / AI iteration contract (read first):** Clickeen is **pre‑GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions). This does **not** mean “take shortcuts” — build clean, scalable primitives and keep the architecture disciplined. But it **does** mean: avoid public‑facing backward compatibility shims, long‑lived migrations, ad‑hoc fallback behavior, defensive edge‑case handling, or multi‑version support unless a PRD explicitly requires it. Overlay truth is PRD 100: `overlayId` is the only overlay identity and overlay bodies are exact value maps under the owning instance `overlays/` folder. Physical account runtime storage truth is PRD 100: account-owned instances live at `accounts/{accountPublicId}/instances/{instanceId}/`, each instance has one source JSON (`instance.json`), account-owned assets live at `accounts/{accountPublicId}/assets/`, and widget software lives under `product/widgets/`. Assume we can make breaking changes across the stack and update the current widget definitions (`tokyo/product/widgets/*`), defaults (`spec.json` -> `defaults`), and system/admin-owned local/dev instances accordingly. Prefer **strict contracts + fail‑fast** (clear errors when inputs/contracts are wrong) over “try to recover” logic. For high-impact changes, still use safety rails (feature flags, rollback switches, and data-safety checks) when a change can affect runtime behavior.

**Debugging order (when something is unclear):**

1. Runtime code + `supabase/migrations/` — actual behavior + DB schema truth
2. Deployed Cloudflare config — environment variables/bindings can differ by stage
3. `documentation/services/` + `documentation/widgets/` — operational guides (kept in sync with runtime)
4. `documentation/architecture/Overview.md` + `documentation/architecture/AssetManagement.md` + `documentation/architecture/OverlayArchitecture.md` + this file — concepts and glossary

Docs are the source of truth for intended behavior; runtime code + schema are the source of truth for what is running. Any mismatch is a P0 doc bug: update the docs immediately to match reality.

**Docs maintenance:** See `documentation/README.md`. Treat doc updates as part of the definition of done for any change that affects runtime behavior, APIs, env vars, or operational workflows.

---

## Product Truth (Read Before Coding)

Clickeen is a simple product.

The real product path is:

1. A real account owns widget instances and assets.
2. A real user in that account opens Builder in Roma.
3. Bob edits one instance of one widget type in memory.
4. Roma saves that instance to Tokyo.
5. Entitlements from the account are the only source of limits, caps, budgets, and upsell.

Non-negotiable negative truths:

- Builder is the only real authoring surface.
- Minibob is a demo/funnel surface. It may preview, collect intent, and hand off to signup. It is **not** a user, account, editor identity, policy profile, or save-capable product mode.
- Builder authoring happens on one account-owned instance in the account `baseLocale`. Translation is async follow-up work after save. Locale overlay preview is read-only inspection enabled only from the Translations panel.
- Preview must reflect the same instance the customer is editing. Preview is **not** a second widget-shaped truth.
- Invalid state must fail at the named boundary. Do not silently heal product truth into a new normal.
- Non-account/helper/demo flows may exist in code while being reduced, but they do **not** define account authoring truth.
- Admin is a normal account with broader permissions. Admin instances are normal account-owned instances and must not get a separate admin storage lane.
- Example content is a normal account-owned instance referenced from product-owned files, not a separate architecture, storage lane, API, or type model.

### Publication / Serve-State Truth

`published` / `unpublished` is intentionally narrow.

- It is **instance state**, not widget-type state.
- It is **Tokyo-owned**.
- It means only: should the generated static entry file be present for public serving right now?
- It exists to gate public serving and enforce lower-tier served-instance caps.
- It does **not** mean draft state, overlay health, translation readiness, or broad business lifecycle.
- Michael status columns may still exist in schema or route code during cutover, but they are not the surviving publish/unpublish authority.

If code cannot be explained in that model, it is suspect by default.

---

## AI-First Company Architecture

Clickeen is designed from the ground up to be **built by AI** and **run by AI**:

| Layer                     | Who/What                        | Responsibility                                            |
| ------------------------- | ------------------------------- | --------------------------------------------------------- |
| **Vision & Architecture** | 1 Human                         | Product vision, system design, taste, strategic decisions |
| **Building**              | AI Coding (Cursor, Claude, GPT) | Write code from specs and PRDs                            |
| **Operating**             | AI Agents (San Francisco)       | Sales, support, marketing, localization, ops              |

**San Francisco is the Workforce OS** — not just a feature, but the system that runs the company:

| Agent                | Role                             | Replaces            |
| -------------------- | -------------------------------- | ------------------- |
| SDR Copilot          | Convert visitors in Minibob      | Sales team          |
| Editor Copilot       | Help users customize widgets     | Product specialists |
| Support Agent        | Resolve user issues              | Support team        |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team      |
| Content Writer       | Blog, SEO, help articles         | Content team        |
| UI Translator        | Product localization             | Localization team   |
| Ops Monitor          | Alerts, incidents, monitoring    | DevOps/SRE team     |

**All agents learn automatically** — outcomes feed back into the system, improving prompts and examples over time.

See: `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`

---

## Canonical Concepts

### Widget vs Instance vs Account

**Widget** = THE SOFTWARE

- Complete functional software for a widget type (e.g. FAQ)
- Surviving repo source lives in `tokyo/product/widgets/{widgetType}/`
- Core runtime files: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, optional widget-local `widget.*.js` helpers, and `agent.md`
- Contract/metadata in the same folder (consumed by Bob/Roma/Tokyo-worker/Venice/Prague as appropriate): `catalog.json`, `spec.json`, `agent.md`, and widget-owned runtime assets. `spec.json.overlays.v = 1` owns the widget primitive variable graph used by ToolDrawer, Copilot, Babel, Bob preview, Tokyo validation, and Venice runtime. Separate l10n path lists are not product truth.
- Platform-controlled; **not stored in Michael**

**Instance** = THE ACCOUNT-OWNED DATA AND STATIC MINI-SITE SOURCE

- One saved configured widget owned by one account.
- Stored in Tokyo under the owning account at `accounts/{accountPublicId}/instances/{instanceId}/`.
- `instance.json` is the only top-level source JSON for identity, ownership, display metadata, saved config, source version, generation status, and Roma-visible publish status. There is no sibling `config.json`, `publish.json`, `embed.json`, or `translations.json`.
- Overlay objects are separate exact objects at `overlays/{overlayId}.json` under the same instance. The first/current overlay family is locale translation overlays.
- Generated browser files for the public mini-site live in the same instance folder as `index.html`, `styles.css`, and `script.js`. The canonical public URL is `https://clk.live/{accountPublicId}/{instanceId}` and maps directly to that folder. Public serving is controlled by `index.html` physical presence, not by a runtime render pointer or product-service lookup.
- `accounts/{accountPublicId}/instances/index.json` is a generated account read model for Roma navigation. It is rebuildable from instance subtrees and must not be treated as instance identity authority.
- No generated artifact is required to determine account instance identity, ownership, saved config truth, or generation status. If generated browser files are missing or stale, Roma shows that status; public serving does not synthesize a widget at request time.
- Tokyo instance indexes are prepared read models for product navigation. Hot list reads validate the index contract and must not perform full R2 integrity audits; save/publish/delete mutation paths patch one affected index entry. Full rebuild is a repair/read-missing boundary, not steady-state mutation work.
- Michael does not keep a parallel account widget instance table. Support, billing/account reporting, and audit flows must use account/user relational data plus Tokyo-owned instance documents, not a Michael `widget_instances` projection.
- Product-path account open resolves the saved authoring revision from Tokyo; instance serve-state (`published` / `unpublished`) and localization/publication truth belong in the Tokyo/Tokyo-worker plane
- On the active account authoring path, user-facing instance identity (`widgetType`, `displayName`, `source`, `meta`) is Tokyo-owned.
- Bob holds working copy in memory as `instanceData` during editing

**Account** = THE OWNERSHIP BOUNDARY

- Owns instances, assets, usage, billing, permissions, export, and deletion
- Admin is just an account with broader permissions
- Account-owned runtime truth belongs under account-first Tokyo-worker storage, not in repo folders
- Account-owned R2 storage uses `accountPublicId`, not private relational UUIDs:

```text
accounts/{accountPublicId}/
  assets/
  instances/
    index.json
    {instanceId}/
      instance.json
      index.html
      styles.css
      script.js
      overlays/
        {overlayId}.json
```

`widgetCode` may appear in `instance.json` and in `overlayId` because it is shared codebook metadata. It is never required to locate an instance in R2 storage.

**Clickeen-Owned Example Instance** = A NORMAL ACCOUNT INSTANCE USED BY PRODUCT FILES

- A normal account-owned instance under the Clickeen admin account.
- Prague may embed it by writing `accountInstanceRef.instanceId` in page JSON.
- Roma may duplicate it only through explicit product-owned catalog/reference data.
- The instance itself must not contain global distribution flags such as `visibleInRoma`, `listed`, or `duplicable`.
- There is no surviving separate preset model, route authority, folder authority, or type authority.

### Product-Path Account Editing (Current PRD 61 Cutover)

Core account editing currently uses direct app-owned read/write paths for the one widget document Builder edits:

For the 075 authoring simplification track, this account-mode Roma -> Bob -> Tokyo chain is the governing authoring path; non-account/helper flows do not define account authoring truth.

1. **Open core instance**: `GET /api/builder/:instanceId/open` once per Roma Builder open. Roma resolves the active account from the signed bootstrap capsule, loads one saved authoring envelope from Tokyo through the private product-control binding, and then sends Bob one `ck:open-editor` payload. Builder open is an authoring boundary: it requires the saved widget config and account authorization, not publish/serve state. Publish/unpublish state remains owned by Tokyo's serve-state flows and must not block opening an unpublished widget for editing.
2. **Save**: `PUT /api/account/instances/:instanceId` when the editor saves. Roma validates the account request, then calls one Tokyo-worker save transition for that existing instance. Tokyo-worker verifies the saved document, rejects widget-type mismatch, preserves omitted display metadata, writes the saved config, reads its own publish state, and returns base-save success. Translation/Babel follow-up is orchestrated by Roma + San Francisco after the save boundary; Tokyo-worker does not queue or generate translations.
3. **Widgets list + rename identity**: Roma reads user-instance identity for `/widgets` from Tokyo saved documents. The surviving publish/unpublish authority is Tokyo's per-instance serve flag, not a Michael status row. Rename writes that Tokyo identity directly instead of patching Michael `display_name`.
4. **Create/duplicate**: account instance creation is a Tokyo-owned storage verb. Roma sends account create or duplicate intent, Tokyo-worker mints the compact 10-character uppercase base36 instance ID, sources create config from the current widget definition defaults or duplicate config from the existing saved document, writes the account instance documents, and returns the new instance to Roma. Roma does not mint IDs or run compensation cleanup for Tokyo-owned duplicate state.
5. **Authz**: browser requests prove the Roma session with httpOnly session cookies. Roma stores the signed account authz capsule in a server-owned httpOnly cookie, validates it on current-account API routes, and forwards that capsule only on Roma-to-Tokyo private service calls. Browser JavaScript must not read or replay `x-ck-authz-capsule`. Active product routes do not re-read account membership or recompute policy on each open/save call; the signed capsule carries stable authz truth, while live mutable counters are enforced at the canonical owner when needed.
6. **Babel/live follow-up**: translation and locale convergence remain downstream work owned outside Bob. Product-path save triggers the product orchestration boundary that creates new locale overlay IDs from the current saved primitive graph.

On the real product path, editor routes are account-mode routes. If non-account/demo/helper route shapes still exist in code while being reduced, they do not define shared editor semantics or account authoring truth. On `account` product routes, policy/entitlement truth comes from Roma's server-owned account authz capsule.

In the browser the active account-mode host path is:

- Roma host path: host fetches one Builder-open envelope through its same-origin route, then sends Bob one `ck:open-editor` message. Save delegates back to the Roma host and stays on the product same-origin route family.

Bob does not URL-bootstrap account mode. Account editing is host-only.

Babel is separate from Builder authoring: Berlin-backed Roma Settings owns account locale policy, and translation/runtime locale convergence happens downstream from the one widget save path. Each widget declares text primitives in `spec.json.overlays.text[]`; producers receive only concrete primitive paths extracted from the saved config, such as `sections.0.faqs.0.question`.
For account-widget locales, Roma orchestrates product work, San Francisco translates concrete text primitive values, and Tokyo-worker acts as the PBX: validate `overlayId`, write exact overlay objects, and read exact overlay objects under the owning instance `overlays/` folder. Tokyo-worker does not infer product meaning from overlay bodies and does not repair data it produced.
Builder translation preview is account-authenticated read-only inspection with split authority. Roma shows the account setup summary from real account context: base locale, plan translation allowance, and active account translations. Bob's preview dropdown is backed only by actual locale overlay files in Tokyo/R2 under the current instance `overlays/` folder. Roma may authenticate and pass storage reads through to Tokyo, but it must not call Berlin or synthesize desired-locale availability for the dropdown. Bob applies one exact overlay value map over the current in-memory base state with the shared resolver before posting state to the preview iframe. If an overlay file does not exist, that locale is absent from the dropdown. Unpublished Builder preview must not depend on public Venice/Tokyo locale URLs, because public serving is controlled by generated static file presence.

Between open and save:

- Base config edits happen in Bob's React state (in memory)
- Preview updates via postMessage
- Core account instance open stays on Roma/Bob/Tokyo product routes
- Core account instance persistence stays on Roma/Bob/Tokyo product routes
- ZERO database writes for base config during normal product open/save
- Base config is not required to be English; Builder authors the account `baseLocale`, and translation to other locales is async follow-up work after save while overlay preview remains read-only inspection.
- No demo/non-account surface writes durable account widget truth.
- Overlay resolution is always `baseConfig + one overlayValues` in PRD 098. Multi-layer precedence is out of scope until a later PRD specifies it.

**Why:** 10,000 users editing simultaneously = no server load for base config. Babel writes scoped overlay objects, enabling async translation while preserving user edits. Millions of landing page visitors = zero DB pollution until signup + publish.

### Key Terms

| Term           | Description                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `instanceId`   | Compact 10-character uppercase base36 instance identifier minted by Tokyo-worker                         |
| `widgetType`   | Human/product widget identifier referencing the definition (e.g., "faq")                                 |
| `widgetCode`   | 3-character widget code from the shared PRD 098 codebook, used in overlay IDs and metadata/codebook identity; never an R2 storage locator |
| `accountPublicId` | 8-character account product/storage identity from Michael/Berlin account truth                       |
| `config`       | Persisted base instance values; active product account reads/writes use Tokyo's saved authoring snapshot |
| `instanceData` | Working copy of config in Bob during editing                                                             |
| `spec.json`    | Defaults + structured Builder editor contract (`editor.panels`); compiled by Bob                         |
| `spec.json.overlays` | Widget-owned primitive variable graph; Babel v1 text primitives are declared here and extracted to concrete paths |
| `agent.md`     | AI contract documenting editable paths and semantics                                                     |

### Clickeen-Owned Examples

**Clickeen does not have a separate gallery-preset content model.**

How it works:

1. Clickeen authors example instances in Builder under the admin account.
2. Those instances are normal account-owned instances with compact generated instance IDs.
3. Prague embeds them with `accountInstanceRef.instanceId` in `tokyo/prague/pages/**`.
4. Roma can offer some of them to users through product-owned catalog/reference data outside the instance document.
5. A user copy creates a new instance under the destination account.

Why:

- One editor: Clickeen and users author through the same Builder path.
- One storage model: admin examples live under the admin account like every other account-owned instance.
- No hidden distribution metadata: global/platform decisions stay out of normal customer instance data.
- Future marketplace-compatible: a creator can later be another account whose instances are referenced from catalog data.

Publishing semantics: `published` / `unpublished` is a Tokyo instance serve-state concept. It means only whether Venice may serve that instance publicly.

---

## Systems

| System            | Purpose                                                                         | Runtime                         | Repo Path       |
| ----------------- | ------------------------------------------------------------------------------- | ------------------------------- | --------------- |
| **Prague**        | Marketing site + gallery + demo/funnel surfaces                                 | Cloudflare Pages                | `prague/`       |
| **Bob**           | Account Builder editor runtime; the real widget authoring UI                    | Cloudflare Pages (Next.js)      | `bob/`          |
| **Roma**          | Current-account product shell + Builder host orchestration                      | Cloudflare Pages (Next.js)      | `roma/`         |
| **DevStudio**     | Internal toolbench for platform curation, verification, and local utility pages | Local Vite toolbench            | `admin/`        |
| **Venice**        | Legacy embed runtime being removed by PRD 100                                   | Cloudflare Pages (Next.js Edge) | `venice/`       |
| **San Francisco** | AI Workforce OS (agents, learning)                                              | Workers (D1/KV/R2/Queues)       | `sanfrancisco/` |
| **Michael**       | Database                                                                        | Supabase Postgres               | `supabase/`     |
| **Dieter**        | Design system                                                                   | Build artifacts in Tokyo        | `dieter/`       |
| **Tokyo**         | Account storage, static mini-site bytes, assets & CDN                           | Cloudflare R2                   | `tokyo/`        |
| **Tokyo Worker**  | Account-owned asset uploads + instance source/overlay storage                    | Cloudflare Workers + R2         | `tokyo-worker/` |
| **Atlas**         | Edge config cache (read-only)                                                   | Cloudflare KV                   | —               |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, opens account instances through same-origin routes backed by Tokyo saved authoring state, and saves by writing Tokyo's saved revision directly. Bob does not own serve-state changes; publish/unpublish toggles the Tokyo instance serve flag from Roma widgets-domain flows, and Builder open must not require that serve-state in order to edit a saved widget. Bob is the real account authoring UI. Shared Bob code must model the account Builder product path, not preserve demo/funnel identities as co-equal editor modes. Copilot browser entrypoint is `POST /api/ai/widget-copilot`, and Roma resolves widget identity server-side from the instance being edited.

**Roma** — Product shell and account experience. Domain-driven app (`/home`, `/widgets`, `/builder`, etc.) that resolves account context through `/api/bootstrap`, keeps session and account authz in httpOnly cookies, opens Bob by waiting for `bob:session-ready` and sending one `ck:open-editor` payload, reads core account instance state through same-origin routes backed by Tokyo saved authoring state, and saves that one widget document back through the same account boundary. Browser JavaScript does not own the raw account authz capsule; Roma server code validates it and forwards it to Tokyo over private service bindings. Roma's authed shell owns account bootstrap, auth-required redirect, account-context failure, and the ready account context exposed to domains; individual domain pages must not render their own account-loading, account-error, no-account, or default fake account states. On the active Widgets/Builder path, Roma treats Tokyo as the user-facing instance identity owner and canonical instance serve-state owner. Michael may still carry registry/status residue during cutover, but it is not the surviving publish/unpublish authority. In product terms, `Save` is one handoff of the instance to Tokyo-worker so Tokyo-worker can reconcile the instance and its derived artifacts. `Publish` / `Unpublish` remains the separate Widgets-domain action that flips whether Venice may publicly serve that instance. Current Roma is a single-current-account customer shell and does not expose customer account switching. Roma is the real account/product boundary for Builder. It must not model a fake anonymous editor/account mode inside shared account truth. In cloud-dev, this still usually collapses to one effective account: the seeded platform-owned account.

**DevStudio** — Internal toolbench. It is where Clickeen runs internal platform work such as widget curation, verification, and small local utility pages. The old local DevStudio widget-authoring lane is removed. DevStudio must not invent a second account or provider truth model and it must not become a generic customer-account browser.

**Venice** — Legacy SSR embed runtime being removed by PRD 100. It is not the surviving public serving plane. The surviving model is static mini-site delivery from Tokyo at `https://clk.live/{accountPublicId}/{instanceId}`; browser requests must receive generated files, not Venice-computed widget HTML.

**San Francisco** — AI Workforce Operating System. Runs customer copilots and internal system agents such as Builder Copilot, Widget Instance Translator, and Prague Copy Translator. Manages agent sessions, learning pipelines, and prompt evolution. See `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores account/user data, submissions, usage events, and relational support records. It does not store account widget instance source or projection tables. RLS is enforced for user/account tables, while widget instance inventory, editable config, display name, publish state, and example availability are Tokyo-owned.

**Tokyo** — Account storage and CDN. Hosts product static resources, widget software, Roma/Prague owned static resources, account-owned instance mini-sites, overlays, and account-owned uploaded files. Runtime-managed account data lives only under `accounts/{accountPublicId}/`; git-authored product resources live under `product/`, `dieter/`, `fonts/`, and `prague/`.

**Tokyo Worker** — Cloudflare Worker that serves account asset references from `accounts/{accountPublicId}/assets/{assetRef}`, exposes private Roma-bound asset and product-control routes over Cloudflare service bindings, validates overlay IDs, stores exact overlay value objects under the owning instance, and writes the one `instance.json` source package for Bob/Roma/San Francisco. Tokyo-worker is a PBX/control-plane switchboard: it routes storage operations and must not orchestrate San Francisco, infer product meaning from overlay bodies, or render public widgets at request time.

**Asset URL contract (pre-GA strict):**

- Full canonical contract: [AssetManagement.md](./AssetManagement.md)
- Fill/media authoring config now stores account asset references (`assetRef`, optional `posterAssetRef`) while runtime/materialized config packs resolve those refs to canonical root-relative paths: `/assets/account/{accountPublicId}/{assetRef}`. The backing R2 object lives under `accounts/{accountPublicId}/assets/{assetRef}`.
- Logo/media authoring surfaces use the same split: uploaded logos persist `asset.assetRef` plus editor metadata, while runtime consumes only the materialized `logoFill`.
- Persisted legacy media URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`, and persisted account-asset URL backed `logoFill` strings) are outside contract and rejected on write.
- Legacy non-account media paths are outside the runtime contract and are rejected on new writes.
- `DELETE` on an account asset is synchronous in the delete path with no instance rebuild/healing side effects; subsequent `/assets/account/**` reads return unavailable.
- Runtime does not rely on `CK_ASSET_ORIGIN`; asset paths remain canonical root-relative and environment portability is provided by Bob/Venice proxy routes.
- Legacy host-pinned/legacy paths (for example `/curated-assets/**`) are not supported.

**Dieter** — Design system. Tokens (spacing, typography, colors), 16+ components (toggle, textfield, dropdown-fill, object-manager, repeater, dropdown-edit, etc.), icons. Output is CSS + HTML. Each widget only loads what it needs.

**Atlas** — Cloudflare KV. Read-only runtime cache. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.

**agent.md** — Per-widget AI contract. Documents editable paths, parts/roles, enums, and safe list operations. Required for AI editing.

---

## Widget Architecture

### Tokyo Widget Folder Structure

```
tokyo/product/widgets/{widgetType}/
├── spec.json          # Defaults + structured Builder editor contract
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
├── agent.md           # AI contract (required for AI editing)
├── catalog.json       # Widget catalog metadata
└── limits.json        # Entitlements caps/flags consumed by shared policy enforcement
```

Prague marketing/showcase page source is not widget software and belongs under `tokyo/prague/pages/{widgetType}/`.

### Shared Runtime Modules

All widgets use shared modules from `tokyo/product/widgets/shared/`:

| Module          | Global                                                                        | Purpose                                                                          |
| --------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `fill.js`       | `CKFill.toCssBackground(fill)` / `CKFill.toCssColor(fill)`                    | Resolve fill configs (color/gradient/image/video) to CSS                         |
| `header.js`     | `CKHeader.applyHeader(state, widgetRoot)`                                     | Shared header (title/subtitle/CTA) behavior + CSS vars                           |
| `surface.js`    | `CKSurface.applyCardWrapper(cardwrapper, scopeEl)`                            | Shared card wrapper vars (border/shadow/radius + inside-shadow layer placement)  |
| `stagePod.js`   | `CKStagePod.applyStagePod(stage, pod, scopeEl)`                               | Stage/pod layout (background, padding, radius, alignment)                        |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig, runtimeContext?)` | Typography roles with dynamic Google Fonts + locale/script-aware fallback stacks |
| `branding.js`   | _(self-executing)_                                                            | Injects "Made with Clickeen" badge + reacts to state updates                     |

### Stage/Pod Architecture

- **Stage** = host backdrop (container surrounding the widget)
- **Pod** = widget surface (actual widget container)
- All widgets use `.stage > .pod > [data-ck-widget]` wrapper structure
- Layout options: stage canvas mode (`wrap`/`viewport`/`fixed`), background (fill picker), padding per device (`desktop` + `mobile`, linked or per-side), corner radius (linked or per-corner), pod width mode (wrap/full/fixed), pod alignment, and optional floating overlay placement (`stage.floating.enabled|anchor|offset`) for widgets that opt in

### Compiler Modules

Bob's compiler (`bob/lib/compiler/`) auto-generates shared functionality:

**Auto-generated from `defaults` declarations:**

- **Typography Panel** — If `defaults.typography.roles` exists, generates font family, size preset, custom size, style, and weight controls per role
- **Stage/Pod Layout Panel** — If `defaults.stage`/`defaults.pod` exists, injects pod width, alignment, padding, radius controls
- **Panel Grouping** — Layout clusters are normalized to `Widget layout`, `Item layout`, `Pod layout`, and `Stage layout` (when applicable). Surface clusters in Appearance are split into `Stage appearance` and `Pod appearance` (instead of a mixed Stage/Pod block).

**Curated Typography:**

- 18 curated Google Fonts with weight/style specifications
- Font picker grouped by family category (`Sans`, `Serif`, `Display`, `Script`, `Handwritten`) with usage badges (`Body-safe`, `Heading-only`)
- Dynamic loading via `CKTypography.applyTypography()`
- Locale/script fallback is class-aware (`sans` vs `serif`) for CJK/Arabic/Hebrew/Thai/Devanagari/Bengali/Cyrillic; CJK applies script-first stacks and script-tuned normal line-height defaults
- Role-based size presets (xs/s/m/l/xl/custom)
- Canonical role scales are enforced globally for shared roles (`title`, `body`, `section`/Eyebrow, `question`/Item title, `answer`/Item body, `button`) so existing and new instances stay aligned.

---

## Ops Protocol

Edits are expressed as ops (no direct mutation):

```typescript
type WidgetOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "insert"; path: string; index: number; value: unknown }
  | { op: "remove"; path: string; index: number }
  | { op: "move"; path: string; from: number; to: number };
```

All ops are validated against `compiled.controls[]` allowlist. Invalid ops are rejected fail-closed.

---

## Localization (Layered)

Locale is a runtime parameter and must not be encoded into instance identity (`instanceId`). Locale is encoded in PRD 098 overlay IDs because overlays are SKU-like value objects, not base instance identity.

- Roma/account product UI strings live under `tokyo/roma/i18n/**` and are served through Tokyo as product UI catalogs.
- Prague marketing/showcase copy and localization source live under `tokyo/prague/**`.
- Instance/content translation truth is the first PRD 098 overlay application. Public embeds read only public projections that point to exact `overlayId` values and exact overlay value objects.
- There is no repo-authored admin l10n lane and no repo-local instance overlay truth.
- Canonical overlay truth for instances is PRD 098: fixed-layout `overlayId`, body `{ v, values }`, no body status/readiness/hash identity, and no compatibility bridge to old l10n overlay paths.
- The widget primitive graph in `spec.json.overlays.text[]` is the only source for translatable account-widget paths. No widget `localization.json`, layer path sidecar, wildcard path schema, or text-pack schema survives.

Canonical reference:

- `documentation/architecture/OverlayArchitecture.md`
- `documentation/capabilities/localization.md`

---

## Current Implementation Status

### Systems

| System  | Status    | Notes                                                                                                         |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Bob     | ✅ Active | Compiler, ToolDrawer, Account, Ops engine                                                                     |
| Roma    | ✅ Active | Domain shell, account bootstrap, widgets/builder orchestration                                                |
| Tokyo   | ✅ Active | FAQ widget with shared modules                                                                                |
| Venice  | ✅ Active | SSR embed runtime (published-only), loader, asset proxy (usage/submissions are stubbed in this repo snapshot) |
| Dieter  | ✅ Active | 16+ components, tokens, typography                                                                            |
| Michael | ✅ Active | Supabase Postgres with RLS                                                                                    |

### Widgets

| Widget        | Status    | Components Used                                                                                                                                       |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FAQ           | ✅ Active | See `tokyo/product/widgets/faq/spec.json` (object-manager, repeater, dropdown-edit, toggle, textfield, dropdown-fill, dropdown-actions, choice-tiles) |
| Countdown     | ✅ Active | See `tokyo/product/widgets/countdown/spec.json`                                                                                                       |
| Logo Showcase | ✅ Active | See `tokyo/product/widgets/logoshowcase/spec.json`                                                                                                    |

### Dieter Components

`bulk-edit`, `button`, `choice-tiles`, `dropdown-actions`, `dropdown-border`, `dropdown-edit`, `dropdown-fill`, `dropdown-shadow`, `dropdown-upload`, `icon`, `menuactions`, `object-manager`, `popover`, `popaddlink`, `repeater`, `segmented`, `slider`, `tabs`, `textedit`, `textfield`, `textrename`, `toggle`, `valuefield`

---

## Working with Code

**Before making changes:**

- Read `documentation/strategy/WhyClickeen.md` (strategy/vision)
- Read `documentation/architecture/Overview.md` (system boundaries)
- Read the relevant system doc (`documentation/services/{system}.md` or `documentation/services/prague/*.md`; San Francisco: `documentation/ai/*.md`)

**Build & Dev:**

```bash
pnpm install                    # Install dependencies
pnpm build:dieter               # Build Dieter media first
pnpm build                      # Build all packages

# Development
bash scripts/dev-up.sh          # Canonical local DevStudio operating lane (Tokyo/Tokyo-worker/Berlin/Bob/DevStudio)
pnpm dev:bob                    # Bob only
pnpm dev:admin                  # DevStudio only

# Quality
pnpm lint && pnpm typecheck
pnpm test
```

Runtime profile contract: `documentation/architecture/RuntimeProfiles.md`

**Agent-run terminal limitation (important):**

- Long-lived local servers started by an AI agent through a managed command session may be reaped when that session ends.
- This is a limitation of the agent execution environment, not of a normal VS Code terminal.
- If you need the full local stack to stay up for real browser use, run `bash scripts/dev-up.sh --reset` yourself in your own terminal.

**Local instance data (important):**

- Instances are **not** created by scripts anymore.
- Supported product/account instance create/edit flows run in **cloud-dev Roma** (`https://roma.dev.clickeen.com`) per PRD 54.
- Local DevStudio is the local internal toolbench, not “local Roma” parity.
- That local verification scope currently centers on seeded platform state and local translation/runtime checks.

**Local auth target (important):**

- `bash scripts/dev-up.sh` uses local Supabase.
- Berlin runs locally at `http://localhost:3005` for parity/unit work, but supported product auth happens in cloud Roma.
- Berlin session token issuer must match the Berlin issuer configured for the active auth surface; mismatched issuers are rejected with `coreui.errors.auth.forbidden` and `issuer_mismatch`.

### Environments (Canonical)

| Environment                 | Bob                            | Roma                            | Tokyo                            | San Francisco                           | DevStudio                |
| --------------------------- | ------------------------------ | ------------------------------- | -------------------------------- | --------------------------------------- | ------------------------ |
| **Local**                   | `http://localhost:3000`        | `https://roma.dev.clickeen.com` | `http://localhost:4000`          | `—`                                     | `http://localhost:5173`  |
| **Cloud-dev (from `main`)** | `https://bob.dev.clickeen.com` | `https://roma.dev.clickeen.com` | `https://tokyo.dev.clickeen.com` | `https://sanfrancisco.dev.clickeen.com` | `— local only`           |
| **UAT**                     | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |
| **Limited GA**              | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |
| **GA**                      | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |

UAT / Limited GA / GA are **release stages** (account-level exposure controls), not separate infrastructure.

Pages deploy rule:

- `bob`, `roma`, `venice`, and `prague` deploy through **Cloudflare Pages Git build only**.
- GitHub Actions may verify Pages build contracts, but are not the Pages deploy plane and must not create Pages projects, sync Pages secrets, or deploy Pages artifacts.
- The manual Pages project/env/host contract is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts in cloud-dev; `*.pages.dev` is not a valid authenticated Builder runtime host.

### Deterministic compilation contract (anti-drift)

- **Dieter bundling manifest (authoritative)**: `tokyo/product/dieter/manifest.json` after PRD 79 Phase 1 (public `/dieter/**` can remain a serving route)
- **Widget catalog manifest (generated)**: `tokyo/product/widgets/manifest.json`, built from widget-owned `catalog.json` + `spec.json` by `scripts/build-widget-catalog.mjs`; Tokyo-worker consumes the manifest and generated SEO/GEO registry instead of hand-registering widgets. Prague may read this generated manifest for public widget labels, and unknown widget labels must fail at the page/content boundary rather than falling back to slug title-casing.
- **Rule**: ToolDrawer `type="..."` drives required bundles; CSS classnames never add bundles.
- **Verification plane**: compilation discipline is enforced through repo typecheck/build and Cloudflare verification, not a localhost Bob HTTP gate.

**Key Discipline:**

- Runtime code + DB schema are truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.
