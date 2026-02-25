STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes the shipped Venice behavior and the intended Venice contracts.
Runtime code + deployed Cloudflare config are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

## AIs Quick Scan

**Purpose:** Public embed origin for third‑party sites.

Venice serves an embed by combining:
- **Tokyo widget files** (the widget package/runtime), and
- **Paris instance config** (the instance state).
- For **published** instances, Venice can also serve `/e/:publicId` and `/r/:publicId` from **Tokyo render snapshots** (PRD 38) with **no Paris call** on the hot path.

For localized embeds, Venice may apply a locale-specific, Tokyo-hosted overlay to the instance config before bootstrapping `window.CK_WIDGET` (overlay is a pure, set-only ops patch; locale is never part of instance identity).

**Core rule (Phase 1):** The widget package owns rendering. Venice owns **embed assembly + delivery** (asset proxying, bootstrapping `window.CK_WIDGET`, cache policy, sandboxing, tokens/entitlements) so the public embed matches Bob’s Workspace preview for the same widget package + state.
**Owner:** `venice/` (Next.js route handlers running on the Edge runtime).
**Dependencies:** Paris (instance API), Tokyo (widget assets), Dieter (tokens/components).
**Shipped in this repo snapshot:**
- `GET /e/:publicId` (renders Tokyo `widget.html` and injects `window.CK_WIDGET`)
- `GET /r/:publicId` (returns a JSON render payload; also supports `?meta=1` for meta-only SEO/GEO injection)
- `GET /widgets/*` and `GET /dieter/*` (Tokyo asset proxy so widget packages stay portable)
- Loader script routes:
  - `GET /embed/latest/loader.js` (alias of v2)
  - `GET /embed/v1/loader.js` (legacy iframe loader)
  - `GET /embed/v2/loader.js` (iframe by default; optional shadow render via `data-force-shadow="true"`. Optional SEO/GEO via `data-ck-optimization="seo-geo"`. Supports `data-trigger`, `data-delay`, `data-scroll-pct`, `data-click-selector`, `data-locale`, `data-ts` (preferred), `data-cache-bust` (legacy), `data-max-width`, `data-min-height`, `data-width` (v0.2: `100%` only).)
- `GET /embed/pixel` (best-effort view meter; signs + forwards to Paris `POST /api/usage` for capped tiers)
- `POST /s/:publicId` (submission proxy; Paris currently returns 501 `NOT_IMPLEMENTED`)

**Shipped SEO/GEO (Iframe++):**
- When `data-ck-optimization="seo-geo"` is present on the loader script, the loader injects host-page JSON‑LD + a readable excerpt (see `documentation/capabilities/seo-geo.md`).

## Critical Concept: Widget Definition vs Instance

**Venice renders INSTANCES using widget definitions (the software) + instance config (the data).**

**Widget Definition** (Tokyo/CDN) = THE SOFTWARE:
- Core runtime files: `tokyo/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
- Contract files live alongside (`limits.json`, `localization.json`, `layers/*.allowlist.json`, `pages/*.json`), but Venice only consumes runtime files + locale allowlist for overlays.
- Platform-controlled; not stored in Michael and not served from Paris

**Widget Instance** (database) = THE DATA:
- `publicId`, `widgetType`, `status` (`published|unpublished`), `config`
- Served by Paris at `GET /api/instance/:publicId`

## Venice Responsibilities (Shipped)

### Front Door Rule

All third-party embed traffic terminates at Venice:
- Browsers never call Paris directly.
- Venice is a widget-agnostic embed assembler:
  - loads widget files from Tokyo
  - loads instance config from Paris
  - serves an embed-safe document (base URL, sandboxing) and bootstraps `window.CK_WIDGET`
  - applies embed delivery policy (cache headers, tokens/entitlements)

### Published-Only Rule (Hard Contract)

Venice must **never** serve unpublished instances.

- `GET /e/:publicId` returns `404` when `instance.status !== 'published'`.
- Venice must not use any dev-auth bypass (no `PARIS_DEV_JWT` behavior).
- Dev previews belong in Bob; Prague and third-party embeds must iframe Venice only.

### Primary Render Route: `GET /e/:publicId`

**Purpose:** Return complete widget HTML suitable for iframing on third-party sites.

**Render algorithm (high level):**
0. **Snapshot-only public serving (PRD 38):** for normal embed requests (no `X-Ck-Snapshot-Bypass: 1`), Venice serves only Tokyo render artifacts (`e.html`) from `renders/instances/<publicId>/published.json` -> `revisions/<revision>/index.json` + immutable `.../<fingerprint>/e.html` (per-locale). Venice returns snapshot bytes as-is (no request-time payload mutation). Response header: `X-Venice-Render-Mode: snapshot`.
1. **No public dynamic fallback:** when snapshot artifacts are missing/invalid, Venice returns explicit errors (`404` for unavailable/unpublished, `503` for published snapshot-missing). It does not render dynamically for public traffic.
2. **Revision-coherent strictness rule:** Venice never mixes revisions and does not locale-fallback in public snapshot mode. If the requested locale artifact is missing, Venice returns unavailable.
3. **Internal dynamic render path (snapshot generation only):** when `X-Ck-Snapshot-Bypass: 1` is present (tokyo-worker pipeline), Venice fetches Paris state and renders dynamically.
4. Internal dynamic rendering applies Tokyo `l10n` overlay (if present) from deterministic overlay paths:
   - Overlay must be set-only ops.
   - Overlay ops are already merged (agent ops + per-field user overrides).
   - Overlay must include `baseFingerprint` (required).
   - Snapshot materialization uses strict overlay matching:
     - **fresh:** `overlay.baseFingerprint` matches the current base fingerprint → apply full overlay
     - **stale/missing:** do not salvage during snapshot generation; non-EN snapshot generation must fail visibly
   - The allowlist comes from `tokyo/widgets/{widgetType}/localization.json` (translatable paths only).
5. Dynamic render path returns HTML that:
   - sets `<base href="<TOKYO_BASE>/widgets/{widgetType}/">` so widget package files resolve to Tokyo
   - injects a single canonical bootstrap object: `window.CK_WIDGET`

**Injected bootstrap object (canonical):**
```js
window.CK_WIDGET = {
  widgetname: "faq",
  publicId: "wgt_...",
  status: "published", // or "unpublished"
  theme: "light",      // or "dark"
  device: "desktop",   // or "mobile"
  locale: "en",
  state: { /* instance config */ },
  enforcement: null,
};
```

Widgets consume `window.CK_WIDGET.state` for the initial render (legacy). For multi-embed host pages, widgets SHOULD prefer `window.CK_WIDGETS[publicId].state` when available, and fall back to `window.CK_WIDGET.state`. Widgets then respond to Bob preview updates via `ck:state-update` postMessage.

**Query parameters (shipped):**
- `locale=<bcp47-ish>` (optional; when omitted, Venice defaults to `en` without any auto-selection)
- `ts=<milliseconds>` (optional; cache bust / no-store)

**Non-goal (strict):**
- Locale is never encoded into `publicId`. Venice does not support `wgt_curated_*.<locale>` URLs; they are treated as invalid and will 404.

**Cache strategy (shipped):**
  - With `?ts=<timestamp>`: `no-store` (explicit cache bust)
  - Published: `no-store` (pointer-coherent snapshot serving)
  - Unpublished: never served on public embed routes

### JSON Render Route: `GET /r/:publicId` (shipped)

**Purpose:** Return a structured render payload for embed loaders and SEO/GEO modes.

Response includes (as implemented today):
- `renderHtml` (HTML body content with script tags stripped)
- `assets.styles[]` and `assets.scripts[]` (resolved widget asset paths)
- `schemaJsonLd` (derived from `widgetType + state + locale`)
- `excerptHtml` (derived from `widgetType + state + locale`)
- `state` (localized instance config; overlays applied the same as `/e`)

**Snapshot-only public serving (PRD 38):** normal requests serve `r.json` (or `meta.json` for `?meta=1`) from Tokyo `renders/instances/<publicId>/published.json` -> `revisions/<revision>/index.json` + immutable artifacts. Venice returns snapshot bytes as-is (no request-time payload mutation). Response header: `X-Venice-Render-Mode: snapshot`.

**No public dynamic fallback:** when snapshot is missing/invalid, Venice returns explicit errors with `X-Venice-Snapshot-Reason`.

**Internal dynamic render path:** only when `X-Ck-Snapshot-Bypass: 1` is present (tokyo-worker snapshot pipeline), Venice renders from Paris and emits:
- `X-Venice-Render-Mode: dynamic`
- `X-Venice-Snapshot-Reason: SKIP_BYPASS`

**Meta-only mode (shipped):**
- `GET /r/:publicId?meta=1` returns a minimal payload used by iframe++ SEO/GEO injection:
  - `{ publicId, status, widgetType, locale, schemaJsonLd, excerptHtml }` (`locale` is `effectiveLocale`; headers provide requested/resolved/effective)

**Locale resolution (shipped):**
- `requestedLocale`: from `?locale=<token>` when present; otherwise defaults to `en`.
- `resolvedLocale`: best-supported match for `requestedLocale` (e.g. `fr-ca` → `fr`). `geoTargets` are used only for same-language variant selection.
- `effectiveLocale`: the locale actually applied to the response. Public snapshot mode does not locale-fallback; if the locale artifact is missing, Venice returns unavailable.
- `render locale source`: `X-Ck-Render-Locale-Source` (`current_locale | current_revision_en_fallback | unavailable`).

**Localization response headers (shipped):**
- `X-Ck-L10n-Requested-Locale`
- `X-Ck-L10n-Resolved-Locale`
- `X-Ck-L10n-Effective-Locale`
- `X-Ck-L10n-Status` (`base | fresh`)

### Tokyo Asset Proxy Routes (Shipped)

Venice exposes a stable asset origin for widget packages:
- `GET /widgets/*` proxies Tokyo `/widgets/*`
- `GET /dieter/*` proxies Tokyo `/dieter/*`
- `GET /assets/v/*` proxies Tokyo `/assets/v/*`

This keeps widget definitions portable and prevents hard-coded Tokyo origins inside widget HTML/CSS/JS.

**Cache policy (shipped):**
- Path-aware caching is enforced in Venice (not pass-through):
  - `l10n` overlays, immutable account assets (`/assets/v/*`), and immutable render artifacts: `force-cache` with 1-year revalidate.
  - `i18n` bundles: `force-cache` with 1-year revalidate; `i18n/manifest.json`: short TTL (5 min).
  - `l10n` `index.json`: short TTL (5 min) for overlay metadata freshness.
  - `widgets/` + `dieter/`: short TTL (5 min) for fast iteration.
  - Everything else: `no-store`.

**Asset URL contract (shipped):**
- Venice loaders do not inject global asset-origin variables.
- Widget runtime resolves asset/icon URLs via canonical root-relative paths (`/assets/v/*`, `/dieter/*`, `/widgets/*`) served by Venice proxy routes.

### Embed loader (v2) data attributes (shipped)

The v2 loader supports two install shapes:
1) **Recommended (multi-embed / SPA-safe):** placeholders + one loader script  
   - Placeholder: `<div data-clickeen-id="wgt_..."></div>` (required)  
   - Loader: `<script src="<VENICE_URL>/embed/latest/loader.js" async></script>`
2) **Legacy (single-embed):** `data-public-id` on the script tag  
   - `<script src="..." data-public-id="wgt_..." ...></script>`

**Scriptless mode (builders that block scripts):**
- Use a plain iframe to `GET /e/:publicId`:
  - `<iframe src="<VENICE_URL>/e/wgt_...?locale=en" ...></iframe>`

Attributes can live on the placeholder (recommended) or on the script tag (legacy / defaults):
- `data-clickeen-id` (required for placeholder mode)
- `data-public-id` (required for legacy script mode)
- `data-trigger` (`immediate` | `time` | `scroll` | `click` | `overlay`)
- `data-delay` (ms, used when `data-trigger="time"`)
- `data-scroll-pct` (0-100, used when `data-trigger="scroll"`)
- `data-click-selector` (CSS selector, used when `data-trigger="click"`)
- `data-force-shadow` (`true` to use `/r/:publicId` shadow render instead of iframe)
- `data-ck-optimization` (`seo-geo` to enable iframe++ SEO/GEO injection: host JSON‑LD + excerpt; does not change UI mode)
- `data-locale` (requested locale override; otherwise uses `navigator.language`. Venice may return a different effective locale; see `X-Ck-L10n-*` headers.)
- `data-ts` (preferred cache-bust token; appended to `/e` and `/r` requests)
- `data-cache-bust` (`true` to add `?ts=` cache busting; legacy)
- `data-max-width` (px; `0` means no max width)
- `data-min-height` (px)
- `data-width` (v0.2: only `100%` supported)

**Behavior (shipped):**
- **Auto-resize:** listens for `postMessage` `{ type: "ck:resize", height }` from the iframe (origin-checked) and updates iframe height.
- **Fail-visible host diagnostics:** if the iframe is blocked by CSP (`frame-src`/`child-src`) or fails to load within a short timeout, the loader renders a host-page error card with actionable CSP guidance.
- **SPA/AJAX mount reliability:** the loader scans for `data-clickeen-id` placeholders and uses a `MutationObserver`; you can also call `window.Clickeen.mount()` after injecting DOM.

### Usage Pixel + Submissions

- `GET /embed/pixel` signs and forwards view events to Paris `POST /api/usage` (HMAC; only capped tiers are metered; frozen snapshots omit the pixel).
- `POST /s/:publicId` forwards to Paris `POST /api/submit/:publicId` (Paris returns 501 `NOT_IMPLEMENTED` in this repo snapshot).

## SEO + GEO (Cross-Cutting)

SEO and GEO require host-page metadata (schema + extractable excerpt).
Venice ships this as **Iframe++**: iframe UI + host-page injections via the loader when `data-ck-optimization="seo-geo"` is present.

See: `documentation/capabilities/seo-geo.md`

## References

- Runtime truth: `venice/app/e/[publicId]/route.ts`
- Asset proxies: `venice/app/widgets/[...path]/route.ts`, `venice/app/dieter/[...path]/route.ts`
- Widget contract: `documentation/widgets/WidgetArchitecture.md`

## Deployment (Cloudflare Pages)

Venice is a Next.js Edge app. The supported deploy surface is Cloudflare Pages using `@cloudflare/next-on-pages`.

**Build output:** `venice/.vercel/output/static`

**Recommended Pages settings**
- Root directory: repo root (monorepo)
- Build command: `pnpm --filter @clickeen/venice build:cf`
- Build output directory: `venice/.vercel/output/static`
- Environment variables (set once per environment):
  - `PARIS_URL` (Paris base URL; falls back to `NEXT_PUBLIC_PARIS_URL`)
  - `TOKYO_URL` (Tokyo base URL; falls back to `TOKYO_BASE_URL` or `NEXT_PUBLIC_TOKYO_URL`)
  - `USAGE_EVENT_HMAC_SECRET` (shared with Paris; required for `/embed/pixel` → `/api/usage` metering)

Venice fails fast in deployed environments if `PARIS_URL` or `TOKYO_URL` is missing (to avoid stale/incorrect hardcoded endpoints).
