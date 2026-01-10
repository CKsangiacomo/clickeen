# Prague — Marketing & SEO Surface

STATUS: Runtime reality (this repo)
Created: 2024-12-27
Last updated: 2026-01-10

---

## 0) What Prague is (in this repo)

Prague is the marketing + SEO surface, implemented as an **Astro SSG** app deployed on **Cloudflare Pages**.

In this repo snapshot, Prague’s widget marketing content is sourced from **checked-in JSON** under `tokyo/widgets/*/pages/*.json` (not fetched from a remote Tokyo service).

At build time, Prague:
- enumerates widgets by scanning `tokyo/widgets/*` (excluding `_*/` and `shared/`)
- enumerates locales via `prague/src/lib/locales.ts`
- renders a fixed set of routes under `prague/src/pages/**`
- fails fast if required widget page JSON files are missing

Note: the helper module is still named `prague/src/lib/markdown.ts`, but it no longer parses markdown. It loads the JSON page specs described below.

---

## 1) Routes (shipped)

### 1.1 Widget directory

- `/{locale}/` — Widget directory page (lists widgets by reading `overview.json` hero copy)

There is currently no dedicated `/{locale}/widgets/` index route in this repo snapshot; keep any “view all widgets” links aligned with the actual directory page.

### 1.2 Widget overview

- `/{locale}/widgets/{widget}` — Widget landing page (overview). Renders the full landing block stack from:
  - `tokyo/widgets/{widget}/pages/overview.json`

This route is strict: it throws at build time if `overview.json` is missing required blocks/copy fields.

### 1.3 Widget subpages

- `/{locale}/widgets/{widget}/{page}` where `page ∈ { templates, examples, features, pricing }`

Current repo behavior:
- these pages are UI stubs (“Coming soon”) but the JSON files are still required (contract enforcement)
- source: `tokyo/widgets/{widget}/pages/{templates|examples|features|pricing}.json`

---

## 2) Content source of truth (Tokyo → Prague)

### 2.1 Canonical page JSONs (required)

Each marketed widget must ship:
- `tokyo/widgets/{widget}/pages/overview.json`
- `tokyo/widgets/{widget}/pages/templates.json`
- `tokyo/widgets/{widget}/pages/examples.json`
- `tokyo/widgets/{widget}/pages/features.json`
- `tokyo/widgets/{widget}/pages/pricing.json`

The widget overview page uses `blocks[]` to render a deterministic layout. Example schema (shape, not a full spec):
```json
{
  "v": 1,
  "blocks": [
    { "id": "hero", "kind": "hero", "visual": true, "copy": { "headline": "...", "subheadline": "..." } },
    { "id": "minibob", "kind": "minibob", "copy": { "heading": "...", "subhead": "..." } }
  ]
}
```

### 2.2 Optional per-locale overrides (supported; may be absent)

Prague supports optional locale-specific JSON overrides:
- `tokyo/widgets/{widget}/pages/.locales/{locale}/{page}.json`

Rules (as implemented):
- if the locale override file is missing, Prague falls back to the canonical (en) `{page}.json`
- locale is never encoded into instance identity; it remains a runtime parameter

---

## 3) Minibob embed (shipped)

Prague embeds Bob in **minibob** mode as the only JS island.

Implementation:
- `prague/src/blocks/site/minibob.astro`
- iframe URL includes:
  - `subject=minibob` (policy gating)
  - `workspaceId` + `publicId` (instance identity)
  - `locale` (runtime parameter)

Defaults (local/dev):
- workspaceId defaults to `ck-dev` (`00000000-0000-0000-0000-000000000001`)
- publicId defaults to `wgt_{widget}_main`
- override via env:
  - `PUBLIC_MINIBOB_WORKSPACE_ID` / `PUBLIC_MINIBOB_WORKSPACE_ID_<WIDGET>`
  - `PUBLIC_MINIBOB_PUBLIC_ID` / `PUBLIC_MINIBOB_PUBLIC_ID_<WIDGET>`

---

## 4) Determinism rules (why this is strict)

- Widget marketing pages are JSON-only in this repo snapshot: no markdown crawling, no build-time parsing heuristics.
- Builds fail fast when the per-widget page contract is broken (missing required JSON/copy).
- “Website creatives” (visual widget embeds inside Prague blocks) remain locale-free instances (e.g. `wgt_web_{widgetType}.overview.hero`); locale is passed as a query param and/or applied via overlays at runtime.

---

## 5) Not shipped (in this repo snapshot)

The following ideas are intentionally not implemented here and must not be treated as executed behavior:
- long-tail hubs/spokes/comparisons pages
- any markdown-driven widget page pipeline under `tokyo/widgets/*/pages/**/*.md`

If/when long-tail SEO is reintroduced, it should ship behind a PRD with a deterministic contract (and this doc should be updated at the same time).
