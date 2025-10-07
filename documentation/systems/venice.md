STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It MUST NOT conflict with:
1) documentation/dbschemacontext.md (DB Truth) and
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Global Contracts).
If any conflict is found, STOP and escalate to CEO. Do not guess.

## AIs Quick Scan

**Purpose:** Edge-deployed SSR embed runtime for widgets.  
**Owner:** Vercel project `c-keen-embed`.  
**Dependencies:** Paris (API), Atlas (read-only config), Dieter (CSS tokens).  
**Phase-1 Endpoints:** `GET /e/:publicId`, `/embed/v{semver}/loader.js`, `/embed/latest/loader.js`, `GET /embed/pixel`.  
**Database Tables:** None directly (reads via Paris/Michael).
**Common mistakes:** Letting browsers call Paris directly, skipping 5s timeout/`X-Request-ID`, ignoring branding fail-closed rules.

# Venice — Edge SSR Widget Renderer (Phase-1)

## Purpose
Venice is Clickeen's edge-deployed widget rendering service that delivers server-rendered HTML widgets to external websites via a single script tag. It serves as the public-facing embed endpoint that transforms widget configurations into live, interactive HTML without shipping React bundles to end users.

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
- `ts=<milliseconds>` (optional, triggers preview mode with no-store cache)

**Response**: `text/html; charset=utf-8` with complete widget HTML

**Integration Flow**:
1. Extract `publicId` from URL path
2. Load widget configuration from Paris: `GET /api/instance/:publicId`
3. Apply theme/device hints to configuration  
4. Render widget HTML using configuration + Dieter design system
5. Inject "Made with Clickeen" backlink (Phase-1 requirement)
6. Return HTML with appropriate cache headers

### Overlay Loader Bundle: `/embed/v{semver}/loader.js`
**Purpose**: Provide overlay/pop-up delivery via a single script  
**Distribution**: Static asset published per semver; `/embed/latest/loader.js` alias maintained manually  
**Target**: ≤28KB gzipped (manual normative target, not enforced in CI)  
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
Supported core events: `open`, `close`, `ready`. Widget-specific events may be added (document alongside the widget config).

Naming clarifier (Phase‑1): The canonical global is `window.ckeenBus`. The loader also exposes a backward‑compatible alias at `window.Clickeen`; new integrations must use `window.ckeenBus`.

## Service Communication Rules (Phase-1, binding)

1. **Browser → Venice:** Allowed (public SSR `/e/:publicId`, `/embed/pixel`, `/embed/v{semver}/loader.js`).
2. **Browser → Paris:** **Never** (CORS blocks; Paris is not a third-party surface).
3. **Bob → Paris:** Allowed with Supabase JWT (workspace auth).
4. **Venice → Paris:** Server-to-server only; outbound requests include a ≤5s timeout and `X-Request-ID` for tracing.
5. **CORS & Headers:** Venice responses (HTML, loader, pixel) MUST set `Access-Control-Allow-Origin: *` only where safe (loader + pixel). SSR HTML is delivered via iframe and MUST omit permissive CORS headers. All responses MUST include `Strict-Transport-Security` and `X-Content-Type-Options: nosniff`.

## Paris Integration

### Configuration Loading
Venice fetches widget configurations from Paris on each render:

```typescript
// Fetch config from Paris API
const response = await fetch(`${PARIS_BASE_URL}/api/instance/${publicId}`);
const { config, status, updated_at } = await response.json();
```

**Error Handling**:
- **404 NOT_FOUND**: Render "Widget not found" state
- **500+ Server Errors**: Render "Widget temporarily unavailable" state  
- **Network Timeout**: Render "Loading failed" state with retry option

**Cache Coordination**:
- Venice applies the canonical TTLs/validators defined in Techphases-Phase1Specs.md.
- Published widgets may be cached longer than drafts; preview (`?ts`) is always `no-store`.
- Outbound fetches to Paris MUST use an AbortController with a ≤5s timeout to protect edge latency budgets.

### Authentication & Tokens
- **Published instances**: public; no embed token required.
- **Draft / inactive / protected instances**: require an embed or draft token provided via Authorization header (`Bearer <token>` or `X-Embed-Token`). Venice validates token expiry and scope against Paris before rendering; invalid tokens return the appropriate error response.

**Draft tokens**: Anonymous editing relies on `widget_instances.draft_token`. Draft tokens are passed only via Authorization headers in Bob/preview flows and become invalid (`TOKEN_REVOKED`) immediately after claim.
Venice MUST log and surface the canonical error keys (`TOKEN_INVALID`, `TOKEN_REVOKED`, `NOT_FOUND`, `CONFIG_INVALID`, `SSR_ERROR`, `RATE_LIMITED`) whenever rendering fails.

### Token Validation Flow (draft/inactive)
- Venice calls `GET /api/instance/:publicId` on Paris with `Authorization: Bearer <embed|draft token>`.
- Paris validates token scope and expiry, then returns the instance payload or an error:
  - `401` → Venice surfaces `TOKEN_INVALID`
  - `410` → Venice surfaces `TOKEN_REVOKED`
  - Other errors map via the matrix below.

### Error Translation Matrix
| Paris Error       | Venice Error   | Notes                          |
|-------------------|----------------|--------------------------------|
| `AUTH_REQUIRED`   | `TOKEN_INVALID`| Missing/invalid auth           |
| `FORBIDDEN`       | `TOKEN_INVALID`| Token not permitted for resource|
| `NOT_FOUND`       | `NOT_FOUND`    | Instance missing               |
| `CONFIG_INVALID`  | `CONFIG_INVALID`| Field errors present          |
| `RATE_LIMITED`    | `RATE_LIMITED` | Venice shows RL fallback       |
| `DB_ERROR` / 5xx  | `SSR_ERROR`    | Generic upstream failure       |
| *(anything else)* | `SSR_ERROR`    | Fail closed                    |

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
Venice generates complete HTML for widgets without client-side JavaScript:

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
Widget config JSON is transformed into HTML attributes and structure:

```json
{
  "title": "Contact Us",
  "fields": ["name", "email", "message"],
  "theme": "light", 
  "submitText": "Send Message",
  "branding": { "hide": false }
}
```

Becomes structured HTML with appropriate form fields, styling, and behavior.

### Dieter Integration  
Venice uses Dieter design system for styling:
- CSS tokens inlined in `<style>` tags for performance
- Component CSS classes applied to HTML elements
- Theme variants (light/dark) handled via CSS custom properties
- No external CSS dependencies to maintain performance budget

## Performance Requirements

### Size Budget: ≤28KB Gzipped
**Total Budget Breakdown**:
- HTML structure: ~8KB
- Inlined CSS (Dieter tokens + components): ~15KB  
- Minimal JavaScript (form handling, analytics): ~5KB
- **Never exceed 28KB total** per widget render

**Verification (NORMATIVE)**:
- Engineers verify bundle size manually before release; automate later phases only if mandated.
- If the budget is exceeded, trim dependencies or adjust CSS/HTML before shipping (no automatic fallback).

### Load Performance Targets
- **First Byte**: ≤100ms at edge locations
- **Time to Interactive**: ≤1s on 4G networks
- **Core Web Vitals**: 
  - LCP ≤2.5s
  - FID ≤100ms  
  - CLS ≤0.1

### Release Checklist (Phase-1)
1. **Loader size:** `embed/v{semver}/loader.js` ≤28 KB gzipped before release.
2. **Widget payloads:** representative widgets (free + premium) render ≤10 KB gzipped initial HTML/CSS.
   - Optional helper: `pnpm --filter venice run check:budgets` (report-only) or `-- --strict` locally to enforce
3. **Headers:** SSR responses send the canonical Cache-Control directives plus `ETag`, `Last-Modified`, and `Vary: Authorization, X-Embed-Token`.
4. **CSP:** rendered HTML sets `default-src 'none'; frame-ancestors *; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' data:; form-action 'self'`.
5. **Fallbacks:** error states (`TOKEN_INVALID`, `NOT_FOUND`, upstream 503) render branded stubs and log appropriately.
6. **Atlas fallback:** simulate cache miss/timeout to confirm Venice falls back to Paris within the 5 s budget and emits an `atlas_unavailable` log.
7. **Integration scenarios:** complete the end-to-end checklist in `documentation/INTEGRATION-TESTING.md` and confirm expected responses/logs before promoting.

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

### Phase-1 Supported Widgets

> Examples below are illustrative. The authoritative list of Phase‑1 widgets lives in `CRITICAL-TECHPHASES/Techphases-Phase1Specs.md` (section S8 Seed Widgets).

#### Contact Form Widget
**Config Schema**:
```json
{
  "title": "string",
  "description": "string (optional)",
  "fields": {
    "name": "boolean",
    "email": "boolean", 
    "phone": "boolean",
    "company": "boolean",
    "message": "boolean"
  },
  "submitText": "string",
  "successMessage": "string",
  "theme": "light|dark",
  "accentColor": "hex_color"
}
```

**Rendering Logic**:
1. Generate form with enabled fields only
2. Apply theme and accent color via CSS custom properties
3. Include client-side validation and submission handling
4. Show success/error states based on form submission

#### Newsletter Signup Widget  
**Config Schema**:
```json
{
  "title": "string",
  "placeholder": "string",
  "buttonText": "string", 
  "theme": "light|dark",
  "layout": "inline|stacked"
}
```

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
- **Retention**: Submissions proxied to Paris live in `widget_submissions`; anonymous rows are pruned after 30 days by backend maintenance (no client storage).

### XSS Prevention
- All user-provided config values are HTML-escaped
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
1. **Configuration Error**: Render the validated error state returned by Paris.
2. **Upstream Failure (Paris/Geneva/Atlas unavailable)**: Return a 503 response with branded HTML (see below) and appropriate cache headers.
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

### Error Scenario Matrix (Phase-1)
| Scenario | Trigger | HTTP status | Error key / payload | UI behaviour | Logging |
| --- | --- | --- | --- | --- | --- |
| Missing/invalid embed token | Draft/inactive instance without valid token | 401 | `TOKEN_INVALID` | Render token-invalid fallback; prompt refresh/claim | `token_invalid` with publicId + requestId |
| Draft token already claimed | Venice receives token Paris marked revoked | 410 | `TOKEN_REVOKED` | Show “claimed” fallback; advise sign-in | `token_revoked` + token fingerprint (hashed) |
| Instance not found | Paris returns 404 | 404 | `NOT_FOUND` | Render not-found fallback | `not_found` |
| Config fails validation | Paris returns 422 with `[ { path, message } ]` | 422 | `CONFIG_INVALID` + validation array | Render config-invalid fallback with inline message | `config_invalid` + validation summary |
| Rate limit exceeded | Paris returns 429 | 429 | `RATE_LIMITED` | Render rate-limited fallback and set retry-after | `rate_limited` with window metadata |
| Paris/Geneva/Atlas outage | Upstream dependency unavailable / timeout | 503 | `SSR_ERROR` | Render branded 503 fallback; retry with backoff | `ssr_error` including dependency + latency |
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
