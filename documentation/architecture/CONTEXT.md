# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `documentation/strategy/WhyClickeen.md`.

**PRE‑GA / AI iteration contract (read first):** Clickeen is **pre‑GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions). This does **not** mean “take shortcuts” — build clean, scalable primitives and keep the architecture disciplined. But it **does** mean: avoid public‑facing backward compatibility shims, long‑lived migrations, ad‑hoc fallback behavior, defensive edge‑case handling, or multi‑version support unless a PRD explicitly requires it. (Exception: **best‑available localization overlays** are an explicit core contract; missing latest overlays must not break runtime.) Assume we can make breaking changes across the stack and update the current widget definitions (`tokyo/widgets/*`), defaults (`spec.json` → `defaults`), and curated local/dev instances accordingly. Prefer **strict contracts + fail‑fast** (clear errors when inputs/contracts are wrong) over “try to recover” logic. For high‑impact changes, still use safety rails (feature flags, rollback switches, and data‑safety checks) when a change can affect runtime behavior.

**Debugging order (when something is unclear):**
1. Runtime code + `supabase/migrations/` — actual behavior + DB schema truth
2. Deployed Cloudflare config — environment variables/bindings can differ by stage
3. `documentation/services/` + `documentation/widgets/` — operational guides (kept in sync with runtime)
4. `documentation/architecture/Overview.md` + this file — concepts and glossary

Docs are the source of truth for intended behavior; runtime code + schema are the source of truth for what is running. Any mismatch is a P0 doc bug: update the docs immediately to match reality.

**Docs maintenance:** See `documentation/README.md`. Treat doc updates as part of the definition of done for any change that affects runtime behavior, APIs, env vars, or operational workflows.

---

## AI-First Company Architecture

Clickeen is designed from the ground up to be **built by AI** and **run by AI**:

| Layer | Who/What | Responsibility |
|-------|----------|----------------|
| **Vision & Architecture** | 1 Human | Product vision, system design, taste, strategic decisions |
| **Building** | AI Coding (Cursor, Claude, GPT) | Write code from specs and PRDs |
| **Operating** | AI Agents (San Francisco) | Sales, support, marketing, localization, ops |

**San Francisco is the Workforce OS** — not just a feature, but the system that runs the company:

| Agent | Role | Replaces |
|-------|------|----------|
| SDR Copilot | Convert visitors in Minibob | Sales team |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team |
| Content Writer | Blog, SEO, help articles | Content team |
| UI Translator | Product localization | Localization team |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE team |

**All agents learn automatically** — outcomes feed back into the system, improving prompts and examples over time.

See: `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`

---

## Canonical Concepts

### Widget Definition vs Widget Instance

**Widget Definition** (Tokyo widget folder) = THE SOFTWARE
- Complete functional software for a widget type (e.g. FAQ)
- Lives in `tokyo/widgets/{widgetType}/`
- Core runtime files: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
- Contract/metadata in the same folder (used by Paris/Prague): `limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`
- Platform-controlled; **not stored in Michael** and **not served from Paris**

**Widget Instance** = THE DATA
- Instance configuration data (curated or user-owned)
- Stored in Michael:
  - Clickeen-authored baseline + curated: `curated_widget_instances` with `widget_type`
  - User/workspace instances: `widget_instances` with `widget_id` (FK to `widgets`)
- Paris exposes over HTTP as `{ publicId, widgetType, config }`
- Bob holds working copy in memory as `instanceData` during editing

### The Two-API-Call Pattern

Bob makes EXACTLY 2 calls to Paris per editing session for **core instance config**:
1. **Load**: `GET /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` when Bob mounts
2. **Publish**: `PUT /api/workspaces/:workspaceId/instance/:publicId?subject=workspace` when user clicks Publish

`subject` is required on workspace-scoped endpoints (`workspace`, `devstudio`, `minibob`) to resolve editor policy.

In the browser these typically flow through Bob’s same-origin proxy (`/api/paris/instance/:publicId?workspaceId=...&subject=workspace`) which forwards to the workspace-scoped Paris endpoints.

Localization is separate: Bob also calls workspace/instance locale endpoints when translating or applying overlay edits. Those writes are intentional and do **not** publish the base config.

Between load and publish:
- Base config edits happen in Bob's React state (in memory)
- Preview updates via postMessage (no Paris API calls for base config)
- Localization edits persist to overlays via Paris (writes to `widget_instance_overlays`)
- ZERO database writes for base config until Publish
- Base config is not required to be English; Minibob may author base config in the user’s ConversationLanguage.

**Why:** 10,000 users editing simultaneously = no server load for base config. Localization writes are scoped overlays, enabling async translation while preserving user edits. Millions of landing page visitors = zero DB pollution until signup + publish.

### Key Terms

| Term | Description |
|------|-------------|
| `publicId` | Instance unique identifier in DB |
| `widgetType` | Widget identifier referencing the definition (e.g., "faq") |
| `config` | Published instance values (stored in DB; served by Paris) |
| `instanceData` | Working copy of config in Bob during editing |
| `spec.json` | Defaults + ToolDrawer markup; compiled by Bob |
| `agent.md` | AI contract documenting editable paths and semantics |

### Starter Designs (Curated Instances)

**Clickeen does not have a separate gallery-preset content model.** "Starter designs" are Clickeen-authored instances stored in `curated_widget_instances` and exposed in the gallery.

**How it works:**
1. Clickeen team authors baseline + curated instances in DevStudio.
2. Instances use `wgt_main_{widgetType}` (baseline) and `wgt_curated_{curatedKey}` (curated).
3. These instances are published one-way to cloud-dev and surfaced in the gallery.
4. User browses gallery -> clicks "Use this" -> clones to their workspace as a user instance.
5. User customizes their copy freely (full ToolDrawer access).

**Why this approach:**
- **One editor**: Clickeen and users author in Bob; same config schema.
- **Clean separation**: Curated content is global; user instances are workspace-scoped with RLS.
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

| System | Purpose | Runtime | Repo Path |
|--------|---------|---------|-----------|
| **Prague** | Marketing site + gallery | Cloudflare Pages | `prague/` |
| **Bob** | Widget builder app | Cloudflare Pages (Next.js) | `bob/` |
| **Venice** | SSR embed runtime | Cloudflare Pages (Next.js Edge) | `venice/` |
| **Paris** | HTTP API gateway | Cloudflare Workers | `paris/` |
| **San Francisco** | AI Workforce OS (agents, learning) | Workers (D1/KV/R2/Queues) | `sanfrancisco/` |
| **Michael** | Database | Supabase Postgres | `supabase/` |
| **Dieter** | Design system | Build artifacts in Tokyo | `dieter/` |
| **Tokyo** | Asset storage & CDN | Cloudflare R2 | `tokyo/` |
| **Tokyo Worker** | Account-owned asset uploads + l10n publisher + render snapshots | Cloudflare Workers + R2 | `tokyo-worker/` |
| **Atlas** | Edge config cache (read-only) | Cloudflare KV | — |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, publishes via Paris (writes to Michael). Widget-agnostic: ONE codebase serves ALL widgets. Copilot browser entrypoint is `POST /api/ai/widget-copilot` (with legacy `/api/ai/sdr-copilot` compatibility where older deployments still run it).

**Venice** — SSR embed runtime. Fetches instance config via Paris and serves embeddable HTML. Third-party pages only ever talk to Venice; Paris is private.

**Paris** — HTTP API gateway (Cloudflare Workers). Reads/writes Michael using service role; handles instances, tokens, submissions, usage, entitlements. Stateless API layer. Browsers never call Paris directly. Issues AI Grants to San Francisco. Widget-copilot alias routing is policy-driven (`widget.copilot.v1` -> SDR for `minibob|free`, CS for paid/devstudio). **Minibob public mint:** `POST /api/ai/minibob/session` (server‑signed session token) → `POST /api/ai/minibob/grant` (rate‑limited grant for `sdr.widget.copilot.v1`).

**San Francisco** — AI Workforce Operating System. Runs all AI agents (SDR Copilot, Editor Copilot, Support Agent, etc.) that operate the company. Manages sessions, jobs, learning pipelines, and prompt evolution. See `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores curated instances (`curated_widget_instances`), user instances (`widget_instances`), submissions, users, usage events. RLS enforced for user tables; curated rows are global. Starters use `wgt_main_*` and `wgt_curated_*`.

**Tokyo** — Asset storage and CDN. Hosts Dieter build artifacts, widget definitions/assets, and signed URLs for user-uploaded images.

**Tokyo Worker** — Cloudflare Worker that handles account-owned uploads (`/assets/upload`), serves canonical account asset paths (`/arsenale/o/**`, with `/assets/accounts/**` read alias), materializes **instance** l10n overlays into Tokyo/R2, and publishes Venice render snapshots.

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
├── limits.json        # Entitlements caps/flags for Paris validation
├── localization.json  # Locale-layer allowlist (translatable paths)
├── layers/            # Per-layer allowlists (e.g. user.allowlist.json)
└── pages/             # Prague marketing pages (overview/features/examples/pricing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

| Module | Global | Purpose |
|--------|--------|---------|
| `fill.js` | `CKFill.toCssBackground(fill)` / `CKFill.toCssColor(fill)` | Resolve fill configs (color/gradient/image/video) to CSS |
| `header.js` | `CKHeader.applyHeader(state, widgetRoot)` | Shared header (title/subtitle/CTA) behavior + CSS vars |
| `surface.js` | `CKSurface.applyCardWrapper(cardwrapper, scopeEl)` | Shared card wrapper vars (border/shadow/radius + inside-shadow layer placement) |
| `stagePod.js` | `CKStagePod.applyStagePod(stage, pod, scopeEl)` | Stage/pod layout (background, padding, radius, alignment) |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig, runtimeContext?)` | Typography roles with dynamic Google Fonts + locale/script-aware fallback stacks |
| `branding.js` | *(self-executing)* | Injects "Made with Clickeen" badge + reacts to state updates |

### Stage/Pod Architecture

- **Stage** = workspace backdrop (container surrounding the widget)
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
- Instance/content translation uses Tokyo-hosted layered `l10n` overlays (`tokyo/l10n/**`) applied at runtime (set-only ops). Locale layer is primary; user overrides live in layer=user and apply last.
- Prague marketing copy lives in `tokyo/widgets/*/pages/*.json` (single source) with layered ops overlays stored in Tokyo (`tokyo/l10n/prague/**`) and applied at runtime (deterministic `baseFingerprint`, no manifest). Chrome UI strings remain in `prague/content/base/v1/chrome.json`.
- Canonical overlay truth for instances lives in Supabase (`widget_instance_overlays`). Manual overrides live in layer=user (stored in `user_ops`) and are merged at publish time.

Canonical reference:
- `documentation/capabilities/localization.md`

---

## Current Implementation Status

### Systems

| System | Status | Notes |
|--------|--------|-------|
| Bob | ✅ Active | Compiler, ToolDrawer, Workspace, Ops engine |
| Tokyo | ✅ Active | FAQ widget with shared modules |
| Paris | ✅ Active | Instance API, tokens, entitlements, submissions |
| Venice | ✅ Active | SSR embed runtime (published-only), loader, asset proxy (usage/submissions are stubbed in this repo snapshot) |
| Dieter | ✅ Active | 16+ components, tokens, typography |
| Michael | ✅ Active | Supabase Postgres with RLS |

### Widgets

| Widget | Status | Components Used |
|--------|--------|-----------------|
| FAQ | ✅ Active | See `tokyo/widgets/faq/spec.json` (object-manager, repeater, dropdown-edit, toggle, textfield, dropdown-fill, dropdown-actions, choice-tiles) |
| Countdown | ✅ Active | See `tokyo/widgets/countdown/spec.json` |
| Logo Showcase | ✅ Active | See `tokyo/widgets/logoshowcase/spec.json` |

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
bash scripts/dev-up.sh          # Start all (local): Tokyo (4000), Tokyo Worker (8791), Paris (3001), Venice (3003), Bob (3000), DevStudio (5173), Prague (4321), Pitch (8790) (+ SF 3002 if enabled)
                               # Also builds Dieter + i18n and verifies Prague l10n overlays (auto-translates missing overlays when SF is running).
pnpm dev:bob                    # Bob only
pnpm dev:paris                  # Paris only
pnpm dev:admin                  # DevStudio only

# Quality
pnpm lint && pnpm typecheck
pnpm test

# Compilation safety (deterministic)
node scripts/compile-all-widgets.mjs
```

**Local instance data (important):**
- Instances are **not** created by scripts anymore.
- In local dev, create/update instances explicitly from DevStudio Local (`http://localhost:5173/#/dieter/dev-widget-workspace`) via the superadmin actions.

### Environments (Canonical)

| Environment | Bob | Paris | Tokyo | San Francisco | DevStudio |
|---|---|---|---|---|---|
| **Local** | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | (optional) `http://localhost:3002` | `http://localhost:5173` |
| **Cloud-dev (from `main`)** | `https://bob.dev.clickeen.com` | `https://paris.dev.clickeen.com` | `https://tokyo.dev.clickeen.com` | `https://sanfrancisco.dev.clickeen.com` | `https://devstudio.dev.clickeen.com` |
| **UAT** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |
| **Limited GA** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |
| **GA** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |

UAT / Limited GA / GA are **release stages** (account-level exposure controls), not separate infrastructure.

### Deterministic compilation contract (anti-drift)

- **Dieter bundling manifest (authoritative)**: `tokyo/dieter/manifest.json`
- **Rule**: ToolDrawer `type="..."` drives required bundles; CSS classnames never add bundles.
- **Compile-all gate**: `node scripts/compile-all-widgets.mjs` must stay green.

**Key Discipline:**
- Runtime code + DB schema are truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.
