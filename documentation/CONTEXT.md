# CLICKEEN — Context & Reference

**Authoritative Sources:**
1. `documentation/WhyClickeen.md` — What we're building, why, and the three moats
2. `documentation/clickeen-platform-architecture.md` — System architecture and boundaries
3. `documentation/systems/` — System PRDs (Bob, Venice, Paris, Copenhagen, etc.)
4. `documentation/widgets/` — Widget PRDs and JSON schemas

---

## Canonical Concepts

**Widget Definition** (Denver widget folder; previously called “Widget JSON”) — Complete functional software for a widget type (e.g., FAQ, countdown, logo showcase). Lives in **Denver/CDN** (in-repo source: `denver/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, and `agent.md` for AI editing). Platform-controlled; **not stored in Michael** and **not served from Paris**.

**Widget Instance** — User’s specific widget configuration. Stored in **Michael (Supabase/Postgres)** in `widget_instances.config` and linked to `widgets.type` (widget type). Paris exposes this over HTTP as `{ publicId, widgetType, config }`. (Older docs may call these `widgetName` / `instanceData`.)

**The Two-API-Call Pattern** — Bob loads config once via Paris (`GET /api/instance/:publicId`), edits entirely in React state (zero server calls), and publishes once via Paris (`PUT /api/instance/:publicId`). Paris is the gateway; persistence is in Michael.

**The Three Moats:**
1. **AI-Native Architecture** — Structural advantage; competitors would need to rewrite everything from scratch
2. **Product-Led Growth (Viral Loop)** — Every free widget is a distribution channel; compounds exponentially
3. **Design-Led Culture** — Disciplinary advantage requiring taste and craft, not just engineering

Everything else (performance, architecture patterns, code splitting) is table stakes—good execution, not defensible.

---

## Systems (Current)

| System | Purpose | Deploy |
|--------|---------|--------|
| **Prague** | Marketing site + gallery | Edge |
| **Bob** | Builder app | Node.js |
| **Venice** | SSR embed runtime | Edge |
| **Paris** | HTTP API | Node.js |
| **Geneva** | Schema registry (inside Paris) | — |
| **Michael** | Database (Supabase) | Postgres |
| **Dieter** | Design system (tokens, components) | — |
| **Denver** | Asset storage & CDN | — |
| **Atlas** | Edge config cache (read-only) | Vercel Edge Config |

---

## Working with Code

**Before making changes:**
- Read `documentation/WhyClickeen.md` (strategy/vision)
- Read `documentation/clickeen-platform-architecture.md` (system map)
- Read the relevant system PRD (`documentation/systems/{system}.md`)

**Build & Test:**
- `pnpm install` — Install dependencies
- `pnpm build` — Build all packages
- Local development depends on which system you're working on (see system PRDs)

**Key Discipline:**
- Documentation is the source of truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.

---

## Glossary

**Dieter** — Design system. Tokens (spacing, typography, colors), components (button, input, expander), icons. Output is CSS + HTML.

**Bob** — Widget builder. React app that loads widget definitions from Denver (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, publishes via Paris (writes to Michael).

**Venice** — SSR embed runtime. Fetches instance config via Paris and serves embeddable HTML. (In this repo snapshot, Venice renders a safe debug shell; full “render widget definition → HTML” is planned.)

**Paris** — HTTP API gateway (Node.js). Reads/writes Michael using service role; handles instances, tokens, submissions, usage, entitlements. **Paris stores no widget definitions and no instance JSON**; it is a stateless API layer. Browsers never call Paris directly (Venice is the embed front door).

**Michael** — Supabase. PostgreSQL database. Stores widget instances, schemas, templates, submissions, users, usage events.

**Denver** — Asset storage and CDN (local stub in this repo). Hosts Dieter build artifacts and widget definitions/assets; also used for signed URLs for user-uploaded images.

**agent.md** — Per-widget, AI-facing contract. Documents editable paths, parts/roles, enums, and safe list operations so Copilot/agents don’t have to infer meaning from raw HTML/CSS/JS. (Currently used for FAQ; will become standard as AI editing expands.)

**Atlas** — Vercel Edge Config. Read-only runtime. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.
