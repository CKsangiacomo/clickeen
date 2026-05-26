# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `documentation/strategy/WhyClickeen.md`.

PRD 103 NOTE: PRD 103 product execution is blocked until the DB pivot and PRD 103K translation sync repair are green. Active authority is `Execution_Pipeline_Docs/01-Planning/103__PRD__Saved_Instance_Localization_Runtime.md`, `Execution_Pipeline_Docs/02-Executing/103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`, and `Execution_Pipeline_Docs/01-Planning/103K__PRD__Saved_Base_Content_Translation_Sync.md`. Operational application state belongs in Supabase, public served artifacts belong in Cloudflare R2/CDN, and publish/materialization is the bridge. Translation sync belongs to the current saved base content marker, not job lineage.

**PRE-GA / AI iteration contract (read first):** Clickeen is **pre-GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions, Roma account Builder, Tokyo account instance operations, and San Francisco agents). This does **not** mean "take shortcuts" -- build clean, scalable primitives and keep the architecture disciplined. It does mean: avoid public-facing backward compatibility shims, long-lived migrations, ad-hoc fallback behavior, defensive edge-case handling, or multi-version support unless a PRD explicitly requires it. Product services speak product-operation vocabulary. Storage objects, generated files, queues, and R2 paths may exist only as implementation details behind those operations. Assume we can make breaking changes across the stack and update current widget definitions, starter/admin-owned instances, and dev data accordingly. Prefer **strict contracts + fail-fast** over "try to recover" logic. For high-impact changes, still use safety rails when runtime behavior or customer data can be affected.

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
- Builder authoring happens on one account-owned instance in the account `baseLocale`. Translation is async follow-up work for a saved source instance and starts from the Translations panel Generate action. Translated-locale preview is read-only inspection enabled only from the Translations panel.
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
- Core runtime files: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, and optional widget-local `widget.*.js` helpers.
- Contract/metadata in the same folder (consumed by Bob/Roma/Tokyo-worker/Prague as appropriate): `catalog.json`, `spec.json`, `editable-fields.json` where present, `limits.json`, and widget-owned runtime assets. `agent.md` is deleted widget source; do not use it as schema, guidance, or publish input.
- Platform-controlled; **not stored in Michael**

**Instance** = THE ACCOUNT-OWNED WIDGET SOURCE AND PUBLIC ARTIFACT INPUT

- One saved configured widget owned by one account.
- Tokyo owns instance product operations for `accountPublicId + instanceId`: list, open, save, rename, create, duplicate, delete, generate translations, read/write translated locale values, publish, and unpublish.
- Source is split by product meaning:
  - `instance.config.json` carries non-text settings, structure, style, behavior, identity/display metadata, widget type/code, base locale, target locales, and timestamps.
  - `instance.content.json` carries user-visible base text in the same editable paths Bob exposes, current translated locale values, plus `ok` / `changed` status for translation pickup.
- `instance.json` is not a product source authority and is not written or read by active runtime code.
- Translated locale values are addressed by `instanceId + locale` at product boundaries. Tokyo may persist exact value maps privately; Bob, Roma, and San Francisco must not use overlay IDs or storage paths as locale identity.
- Public browser files such as `index.html`, versioned CSS/JS support files, and `{locale}.html` are generated artifacts. They are output of publish/materialization, not authoring truth and not product publish state.
- Publish status is Tokyo-owned product state. Public serving reads R2/CDN artifacts only; publish/unpublish and tier-serving operations materialize or remove those artifacts from product state and policy.
- `accounts/{accountPublicId}/instances/index.json` is not product truth and is not read by active runtime code.
- Michael does not keep a parallel account widget instance table. Support, billing/account reporting, and audit flows must use account/user relational data plus Tokyo-owned instance product operations.
- Bob holds the working copy in memory during editing and sends changes back through Roma/Tokyo product routes.

**Account** = THE OWNERSHIP BOUNDARY

- Owns instances, assets, usage, billing, permissions, export, and deletion
- Admin is just an account with broader permissions
- Account-owned runtime truth belongs under account-first Tokyo-worker storage, not in repo folders
- Account-owned R2 storage uses `accountPublicId`, not private relational UUIDs:

```text
accounts/{accountPublicId}/
  assets/
  instances/
    {instanceId}/
      instance.config.json       # approved non-text source + identity/display/locale metadata
      instance.content.json      # approved base user-visible text source + translated values + translation pickup status
      index.html                 # generated public artifact
      styles.v{n}.css            # generated public artifact
      styles.css                 # generated public alias
      script.v{n}.js             # generated public artifact
      script.js                  # generated public alias
      {locale}.html              # generated public artifact
      script.v{n}.{locale}.js    # generated public artifact
      script.{locale}.js         # generated public alias
      translated-locale-values/  # private implementation shape; not product vocabulary
```

`widgetCode` may appear in instance metadata because it is shared codebook metadata. It is never required to locate an instance in R2 storage.

**Clickeen-Owned Example Instance** = A NORMAL ACCOUNT INSTANCE USED BY PRODUCT FILES

- A normal account-owned instance under the Clickeen admin account.
- Prague may embed it by writing `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId` in page JSON. A locale may be passed only as a public artifact selector for `/{locale}.html`; Prague must not discover account-widget locale availability or read private translation state.
- Roma may duplicate it only through explicit product-owned catalog/reference data.
- The instance itself must not contain global distribution flags such as `visibleInRoma`, `listed`, or `duplicable`.
- There is no surviving separate preset model, route authority, folder authority, or type authority.

### Product-Path Account Editing (Current PRD 61 Cutover)

Core account editing currently uses direct app-owned read/write paths for the one widget document Builder edits:

For the 075 authoring simplification track, this account-mode Roma -> Bob -> Tokyo chain is the governing authoring path; non-account/helper flows do not define account authoring truth.

1. **Open core instance**: `GET /api/builder/:instanceId/open` once per Roma Builder open. Roma resolves the active account from the signed bootstrap capsule, loads one account instance authoring envelope from Tokyo through the private product-control binding, and then sends Bob one `ck:open-editor` payload. Builder open is an authoring boundary: it requires approved instance config/content and account authorization, not public artifact availability.
2. **Save**: `PUT /api/account/instances/:instanceId` when the editor saves. Roma validates the account request, then calls one Tokyo-worker save transition for that existing instance. Tokyo-worker verifies the account instance, rejects widget-type mismatch, preserves omitted display metadata, writes approved config/content, marks changed content fields for translation pickup, and returns base-save success. Save does not generate translations.
3. **Widgets list + rename identity**: Roma reads user-instance identity for `/widgets` through `listAccountInstances`. The surviving publish/unpublish authority is Tokyo publish status, not a Michael status row and not an account index file. Rename writes that Tokyo identity directly instead of patching Michael `display_name`.
4. **Create/duplicate**: account instance creation is a Tokyo-owned product operation. Roma sends account create or duplicate intent, Tokyo-worker mints the compact 10-character uppercase base36 instance ID, sources new-instance content from the approved starter/default source for that widget, or duplicates config/content from an existing account instance, writes the account instance source, and returns the new instance to Roma. Roma does not mint IDs or run compensation cleanup for Tokyo-owned duplicate state.
5. **Authz**: browser requests prove the Roma session with httpOnly session cookies. Roma stores the signed account authz capsule in a server-owned httpOnly cookie, validates it on current-account API routes, and forwards that capsule only on Roma-to-Tokyo private service calls. Browser JavaScript must not read or replay `x-ck-authz-capsule`. Active product routes do not re-read account membership or recompute policy on each open/save call; the signed capsule carries stable authz truth, while live mutable counters are enforced at the canonical owner when needed.
6. **Translations**: translation generation is an explicit Translations-panel product command after base content is saved. Roma calls Tokyo's generate operation; Tokyo resolves current saved instance content, editable field contracts, target locales, existing translated values, and changed/missing fields, then derives the saved base content marker that owns translation sync. PRD 103J governs the generic widget translation target: every widget with authored customer-visible text in `editable-fields.json` must use the same product path. PRD 103K governs sync: repeated Generate for the same active marker returns the active operation, Generate is disabled while current-marker generation is active, and completions apply only when the returned marker still matches the current saved base content. The product result is translated locale values by locale plus Tokyo-owned liveness state. Bob must not infer generation status from local spinner state, queue messages, or translated-locale inventory alone. Tokyo generation truth must not be forced back into an active state by stale registry projection; a generation that never receives terminal San Francisco callbacks must become failed, not poll forever.

On the real product path, editor routes are account-mode routes. If non-account/demo/helper route shapes still exist in code while being reduced, they do not define shared editor semantics or account authoring truth. On `account` product routes, policy/entitlement truth comes from Roma's server-owned account authz capsule.

In the browser the active account-mode host path is:

- Roma host path: host fetches one Builder-open envelope through its same-origin route, then sends Bob one `ck:open-editor` message. Save delegates back to the Roma host and stays on the product same-origin route family.

Bob does not URL-bootstrap account mode. Account editing is host-only.

Babel/translation is separate from Builder authoring: Roma Settings owns account locale policy, and translation/runtime locale convergence happens after base content is saved. Widgets declare customer-visible translation fields in `tokyo/product/widgets/{widgetType}/editable-fields.json`; producers receive only concrete primitive paths extracted from `instance.content.json`, such as `sections.0.faqs.0.question`.
For account-widget locales, Tokyo owns the generate/read/write/complete translated-locale operations. San Francisco translates concrete text primitive values. Tokyo validates and stores exact translated value maps by locale. Tokyo-worker does not expose storage object IDs as product identity and does not repair data it produced.
Tokyo also owns translation generation liveness state. A Generate click is real only when Tokyo accepts current-marker work or returns the already active current-marker operation. San Francisco must report terminal locale outcomes back to Tokyo; San Francisco telemetry, stale registry projection, and Bob local state are not product job truth. Active generation state must have a backend liveness cutoff so a missing consumer or failed callback cannot trap the product in `queued` or `running`.
Translated-locale readiness requires every editable content path to have both locale status `ok` and a string translated value. A status marker without a string is invalid partial state: Tokyo treats it as missing, Generate picks it up, and completion writes status and value together.
Builder translation preview is account-authenticated read-only inspection. Roma shows the account setup summary from real account context: base locale, plan translation allowance, and active account translations. Bob's preview dropdown is backed by translated locale summaries from Tokyo through Roma, not overlay file inventories. Bob reads translated values by locale, applies one exact value map over the current in-memory base state with the shared resolver, and posts the resolved preview state to the widget iframe. If translated values for a locale do not exist, that locale is absent from the dropdown. Unpublished Builder preview must not depend on public `clk.live` locale URLs.

Between open and save:

- Base config/content edits happen in Bob's React state (in memory)
- Preview updates via postMessage
- Core account instance open stays on Roma/Bob/Tokyo product routes
- Core account instance persistence stays on Roma/Bob/Tokyo product routes
- ZERO database writes for base config during normal product open/save
- Base content is not required to be English; Builder authors the account `baseLocale`, and translation to other locales is async work triggered from the Translations panel while translated-locale preview remains read-only inspection.
- No demo/non-account surface writes durable account widget truth.
- Translation preview resolution is always base instance state plus one translated locale value map. Multi-layer precedence is out of scope until a later PRD specifies it.

**Why:** 10,000 users editing simultaneously = no server load for base config. Translation writes current locale values onto instance content fields after explicit Generate work, preserving base edits without creating a second widget truth. Millions of landing page visitors = zero DB pollution until signup + publish.

### Key Terms

| Term           | Description                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `instanceId`   | Compact 10-character uppercase base36 instance identifier minted by Tokyo-worker                         |
| `widgetType`   | Human/product widget identifier referencing the definition (e.g., "faq")                                 |
| `widgetCode`   | 3-character widget code from the shared widget codebook, used as metadata/codebook identity; never an R2 storage locator |
| `accountPublicId` | 8-character account product/storage identity from Michael/Berlin account truth                       |
| `config`       | Persisted non-text instance settings, structure, style, behavior, identity/display, and locale metadata |
| `content`      | Persisted base user-visible text values for the instance; translation input and status live here |
| `instanceData` | Working copy of config/content in Bob during editing                                                     |
| `spec.json`    | Defaults + structured Builder editor contract (`editor.panels`); compiled by Bob                         |
| `editable-fields.json` | Widget-owned editable/translatable field declaration where customer-visible text exists; PRD 103J governs generic widget translation, while FAQ remains a required fixture for repeated-field proof |

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

Publishing semantics: `published` / `unpublished` is Tokyo-owned instance product state. It means only whether `clk.live` may serve generated public artifacts for that instance.

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
| **Tokyo Worker**  | Account-owned asset uploads, instance operations, translated locale values, and public artifact materialization | Cloudflare Workers + R2         | `tokyo-worker/` |
| **Atlas**         | Edge config cache (read-only)                                                   | Cloudflare KV                   | —               |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance config/content in state, syncs preview via postMessage, opens account instances through same-origin routes backed by Tokyo account instance operations, and saves through Roma/Tokyo. Bob does not own publish state, translation generation, or public artifact readiness. Bob is the real account authoring UI. Shared Bob code must model the account Builder product path, not preserve demo/funnel identities as co-equal editor modes. Copilot browser entrypoint is `POST /api/ai/widget-copilot`, and Roma resolves widget identity server-side from the instance being edited.

**Roma** — Product shell and account experience. Domain-driven app (`/home`, `/widgets`, `/builder`, etc.) that resolves account context through `/api/bootstrap`, keeps session and account authz in httpOnly cookies, opens Bob by waiting for `bob:session-ready` and sending one `ck:open-editor` payload, reads account instance state through same-origin routes backed by Tokyo product operations, and saves that one widget instance back through the same account boundary. Browser JavaScript does not own the raw account authz capsule; Roma server code validates it and forwards it to Tokyo over private service bindings. Roma's authed shell owns account bootstrap, auth-required redirect, account-context failure, and the ready account context exposed to domains; individual domain pages must not render their own account-loading, account-error, no-account, or default fake account states. On the active Widgets/Builder path, Roma treats Tokyo as the user-facing instance identity, translated locale value, publish state, and public artifact owner. Michael may still carry registry/status residue during cutover, but it is not the surviving publish/unpublish authority. In product terms, `Save` writes approved instance config/content; `Generate translations` asks Tokyo to queue missing/changed locale work; `Publish` / `Unpublish` changes whether `clk.live` may serve generated artifacts. Current Roma is a single-current-account customer shell and does not expose customer account switching. Roma is the real account/product boundary for Builder. It must not model a fake anonymous editor/account mode inside shared account truth, and account context must not derive platform flags, names, or slugs from compact account ids. In cloud-dev, this still usually collapses to one effective account: the seeded Clickeen/admin account.

**DevStudio** — Internal toolbench. It is where Clickeen runs internal platform work such as widget curation, verification, and small local utility pages. The old local DevStudio widget-authoring lane is removed. DevStudio must not invent a second account or provider truth model and it must not become a generic customer-account browser.

**Venice** — Legacy SSR embed runtime being removed by PRD 100. It is not the surviving public serving plane. The surviving model is static mini-site delivery from Tokyo at `https://clk.live/{accountPublicId}/{instanceId}`; browser requests must receive generated files, not Venice-computed widget HTML.

**San Francisco** — AI Workforce Operating System. Runs customer copilots and internal system agents such as Builder Copilot, Widget Instance Translator, and Prague Copy Translator. Manages agent sessions, learning pipelines, and prompt evolution. See `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores account/user data, submissions, usage events, and relational support records. It does not store account widget instance source or projection tables. RLS is enforced for user/account tables, while widget instance inventory, editable config, display name, publish state, and example availability are Tokyo-owned.

**Tokyo** — Account storage and CDN. Hosts product static resources, widget software, Roma/Prague owned static resources, account-owned instance source, translated locale value storage, generated account mini-site artifacts, and account-owned uploaded files. Runtime-managed account data lives only under `accounts/{accountPublicId}/`; git-authored product resources live under `product/`, `dieter/`, `fonts/`, and `prague/`.

**Tokyo Worker** — Cloudflare Worker that serves account asset references from `accounts/{accountPublicId}/assets/{assetRef}`, exposes private Roma-bound asset and product-control routes over Cloudflare service bindings, owns account instance config/content persistence, stores translated locale value maps, queues translation jobs, materializes public artifacts from product state, and serves existing generated public artifacts from R2/CDN. Tokyo-worker is a PBX/control-plane switchboard for approved product operations: it must not infer product meaning from private storage object names, preserve storage-object vocabulary at product boundaries, or render public widgets from authoring source at visitor request time.

**Asset URL contract (pre-GA strict):**

- Full canonical contract: [AssetManagement.md](./AssetManagement.md)
- Fill/media authoring config now stores account asset references (`assetRef`, optional `posterAssetRef`) while runtime/materialized config packs resolve those refs to canonical root-relative paths: `/assets/account/{accountPublicId}/{assetRef}`. The backing R2 object lives under `accounts/{accountPublicId}/assets/{assetRef}`.
- Logo/media authoring surfaces use the same split: uploaded logos persist `asset.assetRef` plus editor metadata, while runtime consumes only the materialized `logoFill`.
- Persisted legacy media URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`, and persisted account-asset URL backed `logoFill` strings) are outside contract and rejected on write.
- Legacy non-account media paths are outside the runtime contract and are rejected on new writes.
- `DELETE` on an account asset is synchronous in the delete path with no instance rebuild/healing side effects; subsequent `/assets/account/**` reads return unavailable.
- Runtime does not rely on `CK_ASSET_ORIGIN`; asset paths remain canonical root-relative and environment portability is provided by the active preview and public serving hosts.
- Legacy host-pinned/legacy paths (for example `/curated-assets/**`) are not supported.

**Dieter** — Design system. Tokens (spacing, typography, colors), 16+ components (toggle, textfield, dropdown-fill, object-manager, repeater, dropdown-edit, etc.), icons. Output is CSS + HTML. Each widget only loads what it needs.

**Atlas** — Cloudflare KV. Read-only runtime cache. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.

## Widget Architecture

### Tokyo Widget Folder Structure

```
tokyo/product/widgets/{widgetType}/
├── spec.json          # Defaults + structured Builder editor contract
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
├── catalog.json       # Widget catalog metadata
├── editable-fields.json # Editable/translatable text contract when needed
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

Locale is a runtime parameter and must not be encoded into instance identity (`instanceId`).

- Roma/account product UI strings live under `tokyo/roma/i18n/**` and are served through Tokyo as product UI catalogs.
- Prague marketing/showcase copy and localization source live under `tokyo/prague/**`.
- Account-widget translation truth is locale-keyed translated content values stored on the account instance content fields. Product identity is `instanceId + locale`, not an overlay ID or storage object name.
- Public embeds read generated visitor artifacts that were materialized from approved instance config/content plus translated locale values.
- There is no repo-authored admin l10n lane and no repo-local instance translation truth.
- Widgets declare translatable account-widget paths in authored `editable-fields.json`. Internal path/value plumbing is allowed only below the product operation. No widget `localization.json`, layer path sidecar, wildcard path schema, `spec.json.overlays.text[]`, or text-pack schema survives.

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
| Venice  | Removed from active public widget serving | Legacy SSR embed runtime replaced by `clk.live` static public artifacts |
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
- That local verification scope currently centers on seeded Clickeen/admin account state and local translation/runtime checks.

**Local auth target (important):**

- `bash scripts/dev-up.sh` uses local Supabase.
- Berlin runs locally at `http://localhost:3005` for parity/unit work, but supported product auth happens in cloud Roma.
- Berlin session token issuer must match the Berlin issuer configured for the active auth surface; mismatched issuers are rejected with `coreui.errors.auth.forbidden` and `issuer_mismatch`.

### Environments (Canonical)

| Environment                 | Bob                            | Roma                            | Tokyo                            | Public serving              | San Francisco                           | DevStudio                |
| --------------------------- | ------------------------------ | ------------------------------- | -------------------------------- | --------------------------- | --------------------------------------- | ------------------------ |
| **Local**                   | `http://localhost:3000`        | `https://roma.dev.clickeen.com` | `http://localhost:4000`          | local Tokyo-worker host     | `—`                                     | `http://localhost:5173`  |
| **Cloud-dev (from `main`)** | `https://bob.dev.clickeen.com` | `https://roma.dev.clickeen.com` | `https://tokyo.dev.clickeen.com` | `https://dev.clk.live`      | `https://sanfrancisco.dev.clickeen.com` | `— local only`           |
| **UAT**                     | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://clk.live`          | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |
| **Limited GA**              | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://clk.live`          | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |
| **GA**                      | `https://app.clickeen.com`     | `https://app.clickeen.com`      | `https://tokyo.clickeen.com`     | `https://clk.live`          | `https://sanfrancisco.clickeen.com`     | (optional) internal-only |

UAT / Limited GA / GA are **release stages** (account-level exposure controls), not separate infrastructure.

Public-serving rule:

- Cloud-dev must use `dev.clk.live`; it must not claim the production public-serving domain `clk.live`.
- Production release stages use `clk.live`.
- The URL path shape is identical in every environment: `/{accountPublicId}/{instanceId}`.
- Environment differences are bindings only: hostname, Worker deployment, R2 bucket, secrets, and database target. Product behavior must not fork between cloud-dev and production.

Pages deploy rule:

- `bob`, `roma`, and `prague` deploy through **Cloudflare Pages Git build only**.
- GitHub Actions may verify Pages build contracts, but are not the Pages deploy plane and must not create Pages projects, sync Pages secrets, or deploy Pages artifacts.
- The manual Pages project/env/host contract is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts in cloud-dev; `*.pages.dev` is not a valid authenticated Builder runtime host.

### Deterministic compilation contract (anti-drift)

- **Dieter bundling manifest (authoritative)**: `tokyo/product/dieter/manifest.json` after PRD 79 Phase 1 (public `/dieter/**` can remain a serving route)
- **Widget definition source**: widget-owned `catalog.json`, `spec.json`, `editable-fields.json`, runtime assets, and policy-linked limit metadata under `tokyo/product/widgets/{widgetType}/`. `scripts/generate-widget-definition-sources.mjs` creates the checked Tokyo-worker source index used only for bundling imports; it is not product state, not a catalog artifact, and must stay in sync through `pnpm validate:widgets`. Tokyo-worker resolves widget definitions through `listWidgetDefinitions` and `getWidgetDefinition`; Prague reads the same widget source metadata for public labels. `scripts/validate-widget-source.mjs` is a non-mutating guard, not a generated manifest writer.
- **Rule**: ToolDrawer `type="..."` drives required bundles; CSS classnames never add bundles.
- **Verification plane**: compilation discipline is enforced through repo typecheck/build and Cloudflare verification, not a localhost Bob HTTP gate.

**Key Discipline:**

- Runtime code + DB schema are truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.
