STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)

This document is authoritative for its scope. It must not conflict with:
1) documentation/dbschemacontext.md (DB Truth) and
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Global Contracts).
If any conflict is found, STOP and escalate to CEO. Do not guess.

# Studio (Phase-1)

## AIs Quick Scan

**Purpose:** Builder shell hosting Bob + Venice preview.  
**Owner:** Vercel project `c-keen-app`.  
**Dependencies:** Paris (save API), Venice (iframe preview), Dieter (React components/tokens).  
**Phase-1 Surfaces:** `/studio` page, template TopDrawer, ToolDrawer, Workspace iframe.  
**Key ADRs:** ADR-004, ADR-005, ADR-012.  
**Common mistakes:** Treating PUT as upsert (skip canonical save flow), reloading iframe without `?ts`, ignoring template-change timeout/errors.

## 1) Purpose (plain english)
Studio is the container scaffolding for Bob. The code lives in `apps/app/app/builder-shell/` and is served at the `/studio` route; it handles nav, auth/workspace context, and theme/device toggles, and hosts a live, production-parity preview via **GET `/e/:publicId`** (single SSR embed route; **no CSR fallback** in Phase-1). Studio itself doesn’t render widgets or write the DB—Bob edits config; Paris/Venice execute. It must deliver **mind-blowing UX** on the few things it does: a crisp 3-area layout, an elegant **TopDrawer** for templates, instant **Light/Dark** and **Desktop/Mobile** switches, and buttery transitions—no jank.

> Path clarifier (NORMATIVE): The nested `apps/app/app/` structure is intentional. Studio scaffolding belongs in `apps/app/app/builder-shell/`; never “flatten” the path to a single `app/`.

## 2) Must do (behavior)
**Taxonomy:** **TopDrawer** (templates) · **ToolDrawer** (left editor shell for Bob) · **Workspace** (center live preview) · **SecondaryDrawer** (right; built now, off by default).

- **Single place to work:** everything happens in the **Builder**. Templates live in the **TopDrawer** (no separate “Library” screen).
- **TopDrawer (templates):** collapsed by default; first template auto-applied. When opened, it **resizes to fit content** (up to a sensible max) and pushes the UI down—no overlap. Large sets support **horizontal carousel/scroll**.
- **Switching templates:** **Bob** decides carry-over (**CARRYABLE / NON_CARRYABLE**); **Studio** handles UX.  
  - **CARRYABLE →** switch immediately; keep compatible edits; brand overrides persist.  
  - **NON_CARRYABLE →** guard: **Save & switch / Discard & switch / Cancel**.
- **Workspace (preview):** always visible, center stage. It’s an **iframe** calling **GET `/e/:publicId`** (same SSR as production; **no CSR fallback**).  
  - **Workspace header:** **Theme** (Light/Dark) and **Device** (Desktop/Mobile) live here. Changes feel instant; viewport+density switches are smooth.  
  - **Live feel:** edits reflect **immediately** (light debounce for typing). Keep focus/scroll; show a lightweight skeleton while SSR is in flight.
- **ToolDrawer (left):** this is **Bob’s editor UI**. Studio only provides the shell: collapsed/expanded states, smooth width changes, independent scroll, and room for Bob’s sticky actions. **Studio does not define sections.**
- **SecondaryDrawer (right):** **present in Phase-1 code but disabled by default** (reserved for light “Assist”). When enabled, opens as a right drawer/sheet with simple, reversible suggestions.
- **Pane rules & responsiveness:**  
  - Both drawers have **collapsed/expanded** states; expanded width adapts to visible controls with simple **Apple/Google-style** transitions (no layout jumps).  
  - **Workspace is always visible.** Collapse order: **ToolDrawer first**, then **SecondaryDrawer** (if enabled).  
  - **Mobile:** only **Workspace** by default; drawers open as full-height sheets and close back to Workspace.
- **Manage:** **Save** keeps config, **Reset** restores defaults, **Copy-Embed** renders the **same output** outside Studio.
- **Honest states & a11y:** loading/empty/error mirror SSR responses; full keyboard nav, visible focus, clear labels; zero console errors.

**Accessibility checklist (NORMATIVE)**
- Every interactive element is keyboard reachable (Tab/Shift+Tab order matches visual order).
- Visible focus ring uses Dieter focus tokens; never remove outline without replacement.
- Error/success banners announce via `aria-live="polite"`.
- Template galleries expose `aria-label`/`aria-controls` links for the iframe.
- Theme/device toggles use `role="tablist"` semantics and announce current selection.

## SecondaryDrawer (Phase-1 Status)
- **Build:** YES (implementation present)
- **Enable:** NO (feature flag off by default)
- **Test:** YES (unit/UI with flag=true)
- **Ship:** NO (remains disabled in production)

## 3) Tech Specs (Contracts)

**Stack & placement**
- App: `c-keen-app` (Next.js 14, Node 20, pnpm) on Vercel App.
- Preview: iframe → **Venice** (Edge SSR) via `GET /e/:publicId` (single route; no CSR fallback).
- Data: Supabase via **Paris** (HTTP API). Studio never writes DB directly.

**TopDrawer sizing & browsing**
- CSS: `max-height: min(50vh, 400px); overflow: auto;`  
- Push-down layout (do **not** overlay Workspace).  
- Large sets: horizontal carousel/scroll with keyboard (←/→, Home/End). ESC closes; focus returns to trigger.

**Preview URL (Workspace iframe)**
- `src=/e/:publicId?ts={ms}&theme=light|dark&device=desktop|mobile`  
  (`theme`/`device` are hints; SSR must still reflect saved config.)
- **Iframe URL rules (NORMATIVE):**
  - Production previews use the absolute Venice origin (`https://c-keen-embed.vercel.app/e/:publicId?...`).
  - Local development may proxy `/e/:publicId?...` through Next.js rewrites, but must append the same `?ts` cache-buster.
  - Always include `ts`, `theme`, and `device` query params to keep caches and analytics consistent.

**Preview transition policy (no flash)**
- Double-buffer iframe or overlay: preload new HTML; **cross-fade 150–200ms** (ease-out) new→in, old→out; preserve focus/scroll; no layout jank.

**Focus/scroll preservation (iframe)**
```js
// Preserve scroll position across iframe reloads
const y = iframe.contentWindow?.scrollY || 0;
const x = iframe.contentWindow?.scrollX || 0;
iframe.addEventListener('load', () => iframe.contentWindow?.scrollTo(x, y), { once: true });

	•	Keep keyboard focus on the last interactive element in ToolDrawer when preview reloads.

**Iframe error recovery (NORMATIVE)**
	•	If the iframe raises an `error` event or Venice responds with 5xx/`SSR_ERROR`, keep the previous HTML visible, overlay a subtle skeleton + inline error banner, and announce the failure via aria-live.
	•	Retry with capped exponential backoff (1 s → 2 s → 5 s). After three failures, stop retrying and surface “Preview unavailable — try again”; let the user re-trigger.
	•	Never steal focus from the editor while recovering; limit focus changes to explicit user actions.

Live preview update (NORMATIVE)
	•	Edits: debounce 400 ms, then run the **Canonical Save Flow** (see section below).
	•	On success: reload iframe with new ?ts={ms} (preserve focus/scroll).
	•	On 4xx/5xx responses: surface inline errors in ToolDrawer; never freeze Workspace. If the flow surfaced a “create” prompt (GET → 404), respect the user’s choice before retrying.

Template switching (Bob decides, Studio orchestrates)
	•	studio:template.change.request → { template_id: string }
	•	Bob replies bob:template.change.assess → { result: "CARRYABLE"|"NON_CARRYABLE", carry_keys?: string[] }
	•	If CARRYABLE: apply; save; refresh preview. If NON_CARRYABLE: guard; on confirm apply defaults; save; refresh.
	•	Brand overrides persist across templates.
	•	Protocol (NORMATIVE): Both sides enforce a 3 s response budget. Lack of reply emits `studio:template.change.timeout`; Studio restores the previous template and shows an inline error. Bob can respond with `bob:template.change.error` → `{ message, retryable }`; Studio surfaces the message, keeps the current state, and only retries on explicit user action.

Theme/Device (Workspace header)
	•	studio:workspace.theme.set → { mode: "light"|"dark" } → update tokens; save (debounced); refresh preview.
	•	studio:workspace.device.set → { device: "desktop"|"mobile" } → set viewport+density; refresh preview.
	•	Theme tokens cross-fade ~200ms; device switch uses subtle scale 0.98→1.00 (200ms).

Drawers (shell only)
	•	open()/close(); setWidth(px|preset) with animated transition; independent scroll; ESC closes topmost drawer/sheet on mobile.

422 field-path contract (Bob ↔ Paris)
	•	Paris returns per-field errors: array of { path: string, message: string }.
	•	path examples: content.items[2].title, style.theme, behavior.autoplay.
	•	Bob surfaces inline at matching controls; unknown paths → generic error slot.

Motion principles (Studio-wide)
	•	Timing: 150–300ms micro; 300–400ms macro.
	•	Easing: cubic-bezier(0.4, 0, 0.2, 1) (no bounce).
	•	Distance: hovers ≤2px; selections ≤8px.
	•	Preference: fades over movement; acknowledge every action within ~50ms.
	•	No layout jank: animate size changes; preserve scroll and focus.

Loading-state hierarchy
	•	<100ms: no indicator.
	•	100–300ms: subtle opacity dip (e.g., 100%→85%).
	•	300–1000ms: thin progress affordance (bar/spinner).
	•	>1000ms: lightweight skeleton + short message.

Performance (guidance, not gates)
	•	Preview update p95 ≤ ~200ms end-to-end; UI transitions ≤ ~150–200ms at 60fps.
	•	Budgets are guidance; enforcement is a CEO decision.

4) Use / Integrations (Consumers, Outputs, DB/API)

Consumers
	•	Bob renders inside ToolDrawer.
	•	Workspace consumes Venice (GET /e/:publicId).
	•	SecondaryDrawer: built but off by default; reserved for future Assist.
	•	Studio shell itself runs the Dieter React component library (buttons, drawers, etc.); the iframe preview remains pure SSR HTML from Venice (no React in the rendered widget).

Studio → Paris (HTTP API)
	•	Instance Load: GET /api/instance/:publicId — fetch current config before edits.
	•	Instance Save: follow the **Canonical Save Flow** (GET → PUT, fallback POST) defined below; no upserts.
	•	Entitlements: GET /api/entitlements — gate features (caps, advanced templates).
	•	Tokens (list): GET /api/token — optional display; no issuance here.
	•	Usage: Studio never calls `/api/usage`; Venice handles analytics.

**Paris API quick map (NORMATIVE)**
```http
GET /api/instance/:publicId
→ 200 { publicId, status, widgetType, templateId, schemaVersion, config, branding, updatedAt }
→ 404 { error: "NOT_FOUND" }

PUT /api/instance/:publicId
Body: { config, templateId?, status? }
→ 200 instance payload
→ 422 [ { path, message } ]

POST /api/instance
Body: { widgetType, templateId, publicId?, overrides? }
→ 201 { publicId, draftToken, ... }

POST /api/claim
Body: { draftToken }
→ 200 instance payload | 410 { error: "TOKEN_REVOKED" }
```

**Canonical Save Flow (NORMATIVE)**
1. `GET /api/instance/:publicId` with workspace auth.
2. If 200 → `PUT /api/instance/:publicId` with the edited payload.
3. If GET returns 404, prompt the user: “Create new instance?”
   - On confirm → `POST /api/instance` (send template + config), then refresh preview.
   - On cancel → abort save, keep editor state untouched.
4. Surface 4xx errors inline (field errors map via path); escalate 5xx with toast + retry option.

Supabase (from dbschemacontext.md — do not drift)
	•	widget_instances: read/update config (JSONB), schema_version, display metadata.
	•	embed_tokens: read non-sensitive fields; validation server-side.
	•	plan_features: read entitlements; writes service-role only.
	•	events: Studio does not write usage; Venice posts usage async on real renders.

Caching & invalidation
	•	Venice SSR HTML is edge-cached; Studio forces fresh preview via ?ts={ms} after saves.
	•	Server invalidates on instance config, token, or plan changes.

Security & RLS
	•	All writes happen server-side in Paris with service-role.
	•	Studio operates with user session; no client writes to events or plan_features.
	•	Error taxonomy surfaced to users (from Venice/Paris): TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR.

## Common AI mistakes (NORMATIVE)

❌ **Wrong:** Treating `PUT /api/instance/:publicId` as an upsert.
```ts
await fetch(`/api/instance/${publicId}`, { method: 'PUT', body: JSON.stringify(payload) });
// If 404, silently POST a new instance without user consent. (WRONG)
```
✅ **Right:** Follow the Canonical Save Flow (GET → PUT, prompt before POST).
```ts
const res = await getInstance(publicId);
if (res.status === 200) return updateInstance(publicId, payload);
if (res.status === 404 && userConfirmedCreate()) return createInstance(payload);
throw res;
```

❌ **Wrong:** Reloading the iframe without a cache-busting `ts` param.
```ts
iframe.src = `/e/${publicId}`; // WRONG — CDN may serve stale HTML
```
✅ **Right:** Append `ts`, theme, and device every refresh.
```ts
iframe.src = `/e/${publicId}?ts=${Date.now()}&theme=${theme}&device=${device}`;
```

❌ **Wrong:** Template switching without timeout/error handling.
```ts
postMessage('studio:template.change.request', payload);
// Wait indefinitely; UI freezes if Bob never responds. (WRONG)
```
✅ **Right:** Enforce the protocol (3 s timeout, error events, revert state).
```ts
await withTimeout(requestTemplateChange(payload), 3000);
```

Outputs
	•	Visual: production-parity HTML in Workspace.
	•	Copy-Embed: snippet that renders the same output as Workspace.
	•	State: persisted instance config for Venice to render publicly.

## Implementation order (NORMATIVE)

- **Day 1:** Shell layout, TopDrawer/ToolDrawer scaffolding, iframe scaffold hitting static Venice URL, theme/device toggles stubbed.
- **Day 2:** Wire Canonical Save Flow, template protocol (request/assess/timeout), accessibility hooks, error surfacing.
- **Day 3:** Polish motion, add SecondaryDrawer gating, instrumentation/tests for focus preservation, finalize Paris interactions (entitlements, tokens list).
