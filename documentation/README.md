# Documentation — How To Use (and Keep Current)

This folder is the primary knowledge base for working in the Clickeen repo (especially for AI coding agents). It is a **living reference**: it must be updated alongside code changes.

Docs are not a "single source of truth". When docs and code disagree, debug using runtime code + DB schema + deployed Cloudflare config, then update the docs to match reality.

---

## Structure

```
documentation/
├── strategy/                 # WHY — Vision, moats, business model
│   ├── WhyClickeen.md       # Vision, AI-first, strategic moats
│   └── GlobalReach.md       # 100⁵ scale model
│
├── architecture/             # HOW — Platform design, principles
│   ├── CONTEXT.md           # Current state, glossary, what exists
│   ├── Tenets.md            # Architectural principles
│   └── Overview.md          # Platform diagram, data flow
│
├── services/                 # RUNTIME SYSTEMS
│   ├── bob.md               # Editor
│   ├── roma.md              # Product shell + Builder host
│   ├── dieter.md            # Design system
│   ├── devstudio.md         # Internal tools (admin)
│   ├── tokyo.md             # Asset CDN
│   ├── tokyo-worker.md      # Asset uploads + l10n publisher
│   ├── paris.md             # API/database
│   ├── sanfrancisco.md      # AI workforce OS
│   ├── venice.md            # Embed runtime
│   ├── michael.md           # Database schema
│   └── prague/              # Marketing surface
│       ├── prague-overview.md
│       ├── blocks.md
│       └── layout.md
│
├── capabilities/             # CROSS-CUTTING FEATURES
│   ├── supernova.md         # NextGen web design effects
│   ├── seo-geo.md           # SEO/GEO platform
│   ├── localization.md      # i18n + l10n (runtime contract)
│   └── multitenancy.md      # Team/workspace model
│
├── ai/                       # AI ARCHITECTURE
│   ├── overview.md          # San Francisco platform
│   ├── infrastructure.md    # Cloudflare infra
│   ├── learning.md          # How agents learn
│   ├── widget-copilot-rollout.md # SDR/CS rollout status + verification matrix
│   ├── agents/
│   │   ├── sdr-copilot.md   # Widget Copilot contract (SDR + CS routing)
│   │   ├── ux-writer.md     # UX Writer agent
│   │   ├── gtm.md           # GTM agent
│
└── widgets/                  # WIDGET SPECS
    ├── WidgetBuildContract.md # Normative build contract
    ├── WidgetComplianceSteps.md # Execution checklist
    ├── WidgetArchitecture.md # System-level reference
    └── {widget}/            # Per-widget specs
        └── {widget}_PRD.md
```

| Folder | What It Answers |
|--------|-----------------|
| **strategy/** | WHY are we building this? |
| **architecture/** | HOW is it designed? |
| **services/** | WHAT systems run? |
| **capabilities/** | WHAT features span systems? |
| **ai/** | WHO runs the company? (AI workforce) |
| **widgets/** | WHAT do we ship? |

---

## Documentation vs Execution_Pipeline_Docs (non‑equivalent)

There are **two doc roots** in the repo and they are intentionally different:

- `documentation/` = **current system truth**. It must match runtime code + schema + deployed config. If it drifts, fix it immediately.
- `Execution_Pipeline_Docs/` = **process artifacts** (planning → executing → executed). It records intent and history and can be stale by design.

Use `documentation/` for authoritative behavior; use `Execution_Pipeline_Docs/` for context on how/why decisions were made.

---

## AI-Native Operating Model (agent contract)

This repo is operated by **1 human architect + multiple AI dev teams**. The system is modular and contract-driven so AIs can work in parallel safely.

- **Modular surfaces:** widgets in `tokyo/widgets/`; services isolated under `bob/`, `roma/`, `admin/`, `prague/`, `paris/`, `venice/`, `tokyo-worker/`, `sanfrancisco/`.
- **Explicit contracts:** `spec.json`, `agent.md`, `*.allowlist.json`, PRDs, and service docs define what is safe to change. If it is not in a contract, assume it is unsafe.
- **Automation intent:** local changes are designed to propagate through the local stack automatically. Cloud-dev propagation is explicit (promote/deploy).
- **Agent expectation:** AIs must understand the end-to-end journey below. If you do not, stop and re-trace from code before editing.

---

## End-to-End Journey (widget folder → Roma/DevStudio/Bob/Prague → cloud-dev)

### A) Widget definition path (local)
Source of truth: `tokyo/widgets/{widget}/` (spec + runtime + marketing JSON).

1) **Local Tokyo CDN stub** serves the widget folder:
   - `tokyo/dev-server.mjs` -> `http://localhost:4000`
   - Serves `/widgets/**` and `/dieter/**` directly from the repo.
2) **Local Bob** reads widget definitions from Tokyo:
   - `bob/lib/env/tokyo.ts` resolves `NEXT_PUBLIC_TOKYO_URL` -> `http://localhost:4000` in dev.
3) **Local DevStudio** embeds Bob and reads the same Tokyo base:
   - `admin/src/html/tools/dev-widget-workspace.html` resolves Tokyo to `http://localhost:4000` on localhost.
4) **Local Roma** resolves workspace bootstrap from local Paris and hosts Bob in message boot mode:
   - `roma/app/api/bootstrap/route.ts` → local Paris `/api/roma/bootstrap`
   - `roma/components/builder-domain.tsx` sends `ck:open-editor` to Bob after `bob:session-ready`.
5) **Local Prague** loads widget marketing JSON from the repo:
   - `prague/src/lib/markdown.ts` bundles `tokyo/widgets/**/pages/*.json`.
   - `PUBLIC_TOKYO_URL=http://localhost:4000` provides tokens + overlay fetch base.

Result: editing `tokyo/widgets/**` immediately changes **local** Bob + Roma + DevStudio + Prague.

### A.1) Local auth issuer alignment (critical)
Local app servers use the Supabase target chosen by `bash scripts/dev-up.sh`:
- Default: local Supabase (`http://127.0.0.1:54321`)
- Optional override: remote Supabase (`DEV_UP_USE_REMOTE_SUPABASE=1` + `.env.local` credentials)

Invariant:
- The Supabase JWT used against local Paris/Bob/Roma must be issued by the **same** Supabase project Paris is configured to use.
- If you use a token from a different Supabase project, Paris returns `403 AUTH_INVALID issuer_mismatch` by design.

### B) Instance + asset path (local)
Instances are data (not code) and live in Paris/Michael. Assets live in Tokyo.

1) **Roma + Bob handle workspace user-instance flows**:
   - Roma Widgets/Templates can create/duplicate/delete user instances via Paris.
   - Bob publish writes base config via workspace `PUT`.
2) **DevStudio Local handles curated/main authoring** (superadmin-only actions) via Paris + Tokyo.
3) **Assets** referenced in configs point at local Tokyo (localhost:4000).
4) **Venice embeds** render curated/user instances using Paris + Tokyo (local URLs).

### C) Cloud-dev propagation (explicit)
Local changes do not auto-appear in cloud-dev. You must promote or deploy.

1) **Curated instances + assets**:
   - Use DevStudio **Promote Cloud** action (local DevStudio -> cloud Paris/Tokyo).
   - Promotion rewrites local Tokyo URLs to cloud Tokyo URLs.
2) **Prague/Bob/Roma/DevStudio**:
   - Code changes require Cloudflare deploys (Pages/Workers).
   - Cloud Prague/Bob/Roma read `https://tokyo.dev.clickeen.com`, not your local filesystem.
3) **Marketing JSON updates**:
   - `tokyo/widgets/**/pages/*.json` updates require a Prague deployment to be visible in cloud-dev.

Invariant: **Local propagation is automatic; cloud-dev propagation is explicit.** Treat any assumption otherwise as a bug.

---

## Update Rules (what must be kept in sync)

If you change runtime behavior, update docs in the same PR/commit:

- **New/changed endpoints**
  - Update the owning system doc (`documentation/services/{system}.md`)
  - Update any cross-system flow diagrams (`documentation/architecture/Overview.md`)
- **New env vars / Cloudflare bindings**
  - Update the owning system doc + relevant runbooks
  - Never document actual secret values (names only)
- **Build/deploy changes**
  - Update the system doc and any operational runbooks
- **Copilot/AI behavior changes**
  - Update `documentation/ai/*.md` (UX + contract)
- **Widget spec/runtime changes**
  - Update the widget PRD under `documentation/widgets/{WidgetName}/`
  - If it affects shared runtime (stage/pod/typography/branding), update `documentation/architecture/CONTEXT.md`
- **Capability changes (Supernova, SEO/GEO, multitenancy)**
  - Update `documentation/capabilities/{capability}.md`
- **Prague strings localization pipeline**
  - Update `documentation/capabilities/localization.md` + `documentation/services/prague/*.md`
- **Instance l10n / locale resolution**
  - Update `documentation/capabilities/localization.md` + `documentation/services/venice.md` (and `documentation/capabilities/seo-geo.md` when schema/excerpt behavior changes)

---

## Security rules for docs

- Never commit or paste real secrets into docs (`AI_GRANT_HMAC_SECRET`, API keys, Supabase keys, JWTs, etc.).
- Use placeholders: `<secret>`, `<token>`, `<baseUrl>`, `wgt_...`.
- If an endpoint requires auth, describe the header shape, not the value.

---

## Drift Detection (cheap checks)

- Copilot regression suite (golden set): `pnpm eval:copilot`
- Compiler determinism: `node scripts/compile-all-widgets.mjs`
- Quick grep for removed/renamed surfaces:
  - `rg -n "/api/ai/|/v1/execute|SANFRANCISCO_BASE_URL|AI_GRANT_HMAC_SECRET" documentation`
  - `rg -n "claims/minibob/complete|/api/workspaces/.*/assets|GET /api/instances|PUT /api/instance/:publicId|POST /api/instance\\b" documentation --glob '*.md'`
  - `rg -n "/api/roma/bootstrap|/api/roma/widgets|/api/minibob/handoff/start|/api/minibob/handoff/complete|/api/accounts/:accountId/assets" documentation --glob '*.md'`

When drift is found: update docs to match the shipped code/config immediately; treat mismatches as P0 doc bugs.
