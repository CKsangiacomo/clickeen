# PRD 100E - clk.live Static Serving And Availability

Status: Complete
Owner: Product + Engineering
Date: 2026-05-16
Parent: `100__PRD__Static_Public_Embed_Delivery.md`

PRD 103_00 NOTE: this PRD is narrowed to public static file serving internals. `index.html` or support-file presence must not be cited as authoring, translation, publish, or workflow product state while the pre-103 gate is active.

## Purpose

Define the public serving contract for generated PRD 100 instance mini-sites on the canonical public hostname:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Public widget views must be static file delivery. Normal public traffic must not call Roma, Bob, Berlin, Michael, San Francisco, Venice, or any product service to resolve, authorize, assemble, render, or decide availability for the request.

The serving layer has one job: validate the URL shape, rewrite it to the matching generated browser file under Tokyo/R2 storage, apply the public allowlist, and return the file or 404.

## Scope

In scope:

- DNS, TLS, and Cloudflare routing for `clk.live`.
- Tokyo/R2 static object serving for generated instance browser files.
- Public route contract for `/{accountPublicId}/{instanceId}` and support files below that folder.
- Public file allowlist and denial of private/non-browser files.
- Cache behavior for generated browser files.
- Availability semantics based on physical `index.html` presence.
- Unpublish and republish operations implemented as entry-file renames.
- Validation, tests, rollout, and cutover guards for the public serving path.

Out of scope:

- Building `index.html`, `styles.css`, `script.js`, or other browser files.
- Agent file-writing internals beyond the serving contract they must satisfy.
- Authoring open/save, account policy, translation generation, overlay creation, and asset upload.
- Runtime rendering, per-view composition, public ID lookups, URL shorteners, aliases, redirects, or Venice replacement work beyond removal from this public path.

## DNS/TLS/Cloudflare/Tokyo Requirements

`clk.live` is the only canonical public hostname for generated instance views.

Required infrastructure:

- DNS for `clk.live` points to the Cloudflare-managed public serving surface.
- TLS is active for `https://clk.live`.
- HTTP must redirect to HTTPS at the edge.
- Cloudflare owns request routing, cache policy, and any needed cache purge/invalidation hooks.
- Tokyo/R2 stores the generated instance files under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The public serving surface must not require a product API binding for normal views. If a Worker is used, it must behave as a strict static path rewriter/allowlist gate, not as a product resolver.

## Route Contract

Canonical URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Accepted coordinate formats:

```text
accountPublicId: ^[0-9A-Z]{8}$
instanceId:      ^[0-9A-Z]{10}$
```

Static rewrites:

```text
/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html

/{accountPublicId}/{instanceId}/{file}
  -> accounts/{accountPublicId}/instances/{instanceId}/{file}
```

Rules:

- Missing or invalid `accountPublicId` returns 404.
- Missing or invalid `instanceId` returns 404.
- Lowercase, mixed-case, overlong, short, path-traversal, encoded traversal, and extra-coordinate paths return 404.
- The route must not consult any lookup table, database row, Venice route, public embed registry, or redirect alias.
- There is no `publicEmbedId`.
- There is no `embed.clickeen.com`.
- There is no shortener, redirect alias, second public namespace, Venice lookup, or public copy/projection.

## Allowlist

Public serving exposes generated browser files only.

Allowed by default:

- `index.html`
- `styles.css`
- `script.js`
- other explicitly generated browser files required by the mini-site, if their names and extensions are in the serving allowlist

Required denials:

- `instance.json`
- `config.json`
- `publish.json`
- `embed.json`
- `translations.json`
- `overlays/`
- `published/` runtime ingredient paths
- source maps unless explicitly approved for public production
- hidden files, dotfiles, metadata files, lockfiles, manifests that expose product state, and non-browser inputs
- directory listings for account folders, instance folders, and all subfolders

The allowlist must be positive, not denylist-only. Unknown files return 404 even if they physically exist.

## Cache Rules

Public files should be cacheable at Cloudflare because they are generated static artifacts.

Required cache behavior:

- Cache successful `200` responses for allowed browser files.
- Cache `404` responses conservatively or not at all until the final policy is verified against publish/republish latency.
- Purge or invalidate affected URLs when unpublish, republish, or replacement builds change public bytes.
- Cache keys must be based on the canonical request URL and must not include cookies or product auth headers.
- Public serving must not set or require account/session cookies.

Cache-busting must not introduce hashes, aliases, lookups, or a second public namespace into the product URL contract.

## Availability Semantics

Public availability is physical file presence:

```text
index.html exists = available
index.html missing = 404
```

Availability rules:

- `/{accountPublicId}/{instanceId}` returns `200` only when the allowlisted `index.html` object exists.
- If `index.html` is missing, the canonical URL returns 404.
- If support files are missing, those support-file requests return 404; the serving layer must not rebuild or repair them.
- No Roma, Bob, Berlin, Michael, San Francisco, Venice, database, entitlement, or account policy service is consulted during normal public views.
- Publish state may be recorded in product metadata for authoring/product UI, but the public serving decision is the physical `index.html` object.

## Unpublish/Republish Operations

Unpublish is a storage operation:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html.off
```

Republish is the reverse storage operation:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html.off
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html
```

Operational requirements:

- Unpublish must make the canonical URL return 404 after cache purge/invalidation completes.
- Republish must make the canonical URL return 200 when `index.html` is restored and caches are purged as needed.
- Support files may remain in place while unpublished. They are not the availability switch.
- If `index.html.off` is missing during republish, fail clearly at the publish/unpublish operation boundary.
- If `index.html` is missing during unpublish, treat the instance as already unavailable and return a clear idempotent result for the operation.
- Purge the canonical entry URL and any affected support-file URLs where needed.

## Out of Scope

- Public URL migration from older embed shapes.
- Compatibility redirects from `embed.clickeen.com` or any old hostname.
- Public URL short codes or aliases.
- Runtime availability checks against Michael status, account policy, billing, usage, or entitlement rows.
- Venice runtime composition, Venice lookup, or Venice public rendering.
- Public exposure of `published/live/r.json`, overlay objects, authoring JSON, or generated internal projections.
- Directory browsing or generic object explorer behavior.

## Acceptance Criteria

- `https://clk.live/{accountPublicId}/{instanceId}` serves `accounts/{accountPublicId}/instances/{instanceId}/index.html` for valid coordinates when the file exists.
- `https://clk.live/{accountPublicId}/{instanceId}/{file}` serves only allowlisted generated browser files under the same instance folder.
- Invalid coordinate formats return 404 without service lookups.
- Requests for `instance.json`, `overlays/`, non-browser inputs, unknown files, and directories return 404.
- Removing or renaming `index.html` makes the canonical URL unavailable.
- Restoring `index.html` makes the canonical URL available after required cache purge/invalidation.
- Normal public views do not call Roma, Bob, Berlin, Michael, San Francisco, Venice, product databases, or product APIs.
- No implementation introduces `publicEmbedId`, `embed.clickeen.com`, shorteners, redirect aliases, a second public namespace, Venice lookup, or public copies/projections.

## Implementation Notes

- Implement serving as a strict path-template rewrite plus positive allowlist.
- Validate URL coordinates before constructing the object key.
- Normalize and reject encoded traversal before object lookup.
- Do not map omitted `{file}` to anything except `index.html`.
- Keep generated browser files directly under `accounts/{accountPublicId}/instances/{instanceId}/`.
- Keep authoring and source truth files in the same instance subtree private by allowlist, not by hoping users do not know their names.
- If Cloudflare Worker code is required, keep it small and testable: parse, validate, allowlist, rewrite, fetch object, set cache headers.
- Do not add product-service fallback when an object is missing. Missing file means 404.

## Risks/Guards

- Risk: A lookup service slips back into public views. Guard: tests and logs must prove normal public requests use only static object serving.
- Risk: Private instance source files become web-accessible. Guard: positive allowlist and explicit tests for every private path class.
- Risk: Cache keeps an unpublished widget visible. Guard: unpublish purges the canonical URL and any edge cache variants.
- Risk: Republish remains hidden behind cached 404s. Guard: republish purges the canonical URL and avoids long-lived negative caching until verified.
- Risk: Compatibility aliases become a second product truth. Guard: reject `publicEmbedId`, `embed.clickeen.com`, redirects, and shorteners in code review for this slice.
- Risk: Directory listing exposes account structure. Guard: directory requests always return 404.

## Validation/Tests

Required automated coverage:

- Valid canonical route rewrites to `accounts/{accountPublicId}/instances/{instanceId}/index.html`.
- Valid support-file route rewrites to the same instance folder.
- Invalid coordinate shapes return 404.
- Lowercase and encoded traversal paths return 404.
- Private files and folders return 404, including `instance.json`, `overlays/`, and directory paths.
- Unknown non-allowlisted files return 404 even when present in storage.
- Missing `index.html` returns 404 for the canonical route.
- Present `index.html` returns 200 for the canonical route.
- Unpublish rename makes the canonical route return 404 after purge.
- Republish rename makes the canonical route return 200 after purge.

Required manual validation before cutover:

```text
1. Publish a generated instance.
2. Load https://clk.live/{accountPublicId}/{instanceId}.
3. Load its generated CSS/JS support files.
4. Confirm private JSON and overlays paths return 404.
5. Unpublish and confirm canonical URL returns 404 after cache purge.
6. Republish and confirm canonical URL returns 200 after cache purge.
7. Confirm public request logs show no Roma/Bob/Berlin/Michael/San Francisco/Venice/product-service calls.
```

## Rollout/Cutover

1. Provision DNS and TLS for `clk.live`.
2. Deploy the Cloudflare/Tokyo static serving route behind a pre-GA gate if needed.
3. Add the positive public file allowlist and coordinate validation.
4. Wire cache headers and purge hooks for build replacement, unpublish, and republish.
5. Generate at least one PRD 100 instance with `index.html`, `styles.css`, and `script.js`.
6. Run automated route, allowlist, cache, and availability tests.
7. Run the manual validation checklist against a staging hostname or gated production route.
8. Cut copied embed URLs and product UI references to `https://clk.live/{accountPublicId}/{instanceId}`.
9. Remove or block old public embed route references from the normal public path.
10. Monitor 200/404 rates, cache hit rate, and any attempted private-file access during the first rollout window.
