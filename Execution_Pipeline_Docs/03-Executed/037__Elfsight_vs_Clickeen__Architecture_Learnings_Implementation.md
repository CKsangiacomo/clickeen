# PRD 37 — Elfsight → Clickeen: Embed Compatibility Hardening (Learnings → Execution) v0.1

**Status:** EXECUTED  
**Date:** 2026-02-02  
**Executed:** 2026-02-03  
**Owner:** GTM Dev Team (Venice/Prague) + Product Dev Team (Paris/Bob)  
**Primary objective:** ship the “embed survival kit” that prevents 10 years of “embed hell” while staying tenet‑compliant.

## 0) Execution Scope (v0.1)

**In scope (v0.1):** Compatibility Backlog **P0 items 1–7** (see §2).  
**Out of scope (v0.1):** P1/P2 items (including SEO/GEO “iframe++” which is covered by PRD 019), and any widget‑specific semantics in orchestrators.

**Tenets (non‑negotiable):**
- **Tenet 2 (Dumb Pipes):** Venice/Paris/Bob implement generic embed primitives; widget logic stays in Tokyo widget files.
- **Tenet 3 (Fails Visibly):** embed failures must be observable and actionable (not silent console-only failures).
- **Tenet 1 (Widget Files = Truth):** any embed “micro‑API” overrides must be allowlisted/typed per widget spec.

**Definition of done (v0.1):**
- Documented, repeatable compatibility posture for the “Big 6” (WordPress/Wix/Shopify/Squarespace/Webflow/HTML) with explicit failure diagnostics.
- A minimal set of embed primitives (modes + error states + allowlisted overrides) that scales across 100s of widgets without special cases.

## 0.05) Implementation Status (as of 2026-02-02)
- ✅ **CSP diagnostics (host-visible):** Venice v2 loader renders a host-page error card on CSP `frame-src`/`child-src` blocks and on iframe load timeout.
- ✅ **Iframe auto-resize:** Venice v2 loader listens for `postMessage` `{ type: "ck:resize", height }` from the iframe (origin-checked) and updates iframe height.
- ✅ **SPA/AJAX mount reliability:** Venice v2 loader supports **one-loader + placeholders** (`data-clickeen-id`) with a `MutationObserver` and exposes `window.Clickeen.mount()` for manual re-scan after DOM injection.
- ✅ **Lazy-load by default:** placeholder embeds use `IntersectionObserver` (with rootMargin) and `loading="lazy"` so below-the-fold widgets don’t load until needed.
- ✅ **Micro-API (embed-level):** the v2 loader’s supported `data-*` surface is small + stable (ids/locale/theme/device/sizing/triggers/seo-geo), and we avoid widget-specific overrides in v0.1.
- ⏳ **Micro-API (widget-specific):** add per-widget override allowlists (Tokyo spec) + Venice/Bob support only when there’s a concrete, high-ROI list of overrides.
- ✅ **Enforcement (branding):** Venice enforces `branding.remove` by forcing `behavior.showBacklink=true` when the policy disallows branding removal.
- ✅ **Enforcement (metering):** “Frozen Billboard” for capped tiers (free/tier1): views are metered via `POST /api/usage`; on overage the instance is frozen and Venice serves an `en`-only snapshot with a non-interactive upgrade overlay (no locale overlays).

## 0.1) Suggested Execution Order (P0 1–7)
1. **CSP allowlist docs + diagnostic surfaces** (Prague docs + Venice detectable error headers/state)
2. **Embed modes contract**: define and document the recommended embed variants per platform (script loader v2 vs scriptless iframe) without adding runtime special-cases
3. **SPA/AJAX mount reliability**: ensure embeds mount deterministically when injected post-load (without requiring widget-specific logic)
4. **Fail-visible UX**: structured error card with instance id + reason + link to fix (Venice), plus editor-side surfacing (Bob)
5. **Micro-API contract**: allowlisted `data-*` overrides per widget type (Tokyo contract + Venice parser + Bob snippet generator)
6. **Performance defaults**: lazy-load, minimal loader payload, strong caching headers (Venice)
7. **Enforcement UX**: decide degrade/watermark/hard-off and implement the one consistent behavior (Paris policy + Venice render)

---

*(Generated 2026-01-31; repo/docs-first for Clickeen, competitor-first for Elfsight.)*

This file contains **three artifacts** you requested:

1) **Plane mapping**: Elfsight subsystem → Clickeen planes (Tokyo/Bob/Paris/Venice/SF + Dieter/Admin/Prague)  
2) **Compatibility Backlog v1**: the “embed hell” you must preempt  
3) **Brutal delta plan**: Must-match (credibility), Leapfrog (moat), Never-copy (anti-patterns)

---

## 1) Plane Mapping Document
### 1.1 Plane inventory refresher (Clickeen)
- **Tokyo**: asset & spec plane (widget folders/spec.json + build artifacts; CDN stub locally)
- **Dieter**: design system + tokens (compiled to Tokyo)
- **Bob**: editor UI (consumes compiled widget panels; hydrates Dieter components)
- **Admin (DevStudio)**: QA/dev workspace; embeds Bob; fetches instances via Paris
- **Paris**: policy + instance API + persistence access; issues entitlements/grants
- **Venice**: embed runtime + SSR + loader + pixel
- **SanFrancisco**: AI workforce execution surface; operates via grants from Paris
- **Prague**: marketing/SEO site + docs surface (Astro)

### 1.2 Mapping table (Elfsight → Clickeen)
> **Legend**  
> **Owner** = primary plane; **Support** = planes that contribute.  
> **Parity** = what you must implement to match Elfsight behavior; **Upgrade** = what your architecture enables beyond Elfsight.

| Elfsight artifact / behavior | What it does (functional) | Clickeen equivalent | Owner plane | Support planes | Parity requirements (minimum) | Upgrade opportunities (architectural advantage) |
|---|---|---|---|---|---|---|
| `platform.js` loader + `<div class="elfsight-app-<id>">` | Universal bootstrap: scan DOM, resolve instance id, load runtime, mount widget; optional lazy-load | `venice-loader.js` + `<div data-clickeen-id>` OR scriptless iframe embed | **Venice** | Tokyo (hosted assets), Paris (instance fetch), Dieter (styles) | 1) reliable mount; 2) one loader per page; 3) supports multiple instances; 4) lazy-load; 5) strict failure states | “Iframe++” SEO injection, deterministic hydration, per-request personalization without new embed code |
| Direct iframe render `apps.elfsight.com/widget/<id>` | Full render surface for hostile builders and share links | `https://embed.clickeen.com/widget/<publicId>` | **Venice** | Paris (policy/config), Tokyo (runtime), Dieter | 1) responsive sizing strategy; 2) sandbox/CSP guidance; 3) works without any host JS | SSR at edge + optional no-hydration mode for ultra-fast loads |
| Share-link subdomain `*.elf.site` | Public URL that renders widget standalone, used for iframe installs and sharing | `https://share.clickeen.com/<slug>` → maps to instance | **Venice** | Paris (lookup), Prague (optional template) | 1) stable public links; 2) simple share UX; 3) revoke/expire capability | allow per-locale share links without duplicating instance; add analytics + UTM tagging |
| Data-attribute embed knobs (layout/filter defaults, triggers) | Tiny declarative override surface in embed code | `data-clickeen-*` override contract | **Venice** | Bob (generates code), Tokyo (spec allowlist) | 1) allowlisted overrides only; 2) deterministic precedence rules; 3) safe parsing | use same override system for AI ops (SF emits ops that can be encoded as embed overrides) |
| “Widget instance = UUID config blob” | Central config per instance; updates propagate everywhere | Instance record with `publicId` + typed config derived from spec | **Paris** | Tokyo (spec schema), Bob (editor), Venice (renderer) | 1) global updates; 2) strong tenancy; 3) stable identifiers; 4) domain rules | tokenized ops log (audit/undo), per-locale overlays, version snapshots |
| Views-based metering + deactivation | Count loads; enforce plan by disabling render or watermarking | Metering + entitlements + enforcement flags | **Paris** | Venice (enforcement), Admin (visibility), Bob (upgrade nudges) | 1) robust counting; 2) anti-bot strategy; 3) clear UX for limit breach; 4) safe “degraded mode” | move from “hard off” to graceful degrade: watermark, reduced refresh rate, or cached render |
| Heavy caching of upstream data (e.g., reviews updates every N hours) | Reduce API cost + rate-limit risk; users accept staleness | Ingestion + caching policy per widget connector | **Paris** | SF (fetch/transform), Venice (serve cached), Tokyo (connector specs) | 1) per-source refresh rules; 2) backoff + retries; 3) user-visible “last updated” | AI summarization/selection (SF) + deterministic caching keys; per-locale cache |
| Platform-specific install guides (Wix, Shopify, etc.) | “Compatibility engineering” packaged as docs and recipes | Installation Recipes system | **Prague** (docs) | Bob (embed wizard), Venice (modes), Admin (diagnostics) | 1) platform catalog; 2) known constraints; 3) copy-paste variants; 4) troubleshooting | generate recipes from constraints engine; detect platform automatically via snippet |
| Support-driven tweaks (custom CSS/JS) | Escape hatch to patch edge cases | Prefer spec-level solutions; if needed, constrained “style overrides” | **Tokyo** (spec) | Bob (UI), Dieter (tokens), Venice (apply) | 1) enough styling flexibility to reduce tickets; 2) no “arbitrary JS” in v1 | AI-assisted style generation → token diffs; safe CSS subset / allowlisted properties |
| “One widget reusable across many sites” | Same instance can be embedded anywhere; view counts aggregate | Same instance embed anywhere; domain allowlist optional | **Paris** | Venice, Bob | 1) unlimited embed placements; 2) domain controls optional | per-domain overrides without cloning instance; agency fleet mgmt later |

---

## 2) Compatibility Backlog v1 (Derived from Elfsight’s proven pain points)
> **Goal:** avoid Elfsight’s 10-year “embed hell” learning curve by shipping the core mitigations in v1/v1.5.  
> **Priority:** P0 must be solved before credible GA for paid users; P1 shortly after; P2 as you scale.

### P0 — Must-haves for credibility (ship before / at GA)
1. **CSP allowlisting + diagnostics**
   - Detect CSP blocks (script/iframe denied) and show actionable error state
   - Docs: exact domains + directives required
   - Owner: Prague (docs), Venice (runtime detection)

2. **Iframe-wrapping builder survival kit**
   - Provide “scriptless iframe mode” that works on builders that block scripts
   - Provide sizing strategy (fixed height + optional iFrameResizer handshake)
   - Owner: Venice

3. **SPA/AJAX init reliability**
   - Ensure widgets mount when DOM is injected post-load
   - Provide explicit `window.Clickeen.mount()` hook OR MutationObserver in loader
   - Owner: Venice

4. **Pagespeed / lazy-load by default**
   - IntersectionObserver-based load for below-the-fold widgets
   - Minimal blocking JS; strong caching headers
   - Owner: Venice

5. **Hard failure UX (fail visible, not silent)**
   - Missing config/spec should show structured error card (with instance id, reason, link to fix)
   - Owner: Venice + Bob (editor banners)

6. **Embed “micro-API” via allowlisted `data-*`**
   - Declarative knobs for common overrides (layout, initial tab, trigger hooks)
   - Must be allowlisted per widget spec to avoid chaos
   - Owner: Tokyo (schema) + Venice (parser) + Bob (generator)

7. **Billing enforcement behavior**
   - Decide enforcement: watermark vs degrade vs hard-off
   - Implement metering, breach detection, and stable user-visible messaging
   - Owner: Paris (policy) + Venice (enforce)

### P1 — High ROI after GA (stabilize & reduce support load)
8. **Schema / SEO surface**
   - Implement your “iframe++” injection mode for indexable excerpts + JSON-LD
   - Make it opt-in per widget for safety
   - Owner: Venice (+ Prague docs)

9. **reCAPTCHA / anti-abuse constraints**
   - For forms: handle environments where reCAPTCHA breaks in iframes; provide fallback modes
   - Owner: Venice + Paris

10. **Upstream connector caching policies**
    - Per-provider refresh rules and “last updated” surface
    - Owner: Paris (+ SF for fetch/transform if used)

11. **Domain allowlist / origin controls**
    - Optional: restrict where an embed can run (reduces abuse + supports agency governance)
    - Owner: Paris + Venice

12. **Rate limits + abuse controls**
    - Basic protections (token bucket), plus noisy-neighbor mitigation
    - Owner: Paris + Venice

### P2 — Scale & moat enablers
13. **Agency fleet management**
    - Multi-client dashboards, bulk updates, templated rollouts
    - Owner: Bob + Paris

14. **Automated compatibility testing harness**
    - Snapshot testing across major builders; synthetic monitors for widget render surfaces
    - Owner: Admin (DevStudio) + CI

15. **Self-serve “embed debugger”**
    - A debug endpoint that validates installation and returns a report
    - Owner: Venice + Prague docs

---

## 3) Brutal Delta Plan
### A) What we MUST match to be credible in v1 (10–15)
1. **Instant “first success” onboarding** (no blank states; templates; preview that looks real)
2. **Embed works on the Big 6** (WordPress, Wix, Shopify, Squarespace, Webflow, HTML)
3. **One script / one iframe, no weird conflicts** (multi-widget pages supported)
4. **Fast by default** (lazy-load; small payload; caching)
5. **Central updates propagate reliably** (no user redeploy)
6. **Editor control surface is deep enough** (content + style + layout + behavior) for popular widgets
7. **Support-grade error messages** (not “it doesn’t work”)
8. **Clear pricing gates + enforcement UX** (no surprise disappearance without warning)
9. **Security posture** (CSP guidance, sandboxing, no arbitrary JS execution)
10. **Connector stability** (for social/reviews: caching + refresh + rate-limit resilience)
11. **Documentation matrix** (platform-specific install recipes)
12. **Basic analytics** (views, key events per widget type)

### B) What we can LEAPFROG with our architecture (10–15)
1. **Edge SSR embed runtime (Venice)** → faster FCP, better reliability vs JS-heavy loaders
2. **Deterministic specs + compilation (Tokyo→Bob compile)** → faster widget development, fewer regressions
3. **Tokenized design system (Dieter)** → consistent theming across widgets, brand-grade output
4. **Locale as runtime parameter** → one instance serves many locales, no fan-out duplication
5. **Overlay-based localization with staleness guards** → safe updates + auditability
6. **AI-safe ops pipeline (SF + grants)** → automated localization, content QA, personalization within constraints
7. **Truth vs delivery separation** → reproducible builds, clean caching, safe rollbacks
8. **Embed micro-API contract** that is schema-driven (allowlisted overrides per widget)
9. **SEO/GEO “iframe++”** injection → indexable excerpts + structured data without breaking isolation
10. **Graceful enforcement modes** (degrade vs disappear) → better UX than Elfsight’s hard-off
11. **Per-domain/per-placement overrides without cloning** (optional) → agencies love this
12. **Deterministic audit + undo** for widget changes → “Ops log” as a trust feature

### C) What we should NEVER copy (anti-patterns)
1. **Widget semantics in orchestrators** (Paris/Venice should not “know” widget-specific logic)
2. **Undifferentiated JSON blobs** with no schema/contracts (breaks AI ops + audit)
3. **Arbitrary Custom JS injection** as the primary extensibility model (security + support nightmare)
4. **Silent fallbacks** that hide missing data/config (violates fail-fast; increases hidden bugs)
5. **Per-locale instance duplication** as a localization strategy (explodes management cost)
6. **Hard “disappear” enforcement with no pre-warning** (creates support spikes + user distrust)
7. **Support-only fixes** for systemic compatibility issues (must be productized into recipes/modes)
8. **Overloading the embed snippet** with complex logic (keep it as a micro-API; move complexity server-side)
9. **Platform-specific hacks in core runtime** (encode constraints as recipes/config, not branching code)

---

## Appendix: Suggested file structure for “Installation Recipes”
*(If you want this later, I can produce a PR-ready scaffold.)*

- `prague/src/content/install-recipes/<platform>.md`
  - “Recommended mode” (script / iframe / hybrid)
  - Copy-paste snippet generator (parameters)
  - CSP allowlist
  - Known limitations (schema, iframes, SPA)
  - Debug checklist
- `bob/embed-wizard/`
  - platform selector
  - outputs correct embed snippet + warnings
- `venice/diagnostics`
  - runtime error codes + “what to do next” links into Prague docs

---

## Next step (if you want it)
If you say “go”, I can produce a **v1 build-order plan** that turns the backlog into:
- Sprint-sized chunks
- explicit acceptance criteria
- “definition of done” checks per item
- and the minimal widget set (popular incumbents) to ship first.
