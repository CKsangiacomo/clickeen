# CONTEXT.md

STATUS: INFORMATIVE — CONTEXT ONLY  
Do NOT implement from this file. For specifications, see:
1) documentation/dbschemacontext.md (DB Truth)
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase‑1 Contracts)
3) documentation/CRITICAL-TECHPHASES/Techphases.md (Architecture & Global Contracts)
4) documentation/systems/<System>.md (System PRD, if Phase‑1)

CRITICAL P0 — documentation/ is the single source of truth for all AI & human work. You MUST read and follow it. If you see discrepancies, STOP and ask for alignment.

---

## AUTHORITY & PRECEDENCE (HIGH-LEVEL)

- **dbschemacontext.md** — NORMATIVE DB Truth; code must match.  
- **CRITICAL-TECHPHASES/Techphases-Phase1Specs.md** — NORMATIVE Phase‑1 Contracts.  
- **documentation/systems/<System>.md** — NORMATIVE PRDs for Phase‑1 systems.  
- **CRITICAL-TECHPHASES/Techphases.md** — NORMATIVE architecture & phase roadmap.  
- **WhyClickeen.md** — INFORMATIVE strategy context.

Clarifier: System PRDs are canonical for concrete endpoints and payload details in their surface. If any detail conflicts with Phase‑1 Contracts, Phase‑1 Contracts win. On any conflict: **DB Truth > Phase‑1 Contracts > System PRDs > Techphases > WhyClickeen.**

Known exceptions (Phase‑1):
- Atlas (Edge Config) is read-only at runtime by policy. Administrative overrides require INTERNAL_ADMIN_KEY and explicit CEO approval; treat Atlas as read-only unless directed otherwise.
- If a referenced `documentation/systems/<System>.md` file is missing or incomplete, do **not** guess. Implement strictly from Phase‑1 Contracts and DB Truth, and escalate to the CEO for the missing PRD.

---

## DB SCHEMA POLICY (POINTER)

- dbschemacontext.md is canonical (Supabase dump by CEO).  
- Engineers may request schema changes with motivation + exact DDL.  
- Until updated by CEO, always code to the dump. **No schema-in-code drift.**

---

# We're Building CLICKEEN (A SaaS Platform)

**Team:**  
- CEO (Human)  
- Principal Full Stack Engineer (Codex AI) 
- Principal Full Stack Engineer (Claude AI)  
- Principal Full Stack Engineer (ChatGPT AI)  

---

## Communication Guidelines

**When talking to CEO/Human be considerate of:**  
- a) Talking to the CEO  
- b) Be thorough in your statements/assertions  
- c) Don't be verbose  

---

## Development Workflow (Current)

- **Codex/Git AIs** implement with full repository visibility in VS Code.
- **Claude/GPT** review PRDs and cross-doc consistency; they do not execute code changes.
- **PRDs & Phase-1 Specs** are the single source of truth; no guessing, no placeholders.
- **Change control:** Any new behavior or surface requires CEO approval plus PRD updates in the same PR.

---

## Prompting AIs

**PRINCIPAL FULL STACK ENGINEER MODE:**  
- No guessing, no assumptions. You're reliable and don't make mistakes.  
- If context is missing, ask human to paste the relevant .md from /docs.  
- Use documentation/ as the single source of truth.  
- No placeholders — if you don't know, you ask.  
- If in doubt about speed or scale, always ask for peer review.  

**Discipline rules:**  
1. **No over-engineering** — stay boring and aligned with frozen process.  
2. **No skipping Techphases** — freeze scope first, then execute.  
3. **Security** — must be reflected in Techphases before engineering; no bolting on mid-way.  

Takeaway: **Always check/update Techphases, Context, and the decision log BEFORE execution.**

---

## Codename Map (Phase-1, Frozen)

- **Paris** — HTTP API (`paris/`, Vercel project c-keen-api)  
- **Venice** — Embed Runtime (`venice/`, Vercel project c-keen-embed)  
- **Bob** — Builder app and shell (`bob/`, Vercel project c-keen-app; hosts `/bob`, configuration flows, previews, claim)  
- **Prague** — Marketing Site (`prague/`, Vercel project c-keen-site)  
- **Atlas** — Config & Cache Layer (Vercel Edge Config; read-only at runtime. Administrative writes require INTERNAL_ADMIN_KEY.)  
- **Phoenix** — Idempotency Layer (server-side idempotency enforcement)  
- **Berlin** — Observability & Security (logs/metrics/rate limits for app/site surfaces only; never in embeds or API)  
- **Cairo** — Custom Domains (provisioning, auto-HTTPS)  
- **Denver** — Asset Storage & CDN (public/private assets, signed URLs)  
- **Dieter** — Design System (tokens, foundations, components; embeds output SSR HTML/CSS only)  
- **Geneva** — Schema Registry (widget/template config schemas, validation)  
- **Michael** — Data Plane (Postgres + RLS; authoritative DB)

**Future Systems (not Phase-1; informative only):**  
- **Copenhagen** — AI Orchestration (Phase-2)  
- **Helsinki** — Analytics Warehouse (Phase-2/3)  
- **Lisbon** — Email/Notifications (Phase-2)  
- **Robert** — Notification Router (Phase-2)  
- **Tokyo** — Job/Workflow Orchestrator (Phase-2)

---

## Phase Status (Phase-1 frozen)

**Built in Phase-1:**  
- `prague/` (**Prague**) — marketing pages + gallery  
- `bob/` (**Bob**) — builder app (shell + editor; includes configuration flows and claim workflows)  
- `venice/` (**Venice**) — public SSR embed runtime + preview endpoints  
- `paris/` (**Paris**) — HTTP API (instances, tokens, entitlements, submissions, usage)  
- **Atlas** — Edge Config (read-only runtime; administrative writes gated by INTERNAL_ADMIN_KEY)  
- **Berlin** — logs/metrics/rate limits in `c-keen-app` (and `c-keen-site` if enabled); **never** in `c-keen-embed`  
- **Cairo**, **Denver**, **Dieter**, **Geneva**, **Michael**, **Phoenix** — active as part of Phase-1 scope

**Not built in Phase-1 (do not start without explicit CEO approval):**  
- Billing & subscriptions (beyond stub)  
- Workflow automation (Tokyo/Robert/Lisbon)  
- Fine-grained RBAC (multi-role workspaces)  
- Runtime writes to Edge Config (must remain administrative-only with INTERNAL_ADMIN_KEY)  
- Analytics warehouse (Helsinki)  
- AI orchestration (Copenhagen)

---

## Rules of Engagement (for all AIs & humans)

1. **Read documentation/** first. If unclear, **ask**; do not guess.  
2. **No placeholders.** If a value is unknown, stop and request it.  
3. **Service boundaries are hard:** embed ≠ api ≠ app ≠ site.  
4. **Secrets live only in c-keen-api** (server surface).  
5. Edge Config is read-only at runtime; administrative updates require INTERNAL_ADMIN_KEY.  
6. When changing behavior or surface area: secure explicit CEO approval and update docs in the same PR.  

---

## Where Things Live

- **Monorepo**: pnpm workspaces + Turbo (root `package.json` is the SoT)  
- **Deploy projects (Vercel)**:  
  - `c-keen-site` → `prague/` (**Prague**)  
  - `c-keen-app` → `bob/` (**Bob builder app + shell; Cairo, Berlin live here**)  
  - `c-keen-embed` → `venice/` (**Venice, Atlas**)  
  - `c-keen-api` → `paris/` (**Paris, Geneva, Phoenix**)  
- **Supabase**:  
  - **Michael** (Postgres + RLS)  
  - **Copenhagen** (future AI orchestration)  
  - **Helsinki** (future analytics warehouse)

---

## Canonical Docs (Start Here)

- `documentation/CRITICAL-TECHPHASES/Techphases.md` — frozen Phase-1 scope & phase gates  
- `documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md` — locked Phase-1 contracts  
- `documentation/dbschemacontext.md` — DB Truth (schema/tables)  
- `documentation/systems/*.md` — system PRDs (Venice, Paris, Geneva, etc.)  
- `documentation/WhyClickeen.md` — strategic context  
- `documentation/ADRdecisions.md` — authoritative decisions (document new approvals here)  
- `documentation/verceldeployments.md` — env/keys per project

---

## AI Consumption Guide

- **Start with WhyClickeen.md** for context (strategy, PLG motion). INFORMATIVE only.  
- **Use Techphases.md** for architecture (systems vs services, scope, boundaries).  
- **Implement only from Techphases-Phase1Specs.md** (binding contracts).  
- **Always check dbschemacontext.md** for schema truth.  
- **System PRDs** (`documentation/systems/*.md`) are authoritative for their surfaces (e.g., Venice SSR, Paris API).  
- On conflict: **DB Truth > Phase1Specs > System PRDs > Techphases > WhyClickeen.**

---

## AI Quick‑Start (Phase‑1 Key Rules)

- JSON casing: camelCase for all API payloads; DB casing follows DB Truth.  
- Single-tag semantics: inline = iframe; overlays/popups = script that injects an iframe; SSR HTML from Venice is canonical.  
- Auth policy: Published instances are public; drafts/inactive require a valid embed token.  
- Templates as data: switching templates changes config, not code; no per-template JS.  
- Privacy & CSP: no third-party scripts/cookies/storage in embeds; strict CSP; Berlin allowed in app/site only.  
- Accessibility: WCAG AA; labeled form controls; overlay focus trap; keyboard operable.  
- Branding: Paris is authoritative; Venice must enforce branding in the SSR output.  
- Edge Config (Atlas): read-only at runtime; administrative updates require INTERNAL_ADMIN_KEY.  
- Phase-1 CI is report-only. Budgets and acceptance criteria are normative targets, not automated gates; direct-to-main commits remain allowed.  
- If unspecified or conflicting: STOP and escalate; do not guess.

---

## Implementation Context for CODEX/Git AIs

### Quick Navigation
- **Schema source:** `documentation/dbschemacontext.md`
- **Contracts:** `documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md`
- **System PRDs:** `documentation/systems/*.md` (Paris, Venice, Michael, Bob, Dieter)
- **Past mistakes:** `documentation/FailuresRCAs-IMPORTANT.md`

### Phase-1 Build Order (strict)
1. Database migrations → **Michael** → `michael/`
2. HTTP API → **Paris** → `paris/`
3. Edge SSR → **Venice** → `venice/`
4. Builder app (shell + editor) → **Bob** → `bob/`
5. Loader → **Venice `/embed/v{semver}/loader.js`**
6. Integration tests → budgets & a11y checks
7. Release checklist → manual budgets verification

### Integration Testing (Phase-1 release gate)
- Before shipping or promoting a release, run the scenarios in `documentation/INTEGRATION-TESTING.md` (draft → claim → publish, token lifecycle, submissions/usage, Atlas fallback).
- Confirm expected status codes, UI fallbacks, and logs are produced for each scenario. If any step deviates, stop and update the documentation before coding fixes.

### Phase-1 Environment Variables
**Venice**
- `PARIS_URL` = `https://c-keen-api.vercel.app` (prod) / `http://localhost:3001` (dev)

**Paris**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `INTERNAL_ADMIN_KEY` (ops-only; required for Atlas administrative overrides)

---
