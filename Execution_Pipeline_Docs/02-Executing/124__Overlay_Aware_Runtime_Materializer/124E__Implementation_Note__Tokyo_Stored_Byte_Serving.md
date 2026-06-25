# 124E Implementation Note - Tokyo Stored-Byte Locale Serving

Status: implemented locally

## Implemented Surface

Tokyo-worker public `clk.live` serving now accepts the explicit locale URL shape:

```text
/{accountPublicId}/{instanceId}/locales/{locale}
/{accountPublicId}/{instanceId}/locales/{locale}/index.html
/{accountPublicId}/{instanceId}/locales/{locale}/styles.css
/{accountPublicId}/{instanceId}/locales/{locale}/runtime.js
```

Base instance URLs remain unchanged:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

Page URLs remain parsed separately and still return `404` because account page
public serving is not enabled by this slice.

## Stored-Byte Evidence Gate

Public locale serving reads only the three stored locale package files under:

```text
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/
```

The request serves only when:

- the instance source pointer exists;
- `serve-state.json` marks the instance as published;
- `index.html`, `styles.css`, and `runtime.js` all exist;
- each file has a content type;
- all three files carry the same `publicPackageFingerprint`;
- all three files carry the requested account, instance, base locale, locale,
  source `updatedAt`, and materializer contract metadata.

If any evidence is missing, stale, malformed, or mismatched, Tokyo-worker returns:

```text
404 Locale not available
cache-control: no-store
cdn-cache-control: no-store
cloudflare-cdn-cache-control: no-store
```

Tokyo-worker does not fall back to base package bytes for a locale URL.

## CDN Behavior

The current generated files remain mutable URL files. Base and locale
`index.html`, `styles.css`, and `runtime.js` use the existing short mutable
cache policy:

```text
public, max-age=60, s-maxage=300, stale-while-revalidate=86400
```

124E does not introduce content-addressed immutable support files and does not
claim immutable caching.

## Non-Goals Preserved

Tokyo-worker public serving does not read Babel overlay files, call the runtime
materializer, ask Roma, call Supabase, call Translation Agent, discover locales,
write hreflang, update sitemaps, or compose output on visitor requests.

Purge ownership was documented but not changed in code. 124E local verification
therefore did not run Cloudflare API preflight or remote purge checks.

## Verification

Focused local checks:

```bash
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test:clk-live
pnpm --filter @clickeen/tokyo-worker test:locale-package
```

`test:clk-live` verifies:

- base URL still serves base stored bytes;
- explicit locale URL serves stored locale bytes;
- `HEAD` returns headers and no body;
- missing locale package files return explicit locale unavailable;
- metadata mismatch fails closed;
- unpublished instance returns base `404`;
- malformed locale paths do not parse as locale serving;
- page paths remain page paths;
- `clk-live-routes.ts` does not import overlay readers, materializer package,
  Roma, Supabase, Translation Agent, or account locale settings code.
