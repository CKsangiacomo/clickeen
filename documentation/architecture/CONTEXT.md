# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `documentation/strategy/WhyClickeen.md`.

**PRE‑GA / AI iteration contract (read first):** Clickeen is **pre‑GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions). This does **not** mean “take shortcuts” — build clean, scalable primitives and keep the architecture disciplined. But it **does** mean: avoid public‑facing backward compatibility shims, long‑lived migrations, ad‑hoc fallback behavior, defensive edge‑case handling, or multi‑version support unless a PRD explicitly requires it. (Exception: **best‑available localization overlays** are an explicit core contract; missing latest overlays must not break runtime.) Assume we can make breaking changes across the stack and update the current widget definitions (`tokyo/widgets/*`), defaults (`spec.json` → `defaults`), and curated local/dev instances accordingly. Prefer **strict contracts + fail‑fast** (clear errors when inputs/contracts are wrong) over “try to recover” logic. For high‑impact changes, still use safety rails (feature flags, rollback switches, and data‑safety checks) when a change can affect runtime behavior.

**Debugging order (when something is unclear):**

1. Runtime code + `supabase/migrations/` — actual behavior + DB schema truth
2. Deployed Cloudflare config — environment variables/bindings can differ by stage
3. `documentation/services/` + `documentation/widgets/` — operational guides (kept in sync with runtime)
4. `documentation/architecture/Overview.md` + `documentation/architecture/AssetManagement.md` + this file — concepts and glossary

Docs are the source of truth for intended behavior; runtime code + schema are the source of truth for what is running. Any mismatch is a P0 doc bug: update the docs immediately to match reality.

**Docs maintenance:** See `documentation/README.md`. Treat doc updates as part of the definition of done for any change that affects runtime behavior, APIs, env vars, or operational workflows.

---

## Product Truth (Read Before Coding)

Clickeen is a simple product.

The real product path is:

1. A real account owns widgets and assets.
2. A real user in that account opens Builder in Roma.
3. Bob edits one widget in memory.
4. Roma saves that widget to Tokyo.
5. Entitlements from the account are the only source of limits, caps, budgets, and upsell.

Non-negotiable negative truths:

- Builder is the only real authoring surface.
- Minibob is a demo/funnel surface. It may preview, collect intent, and hand off to signup. It is **not** a user, account, editor identity, policy profile, or save-capable product mode.
- Editing always happens in **one active locale at a time**. Switching locale changes the active editing context only. Translation is async follow-up work after save.
- Preview must reflect the same widget the customer is editing. Preview is **not** a second widget-shaped truth.
- Invalid state must fail at the named boundary. Do not silently heal product truth into a new normal.
- Non-account/helper/demo flows may exist in code while being reduced, but they do **not** define account authoring truth.

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

### Widget Definition vs Widget Instance

**Widget Definition** (Tokyo widget folder) = THE SOFTWARE

- Complete functional software for a widget type (e.g. FAQ)
- Lives in `tokyo/widgets/{widgetType}/`
- Core runtime files: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
- Contract/metadata in the same folder (consumed by Bob/Roma/Tokyo-worker/Venice/Prague as appropriate): `limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`
- Platform-controlled; **not stored in Michael** and **not served from Paris**

**Widget Instance** = THE DATA

- Instance configuration data (curated or user-owned)
- Stored in Michael:
  - Clickeen-authored baseline + curated: `curated_widget_instances` with `widget_type`
  - User/account instances: `widget_instances` with `widget_id` (FK to `widgets`)
- Product-path account open resolves the saved authoring revision from Tokyo; Michael remains the registry/shell/status plane and localization-overlay state is owned in the Tokyo/Tokyo-worker plane
- On the active account authoring path, user-facing instance identity (`widgetType`, `displayName`, `source`, `meta`) is Tokyo-owned. Michael `widget_instances.display_name` may still exist as storage residue during cutover, but Widgets/Builder product contracts must not read or write identity truth from it.
- Michael `widget_instances.config` may still exist as inert schema residue for user-instance rows, but the active product path must not persist or read a second live widget document there.
- Bob holds working copy in memory as `instanceData` during editing

### Product-Path Account Editing (Current PRD 61 Cutover)

Core account editing currently uses direct app-owned read/write paths for the one widget document Builder edits:

For the 075 authoring simplification track, this account-mode Roma -> Bob -> Tokyo chain is the governing authoring path; non-account/helper flows do not define account authoring truth.

1. **Open core instance**: `GET /api/builder/:publicId/open` once per Roma Builder open. Roma resolves the active account from the signed bootstrap capsule, loads the saved authoring revision from Tokyo through the private product-control binding, and then sends Bob one `ck:open-editor` payload.
2. **Save**: `PUT /api/account/instance/:publicId?subject=account` when the editor saves. Bob/Roma same-origin routes commit the saved authoring revision to Tokyo directly, carrying the current saved-document metadata (`widgetType`, `displayName`, `source`, `meta`) together with `config`, and return success immediately. The Tokyo commit is the save boundary.
3. **Widgets list + rename identity**: Roma reads user-instance identity for `/widgets` from Tokyo saved documents, while Michael only provides the account row/status shell. Rename writes that Tokyo identity directly instead of patching Michael `display_name`.
4. **Create/duplicate**: Roma writes the Tokyo saved document before creating the Michael row, so the product never exposes a Michael-visible account widget before the real Tokyo document exists.
5. **Authz**: normal product ops authorize from the bootstrap account authz capsule carried by Roma/Bob. Active product routes do not re-read account membership or recompute policy on each open/save call; the signed capsule carries stable authz truth, while live mutable counters are enforced at the canonical owner when needed.
6. **Localization/live follow-up**: translation and locale convergence remain downstream work owned outside the Builder save loop. Product-path save does not own that work.

On the real product path, editor routes are account-mode routes. If non-account/demo/helper route shapes still exist in code while being reduced, they do not define shared editor semantics or account authoring truth. On `account` product routes, policy/entitlement truth comes from the bootstrap authz capsule, not a fresh Paris policy resolution.

In the browser the active account-mode host path is:

- Roma message boot path: host fetches one Builder-open envelope through its same-origin route, then sends Bob a `ck:open-editor` message. Save delegates back to the Roma host and stays on the product same-origin route family.

Bob does not URL-bootstrap account mode. Account editing is host-only.

Localization is separate from Builder authoring: account locale policy lives in Roma Settings, and translation/runtime locale convergence happens downstream from the one widget save path.

Between open and save:

- Base config edits happen in Bob's React state (in memory)
- Preview updates via postMessage (no Paris API calls for base config)
- Core account instance open does not require Paris
- Core account instance persistence does not proxy Paris
- ZERO database writes for base config during normal product open/save
- Base config is not required to be English; Builder always edits one active locale at a time, and translation to other locales is async follow-up work after save.
- No demo/non-account surface writes durable account widget truth.

**Why:** 10,000 users editing simultaneously = no server load for base config. Localization writes are scoped overlays, enabling async translation while preserving user edits. Millions of landing page visitors = zero DB pollution until signup + publish.

### Key Terms

| Term           | Description                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `publicId`     | Instance unique identifier in DB                                                                         |
| `widgetType`   | Widget identifier referencing the definition (e.g., "faq")                                               |
| `config`       | Persisted base instance values; active product account reads/writes use Tokyo's saved authoring snapshot |
| `instanceData` | Working copy of config in Bob during editing                                                             |
| `spec.json`    | Defaults + ToolDrawer markup; compiled by Bob                                                            |
| `agent.md`     | AI contract documenting editable paths and semantics                                                     |

### Starter Designs (Curated Instances)

**Clickeen does not have a separate gallery-preset content model.** "Starter designs" are Clickeen-authored instances stored in `curated_widget_instances` and exposed in the gallery.

**How it works:**

1. Clickeen team authors the starter instances in DevStudio.
2. One instance per widget may be shown first in MiniBob (`wgt_main_{widgetType}` in current runtime naming).
3. Other starter instances use `wgt_curated_{widgetType}_{styleSlug}` in current runtime naming.
4. These instances are published one-way to cloud-dev and surfaced in the gallery.
5. User browses gallery -> clicks "Use this" -> clones to their account as a user instance.
6. User customizes their copy freely (full ToolDrawer access).

**Why this approach:**

- **One editor**: Clickeen and users author in Bob; same config schema.
- **One instance set**: the same instances appear as Roma starters, local internal verification targets, and Prague embeds.
- **Deterministic publish**: Clickeen-authored instances are one-way (local -> cloud-dev).
- **Scales to marketplace**: Curated instances remain shareable configs, not a new content type.

**Naming convention for Clickeen starters:**

```
  wgt_main_{widgetType}
wgt_curated_{widgetType}_{styleSlug}
Examples:
  wgt_main_faq
  wgt_curated_faq_lightblurs_generic
```

**Publishing semantics:** Curated/owned instances are always publishable. In Michael, `curated_widget_instances.status` defaults to `published` and is not used as a user-facing gate (publishing is only a user-instance workflow).

Curated metadata lives alongside the instance (not in the publicId):

```
curated_widget_instances.meta = {
  styleName: "lightblurs.generic",
  styleSlug: "lightblurs_generic"
}
```

---

## Systems

| System            | Purpose                                                         | Runtime                         | Repo Path       |
| ----------------- | --------------------------------------------------------------- | ------------------------------- | --------------- |
| **Prague**        | Marketing site + gallery + demo/funnel surfaces                 | Cloudflare Pages                | `prague/`       |
| **Bob**           | Account Builder editor runtime; the real widget authoring UI    | Cloudflare Pages (Next.js)      | `bob/`          |
| **Roma**          | Current-account product shell + Builder host orchestration      | Cloudflare Pages (Next.js)      | `roma/`         |
| **DevStudio**     | Internal toolbench for platform curation, verification, and local utility pages | Local Vite toolbench            | `admin/`        |
| **Venice**        | SSR embed runtime                                               | Cloudflare Pages (Next.js Edge) | `venice/`       |
| **Paris**         | Residual health stub + non-product residue; not on the product authoring path | Cloudflare Workers              | `paris/`        |
| **San Francisco** | AI Workforce OS (agents, learning)                              | Workers (D1/KV/R2/Queues)       | `sanfrancisco/` |
| **Michael**       | Database                                                        | Supabase Postgres               | `supabase/`     |
| **Dieter**        | Design system                                                   | Build artifacts in Tokyo        | `dieter/`       |
| **Tokyo**         | Asset storage & CDN                                             | Cloudflare R2                   | `tokyo/`        |
| **Tokyo Worker**  | Account-owned asset uploads + l10n publisher + render snapshots | Cloudflare Workers + R2         | `tokyo-worker/` |
| **Atlas**         | Edge config cache (read-only)                                   | Cloudflare KV                   | —               |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, opens account instances through same-origin routes backed by Tokyo saved authoring state, and saves by writing Tokyo's saved revision directly. Bob does not own published/unpublished state changes; those remain in Roma widgets domain, and its copy-code affordance is only for getting website embed snippets. Bob is the real account authoring UI. Shared Bob code must model the account Builder product path, not preserve demo/funnel identities as co-equal editor modes. Copilot browser entrypoint is `POST /api/ai/widget-copilot`, and Roma resolves widget identity server-side from the instance being edited.

**Roma** — Product shell and account experience. Domain-driven app (`/home`, `/widgets`, `/templates`, `/builder`, etc.) that resolves account context through `/api/bootstrap`, keeps a short-lived account authz capsule for server-verifiable session authz, opens Bob through explicit message boot (`bob:session-ready` -> `ck:open-editor` -> applied/fail), reads core account instance state through same-origin routes backed by Tokyo saved authoring state, and saves that one widget document back through the same account boundary. On the active Widgets/Builder path, Roma treats Tokyo as the user-facing instance identity owner and Michael as row/status shell only. Translation/live follow-up sits outside the Builder save loop; Roma no longer exposes a Builder-localization rehydrate/status subsystem on the active account path. Current Roma is a single-current-account customer shell and does not expose customer account switching. Roma is the real account/product boundary for Builder. It must not model a fake anonymous editor/account mode inside shared account truth. In cloud-dev, this still usually collapses to one effective account: the seeded platform-owned account.

**DevStudio** — Internal toolbench. It is where Clickeen runs internal platform work such as widget curation, verification, and small local utility pages. The old local DevStudio widget-authoring lane is removed. DevStudio must not invent a second account or provider truth model and it must not become a generic customer-account browser.

**Venice** — SSR embed runtime. Serves public embeds from Tokyo published snapshot pointers (`/e/:publicId`, `/r/:publicId`) with revision-coherent resolution (single published revision; requested locale must exist in that revision or the response is unavailable). Dynamic rendering remains an internal bypass path only. Third-party pages only ever talk to Venice; Paris is private.

**Paris** — Residual Cloudflare Worker boundary. Today it is a health stub plus a small amount of non-product residue. It is not on the account-mode product path, not an auth/session authority, and not the owner of account localization state, account widget save/publish sync, or public embed payload assembly.

**San Francisco** — AI Workforce Operating System. Runs all AI agents (SDR Copilot, Editor Copilot, Support Agent, etc.) that operate the company. Manages sessions, jobs, learning pipelines, and prompt evolution. See `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores curated instances (`curated_widget_instances`), user instances (`widget_instances`), submissions, users, usage events. RLS enforced for user tables; curated rows are global. Starters use `wgt_main_*` and `wgt_curated_*`.

**Tokyo** — Asset storage and CDN. Hosts Dieter build artifacts, widget definitions/assets, and account-owned upload blobs.

**Tokyo Worker** — Cloudflare Worker that serves immutable account asset paths (`/assets/v/:assetRef`), exposes private Roma-bound asset and product-control routes over Cloudflare service bindings, executes explicit instance sync and localization-state reads that lazy-derive canonical l10n base identity after save, writes published **instance** l10n artifacts into Tokyo/R2, and publishes Venice render snapshots.

**Asset URL contract (pre-GA strict):**

- Full canonical contract: [AssetManagement.md](./AssetManagement.md)
- Fill/media authoring config now stores logical asset identity (`assetId`, optional `posterAssetId`) while runtime/materialized config packs resolve those ids to canonical root-relative paths: `/assets/v/:assetRef`.
- Logo/media authoring surfaces use the same split: uploaded logos persist `asset.assetId` plus editor metadata, while runtime consumes only the materialized `logoFill`.
- Persisted legacy media URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`, and `/assets/v/*`-backed `logoFill` strings) are outside contract and rejected on write.
- Legacy `/arsenale/a/**` and `/arsenale/o/**` paths are outside the runtime contract and are rejected on new writes.
- `DELETE` on an account asset is synchronous in the delete path (metadata + blob) with no snapshot rebuild/healing side effects; subsequent `/assets/v/**` reads return unavailable.
- Managed asset APIs expose explicit integrity checks (`/assets/integrity/:accountId` and `/assets/integrity/:accountId/:assetId`) so Roma can surface DB↔R2 mismatch states.
- Runtime does not rely on `CK_ASSET_ORIGIN`; asset paths remain canonical root-relative and environment portability is provided by Bob/Venice proxy routes.
- Legacy host-pinned/legacy paths (for example `/curated-assets/**`) are not supported.

**Dieter** — Design system. Tokens (spacing, typography, colors), 16+ components (toggle, textfield, dropdown-fill, object-manager, repeater, dropdown-edit, etc.), icons. Output is CSS + HTML. Each widget only loads what it needs.

**Atlas** — Cloudflare KV. Read-only runtime cache. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.

**agent.md** — Per-widget AI contract. Documents editable paths, parts/roles, enums, and safe list operations. Required for AI editing.

---

## Widget Architecture

### Tokyo Widget Folder Structure

```
tokyo/widgets/{widgetType}/
├── spec.json          # Defaults + ToolDrawer markup (<bob-panel> + <tooldrawer-field>)
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
├── agent.md           # AI contract (required for AI editing)
├── limits.json        # Entitlements caps/flags consumed by shared policy enforcement
├── localization.json  # Locale-layer allowlist (translatable paths)
├── layers/            # Per-layer allowlists (e.g. user.allowlist.json)
└── pages/             # Prague marketing pages (overview/features/examples/pricing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

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
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };
```

All ops are validated against `compiled.controls[]` allowlist. Invalid ops are rejected fail-closed.

---

## Localization (Layered)

Locale is a runtime parameter and must not be encoded into instance identity (`publicId`).

- UI strings use Tokyo-hosted `i18n` catalogs (`tokyo/i18n/**`).
- Repo-authored admin-owned i18n source catalogs live under `tokyo/admin-owned/i18n/**` and build into `tokyo/i18n/**`.
- Instance/content translation uses Tokyo-hosted published `l10n` artifacts (`tokyo/l10n/**`) at runtime. Public embeds read locale text packs + live pointers; layer=user authoring state is resolved before publication.
- Repo-authored admin-owned l10n source overlays live under `tokyo/admin-owned/l10n/**` and build into `tokyo/l10n/**`.
- Prague marketing copy lives in `tokyo/widgets/*/pages/*.json` (single source) with layered ops overlays stored in Tokyo (`tokyo/l10n/prague/**`) and applied at runtime (deterministic `baseFingerprint`, no manifest). Chrome UI strings remain in `prague/content/base/v1/chrome.json`.
- Canonical overlay truth for instances lives in Tokyo/Tokyo-worker. Manual overrides live in layer=user and are merged into published text packs at publish/sync time.

Canonical reference:

- `documentation/capabilities/localization.md`

---

## Current Implementation Status

### Systems

| System  | Status    | Notes                                                                                                         |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Bob     | ✅ Active | Compiler, ToolDrawer, Account, Ops engine                                                                     |
| Roma    | ✅ Active | Domain shell, account bootstrap, widgets/templates/builder orchestration                                      |
| Tokyo   | ✅ Active | FAQ widget with shared modules                                                                                |
| Paris   | ✅ Active | Residual health stub and non-product residue only                                                             |
| Venice  | ✅ Active | SSR embed runtime (published-only), loader, asset proxy (usage/submissions are stubbed in this repo snapshot) |
| Dieter  | ✅ Active | 16+ components, tokens, typography                                                                            |
| Michael | ✅ Active | Supabase Postgres with RLS                                                                                    |

### Widgets

| Widget        | Status    | Components Used                                                                                                                               |
| ------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FAQ           | ✅ Active | See `tokyo/widgets/faq/spec.json` (object-manager, repeater, dropdown-edit, toggle, textfield, dropdown-fill, dropdown-actions, choice-tiles) |
| Countdown     | ✅ Active | See `tokyo/widgets/countdown/spec.json`                                                                                                       |
| Logo Showcase | ✅ Active | See `tokyo/widgets/logoshowcase/spec.json`                                                                                                    |

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
pnpm build:dieter               # Build Dieter assets first
pnpm build                      # Build all packages

# Development
bash scripts/dev-up.sh          # Canonical local DevStudio operating lane (Tokyo/Tokyo-worker/Berlin/Bob/DevStudio)
pnpm dev:bob                    # Bob only
pnpm dev:paris                  # Paris only
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

| Environment           | Bob                     | Roma                            | Paris                  | Tokyo                   | San Francisco                  | DevStudio               |
| --------------------- | ----------------------- | ------------------------------- | ---------------------- | ----------------------- | ------------------------------ | ----------------------- |
| **Local**             | `http://localhost:3000` | `https://roma.dev.clickeen.com` | `—`                    | `http://localhost:4000` | `—`                            | `http://localhost:5173` |
| **Cloud-dev (from `main`)** | `https://bob.dev.clickeen.com`   | `https://roma.dev.clickeen.com` | `https://paris.dev.clickeen.com`                 | `https://tokyo.dev.clickeen.com` | `https://sanfrancisco.dev.clickeen.com` | `— local only`                       |
| **UAT**                     | `https://app.clickeen.com`       | `https://app.clickeen.com`      | `https://paris.clickeen.com`                     | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only             |
| **Limited GA**              | `https://app.clickeen.com`       | `https://app.clickeen.com`      | `https://paris.clickeen.com`                     | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only             |
| **GA**                      | `https://app.clickeen.com`       | `https://app.clickeen.com`      | `https://paris.clickeen.com`                     | `https://tokyo.clickeen.com`     | `https://sanfrancisco.clickeen.com`     | (optional) internal-only             |

UAT / Limited GA / GA are **release stages** (account-level exposure controls), not separate infrastructure.

Pages deploy rule:
- `bob`, `roma`, `venice`, and `prague` deploy through **Cloudflare Pages Git build only**.
- GitHub Actions may verify Pages build contracts, but are not the Pages deploy plane and must not create Pages projects, sync Pages secrets, or deploy Pages artifacts.
- The manual Pages project/env/host contract is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.
- Bob and Roma must use custom `*.dev.clickeen.com` hosts in cloud-dev; `*.pages.dev` is not a valid authenticated Builder runtime host.

### Deterministic compilation contract (anti-drift)

- **Dieter bundling manifest (authoritative)**: `tokyo/dieter/manifest.json`
- **Rule**: ToolDrawer `type="..."` drives required bundles; CSS classnames never add bundles.
- **Verification plane**: compilation discipline is enforced through repo typecheck/build and Cloudflare verification, not a localhost Bob HTTP gate.

**Key Discipline:**

- Runtime code + DB schema are truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.
