# 106G Peer Review - Page Publish Edge Serve And SEO GEO Baseline

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106G__PRD__Page_Publish_Edge_Serve_And_SEO_GEO_Baseline.md`

## Review Lens

106G is the public serving boundary.

It should do one job:

```text
activate a validated page package
serve that active package at the edge
```

106G does not materialize pages. 106F writes the page package:

```text
index.html
styles.css
runtime.js
```

106G makes one validated package public through a route pointer. It does not read page source, widget source, overlays, manifests as source truth, or internal APIs. It does not assemble, mutate, inject, repair, or infer anything at request time.

## Consolidated Verdict

106G is directionally right but not execution-ready.

The product boundary is correct:

- pages are static generated packages;
- the edge serves only generated files;
- SEO/GEO is static output in `index.html`;
- private authoring/source data stays private;
- public serving stays cheap and boring.

The gaps are not small details. They are the public SaaS boundary:

- public route shape is not chosen;
- active publish authority is underspecified;
- 106G still implies materialization even though 106F owns it;
- slug change behavior is missing;
- cache and purge rules are vague;
- failure semantics are not explicit;
- SEO/GEO validation is too broad for V1;
- route parsing and asset file grammar need strict tests.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- Serving generated files at the edge is the right engineering model.
- It avoids request-time page rendering.
- It avoids a second public renderer.
- It preserves the simple package shape: `index.html`, `styles.css`, `runtime.js`.

Blocking gaps:

- 106G currently says it materializes the page package. That conflicts with 106F.
- The active route pointer must be named and schema-bound.
- Pages cannot be served by object existence alone, because old publish artifacts may remain.
- The browser asset URL shape must be explicit so `./styles.css` and `./runtime.js` resolve to the page files.

### Architecture / Tenet Compliance

Compliant:

- Edge serves static files.
- No block subsystem.
- No iframe stack.
- No request-time assembly.
- No personalization, A/B, or dynamic SEO in V1.

Not compliant yet:

- 106G must not read page source or widget source.
- 106G must not list publishes or fall back to latest.
- 106G must not inject SEO metadata at the edge.
- 106G must not promote a route before package validation passes.

### Overarchitecture / Gold-Plating Risks

Do not build:

- route resolver framework;
- website management subsystem;
- custom domain system;
- sitemap system unless separately scoped;
- redirect/alias engine;
- request-time SEO renderer;
- page preview runtime;
- public manifest API;
- edge-side personalization or experiments.

### Simple / Boring Path

The boring implementation is:

```text
parse account + page slug + optional file
read active route pointer
reject unless active
read exactly one generated file from active pageId + publishId
serve with fixed headers
```

Everything else belongs before activation, not inside public request handling.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- This is what makes pages feel real to users: a live URL that serves fast, visible content.
- Failed publish can preserve the old live page instead of breaking the public page.
- Users do not need to understand package files or edge routes.

UX gaps:

- Roma needs to show live URL, publish status, last published time/source revision, and failure reason.
- Slug edits need a clear V1 behavior.
- Recommended V1 slug behavior: old slug returns `404`; no redirect or alias system.
- Failed publish must keep the last active page live.

### Architecture / Tenet Compliance

Compliant:

- The page source remains the editable truth.
- The page package is generated output.
- The public route serves only active generated output.

Needs tightening:

- Canonical URL should be derived from the chosen route and normalized slug.
- SEO metadata must be generated before activation, not patched at public request time.
- Base-locale hosted pages only in V1; no `hreflang` until localized page routes and translated page metadata exist.

### Overarchitecture / Complexity

Keep out:

- redirects and aliases;
- custom domains;
- sitemap and website nav;
- request-time locale negotiation;
- per-visitor personalization;
- A/B tests;
- editable SEO not tied to the page source.

### Simple / Boring Product Path

Users need:

```text
create page
stack widgets
set slug and SEO fields
publish
get live URL
see publish state
```

The product should not expose route maps, publish ids, edge caches, or generated files.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- Static edge serving is cost-effective.
- Active route pointer avoids serving stale old artifacts.
- Cache behavior can be bounded because V1 files are unhashed.
- The same edge serving discipline can later support account websites and custom domains.

P0 operational gaps:

- Active publish authority must be explicit.
- Atomic promotion must be explicit.
- Cache and purge rules must be exact.
- Route parsing and slug/file grammar must be testable.
- Purge failure must be observable and bounded by declared TTL.

### Systems That Talk To Each Other

Needed systems:

- 106E owns page source, slug uniqueness, and placement indexes.
- 106F owns validated candidate page packages.
- 106G owns route activation and public edge serving.

No additional subsystem is needed.

### SaaS-Grade Technical Bar

At scale:

- public requests must not call Roma, Bob, Berlin, San Francisco, or materialization;
- public requests must not scan R2;
- old artifacts must remain unreachable after unpublish;
- invalid routes and files must fail closed;
- publish failure must not change the active route pointer;
- cache headers and purge coordinates must be deterministic.

## Consolidated Required PRD Decisions

Before executing 106G, decide:

1. **Public Route Shape**
   - Recommended V1:

```text
https://clk.live/{accountPublicId}/pages/{pageSlug}/
https://clk.live/{accountPublicId}/pages/{pageSlug}/styles.css
https://clk.live/{accountPublicId}/pages/{pageSlug}/runtime.js
```

   - Reason: it uses the existing public host and avoids pre-GA DNS/cache blast radius.
   - If `pages.clickeen.com` is chosen instead, the PRD must add dispatch, DNS, cache, and purge scope.

2. **106G Does Not Materialize**
   - 106F writes candidate packages.
   - 106G validates/promotes a package and serves the active route.
   - Remove `materialize page package` from the 106G publish flow.

3. **Active Route Pointer**
   - Add the route authority:

```text
accounts/{accountPublicId}/website/routes/{slugKey}.json
```

   - Minimum shape:

```json
{
  "status": "active",
  "pageId": "page_...",
  "publishId": "pub_...",
  "slug": "about",
  "canonicalUrl": "https://clk.live/{accountPublicId}/pages/about/",
  "publishedAt": "2026-06-03T00:00:00.000Z",
  "sourceRevision": "rev_...",
  "files": ["index.html", "styles.css", "runtime.js"]
}
```

   - Disabled/unpublished route:

```json
{
  "status": "disabled"
}
```

4. **Final-Write Ordering**
   - Validate candidate package first.
   - Promote active route pointer last.
   - Failed publish preserves previous active pointer.

5. **Page File Coordinates**
   - Edge route resolves:

```text
route pointer -> pageId + publishId -> website/publishes/{pageId}/{publishId}/{file}
```

   - No direct public route to `website/publishes/**`.
   - No object-existence serving for pages.

6. **Slug Behavior**
   - V1 supports root plus single-segment slugs only.
   - Nested slugs wait until delimiter/file grammar is explicitly specified.
   - Slug change behavior: old slug returns `404` in V1.
   - No redirect or alias engine in 106G.

7. **Cache And Purge**
   - V1 files are unhashed, so `index.html`, `styles.css`, and `runtime.js` all use short cache.
   - Publish purges route URL, trailing-slash variant, `index.html`, `styles.css`, and `runtime.js`.
   - Slug change purges old and new route coordinates.
   - Unpublish purges disabled route coordinates.
   - Purge failure is recorded and stale exposure is bounded by declared TTL.

8. **SEO/GEO Baseline**
   - SEO/GEO is static build-time output.
   - `index.html` must already contain visible primary content before JavaScript.
   - Required head fields: title, description, canonical, robots.
   - Canonical is derived from the active route.
   - Structured data is optional and must match visible page content.
   - No request-time SEO injection.
   - No `hreflang` until localized hosted-page routes and translated page metadata are defined.

9. **Private File Containment**
   - Edge may read route pointer plus generated files only.
   - Edge must not read or serve page source, overlays, widget source, route management files, manifests as source truth, account assets, or internal APIs.

10. **Execution Sequencing**
   - 106G is blocked until 106E and 106F are verified.
   - 106E must provide Tokyo page operations, slug uniqueness, and placement indexes.
   - 106F must write validated candidate packages under `website/publishes/{pageId}/{publishId}`.
   - 106F must prove failed recomposition cannot overwrite the last active page.

## Suggested Acceptance Gates

106G should fail if:

- published page route does not return `200` for `GET` and `HEAD`;
- unpublished, disabled, or missing route pointer does not return `404`;
- old publish artifacts remain publicly reachable after unpublish;
- direct requests to `website/publishes/**` are publicly reachable;
- source, overlays, manifests, route files, internal APIs, or account assets are publicly reachable;
- route parser accepts traversal, encoded slash, backslash, invalid account id, invalid slug, nested slug, or non-allowlisted file;
- publish failure changes the active route pointer;
- slug change behavior is untested;
- cache headers are not asserted for all three generated files;
- purge URL list is not asserted for publish, unpublish, and slug change;
- browser-resolved `./styles.css` or `./runtime.js` fetches the wrong file;
- `index.html` lacks visible primary content before JavaScript;
- `index.html` lacks title, description, canonical, or robots;
- structured data is present but does not validate or does not match visible content;
- public request handling calls Roma, Bob, Berlin, San Francisco, page materialization, or any authoring/source service;
- existing single-widget `clk.live/{accountPublicId}/{instanceId}` route tests regress.

## Decision Status

Do not execute 106G as-is.

Keep the public boundary simple: active route pointer in, generated file out. Once 106F produces a validated package, 106G only promotes and serves it. That is how Clickeen Pages stays fast, cheap, crawlable, and manageable when many accounts publish many pages made of many widget instances.
