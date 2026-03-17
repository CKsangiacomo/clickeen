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
| **Widget Files = Truth**       | Core runtime files + contract files in `tokyo/widgets/{name}/` define widget behavior and validation.                                                                                                                    |
| **Orchestrators = Dumb Pipes** | Bob/Paris/Venice avoid widget-specific logic. They may apply generic, contract-driven transforms (e.g. overlay composition) but must not “fix” state ad hoc.                                                             |
| **Dieter Tokens**              | All colors/typography in widget configs use Dieter tokens by default. Users can override with HEX/RGB.                                                                                                                   |
| **Locale Is Not Identity**     | Locale is a runtime parameter. IDs (`publicId`) must be locale-free; localization is applied via overlays, not DB fan-out.                                                                                               |

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
| **Publish**  | `published.json` (`no-store`)                                          | Render artifacts at `/renders/instances/{publicId}/{fingerprint}/...` (cache forever) |
| **Assets**   | _(authoring stores logical `assetId`; runtime serves `/assets/v/:assetRef`)_ | Asset bytes at `/assets/v/:assetRef`                                                  |
| **Auth**     | JWT (short-lived, refreshable)                                         | userId claim (stable identity)                                                        |
| **Authz**    | HMAC-signed capsule (expires)                                          | Role/account snapshot at issuance                                                     |
| **Overlays** | Layer pointer in DB                                                    | Materialized overlay file on R2 (fingerprinted)                                       |

### Why this matters

**For caching:** The heavy part (artifacts, snapshots, overlay files) caches perfectly — CDN, edge, browser, forever. The mutable part (pointers, JWTs, capsules) is tiny and cheap to fetch fresh. One uncached pointer read, then everything it references hits cache.

**For safety:** Writes produce new artifacts, never modify shared state. If a write fails, nothing changed. If it succeeds, the artifact exists permanently. Rollback is just pointing back to the previous artifact.

**For agents:** An AI agent's loop is verify state, take action, verify result. Pointer reads give deterministic current state. New artifact writes can't corrupt existing data. Pointer flips give binary confirmation. No locks, no race conditions, no partial states.

**For scale:** 10,000 concurrent editors produce 10,000 independent artifacts. No write contention, no coordination between them. The pointer flip is the only serialization point and it's a single atomic write.

### Contrast with traditional SaaS

Traditional systems treat objects as mutable: update in place, invalidate caches everywhere, coordinate distributed reads, handle partial writes, build versioning schemes. Clickeen sidesteps all of this. The pointer is the only mutable thing, and it's trivially small.

This is the same principle that underpins content-addressed storage, Git, and distributed ledgers: if data is immutable and addressed by content, you can distribute it globally and cache it indefinitely without coordination.

Every service section below is an instance of this pattern. Tokyo stores immutable artifacts. Paris flips pointers. Venice reads pointers and serves cached artifacts. Bob creates new artifacts. Roma and DevStudio orchestrate the cycle through different scopes: Roma is the account-scoped member shell, while DevStudio is the internal toolbench for platform work.

---

## System Map

| System            | Repo Path       | Deploy                               | Responsibility                                                          | Status      |
| ----------------- | --------------- | ------------------------------------ | ----------------------------------------------------------------------- | ----------- |
| **Prague**        | `prague/`       | Cloudflare Pages                     | Marketing + SEO surface                                                 | ✅ Active   |
| **Bob**           | `bob/`          | Cloudflare Pages                     | Widget builder, compiler, ToolDrawer, preview                           | ✅ Active   |
| **Roma**          | `roma/`         | Cloudflare Pages                     | Product shell, account domains, Bob host orchestration                  | ✅ Active   |
| **DevStudio**     | `admin/`        | Local Vite                           | Internal toolbench for platform curation, authoring, and verification   | ✅ Internal |
| **Venice**        | `venice/`       | Cloudflare Pages (Next.js Edge)      | SSR embed runtime, pixel, loader                                        | ✅ Active   |
| **Paris**         | `paris/`        | Cloudflare Workers                   | HTTP API, instances, tokens, entitlements                               | ✅ Active   |
| **San Francisco** | `sanfrancisco/` | Cloudflare Workers (D1/KV/R2/Queues) | AI Workforce OS: agents, learning, orchestration                        | ✅ Phase 1  |
| **Pitch**         | `pitch/`        | Cloudflare Workers                   | Investor pitch agent (internal)                                         | ✅ Internal |
| **Michael**       | `supabase/`     | Supabase Postgres                    | Database with RLS                                                       | ✅ Active   |
| **Dieter**        | `dieter/`       | (build artifact)                     | Design system: tokens, 16+ components                                   | ✅ Active   |
| **Tokyo**         | `tokyo/`        | Cloudflare R2                        | Widget definitions (runtime + contracts), Dieter assets, shared runtime | ✅ Active   |
| **Tokyo Worker**  | `tokyo-worker/` | Cloudflare Workers + Queues          | Account-owned asset uploads, l10n publisher, render snapshots           | ✅ Active   |

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
| **Paris**         | `https://paris.dev.clickeen.com`             | `https://paris.clickeen.com`        |
| **Venice**        | `https://venice.dev.clickeen.com`            | `https://embed.clickeen.com`        |
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
| **Workers**       | Paris, Venice, San Francisco (and Tokyo assets worker)    | Edge HTTP services; consistent global runtime            |
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

### Routes & bindings (high level)

#### Bob (Pages)

- **Bob compiles widget specs** by fetching `spec.json` from Tokyo via `NEXT_PUBLIC_TOKYO_URL` (even locally).
- Bob uses named same-origin routes (`/api/instance/:publicId`, `/api/ai/*`) for public/minibob surfaces only. Account-mode bootstrap/authz come from Roma host messaging and same-origin Roma account routes.
- DevStudio local does not use `/api/roma/templates`; it uses its own explicit `/api/devstudio/instances*` and `/api/devstudio/instance*` tool paths for instance discovery, boot, save, localization, and status on the platform-owned account.

#### Roma (Pages)

- Roma is the domain shell (`/home`, `/profile`, `/widgets`, `/templates`, `/builder`, ...).
- Roma resolves identity/account/authz context through `/api/bootstrap` (proxy to Berlin `GET /v1/session/bootstrap`), including an account authz capsule and an account entitlement snapshot.
- Roma exposes person-scoped User Settings through `/profile`, using Berlin-owned `/api/me` same-origin routes.
- In current cloud-dev, Roma usually resolves one effective account context only: the seeded platform-owned account. When the current user has more than one membership, Roma exposes Berlin-backed account switching and does not use browser-side account preference overrides.
- Roma uses named same-origin account routes and injects short-lived authz headers:
  - `x-ck-authz-capsule` for account-scoped calls
- Roma serves Berlin-backed account member reads on same-origin routes (`GET /api/accounts/:accountId/members`).
- Roma Builder embeds Bob with `boot=message` and sends explicit `ck:open-editor` payloads after `bob:session-ready`.

#### DevStudio (Local toolbench)

- DevStudio is the internal toolbench, not a second customer account shell.
- It is the surface where Clickeen runs internal platform work such as curation, authoring, and verification.
- DevStudio can host Bob for curated/admin authoring work, but it must reuse canonical account and content truth instead of inventing a second runtime model.
- In local product profile, DevStudio uses local-only tool routes under `/api/devstudio/*` and resolves a seeded `local-tool` platform context.
- There is no canonical Cloudflare DevStudio runtime. DevStudio is local-only.

#### Paris (Workers)

- Residual health-only Worker stub.
- Public endpoints are under `/api/*`.
- Shipped in this repo snapshot:
  - Health only: `GET /api/healthz`
  - Core account instance open/save now lives only in Bob/Roma same-origin routes; Paris no longer exposes `GET/PUT /api/accounts/:accountId/instance/:publicId?subject=account`.
  - Locale/editor endpoints are Roma-owned and are not mounted in Paris.
  - Roma starter discovery is Roma-owned (`GET /api/roma/widgets?accountId=...`, `GET /api/roma/templates?accountId=...`); Paris no longer mounts those routes.
  - Roma widget commands stay explicit (`POST /api/roma/widgets/duplicate`, `DELETE /api/roma/instances/:publicId`).
  - Paris no longer mounts AI endpoints in the product path under 070A.
  - Venice now owns the public instance payload route (`GET /api/instance/:publicId`) on top of Tokyo live/config artifacts.
- Current cloud-dev account rule:
  - Account creation is Berlin-owned; Paris no longer mounts account creation.
  - MiniBob handoff now starts in a Roma route and completes inside Roma session finish; non-local completion still targets platform-owned accounts only.
  - Instance routing uses `publicId` prefix: `wgt_main_*` marks the instance shown first in MiniBob, `wgt_curated_*` marks other starter instances, `wgt_*_u_*` marks instances in user accounts.
- Product-path base-config writes persist through Bob/Roma same-origin routes to Tokyo; Roma handles translation and published-surface aftermath directly after the save response returns.

#### Venice (Workers)

- Public embed surface (third-party websites only talk to Venice).
- Runtime reads only Tokyo live pointers + fingerprinted config/text/widget bytes.
- Public `/e/:publicId` and `/r/:publicId` do **0** Paris/Supabase calls at request time.
- Public snapshot serving is revision-coherent: Venice reads one published revision and never mixes artifacts from previous revisions.
- If a locale artifact is missing in the current revision, Venice returns unavailable for that locale (no serve-time locale fallback).
- Public `/e/:publicId` and `/r/:publicId` serve snapshots from published pointers only (no public dynamic fallback). Dynamic rendering is restricted to controlled internal bypass.

#### Tokyo (R2)

- Serves widget definitions and Dieter build artifacts (`/widgets/**`, `/dieter/**`).
- **Deterministic compilation contract** depends on `tokyo/dieter/manifest.json`.
- Serves published instance l10n artifacts (`/l10n/**`) written by Roma/Tokyo-worker, including text packs, live pointers, and per-fingerprint base snapshots for diagnostics/non-public tooling.
- Prague website base copy lives in `tokyo/widgets/*/pages/*.json` (single source per page), while localized overlays are served by Tokyo under `/l10n/prague/**` (deterministic `baseFingerprint`, no manifest). Chrome UI strings remain in `prague/content/base/v1/chrome.json`.

#### Tokyo Worker (Workers + Queues)

- Canonical asset management contract (cross-surface behavior): [AssetManagement.md](./AssetManagement.md)
- Handles canonical account-owned uploads (`POST /assets/upload`) and stores asset bytes + manifest metadata in Tokyo R2.
- Paris validates account-owned asset refs on instance writes, but this repo snapshot does not persist a canonical "where used" table in Michael.
- Serves immutable account asset reads (`GET /assets/v/:assetRef`); legacy `/arsenale/*` paths are hard-failed.
- Asset delete is synchronous hard delete (`metadata + blob delete`) with no snapshot rebuild enqueue or runtime healing.
- Tokyo-worker exposes integrity endpoints for managed surfaces (`GET /assets/integrity/:accountId`, `GET /assets/integrity/:accountId/:assetId`).
- Writes l10n text/meta/config packs and live pointers to Tokyo/R2 from Roma-owned aftermath plus Tokyo-worker execution; Tokyo-worker does not read Michael/Supabase to discover overlay state.
- Materializes render snapshots under `tokyo/renders/instances/**` for Venice snapshot fast-path using revisioned indices + atomic published pointer flip.

#### Asset ownership model (canonical)

- Ownership boundary is account (`account_id`).
- End-to-end flow:
  1. Bob uploads to Tokyo-worker (`POST /assets/upload`) with `x-account-id` (+ optional public/widget trace headers).
  2. Tokyo-worker writes blob bytes + per-asset manifest metadata in Tokyo R2 and returns canonical immutable URL (`/assets/v/:assetRef`).
  3. Roma validates account commands at the product boundary and Tokyo/Tokyo-worker enforce canonical asset/config contracts on write.
  4. Roma Assets reads/deletes via Roma asset routes (`/api/assets/:accountId*`) which forward to Tokyo-worker with Berlin session auth; Tokyo-worker enforces account membership role.

#### San Francisco (Workers + D1/KV/R2/Queues)

- `/healthz`, `/v1/execute`, `/v1/outcome`, queue consumer for non-blocking log writes.
- Stores sessions in KV, raw logs in R2, indexes in D1.

### Environment variables (minimum matrix)

| Surface                     | Variable                    | Dev                                     | Prod                                | Notes                                                                            |
| --------------------------- | --------------------------- | --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| **Bob (Pages)**             | `NEXT_PUBLIC_TOKYO_URL`     | `https://tokyo.dev.clickeen.com`        | `https://tokyo.clickeen.com`        | Compiler fetches widget specs over HTTP (even locally)                           |
| **Bob (Pages)**             | `NEXT_PUBLIC_VENICE_URL`    | `https://venice.dev.clickeen.com`       | `https://embed.clickeen.com`        | Bob MiniBob public read shortcut + preview-shadow target                         |
| **Bob (Pages)**             | `SANFRANCISCO_BASE_URL`     | `https://sanfrancisco.dev.clickeen.com` | `https://sanfrancisco.clickeen.com` | Explicit base URL for Copilot execution (San Francisco); no fallback probing |
| **Roma (Pages)**            | `NEXT_PUBLIC_BOB_URL`       | `https://bob.dev.clickeen.com`          | `https://app.clickeen.com`          | Builder iframe origin (no query override; configured per environment)            |
| **Paris (Workers)**         | `ENV_STAGE`                 | `cloud-dev`                             | `ga`                                | Exposure stage stamped into grants for learning attribution                      |
| **San Francisco (Workers)** | `AI_GRANT_HMAC_SECRET`      | dev secret                              | prod secret                         | Shared HMAC secret with Paris (grant + outcome signatures)                       |
| **San Francisco (Workers)** | `DEEPSEEK_API_KEY`          | dev key                                 | prod key                            | Provider key lives only in San Francisco                                         |

**Hard security rule:**

- `CK_INTERNAL_SERVICE_JWT` is a server-only internal bearer. It must never be exposed client-side, but it is required on server-side Roma -> Tokyo/Tokyo-worker and Roma -> San Francisco calls.

**Local auth rule:**

- In local development, Supabase JWT issuer must match the Supabase target Paris is running against (local by default via `dev-up`; remote only when `DEV_UP_USE_REMOTE_SUPABASE=1`).

### Cloudflare config checklist (what “done” looks like)

**DNS & custom domains**

- `bob.dev`, `roma.dev`, `paris.dev`, `tokyo.dev`, `venice.dev`, and `sanfrancisco.dev` point at the corresponding Pages/Workers deployments.
- Production domains (`app`, `paris`, `tokyo`, `embed`, `sanfrancisco`) are configured similarly.

**Pages build settings**

- Node + pnpm versions pinned so cloud builds match local.
- Build command matches repo build (Turbo fan-out).

**Caching**

- Tokyo (`/dieter/**`, `/widgets/**`) uses long caching for versioned assets; avoid caching `spec.json` aggressively in dev.
- Venice uses three cache classes: short-cache embed shell (`/e`), `no-store` live pointers (`/r`, locale/meta live pointers), and immutable fingerprinted packs/assets.

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
| Paris         | `https://paris.dev.clickeen.com/api/healthz`               | `{ "up": true }`                                                     | Paris         |
| Berlin        | `https://berlin-dev.clickeen.workers.dev/internal/healthz` | `{ "ok": true, "service": "berlin" }`                                | Berlin        |
| Tokyo-worker  | `https://tokyo-assets-dev.clickeen.workers.dev/healthz`    | `{ "up": true }`                                                     | Tokyo-worker  |
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
  - `CK_INTERNAL_SERVICE_JWT` stays server-only and must never be exposed client-side, but it is part of the live Roma/Tokyo-worker/San Francisco internal contract.
- **Caching**:
  - Tokyo assets are long-cacheable when versioned; avoid cache on `spec.json` when iterating in dev.
  - Venice serves short-cache shell HTML, `no-store` live pointers, and immutable fingerprinted packs/assets.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDITING FLOW                                  │
│                                                                         │
│  ┌─────────┐    GET /api/accounts/:accountId/instance/:publicId?subject=account    ┌──────────────┐        │
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
│            PUT /api/accounts/:accountId/instance/:publicId?subject=account         │ Tokyo saved    │      │
│                                                │   revision      │      │
│                                                └──────┬─────────┘        │
│                                                       │                  │
│                                                       ▼                  │
│                                                  ┌─────────┐             │
│                                                  │ Paris   │             │
│                                                  │ after-  │             │
│                                                  │ save    │             │
│                                                  └─────────┘             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           EMBED FLOW                                    │
│                                                                         │
│  ┌──────────────┐    GET /e/:publicId    ┌─────────┐    ┌─────────┐   │
│  │ Third-party  │ ──────────────────────►│ Venice  │───►│  Tokyo  │   │
│  │   Website    │                        │  Edge   │    │   R2    │   │
│  └──────────────┘ ◄──────────────────────└─────────┘    └─────────┘   │
│                     SSR HTML + bootstrapped state                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Roma host flow (current)

- Roma does not rely on Bob URL-bootstrap for normal Builder opens.
- Roma resolves selected instance from URL path (`/builder/:publicId`) and keeps that as the single active selection source.
- Roma preloads instance + compiled payload, then opens Bob via `ck:open-editor` in message mode (`boot=message`) and waits for ack/applied/fail responses.

### AI Copilot Flow (Minibob / Bob)

Copilot execution is a separate, budgeted flow that never exposes provider keys to the browser.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI COPILOT FLOW                               │
│                                                                         │
│  Account-mode Builder:                                                  │
│    Browser UI (Bob iframe) → Roma instance-scoped copilot route         │
│    → SanFrancisco /v1/execute                                            │
│                                                                         │
│  MiniBob/public:                                                        │
│    Browser UI → Bob /api/ai/minibob/session                             │
│    Browser UI → Bob /api/ai/widget-copilot                              │
│    → SanFrancisco /v1/execute                                            │
│                                                                         │
│  Outcomes (keep/undo/CTA clicks):                                       │
│    Browser → Roma/Bob same-origin outcome route                         │
│           → POST /v1/outcome (SanFrancisco, signed)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

Notes:

- `envStage` is stamped into grants by Paris (`ENV_STAGE`) so San Francisco can index learning data by exposure stage.
- San Francisco stores raw interaction payloads in R2 and indexes a queryable subset in D1 (see `documentation/ai/learning.md`).
- Deployment contract: local and cloud-dev both use `POST /api/ai/widget-copilot` as the single Copilot endpoint.

---

## Base-Config Two-Call Architecture

Base config exists in EXACTLY 3 places during editing:

1. **Tokyo saved snapshot** — Persisted saved revision base
2. **Michael (database)** — Compatibility/account row copy during cutover
3. **Bob's React state** — Working copy (`instanceData`)

**The Pattern:**

```
1. Load:    GET /api/accounts/:accountId/instance/:publicId?subject=account  → host (message boot) gets saved config through Roma same-origin routes
2. Edit:    All changes in React state   → ZERO API calls
3. Preview: postMessage to iframe        → widget.client.js updates DOM
4. Save: Roma-hosted Builder sends an account mutation command to Roma, and Roma executes `PUT /api/accounts/:accountId/instance/:publicId?subject=account`  → Commits to Tokyo first, then runs direct Roma-owned aftermath against Berlin/Tokyo/San Francisco/Tokyo-worker without rolling back the saved revision

Snapshot/l10n convergence is observed via:
- `GET /api/accounts/:accountId/instances/:publicId/l10n/status`
```

In Roma/DevStudio message-boot account flows, the host performs the initial load call and sends Bob a resolved `ck:open-editor` payload. Save, localization rehydrate, and l10n status reads also return through the host boundary before hitting the Roma account routes.

`subject` is required on editor endpoints (`account`, `minibob`) to resolve policy.

Localization is separate: overlay edits write through Roma into Tokyo/Tokyo-worker and do not touch the base config.

**Between load and save:** Zero base-config writes. 10,000 users editing = 10,000 in-memory states, no server load for base config.

---

## Widget Runtime Architecture

### Tokyo Widget Folder

Each widget type has a complete definition in Tokyo:

```
tokyo/widgets/{widgetType}/
├── spec.json          # Defaults + ToolDrawer DSL
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
└── agent.md           # AI contract (required for AI editing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

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
  assets: { htmlUrl, cssUrl, jsUrl, dieter: { styles[], scripts[] } };
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

- Stencil HTML: `tokyo/dieter/components/{component}/{component}.html`
- Specs: `tokyo/dieter/components/{component}/{component}.spec.json`
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

## Venice Embed Architecture

**Current Status:** Shipped DB-free public embed runtime. Venice assembles `/e/:publicId` from Tokyo-only bytes and published-only pointers. Submission routes are hard-cut; `/embed/pixel` remains a compatibility no-op (`204`).

### Endpoints

| Route                                | Purpose                                   |
| ------------------------------------ | ----------------------------------------- |
| `GET /e/:publicId`                   | Embed shell HTML + runtime bootstrap      |
| `GET /r/:publicId`                   | Published live pointer proxy (`no-store`) |
| `GET /r/:publicId?meta=1&locale=...` | SEO/GEO meta pointer proxy (`no-store`)   |
| `/embed/latest/loader.js`            | Canonical loader alias                    |
| `/embed/v2/loader.js`                | Versioned loader                          |
| `/embed/pixel`                       | Compatibility no-op (`204`)               |

### Caching Strategy

| Artifact                                        | Cache-Control                         |
| ----------------------------------------------- | ------------------------------------- |
| `/e/:publicId` shell HTML                       | `public, max-age=60, s-maxage=86400`  |
| Live pointers (`/r`, locale/meta live pointers) | `no-store`                            |
| Fingerprinted packs + widget assets             | `public, max-age=31536000, immutable` |

### Front-Door Pattern

All third-party embed traffic terminates at Venice:

- Browsers **never** call Paris directly
- Venice fetches only Tokyo live pointers and immutable runtime bytes
- Paris + Tokyo-worker publish those bytes ahead of time during save/publish flows
- If required Tokyo bytes are missing, Venice returns unavailable instead of healing or falling back

---

## Data Flows

### 1. Editing Flow

```
User opens widget → Host (Roma/DevStudio message boot) GET instance core, or Bob URL boot for non-account surfaces only
                  → Roma same-origin route or DevStudio internal-tool route reads Tokyo saved revision
                  → Bob stores in React state
                  → User edits (state changes, postMessage to preview)
                  → User clicks Save
                  → Roma same-origin route or DevStudio internal-tool route writes Tokyo saved revision
                  → Paris runs explicit translation sync and explicit published-surface sync
                  → Paris/Tokyo-worker refresh Tokyo config/text/meta/live-pointer bytes when the instance is live
```

### 2. Embed View Flow

```
Visitor loads embed → Venice GET /e/:publicId
                    → Venice GET /r/:publicId (Tokyo live pointer)
                    → Venice GET Tokyo config pack + locale text pointer + text pack + widget HTML
                    → Venice returns SSR HTML / bootstraps CK_WIDGET
                    → optional /embed/pixel remains a no-op (`204`)
```

### 3. Form Submission Flow

```
Submission proxy path hard-cut in this repo snapshot.
`POST /s/:publicId` and Paris `/api/submit/:publicId` are not active runtime contracts.
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
- **Secrets:** Supabase service role stays in Paris; LLM provider keys stay in San Francisco
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
- Compile-all widgets gate (`node scripts/compile-all-widgets.mjs`)
- Auto-generated Typography and Stage/Pod panels
- Shared runtime modules (CKStagePod, CKTypography)
- Two-API-Call pattern (base config)
- Ops validation against controls[] allowlist
- Paris instance API with entitlements
- Dieter component library (16+ components)

### What's Planned

- Venice iframe++ SEO/GEO optimized embed (host JSON‑LD + excerpt injection) + submission/pixel wiring
- Prague long-tail SEO surfaces (hubs/spokes/comparisons)
- Additional widget types
