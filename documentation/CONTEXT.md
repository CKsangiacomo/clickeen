# CLICKEEN — Context & Reference

**Authoritative Sources:**
1. `documentation/WhyClickeen.md` — What we're building, why, and the three moats
2. `documentation/clickeen-platform-architecture.md` — System architecture and boundaries
3. `documentation/systems/` — System PRDs (Bob, Venice, Paris, Copenhagen, etc.)
4. `documentation/widgets/` — Widget PRDs and JSON schemas

---

## Canonical Concepts

**Widget JSON** — Complete functional software for a widget type (e.g., FAQ, countdown, logo showcase). Lives in `/paris/lib/widgets/{widgetName}.json`. Contains HTML, uiSchema (ToolDrawer controls), rendering logic, defaults, and templates.

**Widget Instance** — User's specific widget with custom `instanceData`. Stored in database as `{ publicId, widgetName, instanceData }`. Millions of instances can share the same Widget JSON but have different data.

**The Two-API-Call Pattern** — Bob loads instanceData once (`GET /api/instance/:publicId`), edits entirely in React state (zero server calls), and publishes once (`PUT /api/instance/:publicId`). This enables infinite scalability and zero database pollution during editing.

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

**Bob** — Widget builder. React app that loads Widget JSON, holds instanceData in state, renders controls in ToolDrawer, syncs preview via postMessage, publishes to Paris.

**Venice** — SSR widget runtime. Server-side renders Widget JSON with instanceData, handles entitlements, cache policies, security.

**Paris** — HTTP API. Instance management, token validation, submissions, usage tracking. Enforces entitlements. Browsers never call Paris directly (Venice is the front door).

**Michael** — Supabase. PostgreSQL database. Stores widget instances, schemas, templates, submissions, users, usage events.

**Denver** — Asset storage and CDN. Signed URLs for user-uploaded images. Dieter tokens/components published here.

**Atlas** — Vercel Edge Config. Read-only runtime. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.
