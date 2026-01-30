# Prague SEO/GEO Indexable Curated Embeds — (FAQ → Countdown → Logo Showcase)

**Status:** EXECUTING  
**Priority:** P0 (unblocks Prague SEO/GEO direction)  
**Owner:** Product Dev Team (Bob/Widgets) + GTM Dev Team (Prague)  
**Date:** 2026-01-30  

Source of truth for current behavior: `documentation/` + runtime code.

---

## 1) Problem Statement

Prague uses **curated widget instances** as the primary “creative” on many pages (global acquisition). Today these creatives are embedded via Venice **iframe** (`/e/:publicId`).

This is safe for UI isolation, but weak for:
- **SEO (Search Engine Optimization):** schema + semantic content live inside an iframe and do not reliably apply to the host page.
- **GEO (Generative Engine Optimization):** deep links and extractable answers are harder to attribute/cite when content lives in an iframe document.

We already have platform primitives for **indexable embed** (Venice `/r/:publicId` render payload + loader shadow mode + FAQ schema generation), but they are not wired into:
- Prague (marketing pages)
- Bob (embed output UX)
- Widget “gold standard” compliance (no dead controls, Binding Map completeness)

---

## 2) Why “FAQ golden standard” first (before Countdown / Logo Showcase)

FAQ is the highest leverage pilot because it exercises the full SEO/GEO stack:
- JSON‑LD (`FAQPage`) correctness and sanitization
- Deep link behavior (hash → expand/scroll)
- Multi‑item content extraction quality (questions/answers)
- ToolDrawer → runtime determinism (“no dead controls”)

If we can make FAQ **compliant + scalable**, we can extend the same platform patterns (schema generator + deep link pattern + embed output) to Countdown and Logo Showcase without re-inventing architecture per widget.

---

## 3) Current State (as implemented)

### 3.1 Prague embeds curated instances via iframe
- Prague embeds Venice `/e/:publicId` inside an iframe for curated visuals (see `prague/src/components/InstanceEmbed.astro`, used by hero/split blocks).

### 3.2 Venice already ships an indexable embed primitive
Shipped primitives:
- `GET /r/:publicId` returns `{ renderHtml, assets.styles[], assets.scripts[], schemaJsonLd, state, ... }` (see `venice/app/r/[publicId]/route.ts`).
- Loader supports shadow mode when `data-force-shadow="true"` and injects `schemaJsonLd` into host `<head>` (see `venice/app/embed/v2/loader.ts`).

### 3.3 FAQ schema generation exists (gated)
- Venice emits `FAQPage` JSON‑LD only when:
  - `state.seoGeo.enabled === true`, and
  - `state.seo.enableSchema !== false`
  (see `venice/lib/schema/faq.ts`).

### 3.4 Known “gold standard” gaps (FAQ)
These are architectural debt for SEO/GEO rollout:
- **Dead controls:** `seo.businessType` and `geo.answerFormat` exist in defaults/spec but do not have deterministic runtime/schema effects (today).
- **Agent contract gap:** `tokyo/widgets/faq/agent.md` does not include the required Binding Map summary (contract requirement).
- **Multi-embed safety:** FAQ runtime reads `window.CK_WIDGET.state` (single-widget global). Shadow embeds should be safe for multi-widget host pages by reading state keyed by `publicId` (e.g. `window.CK_WIDGETS[publicId]`), otherwise multiple indexable embeds can race.

---

## 4) Goals

### 4.1 Functional goals
1) Prague can render curated creatives in an **indexable embed mode** (FAQ first).
2) Bob exposes **two deterministic embed snippets**:
   - Safe embed (iframe)
   - SEO/GEO embed (shadow/indexable)
3) FAQ is brought to “gold standard” compliance so it becomes the template for the next widgets.

### 4.2 Platform goals
4) No Prague-only SEO hacks: Prague should use the **same embed primitive** customers will use.
5) No dead controls: every exposed control must bind to a deterministic effect.
6) The path to extend to Countdown + Logo Showcase is clear and does not require re-architecture.

---

## 5) Non-goals (v0.x)

- We are not rewriting Prague to server-render widget instance HTML directly.
- We are not shipping a full generalized schema-mapping DSL for 100 widgets in this PRD (but we keep the direction compatible).
- We are not redesigning curated instance styling (human-owned).
- We are not changing the iframe embed path; it remains the default safe fallback.

---

## 6) Proposed Solution (v0.2)

### 6.1 Platform: “Indexable embed” = Shadow DOM UI + host-page JSON‑LD
Use Venice loader v2 shadow mode as the indexable embed surface:
- UI mounts inside Shadow DOM (CSS isolation)
- JSON‑LD is injected into host `<head>` (SEO applies to the host page)
- Hash deep links are handled by the loader (initial + `hashchange`)

### 6.2 Prague: add an indexable embed mode for curated creatives (FAQ first)
Update Prague’s instance embed component (used by hero/split blocks) to support:
- Default: **iframe** (unchanged)
- Optional: **indexable** (shadow embed via loader)

**Enablement mechanism (deterministic, per-block):**
- Add an optional `curatedRef.embedMode` field in Prague page JSON blocks:
  - `embedMode: "indexable"` uses loader shadow mode
  - omitted (default) uses iframe
- For Phase C, set `embedMode: "indexable"` only on the FAQ overview **hero** block’s `curatedRef` in `tokyo/widgets/faq/pages/overview.json`.

**Deterministic embed markup (indexable):**
- Script src: `${PUBLIC_VENICE_URL}/embed/latest/loader.js` (**must alias v2 loader**; see 6.3)
- Required dataset:
  - `data-public-id="<publicId>"`
  - `data-force-shadow="true"`
  - `data-locale="<routeLocale>"` (no browser-language nondeterminism)
  - `data-theme="light"` (explicit)
  - `data-device="desktop"` (explicit)

### 6.3 Venice loader: make container layout configurable (general solution)
Today the loader hardcodes:
- `container.style.maxWidth = '640px'`
- iframe `minHeight = 420px`

That is not acceptable for Prague layouts and is not a scalable platform contract.

Add deterministic, safe sizing options via `data-*` (v0.2 contract):
- `data-max-width="<number>"` (px; optional)
  - default: `640`
  - `0` means “no max width” (set `max-width: none`)
  - non-numeric values: ignored (use default)
- `data-min-height="<number>"` (px; optional)
  - default: `420`
  - applies to iframe mode and as a pre-paint placeholder height in shadow mode
  - non-numeric values: ignored (use default)
- `data-width="100%"` (optional)
  - v0.2 only allows `100%` (anything else is ignored)
  - rationale: avoid arbitrary CSS injection and keep host layout deterministic

Also add deterministic cache-bust token support:
- `data-ts="<token>"` (string; when present, pass `ts=<token>` to `/r` + `/e`)
- Keep `data-cache-bust="true"` (dev-only) for `ts=Date.now()` convenience
- Precedence: `data-ts` wins over `data-cache-bust`

**Cache-bust parity requirement (shadow mode):**
- When `ts` is present for `/r`, the loader must also append the same `ts` token to `assets.styles[]` + `assets.scripts[]` URLs it loads into the shadow root (so Prague deploy cache-bust is end-to-end, not payload-only).

**/embed/latest alias requirement (must be true in runtime):**
- `GET /embed/latest/loader.js` must point to the v2 loader implementation (currently the repo wiring may still point to v1; fix as part of this PRD so Prague/Bob snippets match reality).

### 6.4 FAQ: close compliance gaps (gold standard)
**No dead controls rule:** we will not expose controls that do nothing.

**Decision (locked for v0.2): Option A.**
- Remove `seo.businessType` and `geo.answerFormat` from the ToolDrawer (keep underlying keys in defaults for state-shape stability).
- Defer “businessType-driven schema expansion” and “answerFormat as a content rule” to a separate PRD (do not block indexable embeds on new schema design).

Additionally:
- Add Binding Map summary section to `tokyo/widgets/faq/agent.md` (contract requirement).
- Make FAQ shadow embed multi-widget safe by reading initial state from `window.CK_WIDGETS[publicId]` when available (fallback to `window.CK_WIDGET` for backwards compatibility).
  - This is a **hard requirement** for Prague (multi-embed pages are expected).

### 6.5 Bob: make SEO/GEO embed a first-class output
Add an “Embed” section (or equivalent) that:
- Always shows **Safe embed (iframe)** snippet.
- When `seoGeo.enabled === true`, also shows **SEO/GEO embed (indexable)** snippet (loader + `data-force-shadow="true"`).
- Offers a “Preview SEO/GEO embed” action that opens Bob’s existing route:
  - `bob/app/bob/preview-shadow/page.tsx` (already uses loader shadow mode)

Bob must surface entitlement outcomes deterministically:
- If a subject cannot publish `seoGeo.enabled=true`, UI must show the denial reason and not pretend it will work.

---

## 7) Requirements (By System)

### 7.1 Tokyo widget definition (FAQ)
MUST:
- Keep `seoGeo.enabled`, `seo.enableSchema`, `seo.canonicalUrl`, `geo.enableDeepLinks` in defaults (already present).
- Ensure FAQ Q/A IDs are stable and used for anchors (already present as `sections[].faqs[].id`).
- Provide required Binding Map summary in `agent.md`.

MUST NOT:
- Expose user-facing controls that do nothing.

### 7.2 Venice (service + loader)
MUST:
- Keep `/r/:publicId` schema emission deterministic and sanitized (strip HTML to plain text for schema fields).
- Keep loader’s shadow mode fallback to iframe when `/r` fails (already present).
- Support deterministic sizing + cache-bust token params (see 6.3).

MUST NOT:
- Add Prague-only embed branches inside Venice.

### 7.3 Prague (marketing)
MUST:
- Support an indexable embed mode for curated creatives on Prague widget pages (FAQ first).
- Always pass `locale` explicitly (route locale).
- Preserve existing creative chrome UX (share UI, hover affordances) unless replaced with an equal-or-better design.

MUST NOT:
- Implement per-widget schema generation in Prague (Venice owns schema generation).

### 7.4 Bob (editor)
MUST:
- Provide deterministic embed output for iframe vs indexable embed.
- Provide a clear SEO/GEO toggle affordance and reflect entitlement enforcement.

### 7.5 Paris / Policy
MUST:
- Continue enforcing `seoGeo.enabled` via limits/policy on load + ops + publish.

---

## 8) Entitlements & Enforcement (fixed-width mapping)

```text
Key                      | Kind | Path(s)           | Metric/Mode | Enforcement      | Notes
------------------------ | ---- | ----------------- | ----------- | ---------------- | ------------------------------
seoGeo.enabled           | flag | seoGeo.enabled    | boolean     | load+ops+publish | sanitize on load; reject ops/publish when denied
```

---

## 9) Rollout Plan (phased)

### Phase A — FAQ gold standard (cloud-dev dogfood first)
1) Remove dead controls from the FAQ ToolDrawer (`seo.businessType`, `geo.answerFormat`).
2) Add FAQ Binding Map summary to `agent.md`.
3) Make FAQ shadow embed multi-widget safe (`CK_WIDGETS` keyed by `publicId`).

### Phase B — Venice loader layout + cache token
4) Add loader sizing options + `data-ts` token support.
5) Validate Prague can render creatives at full width without loader fighting layout.
6) Ensure `/embed/latest/loader.js` aliases v2 loader (so “latest” snippets are actually indexable-capable).

### Phase C — Prague indexable embed (FAQ page first)
7) Add indexable embed mode to Prague instance embed component (`prague/src/components/InstanceEmbed.astro`).
8) Enable it on the FAQ overview **hero creative only** (single embed, single page first).
9) Ensure the curated FAQ instance used by Prague has `seoGeo.enabled=true` + `seo.enableSchema=true`.
10) Rollback path: disable indexable mode for that page (defaulting back to iframe) if we see render regressions or schema underperformance.

### Phase D — Bob embed output UX
11) Add “Embed” section with copyable snippets + preview link.
12) Validate behavior across subjects (workspace/devstudio/minibob/free) and denial UX.

### Phase E — Extend to Countdown + Logo Showcase
13) Define schema targets per widget and implement in Venice schema generator.
14) Apply the same “no dead controls + Binding Map” compliance before exposing SEO/GEO embed for those widgets.

---

## 10) Success Criteria (P0)

Prague (FAQ):
- Host page contains JSON‑LD (`FAQPage`) for the curated FAQ instance when indexable embed is enabled.
- Deep links (`#...`) expand/scroll to the correct FAQ item on initial load and on `hashchange`.
- Visual output matches Prague layout constraints (no forced 640px max width).

Bob:
- Users can copy deterministic embed snippets (iframe vs indexable).
- Entitlement enforcement is visible and consistent with publish behavior.

Platform:
- FAQ ToolDrawer has zero dead controls and a Binding Map summary in `agent.md`.

---

## 11) Risks / Unknowns

1) **Crawler execution variance:** some crawlers may not execute JS reliably; JSON‑LD injected at runtime may underperform server-rendered `<head>` schema.
2) **Shadow DOM indexing:** visible content inside Shadow DOM may not be indexed uniformly even if JSON‑LD works.
3) **Multi-embed races:** if widgets rely on `window.CK_WIDGET` (single global), multiple indexable embeds can interfere unless widgets read state keyed by `publicId`.
4) **Schema duplication:** multi-embed pages may inject multiple JSON‑LD blocks; ensure it remains valid and doesn’t degrade rich results.

Mitigation path if needed:
- Prague “schema-only” mode: keep iframe UI but inject schema from `/r/:publicId` server-side or at build time (still Venice-owned generation).

---

## 12) Decisions (Locked for v0.2)

1) **Dead controls:** Option A is locked (remove `seo.businessType` and `geo.answerFormat` from ToolDrawer).
2) **Prague embed scope:** enable indexable embed on the FAQ overview hero creative only (Phase C).
3) **Loader API:** keep sizing API minimal and deterministic (`maxWidth`, `minHeight`, `width=100%` only, plus `ts` token).
4) **Multi-embed safety:** required now (FAQ must read initial state from `CK_WIDGETS[publicId]` when present).

---

## 13) Open Questions (Peer Review)

1) `seo.canonicalUrl` semantics:
   - Allowed, but optional.
   - Recommendation for Prague curated instances in v0.2: leave empty unless the instance is truly 1:1 with a single canonical Prague page URL (avoid misleading schema URLs).
2) When do we expand indexable embeds beyond the hero creative?
   - After we validate multi-embed behavior + schema behavior on one page in cloud-dev and prod.

---

## 14) References

- Platform capability: `documentation/capabilities/seo-geo.md`
- Widget compliance: `documentation/widgets/WidgetBuildContract.md`
- Prague current iframe embed: `prague/src/components/InstanceEmbed.astro`
- Venice render payload: `venice/app/r/[publicId]/route.ts`
- Venice loader shadow mode: `venice/app/embed/v2/loader.ts`
- FAQ schema generator: `venice/lib/schema/faq.ts`
