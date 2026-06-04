# PRD 106F - Page Package Composition And Recomposition

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `106__Umbrella__Composition_Vision.md`
Depends on: `106B__PRD__Widget_Package_Composition_Contract.md`, `106E__PRD__Page_Source_And_Roma_Composer.md`

## 2026-06-04 System Tenets Correction

The 2026-06-03 execution proved the three-file page package behavior, but the
ownership is not clean enough under the updated 106 tenets.

Previous implementation placed page composition in Tokyo:

```text
tokyo-worker/src/domains/pages/materializer.ts
```

That is now a repair target.

Correct ownership:

- Page Composer owns composition.
- Page Composer reads already-saved widget package files:
  - `index.html`;
  - `styles.css`;
  - `runtime.js`.
- Page Composer writes one page package:
  - `index.html`;
  - `styles.css`;
  - `runtime.js`.
- Roma owns when composition runs, because Roma owns user/account/tier/save
  intent.
- Tokyo stores the submitted page package files in R2 and serves them later.

Tokyo must not be the page composer, widget renderer, package sanitizer,
product-policy engine, or recomposition brain.

The next 106F repair slice is not a new feature. It is an ownership cleanup:

```text
move page composition authority out of Tokyo
keep the exact three-file page package output
keep public behavior and tests green
```

## Execution Progress

2026-06-03 Slice 1 verified:

- Previously added Tokyo page package materialization in `tokyo-worker/src/domains/pages/materializer.ts`; this file is now an ownership repair target under the 2026-06-04 tenets.
- The package builder reads only generated widget package files from `accounts/{accountPublicId}/instances/{instanceId}/index.html`, `styles.css`, and `runtime.js`.
- It does not import source-reading artifact helpers, does not read `product/widgets/**`, and does not use private widget source as page input.
- It extracts exactly one top-level generated widget root per placement, preserving nested embedded-widget roots inside a parent widget root.
- It rejects missing widget package files, zero/multiple top-level widget roots, instance-id mismatches, and singleton `window.CK_WIDGET` runtime.
- It writes exactly one current page package under `accounts/{accountPublicId}/website/publishes/{pageId}/index.html`, `styles.css`, and `runtime.js`.
- Verified with `pnpm --filter @clickeen/tokyo-worker typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, and `git diff --check`.

2026-06-03 Slice 2 verified:

- Widget save now writes the generated widget package needed for composition. Create and duplicate write instance source only until the instance is opened/saved.
- Standalone widget public serving is gated by Tokyo serve state, not by raw file existence.
- Unpublish changes standalone serve state and purges cache, but keeps the generated widget package available for page composition.
- Widget save rematerializes affected pages through the 106E reverse placement index.
- Page create/save materializes the current page package immediately after valid page source is written.
- Recomposition failure is visible and does not silently report a green save; ownership must move from a Tokyo product boundary to the Roma/Page Composer save path.
- Verified with `pnpm --filter @clickeen/tokyo-worker typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, and `git diff --check`.

2026-06-03 repair pass verified:

- Page Composer validates the generated package shape from all three widget package files and rejects missing or invalid `index.html`, `styles.css`, and `runtime.js`.
- Page runtime composition writes all per-instance payload contributions first, then dedupes source-neutral runtime module chunks.
- Page CSS composition dedupes exact source-neutral style chunks.
- Repeated placements of the same widget instance are allowed. Page Composer emits both placement wrappers, reuses the same generated widget package, and dedupes exact duplicate payload/module/style chunks.
- The composed page root is stamped with `data-ck-composed-page="true"` and keeps ordered placement wrappers as the only page-level composition structure.
- The generated page `<html lang>` is derived from placed package locales; empty draft packages use `und` only because no placement locale exists yet.
- Page save now validates and builds the candidate package before writing `source.json` or reverse placement indexes. A failed materialization leaves the previous page source untouched.
- No `publishId`, route map, slug system, package pointer, or page-local widget truth was introduced.
- Verified with `pnpm --filter @clickeen/tokyo-worker test` and `pnpm --filter @clickeen/tokyo-worker typecheck`.

106F complete.

2026-06-04 repair pass verified:

- Removed stale placement-id requirements from the PRD. Page source has no placement ids, and the page package now documents the same contract as the code: one plain structural wrapper per placement in array order.
- Added executable proof that composed page HTML does not emit `data-ck-placement-*` identity.
- Kept future placement selection out of V1 materialization. 106F writes the whole page package only.
- Verified with `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and `git diff --check`.

2026-06-04 ownership repair slice verified:

- Deleted the Tokyo page materializer. Tokyo no longer owns page composition and no longer recomposes pages during widget save.
- Roma owns page package composition. Roma reads saved widget package files, builds the page `index.html`, `styles.css`, and `runtime.js`, and submits those three files to Tokyo.
- Tokyo stores submitted page package files only. It rejects missing/empty file payloads but does not inspect generated page semantics or act as the composer.
- Widget save in Roma asks Tokyo for page ids from the existing reverse placement index, then re-saves each affected page through the existing Roma page save path.
- Verified with `pnpm --filter @clickeen/roma test`, `pnpm --filter @clickeen/roma typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, `rg` for deleted materializer symbols, and `git diff --check`.

## Purpose

Build the core Page Composer job:

```text
widget packages in
page package out
```

The output is a portable Clickeen page package. It can later be:

- served directly from `clk.live`;
- embedded as a whole page into Prague, WordPress, Shopify, Squarespace, or another site surface;
- reused by future delivery surfaces without inventing a second page-rendering system.

106F only writes the package. 106G decides how that package is delivered publicly.

## Input

For every placed widget instance, read:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
```

Do not read widget private source as the composition input.

Generated widget package existence means Clickeen can compose the widget.

It does not mean the standalone widget URL is public. Public availability is controlled by delivery/publish state, not raw file existence.

## Audit Refresh Decisions

The audit refresh is useful for 106F because it identifies the highest-risk false-positive path: adapting the current instance artifact generator into a page composer.

The old toxic path was source-reading widget rendering code. The Page Composer
package builder must stay away from that path completely.

Use that as a hard implementation guard:

- Page Composer must not import or call source-reading artifact helpers;
- Page Composer must not read `product/widgets/*/widget.html`, `widget.css`, or `widget.client.js`;
- Page Composer must consume generated instance package files only;
- existing source-path visitor safety checks can remain as final defense, but cannot be the primary guarantee.

Static acceptance checks for the page domain:

```text
no production hit for product/widgets/*/widget.html
no production hit for source extraction helpers
no production hit for window.CK_WIDGET
no R2 scan fallback for affected pages
```

These checks must be executable verification, not review notes. Add them as targeted tests or CI guards before 106F is marked green.

Reject:

- a generated package manifest/dependency framework for V1;
- a page composer that repairs invalid widget packages;
- treating the current public instance materializer as the page renderer.

## Output

Write one page package:

```text
accounts/{accountPublicId}/website/publishes/{pageId}/
  index.html
  styles.css
  runtime.js
```

This package is object-addressed by `pageId`. It is not route-addressed by slug in V1.

V1 does not add a `publishId` package fork. The current page package is the three generated files above. 106G gates public delivery with page serve state, not with a route map or package pointer.

## Page Composer Package Builder Responsibilities

- receive already-accepted page source from Roma;
- receive already-account-valid placed instance references from Roma;
- read generated widget package files;
- extract widget body/root fragments from generated `index.html`;
- preserve placement order;
- emit one simple wrapper per placement in source order;
- compose all widget HTML into page `index.html`;
- compose widget CSS into page `styles.css`;
- compose widget runtime into page `runtime.js`;
- dedupe shared Dieter/runtime dependencies where practical;
- emit page head metadata from page source;
- fail fast on missing or invalid package files.

## Composition Rules

Page Composer composes generated packages. It does not reinterpret widget source.

For each placed instance:

- parse the generated widget `index.html`;
- extract the rendered top-level widget package root;
- wrap it in a page placement wrapper in the requested order;
- keep the widget root attributes that identify widget type and instance id;
- collect the widget CSS contribution;
- collect the widget runtime contribution;
- feed the placed instance through `window.CK_WIDGETS[instanceId]` in page runtime.

The page package must contain:

```text
one page document
one page stylesheet
one page runtime
```

The page HTML should have a simple placement structure:

```html
<main data-ck-page="P9Q8R7S6T5">
  <section>
    <section data-ck-widget="hero" data-ck-instance-id="HERO123456">...</section>
  </section>
  <section>
    <section data-ck-widget="faq" data-ck-instance-id="FAQ123456">...</section>
  </section>
</main>
```

That wrapper is structural only. It preserves ordered stacking without creating a placement object, placement id, page-local widget snapshot, or block subsystem.

It must not contain:

- one iframe per widget;
- several full widget documents pasted together;
- repeated `body`/document layout rules from each widget;
- repeated shared runtime modules that fight each other;
- runtime code that reads or writes `window.CK_WIDGET`.

The composed page can keep shared modules once and widget modules many times only where they are instance-safe.

For V1, Page Composer stacks full-width page placements in order.

Embedded widgets are allowed only as widget-owned fields that have already been materialized into the parent widget package. Page Composer does not expose a nested composer, page-source slot model, or child placement UI.

Example:

```text
page places Split instance
Split package already contains embedded FAQ output
Page Composer extracts Split's top-level package root
```

The child FAQ is not a page placement unless the page source also places that FAQ instance directly.

## Composed Page Locale Rule

Page Composer must compose one coherent locale context for the page.

Default V1:

```text
page package renders account/base locale
per-widget locale switchers are suppressed
page-level localized metadata/routes are deferred
```

If a later execution decision adds page-locale materialization before 106F ships, each locale package must still be coherent:

- every placed widget has selected-locale content;
- missing selected-locale content fails materialization;
- no widget silently falls back to base locale or empty state inside a localized page package.

Do not ship composed pages where each widget independently renders its own locale selector and locale state.

## Portable Delivery Implications

106F must produce a page package that is not tied to one final host surface.

The same package must work for:

```text
Clickeen-hosted page:
  https://clk.live/{accountPublicId}/pages/{pageId}

Prague dogfood:
  Prague renders or embeds the Clickeen page package

Customer site embed:
  WordPress / Shopify / Squarespace injects the composed page package

Future placement embed:
  deferred until product needs a deliberate placement-selection contract
```

Page Composer does not implement those delivery surfaces. It only preserves the structure that makes them possible.

## Recomposition

When a widget instance changes:

```text
save widget
materialize widget package
find pages that place that instance
recompose those page packages
```

This is the product value: edit once, pages update.

When an embedded child widget instance changes:

```text
save child widget
write child widget package
find parent widget instances that embed that child
update those parent widget packages through the same save/package path
find pages that place those parent instances
recompose those page packages
```

This preserves the same propagation model without making Page Composer understand nesting.

Do not use standalone widget publish state to decide whether a placed widget can be composed.

Composition package availability and public standalone serving are different concerns.

## Pre-Execution Agent Review Addendum

### Staff Engineer Review

106F is only safe after 106B has made widget packages truly composable.

The job is:

```text
read widget package files -> write one page package
```

It must not read widget private source, run Bob compiler logic, stack iframes, or invent a page renderer.

Primary code vectors:

```text
tokyo-worker/src/domains/pages/*
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/routes/internal-page-routes.ts
tokyo-worker/src/routes/internal-instance-routes.ts
tokyo-worker/src/routes/clk-live-routes.ts
```

Delivery stays in 106G. 106F must not expand public routing.

P0 engineering gates:

- 106B is green first: widget packages expose exactly one top-level package root with `data-ck-widget` and `data-ck-instance-id`;
- Page Composer fails if a widget `index.html` has zero or multiple widget roots;
- Page Composer extracts the root fragment, not the whole document;
- page output contains one `html`, one `head`, one `body`, one `main`, one `styles.css`, and one `runtime.js`;
- every placement gets one plain wrapper in source order;
- widget root attributes are preserved unchanged;
- page runtime uses `window.CK_WIDGETS[instanceId]`;
- page runtime contains no `window.CK_WIDGET`;
- Page Composer fails if any source package runtime still writes or reads `window.CK_WIDGET`;
- same widget type placed twice on one page initializes both instances without shared-state collision;
- missing `index.html`, `styles.css`, or `runtime.js` fails visibly;
- no partial page publish is allowed;
- recomposition uses the 106E reverse placement index;
- embedded-child propagation uses the reverse embedded-widget index before reverse placement lookup;
- no R2 scan fallback is allowed.

Fragment extraction is strict contract extraction, not a generic HTML rewriting platform. The extractor should only accept the package shape 106B defines.

CSS composition should stay boring:

- add page scaffold CSS;
- append each widget `styles.css` in placement order;
- dedupe only exact shared imports/modules where the contract makes that safe;
- fail or reject relative asset references that only work from the instance folder;
- do not build a CSS optimizer, module system, or cascade analyzer.

Runtime composition should stay equally boring:

- create one page-level `CK_WIDGETS` payload map;
- append instance-safe widget runtime modules;
- initialize by root attributes;
- keep cleanup and idempotency root-scoped;
- do not use `document.currentScript`;
- do not use global singleton widget state.

### Senior PM Review

The user outcome is:

```text
I built a page from my widgets.
It loads as one page.
If I edit one widget, every page using it updates.
I can host it on clk.live or embed it elsewhere.
```

106F is not a website builder, site router, embed product, or plugin project.

Primary product vectors:

- existing widget packages become reusable page ingredients;
- Roma Page Composer from 106E gets real output;
- hosted pages from 106G can serve one crawlable page package;
- Prague can dogfood Clickeen pages without surrendering nav, routes, markets, or site chrome;
- customer sites can later inject a whole Clickeen page without Clickeen taking over the site.

The scalable product shape is:

```text
single widget embed = one widget package
composed page = one page package made from many widget packages
```

Both paths use the same widget truth. Pages do not copy widget source. Pages do not create page-local widget forks.

Product gates:

- a composed page renders as one page, not many embeds;
- visible widget content is present in initial HTML;
- the same page package can be consumed by hosted `clk.live`, Prague, or a future customer-site embed path;
- editing a widget instance triggers recomposition for pages that place it;
- recomposition failure does not silently publish broken output;
- users keep one mental model: widgets are reusable instances, pages are ordered compositions.

### Principal TPM Review

106F is the Page Composer package-building job.

It is not a public router. It is not Roma UI. It is not Bob. It is not Prague. It is not `embed.js`.

The systems flow is:

```text
Roma/106E accepts page source
Roma/Bob save writes widget packages and Tokyo stores them
Page Composer builds page package before Tokyo storage
106G serves or embeds that already-composed package
```

Widget save flow:

```text
save widget -> materialize widget package -> reverse lookup pageIds -> recompose affected page packages
```

Page edit flow:

```text
save page source -> materialize page package
```

This keeps runtime serving cheap, makes propagation deterministic, and avoids rebuilding a second renderer.

Failure visibility:

- missing page source fails materialization;
- invalid placement fails materialization;
- missing widget package file fails materialization;
- invalid widget package root/extraction fails materialization;
- runtime merge conflict that cannot be made instance-safe fails materialization;
- recomposition failure after widget save marks affected page publish/materialization state non-green;
- the system must not silently publish the previous output as if the new recomposition succeeded.

### Scope Guard

Do not build:

- request-time page assembly;
- iframe stacking;
- block or section objects;
- container slots;
- page-source widget-inside-widget nesting;
- page-local widget snapshots;
- page-local widget source copies;
- page-specific overrides;
- personalization or A/B systems;
- slug/router/nav/custom-domain logic;
- plugin delivery;
- placement-level public delivery implementation;
- CSS AST optimizer;
- dependency graph framework;
- page runtime loader platform;
- retry/repair system that silently publishes stale output.

## Non-Scope

Do not:

- serve the public route in this PRD;
- implement `embed.js` in this PRD;
- implement WordPress/Shopify/Squarespace plugins in this PRD;
- implement partial placement delivery in this PRD;
- add request-time page assembly;
- stack iframes;
- copy full widget documents blindly into the page;
- introduce a second widget renderer;
- implement personalization or A/B tests.

## Verification

This PRD is green when:

- a page with multiple placed instances emits one `index.html`, one `styles.css`, and one `runtime.js`;
- Page Composer reads placed widget generated package files as input;
- output is addressed by `pageId`, not slug;
- every placement is wrapped once in source order, without inventing placement ids;
- the output page does not render as multiple iframes;
- primary visible widget content exists in initial page HTML;
- runtime initializes placed widgets through instance-scoped payloads;
- page output contains `CK_WIDGETS` payloads and no `CK_WIDGET` payload;
- editing and rematerializing a placed widget queues or performs recomposition for pages using it;
- recomposition failure is visible to the owning system and does not silently publish broken output.
