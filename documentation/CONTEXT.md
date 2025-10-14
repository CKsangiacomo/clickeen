# We're Building CLICKEEN (A SaaS Platform)

**Team:**  
- CEO (Human)  
- Principal Full Stack Engineer (Codex AI) 
- Principal Full Stack Engineer (Claude AI)  
- Principal Full Stack Engineer (ChatGPT AI)  
- Principal Full Stack Engineer (Gemini AI) 

ALL OPERATE IN VS CODE SO ALL AIs have visibility on full codebase and all systems (supbase/CLIs/vercel/Git/etc

**When talking to CEO/Human be considerate of:**  
- a) Talking to the CEO  
- b) Be thorough in your statements/assertions  
- c) Don't be verbose  

**PRINCIPAL FULL STACK ENGINEER MODE:**  
- *** CRITICAL **** All AIs (GPT, Codex, Claude, Gemini) operate as experienced full‑stack engineers; their first priority is to not break the system or any built artifacts. - *** CRITICAL ****
- *** CRITICAL **** Elegant engineering required: smallest working change, consistent with patterns, reduces complexity; no speculative abstractions. - *** CRITICAL ****

**Discipline rules:**  
1. **No over-engineering** — Do the smallest working change by reusing existing patterns; no new abstractions, refactors, or extra scope.
2. **No guessing** - When uncertain: ask one yes/no question; then proceed.

Takeaway: **Always check CONTEXT.md, system PRDs, and the decision log BEFORE execution.**

STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
1) supabase/migrations/ (DB schema truth)
2) documentation/systems/<System>.md (System PRDs - authoritative for Phase-1)
3) documentation/widgets/<widget>.md (Widget PRDs - authoritative specifications)
4) all execution docs and temp docs live in CURRENTLY_EXECUTING/ - no .md is created in repo root

CRITICAL P0 — documentation/ is the single source of truth for all AI & human work. You MUST read and follow it. If you see discrepancies, STOP and ask for alignment.

---

## Glossary (Canonical Terms)

**Widget:** Functional unit that renders on third-party sites (e.g., FAQ, announcement, contact form)

**Template:** Curated, data-only preset for a widgetType providing default layout/skin/styling (JSON configuration, no per-template JavaScript)

**Instance:** User's saved widget configuration (private config) derived from a template; identified by `publicId` (TEXT field in `widget_instances.public_id`)

**Single tag:** The embed snippet placed on websites - either one iframe (inline widgets) or one script tag (overlay widgets via loader)

**publicId:** Textual identifier for widget instances (e.g., `wgt_abc123`), stored as TEXT in `widget_instances.public_id`

**Draft token:** Temporary token stored in `widget_instances.draft_token`, allows anonymous editing until widget is claimed by workspace

**Casing conventions:**
- API JSON payloads: camelCase (e.g., `publicId`, `widgetType`)
- Database columns: snake_case (e.g., `public_id`, `widget_id`)

---

## Phase-1 Widget List

**Active widgets (implement these):**
- FAQ (`content.faq`) - Accordion/list/multicolumn layouts with categories
- Testimonials (`social.testimonials`) - Customer testimonials display
- Announcement (`engagement.announcement`) - Promotional bars/popups
- Newsletter (`engagement.newsletter`) - Email signup forms
- Contact Form (`forms.contact`) - Contact/inquiry forms
- Social Proof (`social.proof`) - Activity notifications

**Optional (NOT Phase-1, require CEO approval):**
- Pricing Cards
- Gallery

Each widget requires: schema definition, renderer implementation, SSR HTML template, error/loading/empty states.

---

## AUTHORITY & PRECEDENCE (HIGH-LEVEL)

- **supabase/migrations/** — NORMATIVE DB schema; code must match.
- **documentation/systems/<System>.md** — NORMATIVE PRDs for Phase-1 systems (Venice, Paris, Bob, Copenhagen, etc.)
- **documentation/widgets/<widget>.md** — NORMATIVE PRDs for widget implementations
- **WhyClickeen.md** — INFORMATIVE strategy context.

On any conflict: **DB Truth > System PRDs > Widget PRDs > CONTEXT.md > WhyClickeen.**

Known exceptions (Phase‑1):
- Atlas (Edge Config) is read-only at runtime by policy. Administrative overrides require INTERNAL_ADMIN_KEY and explicit CEO approval; treat Atlas as read-only unless directed otherwise.
- If a referenced `documentation/systems/<System>.md` file is missing or incomplete, do **not** guess. Implement strictly from Phase‑1 Contracts and DB Truth, and escalate to the CEO for the missing PRD.

---

## DB SCHEMA POLICY (POINTER)

- The schema in `supabase/migrations/` is canonical.  
- Engineers may request schema changes with motivation + exact DDL.  
- Until updated by migration, always code to the applied schema. **No schema-in-code drift.**

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

- `supabase/migrations/` — DB schema (tables, columns, constraints)
- `documentation/CONTEXT.md` — THIS FILE: glossary, widget list, precedence rules
- `documentation/systems/*.md` — system PRDs (Venice, Paris, Bob, Copenhagen, Geneva, etc.)
  - `bob.md` — Builder app, preview UX, Save model, Manual/AI Copilot modes
  - `venice.md` — SSR rendering, preview=1 mode, postMessage contracts, caching
  - `paris.md` — HTTP API, instance management, token lifecycle
  - `copenhagen.md` — AI service layer, DeepSeek vs Claude routing, Copilot behavior
- `documentation/widgets/*.md` — per-widget PRDs (one file per widget)
  - `content.faq.md` — FAQ widget with AI features
  - `testbutton.md` — Phase-0 tokenization reference, postMessage patch example
- `documentation/WhyClickeen.md` — strategic context
- `documentation/ADRdecisions.md` — authoritative decisions (document new approvals here)
- `documentation/verceldeployments.md` — env/keys per project

---

---

## Bob Preview System Architecture (Phase-1 Critical)

**Background:** The conversation summary from the previous session revealed critical requirements for Bob's world-class preview UX. This section ensures AIs understand the architecture.

### Core Requirements

1. **Tokenization Prerequisite (Phase-0):**
   - All widgets MUST use CSS variables for patchable fields
   - Example: `border-radius: var(--btn-radius, 12px)` NOT `border-radius: 12px`
   - HTML MUST include `data-widget-element` attributes for patch targeting
   - See `documentation/widgets/testbutton.md` for reference

2. **Double-Buffered Preview (Phase-1a):**
   - Two iframes (A and B), load next state in hidden iframe
   - Cross-fade swap on load (no white flash)
   - Smooth transitions between saved states

3. **postMessage Patches (Phase-1b):**
   - Instant preview updates while typing (no reload lag)
   - Updates CSS variables on `data-widget-element` elements
   - Only injected when `?preview=1` query param present
   - Origin whitelist, field whitelist, value validation

4. **Save UX Model:**
   - **MiniBob** (clickeen.com): NO Save button, only "Publish" → signup
   - **In-App Bob** (authenticated): Save button appears when dirty, click to persist
   - NO auto-save, NO debouncing on Save, NO "Saved" toasts

5. **Security:**
   - Draft tokens stay server-side (preview proxy route)
   - postMessage origin whitelist (Bob + MiniBob only)
   - Field whitelist per widget (documented in widget PRDs)
   - Value validation (type checks, enums, clamping)

### Key Contracts

**Venice:**
- `?preview=1` query param enables preview features
- Injects postMessage patch script ONLY when preview=1
- Production embeds (no preview=1) = pure SSR HTML/CSS

**Bob:**
- Preview proxy route: `bob/app/api/preview/e/[publicId]/route.ts`
- Injects draft tokens server-side (tokens never exposed to browser)
- Double-buffer preview manager (~80 LOC Phase-1a)
- postMessage sender for instant typing (~30 LOC Phase-1a)

**Widgets:**
- MUST be tokenized (Phase-0 requirement)
- CSS variables set from config in inline style
- `data-widget-element` attributes on patchable elements

### Documentation References

- `documentation/systems/bob.md` — Preview system details, Save UX model
- `documentation/systems/venice.md` — preview=1 mode, postMessage handler
- `documentation/widgets/testbutton.md` — Tokenization reference, patch example
- `documentation/CONTEXT.md` — Glossary and Phase-1 widget list

---

## AI Consumption Guide

- **Start with WhyClickeen.md** for context (strategy, PLG motion). INFORMATIVE only.
- **Check CONTEXT.md** for glossary, Phase-1 widget list, and precedence rules
- **Always check `supabase/migrations/`** for schema truth
- **System PRDs** (`documentation/systems/*.md`) are authoritative for their surfaces (e.g., Venice SSR, Paris API, Copenhagen AI)
- **Widget PRDs** (`documentation/widgets/*.md`) are authoritative for widget implementations
- On conflict: **DB Truth > System PRDs > Widget PRDs > CONTEXT.md > WhyClickeen**

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
- **Schema source:** `supabase/migrations/`
- **Glossary & widget list:** `documentation/CONTEXT.md`
- **System PRDs:** `documentation/systems/*.md` (Paris, Venice, Bob, Copenhagen, etc.)
- **Widget PRDs:** `documentation/widgets/*.md` (content.faq, testbutton, etc.)
- **Past mistakes:** `documentation/FailuresRCAs-IMPORTANT.md`

### Phase-1 Build Order (strict)
1. Database migrations → **Michael** → `supabase/migrations/`
2. HTTP API → **Paris** → `paris/`
3. Edge SSR → **Venice** → `venice/`
4. Builder app (shell + editor) → **Bob** → `bob/`
5. Loader → **Venice `/embed/v{semver}/loader.js`**
6. Integration tests → budgets & a11y checks
7. Release checklist → manual budgets verification

### Integration Testing (Phase-1 release gate)
- Before shipping or promoting a release, run the scenarios in `CURRENTLY_EXECUTING/TESTING.md` (draft → claim → publish, token lifecycle, submissions/usage, Atlas fallback).
- Confirm expected status codes, UI fallbacks, and logs are produced for each scenario. If any step deviates, stop and update the documentation before coding fixes.

### Phase-1 Environment Variables
**Venice**
- `PARIS_URL` — `https://c-keen-api.vercel.app` (prod) / `http://localhost:3001` (dev)

**Paris**
- Supabase secrets (URL / anon key / service-role key) must be stored in environment variables or secret managers.
- Do **not** hardcode credentials in documentation or source files. Rotate immediately if exposed.
- Refer to operational runbooks for secret distribution and storage.

---

**KEYS - OK TO STORE UNTIL WE'RE GA - WE'RE NOW IN BOOSTRAP SO NO SECURITY CONCERNS **
SUPABASE

Supabase pw - Helen@santacroce2238

SUPABASE_SERVICE_ROLE_KEY > eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVibXF3cWRleG1lbWhyZGhrbXduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQwMjI5NiwiZXhwIjoyMDcxOTc4Mjk2fQ.9a8Ey4cIo5vuYONQmX0cdTbTIWPtBnFbVuWTd0GNf6s

SUPABASE_URL @https://ebmqwqdexmemhrdhkmwn.supabase.co

SUPABASE_ANON_KEY >eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVibXF3cWRleG1lbWhyZGhrbXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MDIyOTYsImV4cCI6MjA3MTk3ODI5Nn0.nSDLhUbkSLbJhnSpq2dxBJFb0B9_isw3fvhPq4CJe_s

GITCICD sbp_a1fbfad9c52aa17965c51fa70c99d4d1828baa06

SUPABASE REF ebmqwqdexmemhrdhkmwn
