# PRD 097 - Venice World-Class Public Runtime

Status: Executed
Date: 2026-05-12
Architecture source: `documentation/architecture/CONTEXT.md`
Related observability: `Execution_Pipeline_Docs/01-Planning/095__PRD__Pre_GA_Observability_Minimums.md`
Related cleanup: `Execution_Pipeline_Docs/01-Planning/096__PRD__Pre_GA_Fragmentation_Tax_And_Product_Path_Cleanup.md`

## 1. Purpose

Venice is the public runtime product. Roma and Bob create widgets; Tokyo-worker prepares public artifacts; Venice is what visitors experience on customer sites.

This PRD will define the world-class Venice target: globally reliable, lean, cross-browser, SEO/GEO-capable, edge-first, and safe to run on millions of customer pages.

Venice must be treated as a CDN-grade product runtime, not as a normal app service. It is the surface that must work globally, across platforms and browsers, at very large public traffic volumes.

## 2. Product Promise

Clickeen does not ship a heavy widget app into customer websites.

This does not mean "zero JavaScript." A one-line third-party embed usually needs a tiny host-page script to find the target, mount an iframe, and handle sizing. The product promise is narrower and stronger:

> Clickeen does not dump a heavy widget application into the customer's page. Clickeen loads a tiny deterministic bootstrapper that mounts an isolated Venice iframe.

The intended model is:

- A tiny deterministic Venice loader runs on the host page.
- The loader mounts an isolated iframe for the actual widget experience.
- Public widget content is served from edge-cacheable Venice/Tokyo artifacts.
- Optional per-instance SEO/GEO metadata can be injected into the host page only when the instance and entitlement allow it.
- The loader must never behave like a client app, own widget state, pull frameworks, or make the host page depend on Clickeen internals.

The PRD must preserve this positioning against competitors that load full widget apps, frameworks, or broad runtime state into the host page.

## 3. Current Evidence To Verify

The full PRD must verify current Venice behavior before execution. Current evidence from the pre-execution review:

- `venice/app/embed/v2/loader.ts` is a 660-line host-page loader source file and about 23KB raw source.
- The current loader cache header is `public, max-age=300, s-maxage=600`.
- The current loader always ships code for features many embeds may not use: triggers, host error card, event bus, mutation observer, and SEO/GEO fetch logic.
- The current loader writes host-page globals (`window.ckeenBus` and `window.Clickeen`) by default.
- The current loader emits default `console.warn` output on customer pages.
- `venice/app/widget/[instanceId]/route.ts` returns a static HTML shell rather than fully rendered widget HTML.
- The iframe shell currently performs a browser-side boot waterfall: live pointer, config pack, locale overlay, widget HTML, then `document.write`.
- The widget shell cache header is `public, max-age=60, s-maxage=86400`.
- The current SEO/GEO host-page path performs a sequential pointer -> meta pointer -> meta pack fetch before injecting JSON-LD/excerpt.

These observations are not final acceptance criteria by themselves. They are the baseline issues PRD 097 must classify and resolve.

## 4. Reliability Bar

Venice must be designed as the most reliable service in the system.

Target properties:

- Global edge-first serving.
- No account auth dependency on public visitor traffic.
- No database dependency on public visitor traffic.
- Public reads rely on published artifacts and immutable/current pointers.
- Host pages must not break if Venice fails.
- Public failures must be quiet to visitors, diagnosable to Clickeen, and never noisy in the customer console by default.
- Runtime behavior must be deterministic across supported browsers.
- Multiple Clickeen widgets on one customer page must not share accidental host-page state.

The final PRD must define practical SLOs and verification gates. The aspirational bar is "CDN-grade," not "normal app uptime."

## 5. Target Runtime Architecture

The target architecture should be simple:

- Default host-page loader: mount iframe, pass stable options, handle resize/error, then get out of the way.
- Enhanced host-page path: only for explicit features such as SEO/GEO, triggers, dynamic placeholders, or overlays.
- Iframe runtime: Venice serves fully resolved public widget HTML as much as possible server-side.
- Public artifact reads: edge-cacheable, pointer-driven, and free of account/session dependencies.
- No-JS option: provide a direct iframe snippet for customers who want maximum static behavior or strict CSP compatibility.
- Host-page globals are prohibited by default. Any bus/API surface must be scoped per instance or explicitly opted into as an advanced API.

The full PRD must decide whether this becomes one versioned loader with feature gates, two loader entrypoints, or one minimal loader plus optional explicit snippets. The default path must stay tiny.

## 6. SSR And Paint Target

`/widget/:instanceId` should move toward true server-side artifact resolution at the Cloudflare edge.

The desired model:

1. Venice receives `/widget/:instanceId`.
2. The route handler resolves the published pointer and required public artifacts server-side through the existing Venice/Tokyo public artifact paths.
3. Venice returns iframe HTML that can paint without a browser-side artifact waterfall.
4. Widget interactivity hydrates only what the widget itself needs inside the iframe.

This preserves iframe isolation while avoiding four sequential browser fetches before first paint.

The full PRD must define what "SSR" means for current widget architecture. It must not introduce database reads, account auth, or host-page widget rendering.

The highest-leverage likely execution slice is moving the existing pointer -> config -> overlay -> widget HTML waterfall from the visitor browser into the Venice edge route. This is a route-handler rewrite, not new architecture.

## 7. SEO/GEO Requirement

SEO/GEO is a product differentiator and must remain supported per instance.

The design must preserve:

- Widget-owned SEO/GEO capability metadata.
- Per-instance generated metadata artifacts.
- Public metadata serving through Venice/Tokyo artifact paths.
- Host-page metadata injection where iframe isolation would otherwise hide SEO value.

SEO/GEO support must not turn the loader into a heavy runtime.

The full PRD must choose the SEO/GEO delivery model deliberately. Options to evaluate:

- Client-side enhancement from the loader: simplest and cache-friendly, but weaker for crawlers because JSON-LD lands after parse.
- Per-instance or query-param loader: allows server-side metadata baking, but reduces shared-loader cache efficiency.
- Separate explicit server-side SEO snippet: strongest for customers who can edit server-rendered page templates because JSON-LD is present before HTML reaches crawlers, but less PLG-simple.
- Hybrid: minimal default loader plus optional SEO/GEO embed variant for customers who enable the differentiator.

No option may create fallback product truth for unpublished, missing, or non-entitled instances.

## 8. Loader Direction

The current loader must be assessed against this target.

Draft direction:

- Author loader code as real TypeScript.
- Bundle default loader to one small dependency-free IIFE.
- Split or explicitly gate advanced features so most embedders do not pay for unused runtime code.
- Keep iframe-first rendering.
- Keep SEO/GEO as a small optional capability path.
- Gate diagnostics behind explicit debug mode.
- Remove customer-console noise by default.
- Do not write `window.ckeenBus`, `window.Clickeen`, or any other host-page global from the default loader.
- Version loader behavior explicitly.

Draft byte/cache targets for the full PRD to refine:

- Default loader should target roughly 1-2KB gzip if feasible.
- Loader cache should use versioned immutable URLs where safe, for example `/embed/v2.1.0/loader.js` with `Cache-Control: public, max-age=31536000, immutable`.
- `/embed/latest/loader.js` may remain as an auto-update compatibility alias or short-TTL redirect for customers who choose that tradeoff.
- Per-instance dynamic responses must have explicit cache tradeoffs.
- Widget iframe HTML should avoid short browser revalidation when content is versioned by published pointers.

Production loader output must emit zero console output by default. Diagnostics require explicit opt-in such as `data-ck-debug="true"` or a dedicated development loader variant.

If a pre-PRD hotfix is needed before full PRD 097 execution, the only allowed loader hotfix is to gate existing `console.warn` calls behind explicit debug mode. That hotfix must not redesign the loader, add bundling, or change SEO/GEO behavior.

## 9. Cross-Platform Verification

The full PRD should define a browser and platform matrix, including at minimum:

- Chrome desktop.
- Safari desktop.
- Firefox desktop.
- Edge desktop.
- iOS Safari.
- Android Chrome.
- Common WebView constraints if relevant to embed customers.

Verification must cover:

- Standard embed.
- Placeholder embed.
- Triggered embeds.
- Resize behavior.
- Error behavior.
- SEO/GEO metadata behavior.
- Cache behavior.
- No-JS iframe snippet behavior.
- CSP-sensitive host pages.
- Slow network first paint.
- Host page survival when Venice is unavailable.
- Multiple Clickeen widgets on one host page without shared global-state collisions.
- No customer-console output in default production mode.
- Versioned immutable loader cache headers plus `/embed/latest` compatibility behavior.

## 10. Non-Goals

- No React or framework runtime in the host-page loader.
- No host-page widget rendering as the default path.
- No account/session logic in Venice public visitor paths.
- No fallback product truth for unpublished or missing instances.
- No generic embed SDK platform beyond the current product needs.
- No analytics/tracking expansion unless separately approved.
- No customer-console diagnostics unless debug mode is explicit.
- No host-page globals in the default loader.
- No broad runtime rewrite that changes widget authoring truth.

## 11. Relationship To PRD 095 And PRD 096

PRD 096 no longer owns Venice loader cleanup. PRD 097 owns Venice runtime work, including loader cleanup, reliability, global serving, SEO/GEO correctness, and cross-browser verification.

PRD 095 owns the observability minimums that make Venice changes safe to evaluate. Any PRD 097 execution slice that changes loader behavior, SSR behavior, cache policy, or SEO/GEO delivery must either depend on PRD 095 or include equivalent visibility in its acceptance criteria.

If Venice work is needed before PRD 097 execution, it must be limited to the narrow console-warning debug-gating hotfix described above.

## 12. Execution Slices

### PRD 097A - Silence Default Customer Console Output

Execution status: Complete.

Executed changes:

- Added debug detection inside `venice/app/embed/v2/loader.ts` for:
  - `data-ck-debug="true"`
  - `ck_debug=1`
  - `window.CLICKEEN_DEBUG === true`
- Replaced the direct Clickeen diagnostic `console.warn(...)` calls with `debugWarn(...)`.
- Kept the existing diagnostics available when debug mode is explicit.
- Did not change loader cache headers, SEO/GEO fetch behavior, trigger behavior, iframe mounting, host-page globals, or widget shell behavior.

Verification:

- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `corepack pnpm --filter @clickeen/venice build` - green
- `node scripts/health/product-path-smoke.mjs --public-only --instance-id ins_01KR8R6ZYZZNDEZA0R8KCSWEEG --json` - green
- Direct scan found no remaining `console.warn('[Clickeen]...')` customer-console calls.
- `git diff --check` on the 097A touched files - green

Goal: remove default `console.warn` noise from the production embed loader without changing loader behavior.

Scope:

- `venice/app/embed/v2/loader.ts`

Allowed changes:

- Add a tiny debug flag resolver inside the existing loader template.
- Replace direct `console.warn(...)` calls with a debug-gated warning helper.
- Enable diagnostics only when explicitly requested by one of:
  - `data-ck-debug="true"` on the loader script.
  - `ck_debug=1` in the host page URL.
  - `window.CLICKEEN_DEBUG === true`.

Not allowed:

- No loader bundler changes.
- No cache header changes.
- No SEO/GEO behavior changes.
- No trigger behavior changes.
- No host-page global writes beyond the existing current behavior.
- No SSR/widget-shell changes.

Acceptance:

- Production/default loader emits no customer-console warnings.
- Debug mode preserves the current diagnostics for support.
- Venice typecheck/build is green.
- Cloud-dev public smoke remains green.

### PRD 097B - Venice Runtime Evidence And Slice Design

Execution status: Complete.

Evidence collected on 2026-05-13:

- Loader source:
  - `venice/app/embed/v2/loader.ts` is 678 lines and 24,010 bytes after PRD 097A.
  - The deployed cloud-dev loader response is 25,934 bytes raw and about 6.5KB gzip.
- Loader cache headers on cloud-dev:
  - `GET https://venice.dev.clickeen.com/embed/latest/loader.js`
    - `Cache-Control: public, max-age=14400, s-maxage=600`
    - `CF-Cache-Status: HIT`
  - `GET https://venice.dev.clickeen.com/embed/v2/loader.js`
    - `Cache-Control: public, max-age=14400, s-maxage=600`
    - `CF-Cache-Status: MISS` at measurement time
  - Source currently sets `Cache-Control: public, max-age=300, s-maxage=600`; Cloudflare/Pages deployment behavior is currently producing `max-age=14400`.
- Widget shell:
  - `GET https://venice.dev.clickeen.com/widget/ins_01KR8R6ZYZZNDEZA0R8KCSWEEG`
    - `Cache-Control: public, max-age=60, s-maxage=86400`
    - `X-Venice-Render-Mode: snapshot`
    - `CF-Cache-Status: DYNAMIC`
    - body size: 13,691 bytes
  - The shell still performs four browser-side fetches:
    - `/renders/widgets/:instanceId/live/r.json`
    - `/renders/widgets/:instanceId/config.json`
    - `/l10n/widgets/:instanceId/:locale/overlay.json`
    - `/widgets/:widgetType/widget.html`
- Host-page globals:
  - The loader still writes `window.ckeenBus`.
  - The loader still writes `window.Clickeen`.
  - The loader still writes `window.__CK_V2_EMBED_LOADER__`.
- SEO/GEO path:
  - `loadSeoGeoMeta(...)` still performs pointer -> meta pointer -> meta pack fetches before injecting JSON-LD/excerpt.
- Advanced default-loader surface still present:
  - Trigger handling.
  - Host-page error-card rendering.
  - Event bus.
  - Placeholder scanning with `MutationObserver`.
  - Lazy placeholder mounting with `IntersectionObserver`.
  - SEO/GEO client fetch path.

Slice order after evidence:

1. `097C`: server-side artifact resolution for `/widget/:instanceId`; move the current pointer/config/overlay/widget HTML waterfall from the iframe browser into the Venice edge route.
2. `097D`: minimal/versioned loader design; decide versioned immutable URL shape and `/embed/latest` compatibility behavior.
3. `097E`: host-page global removal or explicit opt-in API; default loader must stop writing globals.
4. `097F`: SEO/GEO delivery design; keep capability support while preventing default loader bloat.
5. `097G`: cross-browser and CSP verification matrix.

Verification:

- `curl` header/body measurements against cloud-dev loader and widget routes - complete
- Source scan for host globals, observers, SEO/GEO fetches, widget-shell fetches - complete
- No code changes made in PRD 097B

Goal: convert the rest of PRD 097 from architectural direction into executable slices after current evidence is refreshed.

Evidence to collect:

- Raw/gzip loader size.
- Current loader cache headers for `/embed/latest/loader.js` and `/embed/v2/loader.js`.
- Current `/widget/:instanceId` artifact waterfall and cache headers.
- Host global writes.
- SEO/GEO fetch sequence.
- Multiple-widget behavior.

Acceptance:

- The PRD records concrete evidence and slice order before any loader/SSR/cache redesign.
- No code changes beyond PRD 097A happen in PRD 097B.

### PRD 097C - Server-Side Widget Artifact Resolution

Execution status: Complete.

Executed changes:

- Rewrote `venice/app/widget/[instanceId]/route.ts` from a static browser boot shell into an edge route that resolves the same public artifacts server-side:
  - `/renders/widgets/:instanceId/live/r.json`
  - `/renders/widgets/:instanceId/config.json`
  - `/l10n/widgets/:instanceId/:locale/overlay.json`
  - `/widgets/:widgetType/widget.html`
- Preserved iframe isolation and the existing widget runtime globals:
  - `window.CK_WIDGET`
  - `window.CK_LOCALE_LABELS`
  - `window.CK_LOCALE_POLICY`
- Preserved locale resolution behavior: fixed `?locale=...`, IP mapping when enabled, `alwaysShowLocale`, then base locale.
- Preserved the current widget HTML assets by injecting `<base href="/widgets/:widgetType/" />` into the resolved widget document.
- Removed the browser-side widget shell boot path that fetched artifacts and called `document.write(...)`.
- Did not change loader cache headers, loader globals, loader SEO/GEO behavior, trigger behavior, or widget authoring truth.

Verification:

- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice build` - green
- Local runtime check with `TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice dev`:
  - `GET http://localhost:3000/widget/ins_01KR8R6ZYZZNDEZA0R8KCSWEEG` returned `200`.
  - Response contained resolved FAQ widget HTML and `<base href="/widgets/faq/" />`.
  - Response contained inline `window.CK_WIDGET`, `window.CK_LOCALE_LABELS`, and `window.CK_LOCALE_POLICY`.
  - Response did not contain `document.write`, `Loading...`, or browser-side `/renders/widgets`, `/l10n/widgets`, `/widgets/:widgetType/widget.html` fetches.
- `git diff --check` on PRD 097 touched files - green

Goal: move the current iframe browser waterfall into Venice edge resolution without adding account/session dependencies or changing loader behavior.

Scope:

- `venice/app/widget/[instanceId]/route.ts`

Acceptance:

- `/widget/:instanceId` returns widget HTML that can paint without a browser-side pointer/config/overlay/widget fetch waterfall.
- Missing, unpublished, invalid, or corrupt artifacts fail visibly at the named widget shell boundary.
- The iframe still owns widget execution; the host page does not receive widget app code.
- Venice typecheck/build are green.

### PRD 097D - Versioned Loader Cache Boundary

Execution status: Complete.

Executed changes:

- Added `GET /embed/v2.0.0/loader.js` as the first immutable semver loader URL.
- Kept `/embed/latest/loader.js` and `/embed/v2/loader.js` as short-cache compatibility aliases.
- Added cache selection inside the existing loader route:
  - semver loader paths receive `Cache-Control: public, max-age=31536000, immutable`
  - compatibility loader paths receive `Cache-Control: public, max-age=300, s-maxage=600`
- Updated Venice architecture docs to name the immutable semver URL and compatibility aliases.
- Did not change loader runtime behavior, loader globals, SEO/GEO behavior, trigger behavior, or iframe mounting.

Verification:

- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice build` - green
- Local header checks with `TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice dev`:
  - `/embed/latest/loader.js` returned `Cache-Control: public, max-age=300, s-maxage=600`
  - `/embed/v2/loader.js` returned `Cache-Control: public, max-age=300, s-maxage=600`
  - `/embed/v2.0.0/loader.js` returned `Cache-Control: public, max-age=31536000, immutable`
- Local body check confirmed `/embed/v2.0.0/loader.js` still serves the existing loader body; host globals remain unchanged and deferred to PRD 097E.
- `git diff --check` on PRD 097D touched files - green

Goal: establish a real immutable loader URL without changing the current loader body.

Scope:

- `venice/app/embed/v2/loader.ts`
- `venice/app/embed/v2.0.0/loader.js/route.ts`
- Venice architecture docs

Acceptance:

- A semver loader route exists and is immutable-cacheable.
- Existing `/embed/latest` and `/embed/v2` compatibility URLs keep short cache behavior.
- No loader-body rewrite happens in this slice.
- Venice typecheck/build are green.

### PRD 097E - Remove Default Host-Page Globals

Execution status: Complete.

Executed changes:

- Removed default loader writes to:
  - `window.ckeenBus`
  - `window.__CK_V2_EMBED_LOADER__`
- Kept the loader event bus internal to the loader closure.
- Kept placeholder observer state internal to the loader closure.
- Added explicit public API opt-in via `data-ck-api="true"`:
  - only when opted in, the loader exposes `window.Clickeen.mount`
- Did not change iframe mounting, trigger behavior, SEO/GEO behavior, versioned cache behavior, or widget shell behavior.

Verification:

- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice build` - green
- Local loader body check:
  - `/embed/v2.0.0/loader.js` contains no `window.ckeenBus`
  - `/embed/v2.0.0/loader.js` contains no `window.__CK_V2_EMBED_LOADER__`
  - `window.Clickeen` only appears inside the explicit `publicApiEnabled` branch
- Local header check confirmed `/embed/v2.0.0/loader.js` still returns immutable cache headers.
- `node scripts/health/product-path-smoke.mjs --public-only --instance-id ins_01KR8R6ZYZZNDEZA0R8KCSWEEG --json` - green
- `git diff --check` on PRD 097E touched files - green

Goal: remove accidental host-page global state from the default loader.

Scope:

- `venice/app/embed/v2/loader.ts`

Acceptance:

- Default loader writes no host-page bus/global state.
- Multiple Clickeen widgets no longer share `window.ckeenBus` or `window.Clickeen` by default.
- Optional public API exposure is explicit.
- Venice typecheck/build are green.

### PRD 097F - SEO/GEO Delivery Design

Execution status: Complete.

Decision:

- Do not bake per-instance JSON-LD into a shared `/embed/latest/loader.js` response. A shared cacheable loader has no instance context at response time.
- Keep iframe-first rendering. SEO/GEO remains a host-page metadata capability because iframe content is not enough for the customer's page SEO surface.
- Preserve the existing explicit capability trigger (`data-ck-optimization="seo-geo"`) until the loader split is implemented.
- The target implementation is two explicit paths:
  - a minimal default loader that mounts the iframe and does not ship SEO/GEO code
  - an explicit SEO/GEO enhancement path for customers who enable the differentiator
- The strongest crawler-facing path is a separate server-side SEO/GEO snippet/API for customers who can render metadata in their own server templates. This must be a deliberate product surface, not hidden inside the default loader.
- Client-side SEO/GEO injection remains an acceptable PLG/easy-install enhancement, but it is not the only SEO/GEO architecture and must not bloat the default loader.
- No SEO/GEO path may invent metadata for unpublished, missing, corrupt, or non-entitled instances.

Implementation implications for the next code slice:

- Split default loader bytes from SEO/GEO enhancement bytes.
- Do not remove SEO/GEO support; move it behind an explicit enhancement boundary.
- Do not introduce account/session dependencies into Venice public visitor paths.
- Keep widget-owned SEO/GEO capability and Tokyo-generated per-instance metadata artifacts as the source of truth.

Verification:

- Design reviewed against current evidence from PRD 097B.
- No code changes made in this slice.
- `git diff --check` on PRD 097 touched docs - green

Goal: choose the SEO/GEO delivery architecture before changing loader behavior.

Acceptance:

- The PRD rejects shared-loader JSON-LD baking.
- The PRD preserves SEO/GEO as a product differentiator.
- The PRD separates easy client enhancement from stronger customer-side SSR snippets.
- The next implementation slice has a concrete boundary: split default loader from SEO/GEO enhancement bytes.

### PRD 097G - Split Default Loader From SEO/GEO Enhancement Bytes

Execution status: Complete.

Executed changes:

- Kept `/embed/latest/loader.js` and `/embed/v2/loader.js` as compatibility loader paths with SEO/GEO support preserved.
- Changed `/embed/v2.0.0/loader.js` into the default immutable loader path without SEO/GEO metadata injection code.
- Added `/embed/v2.0.0/seo-geo-loader.js` as the explicit immutable SEO/GEO enhancement path.
- Kept SEO/GEO source of truth unchanged: widget capability, published live pointer, meta pointer, and meta pack artifacts.
- Did not change iframe mounting, trigger behavior, host-page global behavior, widget shell behavior, or Tokyo artifact contracts.

Verification:

- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice build` - green
- Local byte/source checks:
  - `/embed/v2.0.0/loader.js` is 21,143 bytes raw and contains no `loadSeoGeoMeta`, `upsertSchema`, `meta/live`, `schemaJsonLd`, `seoGeoOptimization`, or `ckOptimization`.
  - `/embed/v2.0.0/seo-geo-loader.js` is 25,913 bytes raw and contains the SEO/GEO metadata path.
  - `/embed/v2/loader.js` remains 25,913 bytes raw and preserves compatibility SEO/GEO behavior.
- Local header checks:
  - `/embed/v2.0.0/loader.js` returns `Cache-Control: public, max-age=31536000, immutable`
  - `/embed/v2.0.0/seo-geo-loader.js` returns `Cache-Control: public, max-age=31536000, immutable`
  - `/embed/v2/loader.js` returns `Cache-Control: public, max-age=300, s-maxage=600`
- `git diff --check` on PRD 097G touched files - green

Goal: reduce the default immutable loader bytes while preserving explicit SEO/GEO capability.

Scope:

- `venice/app/embed/v2/loader.ts`
- `venice/app/embed/v2.0.0/seo-geo-loader.js/route.ts`
- Venice architecture docs

Acceptance:

- Default versioned loader does not ship SEO/GEO metadata injection bytes.
- Explicit SEO/GEO loader preserves SEO/GEO capability.
- Compatibility aliases preserve existing behavior.
- Venice typecheck/build are green.

### PRD 097H - Cross-Browser And CSP Verification Matrix

Execution status: Complete for the repo-owned automated harness; Safari/iOS Safari remain explicit external release-matrix checks on supported hosts.

Evidence collected:

- Browser automation harness:
  - Added root dev dependency `@playwright/test` and Venice script `corepack pnpm --filter @clickeen/venice verify:runtime`.
  - `corepack pnpm exec playwright --version` returns `Version 1.60.0`.
  - Added `venice/playwright.runtime.config.ts`.
  - Added `venice/tests/runtime/embed-runtime.spec.ts`.
  - Added `.github/workflows/venice-runtime-browser-matrix.yml` on `macos-latest` for supported WebKit execution.
  - Default automated projects: Chromium desktop, Firefox desktop, and Android Chrome emulation.
  - Microsoft Edge desktop is covered by `CK_VENICE_INCLUDE_MSEDGE=1`.
  - Optional WebKit desktop/iOS Safari projects are declared via `CK_VENICE_INCLUDE_WEBKIT=1`.
- Harness coverage:
  - Default immutable loader mounts one iframe.
  - Default immutable loader writes no `window.Clickeen`, `window.ckeenBus`, or `window.__CK_V2_EMBED_LOADER__`.
  - Default immutable loader emits no Clickeen console output.
  - Placeholder embed mounts multiple widgets without host globals.
  - Direct no-JS iframe snippet serves resolved widget HTML.
  - Explicit SEO/GEO loader injects JSON-LD metadata.
  - CSP host page with `frame-src 'none'; child-src 'none'` produces a visible host-page error card.
- Runtime fix required by the harness:
  - Chromium fires/clears iframe events in a different order from Firefox for CSP-blocked frames.
  - Venice now attaches frame/CSP listeners before assigning `iframe.src`.
  - Once the CSP boundary fires, the later iframe `load` event cannot erase the visible error card.
- Local platform limits:
  - `corepack pnpm exec playwright install chromium firefox webkit` installed Chromium and Firefox, but WebKit failed with `Playwright does not support webkit on mac12`.
  - Microsoft Edge was installed after the initial local blocker and now passes the Edge project.
  - `/usr/bin/safaridriver` exists, but this PRD uses Playwright WebKit on GitHub Actions `macos-latest` for repo-owned Safari-family automation.
  - Real Safari/iOS Safari coverage still needs an external device/browser lab before GA.

Decision:

- Do not infer Safari/iOS Safari correctness from Chromium or Edge.
- Do not add more Venice runtime code for unsupported local browsers.
- Treat the repo-owned harness and `macos-latest` browser-matrix workflow as the required pre-merge verification.
- Treat real Safari/iOS Safari device/browser-lab checks as explicit release-matrix gates before GA.

Goal: prove Venice runtime behavior across the supported public embed matrix.

Acceptance:

- `corepack pnpm --filter @clickeen/venice verify:runtime` passes: 15/15 tests across Chromium desktop, Firefox desktop, and Android Chrome emulation.
- `CK_VENICE_INCLUDE_MSEDGE=1 pnpm --filter @clickeen/venice verify:runtime` passes: 20/20 tests across Chromium desktop, Firefox desktop, Android Chrome emulation, and Microsoft Edge desktop.
- `.github/workflows/venice-runtime-browser-matrix.yml` runs the same Venice runtime harness with `CK_VENICE_INCLUDE_WEBKIT=1` on `macos-latest`.
- `corepack pnpm --filter @clickeen/venice typecheck` passes.
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com corepack pnpm --filter @clickeen/venice build` passes.
- Safari/iOS Safari coverage is explicit and opt-in, not inferred from Chromium or Edge.
