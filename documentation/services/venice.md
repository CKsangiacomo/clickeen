# System: Venice — Public Embed Runtime (DB‑free)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-18 (PRD 73 Tokyo-owned public payload closure)

This doc describes the **current Venice runtime** after the PRD 54 pivot:
- Venice public routes are **Tokyo-only** and **DB-free**.
- Most public bytes are direct Tokyo/R2 reads; `GET /api/instance/:publicId` now proxies a Tokyo-worker assembled public-live payload.
- If the bytes are not in Tokyo, Venice returns an explicit “not live / not available” response.

## Deploy plane (cloud-dev/prod)

- Venice is a Cloudflare Pages app with **one deploy plane**: Git-connected Cloudflare Pages build.
- Canonical cloud-dev host: `https://venice.dev.clickeen.com`
- GitHub Actions may verify Venice’s build contract, but must not create Pages projects, sync Pages secrets, or deploy Venice artifacts.
- Venice’s Pages build contract is app-local:
  - root: `venice/`
  - build command: `pnpm build:cf`
  - output: `venice/.vercel/output/static`
- Manual Cloudflare project/env alignment is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.

---

## AIs Quick Scan

**Purpose:** Public embed origin for third‑party sites.

**Non‑negotiable contract (PRD 54):**
- `GET /e/:publicId` and `GET /r/:publicId` do **0** calls to Paris/Supabase.
- They serve **only** what is present in Tokyo/R2.
- They do **no** request-time healing, fallback, or “deciding what should exist”.
- `GET /api/instance/:publicId` is also Tokyo-only and public-live only.

**Venice reads these Tokyo files (v1):**
- Live pointer: `renders/instances/<publicId>/live/r.json` (mutable, `no-store`)
- Config pack: `renders/instances/<publicId>/config/<configFp>/config.json` (immutable)
- Locale pointer: `l10n/instances/<publicId>/live/<locale>.json` (mutable, `no-store`)
- Text pack: `l10n/instances/<publicId>/packs/<locale>/<textFp>.json` (immutable)
- (Tier-gated) Meta pointer: `renders/instances/<publicId>/live/meta/<locale>.json` (mutable, `no-store`)
- (Tier-gated) Meta pack: `renders/instances/<publicId>/meta/<locale>/<metaFp>.json` (immutable)

**Shipped routes (this repo snapshot):**
- `GET /e/:publicId` — iframe UI shell + bootstrap (Tokyo-only)
- `GET /r/:publicId` — live pointer proxy (Tokyo-only, `no-store`)
- `GET /r/:publicId?meta=1&locale=...` — meta pointer proxy (Tokyo-only, `no-store`)
- `GET /api/instance/:publicId` — public instance payload proxy for public demo/runtime consumers (Venice-served, Tokyo-assembled, public-live only)
- `GET /widgets/*` — Tokyo widget runtime proxy
- `GET /dieter/*` — Tokyo Dieter assets proxy
- `GET /renders/*` — Tokyo `renders/` proxy
- `GET /l10n/*` — Tokyo `l10n/` proxy
- Loader:
  - `GET /embed/latest/loader.js` (alias of v2)
  - `GET /embed/v2/loader.js`
- Compatibility:
  - `GET /embed/pixel` (no-op `204`)

Source of truth:
- `venice/app/e/[publicId]/route.ts`
- `venice/app/r/[publicId]/route.ts`
- `venice/app/embed/v2/loader.ts`
- `venice/app/renders/[...path]/route.ts`
- `venice/app/l10n/[...path]/route.ts`

---

## Core Concept: Venice serves what is live

Venice does not “render from DB”.

The only “truth” for public embeds is: **what Tokyo says is live** via the tiny live pointer file:
- `renders/instances/<publicId>/live/r.json`

If that file is missing, the instance is not live → Venice returns `404`.

---

## Route contracts

### `GET /r/:publicId` (live pointer; always DB-free)

Returns the bytes of:
- `renders/instances/<publicId>/live/r.json`

Headers:
- `cache-control: no-store`
- Geo headers are exposed so the loader/runtime can do IP-based locale selection (`localePolicy.ip.enabled=true`):
  - `X-Ck-Geo-Country`, `X-Ck-Geo-Region`, `X-Ck-Geo-City`, `X-Ck-Geo-Timezone`

### `GET /r/:publicId?meta=1&locale=...` (meta pointer; tier-gated)

Returns the bytes of the meta pointer file:
- `renders/instances/<publicId>/live/meta/<locale>.json`

Notes:
- If the account/tier is not entitled, meta pointers do not exist in Tokyo, so this returns `404`.
- The loader then fetches the meta pack referenced by `metaFp`.

### `GET /api/instance/:publicId` (public instance payload; always DB-free)

What it does:
1. Proxy `GET /renders/instances/:publicId/live/public-instance.json` from Tokyo.
2. Return that Tokyo-assembled public MiniBob boot payload unchanged to the browser.

Rules:
- It never reads saved/draft config.
- If the live pointer is missing, it returns `404`.
- Tokyo is the single owner of config/localization/public-locale assembly for this payload.
- Locale visibility still comes from public `readyLocales` only. Venice does not expose merely allowed/non-ready locales to MiniBob.

### `GET /e/:publicId` (iframe UI; always DB-free)

What it does (plain English):
1. Load the live pointer (`/r/:publicId`).
2. Decide the **effective locale**:
   - If the iframe URL includes `?locale=...`, use that only if it is in `readyLocales`.
   - Otherwise follow the pointer’s `localePolicy`:
     - If `localePolicy.ip.enabled=true`: map the viewer’s country to a locale only when that mapping resolves to a `readyLocale` (best-effort, no DB).
     - Otherwise start at `baseLocale`.
     - If `localePolicy.switcher.enabled=true` and there is more than one `readyLocale`, show a language switcher UI.
     - If `localePolicy.switcher.locales` is present, Venice uses that ordered subset of `readyLocales` for the switcher.
3. Fetch config pack + effective locale text pack from Tokyo.
4. Fetch widget runtime HTML from Tokyo: `/widgets/<widgetType>/widget.html`.
5. Bootstrap `window.CK_WIDGET` with the config + localized text.

If any required Tokyo file is missing, Venice returns a clear error (no fallback).
Non-ready allowed locales are never exposed to end users; they stay visible only in Roma/Bob as product-state truth.

Headers:
- `cache-control: public, max-age=60, s-maxage=86400`

---

## Caching rules (why it stays cheap)

Venice enforces three caching classes:

1) **Embed shell HTML** (`/e/:publicId`)
- Short cache: `public, max-age=60, s-maxage=86400`
- The shell is tiny and stable; freshness comes from the live pointers it fetches at runtime

2) **Live pointers** (`.../live/...`)
- Always `cache-control: no-store`
- Must reflect changes immediately

3) **Fingerprinted packs + widget assets** (`.../<sha256>/...`, `/widgets/*`, `/dieter/*`)
- Cache forever: `public, max-age=31536000, immutable`
- Fingerprints change when bytes change

This is why embeds can be **DB-free** and still deterministic.

---

## Loader behavior (v2)

Two install shapes:

1) Recommended (multi-embed / SPA-safe)
```html
<div data-clickeen-id="wgt_..."></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

2) Legacy (single embed)
```html
<script src="<VENICE_URL>/embed/latest/loader.js" async data-public-id="wgt_..."></script>
```

Scriptless mode:
```html
<iframe src="<VENICE_URL>/e/wgt_..." loading="lazy"></iframe>
```

SEO/GEO opt-in (tier-gated):
```html
<div data-clickeen-id="wgt_..." data-ck-optimization="seo-geo"></div>
<script src="<VENICE_URL>/embed/latest/loader.js" async></script>
```

Notes:
- SEO/GEO never changes UI mode (UI stays iframe).
- If meta isn’t available, UI still loads; meta injection is skipped.
