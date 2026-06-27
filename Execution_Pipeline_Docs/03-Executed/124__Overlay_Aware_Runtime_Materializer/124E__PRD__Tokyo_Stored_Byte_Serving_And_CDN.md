# PRD 124E - Tokyo Stored-Byte Serving And CDN

Status: EXECUTED
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN, 124B CODE-DELIVERED, 124C CODE-DELIVERED, 124D CODE-DELIVERED
Owner: Tokyo-worker public serving + Roma account command/purge authority

## Purpose

Serve explicit locale artifacts from stored evidenced bytes.

Tokyo-worker must not read overlays, call the materializer, ask Roma, or compose
output on visitor requests. Public traffic reads stored bytes only:

```text
public locale URL -> Tokyo stored locale package artifact -> response
```

124E is the CDN/cost slice. It protects the rule that public serving must stay
cheap, cacheable, and fail-closed.

## Serving Law

```text
pretty coordinate URL -> short TTL entry HTML
fingerprinted support files -> immutable long TTL CSS/JS
```

Long immutable cache headers are allowed only when the served support-file URL
is content-addressed. A mutable path such as `runtime.js` or `styles.css` must
not receive immutable caching.

If 124A/124D did not produce content-addressed support-file coordinates, 124E
must either:

- serve those support files with the same short TTL policy as the entry file;
  or
- stop before claiming immutable support-file caching.

Initial 124E execution uses mutable locale `styles.css` and `runtime.js` URLs
with short TTL. Content-addressed immutable support files are not claimed unless
a later scoped change updates 124A/124D storage and 124E serving together.

## Non-Reinterpretation Tenet

124E must not reinterpret public localization into request-time resolution or a
new serving platform.

Forbidden additions in 124E:

- reading Babel overlays on public requests;
- calling `@clickeen/ck-runtime-materializer` from Tokyo-worker public serving;
- calling Roma/Supabase/Translation Agent on public requests;
- fallback locale serving;
- locale negotiation;
- visitor personalization;
- A/B variation serving;
- storage walks to discover available locales;
- lifecycle/status files;
- generated package repair;
- compatibility readers for previous artifact paths;
- public page/site/email serving.

## Precondition Gate

124E may begin only after all conditions are true:

1. 124A names the exact public locale URL shape.
2. 124A names the exact locale artifact storage coordinate.
3. 124A/124D name the evidence fields required to trust a locale package.
4. 124D stores generated locale package bytes at that coordinate.
5. 124D defines removed-locale package deletion behavior.
6. 124E records whether support files are content-addressed or mutable.

If any condition is not closed, 124E stops before implementation. The agent must
not invent the route, artifact path, or cache behavior.

Plan-green is not enough for 124E execution. 124E serves bytes produced by
124D and trusts evidence generated through 124B/124C/124D contracts, so those
contracts must exist in code before Tokyo-worker public locale serving depends
on them.

## Current Public Serving Baseline

Current production public serving:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Current cloud-dev public serving:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Current Tokyo code:

- parses `/{accountPublicId}/{instanceId}` and optional base package file;
- requires `serve-state.json` to be published;
- checks the saved source pointer public package fingerprint;
- verifies stored `index.html`, `styles.css`, and `runtime.js`;
- serves stored bytes from `accounts/{accountPublicId}/instances/{instanceId}/`;
- sets short cache headers for current generated files.

124E extends this behavior only for the explicit locale URL shape from 124A:

```text
/{accountPublicId}/{instanceId}/locales/{locale}
/{accountPublicId}/{instanceId}/locales/{locale}/index.html
/{accountPublicId}/{instanceId}/locales/{locale}/styles.css
/{accountPublicId}/{instanceId}/locales/{locale}/runtime.js
```

`locales` is a reserved literal segment after the instance id. Locale parsing
must not consume the existing base instance paths or `/{accountPublicId}/pages`
page paths.

## Authority Gate

| Concern | Active authority for 124E |
| --- | --- |
| Product surface | Public account widget instance base and non-base locale serving |
| Account/session coordinate | None on public request; route uses public account/instance/locale coordinates |
| Source coordinate | Tokyo saved instance source pointer and serve state |
| Generated package coordinate | 124A/124D locale artifact path under the account instance |
| Route/API boundary | Tokyo-worker `clk.live`/`dev.clk.live` public route parser and response path |
| Runtime/deploy surface | Tokyo-worker deploy via GitHub Actions `cloud-dev workers deploy`; Roma only if purge trigger changes |
| Verification surface | Tokyo route tests, package storage tests, cache header tests, Cloudflare Worker deploy evidence if deployed |

### Compliance Rationale

This is compliant because public requests stay inside Tokyo's public serving
authority and read stored bytes only. Account/session/overlay/materializer
authorities do not enter visitor traffic.

## Slice 1 - URL And Artifact Contract Lock

### Goal

Lock the exact public URL and stored artifact mapping before changing Tokyo's
public route parser.

### Steps

1. Read the final 124A public locale URL contract.
2. Record the base URL behavior that must remain unchanged.
3. Record the locale URL shape.
4. Record the locale entry file path.
5. Record support-file URL/storage behavior:
   - mutable locale `styles.css` and `runtime.js` with short TTL for initial
     124E execution.
6. Record the locale package evidence fields from 124A/124D.
7. Stop if any value is missing or ambiguous.

### Output

A 124E implementation note mapping:

```text
public URL -> R2 object key -> expected evidence -> cache header
```

### Compliance Rationale

This is compliant because serving code must follow the schema/product contract.
Tokyo must not choose a route shape or cache policy while implementing.

## Slice 2 - Public Route Parser Extension

### Goal

Extend `clk.live` parsing for the explicit locale URL only.

### Steps

1. Update `tokyo-worker/src/routes/clk-live-routes.ts`.
2. Preserve current base instance parsing exactly.
3. Preserve current page parsing behavior exactly.
4. Add only the 124A locale route shape.
5. Reject malformed paths:
   - encoded slash;
   - backslash;
   - `..`;
   - invalid account public id;
   - invalid instance id;
   - invalid locale token;
   - invalid package file name.
6. Do not infer locale from query params, `Accept-Language`, cookies, country,
   IP, browser language, or account settings.
7. Do not list storage to discover available locale artifacts.
8. Locale parsing must not collide with:
   - `/{accountPublicId}/{instanceId}`;
   - `/{accountPublicId}/{instanceId}/index.html`;
   - `/{accountPublicId}/{instanceId}/styles.css`;
   - `/{accountPublicId}/{instanceId}/runtime.js`;
   - `/{accountPublicId}/pages/{pageId}`.

### Output

Tokyo can parse one explicit locale coordinate and no implicit locale
coordinate.

### Compliance Rationale

This is compliant because URL identity is explicit product truth. The serving
route does not negotiate, guess, or discover locale state.

## Slice 3 - Publish And Evidence Gate

### Goal

Serve a locale artifact only when the instance is published and the stored
locale package evidence matches the requested coordinate.

### Steps

1. Keep current base serving publish gate:
   `readAccountInstanceSourcePointer` must report `publishStatus: published`.
2. For a locale request, require the same published source pointer.
3. Read only the 124A locale package objects for the requested locale.
4. Verify every required file exists.
5. Verify each file has accepted content type metadata.
6. Verify each file carries the exact 124A locale package custom metadata keys:
   - `publicPackageFingerprint`;
   - `localePackageAccountPublicId`;
   - `localePackageInstanceId`;
   - `localePackageBaseLocale`;
   - `localePackageLocale`;
   - `localePackageSourceUpdatedAt`;
   - `materializerContractVersion`.
7. Verify all three files carry identical values for those metadata keys.
8. Verify the metadata binds to:
   - account public id;
   - instance id;
   - base locale;
   - requested locale;
   - current published source pointer `updatedAt`;
   - generated package fingerprint;
   - 124B package-owned materializer contract version.
9. Expected evidence may come only from:
   - the public request coordinate;
   - stored locale package object metadata;
   - stored file bytes/fingerprints;
   - content-type metadata;
   - the current published source pointer/serve-state already used by base
     serving.
10. Tokyo public serving must stop implementation if matching requires overlay
   reads, materializer calls, Roma calls, storage walks, invented manifests, or
   recomputing overlay fingerprints on public requests.
11. If any evidence is missing, malformed, stale, or mismatched, return the
    explicit locale-unavailable response from Slice 3.1.
12. Do not return base package bytes for a missing locale package.

For 124E public serving, stale means mismatch against the public request
coordinate, all-file package metadata agreement, generated package fingerprint
metadata, materializer contract evidence, or the current published source
pointer `updatedAt`/base locale that Tokyo already reads for serving. It does
not mean Tokyo detects a newer overlay by reading overlay source truth during a
public request, and it does not mean 124E enforces source/schema/overlay
fingerprints. Overlay staleness after overlay mutation is handled by
Roma/account materialization and purge commands, not visitor-time validation.

### Output

Locale serving fails closed unless stored locale package bytes match the
requested coordinate and evidence.

### Compliance Rationale

This is compliant because public serving trusts stored evidenced bytes only.
It prevents silent substitution, stale-byte serving, and base-as-locale
masquerade.

## Slice 3.1 - Visitor Locale-Miss Response

### Goal

Make fail-closed public behavior explicit without serving the wrong language.

### Contract

When the base instance is published but the requested locale artifact is
missing, malformed, stale, or mismatched, Tokyo returns:

```text
HTTP 404
Body: explicit "locale not available" response
Cache: no-store, or the shortest existing error-response cache policy if Tokyo
       already centralizes public error caching
```

The response must not:

- serve base locale bytes;
- imply the base instance does not exist;
- call Roma, Supabase, Translation Agent, the materializer, or overlay readers;
- create a lifecycle/status/readiness record;
- make a locale discovery or search reach claim.

### Output

Visitors and crawlers receive an explicit fail-closed response for unavailable
locale artifacts.

### Compliance Rationale

This is compliant because visitor traffic still does not compose or fall back,
while the product surface does not masquerade a locale miss as a missing base
instance.

## Slice 4 - Stored Byte Response

### Goal

Respond from R2 objects without composition.

### Steps

1. For base requests, keep current object keys and response behavior.
2. For locale entry requests, serve the stored locale `index.html` entry file.
3. For locale support-file requests, serve only stored support files belonging
   to the same locale package/evidence coordinate.
4. Preserve `GET` and `HEAD` behavior.
5. Preserve HTTPS redirect behavior for `http://clk.live` and
   `http://dev.clk.live`.
6. Set `content-type` from object metadata.
7. Set `x-content-type-options: nosniff`.
8. Set `access-control-allow-origin: *` only if current base serving still uses
   it.

### Output

Public locale responses are direct R2 byte responses.

### Compliance Rationale

This is compliant because Tokyo does not generate, mutate, or compose response
content. It serves the exact package artifacts written by 124D.

## Slice 5 - Cache Header Contract

### Goal

Preserve CDN cost efficiency without lying about mutable bytes.

### Steps

1. Keep current base generated-file cache behavior unless 124A explicitly
   changes base serving.
2. For locale entry HTML, use a short TTL policy equivalent to current generated
   entry behavior unless 124A names a different value.
3. For locale support files with content-addressed URLs, use:
   `public, max-age=31536000, immutable`.
4. For initial 124E locale support files on mutable URLs, use the same short TTL
   policy as locale entry HTML and do not claim immutable caching.
5. Set all three cache headers consistently:
   - `cache-control`;
   - `cdn-cache-control`;
   - `cloudflare-cdn-cache-control`.
6. Do not use visitor-time materialization to avoid cache invalidation.

### Output

Cache headers match URL mutability and preserve CDN behavior.

### Compliance Rationale

This is compliant because CDN economics are protected by stored bytes and honest
cache semantics. Immutable caching is tied to content identity, not wishful
headers.

## Slice 6 - Purge And Entry Refresh

### Goal

Refresh pretty entry URLs without making the materializer or public serving own
Cloudflare purge.

### Steps

1. Keep the materializer package out of purge behavior.
2. Use the existing account instance publish/save command boundary to trigger
   public cache purge for base artifacts.
3. For locale artifacts created or deleted by 124D translation generation and
   active-locale settings follow-up, choose exactly one behavior before
   implementation. Initial 124E uses the existing Tokyo purge executor for
   affected locale entry and mutable support URLs.
4. If current purge code remains in Tokyo-worker, treat it as the serving-plane
   Cloudflare API executor invoked by the Roma-owned account command.
5. Expand purge file lists to include locale entry and mutable support URLs only
   after 124A names those URLs.
6. Do not purge immutable content-addressed support files.
7. If support files remain mutable, include them in purge or keep them on short
   TTL according to the 124A/124D cache contract.
8. If Cloudflare purge config is missing or purge fails during a command that
   claims refresh, preserve existing explicit failure behavior.
9. Public serving must not use purge success/failure as readiness truth.
10. Command responses must distinguish `artifact written but cache refresh
    failed` from full success.
11. Any Cloudflare purge operation or purge config check must use the repo
    Cloudflare API command path after `pnpm cf:api:preflight`. If preflight
    fails, stop at that gate and do not claim purge verification.

### Output

Pretty locale entry URLs can refresh while content-addressed support files,
when introduced by a scoped contract change, remain cheap.

### Compliance Rationale

This is compliant because purge stays at the account/serving command boundary.
The public request path and materializer do not become cache-control operators.

## Slice 7 - Removed Locale And Stale Artifact Behavior

### Goal

Ensure removed or stale locale artifacts have explicit serving semantics.

### Steps

1. Rely on 124D to delete generated locale package artifacts when active locales
   are removed.
2. Removed locale serving fails closed only after 124D deletion succeeds.
3. If removed-locale package deletion fails, the old locale artifact may remain
   publicly reachable until the account-owned deletion/purge operation succeeds
   because public serving does not query account active-locale state.
   If CDN purge does not reach an edge, current `stale-while-revalidate=86400`
   can extend this stale-reachable window for up to 24 hours on that edge.
4. The account command must report explicit cleanup failure with account public
   id, instance id, locale, and phase. It must not imply the removed-locale
   artifact is cleaned up when deletion failed.
5. Public serving must not check Supabase active-locale state on request.
6. Public serving must not call Roma to ask whether a locale is active.
7. Public serving must fail closed when stored artifact evidence is missing or
   mismatched.
8. Public serving must not fall back to base or another locale.

### Output

Removed/stale locale behavior is governed by stored artifacts, evidence, and
account-owned deletion results, not visitor-time account lookups.

### Compliance Rationale

This is compliant because public serving remains closed and cheap. Account
commands clean up locale artifacts; public traffic only reads or rejects stored
bytes.

## Slice 8 - Focused Tests

### Goal

Prove stored-byte locale serving and cache behavior.

### Required Tests

1. Base regression:
   - `/{accountPublicId}/{instanceId}` still serves base package bytes.
   - base `runtime.js` and `styles.css` behavior is unchanged.
2. Locale route parsing:
   - exact 124A locale URL parses.
   - malformed/implicit/query/browser-locale cases do not parse as locale
     serving.
   - base instance file paths still parse as base serving.
   - `/{accountPublicId}/pages/{pageId}` remains page parsing and is not
     consumed as a locale route.
3. Publish gate:
   - unpublished instance returns `404` for locale URL.
4. Evidence gate:
   - missing locale artifact returns the explicit locale-unavailable response;
   - missing file returns the explicit locale-unavailable response;
   - missing or mismatched 124A locale package custom metadata returns the
     explicit locale-unavailable response;
   - all three locale package files must carry identical custom metadata;
   - `localePackageSourceUpdatedAt` must match the current published source
     pointer `updatedAt`;
   - mismatched package evidence returns the explicit locale-unavailable
     response;
   - source/schema/overlay fingerprints are not enforced by 124E public
     serving;
   - base package bytes are never served for locale URL.
5. Response tests:
   - `GET` returns stored bytes;
   - `HEAD` returns headers and no body;
   - content type metadata is required.
6. Cache tests:
   - locale entry has short TTL;
   - mutable locale `styles.css` and `runtime.js` have short TTL;
   - mutable support file does not receive immutable TTL;
   - content-addressed support file immutable TTL is not claimed unless a later
     scoped change adds content-addressed support URLs.
7. Dependency guard:
   - `clk-live-routes.ts` does not import overlay readers, materializer package,
     Roma clients, Supabase, Translation Agent, or account locale settings code.
8. Purge tests if purge behavior changes:
   - locale entry and mutable support URLs are included;
   - immutable content-addressed support files are not purged.
9. Stale-window documentation test:
   - removed-locale behavior documents deletion failure and possible
     `stale-while-revalidate=86400` reachability.

### Output

Tests prove 124E serves stored evidenced locale bytes without runtime
composition.

### Compliance Rationale

This is compliant because tests verify the public serving contract. They do not
become runtime probes, product-state discovery, or fallback machinery.

## Slice 9 - Runtime Verification

### Goal

Verify through Tokyo and Cloudflare only when relevant.

### Steps

1. Run Tokyo route tests.
2. Run Tokyo package storage tests if storage/evidence helpers change.
3. Run focused typecheck/lint for Tokyo-worker and Roma if purge triggers
   change.
4. If deployed, verify GitHub Actions `cloud-dev workers deploy` for
   Tokyo-worker changes.
5. If Roma purge-trigger code changes and deploy is claimed, verify Cloudflare
   Pages Git-connected build state for Roma.
6. If remote R2 evidence is checked, run `pnpm cf:preflight` first.
7. If Cloudflare Pages/API state is checked, run `pnpm cf:api:preflight` first.
8. If not deployed, closeout must state no deploy/runtime claim was made.

### Output

Verification matches the surfaces changed by 124E.

### Compliance Rationale

This is compliant because serving truth belongs to Tokyo/Cloudflare. Roma is
verified only if its purge trigger changes.

## Slice 10 - 124E Closeout Gate

### Steps

1. Confirm base URL still serves base artifact behavior.
2. Confirm explicit locale URL serves only matching evidenced locale artifact.
3. Confirm Tokyo public serving does not import overlay readers or the
   materializer.
4. Confirm missing/stale/malformed locale artifacts fail closed.
5. Confirm mutable support paths do not receive immutable cache headers.
6. Confirm content-addressed support paths receive immutable headers only if
   implemented.
7. Confirm purge ownership and behavior are documented.
8. Confirm no locale discovery, hreflang, sitemap, structured-data, or search
   reach claim is made by 124E; 124H or later SEO/GEO/AEO work owns discovery.
9. Record commit/push/deploy state.
10. Reconcile whether verification stopped at local checks or included deployed
   Tokyo/Cloudflare evidence.
11. Record V1-V8 audit.

### Acceptance

- Base URL still serves base artifact.
- Explicit locale URL serves only a matching evidenced locale artifact.
- Tokyo-worker never reads overlays, calls the materializer, or composes output
  on visitor requests.
- Missing/stale/malformed locale artifact fails closed.
- Cache headers match URL mutability.
- Roma/account command purge ownership is documented and implemented for entry
  artifacts when purge behavior changes.
- 124E makes no locale discovery or search reach claim.

## Required Documentation Updates

Update current-system docs for behavior that changes in 124E:

- `documentation/services/tokyo-worker.md`: public locale URL shape, stored-byte
  serving, evidence gate, cache headers, and fail-closed behavior.
- `documentation/services/tokyo.md`: account runtime shape and public serving
  contract if locale package files become part of runtime-managed account
  storage.
- `documentation/architecture/RuntimeProfiles.md`: locale package file layout
  and public serving URL if changed.
- `documentation/architecture/OverlayArchitecture.md`: public runtime now
  serves generated locale package bytes from storage, not overlays on request.
- `documentation/architecture/BabelProtocol.md`: update public/runtime
  localization verification if 124E exposes locale URL serving.
- `documentation/capabilities/localization.md`: update user-visible
  localization behavior and explicit no-fallback public serving law.
- `documentation/engineering/CloudflareOperations.md`: update only if purge or
  deploy operation commands change.
