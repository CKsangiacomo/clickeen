# Widgets V0 Spike Plan (Phase‑1)

Status: Working plan for a smallest credible slice we can test end‑to‑end with a very basic widget. This is a living doc we’ll iterate on together.

## 1) Objective
Ship a minimal, testable flow that proves the core “widget” loop without gold‑plating:
- Create/select a simple widget template
- Preview the real SSR HTML (Venice) inside Bob
- Make a tiny config change and see it reflected
- Publish and copy an embed snippet

## 2) Core Concepts (crisp)
- Widget Type: functional kind (e.g., `engagement.announcement`, `content.faq`).
- Template (data‑only): layout/skin/density/defaults/schemaVersion/premium.
- Instance: saved config + `publicId` + status (`draft|published|inactive`).
- Tokens (two domains):
  - Access tokens (Paris/Venice): draft/embed tokens (+ JWT in Bob) to gate draft previews and submissions.
  - Design tokens (Dieter): CSS variables for spacing/typography/colors/radius/motion used by Bob/Venice UI.

Why this design: keep embeds SSR‑only (tiny, safe, fast), keep visuals token‑driven (cheap theming), keep access controlled (draft/private vs public published), and make template switches data transforms (no code shuffles).

## 3) Systems (who does what)
- Bob (`bob/`): Builder UI; calls Paris for instance CRUD; previews Venice via iframe.
- Paris (`paris/`): Instance APIs, validation (via Geneva), plan/branding, token issuance.
- Venice (`venice/`): SSR renderer per widget type at `GET /e/:publicId`; enforces access/caching/CSP; supports preview hints (`?theme,&device,&ts`).
- Geneva: Schemas/templates catalog; transform + validate configs on POST/PUT & template switches.
- Michael: DB truth (Supabase) for widget_instances, widgets, embed_tokens, etc.
- Dieter (`dieter/`): CSS tokens + component contracts; Admin is preview harness only.

## 4) Scope & Non‑Goals (V0)
In scope (smallest slice):
- 1–3 widget types supported already by Venice (start with `engagement.announcement`).
- Bob shows an editable name/title field, a couple of content fields, and theme/device toggles.
- Save updates config (one or two fields) via Paris; iframe refreshes with `?ts=`.
- Publish toggles status → `published` and shows a copyable embed snippet (iframe).

Out of scope (for now):
- Aggregators (reviews/social feeds), data crawlers, complex filters
- Full catalog, localization matrix, AI assist, autosave, versioning
- Overlay loader + event bus (keep inline iframe for V0)

## 5) Milestones (proposed)
- M1: Skeleton preview (published only)
  - Seed 1 published instance in Paris.
  - Bob points to that `publicId`; theme/device toggles and preview refresh work.
  - Basic “Copy embed” button (inline iframe snippet).
- M2: Minimal edit + save (draft)
  - Create from template in Bob → receive `{ instance, draftToken }`.
  - Bob PUTs small config changes; Venice preview passes token when draft.
  - Publish action (PUT status) + handle `403 PLAN_LIMIT` with upgrade message.
- M3: Design presets & template switch
  - Add 1–2 additional templates per type; implement dry‑run/confirm switch.
  - Primary color token hook (map to Dieter variables at render time).
- M4: Quality polish
  - Error toasts, retry/backoff; small spinner + soft swap for preview; basic builder telemetry (Berlin in app, not embeds).

## 6) Concrete Work for M1/M2

### 6.1 Bob (files: `bob/app/bob/bob.tsx`, `bob/app/bob/bob.module.css`)
- Add `publicId` state + setter strategy:
  - M1: read from env or inline constant (e.g., `NEXT_PUBLIC_TEST_PUBLIC_ID`).
  - M2: on “Create” choose template → call Paris, store returned `publicId` + `draftToken`.
- ToolDrawer fields (Announcement):
  - `title`, `message`, `ctaLabel`, `ctaHref` → local state.
  - Save: GET `/api/instance/:publicId` → if 200 then PUT `{ config: { ...fields } }`; else prompt to create using POST `/api/instance/from-template`.
- Preview iframe URL builder:
  - Always include `?ts=${Date.now()}&theme=${theme}&device=${device}`.
  - When status !== published and we hold a token → pass `Authorization: Bearer <token>` via fetch? (not possible on iframe src). Use `X-Embed-Token` header via loader path later; for V0, prefer published for simplicity.
- Publish button:
  - PUT `/api/instance/:publicId` with `{ status: 'published' }`.
  - On `403 PLAN_LIMIT`, show upgrade prompt.
- Copy embed snippet:
  - `<iframe src="${veniceBase}/e/${publicId}" style="width:100%;height:600px;border:0"></iframe>`

Notes:
- For M1 preview‑only, we can skip auth by using a published instance.
- For M2 draft editing, passing tokens to an iframe requires loader path or server mediation; simplest path: immediately publish after creation in dev to keep preview unblocked. We can revisit proper draft token flow after M2.

### 6.2 Paris (API we call)
- `POST /api/instance/from-template` (returns `{ instance, draftToken }`).
- `GET /api/instance/:publicId` (load current snapshot).
- `PUT /api/instance/:publicId` with minimal payloads:
  - Update config: `{ config: { title, message, ctaLabel, ctaHref } }`
  - Publish: `{ status: 'published' }`
- Auth: requires JWT (Bob). For M1 published preview only, saving can be optional; for M2, wire Bob to attach JWT.

### 6.3 Venice (already implemented)
- SSR routes for existing widget types.
- Honors preview hints and cache rules; published path requires no token.

## 7) Dev Setup (local)
- Dieter assets: `pnpm --filter @ck/dieter build` then `pnpm --filter @clickeen/bob dev` (predev copies assets).
- Services:
  - Paris (`http://localhost:3001`) — requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  - Venice (`http://localhost:3002`) — set `NEXT_PUBLIC_PARIS_URL`.
  - Bob (`http://localhost:3000`) — set `NEXT_PUBLIC_VENICE_URL` and optionally `NEXT_PUBLIC_TEST_PUBLIC_ID` for M1.
- Seed instance (for M1, dev‑only options):
  - Option A (preferred): call POST `/api/instance/from-template` with a test JWT; then PUT status `published`.
  - Option B (last resort): insert rows via Supabase SQL migration/script (dev DB only), mirroring Paris defaults.

## 8) Acceptance Criteria
- M1
  - Bob loads a real `publicId`, preview renders Announcement SSR from Venice.
  - Theme and device toggles update the preview deterministically (no cache artifacts).
  - Copy embed shows the correct iframe snippet.
- M2
  - Create from template returns a usable instance; saving fields updates `config` via Paris; preview reflects changes.
  - Publish flips status and allows public preview; `403 PLAN_LIMIT` handled with a non‑blocking message.

## 9) Risks / Open Questions
- Draft token in iframe: HTTP headers can’t be added to a bare iframe `src`. We likely need the versioned loader for header injection or an alternative preview handshake; for V0, keep previews published.
- Auth in Bob: wiring Supabase Auth and attaching JWT to Paris calls; for M1 we can skip save; for M2 we need a clean dev login flow.
- Template switch: dry‑run/confirm path exists server‑side; UI yet to be designed.
- Caching correctness: ETag/Last‑Modified/Vary behavior should be verified once we have non‑preview requests.

## 10) Next Steps (proposed)
1) Choose widget type for V0 (Announcement recommended) + pick one default template id.
2) Seed a published instance in Paris and record its `publicId`.
3) Hard‑code `publicId` in Bob + add Copy Embed.
4) Add 2–3 Content fields + a Save button that PUTs `{ config }` (behind a dev feature flag if auth isn’t ready).
5) Add Publish button and surface `PLAN_LIMIT` error.
6) Iterate to M2 (create flow + draft → publish) once auth is available.

---
References (for quick nav while implementing):
- Venice SSR: `venice/app/e/[publicId]/route.ts`
- Paris instance API: `paris/app/api/instance/[publicId]/route.ts`, `paris/app/api/instance/from-template/route.ts`
- Catalog: `paris/lib/catalog.ts`
- Bob main: `bob/app/bob/bob.tsx`, layout: `bob/app/layout.tsx`
- Dieter tokens/components: `dieter/tokens/tokens.css`, `dieter/components/*.css`

---

## Appendix A — Seed Script (curl)

Quickly create a dev instance and publish it so Venice previews without tokens.

Prereqs
- Paris running locally (default: `http://localhost:3001`).
- A valid JWT for a dev user that belongs to a workspace (Supabase Auth).

Commands
```bash
# Required env
PARIS_BASE=${PARIS_BASE:-"http://localhost:3001"}
JWT="$(cat ~/.clickeen/dev.jwt 2>/dev/null || echo "<PASTE_DEV_JWT_HERE>")"

# Create from template (Announcement)
curl -sS -X POST "$PARIS_BASE/api/instance/from-template" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  --data '{
    "widgetType": "engagement.announcement",
    "templateId": "announcement-banner",
    "schemaVersion": "2025-09-01",
    "overrides": { "title": "Hello world", "message": "From seed script" }
  }'

# Response shape: { instance: { publicId, ... }, draftToken }
# Extract publicId with jq:
# export PUBLIC_ID=$(...)  # if you have jq installed

# Example manual publish (replace wgt_xxxxxx)
PUBLIC_ID="wgt_xxxxxx"
curl -sS -X PUT "$PARIS_BASE/api/instance/$PUBLIC_ID" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  --data '{ "status": "published" }'

echo "Public preview URL: http://localhost:3002/e/$PUBLIC_ID"
```

Notes
- If you know your `workspaceId`, you may include it in the POST body. Otherwise Paris resolves it from the JWT.
- In draft, Venice requires a token; for V0 we publish immediately to avoid token plumbing in the iframe.

## Appendix B — Bob Checklist (M1)
- Set env in `bob/.env.local`:
  - `NEXT_PUBLIC_VENICE_URL=http://localhost:3002`
  - `NEXT_PUBLIC_TEST_PUBLIC_ID=<your publicId>`
- Start Bob: `pnpm --filter @clickeen/bob dev`
- Open: `http://localhost:3000/bob` (or `?publicId=...`)
- Verify:
  - Preview renders from Venice
  - Theme/Device toggles update iframe
  - “Copy Embed” button places a usable iframe snippet on clipboard
