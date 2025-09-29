STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Bob system. It MUST NOT conflict with:
1) documentation/dbschemacontext.md (DB Truth)
2) documentation/CRITICAL-TECHPHASES/Techphases.md (Global Contracts)
3) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase-1 Contracts)
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Bob — Builder Application (shell + editor)

## 0) Quick Facts
- **Route:** `/bob`
- **Repo path:** `bob/`
- **Deploy surface:** Vercel project `c-keen-app`
- **Purpose:** Single builder surface for configuring widgets, managing drafts/instances, and previewing Venice SSR output.
- **Dependencies:** Paris (HTTP API), Venice (embed preview), Michael (DB via Paris), Dieter (design system), Cairo/Berlin integrations co-resident in the app.
- **Key ADRs:** ADR-004, ADR-005, ADR-012 (Paris separation / Atlas policy)

## 1) Purpose & Scope
Bob is the unified builder application. It owns the shell (navigation, theming/device toggles, layout) and the editor UI (configuration tools, template switching, draft → claim). The entire builder experience lives at `/bob`; there is no separate “Studio” surface. Bob embeds Venice via iframe for live previews and never renders widgets client-side for production.

Goals in Phase‑1:
- Provide a single working surface to configure widgets, preview changes, and manage drafts/instances.
- Enforce canonical save and template-switch contracts defined in Paris/Venice PRDs.
- Deliver premium-quality UX (motion, accessibility, responsiveness) while staying within Dieter design tokens.

Out of scope in Phase‑1:
- Alternative surfaces (mini-builder, public playground)—not part of Bob.
- Multi-builder workflows (split surfaces, secondary shells).
- Any direct DB access: Bob talks to Paris only.

## 2) Core Concepts (shared vocabulary)
- **TopDrawer** — template gallery surface (collapsible push-down panel at top).
- **ToolDrawer** — left-side editor container hosting Bob’s configuration UI.
- **Workspace** — central iframe rendering Venice SSR (`GET /e/:publicId`).
- **SecondaryDrawer** — right-side drawer reserved for Assist; built but disabled by default.
- **Canonical Save Flow** — GET → PUT (prompt → POST) contract with Paris.
- **Template Protocol** — structured messaging between ToolDrawer and Venice preview with 3 s timeout + error events.

## 3) Single-Surface Workflow (NORMATIVE)
Bob MUST keep everything inside one working surface. There is no separate “library” or alternate screen. The builder layout consists of TopDrawer, ToolDrawer, and Workspace (SecondaryDrawer optional). High-level rules:

- **Workspace always visible**: Venice preview stays on screen at all times, centered.
- **TopDrawer**: collapsed by default; first template auto-applies on load. When opened, it pushes content down (no overlay) and resizes to fit content with smooth motion.
- **ToolDrawer**: hosts the editor UI. Bob is responsible for sections, controls, validation, and sticky actions. Drawer transitions MUST be smooth, width adaptive, independent scroll, and support collapse/expand.
- **SecondaryDrawer**: present in code but feature-flagged off in Phase‑1. When enabled, behaves as right drawer/sheet with reversible suggestions. Do not ship enabled without CEO approval.
- **Mobile**: Workspace occupies the screen; drawers open as full-height sheets and close back to Workspace. Maintain smooth transitions and focus management.
- **Accessibility**: All interactive elements reachable via keyboard; visible focus using Dieter tokens; `aria-live` for errors/success; template previews exposed via accessible controls.

## 4) Preview & Venice Integration (NORMATIVE)
- **Iframe**: Workspace uses `<iframe src="/e/:publicId?...">` calling Venice. There is no CSR fallback; preview MUST reflect production SSR HTML.
- **Cache busting**: Every refresh appends `?ts=${Date.now()}&theme=${theme}&device=${device}` to avoid stale cache.
- **Theme & Device toggles**: Live in Workspace header, use tab semantics, react instantly, and drive iframe params.
- **Latency targets**: aim for ≤200 ms end-to-end preview updates; transitions ≤150–200 ms. Budgets are guidance (CEO enforces).
- **Error handling**: Surface Venice error codes (TOKEN_INVALID, TOKEN_REVOKED, NOT_FOUND, CONFIG_INVALID, RATE_LIMITED, SSR_ERROR) inline; fall back gracefully.

## 5) Template Switching Contract (NORMATIVE)
- Bob owns carry-over logic. Bob MUST determine whether the new template is **CARRYABLE** (preserve compatible fields) or **NON_CARRYABLE** (prompt user).
- For **CARRYABLE**, Bob MUST apply the switch immediately, keep compatible edits, and preserve brand overrides.
- For **NON_CARRYABLE**, Bob MUST show a guard dialog with options: **Save & switch**, **Discard & switch**, **Cancel**. Respect the user choice before calling Venice preview.
- Protocol with preview/editor components MUST enforce a 3 s timeout, emit `bob:template.change.timeout` on failure, revert state, and show inline errors. Editor may raise `bob:template.change.error` with `{ message, retryable }` to surface finer-grained issues.

## 6) Paris Integration (Canonical Save Flow)
**Bob MUST NEVER treat `PUT /api/instance/:publicId` as an upsert.** Follow the canonical flow:
1. `GET /api/instance/:publicId` with workspace auth.
2. If 200 → `PUT /api/instance/:publicId` with edited payload.
3. If 404 → prompt user to create; on confirm, `POST /api/instance`; on cancel, abort.
4. Surface 4xx inline (map `path` to fields), escalate 5xx with toast + retry.

Other APIs Bob may call:
- `GET /api/entitlements` — to gate features (premium templates, plan limits).
- `GET /api/token` — optional display; Bob does not issue or revoke tokens.
- `POST /api/claim` — when user claims a draft into workspace.
- Bob MUST NOT call `/api/usage`; Venice handles usage writes.

Security & RLS:
- All writes happen server-side via Paris with service-role keys; Bob MUST NOT attempt direct database mutations.
- Bob operates with a Supabase user session; every fetch to Paris MUST include the authenticated JWT.
- All calls to Paris MUST use HTTPS and MUST originate from the whitelisted app origins defined in Paris’ CORS policy.
- Enforce plan limits: respect `403 PLAN_LIMIT` and `403 PREMIUM_REQUIRED` responses from Paris.
- Secrets (service-role keys, INTERNAL_ADMIN_KEY) MUST NEVER be embedded in Bob; environment usage is limited to public URLs.

## 7) Draft Tokens & Claim
- Draft instances include `draftToken` from Paris. Bob MUST store it client-side only (transient) and send via `Authorization: Bearer <token>` or `X-Embed-Token` when previewing drafts through Venice.
- On claim (`POST /api/claim`), Paris returns the published instance payload; Bob MUST refresh the preview and drop the draft token.
- Draft tokens become invalid immediately after claim (`TOKEN_REVOKED`); Bob MUST handle this gracefully.

## 8) Dieter Integration
- Bob consumes Dieter design tokens/components for shell and editor UI.
- Shell uses Dieter React components; do not inline ad-hoc CSS beyond sanctioned tokens.
- Preview iframe renders pure SSR HTML; no Dieter React runtime inside Venice.
- Icon pipeline: use Dieter-provided icons; update manifest via scripts when adding assets.

## 9) Dependencies & Co-resident Systems
- **Cairo** (custom domains flows) and **Berlin** instrumentation live in the same Vercel project (`c-keen-app`). Ensure instrumentation never leaks into Venice.
- **Copenhagen/Helsinki** are Phase‑2/3 placeholders; ignore unless ADR updates scope.

## 10) Implementation Order (Phase‑1, NORMATIVE)
1. Shell layout + Dieter scaffolding + iframe stub (static Venice URL).
2. Wire Canonical Save Flow & template protocol (request/response/timeout).
3. Tie toggles, preview params, accessibility hooks, and error surfacing.
4. Polish motion, finalize feature flags (SecondaryDrawer), instrument focus retention.
5. Integrate entitlements/plan limits, claim flow, environment toggles.

## 11) Testing & QA Requirements
- Accessibility: keyboard-only walkthrough, screen reader spot checks, `aria-live` events triggered.
- Motion: transitions stable at 60fps, no layout jumps on drawer toggles or template changes.
- Preview parity: confirm `/bob` iframe output matches production Venice embed for identical instance.
- Save flow: covered with automated tests (GET → PUT → POST path, error handling).
- Template guard: tests for CARRYABLE vs NON_CARRYABLE, timeout handling.
- Claim flow: draft creation → claim → Venice preview updates with `TOKEN_REVOKED` handled.

## 12) Common AI / Implementation Mistakes (DO NOT DO)
- Treating `PUT` as upsert without prompting → creates duplicate instances.
- Reloading iframe without cache-busting `ts` → stale preview.
- Leaving loader/preview overlay in place after errors → traps users.
- Introducing third-party scripts or Dieter runtime into Venice preview.
- Splitting builder into multiple surfaces/screens.

## 13) Outputs
- Persisted instance configurations (via Paris) for Venice to render publicly.
- Production-parity Venice HTML visible inside Workspace.
- Embed snippet (Copy-Embed) that reproduces Workspace output exactly.

## Appendix A — Error Taxonomy & Messaging
- TOKEN_INVALID / TOKEN_REVOKED: show inline warning, prompt re-authentication/refresh.
- NOT_FOUND: treat as missing instance; offer create flow.
- CONFIG_INVALID: show field-level errors from `path` entries.
- RATE_LIMITED: throttle UX; show retry suggestion.
- SSR_ERROR: show fallback state with retry.

## Appendix B — Feature Flags
- `enableSecondaryDrawer` (default false): toggles Assist drawer.
- `enableMiniBob` (future): not in Phase‑1; ignore.

---
Studio.md has been merged into this document. The old Studio system is retired; do not resurrect `documentation/systems/Studio.md`. All builder requirements live here.
