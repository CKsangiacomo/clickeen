# PRD 106B - Widget Package Composition Contract

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `../01-Planning/106__PRD__Page_Composer_Widget_Instance_Materializer_Foundation.md`
Depends on: `106A__PRD__Widget_File_Structure_V2.md`

## Execution Progress

2026-06-03 partial package-contract gates verified:

- Single widget packages now use the keyed payload contract only: `window.CK_WIDGETS[instanceId]`.
- Generated package roots are stamped and validated before writing public artifacts.
- Generated `index.html` includes saved base-locale visible content before JavaScript for current target widget packages.
- Target widget runtimes expose root-scoped initializers for FAQ, Countdown, and Logo Showcase.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and production scans for `window.CK_WIDGET` / current-script paths.

2026-06-03 Pass 1 superseded:

- Earlier package-revision stamping was removed. It added hidden package metadata to a contract that must stay three concrete files.
- The surviving package contract is direct: Builder save submits `index.html`, `styles.css`, and `runtime.js`; Tokyo applies storage-boundary shape/safety checks and stores exactly those files; Page Composer reads those same three files after the save operation has completed.
- No `ck-package-revision`, manifest, package registry, dependency graph, or fourth composition file is part of 106B.

2026-06-03 Pass 2 verified:

- Added an explicit generated-package composition fixture that materializes two FAQ instances and one Countdown instance, then treats their generated files as Page Composer input.
- The fixture extracts each package body fragment from generated `index.html` and proves each fragment has exactly one `[data-ck-widget][data-ck-instance-id]` root and no document/script/link tags.
- The fixture proves saved first-paint content survives extraction for repeated same-widget and mixed-widget package input.
- The fixture dedupes exact CSS/runtime contribution chunks and proves shared Stage/Pod CSS, shared runtime JS, shared appearance JS, FAQ client JS, Countdown client JS, FAQ CSS, and Countdown CSS are not duplicated when repeated packages are absorbed.
- The fixture keeps one unique payload contribution per instance, proving repeated same-widget placements still have separate `CK_WIDGETS[instanceId]` entries.
- Verified with `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and `git diff --check`.

2026-06-03 Pass 3 verified:

- Package-root validation now requires exactly one top-level widget root of any widget type, not merely one root matching the parent widget type.
- Sibling widget roots fail materialization with `artifact.package_root_invalid`.
- Nested embedded child widget roots inside the parent package root are allowed and remain identifiable by their own `data-ck-widget` / `data-ck-instance-id`.
- This keeps the parent package as one page placement while preserving future embedded-widget field support.
- Verified with `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and `git diff --check`.

2026-06-03 106F cutover verified:

- Generated widget packages are written on Builder save so Page Composer has package input before standalone publish.
- Create and duplicate write instance source only; they do not invent package bytes.
- Public standalone widget serving still requires Tokyo serve state to be `published`.
- Raw `index.html` / `styles.css` / `runtime.js` file existence is composition availability, not public availability.
- Unpublish keeps the generated package available for page composition and only disables standalone serving.

2026-06-03 repair pass verified:

- Generated `styles.css` now exposes source-neutral style contribution chunks with `ck-style-module` markers so Page Composer can dedupe exact package CSS without reading widget source paths.
- Generated `runtime.js` now separates one per-instance payload contribution from source-neutral runtime module chunks with `ck-runtime-payload` and `ck-runtime-module` markers.
- Page Composer can now compose repeated same-widget instances without dropping per-instance `window.CK_WIDGETS[instanceId]` payloads.
- The contract still has exactly three generated files. No manifest, package registry, dependency graph, or fourth composition file was added.
- Verified with `pnpm --filter @clickeen/tokyo-worker test` and `pnpm --filter @clickeen/tokyo-worker typecheck`.

2026-06-04 repair pass verified:

- Added a fixture proving a parent package can contain a nested child widget root without becoming multiple page placements.
- The page materializer still rejects multiple top-level roots, but it allows child roots inside the single parent package root.
- This supports page-shaped widgets with an embedded-widget content field while keeping page composition to ordered top-level placements.
- Verified with `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and `git diff --check`.

106B complete.

## Purpose

Define the exact generated widget package contract that Page Composer will consume.

This PRD does not build pages. It makes the output of a single widget unambiguous.

## Core Contract

Every saved widget instance writes a generated package:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
```

That generated package is the composition input for pages.

Standalone public serving is a separate serve-state decision:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

serves only when Tokyo says the instance is `published`. The generated package files can exist while the standalone URL remains unpublished.

This PRD defines the package shape and the single-widget/page-composition contract. It does not make raw file existence a public product state.

Page Composer reads those three files.

It does not read:

- `instance.config.json`;
- `instance.content.json`;
- locale overlay source files;
- widget source files;
- Bob editor contracts;
- private account assets metadata.

## Composable Output Requirements

`index.html` must contain:

- exactly one stable top-level widget package root: `[data-ck-widget][data-ck-instance-id]`;
- root attributes needed to identify widget type and instance;
- body content that can be extracted as a page fragment;
- visible rendered content for the instance, not only an empty shell waiting for runtime;
- no assumption that it is the only widget on the document.

`styles.css` must contain:

- widget styling needed by that instance;
- no global reset that breaks other widgets on a composed page;
- no accidental page-level layout ownership.

`runtime.js` must contain:

- enough runtime to initialize the widget root through `init(rootEl, payload, context) -> cleanup?`;
- no assumption that it owns the full document;
- no duplicate global boot behavior that breaks when several widgets exist on one page.

## Absorbable Package Contract

Page Composer must be able to absorb a generated widget package without understanding widget internals.

That means the generated package must expose three things clearly:

```text
html fragment
css contribution
runtime contribution
```

### HTML Fragment

The generated `index.html` must make the widget fragment extractable by DOM parsing.

The extractable fragment is exactly the top-level widget instance package root, not Stage/Pod alone and not the full document:

```text
[data-ck-widget="{widgetType}"][data-ck-instance-id="{instanceId}"]
```

Stage/Pod may be inside that root. Page Composer extracts the widget instance root because the product unit is the widget instance.

If a widget type has an embedded-widget field, nested child widget roots may appear inside the parent package root. They are not page placements. Fragment extraction must count exactly one top-level package root and must not fail merely because the parent root contains embedded child widget roots.

Page Composer may wrap that fragment in a page placement wrapper, but it must not have to invent widget markup.

Fragment rules:

- zero top-level package roots fail;
- more than one top-level package root fails;
- missing widget type fails;
- missing instance id fails;
- extracted fragment must not contain document `<html>`, `<head>`, `<body>`, `<script>`, or stylesheet `<link>`;
- extracted fragment must contain visible saved content before JavaScript.

## Embedded Widget Field Contract

Some page-shaped widgets can expose a normal widget field that references another widget instance.

This is a widget content/control field, not a page placement and not a block/container system.

Example field shape:

```json
{
  "embeddedWidgetInstanceId": "FAQ123456"
}
```

Bob renders this as a dropdown of existing account widget instances.

Roma validates on save:

- referenced instance exists;
- referenced instance belongs to the same account;
- parent does not reference itself;
- embed chains cannot cycle;
- embed depth remains within the explicit V1 limit.

Generated parent package behavior:

- parent package still has exactly one top-level widget package root;
- embedded child output appears inside the parent root;
- embedded child uses generated package output, not private widget source;
- embedded child is not an iframe;
- embedded child roots remain identifiable for runtime initialization;
- embedded child CSS/runtime is included or deduped in the parent package safely;
- the parent package contains no page placement wrapper for the child.

The page materializer consumes the parent package as one placement. It does not need a special nested-widget branch.

### CSS Contribution

The generated `styles.css` must be safe to concatenate with other widget CSS.

Required:

- shared Stage/Pod CSS is emitted once at page level or deduped by content;
- widget-specific CSS is scoped to the widget root or widget class;
- instance-specific values are written on the placed widget shell/root, not globally;
- package-only document rules such as `body` layout do not leak into composed pages.
- widget-owned CSS does not use `html`, `body`, or `:root` for instance-specific behavior in composed output.

### Runtime Contribution

The generated `runtime.js` must be safe to concatenate with other widget runtimes.

Required:

- shared runtime modules are idempotent or dedupable;
- each widget type registers or exposes one callable initializer;
- each placed instance initializes from its own root and `window.CK_WIDGETS[instanceId]`;
- `window.CK_WIDGET` is not emitted or read;
- runtime does not depend on `document.currentScript` in composed initialization;
- timers, observers, animation frames, and listeners are tied to the instance root and have a cleanup path when the widget needs one.

Page Composer should not parse widget JavaScript semantics. Widget runtime files must make composition boring by being root-scoped and instance-scoped.

## Runtime Shape

Target runtime behavior:

```text
single public widget page:
  runtime has one CK_WIDGETS entry and initializes one root

page:
  runtime has many CK_WIDGETS entries and initializes several roots
```

The single public widget page and the composed page use the same payload shape. The only difference is count: one instance versus many.

The widget runtime must not care whether it is running alone or inside a page. It receives one root, one payload, and one context.

### Single Embed

For a one-line `clk.live` single widget embed:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

the generated page has:

```text
one top-level [data-ck-widget][data-ck-instance-id] package root
one CK_WIDGETS[instanceId] payload entry
one runtime initializing that root
```

### Composed Page

For a page, Page Composer reads several generated widget packages, extracts each widget root, combines the payload map, and writes one page package:

```text
page index.html
page styles.css
page runtime.js
```

The composed page has:

```text
many top-level [data-ck-widget][data-ck-instance-id] package roots
many CK_WIDGETS[instanceId] payload entries
combined/deduped runtime contributions
```

This is the same contract as the single embed. It is not a second product mode.

## First-Paint Contract

Generated `index.html` must contain saved visible widget content before JavaScript.

Runtime may add behavior, timers, carousel motion, accordion interactions, share overlays, locale controls, and other enhancements. Runtime must not be the only source of the primary visible text/content.

This is required for:

- page composition;
- SEO/GEO;
- no-JS resilience;
- crawler-readable hosted pages;
- deterministic tests.

## Package Coherence Contract

The three files are one generated package.

Page Composer must not invent package metadata to prove that:

```text
old index.html
new styles.css
old runtime.js
```

The V1 contract stays boring:

- Builder builds the three-file package from one in-memory state snapshot.
- Roma sends those three files in one save command.
- Tokyo storage checks and stores those three files as the instance package.
- Page recomposition runs only after Tokyo storage has completed.
- Page Composer reads only the stored `index.html`, `styles.css`, and `runtime.js`.

Do not add package revision stamps, package manifests, package registries, package aliases, or hidden staging folders in 106B.

## Audit Refresh Decisions

The audit refresh correctly warns that the current instance materializer still reads widget private source and emits singleton runtime payload.

Use that warning as a 106B gate:

- current instance artifacts are not automatically page-composable just because they exist;
- generated package validation must prove first-paint HTML, one extractable root, scoped CSS, keyed payloads, and root-scoped runtime;
- `window.CK_WIDGET` must be gone from generated output before 106B is green;
- page composition must not be built on a demo that only works because singleton fallback masks broken package state.

Reject the audit's heavier package-manifest direction for V1.

106B remains a strict three-file contract:

```text
index.html
styles.css
runtime.js
```

Do not add a fourth manifest file, dependency graph, `GeneratedWidgetPackage` schema, or package registry in this PRD. If implementation later proves a manifest is unavoidable, that must be a deliberate PRD amendment, not a hidden precondition.

## Series Critical Path Gate

106B is the gate for the whole 106 series.

No downstream page-source, page-materializer, page-delivery, or Prague conversion work is green until the widget package contract is proven with fixtures.

Required fixture set:

```text
single widget package
two instances of the same widget type
mixed widget page package input
nested child widget root inside a parent package
```

The fixture must prove:

- one top-level package root per generated widget package;
- nested child roots are allowed only inside the parent package root and are not counted as page placements;
- no `window.CK_WIDGET`;
- first-paint HTML exists;
- CSS does not leak `html`, `body`, or `:root` instance behavior;
- root-scoped init works for repeated same-widget and mixed-widget output.

## Composed Page Locale Contract

Generated packages must support a composed-page context where one locale is selected for the page.

Default V1:

- composed pages render one locale context;
- per-widget locale switcher UI is suppressed in composed-page output;
- single-widget embeds may keep widget locale controls;
- missing selected-locale state fails before publish/materialization;
- no generated runtime may silently fall back to `{}` or a different locale for composed output.

Page-level localized metadata/routes remain out of 106B. This PRD only makes widget packages obey one coherent page locale context.

## Pre-Execution Agent Review Addendum

Three-agent pre-execution review completed against `106__Umbrella__Composition_Vision.md`.

Consensus: 106B is the hard generated package contract. It is product-correct because it lets pages compose real widget instances without creating page-local widget truth, but it must be treated as a Builder-save package and Tokyo package-storage contract cutover.

### Staff Engineer Findings

- Primary code vectors:
  - `bob/lib/session/publicPackage.ts`
  - `tokyo-worker/src/domains/account-instances/package-files.ts`
  - `tokyo-worker/src/routes/internal-instance-routes.ts`
  - `tokyo-worker/src/routes/clk-live-routes.ts`
  - `tokyo/product/widgets/faq/`
  - `tokyo/product/widgets/countdown/`
  - `tokyo/product/widgets/logoshowcase/`
  - `tokyo/product/widgets/shared/stagePod.js`
  - `tokyo/product/widgets/shared/branding.js`
  - `tokyo/product/widgets/shared/localeSwitcher.js`
  - `tokyo/product/widgets/shared/typography.js`
- Secondary blast radius:
  - `bob/lib/api/compiled-widget-route.ts`
  - `bob/app/api/widgets/[widgetname]/compiled/route.ts`
  - `roma/app/api/widgets/[widgetname]/compiled/route.ts`
  - `roma/components/compiled-widget-cache.ts`
  - Tokyo render/public artifact tests and `clk.live` route tests.
- Current materialization/runtime still carries single-widget assumptions. This must be resolved as a package-contract cutover, not CSS cleanup.

### Senior PM Findings

- The UX invariant is: edit one real widget instance in Builder, then every composed page placement can recompose from that instance without copying source or creating a page-specific variant.
- First-paint HTML is essential. Without saved visible content in `index.html`, pages become app shells and lose the hosted SEO/GEO promise.
- Package coherence is a product gate, not just engineering detail. Mixed `index.html` / `styles.css` / `runtime.js` reads can create customer-visible regressions.
- Do not accidentally require customers to publish standalone widget URLs before they can compose or preview a page unless that is an explicit V1 product decision.

### Principal TPM Findings

- Roma owns product validation and save acceptance. Tokyo Worker owns R2 storage-boundary checks and generated artifact writes.
- Page Composer reads only promoted/coherent widget packages and writes one page package.
- Bob/Roma author and save one account-owned instance. They do not produce page-ready fragments.
- San Francisco remains on the existing translation path; it is not part of package composition.
- Social share and other paid widget chrome become package contents only after the package contract is stable.

### Required Pre-Execution Gates

106B cannot go green unless:

- Generated `index.html` contains saved visible primary content before JavaScript.
- Generated output does not emit or read `window.CK_WIDGET`.
- No target widget requires `document.currentScript` for composed initialization.
- Fragment extraction finds exactly one top-level `[data-ck-widget][data-ck-instance-id]` package root.
- Extracted fragment contains no `<html>`, `<head>`, `<body>`, `<script>`, or stylesheet `<link>`.
- Two instances of the same widget type initialize independently in one document.
- Mixed-widget and repeated-same-widget fixtures show no CSS bleed, duplicate global boot, or runtime collision.
- Widget package reads are coherent across `index.html`, `styles.css`, and `runtime.js`.
- Widget-owned CSS does not leak instance behavior through `html`, `body`, or `:root`.
- Shared Stage/Pod CSS/runtime is emitted once or deduped by exact content.
- Timers, observers, listeners, animation frames, and preview message handlers are root-scoped and cleanable.
- Locale switcher behavior is explicitly guarded for composed-page context.
- Publish/unpublish still gates public single-widget serving.
- Bob open/edit/save and Roma compiled preview continue to work for FAQ, Countdown, and Logo Showcase.
- Any ambiguity between public published artifacts and private composition packages is resolved before Page Composer UX ships.

### Scope Guard

Do not use 106B to add:

- a fragment manifest;
- a package registry;
- a fourth generated package file;
- a JavaScript bundler or dependency graph;
- a block/section abstraction;
- page-specific widget snapshots;
- iframe stacking fallback;
- a second renderer;
- Bob awareness of pages, placements, or package composition;
- containers, page-source slots, placement overrides, route slugs, nav, domains, A/B variants, personalization, or customer-domain SEO.

The boring V1 remains:

```text
read generated index.html/styles.css/runtime.js
DOM-parse one widget root
reject invalid fragments
concatenate/dedupe safe CSS/runtime
boot each root from CK_WIDGETS[instanceId]
```

## Non-Scope

Do not:

- build the Page Composer package builder yet;
- rewrite all widget runtime from scratch;
- introduce a second renderer;
- make per-page widget source snapshots;
- create iframe stacking as a composition strategy.
- decide the private composition package path versus published-only package path.

## Verification

This PRD is green when:

- FAQ, countdown, and logoshowcase each produce the three generated files;
- the generated `index.html` has exactly one extractable top-level `[data-ck-widget][data-ck-instance-id]` package root;
- the extracted fragment contains saved visible primary content before JavaScript;
- `runtime.js` can initialize one root via a root-scoped initializer without assuming it owns the page;
- generated runtime does not emit or read `window.CK_WIDGET`;
- generated runtime does not depend on `document.currentScript` for composed initialization;
- multiple generated widget roots can exist in one test document without global collisions;
- two instances of the same widget type initialize independently in one test document;
- shared CSS/runtime code is either emitted once or safe to dedupe/execute once;
- widget-owned CSS does not leak `body`, `html`, or `:root` instance behavior into composed output;
- widget package reads are coherent across `index.html`, `styles.css`, and `runtime.js`;
- Page Composer has a stable input contract.
