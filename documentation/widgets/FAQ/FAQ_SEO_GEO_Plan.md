# FAQ — SEO/GEO (Iframe++ host metadata) — Repo-Accurate

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-01-30

This document describes the **shipped** SEO/GEO behavior for the FAQ widget and how it scales to other widgets.

Primary references:
- Cross-cutting capability (authoritative): `documentation/capabilities/seo-geo.md`
- Execution PRD (process artifact): `Execution_Pipeline_Docs/03-Executed/035__Prague_SEO_GEO_IframePlusPlus_Curated_Embeds_PRD_v0.2.md`

---

## Shipped model (v0.2): Iframe++ SEO/GEO

Goal: keep iframe UI (reliable embeds) while making the host page machine-readable.

### 1) UI render path (unchanged)
- FAQ UI renders via Venice iframe route: `GET /e/:publicId`

### 2) Host-page SEO/GEO injections (opt-in)
If the host uses the loader script with:
```html
data-ck-optimization="seo-geo"
```
…then the loader:
1) mounts the iframe UI (same as safe embed)
2) fetches Venice meta payload:
   - `GET /r/:publicId?meta=1`
3) injects into the host page:
   - JSON‑LD into `<head>` (id: `ck-schema-<publicId>`)
   - a readable excerpt into the DOM (id: `ck-excerpt-<publicId>`)

If meta fetch fails, UI still renders (SEO/GEO absent, not blocked).

---

## FAQ schema + excerpt contracts (shipped)

## Editor controls (FAQ Settings panel)
These are instance-owned settings (edited in Bob):
- `seoGeo.enabled` (master enable; required for Venice to emit schema/excerpt)
- `seo.enableSchema` (schema-only gate; when `false` schema is suppressed even if `seoGeo.enabled` is `true`)
- `seo.canonicalUrl` (optional; used as `@id` + `url` in `FAQPage` when present)
- `geo.enableDeepLinks` (enables `#` deep links for FAQ questions in accordion mode)

Entitlements:
- `seoGeo.enabled` is an instance-owned setting (not tier-gated).
- Tiered enforcement for FAQ is handled via `tokyo/widgets/faq/limits.json` (branding + cap groups).

### Schema (`schemaJsonLd`)
- Type: `FAQPage` JSON‑LD string (may be empty)
- Owner: Venice
- Inputs: localized instance state + locale
- Gating:
  - `state.seoGeo.enabled !== true` → emit `""`
  - `state.seo.enableSchema === false` → emit `""` (even if `seoGeo.enabled === true`)

Source of truth:
- `venice/lib/schema/faq.ts`

### Excerpt (`excerptHtml`)
- Type: safe HTML string (may be empty)
- Owner: Venice
- Inputs: localized instance state + locale
- Gating:
  - `state.seoGeo.enabled !== true` → emit `""`

Source of truth:
- `venice/lib/schema/faq.ts`

## Locale behavior (important)
- The loader passes `locale` to both the iframe UI (`/e/:publicId`) and the meta payload (`/r/:publicId?meta=1`).
- Schema/excerpt are generated from the **localized** state for that locale.
- Host pages should set `data-locale="…"`, matching the page language.

---

## Validation checklist (AI-friendly)

On any host page using the loader:
1) Confirm iframe UI renders (network calls to `/e/:publicId` succeed).
2) Confirm meta-only call happens when SEO/GEO opt-in is used:
   - request to `/r/:publicId?meta=1`
3) Confirm host DOM injections exist:
   - `<head>` contains `script#ck-schema-<publicId>[type="application/ld+json"]` (may be empty if schema is gated off)
   - DOM contains `details#ck-excerpt-<publicId>` (may be empty if excerpt gated off)

---

## What is NOT shipped (do not assume)

- Host-page deep links for iframe++ (cross-frame citation/scroll) are not shipped.
- Rich schema variants (Organization/LocalBusiness/etc.) are not shipped.
- Any “SEO suite” controls (keywords, robots.txt editor, SERP tooling) are out of scope.

---

## How this scales to new widgets

For any widget `X`:
1) Implement `XSchemaJsonLd(state, locale)` and `XExcerptHtml(state, locale)` in Venice.
2) Register in `venice/lib/schema/index.ts`.
3) Keep gating consistent (`seoGeo.enabled`, `seo.enableSchema`).
