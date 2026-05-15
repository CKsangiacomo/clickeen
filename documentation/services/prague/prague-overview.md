# Prague — Marketing & SEO Surface

STATUS: Runtime reality (this repo)
Created: 2024-12-27
Last updated: 2026-04-27

---

## 0) What Prague is (in this repo)

Prague is the marketing + SEO surface, implemented as an **Astro** app deployed on **Cloudflare Pages**. GA routing is **market+locale** and pages render server-side from canonical page JSON so Prague can emit canonical SEO tags.

Deploy contract:
- Prague has **one deploy plane**: Git-connected Cloudflare Pages build.
- Canonical cloud-dev host: `https://prague.dev.clickeen.com`
- GitHub Actions may verify Prague builds and publish Prague content to Tokyo/R2, but must not create Pages projects, sync Pages secrets, or deploy Prague artifacts.
- Prague’s Pages build contract is app-local:
  - root: `prague/`
  - build command: `pnpm build`
  - output: `prague/dist`
- Manual Cloudflare project/env alignment is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.

In this repo snapshot, Prague’s widget marketing content is sourced from **checked-in JSON** under `tokyo/prague/pages/*/*.json` (single source of layout + base copy). Chrome UI strings remain in `prague/content/base/v1/chrome.json`. Prague does not own account-widget locale overlays.

At build time, Prague:
- enumerates widgets by scanning `tokyo/product/widgets/*` (excluding `_*/` and `shared/`)
- enumerates locales via `prague/src/lib/locales.ts`
- renders a fixed set of routes under `prague/src/pages/**`
- fails fast if required widget page JSON files are missing

At request time (widget pages only), Prague:
- loads canonical page JSON
- validates block contracts and compact account-instance embed IDs
- renders HTML from that page JSON

Note: the helper module is still named `prague/src/lib/markdown.ts`, but it no longer parses markdown. It loads the JSON page specs described below.

---

## 1) Routes (shipped)

Prague’s canonical URL identity is `/{market}/{locale}/...`:
- `market` is allowexternally referenced and configured in `prague/src/markets/markets.json` (e.g. `us`, `uk`, `it`, `ca`)
- `locale` is a supported locale token (from `packages/l10n/locales.json`, further constrained per-market by `prague/src/markets/markets.json`)

Root `/` is a non-canonical entry surface:
- if a valid cookie market exists, it 302s to `/{market}/{locale}/`
- else if IP geo maps to a market, it 302s to `/{market}/{defaultLocale}/`
- else it 302s to the default canonical (v0.2: `/us/en/`) — **no picker UI**

### 1.1 Widget directory

- `/{market}/{locale}/` — Widget directory page (lists widgets by reading `overview.json` hero copy, merged from deterministic overlays)

There is currently no dedicated `/{market}/{locale}/widgets/` index route in this repo snapshot; keep any “view all widgets” links aligned with the actual directory page.

### 1.2 Widget overview

- `/{market}/{locale}/widgets/{widget}` — Widget landing page (overview). Renders the full landing block stack from:
  - `tokyo/prague/pages/{widget}/overview.json`

This route is strict: it throws at build time if `overview.json` is missing required blocks/copy fields.

Overview hero runtime behavior:
- For `hero` blocks on the overview route, Prague can auto-build a locale carousel from a single instance ID (one slide per locale).
- Locale priority is market-configured in `prague/src/markets/markets.json` via `markets[].overviewHero`:
  - `strategy: "tier1"` + `tier1Locales[]` for multilingual markets
  - `strategy: "native-first"` + `nativeLocale` for single-primary-language markets
  - optional `regionalFallbackLocales[]` for adjacent-market fallback order
- Selection is deterministic: intersect with instance-available locales, preserve configured order, de-duplicate, cap to 3.

### 1.3 Widget subpages

- `/{market}/{locale}/widgets/{widget}/{page}` where `page ∈ { examples, features, pricing }`

Current repo behavior:
- these pages render blocks from JSON like overview; in this snapshot many subpages are intentionally minimal (typically `page-meta` + `hero`) until richer stacks are authored
- source: `tokyo/prague/pages/{widget}/{examples|features|pricing}.json`

---

### 1.4 Create bridge route

- `/{market}/{locale}/create` is a redirect bridge from Prague into Roma (`${PUBLIC_ROMA_URL}/home`).
- Prague preserves incoming query params and appends source context (`from=prague_create`, `market`, `locale`).
- If `PUBLIC_ROMA_URL` is missing, this route fails visibly with `503` (no silent fallback).
- Prague does not own account-widget overlay generation or serving. Public widget overlays are resolved by Venice from Tokyo published overlay IDs.

---

## 1.5 Authoring Prague blocks (AI checklist)

Prague widget pages are rendered from **block JSON** in Tokyo. They are marketing pages, not the account-widget overlay runtime. When you add or edit blocks, keep these filesystems in lockstep:

1) **Renderer** (Astro): `prague/src/blocks/**` + `prague/src/lib/blockRegistry.ts`
2) **Base copy** (source): `tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json`
3) **Embeds** (optional): `accountInstanceRef.instanceId` must use PRD 098 compact instance IDs.

### Add a new block type

- Add the renderer: `prague/src/blocks/{blockType}/{blockType}.astro`
- Register it: `prague/src/lib/blockRegistry.ts`
- Use it in a page JSON: `tokyo/prague/pages/{widget}/*.json` (ensure each block has `{ id, type, copy: {...} }`)
- Validate contracts locally:
  - `pnpm --filter @clickeen/prague typecheck`
  - `pnpm --filter @clickeen/prague build`

### Edit an existing block

- Keep `id` stable for deterministic block rendering and links.
- Prefer adding a new block `type` over mutating semantics of an existing one.

---

## 2) Content source of truth (Tokyo → Prague)

### 2.1 Canonical page JSONs (required)

Each marketed widget must ship:
- `tokyo/prague/pages/{widget}/overview.json`
- `tokyo/prague/pages/{widget}/examples.json`
- `tokyo/prague/pages/{widget}/features.json`
- `tokyo/prague/pages/{widget}/pricing.json`

The widget overview page uses `blocks[]` to render a deterministic layout. Example schema (shape, not a full spec):
```json
{
  "v": 1,
  "blocks": [
    { "id": "page-meta", "type": "page-meta", "copy": { "title": "...", "description": "..." } },
    { "id": "hero", "type": "hero", "copy": { "headline": "...", "subheadline": "..." }, "visual": true },
    { "id": "minibob", "type": "minibob", "copy": { "heading": "...", "subhead": "..." } }
  ]
}
```

Required non-visual blocks:
- `navmeta` (overview only, used by the mega menu)
- `page-meta` (all widget pages, used for `<head>` title/description)

Notes:
- Page JSON is the **single source of truth** for layout + base copy on Prague.
- Visual embeds are explicit: use `accountInstanceRef.instanceId` on blocks that should embed a account instance.

Prague does not merge localized page overlays in this runtime. Account-widget locale overlays are selected and served by Venice through the published render pointer and `/renders/widgets/{instanceId}/overlays/{overlayId}.json`.

Validation:
- Block meta + copy are validated via `prague/src/lib/blockRegistry.ts` during page load.
- Account instance embeds are validated against the current public instance/runtime contract; missing account instances fail fast in dev/build.

---

## 3) Minibob demo block (shipped)

Prague keeps the `minibob` block type as a **demo surface**, not as a second editor mode.

Implementation:
- `prague/src/blocks/minibob/minibob.astro`
- renders the marketing copy block (`heading`, `subhead`)
- embeds the public live widget through `InstanceEmbed`
- links the user to `/{market}/{locale}/create`

What it no longer does:
- does not iframe Bob
- does not boot Bob in a demo-editor mode
- does not fetch editor bootstrap payloads from Bob
- does not export draft state from a Bob iframe
- does not start a server-side handoff

Defaults (local/dev):
- instanceId is derived from the widget slug as `wgt_main_{widget}` (no override)

Demo locale visibility contract:
- the demo can view locales that are already public-live through Venice/Tokyo truth
- the demo does not gain locale governance, translation generation, publish, or account writes
- the demo is not a save-capable editor identity

---

## 4) Determinism rules (why this is strict)

- Widget marketing pages are JSON-only in this repo snapshot: no markdown crawling, no build-time parsing heuristics.
- Builds fail fast when the per-widget page contract is broken (missing required JSON/copy).
- Account instance embeds (visual widget instances inside Prague blocks) remain locale-free; locale is passed as a query param and/or applied via overlays at runtime.
- For canonical `/{market}/{locale}/...` URLs, Prague must not vary indexable content by request IP/cookies/experiment keys; market-bound geo overlays are derived from `prague/src/markets/markets.json`.

---

## 5) Not shipped (in this repo snapshot)

The following ideas are intentionally not implemented here and must not be treated as executed behavior:
- long-tail hubs/spokes/comparisons pages
- any markdown-driven widget page pipeline under `tokyo/prague/pages/*/**/*.md`
- acquisition personalization preview / “Make this widget yours”

If/when long-tail SEO is reintroduced, it should ship behind a PRD with a deterministic contract (and this doc should be updated at the same time).

---

## Links

- Prague blocks catalog: `documentation/services/prague/blocks.md`
- Localization contract: `documentation/capabilities/localization.md`
