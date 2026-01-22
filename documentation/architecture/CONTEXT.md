# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `documentation/strategy/WhyClickeen.md`.

**PRE‑GA / AI iteration contract (read first):** Clickeen is **pre‑GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions). This does **not** mean “take shortcuts” — build clean, scalable primitives and keep the architecture disciplined. But it **does** mean: avoid public‑facing backward compatibility shims, long‑lived migrations, fallback behavior, defensive edge‑case handling, or multi‑version support unless a PRD explicitly requires it. Assume we can make breaking changes across the stack and update the current widget definitions (`tokyo/widgets/*`), defaults (`spec.json` → `defaults`), and curated local/dev instances accordingly. Prefer **strict contracts + fail‑fast** (clear errors when inputs/contracts are wrong) over “try to recover” logic. For high‑impact changes, still use safety rails (feature flags, rollback switches, and data‑safety checks) when a change can affect runtime behavior.

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
- Contains: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
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
wgt_curated_{widgetType}.{styleSlug}.vNN
Examples:
  wgt_main_faq
  wgt_curated_faq.lightblurs.v01
```

Curated metadata lives alongside the instance (not in the publicId):
```
curated_widget_instances.meta = {
  styleName: "Light Blurs",
  styleSlug: "lightblurs",
  version: 1,
  tags: { icp: ["saas"], objective: ["conversion"], style: ["glass"] }
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
| **Tokyo Worker** | Workspace asset upload + l10n publisher | Cloudflare Workers + R2 | `tokyo-worker/` |
| **Atlas** | Edge config cache (read-only) | Cloudflare KV | — |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, publishes via Paris (writes to Michael). Widget-agnostic: ONE codebase serves ALL widgets.

**Venice** — SSR embed runtime. Fetches instance config via Paris and serves embeddable HTML. Third-party pages only ever talk to Venice; Paris is private.

**Paris** — HTTP API gateway (Cloudflare Workers). Reads/writes Michael using service role; handles instances, tokens, submissions, usage, entitlements. Stateless API layer. Browsers never call Paris directly. Issues AI Grants to San Francisco.

**San Francisco** — AI Workforce Operating System. Runs all AI agents (SDR Copilot, Editor Copilot, Support Agent, etc.) that operate the company. Manages sessions, jobs, learning pipelines, and prompt evolution. See `documentation/ai/overview.md`, `documentation/ai/learning.md`, `documentation/ai/infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores curated instances (`curated_widget_instances`), user instances (`widget_instances`), submissions, users, usage events. RLS enforced for user tables; curated rows are global. Starters use `wgt_main_*` and `wgt_curated_*`.

**Tokyo** — Asset storage and CDN. Hosts Dieter build artifacts, widget definitions/assets, and signed URLs for user-uploaded images.

**Tokyo Worker** — Cloudflare Worker that uploads/serves workspace assets and materializes **instance** l10n overlays into Tokyo/R2.

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
└── agent.md           # AI contract (required for AI editing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

| Module | Global | Purpose |
|--------|--------|---------|
| `stagePod.js` | `CKStagePod.applyStagePod(stage, pod, scopeEl)` | Stage/pod layout (background, padding, radius, alignment) |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig)` | Typography roles with dynamic Google Fonts loading |
| `branding.js` | `CKBranding` | "Made with Clickeen" backlink display |

### Stage/Pod Architecture

- **Stage** = workspace backdrop (container surrounding the widget)
- **Pod** = widget surface (actual widget container)
- All widgets use `.stage > .pod > [data-ck-widget]` wrapper structure
- Layout options: stage canvas mode (`wrap`/`fill`/`viewport`/`fixed`), background (fill picker), padding per device (`desktop` + `mobile`, linked or per-side), corner radius (linked or per-corner), pod width mode (wrap/full/fixed), pod alignment

### Compiler Modules

Bob's compiler (`bob/lib/compiler/`) auto-generates shared functionality:

**Auto-generated from `defaults` declarations:**
- **Typography Panel** — If `defaults.typography.roles` exists, generates font family, size preset, custom size, style, and weight controls per role
- **Stage/Pod Layout Panel** — If `defaults.stage`/`defaults.pod` exists, injects pod width, alignment, padding, radius controls

**Curated Typography:**
- 17 Google Fonts with weight/style specifications
- Dynamic loading via `CKTypography.applyTypography()`
- Role-based size presets (xs/s/m/l/xl/custom)

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
- Prague marketing strings use repo-local base content (`prague/content/base/**`) with layered ops overlays stored in Tokyo (`tokyo/l10n/prague/**`) and applied at runtime (deterministic `baseFingerprint`, no manifest).
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
| FAQ | ✅ Complete | object-manager, repeater, dropdown-edit, toggle, textfield, dropdown-fill, dropdown-actions |

### Dieter Components

`toggle`, `textfield`, `slider`, `dropdown-actions`, `dropdown-fill`, `dropdown-edit`, `choice-tiles`, `segmented`, `tabs`, `object-manager`, `repeater`, `popover`, `popaddlink`, `textedit`, `textrename`, `button`

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
./scripts/dev-up.sh             # Start all (local): Tokyo (4000), Tokyo Worker (8791), Paris (3001), Venice (3003), Bob (3000), DevStudio (5173), Prague (4321), Pitch (8790) (+ SF 3002 if enabled)
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
