# CLICKEEN Platform Architecture — Phase 1

This document describes system boundaries, data flows, and how the platform fits together.

**For definitions and glossary:** See `CONTEXT.md`
**For strategy and vision:** See `WhyClickeen.md`
**For system details:** See `systems/*.md`

For debugging reality, follow the “Debugging order” in `CONTEXT.md` (runtime code + DB schema, then deployed Cloudflare config, then docs).

---

## AI-First Company

Clickeen is designed to be **built by AI** and **run by AI**:

| Layer | Responsibility |
|-------|----------------|
| **Human (1)** | Vision, architecture, taste, strategic decisions |
| **AI Coding** | Build product from specs (Cursor, Claude, GPT) |
| **AI Agents (San Francisco)** | Run the company: sales, support, marketing, localization, ops |

**San Francisco is the Workforce OS** — the system that operates the AI agents who run the company.

See: `systems/sanfrancisco.md`, `systems/sanfrancisco-learning.md`, `systems/sanfrancisco-infrastructure.md`

---

## Core Architecture Principles

> Full details: [Clickeen_Architecture_Tenets.md](./Clickeen_Architecture_Tenets.md)

| Principle | Rule |
|-----------|------|
| **No Fallbacks** | Orchestrators never apply default values. If data is missing, the system fails visibly. |
| **Widget Files = Truth** | The 5 files in `tokyo/widgets/{name}/` define everything about a widget. |
| **Orchestrators = Dumb Pipes** | Bob, Paris, Venice pass data unchanged. Widget-specific rules live only in the widget package. |
| **Dieter Tokens** | All colors/typography in widget configs use Dieter tokens by default. Users can override with HEX/RGB. |

---

## System Map

| System | Repo Path | Deploy | Responsibility | Status |
|--------|-----------|--------|----------------|--------|
| **Prague** | `prague/` | Cloudflare Pages | Marketing site, gallery | Placeholder |
| **Bob** | `bob/` | Cloudflare Pages | Widget builder, compiler, ToolDrawer, preview | ✅ Active |
| **Venice** | `venice/` | Cloudflare Workers | SSR embed runtime, pixel, loader | ⚠️ Debug shell |
| **Paris** | `paris/` | Cloudflare Workers | HTTP API, instances, tokens, entitlements | ✅ Active |
| **San Francisco** | `sanfrancisco/` | Cloudflare Workers (D1/KV/R2/Queues) | AI Workforce OS: agents, learning, orchestration | ✅ Phase 1 |
| **Michael** | `supabase/` | Supabase Postgres | Database with RLS | ✅ Active |
| **Dieter** | `dieter/` | (build artifact) | Design system: tokens, 16+ components | ✅ Active |
| **Tokyo** | `tokyo/` | Cloudflare R2 | Widget definitions, Dieter assets, shared runtime | ✅ Active |

---

## Cloudflare Environments (Detailed Spec)

This section specifies the **Cloudflare environment model** and the **canonical runtime surfaces** for Phase 1.

### Environments

There is no “pre‑GA” environment. We use **5 layers**:

| Environment | Purpose | Code source | Exposure model |
|---|---|---|---|
| **Local** | Fast iteration + deterministic debugging | local working tree | developer machine only |
| **Cloud-dev** | End-to-end HTTPS integration & shared debugging | `main` | internal/dev (can break) |
| **UAT** | QA/UAT on real infra | release build | allowlist: Clickeen-owned demo accounts |
| **Limited GA** | Global, limited rollout | release build | ~10% of accounts (mix of countries/ICPs), observe for X days |
| **GA** | Full rollout | release build | 100% of accounts |

### Release process (simple, enforced)

Each release proceeds in 3 steps:
1) **UAT**: release to X Clickeen-owned demo accounts for testing/QA/UAT
2) **Limited GA**: release to ~10% of accounts globally (diverse countries/ICPs), observe for a specified window
3) **GA**: if the release passes Limited GA, roll out to 100%

### Canonical domains (dev + prod)

| System | Cloud-dev | Production |
|---|---|---|
| **Bob** | `https://bob.dev.clickeen.com` | `https://app.clickeen.com` |
| **Prague** | `https://prague.dev.clickeen.com` (optional) | `https://clickeen.com` |
| **DevStudio** | `https://devstudio.dev.clickeen.com` | (internal-only) |
| **Paris** | `https://paris.dev.clickeen.com` | `https://paris.clickeen.com` |
| **Venice** | `https://venice.dev.clickeen.com` | `https://embed.clickeen.com` |
| **Tokyo** | `https://tokyo.dev.clickeen.com` | `https://tokyo.clickeen.com` |
| **San Francisco** | `https://sanfrancisco.dev.clickeen.com` | `https://sanfrancisco.clickeen.com` |

**Fallback origins (when custom domains aren’t configured yet):**
- **Pages**: `{project}.pages.dev`
- **Workers**: `{script}.workers.dev`

### Cloudflare primitives (what we use and why)

| Primitive | Used by | Why |
|---|---|---|
| **Pages** | Prague, Bob, DevStudio | Static + Next.js-style app surfaces; simple deploy model |
| **Workers** | Paris, Venice, San Francisco (and optional Tokyo assets worker) | Edge HTTP services; consistent global runtime |
| **R2** | Tokyo (assets), San Francisco (raw logs) | Cheap object storage, zero egress for CDN patterns |
| **KV** | San Francisco (sessions), Atlas (read-only runtime cache) | Hot key/value state, TTLs |
| **D1** | San Francisco (indexes) | Queryable learning metadata; low-ops SQL |
| **Queues** | San Francisco | Non-blocking logging/ingestion; keep request path fast |
| **Cron Triggers** | San Francisco (later) | Scheduled analysis/maintenance without extra infra |

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
- Bob proxies Paris under same-origin (`/api/paris/*`) using `PARIS_BASE_URL` (preferred).

#### Paris (Workers)
- Stateless API gateway to Michael (Supabase).
- Public endpoints are under `/api/*`.
  - Shipped in this repo snapshot: `GET/PUT /api/instance/:publicId`, `GET /api/instances` (dev tooling), `POST /api/ai/grant`, `POST /api/ai/outcome`.
  - Planned surfaces (not implemented here yet) are described in `documentation/services/paris.md`.

#### Venice (Workers)
- Planned public embed surface (third-party websites only talk to Venice).
- **Current repo snapshot:** `venice/` is a placeholder workspace; embed UX/runtime is not shipped yet.

#### Tokyo (R2 + optional worker)
- Serves widget definitions and Dieter build artifacts (`/widgets/**`, `/dieter/**`).
- **Deterministic compilation contract** depends on `tokyo/dieter/manifest.json`.

#### San Francisco (Workers + D1/KV/R2/Queues)
- `/healthz`, `/v1/execute`, `/v1/outcome`, queue consumer for non-blocking log writes.
- Stores sessions in KV, raw logs in R2, indexes in D1.

### Environment variables (minimum matrix)

| Surface | Variable | Dev | Prod | Notes |
|---|---|---|---|---|
| **Bob (Pages)** | `NEXT_PUBLIC_TOKYO_URL` | `https://tokyo.dev.clickeen.com` | `https://tokyo.clickeen.com` | Compiler fetches widget specs over HTTP (even locally) |
| **Bob (Pages)** | `PARIS_BASE_URL` | `https://paris.dev.clickeen.com` | `https://paris.clickeen.com` | Bob’s same-origin proxy to Paris |
| **Bob (Pages)** | `SANFRANCISCO_BASE_URL` | `https://sanfrancisco.dev.clickeen.com` | `https://sanfrancisco.clickeen.com` | Base URL for Copilot execution (San Francisco); some routes have local fallbacks |
| **Paris (Workers)** | `SUPABASE_URL` | dev project | prod project | Service role access |
| **Paris (Workers)** | `SUPABASE_SERVICE_ROLE_KEY` | dev key | prod key | Never exposed to browsers |
| **Paris (Workers)** | `AI_GRANT_HMAC_SECRET` | dev secret | prod secret | Shared HMAC secret with San Francisco (grant + outcome signatures) |
| **Paris (Workers)** | `SANFRANCISCO_BASE_URL` | `https://sanfrancisco.dev.clickeen.com` | `https://sanfrancisco.clickeen.com` | Used to forward outcomes to `/v1/outcome` |
| **Paris (Workers)** | `ENV_STAGE` | `cloud-dev` | `ga` | Exposure stage stamped into grants for learning attribution |
| **San Francisco (Workers)** | `AI_GRANT_HMAC_SECRET` | dev secret | prod secret | Shared HMAC secret with Paris (grant + outcome signatures) |
| **San Francisco (Workers)** | `DEEPSEEK_API_KEY` | dev key | prod key | Provider key lives only in San Francisco |

**Hard security rule:**
- `PARIS_DEV_JWT` is **local/dev-worker-only** and must never be set in Cloudflare Pages production env vars.

### Cloudflare config checklist (what “done” looks like)

**DNS & custom domains**
- `bob.dev`, `paris.dev`, `tokyo.dev`, `venice.dev`, `sanfrancisco.dev`, `devstudio.dev` point at the corresponding Pages/Workers deployments.
- Production domains (`app`, `paris`, `tokyo`, `embed`, `sanfrancisco`) are configured similarly.

**Pages build settings**
- Node + pnpm versions pinned so cloud builds match local.
- Build command matches workspace build (Turbo fan-out).

**Caching**
- Tokyo (`/dieter/**`, `/widgets/**`) uses long caching for versioned assets; avoid caching `spec.json` aggressively in dev.
- Venice embed HTML uses conservative cache headers for draft vs published instances.

**Access control**
- DevStudio behind Cloudflare Access (required).
- Optional: protect `*.dev` surfaces behind Access during early phases.

**Observability**
- Prefer Cloudflare-native logs/analytics (avoid 3rd-party vendors on embed surfaces).
 
### Deploy discipline (Cloud-dev vs releases)

- **Cloud-dev** auto-deploys from `main` for fast iteration.
- **UAT / Limited GA / GA** are release stages of the same release build, separated by **account-level exposure controls** (allowlist/percentage rollout) and an observation window.

### Security & config (Cloudflare-level defaults)

- **HTTPS everywhere**: redirect HTTP → HTTPS; HSTS enabled on production domains.
- **Dev surfaces protected**: DevStudio (and optionally `*.dev`) behind Cloudflare Access.
- **Secrets isolation**:
  - Provider keys live only in San Francisco.
  - Supabase service role lives only in Paris.
  - `PARIS_DEV_JWT` is **local/dev-worker-only** and must never exist in Pages prod env vars.
- **Caching**:
  - Tokyo assets are long-cacheable when versioned; avoid cache on `spec.json` when iterating in dev.
  - Venice sets conservative cache headers for embed HTML (draft vs published).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EDITING FLOW                                  │
│                                                                         │
│  ┌─────────┐    GET /api/instance/:publicId    ┌─────────┐             │
│  │   Bob   │ ◄──────────────────────────────── │  Paris  │             │
│  │ Builder │                                   │   API   │             │
│  └────┬────┘                                   └────┬────┘             │
│       │                                             │                   │
│       │ postMessage                                 │                   │
│       │ { type: 'ck:state-update', state }         │                   │
│       ▼                                             │                   │
│  ┌─────────┐                                        │                   │
│  │ Preview │ ◄── widget.client.js                  │                   │
│  │ iframe  │     from Tokyo                        │                   │
│  └─────────┘                                        │                   │
│       │                                             │                   │
│       │ User clicks Publish                         │                   │
│       │                                             ▼                   │
│       └──────────────────────────────────────► ┌─────────┐             │
│            PUT /api/instance/:publicId         │ Michael │             │
│                                                │   DB    │             │
│                                                └─────────┘             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           EMBED FLOW                                    │
│                                                                         │
│  ┌──────────────┐    GET /e/:publicId    ┌─────────┐    ┌─────────┐   │
│  │ Third-party  │ ──────────────────────►│ Venice  │───►│  Paris  │   │
│  │   Website    │                        │  Edge   │    │   API   │   │
│  └──────────────┘ ◄──────────────────────└─────────┘    └────┬────┘   │
│                     SSR HTML                                  │        │
│                                                               ▼        │
│                                                          ┌─────────┐   │
│                                                          │ Michael │   │
│                                                          │   DB    │   │
│                                                          └─────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### AI Copilot Flow (Minibob / Bob)

Copilot execution is a separate, budgeted flow that never exposes provider keys to the browser.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI COPILOT FLOW                               │
│                                                                         │
│  ┌──────────────┐   POST /api/ai/sdr-copilot   ┌─────────┐             │
│  │ Browser UI   │ ────────────────────────────►│   Bob   │             │
│  │ (ToolDrawer) │                              │  (API)  │             │
│  └──────┬───────┘                              └────┬────┘             │
│         │                                            │                  │
│         │                         POST /api/ai/grant │                  │
│         │                         (AI Grant)         ▼                  │
│         │                                       ┌─────────┐            │
│         │                                       │  Paris  │            │
│         │                                       │   API   │            │
│         │                                       └────┬────┘            │
│         │                                            │                  │
│         │                     POST /v1/execute (grant│                  │
│         │                     + agentId + input)     ▼                  │
│         │                                       ┌──────────────┐        │
│         │                                       │ SanFrancisco  │        │
│         │                                       │  /v1/execute  │        │
│         │                                       └──────┬───────┘        │
│         │                                              │                │
│         │                                              ▼                │
│         │                                         DeepSeek (LLM)        │
│         │                                                               │
│         │  Response: { message, ops?, meta.requestId, usage }           │
│         ▼                                                               │
│  Bob applies ops strictly (controls allowlist) and requires Keep/Undo   │
│                                                                         │
│  Outcomes (keep/undo/CTA clicks):                                       │
│    Browser → POST /api/ai/outcome (Bob) → POST /api/ai/outcome (Paris)  │
│           → POST /v1/outcome (SanFrancisco, signed)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

Notes:
- `envStage` is stamped into grants by Paris (`ENV_STAGE`) so San Francisco can index learning data by exposure stage.
- San Francisco stores raw interaction payloads in R2 and indexes a queryable subset in D1 (see `systems/sanfrancisco-learning.md`).

---

## Bob's Two-API-Call Architecture

Config exists in EXACTLY 2 places during editing:
1. **Michael (database)** — Published version
2. **Bob's React state** — Working copy (`instanceData`)

**The Pattern:**
```
1. Load:    GET /api/instance/:publicId  → Bob gets published config
2. Edit:    All changes in React state   → ZERO API calls
3. Preview: postMessage to iframe        → widget.client.js updates DOM
4. Publish: PUT /api/instance/:publicId  → Saves to Michael
```

**Between load and publish:** Zero database writes. 10,000 users editing = 10,000 in-memory states, zero server load.

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

| Module | Global Function | Purpose |
|--------|-----------------|---------|
| `stagePod.js` | `CKStagePod.applyStagePod(stage, pod, scopeEl)` | Stage/pod layout, padding, radius, alignment |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig)` | Typography with dynamic Google Fonts (17 curated fonts) |
| `branding.js` | `CKBranding` | "Made with Clickeen" backlink |

### Stage/Pod Architecture

All widgets use a consistent wrapper structure:

```html
<div class="stage" data-role="stage">           <!-- Workspace backdrop -->
  <div class="pod" data-role="pod">             <!-- Widget surface -->
    <div data-ck-widget="{widgetType}">         <!-- Widget root -->
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
iframe.contentWindow.postMessage({
  type: 'ck:state-update',
  widgetname: 'faq',
  state: instanceData,
  device: 'desktop',
  theme: 'light'
}, '*');
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

| Module | Trigger | Generated Panel |
|--------|---------|-----------------|
| `typography.ts` | `defaults.typography.roles` exists | Typography panel with font family, size preset, style, weight per role |
| `stagePod.ts` | `defaults.stage` or `defaults.pod` exists | Stage/Pod layout panel with stage canvas mode + per-device padding + radius/width/alignment controls |

### Stencil System

`<tooldrawer-field>` macros are expanded using Dieter component stencils:
- Stencil HTML: `tokyo/dieter/components/{component}/{component}.html`
- Specs: `tokyo/dieter/components/{component}/{component}.spec.json`
- Adds `data-bob-path` for binding, `data-bob-showif` for conditionals

---

## Dieter Component Library

16+ specialized components for widget editing:

| Component | Purpose |
|-----------|---------|
| `toggle` | Boolean switch |
| `textfield` | Text input |
| `slider` | Numeric range |
| `dropdown-actions` | Select from options |
| `dropdown-fill` | Color/image picker |
| `dropdown-edit` | Rich text with formatting palette |
| `choice-tiles` | Visual option cards |
| `segmented` | Radio-style segments |
| `tabs` | Tab navigation |
| `object-manager` | Array add/remove/reorder |
| `repeater` | Nested item blocks |
| `popover` | Floating panel |
| `popaddlink` | URL input with validation |
| `textedit` | Text editing |
| `textrename` | Inline rename |
| `button` | Actions |

Each component has: CSS contract, HTML stencil, hydration script, spec.json.

---

## Venice Embed Architecture

**Current Status:** Debug shell (renders config JSON). Full SSR rendering planned.

### Endpoints

| Route | Purpose |
|-------|---------|
| `GET /e/:publicId` | SSR widget HTML |
| `/embed/v{semver}/loader.js` | Overlay/popup loader |
| `/embed/pixel` | Usage tracking (fire-and-forget) |

### Caching Strategy

| State | Cache-Control |
|-------|---------------|
| Published | `public, max-age=300, s-maxage=600, stale-while-revalidate=1800` |
| Draft | `public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| Preview (`?ts`) | `no-store` |

### Front-Door Pattern

All third-party embed traffic terminates at Venice:
- Browsers **never** call Paris directly
- Venice validates tokens/branding/entitlements
- Venice proxies to Paris over private channel
- Venice enforces branding flags from Paris responses

---

## Data Flows

### 1. Editing Flow

```
User opens widget → Bob GET /api/instance/:publicId
                  → Paris reads from Michael
                  → Bob stores in React state
                  → User edits (state changes, postMessage to preview)
                  → User clicks Publish
                  → Bob PUT /api/instance/:publicId
                  → Paris writes to Michael
```

### 2. Embed View Flow

```
Visitor loads embed → Venice GET /e/:publicId (planned)
	                    → Venice calls Paris for instance
	                    → Paris reads from Michael
	                    → Venice renders SSR HTML (planned: from Tokyo assets)
	                    → Venice fires usage pixel
```

### 3. Form Submission Flow

```
User submits form → POST /s/:publicId to Venice (planned)
	                  → Venice validates + proxies to Paris
	                  → Paris POST /api/submit/:publicId (planned)
	                  → Paris writes to Michael (widget_submissions)
	                  → Rate limited, no PII in events
```

---

## Plans & Entitlements

Planned (not enforced in this repo snapshot).

| Plan | Active Widgets | Branding | Premium Templates |
|------|----------------|----------|-------------------|
| Free | 1 | Enforced | Preview only |
| Paid | Unlimited | Removable | Full access |

Paris returns effective entitlements; Venice enforces branding flags exactly.

---

## Performance Budgets

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Embed size (gzipped) | ≤80KB | 200KB |
| Edge TTFB | ≤100ms | — |
| TTI (4G) | <1s | — |

---

## Security & Privacy

- **RLS:** Supabase row-level security on all tables
- **Embed tokens:** 128-bit random, rotatable, revocable
- **Rate limiting:** Per-IP and per-instance on writes
- **Embeds:** No third-party scripts, no cookies, no storage
- **Secrets:** Supabase service role in Paris; LLM provider keys in San Francisco
- **CSP:** Strict; no third-party; `form-action 'self'`

---

## Current Implementation Status

### Widgets Implemented

| Widget | Status | Notable Patterns |
|--------|--------|------------------|
| FAQ | ✅ Complete | object-manager → repeater (nested), dropdown-edit (rich text) |

### What's Working

- Bob compiler with stencil expansion
- Deterministic compilation contract (Dieter bundling manifest + no classname heuristics)
- Compile-all widgets gate (`node scripts/compile-all-widgets.mjs`)
- Auto-generated Typography and Stage/Pod panels
- Shared runtime modules (CKStagePod, CKTypography)
- Two-API-Call pattern
- Ops validation against controls[] allowlist
- Paris instance API with entitlements
- Dieter component library (16+ components)

### What's Planned

- Venice full SSR rendering (currently debug shell)
- Prague marketing site
- Additional widget types
