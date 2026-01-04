STATUS: REFERENCE — LIVING DOC (MAY DRIFT)
This document describes the shipped Venice behavior and the intended Venice contracts.
When debugging reality, treat runtime code and deployed Cloudflare config as truth.

## AIs Quick Scan

**Purpose:** Public embed origin that serves widgets to third‑party sites by assembling:
- **Tokyo widget files** (the widget software/runtime), and
- **Paris instance config** (the widget data).

**Critical invariant:** Venice must not introduce a second widget implementation. The widget’s rendering logic lives in the widget package (Tokyo). Venice’s job is **embed assembly + policy** (asset proxying, cache headers, tokens/entitlements, sandboxing) so the **public embed matches what Bob’s Workspace preview shows** for the same widget package + state.
**Owner:** `venice/` (Next.js route handlers running on the Edge runtime).
**Dependencies:** Paris (instance API), Tokyo (widget assets), Dieter (tokens/components).
**Shipped in this repo snapshot:**
- `GET /e/:publicId` (renders Tokyo `widget.html` and injects `window.CK_WIDGET`)
- `GET /widgets/*` and `GET /dieter/*` (Tokyo asset proxy so widget packages stay portable)
- `GET /embed/pixel` (best-effort proxy; Paris currently returns 501 `NOT_IMPLEMENTED`)
- `POST /s/:publicId` (submission proxy; Paris currently returns 501 `NOT_IMPLEMENTED`)
**Planned / not fully wired yet:**
- Loader script routes (`/embed/v{semver}/loader.js`, `/embed/latest/loader.js`) — loader modules exist but aren’t exposed as `route.ts` yet.
- Indexable embed mode (inline, host-DOM) for SEO + GEO — see `documentation/capabilities/seo-geo.md`.

## Critical Concept: Widget Definition vs Instance

**Venice renders INSTANCES using widget definitions (the software) + instance config (the data).**

**Widget Definition** (Tokyo/CDN) = THE SOFTWARE:
- In-repo source: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- Platform-controlled; not stored in Michael and not served from Paris

**Widget Instance** (database) = THE DATA:
- `publicId`, `widgetType`, `status` (`published|unpublished`), `config`
- Served by Paris at `GET /api/instance/:publicId`

## Venice Responsibilities (Shipped)

### Front Door Rule

All third-party embed traffic terminates at Venice:
- Browsers never call Paris directly.
- Venice is a generic assembler/proxy:
  - no per-widget branching logic (no widget-specific rendering code paths)
  - no config healing/coercion (treat `config` as data; fail visible if invalid)
  - generic assembly is allowed (asset proxying, base URL handling, bootstrapping `window.CK_WIDGET`, cache policy, embed sandboxing)

### Primary Render Route: `GET /e/:publicId`

**Purpose:** Return complete widget HTML suitable for iframing on third-party sites.

**Render algorithm (high level):**
1. Fetch instance snapshot from Paris (`GET /api/instance/:publicId`) to get `widgetType`, `status`, and `config`.
2. Fetch `widget.html` from Tokyo via Venice’s proxy routes.
3. Return HTML that:
   - sets `<base href="/widgets/{widgetType}/">` so relative asset links resolve under Venice
   - injects a single canonical bootstrap object: `window.CK_WIDGET`

**Injected bootstrap object (canonical):**
```js
window.CK_WIDGET = {
  widgetname: "faq",
  publicId: "wgt_...",
  status: "published", // or "unpublished"
  theme: "light",      // or "dark"
  device: "desktop",   // or "mobile"
  state: { /* instance config */ }
};
```

Widgets consume `window.CK_WIDGET.state` for the initial render, and then respond to Bob preview updates via `ck:state-update` postMessage.

**Query parameters (shipped):**
- `theme=light|dark` (optional, defaults to `light`)
- `device=desktop|mobile` (optional, defaults to `desktop`)
- `ts=<milliseconds>` (optional; cache bust / no-store)

**Cache strategy (shipped):**
- With `?ts=<timestamp>`: `no-store` (explicit cache bust)
- Published: `public, max-age=300, s-maxage=600, stale-while-revalidate=1800`
- Unpublished (without `ts`): `public, max-age=60, s-maxage=60, stale-while-revalidate=300`

### Tokyo Asset Proxy Routes (Shipped)

Venice exposes a stable asset origin for widget packages:
- `GET /widgets/*` proxies Tokyo `/widgets/*`
- `GET /dieter/*` proxies Tokyo `/dieter/*`

This keeps widget definitions portable and prevents hard-coded Tokyo origins inside widget HTML/CSS/JS.

### Usage Pixel + Submissions (Present but Not Implemented End-to-End)

- `GET /embed/pixel` forwards to Paris `POST /api/usage` (Paris returns 501 in this repo snapshot).
- `POST /s/:publicId` forwards to Paris `POST /api/submit/:publicId` (Paris returns 501 in this repo snapshot).

## Explicit Non-Goals (Current Model)

- No patch-script injection or per-widget DOM patching in Venice.
- No “validation/coercion” of instance config inside Venice.
- No per-widget branching logic in Venice.

## SEO + GEO (Cross-Cutting)

SEO and GEO require an embed mode where schema and deep links live in the host DOM.
This is not compatible with iframe-only embedding as a moat strategy.

See: `documentation/capabilities/seo-geo.md`

## References

- Runtime truth: `venice/app/e/[publicId]/route.ts`
- Asset proxies: `venice/app/widgets/[...path]/route.ts`, `venice/app/dieter/[...path]/route.ts`
- Widget contract: `documentation/widgets/WidgetArchitecture.md`
