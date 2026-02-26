# SEO + GEO Platform Architecture (Iframe++ SEO/GEO)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-02-26

This document defines the **shipped** SEO/GEO model and contracts across:
- **Tokyo** widget definitions (state shape + limits + l10n allowlists)
- **Paris** enforcement (entitlements and publish validation)
- **Venice** schema/excerpt generation + embed delivery
- **Bob** embed snippet UX (Publish modal)
- **Prague** curated embed usage (same primitive as customers)

If anything here disagrees with runtime code, treat it as a P0 doc bug and update immediately.

---

## AIs Quick Scan (the only thing you must remember)

- **UI stays iframe.** Public embeds render UI via `GET /e/:publicId`.
- **SEO/GEO is “Iframe++”.** When the embed script opts in with `data-ck-optimization="seo-geo"`, Venice’s loader injects **host-page** metadata:
  - `schemaJsonLd` into the host `<head>`
  - `excerptHtml` into the host DOM (human-visible, AI-readable)
- **Venice owns schema + excerpt generation.** Host pages never generate JSON‑LD themselves.
- **Gating is instance-owned (not host-owned).**
  - `seoGeo.enabled === true` → allows SEO/GEO artifacts to be generated
  - `seo.enableSchema !== false` → allows schema emission (excerpt may still emit)
- **Locale is best-effort and explicit when needed.** Pass `data-locale` for deterministic behavior (otherwise the loader falls back to `navigator.language`). Venice always returns the **effective** locale (and `X-Ck-L10n-*` headers) so callers never assume “requested === rendered”.
- **Bob UX:** embed snippets are surfaced under the **Publish** button (modal). Settings must not render embed code.

---

## Definitions

### SEO (Search Engine Optimization)
SEO here means: **make the host page eligible** for search features (rich results / better understanding) by placing valid, deterministic **Schema.org JSON‑LD** in the host document.

### GEO (Generative Engine Optimization)
GEO here means: **make answers extractable and attributable** by placing a readable excerpt in the host DOM that AI systems can parse/cite even when they ignore iframe contents.

Non-goals:
- “Keyword tooling”, “SEM tool replacement”, robots.txt editors, SERP dashboards.

---

## Core constraint (why Iframe++)

Iframe contents (`/e/:publicId`) are not reliably attributed to the host page for SEO/GEO.

So: we keep iframe UI for safety and compatibility, but we also place the **SEO/GEO-bearing content in the host document** (head + DOM) via the loader.

---

## Platform primitive: SEO/GEO optimized embed (Iframe++)

**One embed script. Two deterministic behaviors.**

1) **Safe embed (default)**
   - Loader mounts the iframe UI only.

2) **SEO/GEO optimized embed (Iframe++)**
   - Loader mounts the iframe UI (same as safe).
   - Loader additionally fetches meta-only data from Venice and injects host-page metadata.

Opt-in is host-controlled by a single attribute:
```html
<div
  data-clickeen-id="wgt_..."
  data-ck-optimization="seo-geo"
></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

Important invariants:
- `data-ck-optimization="seo-geo"` **does not change the UI mode**. UI remains iframe.
- If the meta fetch fails, **UI still renders** (SEO/GEO is absent; UI is not blocked).
- When meta exists, the loader injects deterministic host-page artifacts:
  - Schema: `<script id="ck-schema-<publicId>" type="application/ld+json">…</script>` in `<head>`
  - Excerpt: `<details id="ck-excerpt-<publicId>" data-ck-excerpt="1">` next to the embed, with content inserted into `[data-ck-excerpt-body="1"]`

---

## Venice route contracts (runtime truth)

### `GET /e/:publicId` (iframe UI)
- Returns the widget UI document (iframe-safe).
- This is the only required UI render path for public embeds.

### `GET /r/:publicId` (render payload; diagnostic/internal)
- Returns a JSON payload used for internal/diagnostic shadow rendering and asset lists:
  - `renderHtml`, `assets.styles[]`, `assets.scripts[]`, `state`, plus `schemaJsonLd` + `excerptHtml`.

### `GET /r/:publicId?meta=1` (meta-only payload; used by Iframe++)
Used by the loader when `data-ck-optimization="seo-geo"` is set.

Response shape:
```json
{
  "publicId": "wgt_...",
  "status": "published",
  "widgetType": "faq",
  "locale": "en",
  "schemaJsonLd": "{...}",   // string (may be "")
  "excerptHtml": "<section>...</section>" // string (may be "")
}
```

Source-of-truth implementation:
- `venice/app/r/[publicId]/route.ts`
- `venice/lib/schema/index.ts`
- `venice/lib/schema/faq.ts`
- `venice/lib/schema/countdown.ts`

---

## Shipped schema + excerpt generation (current reality)

### Ownership (non-negotiable)
- **Venice** generates `schemaJsonLd` + `excerptHtml`.
- Loaders **only inject** what Venice returns.
- Prague/Bob must not implement per-widget schema logic.

### Platform contract (widget-agnostic)
- This capability doc does not define widget-specific schema/excerpt payloads.
- Venice dispatches widget handlers through `venice/lib/schema/index.ts`.
- If a widget has no registered schema handler, `schemaJsonLd` must be empty.
- If a widget has no registered excerpt handler, `excerptHtml` must be empty.
- Widget-specific SEO/GEO details belong in the widget docs/PRDs, not this platform capability doc.

### Gating rules (shipped)
- `state.seoGeo.enabled !== true` → both `schemaJsonLd` and `excerptHtml` must be empty strings.
- `state.seo.enableSchema === false` → `schemaJsonLd` must be empty string (excerpt may still emit when `seoGeo.enabled === true`).

---

## Localization contract (SEO/GEO must be locale-correct)

- Host embeds can pass locale explicitly (`data-locale="<token>"`). If omitted, the loader falls back to `navigator.language`.
- Public embed render is snapshot-first and revision-coherent (locale artifacts must exist in the current published revision).
- If the requested locale artifact is missing in the current revision, render/meta is unavailable (no serve-time locale healing).
- Locale is never encoded into `publicId`.
- Venice exposes `X-Ck-L10n-Requested-Locale`, `X-Ck-L10n-Resolved-Locale`, `X-Ck-L10n-Effective-Locale`, `X-Ck-L10n-Status`.
- Schema and excerpt are generated from the **effective localized state** and must match:
  - `payload.locale` (effective), and
  - `X-Ck-L10n-Effective-Locale` (header truth)

---

## Entitlements (updated)

`seoGeo.enabled` is **not tier-gated**. It is a per-instance setting:
- The host opt-in (`data-ck-optimization="seo-geo"`) controls whether the loader injects host-page metadata.
- The instance opt-in (`state.seoGeo.enabled === true`) controls whether Venice emits `schemaJsonLd`/`excerptHtml`.

All tiers can toggle SEO/GEO optimization; there is no `seoGeo.enabled` key in `config/entitlements.matrix.json` and no Paris tier enforcement for this setting.

---

## How to extend to new widgets (deterministic pattern)

For a new widget type `X`:
1) Add `XSchemaJsonLd(state, locale) -> string` in `venice/lib/schema/<widgetType>.ts` (see `venice/lib/schema/faq.ts`).
2) Add `XExcerptHtml(state, locale) -> string` in `venice/lib/schema/<widgetType>.ts`.
3) Register both in `venice/lib/schema/index.ts`.
4) Ensure the widget’s state contains the minimal SEO/GEO keys used for gating:
   - `seoGeo.enabled`
   - `seo.enableSchema`
   - `seo.canonicalUrl` (optional; schema id/url only)

Do not add “SEO tools” (keywords, robots.txt editors, etc). The goal is a scalable baseline.

---

## Planned (not shipped; do not assume)

- Host-page deep-linking for iframe++ (cross-frame citation links) is not shipped.
- Rich schema variants (Organization/LocalBusiness/etc.) are not shipped.
- San Francisco SEO/GEO scoring + “Fix All” workflows are not shipped.
