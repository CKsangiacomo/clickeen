# CLICKEEN Platform Architecture — Phase 1

This document describes system boundaries, data flows, and how the platform fits together.

**For definitions and glossary:** See `CONTEXT.md`
**For canonical asset behavior:** See [AssetManagement.md](./AssetManagement.md)
**For strategy and vision:** See `documentation/strategy/WhyClickeen.md`
**For system details:** See `documentation/services/` and `documentation/ai/`

For debugging reality, follow the “Debugging order” in `CONTEXT.md` (runtime code + DB schema, then deployed Cloudflare config, then docs).

---

## AI-First Company

Clickeen is designed to be **built by AI** and **run by AI**:

| Layer                         | Responsibility                                                |
| ----------------------------- | ------------------------------------------------------------- |
| **Human (1)**                 | Vision, architecture, taste, strategic decisions              |
| **AI Coding**                 | Build product from specs (Cursor, Claude, GPT)                |
| **AI Agents (San Francisco)** | Run the company: sales, support, marketing, localization, ops |

**San Francisco is the Workforce OS** — the system that operates the AI agents who run the company.

See: `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`

---

## Core Architecture Principles

> Full details: [Tenets.md](./Tenets.md)

| Principle                      | Rule                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No Fallbacks**               | Orchestrators never invent/heal instance config. If base data is missing/invalid, the system fails visibly. Public renders must be revision-coherent (single published revision; missing locale artifacts fail visibly). |
| **Widget Files = Truth**       | Core runtime files + contract files in `tokyo/product/widgets/{name}/` define widget behavior and validation; their deployed Tokyo R2 home is `product/widgets/{name}/`.                                                                                                                    |
| **Orchestrators = Dumb Pipes** | Bob/Roma/Tokyo-worker/Venice avoid widget-specific logic. They may apply generic, contract-driven transforms (e.g. overlay composition, artifact materialization) but must not “fix” state ad hoc.                    |
| **Dieter Tokens**              | All colors/typography in widget configs use Dieter tokens by default. Users can override with HEX/RGB.                                                                                                                   |
| **Locale Is Not Identity**     | Locale is a runtime parameter. IDs (`instanceId`) must be locale-free; localization is applied via overlays, not DB fan-out.                                                                                               |

---

## Core Object Model: Mutable Pointers to Immutable Artifacts

Every stateful object in Clickeen follows one pattern: a **thin mutable pointer** that references a **heavy immutable artifact**.

```
Mutable pointer  (tiny, always fetched fresh)
    │
    └──► Immutable artifact  (heavy, cached forever, content-addressed)
```

"Updating" something never mutates an existing object. It means: create a new immutable artifact, then atomically flip the pointer. The old artifact stays cached wherever it is — no invalidation cascade, no eventual consistency window.

### Where this applies

| Domain       | Mutable pointer                                                        | Immutable artifact                                                                    |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Serve state** | Tokyo live pointer / serve flag (`no-store`)                           | Published projection material under `accounts/{accountPublicId}/instances/{instanceId}/published/` |
| **Assets**   | Authoring stores account asset refs; runtime/account APIs carry `accountPublicId` | Asset bytes under `accounts/{accountPublicId}/assets/{assetRef}` |
| **Auth**     | JWT (short-lived, refreshable)                                         | userId claim (stable identity)                                                        |
| **Authz**    | HMAC-signed capsule (expires)                                          | Role/account snapshot at issuance                                                     |
| **Overlays** | Selected/published overlay pointer under the owning instance             | Overlay object at `accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json` |

For instance serving, `published` / `unpublished` is only the Tokyo-owned per-instance serve flag. It tells Venice whether public serving is allowed. It is not widget-type state, not overlay readiness, and not broad account/business lifecycle truth.

### Why this matters

**For caching:** The heavy part (artifacts, snapshots, overlay files) caches perfectly — CDN, edge, browser, forever. The mutable part (pointers, JWTs, capsules) is tiny and cheap to fetch fresh. One uncached pointer read, then everything it references hits cache.

**For safety:** Writes produce new artifacts, never modify shared state. If a write fails, nothing changed. If it succeeds, the artifact exists permanently. Rollback is just pointing back to the previous artifact.

**For agents:** An AI agent's loop is verify state, take action, verify result. Pointer reads give deterministic current state. New artifact writes can't corrupt existing data. Pointer flips give binary confirmation. No locks, no race conditions, no partial states.

**For scale:** 10,000 concurrent editors produce 10,000 independent artifacts. No write contention, no coordination between them. The pointer flip is the only serialization point and it's a single atomic write.

### Contrast with traditional SaaS

Traditional systems treat objects as mutable: update in place, invalidate caches everywhere, coordinate distributed reads, handle partial writes, build versioning schemes. Clickeen sidesteps all of this. The pointer is the only mutable thing, and it's trivially small.

This is the same principle that underpins content-addressed storage, Git, and distributed ledgers: if data is immutable and addressed by content, you can distribute it globally and cache it indefinitely without coordination.

Every service section below is an instance of this pattern. Tokyo stores immutable artifacts and account-owned runtime state under the canonical R2 roots. Tokyo-worker materializes account-scoped published projections and flips live pointers. Venice reads projected public material and serves cached artifacts. Bob creates working artifacts. Roma orchestrates the account-scoped product cycle, while DevStudio remains the internal toolbench for platform work and local verification pages.

---

## System Map

| System            | Repo Path       | Deploy                               | Responsibility                                                          | Status      |
| ----------------- | --------------- | ------------------------------------ | ----------------------------------------------------------------------- | ----------- |
| **Prague**        | `prague/`       | Cloudflare Pages                     | Marketing + SEO surface                                                 | ✅ Active   |
| **Bob**           | `bob/`          | Cloudflare Pages                     | Widget builder, compiler, ToolDrawer, preview                           | ✅ Active   |
| **Roma**          | `roma/`         | Cloudflare Pages                     | Product shell, account domains, Bob host orchestration                  | ✅ Active   |
| **DevStudio**     | `admin/`        | Local Vite                           | Internal toolbench for platform curation, verification, and local utility pages | ✅ Internal |
| **Venice**        | `venice/`       | Cloudflare Pages (Next.js Edge)      | SSR embed runtime and loader                                            | ✅ Active   |
| **San Francisco** | `sanfrancisco/` | Cloudflare Workers (D1/KV/R2/Queues) | AI Workforce OS: agents, learning, orchestration                        | ✅ Phase 1  |
| **Michael**       | `supabase/`     | Supabase Postgres                    | Database with RLS                                                       | ✅ Active   |
| **Dieter**        | `dieter/`       | (build artifact)                     | Design system: tokens, 16+ components                                   | ✅ Active   |
| **Tokyo**         | `tokyo/`        | Cloudflare R2                        | Canonical product asset roots, account runtime storage, Dieter/fonts/Prague artifacts | ✅ Active   |
| **Tokyo Worker**  | `tokyo-worker/` | Cloudflare Workers + Queues          | Tokyo PBX for account storage, assets, and published projections         | ✅ Active   |

---

## Cloudflare Environments (Detailed Spec)

This section specifies the **Cloudflare environment model** and the **canonical runtime surfaces** for Phase 1.

### Environments

There is no “pre‑GA” environment. We use **5 layers**:

| Environment    | Purpose                                         | Code source        | Exposure model                                               |
| -------------- | ----------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| **Local**      | Fast iteration + deterministic debugging        | local working tree | developer machine only                                       |
| **Cloud-dev**  | End-to-end HTTPS integration & shared debugging | `main`             | internal/dev (can break)                                     |
| **UAT**        | QA/UAT on real infra                            | release build      | allowlist: Clickeen-owned demo accounts                      |
| **Limited GA** | Global, limited rollout                         | release build      | ~10% of accounts (mix of countries/ICPs), observe for X days |
| **GA**         | Full rollout                                    | release build      | 100% of accounts                                             |

### Release process (simple, enforced)

Each release proceeds in 3 steps:

1. **UAT**: release to X Clickeen-owned demo accounts for testing/QA/UAT
2. **Limited GA**: release to ~10% of accounts globally (diverse countries/ICPs), observe for a specified window
3. **GA**: if the release passes Limited GA, roll out to 100%

### Canonical domains (dev + prod)

| System            | Cloud-dev                                    | Production                          |
| ----------------- | -------------------------------------------- | ----------------------------------- |
| **Bob**           | `https://bob.dev.clickeen.com`               | `https://app.clickeen.com`          |
| **Roma**          | `https://roma.dev.clickeen.com`              | `https://app.clickeen.com`          |
| **Prague**        | `https://prague.dev.clickeen.com` (optional) | `https://clickeen.com`              |
| **Public embeds** | `https://clk.live`                           | `https://clk.live`                  |
| **Tokyo**         | `https://tokyo.dev.clickeen.com`             | `https://tokyo.clickeen.com`        |
| **San Francisco** | `https://sanfrancisco.dev.clickeen.com`      | `https://sanfrancisco.clickeen.com` |

**Fallback origins (when custom domains aren’t configured yet):**

- **Pages**: `{project}.pages.dev`
- **Workers**: `{script}.workers.dev`

Pages fallback hosts are platform defaults, not canonical product hosts. Bob and Roma must use `*.dev.clickeen.com` in cloud-dev because authenticated Builder flows rely on shared httpOnly cookies across those subdomains.

### Cloudflare primitives (what we use and why)

| Primitive         | Used by                                                   | Why                                                      |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| **Pages**         | Prague, Bob, Roma                                          | Static + Next.js-style app surfaces; simple deploy model |
| **Workers**       | Tokyo-worker, Venice, San Francisco         | Edge HTTP services; consistent global runtime            |
| **R2**            | Tokyo (assets), San Francisco (raw logs)                  | Cheap object storage, zero egress for CDN patterns       |
| **KV**            | San Francisco (sessions), Atlas (read-only runtime cache) | Hot key/value state, TTLs                                |
| **D1**            | San Francisco (indexes)                                   | Queryable learning metadata; low-ops SQL                 |
| **Queues**        | San Francisco                                             | Non-blocking logging/ingestion; keep request path fast   |
| **Cron Triggers** | San Francisco (later)                                     | Scheduled analysis/maintenance without extra infra       |

### Resource naming conventions (dev/prod split)

**Rule:** dev and prod resources are separate (no mixing).

- **Workers**: `{system}-dev`, `{system}-prod`
- **R2**:
  - Tokyo: `tokyo-assets-dev`, `tokyo-assets-prod`
  - San Francisco logs: `sanfrancisco-logs-dev`, `sanfrancisco-logs-prod`
- **KV**:
  - San Francisco: `sanfrancisco_kv_dev`, `sanfrancisco_kv_prod`
  - Atlas: (separate KV, read-only)
- **D1**:
  - San Francisco: `sanfrancisco_d1_dev`, `sanfrancisco_d1_prod`
- **Queues**:
  - San Francisco: `sanfrancisco-events-dev`, `sanfrancisco-events-prod`

### Tokyo R2 root model

Tokyo R2 has five canonical roots:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Only `accounts/` is runtime-managed by product/account operations. It owns account instances, uploaded assets, selected overlays, private overlay objects, and account-scoped published projection material:

```text
accounts/{accountPublicId}/instances/{instanceId}/...
accounts/{accountPublicId}/assets/...
```

The non-account roots are git-authored deploy artifacts synced into R2 from the repo/deploy pipeline:

```text
dieter/
fonts/
product/
prague/
```

They may be served by Tokyo-worker through friendly public routes, but Roma, Venice, Tokyo-worker, and account lifecycle operations must not mutate them as account runtime state. Root `widgets/`, `public/`, `published/`, and `l10n/` are not storage authorities.

### Routes & bindings (high level)

#### Bob (Pages)

- **Bob compiles widget specs** by fetching `spec.json` from Tokyo via `NEXT_PUBLIC_TOKYO_URL` (even locally).
- Bob is the account editor kernel only. Account-mode bootstrap/authz come from Roma host messaging and same-origin Roma account routes. Public demo playback belongs to Prague + Venice, not to Bob helper routes.

#### Roma (Pages)

- Roma is the domain shell (`/home`, `/profile`, `/widgets`, `/builder`, `/assets`, `/team`, `/billing`, `/usage`, `/ai`, `/settings`).
- Roma resolves identity/account/authz context through `/api/bootstrap` (proxy to Berlin `GET /v1/session/bootstrap`), including an account authz capsule and an account entitlement snapshot.
- Roma exposes person-scoped User Settings through `/profile`, using Berlin-owned `/api/me` same-origin routes.
- Current Roma resolves one effective active account context per session and does not expose customer account switching. Cloud-dev still usually collapses to the seeded platform-owned account, while any internal account switching belongs to DevStudio and future customer multi-account switching belongs to a separate Roma-for-agency product.
- Roma uses named same-origin account routes and injects short-lived authz headers:
  - `x-ck-authz-capsule` for account-scoped calls
- Roma serves Berlin-backed account member reads on same-origin routes (`GET /api/account/team` and `GET /api/account/team/members/:memberId`).
- Roma Builder embeds Bob and sends one explicit `ck:open-editor` payload after `bob:session-ready`.

#### DevStudio (Local toolbench)

- DevStudio is the internal toolbench, not a second customer account shell.
- It is the surface where Clickeen runs internal platform work such as curation, verification, and local utilities.
- In local development, DevStudio is a local Vite toolbench for static/internal verification pages; removed widget-authoring and company-plane action lanes must not be reintroduced there.
- There is no canonical Cloudflare DevStudio runtime. DevStudio is local-only.

#### Public Embeds (`clk.live`)

- Public embed surface: third-party websites load generated static files from `clk.live`.
- Serving maps `/{accountPublicId}/{instanceId}` to the owning account instance `index.html`.
- Public requests perform no product-service lookup, runtime composition, overlay resolution, or database call.
- If `index.html` is missing, the public URL returns 404.
- Locale variants and SEO/GEO output are generated ahead of serving by agent jobs.

#### Tokyo (R2)

- Serves product widget software from R2 `product/widgets/**` through friendly `/widgets/**` routes.
- Serves Dieter from R2 `dieter/**`, global fonts from `fonts/**`, and Prague content from `prague/**`.
- **Deterministic compilation contract** depends on the deployed Dieter manifest under the canonical `dieter/` root.
- Serves account-owned generated browser files from `accounts/{accountPublicId}/instances/{instanceId}/`. PRD 098 overlay identity is fixed-layout `overlayId`; old l10n indexes, text packs, and base fingerprints are not active product truth.
- Prague website base copy lives in the `prague/` root. Account-widget overlays are build inputs for generated instance files; Prague does not own a separate widget localization runtime.

#### Tokyo Worker (Workers + Queues)

- Canonical asset management contract (cross-surface behavior): [AssetManagement.md](./AssetManagement.md)
- Handles private Roma-bound account asset authority routes and stores accepted account assets under `accounts/{accountPublicId}/assets/`.
- Tokyo-worker validates/resolves account-owned asset refs for authoring and build consumption, but this repo snapshot does not persist a canonical "where used" table in Michael.
- Serves account asset reads on routes carrying `accountPublicId`; legacy non-account asset paths are hard-failed.
- In-place account asset byte replacement keeps the same account asset reference and must not require instance rebuilds.
- Asset delete is synchronous and explicit, with no silent runtime healing.
- Writes account-instance config, overlay, SEO/meta, and published projection material under `accounts/{accountPublicId}/instances/{instanceId}/` from explicit Roma/system operations. Tokyo-worker does not read Michael/Supabase to discover overlay state.
- Materializes render snapshots under account-first instance storage, then exposes account-scoped published projection routes for Venice fast-path serving.

#### Asset ownership model (canonical)

- Ownership boundary is account (`accountPublicId` for R2 storage; private UUIDs remain relational implementation details).
- End-to-end flow:
  1. Bob uploads through Roma (`POST /api/account/assets/upload`), and Roma forwards to Tokyo-worker over the `TOKYO_ASSET_CONTROL` Cloudflare service binding with optional public/widget trace headers.
  2. Tokyo-worker writes the accepted account asset under `accounts/{accountPublicId}/assets/` and returns the account asset reference used by Bob/Roma.
  3. Roma validates account commands at the product boundary and Tokyo/Tokyo-worker enforce canonical asset/config contracts on write.
  4. Roma Assets reads/deletes via Roma asset routes (`/api/account/assets*`) which forward to Tokyo-worker through the private service binding plus the Roma account capsule; Tokyo-worker enforces account membership role.

#### San Francisco (Workers + D1/KV/R2/Queues)

- `/healthz`, `/v1/execute`, `/v1/outcome`, queue consumer for non-blocking log writes.
- Stores sessions in KV, raw logs in R2, indexes in D1.

### Environment variables (minimum matrix)

| Surface                     | Variable                    | Dev                                     | Prod                                | Notes                                                                            |
| --------------------------- | --------------------------- | --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| **Bob (Pages)**             | `NEXT_PUBLIC_TOKYO_URL`     | `https://tokyo.dev.clickeen.com`        | `https://tokyo.clickeen.com`        | Compiler fetches widget specs over HTTP (even locally)                           |
| **Bob (Pages)**             | `NEXT_PUBLIC_CLK_LIVE_URL`  | `https://clk.live`                      | `https://clk.live`                  | Optional public embed origin override                                            |
| **Bob (Pages)**             | `SANFRANCISCO_BASE_URL`     | `https://sanfrancisco.dev.clickeen.com` | `https://sanfrancisco.clickeen.com` | Explicit base URL for Copilot execution (San Francisco); no fallback probing |
| **Roma (Pages)**            | `NEXT_PUBLIC_BOB_URL`       | `https://bob.dev.clickeen.com`          | `https://app.clickeen.com`          | Builder iframe origin (no query override; configured per environment)            |
| **Roma/San Francisco (trusted backends)** | `ENV_STAGE`   | `cloud-dev`                             | `ga`                                | Exposure stage stamped into AI grants on the active product/internal issuer path |
| **Roma/San Francisco**      | `AI_GRANT_HMAC_SECRET`      | dev secret                              | prod secret                         | Shared HMAC secret between trusted grant issuers and San Francisco               |
| **San Francisco (Workers)** | `DEEPSEEK_API_KEY`          | dev key                                 | prod key                            | Provider key lives only in San Francisco                                         |

**Hard security rule:**

- There is no shared-secret bearer lane for product or internal AI execution. Roma Copilot/outcomes and Prague string translation use HMAC-signed request bodies, while account-widget translation generation uses the Tokyo-worker -> San Francisco `SANFRANCISCO_L10N` binding.

**Local auth rule:**

- In local development, Supabase JWT issuer must match the Supabase target the active auth/product surfaces are running against (local by default via `dev-up`; remote only when `DEV_UP_USE_REMOTE_SUPABASE=1`).

### Cloudflare config checklist (what “done” looks like)

**DNS & custom domains**

- `bob.dev`, `roma.dev`, `tokyo.dev`, `clk.live`, and `sanfrancisco.dev` point at the corresponding Pages/Workers deployments.
- Production domains (`app`, `tokyo`, `clk.live`, `sanfrancisco`) are configured similarly.

**Pages build settings**

- Node + pnpm versions pinned so cloud builds match local.
- Build command matches repo build (Turbo fan-out).

**Caching**

- Tokyo (`/dieter/**`, `/widgets/**`) uses long caching for versioned media; avoid caching `spec.json` aggressively in dev.
- Public embed serving uses cached generated files from `clk.live/{accountPublicId}/{instanceId}`.

**Access control**

- Optional: protect shared `*.dev` surfaces behind Access during early phases.

**Observability**

- Prefer Cloudflare-native logs/analytics (avoid 3rd-party vendors on embed surfaces).

### Deploy discipline (Cloud-dev vs releases)

- **Cloud-dev** auto-deploys from `main` for fast iteration.
- **UAT / Limited GA / GA** are release stages of the same release build, separated by **account-level exposure controls** (allowlist/percentage rollout) and an observation window.
- **Pages apps** (`bob`, `roma`, `venice`, `prague`) deploy through **Cloudflare Pages Git build only**.
- GitHub Actions may verify builds/tests, but must not create Pages projects, sync Pages secrets, or deploy Pages artifacts.
- The manual Pages project contract lives in [CloudflarePagesCloudDevChecklist.md](./CloudflarePagesCloudDevChecklist.md).

### Cloud-dev verification contract

Pages app workflows are verification-only. Cloudflare Pages Git build owns the Pages deploy plane, and workflows must not invent deploy-time contracts for those apps.

Canonical machine-health endpoints:

| Surface       | Canonical URL                                              | Expected shape                                                       | Owner         |
| ------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| Berlin        | `https://berlin-dev.clickeen.workers.dev/internal/healthz` | `{ "ok": true, "service": "berlin" }`                                | Berlin        |
| Tokyo-worker  | `https://tokyo.dev.clickeen.com/healthz`                   | `{ "up": true }`                                                     | Tokyo-worker  |
| San Francisco | `https://sanfrancisco.dev.clickeen.com/healthz`            | `{ "ok": true, "service": "sanfrancisco", "env": "...", "ts": ... }` | San Francisco |

Pages surfaces do not currently publish dedicated machine-health JSON endpoints. Their Git-connected Cloudflare Pages projects own deployment; GitHub workflows may only verify build contracts, and any runtime reachability smoke must not assume GitHub just performed the deploy.

Non-negotiable:

- No workflow may probe undocumented health sub-routes.
- Cross-service cloud-dev verification runs in one dedicated workflow.
- When a service health contract changes, the service doc and the centralized verification workflow must change in the same commit.

### Security & config (Cloudflare-level defaults)

- **HTTPS everywhere**: redirect HTTP → HTTPS; HSTS enabled on production domains.
- **Dev surfaces protected**: shared `*.dev` surfaces may be protected behind Cloudflare Access; DevStudio is local-only.
- **Secrets isolation**:
  - Provider keys live only in San Francisco.
  - Supabase service role lives only in Berlin/Tokyo-worker where explicitly required.
  - Roma Copilot/outcome and Prague string-translation calls use HMAC body signatures. Roma -> Tokyo/Tokyo-worker account product control uses private Cloudflare service bindings; account-widget translation generation uses the private Tokyo-worker -> San Francisco service binding.
- **Caching**:
  - Tokyo deploy-managed media is long-cacheable when versioned; avoid cache on widget `spec.json` when iterating in dev.
  - Public embed serving returns generated static files from `clk.live/{accountPublicId}/{instanceId}`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDITING FLOW                                  │
│                                                                         │
│  ┌─────────┐    GET /api/builder/:instanceId/open                                    ┌──────────────┐        │
│  │   Bob   │ ◄──────────────────────────────── │ Bob/Roma route │        │
│  │ Builder │                                   │ Michael metadata│       │
│  │         │                                   │ + Tokyo config │        │
│  └────┬────┘                                   └──────┬────────┘        │
│       │                                              │                  │
│       │ postMessage                                 │                   │
│       │ { type: 'ck:state-update', state }         │                   │
│       ▼                                             │                   │
│  ┌─────────┐                                        │                   │
│  │ Preview │ ◄── widget.client.js                  │                   │
│  │ iframe  │     from Tokyo                        │                   │
│  └─────────┘                                        │                   │
│       │                                             │                   │
│       │ User clicks Save                            │                   │
│       │                                             ▼                   │
│       └──────────────────────────────────────► ┌──────────────┐        │
│            PUT /api/account/instances/:instanceId                                     │ Tokyo saved    │      │
│                                                │   revision      │      │
│                                                └──────┬─────────┘        │
│                                                       │                  │
│                                                       ▼                  │
│                                                  ┌──────────────┐        │
│                                                  │ Tokyo-worker │        │
│                                                  │ explicit     │        │
│                                                  │ sync         │        │
│                                                  └──────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           EMBED FLOW                                    │
│                                                                         │
│  ┌──────────────┐   GET clk.live/{accountPublicId}/{instanceId}       │
│  │ Third-party  │ ──────────────────────► ┌─────────┐ ───► ┌─────────┐ │
│  │   Website    │                         │ Static  │      │  Tokyo  │ │
│  └──────────────┘ ◄────────────────────── │  Edge   │ ◄─── │   R2    │ │
│                                           └─────────┘      └─────────┘ │
│                     SSR HTML + bootstrapped state                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Roma host flow (current)

- Roma does not rely on Bob URL-bootstrap for normal Builder opens.
- Roma resolves selected instance from URL path (`/builder/:instanceId`) and keeps that as the single active selection source.
- Roma preloads the instance + compiled payload, then opens Bob via one `ck:open-editor` message and waits only for Bob to confirm it applied the open payload or report a real open failure.

### AI Copilot Flow (Current)

Copilot execution is a separate, budgeted flow that never exposes provider keys to the browser.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI COPILOT FLOW                               │
│                                                                         │
│  Account-mode Builder:                                                  │
│    Browser UI (Bob iframe) → Roma instance-scoped copilot route         │
│    → SanFrancisco /v1/execute                                            │
│                                                                         │
│  Outcomes (keep/undo/CTA clicks):                                       │
│    Browser → Roma same-origin outcome route                             │
│           → POST /v1/outcome (SanFrancisco, signed)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

Notes:

- `envStage` is stamped into grants by the active trusted issuer path (Roma on the live product path) so San Francisco can index learning data by exposure stage.
- San Francisco stores raw interaction payloads in R2 and indexes a queryable subset in D1 (see `documentation/ai/learning.md`).
- Deployment contract: account Builder Copilot executes through Roma instance routes, not Bob same-origin AI routes.

---

## Account Builder Open/Edit/Save Architecture

On the active account authoring path, the widget document exists in exactly 2 places during editing:

1. **Tokyo saved revision** — persisted document truth
2. **Bob's React state** — working copy (`instanceData`)

**The Pattern:**

```
1. Load:    GET /api/builder/:instanceId/open  → Roma gets the saved widget and opens Bob once
2. Edit:    All changes in React state   → ZERO API calls
3. Preview: postMessage to iframe        → widget.client.js updates DOM
4. Save: Roma-hosted Builder sends an account mutation command to Roma, and Roma executes `PUT /api/account/instances/:instanceId` → commits the one widget document to Tokyo and returns immediately
```

In Roma account flows, the host performs the initial load call and sends Bob one resolved `ck:open-editor` payload. Save returns through that same Roma account boundary.

Builder no longer mounts a localization authoring lane on this path. Translation and runtime convergence are downstream follow-up work, not part of the user meaning of Save.

Preview reflects the widget Bob is editing. It is not a second widget-shaped state.

**Between load and save:** Zero base-config writes. 10,000 users editing = 10,000 in-memory states, no server load for base config.

---

## Widget Runtime Architecture

### Tokyo Widget Folder

Each widget type has a complete authored definition in the repo and a deployed R2 home under `product/widgets/{widgetType}/`:

```
tokyo/product/widgets/{widgetType}/
├── spec.json          # Defaults + ToolDrawer DSL
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
└── agent.md           # AI contract (required for AI editing)
```

Friendly `/widgets/{widgetType}/...` URLs are route aliases. They must resolve to `product/widgets/{widgetType}/...` in R2 and must not create a root `widgets/` storage authority.

### Shared Runtime Modules

All widgets use shared modules from `tokyo/product/widgets/shared/`:

| Module          | Global Function                                                               | Purpose                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fill.js`       | `CKFill.toCssBackground(fill)` / `CKFill.toCssColor(fill)`                    | Resolve fill configs (color/gradient/image/video) to CSS                                                                                                             |
| `header.js`     | `CKHeader.applyHeader(state, widgetRoot)`                                     | Shared header (title/subtitle/CTA) behavior + CSS vars                                                                                                               |
| `surface.js`    | `CKSurface.applyCardWrapper(cardwrapper, scopeEl)`                            | Shared card wrapper vars (border/shadow/radius + inside-shadow layer placement)                                                                                      |
| `stagePod.js`   | `CKStagePod.applyStagePod(stage, pod, scopeEl)`                               | Stage/pod layout, padding, radius, alignment                                                                                                                         |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig, runtimeContext?)` | Typography with dynamic Google Fonts (18 curated fonts), category-grouped picker in Bob, and locale/script fallback stacks resolved by family class (`sans`/`serif`) |
| `branding.js`   | _(self-executing)_                                                            | Injects "Made with Clickeen" backlink + reacts to state updates                                                                                                      |

### Stage/Pod Architecture

All widgets use a consistent wrapper structure:

```html
<div class="stage" data-role="stage">
  <!-- Workspace backdrop -->
  <div class="pod" data-role="pod">
    <!-- Widget surface -->
    <div data-ck-widget="{widgetType}">
      <!-- Widget root -->
      <!-- Widget content -->
    </div>
  </div>
</div>
```

Layout options applied via `CKStagePod.applyStagePod()`:

- **Stage:** background, canvas sizing mode (`wrap`/`fill`/`viewport`/`fixed`), alignment, padding per device (`desktop` + `mobile`, linked or per-side)
- **Pod:** background, padding per device (`desktop` + `mobile`, linked or per-side), corner radius (linked/per-corner), width mode (wrap/full/fixed)

### Preview Protocol

Bob sends state updates to the preview iframe via postMessage:

```javascript
iframe.contentWindow.postMessage(
  {
    type: 'ck:state-update',
    widgetname: 'faq',
    state: instanceData,
    device: 'desktop',
    theme: 'light',
  },
  '*',
);
```

`widget.client.js` listens and calls `applyState(state)` to update DOM in place (no reload).

---

## Bob's Compiler Architecture

The compiler (`bob/lib/compiler/`) transforms `spec.json` into a `CompiledWidget`:

```typescript
interface CompiledWidget {
  widgetname: string;
  displayName: string;
  defaults: Record<string, unknown>;
  panels: Array<{ id: string; label: string; html: string }>;
  controls: Array<{ path: string; kind: string; ... }>;  // AI ops allowlist
  media: { htmlUrl, cssUrl, jsUrl, dieter: { styles[], scripts[] } };
}
```

### Compiler Modules (Auto-Generation)

Located in `bob/lib/compiler/modules/`:

| Module          | Trigger                                   | Generated Panel                                                                                      |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `typography.ts` | `defaults.typography.roles` exists        | Typography panel with font family, size preset, style, weight per role                               |
| `stagePod.ts`   | `defaults.stage` or `defaults.pod` exists | Stage/Pod layout panel with stage canvas mode + per-device padding + radius/width/alignment controls |

### Stencil System

`<tooldrawer-field>` macros are expanded using Dieter component stencils:

- Repo-authored stencil HTML: `tokyo/product/dieter/components/{component}/{component}.html`
- Repo-authored specs: `tokyo/product/dieter/components/{component}/{component}.spec.json`
- Deployed R2 home: `dieter/components/{component}/...`
- Adds `data-bob-path` for binding, `data-bob-showif` for conditionals

---

## Dieter Component Library

16+ specialized components for widget editing:

| Component          | Purpose                           |
| ------------------ | --------------------------------- |
| `toggle`           | Boolean switch                    |
| `textfield`        | Text input                        |
| `slider`           | Numeric range                     |
| `dropdown-actions` | Select from options               |
| `dropdown-fill`    | Color/image picker                |
| `dropdown-edit`    | Rich text with formatting palette |
| `choice-tiles`     | Visual option cards               |
| `segmented`        | Radio-style segments              |
| `tabs`             | Tab navigation                    |
| `object-manager`   | Array add/remove/reorder          |
| `repeater`         | Nested item blocks                |
| `popover`          | Floating panel                    |
| `popaddlink`       | URL input with validation         |
| `textedit`         | Text editing                      |
| `textrename`       | Inline rename                     |
| `button`           | Actions                           |

Each component has: CSS contract, HTML stencil, hydration script, spec.json.

---

## Static Embed Architecture

Public embeds serve generated static files from:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

The serving layer validates the two coordinates, checks a positive browser-file allowlist, rewrites to the matching Tokyo/R2 object under the account instance folder, and returns either the file or 404. It does not compose widgets per request.

---

## Data Flows

### 1. Editing Flow

```
User opens widget → Roma GET /api/builder/:instanceId/open
                  → Roma sends one ck:open-editor payload to Bob
                  → Bob stores in React state
                  → User edits (state changes, postMessage to preview)
                  → User clicks Save
                  → Roma same-origin route writes Tokyo saved revision
                  → Any translation/live follow-up happens outside the Builder save loop
```

### 2. Embed View Flow

```
Visitor loads embed → clk.live/{accountPublicId}/{instanceId}
                    → static serving reads accounts/{accountPublicId}/instances/{instanceId}/index.html
                    → browser loads allowed sibling CSS/JS/assets only
```

### 3. Form Submission Flow

```
Submission proxy path hard-cut in this repo snapshot.
`POST /s/:instanceId` is not an active runtime contract.
```

---

## Performance Budgets

| Metric               | Target | Hard Limit |
| -------------------- | ------ | ---------- |
| Embed size (gzipped) | ≤80KB  | 200KB      |
| Edge TTFB            | ≤100ms | —          |
| TTI (4G)             | <1s    | —          |

---

## Security & Privacy

- **Embeds:** No third-party scripts, no cookies, no storage
- **Secrets:** Supabase service role stays in Berlin/Tokyo-worker where explicitly required; LLM provider keys stay in San Francisco
- **CSP:** Strict; no third-party; `form-action 'self'`

---

## Current Implementation Status

### Widgets Implemented

| Widget | Status      | Notable Patterns                                              |
| ------ | ----------- | ------------------------------------------------------------- |
| FAQ    | ✅ Complete | object-manager → repeater (nested), dropdown-edit (rich text) |

### What's Working

- Bob compiler with stencil expansion
- Deterministic compilation contract (Dieter bundling manifest + no classname heuristics)
- Cloudflare verification as the runtime/product verification plane
- Auto-generated Typography and Stage/Pod panels
- Shared runtime modules (CKStagePod, CKTypography)
- Two-API-Call pattern (base config)
- Ops validation against controls[] allowlist
- Public instance payload assembly moved to Tokyo-worker, with Venice as the thin public runtime proxy
- Dieter component library (16+ components)

### What's Planned

- Venice iframe++ SEO/GEO optimized embed (host JSON‑LD + excerpt injection)
- Prague long-tail SEO surfaces (hubs/spokes/comparisons)
- Additional widget types
