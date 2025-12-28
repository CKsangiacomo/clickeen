STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to CEO. Do not guess.

## AIs Quick Scan

**Purpose:** Edge-deployed SSR embed runtime for widgets.
**Owner:** Vercel project `c-keen-embed`.
**Dependencies:** Paris (API), Tokyo (CDN assets), Atlas (read-only config), Dieter (CSS tokens).
**Phase-1 Endpoints:** `GET /e/:publicId`, `/embed/v{semver}/loader.js`, `/embed/latest/loader.js`, `GET /embed/pixel`.
**Database Tables:** None directly (reads via Paris/Michael).
**Common mistakes:** Letting browsers call Paris directly, skipping 5s timeout/`X-Request-ID`, ignoring branding fail-closed rules.

### 🔒 CRITICAL: Widget Definition vs Instance

**Venice renders INSTANCES using widget definitions (the software) + instance config (the data).**

**Widget Definition** (a.k.a. “Widget JSON”) **= THE SOFTWARE** (Tokyo/CDN):
- In-repo source: `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- Platform-controlled; **not stored in Michael** and **not served from Paris**

**Widget Instance = THE DATA** (database):
- ONE user's specific widget instance with their custom `config`
- Lives in database
- Contains: `publicId`, `widgetType` (e.g. `"faq"`), `config` (user's actual values)
- User edits `config` in a builder application

**When Venice renders `/e/:publicId`:**
1. Fetches **Widget Instance** from Paris → gets user's `config` + `widgetType`
2. (Planned) Loads widget runtime assets from Tokyo based on `widgetType`
3. (Planned) Renders HTML from widget definition + `config`
4. Returns server-rendered HTML

**Current repo snapshot:** Venice returns a safe debug shell (shows `config`) while the full “Tokyo widget → SSR HTML” pipeline is built.

# Venice — Edge SSR Widget Renderer (Phase-1)

## Purpose
Venice is Clickeen's edge-deployed embed service that delivers server-rendered HTML to external websites via a single script tag. It is the public-facing front door for embeds and proxies to Paris for instance data. (In this repo snapshot, HTML rendering is a safe debug shell; widget rendering from Tokyo assets is planned.)

## Deployment & Runtime
- **Vercel Project**: `c-keen-embed`
- **Source Directory**: `venice`  
- **Runtime**: Edge (NOT Node.js)
- **Build Command**: `pnpm build`
- **URL Pattern**: `https://c-keen-embed.vercel.app`

## Core Contracts (Phase-1)

**Front-door pattern**: Venice is the sole public origin for embeds. Third-party pages never call Paris directly; Venice enforces tokens/branding/entitlements and communicates with Paris over a private channel. Branding decisions (`branding.enforced`) come from Paris responses—if flags are missing Venice MUST render with full branding (fail closed).

### Primary Embed Route: `GET /e/:publicId`
**Purpose**: Server-render widget HTML with configuration  
**Cache Strategy**: 
- With `?ts=<timestamp>`: `no-store` (preview mode)
- Published instances: `public, max-age=300, s-maxage=600, stale-while-revalidate=1800`
- Draft/inactive instances served without `ts`: `public, max-age=60, s-maxage=60, stale-while-revalidate=300`

**Query Parameters**:
- `theme=light|dark` (optional, defaults to 'light')
- `device=desktop|mobile` (optional, defaults to 'desktop')
- `ts=<milliseconds>` (optional, triggers cache-bust preview mode with no-store)
- `preview=1` (optional, enables preview-only features: postMessage patch script)

**Response**: `text/html; charset=utf-8` with complete widget HTML

**Integration Flow**:
1. Extract `publicId` from URL path
2. Load widget instance from Paris: `GET /api/instance/:publicId` → gets user's `config` + `widgetType`
3. Apply theme/device hints (if applicable)
4. Render HTML (currently a safe debug shell; planned: render from Tokyo widget assets)
5. **If `?preview=1` present:** Inject postMessage patch script (preview-only feature)
6. Inject "Made with Clickeen" backlink (Phase-1 requirement)
7. Return HTML with appropriate cache headers

**Preview Mode (`?preview=1`):**

When `preview=1` query parameter is present, Venice injects a preview-only patch script that enables instant updates:

**What it does:**
- Listens for postMessage from preview clients with patch data
- Updates CSS variables on elements with `data-widget-element` attributes
- Updates DOM content (text, innerHTML) safely
- Enables instant typing feedback without iframe reload

**Security:**
- Origin whitelist: Only approved builder or preview origins allowed
- Field whitelist: Per-widget whitelist of patchable fields (see widget PRDs)
- Value validation: Type checks, enum validation, numeric clamping
- Script uses CSP nonce, strict-dynamic

**Example postMessage:**
```javascript
// From a preview client to the Venice iframe
iframe.contentWindow.postMessage({
  type: 'patch',
  widget: 'content.faq',
  fields: {
    text: 'New text',
    color: 'red',
    radiusPx: 16
  }
}, veniceOrigin);
```

**Example patch handler (injected only when preview=1):**
```javascript
window.addEventListener('message', (event) => {
  // Origin check
  const allowedOrigins = ['http://localhost:3000', 'https://app.clickeen.com'];
  if (!allowedOrigins.includes(event.origin)) return;

  const { type, widget, fields } = event.data;
  if (type !== 'patch' || widget !== 'content.faq') return;

  const button = document.querySelector('[data-widget-element="button"]');
  if (!button) return;

  // Whitelist + validate each field
  if ('text' in fields) {
    button.textContent = String(fields.text).slice(0, 50);
  }
  if ('color' in fields && ['green', 'red'].includes(fields.color)) {
    const bg = fields.color === 'red' ? '#ef4444' : '#22c55e';
    button.style.setProperty('--btn-bg', bg);
  }
  if ('radiusPx' in fields) {
    const radius = Math.max(0, Math.min(32, Number(fields.radiusPx) || 12));
    button.style.setProperty('--btn-radius', `${radius}px`);
  }
});
```

**Production embeds (preview=1 absent):**
- NO postMessage script injected
- Pure SSR HTML/CSS only
- No client JS required for basic functionality
 

### Overlay Loader Bundle: `/embed/v{semver}/loader.js`
**Purpose**: Provide overlay/pop-up delivery via a single script  
**Distribution**: Static asset published per semver; `/embed/latest/loader.js` alias maintained manually  
**Target**: Prefer ≤80KB gzipped; MUST NOT exceed 200KB gzipped (embed surfaces)  
**Behavior**: 
- Parses `data-*` attributes (`data-trigger`, `data-delay`, `data-scroll-pct`, `data-click-selector`, etc.)
- Injects a positioned iframe that points to `/e/:publicId`
- Exposes a minimal event bus with `publish(event, payload)` and `subscribe(event, handler)` (returns `unsubscribe`)
- Buffers events until the iframe reports `ready`
- Keeps zero third-party dependencies to stay within the manual budget
  - Event semantics: `ready` fires on iframe `load`; `open` publishes when overlay is injected; `close` publishes when overlay is dismissed (click outside)

### Embed Snippets (Phase-1)
Inline (iframe) example:
```html
<iframe
  src="https://c-keen-embed.vercel.app/e/wgt_42yx31?ref=widget&id=wgt_42yx31"
  loading="lazy"
  title="Clickeen widget"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="strict-origin-when-cross-origin"
  style="width:100%;max-width:480px;height:420px;border:0;">
</iframe>
```

Overlay (loader) example:
```html
<script
  src="https://c-keen-embed.vercel.app/embed/v1.0.0/loader.js"
  data-public-id="wgt_42yx31"
  data-trigger="click"
  data-clickselector="#launchWidget"
  defer
></script>
```

Event bus usage (canonical global = `window.ckeenBus`):
```javascript
const unsubscribe = window.ckeenBus.subscribe('ready', () => {
  console.log('Widget ready');
});
window.ckeenBus.publish('open');
// Later
unsubscribe();
```

Interface contract:
```typescript
interface CkeenBus {
  publish(event: string, payload?: unknown): void;
  subscribe(event: string, handler: (payload?: unknown) => void): () => void;
}
```
Supported core events: `open`, `close`, `ready`. Widget-specific events may be added (document alongside the Widget Definition).

Naming clarifier (Phase‑1): The canonical global is `window.ckeenBus`. The loader also exposes a backward‑compatible alias at `window.Clickeen`; new integrations must use `window.ckeenBus`.

## Service Communication Rules (Phase-1, binding)

1. **Browser → Venice:** Allowed (public SSR `/e/:publicId`, `/embed/pixel`, `/embed/v{semver}/loader.js`).
2. **Browser → Paris:** **Never** (CORS blocks; Paris is not a third-party surface).
3. **Venice → Paris:** Server-to-server only; outbound requests include a ≤5s timeout and `X-Request-ID` for tracing.
4. **CORS & Headers:** Venice responses (HTML, loader, pixel) MUST set `Access-Control-Allow-Origin: *` only where safe (loader + pixel). SSR HTML is delivered via iframe and MUST omit permissive CORS headers. All responses MUST include `Strict-Transport-Security` and `X-Content-Type-Options: nosniff`.

## Paris Integration

### Configuration Loading
Venice fetches widget instances from Paris on each render. Widget definitions/assets are loaded from Tokyo/CDN (outside Paris).

```typescript
// Fetch instance snapshot from Paris API (user's data)
const instanceResponse = await fetch(`${PARIS_BASE_URL}/api/instance/${publicId}`, {
  headers: {
    'X-Request-ID': requestId,
    // Forward auth when available for drafts/protected instances:
    // 'Authorization': 'Bearer <jwt|embed|draft token>',
    // 'X-Embed-Token': '<embed|draft token>',
  },
});
const instance = await instanceResponse.json();
```

**Error Handling**:
- **404 NOT_FOUND**: Render "Widget not found" state
- **500+ Server Errors**: Render "Widget temporarily unavailable" state  
- **Network Timeout**: Render "Loading failed" state with retry option

**Cache Coordination**:
- Venice applies canonical caching rules (see Caching Strategy section below)
- Published widgets may be cached longer than drafts; preview (`?ts`) is always `no-store`.
- Outbound fetches to Paris MUST use an AbortController with a ≤5s timeout to protect edge latency budgets.

### Authentication & Tokens
- **Published instances**: public; no embed token required.
- **Draft / inactive / protected instances**: require an embed or draft token provided via Authorization header (`Bearer <token>` or `X-Embed-Token`). Venice validates token expiry and scope against Paris before rendering; invalid tokens return the appropriate error response.

**Draft tokens**: Anonymous editing relies on `widget_instances.draft_token`. Draft tokens are passed only via Authorization headers in preview flows and become invalid (`TOKEN_REVOKED`) immediately after claim.
Venice MUST log and surface canonical failure categories (`TOKEN_INVALID`, `TOKEN_REVOKED`, `NOT_FOUND`, `SSR_ERROR`, `RATE_LIMITED`) whenever rendering fails. (Config validation currently surfaces as Paris 422 payloads; dedicated UX is planned.)

### Token Validation Flow (draft/inactive)
- Venice calls `GET /api/instance/:publicId` on Paris with `Authorization: Bearer <embed|draft token>`.
- Paris validates token scope and expiry, then returns the instance payload or an error:
  - `401` → Venice surfaces `TOKEN_INVALID`
  - `410` → Venice surfaces `TOKEN_REVOKED`
  - Other errors map via the matrix below.

### Error Translation (Current)
- Venice currently renders a generic error page when Paris returns non-2xx.
- Token-specific UX and config-invalid fallbacks are planned; do not assume a stable client-visible error taxonomy yet.

### Branding (fail-closed)
- If `branding.enforced === true`, Venice MUST render the backlink (“Made with Clickeen”).
- If `branding.enforced` is `undefined`, Venice MUST render the backlink (fail-closed) and log the anomaly.
- Otherwise Venice MUST respect `branding.hide`; paid plans may hide branding when permitted.

### Canonical Paris call (≤5s timeout)
```ts
async function parisFetch(path: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${process.env.PARIS_URL}${path}`, {
      headers: { ...headers, 'X-Request-ID': crypto.randomUUID() },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}
```

> **Environment:** Venice uses `PARIS_URL`. See `CONTEXT.md` “Phase-1 Environment Variables.”

## Widget Rendering System

### Server-Side Rendering (SSR)
Planned: Venice renders HTML by combining the widget definition (Tokyo/CDN assets) with instance `config` (from Paris/Michael).  
Current repo snapshot: `venice/app/e/[publicId]/route.ts` renders a safe debug shell (it does not execute widget definitions yet).

```html
<!-- Example output structure -->
<div class="ckeen-widget" data-widget-id="contact-form" data-theme="light">
  <form class="ckeen-form" action="/s/ABC123" method="POST">
  <!-- Venice /s/:publicId proxy → Paris /api/submit/:publicId -->
    <div class="ckeen-field">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" required>
    </div>
    <!-- ... more fields based on config ... -->
    <button type="submit" class="ckeen-button">Send Message</button>
  </form>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com" target="_blank">Made with Clickeen</a>
  </footer>
</div>
```

### Configuration Application
Instance `config` is used by widget rendering logic to generate HTML:

```json
{
  "title": "Frequently Asked Questions",
  "categories": [
    {
      "title": "Getting Started",
      "questions": [
        { "question": "How do I get started?", "answer": "Follow our quick start guide." }
      ]
    }
  ]
}
```

The widget definition executes its rendering logic using this `config` to generate structured HTML with appropriate fields, styling, and behavior.

### Dieter Integration  
Venice uses Dieter design system for styling:
- CSS tokens inlined in `<style>` tags for performance
- Component CSS classes applied to HTML elements
- Theme variants (light/dark) handled via CSS custom properties
- No external CSS dependencies to maintain performance budget

## Performance Requirements

### Size Budget: Prefer ≤80KB Gzipped (Hard Cap 200KB)
**Guidance**:
- Aim for ≤80KB gzipped total per embed (HTML + CSS + JS, including loader where applicable).
- Absolute maximum: 200KB gzipped total for any embed payload; do not ship above this cap.
- Minimize third-party dependencies to stay within the preferred target.

**Verification (NORMATIVE)**:
- Engineers verify bundle size manually before release; automate later phases only if mandated.
- If the preferred target is exceeded, trim dependencies or adjust CSS/HTML before shipping; never exceed the 200KB cap.

### Load Performance Targets
- **First Byte**: ≤100ms at edge locations
- **Time to Interactive**: ≤1s on 4G networks
- **Core Web Vitals**: 
  - LCP ≤2.5s
  - FID ≤100ms  
  - CLS ≤0.1

### Release Checklist (Phase-1)
1. **Loader size:** `embed/v{semver}/loader.js` preferred ≤80 KB gzipped; MUST NOT exceed 200 KB gzipped before release.
2. **Widget payloads:** representative widgets (free + premium) preferred ≤80 KB gzipped total initial HTML/CSS/JS; MUST NOT exceed 200 KB gzipped.
   - Optional helper: `pnpm --filter venice run check:budgets` (report-only) or `-- --strict` locally to enforce
3. **Headers:** SSR responses send the canonical Cache-Control directives plus `ETag`, `Last-Modified`, and `Vary: Authorization, X-Embed-Token`.
4. **CSP:** rendered HTML sets `default-src 'none'; frame-ancestors *; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' data:; form-action 'self'`.
5. **Fallbacks:** error states (`TOKEN_INVALID`, `NOT_FOUND`, upstream 503) render branded stubs and log appropriately.
6. **Atlas fallback:** simulate cache miss/timeout to confirm Venice falls back to Paris within the 5 s budget and emits an `atlas_unavailable` log.
7. **Integration scenarios:** complete the end-to-end checklist in `CURRENTLY_EXECUTING/TESTING.md` and confirm expected responses/logs before promoting.

### Caching Strategy
<!-- Canonical TTLs (Phase-1 Specs) -->
Published: `Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=1800`  
Draft: `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`  
Preview (`?ts`): `Cache-Control: no-store`  
Validators: set `ETag` and `Last-Modified=updatedAt`; `Vary: Authorization, X-Embed-Token`.  

```http
# Published widgets (stable config)
Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=1800

# Draft widgets (changing config)
Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300

# Preview mode (live editing)
Cache-Control: no-store
```

## Widget Types & Rendering

Per‑widget docs live under `documentation/widgets/*.md` (one file per widget; WIP in Phase‑1). Widgets currently wired for SSR in Venice are not GA.

### Phase-1 Supported Widgets

> The authoritative list of Phase-1 widgets lives in `documentation/CONTEXT.md` (Phase-1 Widget List section).

Each widget has:
- **Widget definition/assets** (Tokyo/CDN): `tokyo/widgets/{widgetType}/spec.json` + `widget.html`, `widget.css`, `widget.client.js`, `agent.md` (AI-only)
- **Widget Instance** (Michael database) — User's custom `config`
- **Venice route** — `venice/app/e/[publicId]/route.ts` (current: safe debug shell; planned: widget SSR from Tokyo assets)

**How Venice renders:**
1. Fetch Widget Instance from Paris → get user's `config` + `widgetType`
2. Render HTML (current: debug shell; planned: SSR using Tokyo widget assets)

### Widget State Management
Each widget handles multiple states:
- **Loading**: Initial render with skeleton
- **Ready**: Fully interactive with data loaded
- **Submitting**: Form submission in progress  
- **Success**: Action completed successfully
- **Error**: Display error message with retry option

## Security & Privacy

### Content Security Policy (CSP)
Venice-generated widgets MUST work within restrictive CSP:
```http
Content-Security-Policy:
  default-src 'none';
  frame-ancestors *;
  script-src 'self' 'nonce-{{nonce}}' 'strict-dynamic';
  connect-src 'self' https://c-keen-api.vercel.app https://c-keen-embed.vercel.app;
  style-src 'self' 'nonce-{{nonce}}';
  img-src 'self' data:;
  form-action 'self';
```

`connect-src` MUST list only Venice itself and the deployed Paris origin (including preview deployments). Update this directive whenever the API hostname changes.

### Privacy Compliance
- **No Third-Party Scripts**: Venice widgets are self-contained
- **Minimal Data Collection**: Only collect data user explicitly provides
- **No Cross-Site Tracking**: No cookies or local storage used
- **GDPR Compliant**: Include data processing notice in forms

### XSS Prevention
- All user-provided `config` values are HTML-escaped
- CSS values are validated against allowed patterns
- No `eval()` or `innerHTML` usage in client scripts
- Strict input validation on all configuration fields

## Analytics & Usage Tracking

### Lightweight Pixel Tracking
Venice includes minimal analytics via 1x1 pixel requests:

```javascript
// Fire-and-forget usage ping (writes to `usage_events` via Paris)
// Canonical query params: widget=<publicId>, event=<load|view|interact|submit|success|error>, ts=<epoch_ms>
new Image().src = `/embed/pixel?widget=${widgetId}&event=load&ts=${Date.now()}`;
```

**Tracked Events**:
- `load`: Widget HTML rendered
- `view`: Widget visible in viewport  
- `interact`: User interacted with widget
- `submit`: Form submission attempted
- `success`: Action completed successfully
- `error`: Error occurred during action

### Privacy-Compliant Implementation
- No personal data in tracking pixels
- Only aggregate usage statistics
- User can opt out via `data-ckeen-analytics="false"` attribute
- Respects Do Not Track browser settings
- Paris persists events to `usage_events` and enforces per-IP/per-instance rate limits (see Phase-1 Specs).
- `/embed/pixel` is a Venice endpoint; it forward-proxies to Paris `POST /api/usage` after local validation.

## Error Handling & Fallbacks

### Graceful Degradation
When Venice cannot render a widget properly:
1. **Config validation error (Paris 422)**: Render a safe error state (dedicated UX planned).
2. **Upstream Failure (Paris/Atlas unavailable)**: Return a 503 response with branded HTML (see below) and appropriate cache headers.
3. **Timeout**: Show loading state with manual retry option while logging the failure for follow-up.

### Error State Templates
```html
<!-- 503 fallback (served by Venice when dependencies are unavailable; log SSR_ERROR) -->
<div class="ckeen-widget ck-status-error" data-widget-id="{{publicId}}">
  <div class="ck-status-body">
    <p>We're temporarily unavailable. Please try again shortly.</p>
  </div>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget&id={{publicId}}" target="_blank">Made with Clickeen</a>
  </footer>
</div>

<!-- Token invalid fallback (log TOKEN_INVALID) -->
<div class="ckeen-widget ck-status-token" data-widget-id="{{publicId}}">
  <div class="ck-status-body">
    <p>Access token is invalid or expired.</p>
  </div>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget&id={{publicId}}" target="_blank">Made with Clickeen</a>
  </footer>
</div>

<!-- Draft token revoked fallback (log TOKEN_REVOKED) -->
<div class="ckeen-widget ck-status-token" data-widget-id="{{publicId}}">
  <div class="ck-status-body">
    <p>This draft link has been claimed. Sign in to continue editing.</p>
  </div>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget&id={{publicId}}" target="_blank">Made with Clickeen</a>
  </footer>
</div>

<!-- Not found fallback (log NOT_FOUND) -->
<div class="ckeen-widget ck-status-notfound" data-widget-id="{{publicId}}">
  <div class="ck-status-body">
    <p>This widget could not be found.</p>
  </div>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget&id={{publicId}}" target="_blank">Made with Clickeen</a>
  </footer>
</div>

<!-- Rate limited fallback (log RATE_LIMITED) -->
<div class="ckeen-widget ck-status-ratelimited" data-widget-id="{{publicId}}">
  <div class="ck-status-body">
    <p>Too many requests. Please try again soon.</p>
  </div>
  <footer class="ckeen-backlink">
    <a href="https://clickeen.com/?ref=widget&id={{publicId}}" target="_blank">Made with Clickeen</a>
  </footer>
</div>
```

### Error Scenario Matrix (Phase-1, planned UX)

Current repo snapshot: `venice/app/e/[publicId]/route.ts` renders a generic error page on failures. The matrix below is the target UX/logging contract.
| Scenario | Trigger | HTTP status | Error key / payload | UI behaviour | Logging |
| --- | --- | --- | --- | --- | --- |
| Missing/invalid embed token | Draft/inactive instance without valid token | 401 | `TOKEN_INVALID` | Render token-invalid fallback; prompt refresh/claim | `token_invalid` with publicId + requestId |
| Draft token already claimed | Venice receives token Paris marked revoked | 410 | `TOKEN_REVOKED` | Show “claimed” fallback; advise sign-in | `token_revoked` + token fingerprint (hashed) |
| Instance not found | Paris returns 404 | 404 | `NOT_FOUND` | Render not-found fallback | `not_found` |
| config fails validation | Paris returns 422 with `[ { path, message } ]` | 422 | 422 validation array | Render config-invalid fallback with inline message | `config_invalid` + validation summary |
| Rate limit exceeded | Paris returns 429 | 429 | `RATE_LIMITED` | Render rate-limited fallback and set retry-after | `rate_limited` with window metadata |
| Paris/Atlas outage | Upstream dependency unavailable / timeout | 503 | `SSR_ERROR` | Render branded 503 fallback; retry with backoff | `ssr_error` including dependency + latency |
| Atlas miss/timeout | Edge Config unavailable but Paris succeeds | 200 | n/a (serves data) | Normal render | `atlas_unavailable` warning (once per window) |

Implementers MUST log using Berlin helpers with the provided keys and include `X-Request-ID`, `publicId`, and dependency timing (when relevant). Repeated failures trigger the release checklist step that verifies fallbacks before shipping.

## Development & Testing

### Local Development Setup
```bash
# Start Venice in development mode
cd services/embed
pnpm dev

# Test widget rendering
curl "http://localhost:3002/e/demo-widget?theme=light&device=desktop"
```

### Testing Strategy
- **Unit Tests**: Configuration parsing and HTML generation
- **Integration Tests**: End-to-end widget rendering with mock Paris
- **Performance Tests**: Bundle size and load time validation  
- **Cross-Browser Tests**: Widget compatibility across browsers
- **Security Tests**: XSS prevention and CSP compliance

### Deployment Process
1. Build and bundle widget rendering code
2. Run performance budget checks  
3. Test against staging Paris API
4. Deploy to Vercel Edge locations
5. Validate cache behavior and TTLs
6. Monitor error rates and performance metrics

## Future Considerations (Post-Phase-1)

### Advanced Features (Not in Phase-1)
- **Custom CSS Injection**: Allow workspace-specific styling overrides
- **A/B Testing**: Serve different widget variants to measure performance
- **Progressive Enhancement**: Add JavaScript features progressively
- **Offline Support**: Cache widgets in service worker for offline use
- **Real-time Updates**: WebSocket connections for live widget updates

### Scalability Improvements
- **Edge Caching**: Intelligent cache invalidation based on config changes
- **CDN Optimization**: Serve static assets from closest edge location  
- **Bundle Splitting**: Load widget code on-demand to reduce initial payload
- **Image Optimization**: Automatic image resizing and format conversion

This completes the Venice system specification. Venice should be implemented to work seamlessly with Paris APIs while maintaining the strict performance budget and security requirements outlined above.
