# Prague SEO/GEO Optimization (Iframe++) for Curated Embeds — (FAQ → Countdown → Logo Showcase)

**Status:** EXECUTED  
**Priority:** P0 (unblocks Prague + customer embeds SEO/GEO)  
**Owner:** Product Dev Team (Bob/Widgets/Venice) + GTM Dev Team (Prague)  
**Date:** 2026-01-30  
**Executed:** 2026-02-01  

Source of truth for current behavior: `documentation/` + runtime code.

---

## 1) Problem Statement

Prague uses **curated widget instances** as the primary “creative” on acquisition pages. Today these creatives are embedded via Venice **iframe** (`/e/:publicId`).

Iframe is correct for:
- UI isolation
- predictable styling
- safety for 3P pages

But it’s weak for **SEO/GEO**:
- **SEO:** JSON‑LD + semantic “answer text” live inside the iframe document, not the host page.
- **GEO / AI answers:** extractable, attributable answers are harder to read/cite when they only exist inside an iframe.

We want a scalable baseline that works for **100s of widgets**, **all locales**, and **all tiers**, without turning Clickeen into a full SEO tool.

---

## 2) Core Decision (v0.2)

**We ship “Iframe++ SEO/GEO optimization”:**
- **UI stays in iframe** (always)
- The embed additionally injects into the **host page**:
  - **JSON‑LD** (when enabled)
  - a **human-visible, AI-readable excerpt** (widget‑type specific)

This avoids the Shadow DOM indexing + multi-embed global state complexity, while still giving the host page content that crawlers and AI systems can read.

---

## 3) Current State (as implemented)

### 3.1 Prague embeds curated instances via iframe
- Prague uses Venice `/e/:publicId` inside an iframe (see `prague/src/components/InstanceEmbed.astro`).

### 3.2 Venice already provides the data we need
- `GET /r/:publicId` already computes `schemaJsonLd` (see `venice/app/r/[publicId]/route.ts` + `venice/lib/schema/*`).
- Loader v2 already mounts iframe embeds deterministically (see `venice/app/embed/v2/loader.ts`).

### 3.3 Feature gating already exists in widget state
FAQ schema is emitted only when:
- `state.seoGeo.enabled === true`, and
- `state.seo.enableSchema !== false`  
(see `venice/lib/schema/faq.ts`).

---

## 4) Goals

### 4.1 Functional goals
1) Prague can render curated creatives with **SEO/GEO optimization** enabled (FAQ first).
2) Bob exposes **two deterministic snippets**:
   - Safe embed (iframe)
   - SEO/GEO embed (iframe++: JSON‑LD + excerpt)
3) We establish the pattern that extends to Countdown + Logo Showcase without re-architecture.

### 4.2 Platform goals
4) No Prague-only hacks: Prague uses the **same primitive** customers embed.
5) SEO/GEO must be deterministic per instance + locale.
6) SEO/GEO must never break UI rendering (UI is always iframe).

---

## 5) Non-goals (v0.2)

- We are not building an SEO suite (keywords tooling, robots.txt editor, SERP dashboards, etc).
- We are not replacing iframe UI with SSR HTML on host pages.
- We are not requiring Shadow DOM UI for indexing.
- We are not redesigning curated instance styling (human-owned).

---

## 6) Proposed Solution (v0.2)

### 6.1 Define “SEO/GEO optimization” (Iframe++)

**SEO/GEO optimization = iframe UI + host-page metadata:**
- Inject JSON‑LD into host `<head>` (when schema is enabled).
- Inject a readable excerpt into the host DOM (below the embed), so bots/AI can parse text even if they don’t execute iframe content.

**Trigger (one-line embed):**
```html
<script
  src=".../embed/latest/loader.js"
  data-public-id="..."
  data-trigger="immediate"
  data-ck-optimization="seo-geo"
></script>
```

### 6.2 Venice: add excerpt + “meta-only” payload mode

Add `excerptHtml` to the `/r/:publicId` payload (FAQ first), and support a minimal response:
- `GET /r/:publicId?meta=1` → `{ schemaJsonLd, excerptHtml, publicId, widgetType, locale, status }`

Excerpt contract:
- Safe HTML (no scripts)
- Derived from **localized state** (so it matches `locale`)
- Widget-type specific (FAQ: list of Q/A)
- Size bounded (avoid unbounded DOM/HTML)

### 6.3 Venice loader v2: inject SEO/GEO metadata without changing UI mode

Add `data-ck-optimization="seo-geo"` behavior:
- Always mount iframe UI (existing behavior)
- Additionally fetch `/r/:publicId?meta=1` and inject:
  - `schemaJsonLd` → `<script type="application/ld+json" id="ck-schema-${publicId}">…</script>` in `<head>`
  - `excerptHtml` → `<details id="ck-excerpt-${publicId}">…</details>` below the embed

Failure behavior (must be true):
- If meta fetch fails, **UI still renders** (SEO/GEO silently absent).

### 6.4 Bob: expose SEO/GEO snippet (not shadow UI)

In the Settings → Embed section:
- Always show safe embed snippet (iframe)
- When `seoGeo.enabled === true`, also show SEO/GEO snippet:
  - Uses `data-ck-optimization="seo-geo"`
  - Preview uses `bob/app/bob/preview-shadow/page.tsx?mode=seo-geo` (reuses existing page)

### 6.5 Prague: enable SEO/GEO optimization for curated embeds (FAQ first)

Prague keeps using iframe UI, but when a block opts into SEO/GEO optimization:
- Use loader v2 with `data-ck-optimization="seo-geo"`
- Pass explicit `data-locale` from the route locale

Note: Prague’s `embedMode: "indexable"` is kept as the switch for v0.2 (to avoid content schema churn). In v0.3 we rename to `seo-geo` for clarity.

---

## 7) Requirements (By System)

### 7.1 Tokyo widget definitions (FAQ first)
MUST:
- Keep `seoGeo.enabled`, `seo.enableSchema`, `seo.canonicalUrl`, `geo.enableDeepLinks` in defaults.
- Keep excerpt derivable from localized instance state.

MUST NOT:
- Require Prague-only schema generation.

### 7.2 Venice (service + loader)
MUST:
- Keep schema + excerpt deterministic and sanitized.
- Provide `meta=1` payload to minimize work for SEO/GEO injection.
- Never block iframe UI rendering if SEO/GEO fails.

MUST NOT:
- Add Prague-only branches.

### 7.3 Prague (marketing)
MUST:
- Pass locale explicitly.
- Preserve existing creative chrome UX (share UI, hover affordances).

### 7.4 Bob (editor)
MUST:
- Provide deterministic embed output for safe vs SEO/GEO.
- Reflect entitlements faithfully (no “looks enabled but isn’t”).

### 7.5 Paris / Policy
MUST:
- Continue enforcing `seoGeo.enabled` via limits/policy on load + ops + publish.

---

## 8) Entitlements & Enforcement

```text
Key            | Kind | Path(s)        | Enforcement      | Notes
-------------- | ---- | -------------- | ---------------- | ------------------------------
seoGeo.enabled | flag | seoGeo.enabled | load+ops+publish | deny ops/publish when not entitled
```

---

## 9) Rollout Plan (phased)

### Phase A — Venice meta payload + FAQ excerpt
1) Add `excerptHtml` generation for FAQ from localized state.
2) Add `/r/:publicId?meta=1` response shape for loader use.

### Phase B — Loader SEO/GEO injection
3) Add `data-ck-optimization="seo-geo"` support (meta fetch + inject schema + excerpt).
4) Keep iframe as the only UI mode for public embeds (shadow stays internal/legacy).

### Phase C — Bob + Prague integration (FAQ first)
5) Bob: show SEO/GEO snippet + preview.
6) Prague: enable SEO/GEO on the FAQ page block that opts into `embedMode: "indexable"`.

### Phase D — Extend to Countdown + Logo Showcase
7) Add widget-specific `excerptHtml` + schema generators:
   - Countdown → Event (schema) + short readable excerpt
   - Logo showcase → ItemList (schema) + short readable excerpt

---

## 10) Success Criteria (P0)

Prague (FAQ):
- UI renders in iframe (unchanged).
- When SEO/GEO is enabled and `seoGeo.enabled=true`:
  - Host `<head>` contains `application/ld+json` for the instance.
  - Host DOM contains a readable excerpt for the instance (localized).

Bob:
- Safe snippet always available.
- SEO/GEO snippet appears only when `seoGeo.enabled=true`.

Platform:
- One embed primitive scales to Prague + customers (no Prague-only schema logic).

---

## 11) Risks / Unknowns

1) **Crawler execution variance:** some crawlers may not execute JS reliably; runtime-injected JSON‑LD may underperform SSR `<head>` schema.
   - Mitigation (P1): Prague can SSR “schema-only” from Venice payload while keeping iframe UI.
2) **Performance:** extra `/r?meta=1` fetch adds work.
   - Mitigation: meta-only payload + caching + keep excerpt size bounded.
3) **Excerpt UX:** excerpt must be useful but not intrusive.
   - Mitigation: use `<details>` collapsed by default.

---

## 12) Decisions (Locked for v0.2)

1) UI remains iframe-first. SEO/GEO is an add-on layer.
2) No Shadow DOM UI requirement for SEO/GEO.
3) FAQ is the template; Countdown/Logo adopt the same pattern.

---

## 13) References

- Platform capability: `documentation/capabilities/seo-geo.md`
- Widget compliance: `documentation/widgets/WidgetBuildContract.md`
- Prague embed: `prague/src/components/InstanceEmbed.astro`
- Venice render/meta payload: `venice/app/r/[publicId]/route.ts`
- Venice loader: `venice/app/embed/v2/loader.ts`
- FAQ schema + excerpt: `venice/lib/schema/faq.ts`
