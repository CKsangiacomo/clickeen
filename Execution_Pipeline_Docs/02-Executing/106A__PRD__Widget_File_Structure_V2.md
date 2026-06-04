# PRD 106A - Widget File Structure V2

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `../01-Planning/106__PRD__Page_Composer_Widget_Instance_Materializer_Foundation.md`

## Execution Progress

2026-06-03 Pass 1 verified:

- Saved package output emits and target runtime reads `window.CK_WIDGETS[instanceId]`; production `window.CK_WIDGET` paths are removed.
- Generated packages fail with `artifact.package_root_invalid` when widget source has zero or multiple package roots.
- Generated `index.html` carries saved base-locale visible content before JavaScript for the current target widgets.
- FAQ, Countdown, and Logo Showcase register root-scoped initializers and no longer depend on `document.currentScript` / `CK_CURRENT_SCRIPT` for package boot.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, and production scans for forbidden singleton/current-script paths.

2026-06-03 Pass 2a verified:

- Repeated document shell and Stage/Pod CSS moved from FAQ, Countdown, and Logo Showcase widget-owned CSS into `tokyo/product/widgets/shared/stagePod.css`.
- FAQ, Countdown, and Logo Showcase widget HTML now link `../shared/stagePod.css` before widget-owned CSS.
- Target widget CSS no longer owns generic `:root` / `html` / `body` / `.stage` / `.pod` shell selectors.
- Package fixture now proves shared Stage/Pod CSS is included in saved `styles.css`.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, selector scans, and `git diff --check`.

2026-06-03 Pass 2b verified:

- Added `tokyo/product/widgets/shared/runtime.js` as the tiny shared helper for root scanning, duplicate boot prevention, instance id resolution, keyed payload lookup, initializer registration, and preview state-update binding.
- FAQ, Countdown, and Logo Showcase now load `../shared/runtime.js` before widget-specific runtime scripts.
- FAQ, Countdown, and Logo Showcase clients no longer carry their own root scans, runtime-bound attributes, keyed payload lookup, or `CK_WIDGET_INITIALIZERS` registration.
- Countdown DOM resolver no longer carries its own instance-id resolver; it receives the shared runtime context from the client.
- Package fixture now proves shared runtime JS is included in saved `runtime.js`.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, boot-context scans, and `git diff --check`.

2026-06-03 Pass 2c verified:

- FAQ, Countdown, and Logo Showcase now load `../shared/runtime.js` before shared runtime consumers such as `localeSwitcher.js`, `typography.js`, and `branding.js`.
- `branding.js` reads initial state through `CKWidgetRuntime.contextFor(...)`; it no longer uses `document.currentScript`, `CK_CURRENT_SCRIPT`, `window.CK_WIDGET`, or direct `window.CK_WIDGETS` reads.
- `localeSwitcher.js` gets instance identity from `CKWidgetRuntime.resolveInstanceId(...)`; it no longer walks the DOM independently or falls back to `window.CK_WIDGET`.
- `typography.js` reads payload locale through `CKWidgetRuntime` context helpers; it no longer carries its own instance-id resolver or direct `window.CK_WIDGETS` / `window.CK_WIDGET` paths.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, shared-file toxic-path scans, and `git diff --check`.

2026-06-03 Pass 2d verified:

- FAQ, Countdown, and Logo Showcase specs use Bob's existing shared `stagepod-appearance` editor expansion instead of carrying copied Stage/Pod appearance field trees.
- FAQ defaults no longer seed customer FAQ content or enabled header/CTA copy; author-created rows stay author-owned.
- Duplicate `defaults.typography.roleScales` entries were removed where the values exactly match the shared runtime defaults in `tokyo/product/widgets/shared/typography.js`.
- Widget-specific typography scales remain in spec: FAQ `localeSwitcher`, Countdown `label` / `timer` / `localeSwitcher` / custom `title`, and Logo Showcase custom `title` / `localeSwitcher`.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/bob test`, `pnpm --filter @clickeen/bob typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, exact-duplicate role-scale scan, copied Stage/Pod editor-cluster scan, and `git diff --check`.

2026-06-03 Pass 2e verified:

- Added `tokyo/product/widgets/shared/appearance.js` as a tiny shared helper for repeated appearance mechanics: radius tokenization, corner radius expansion, fill-to-CSS conversion, forced shadow inset, and box-shadow CSS.
- FAQ, Countdown, and Logo Showcase now load `../shared/appearance.js` after `fill.js` and before shared modules that consume appearance helpers.
- `header.js`, `localeSwitcher.js`, `surface.js`, and `stagePod.js` no longer carry their own duplicate radius/fill/shadow helper implementations for those shared concerns.
- Package fixture now proves shared appearance JS is included in saved `runtime.js`.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, duplicate shared-helper scans, and `git diff --check`.

2026-06-03 Pass 2f verified:

- `CKWidgetRuntime.contextFor(...)` now exposes `composedPage` when a widget root or ancestor is marked with `data-ck-composed-page="true"`.
- FAQ, Countdown, and Logo Showcase pass that root-scoped context flag into `CKLocaleSwitcher.applyLocaleSwitcher(...)`.
- `localeSwitcher.js` removes/suppresses the per-widget locale switcher in composed-page output, preserving the PRD rule that composed pages have one page-level locale context.
- FAQ, Countdown, Logo Showcase, Stage/Pod, and Typography now route shared fill/color conversion through `CKAppearance`; direct `CKFill` conversion ownership is centralized in `appearance.js`.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, composed-page wiring scan, duplicate helper ownership scan, and `git diff --check`.

2026-06-03 repair pass verified:

- `@clickeen/ck-contracts` translation primitive tests no longer require seeded FAQ customer content in `spec.defaults`.
- Nested FAQ translation paths are now verified from an explicit saved-content fixture, proving the real product path without turning defaults into fake authored content.
- Verified with `pnpm --filter @clickeen/ck-contracts test`, `pnpm typecheck`, and `pnpm test`.

2026-06-04 repair pass verified:

- Removed FAQ's browser-runtime full state validator. The public widget runtime now renders the saved state it receives instead of re-checking the entire FAQ product contract after Builder/Tokyo already accepted the package.
- Kept real runtime failures for missing DOM roots and missing shared modules, because those are package/module load failures, not duplicated product-state authority.
- Added a `validate:widgets` guard so `faq/widget.client.js` cannot grow the full FAQ state validator back.
- Verified with `pnpm validate:widgets`, `pnpm --filter @clickeen/bob test`, `pnpm --filter @clickeen/bob typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, `pnpm --filter @clickeen/tokyo-worker typecheck`, runtime toxic-path scan, and `git diff --check`.

106A complete.

Next PRD:

- 106B package coherence: prove the fixed three-file package contract for single-widget embeds and composed pages without adding revision stamps, hidden package state, or Tokyo-side widget rendering.

## Purpose

Make single-widget source files simple enough for agents and humans to manage at scale.

This is the first PRD 106 slice because Page Composer can only stay boring if each widget package is already clean and predictable.

## Batch 1 Default Direction

This slice adopts these defaults because they are the simplest scalable contract for both single-widget embeds and pages made of stacked widgets:

- one payload truth: `window.CK_WIDGETS[instanceId]`;
- one extractable top-level widget package root: `[data-ck-widget][data-ck-instance-id]`;
- generated `index.html` contains saved visible widget content before JavaScript;
- widget runtime initializes from a root element, not from global document assumptions;
- widget CSS is scoped under the widget root or widget class;
- generated packages are coherent across `index.html`, `styles.css`, and `runtime.js`.

The same widget instance must work in both serving modes:

```text
single embed = one widget root + one CK_WIDGETS entry
page = many widget roots + many CK_WIDGETS entries
```

Do not introduce a second runtime, second payload shape, or block/page-only widget mode to support pages.

## Current Widget Files

Do not invent a new widget package taxonomy for this slice.

Current source files remain the basis:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  widget.html
  widget.css
  widget.client.js
  editable-fields.json
  limits.json
```

No `catalog.json`.
No `save-rules.json`.
No new sidecar JSON files unless this PRD is amended with a concrete current-code need.

## Current Shared Folder Baseline

Before editing FAQ, Countdown, or Logo Showcase package files, this PRD must analyze and simplify the current shared widget folder:

```text
tokyo/product/widgets/shared/
  branding.js
  fill.js
  header.css
  header.js
  localeSwitcher.css
  localeSwitcher.js
  previewL10n.js
  stagePod.js
  surface.js
  typography-data.js
  typography.js
```

This folder already owns real product behavior. It is not a new abstraction layer.

Current responsibilities:

- `fill.js`: fill normalization, color/background conversion, image/video media layers.
- `stagePod.js`: Stage/Pod layout, Stage/Pod backgrounds, inside shadows, floating mode, embed ready/resize messages.
- `surface.js`: card/card-wrapper radius, border, and shadow CSS variables.
- `header.js` and `header.css`: shared header, subtitle, CTA layout, CTA styling, and CTA icons.
- `typography.js` and `typography-data.js`: font loading, locale/script-aware font fallback, typography role CSS variables.
- `localeSwitcher.js` and `localeSwitcher.css`: language selector UI, language policy reading, preview locale change messages.
- `branding.js`: paid/free backlink display based on `state.behavior.showBacklink`.
- `previewL10n.js`: preview translation overlay for localized state values.

The shared folder is the right direction, but it is not clean enough yet.

Current problems found in the real files:

- FAQ, Countdown, and Logo Showcase each repeat `.stage`, `.pod`, body shell, pod width mode, and mobile padding CSS in `widget.css`.
- FAQ and Logo Showcase repeat instance-id resolution in `widget.client.js`; Countdown repeats it in `widget.dom.js`.
- `branding.js`, `localeSwitcher.js`, and `typography.js` also resolve instance id / locale / payload in their own ways.
- FAQ, Countdown, and Logo Showcase each repeat initial payload lookup and still tolerate the single-payload `window.CK_WIDGET` path.
- FAQ, Countdown, and Logo Showcase each repeat the preview `ck:state-update` listener and `CK_PREVIEW_L10N.loadLocalizedState` flow.
- `surface.js`, `stagePod.js`, `header.js`, and `localeSwitcher.js` repeat small radius, shadow, fill, and validation helpers.
- `typography.js` is large because it mixes font data use, font loading, locale/script fallback, validation, and CSS-var application behind one public API.
- Shared scripts/styles are manually listed inside each widget HTML, so Page Composer has to respect repeated includes until package composition is cleaned up.

## Audit Refresh Decisions

The 2026-06-03 composition audit refresh is useful for this PRD where it points at current executable runtime toxicity.

Use these findings:

- production runtime still contains singleton `window.CK_WIDGET` reads/writes;
- widget clients still carry repeated schema/assertion logic that should fail earlier at save/materialization;
- locale selection still has silent fallback paths, including empty-state fallback;
- shared modules still have repeated payload/root/locale resolution and null-returning paths;
- widget runtime comments claim canonical state, but runtime code still validates and repairs state in public rendering.

106A must therefore treat the following as real execution work, not cleanup language:

- move canonical state validation to save/materialization/publish boundaries;
- remove production runtime reads and writes of `window.CK_WIDGET`;
- remove empty-state runtime fallback for materialized packages;
- replace package-critical `return null` behavior with named materialization/package failures;
- consolidate root, payload, locale, and preview binding into shared code without creating a generic runtime framework.

Do not import these audit suggestions:

- do not resurrect `catalog.json`;
- do not introduce a broad `CK_RUNTIME` platform unless it directly deletes current duplicated code and remains a tiny shared helper;
- do not turn runtime cleanup into a compatibility shim for legacy standalone widget behavior. Clickeen is pre-GA; the target path should replace the old path.

## Execution Split Guidance

The series-level audit is right that 106A carries too much risk if executed as one broad refactor.

Execute 106A in two boring passes:

```text
Pass 1: package/runtime cutover
  remove CK_WIDGET
  use CK_WIDGETS[instanceId]
  prove one top-level package root
  prove root-scoped init
  prove first-paint HTML

Pass 2: shared cleanup
  move repeated Stage/Pod/runtime/editor helpers into shared
  delete duplication from target widgets
  keep widget-specific behavior local
```

Do not mix optional shared cleanup with the runtime payload cutover if that makes the package contract harder to prove.

## Composed Page Locale Gate

106A must prepare widgets for coherent composed-page locale behavior.

Default V1 rule:

```text
single widget embed may show widget locale controls
composed page renders one locale context
per-widget locale switchers are suppressed in composed-page output
```

Widget runtime must therefore support a context flag that disables local switcher UI when the widget is initialized inside a composed page.

No widget should silently fall back to `{}` state or a different locale during materialized package output.

## Shared Cleanup Required In This Slice

This PRD must make shared code do more of the boring repeated work.

Move into shared, using current files and current behavior only:

- Stage/Pod shell CSS currently repeated in each widget CSS.
- Widget root/context resolution: current script, widget root, instance id, keyed payload, global payload, initial state, initial locale.
- Preview state-update binding and localized preview state loading.
- Shared radius/shadow/fill helper logic already duplicated across `surface.js`, `stagePod.js`, `header.js`, and `localeSwitcher.js`.
- The common paid/free widget chrome pattern used by `branding.js`, so the future social share overlay can reuse the same package feature shape without becoming widget-specific code.

Do not move into shared:

- FAQ item rendering, accordion behavior, deep links, and copy override allow-list.
- Countdown timer scheduling, date/personal/number timer logic, and after-state behavior.
- Logo Showcase strip rendering, carousel motion, swipe, and ticker behavior.
- Widget-specific state validation until the schema/codegen path is deliberately changed.
- Page Composer logic.

The public shared APIs should stay boring:

```text
CKFill.*
CKStagePod.applyStagePod(...)
CKSurface.applyCardWrapper(...)
CKHeader.applyHeader(...)
CKTypography.applyTypography(...)
CKLocaleSwitcher.applyLocaleSwitcher(...)
CKBranding / paid widget chrome behavior
CK_PREVIEW_L10N.loadLocalizedState(...)
```

If a new shared JS or CSS file is added, it must delete repeated current code from FAQ, Countdown, and Logo Showcase. No new shared file exists just to name a concept.

## Current Bob Shared Editor Baseline

Shared is not only Tokyo runtime. Bob already has shared editor builders:

```text
bob/lib/compiler/modules/
  header.ts
  normalization.ts
  stagePod.ts
  typography.ts
```

These modules are wired through:

```text
bob/lib/compiler/editor-contract.ts
```

The current widget specs already use shared editor nodes, including typography:

```json
{
  "id": "typography",
  "shared": {
    "id": "typography"
  }
}
```

That means the Typography panel itself is already moved into shared.

What stays widget-owned:

- which typography roles this widget exposes (`title`, `body`, `question`, `answer`, `timer`, `label`, `button`, `localeSwitcher`);
- the default value for each exposed role;
- widget-specific typography roles that only exist for that widget, such as Countdown `timer` / `label` or FAQ `question` / `answer`.

What should not be repeated in every widget spec:

- the Typography panel markup;
- font family option lists;
- weight/style/size/tracking/line-height option lists;
- generic role labels when the shared module already owns them;
- role scales that are already hardcoded in `tokyo/product/widgets/shared/typography.js` for common roles.

The current cleanup target is specific:

- Keep `editor.panels[].shared.id = "typography"`.
- Keep `defaults.typography.roles` as widget state/defaults.
- Audit `defaults.typography.roleScales`.
- Remove duplicated `roleScales` for roles already covered by the shared runtime global scales unless the widget has a real product-specific scale.
- Keep widget-specific `roleScales` only for roles not covered by shared runtime, such as Countdown `timer` / `label` and the locale switcher role until runtime owns that scale.

## Required Changes

### `spec.json`

`spec.json` must stop carrying repeated generic editor machinery.

It should retain:

- widget state shape;
- widget defaults;
- widget-specific editor controls;
- references to shared editor primitives where current Bob/compiler code supports them.

It should not duplicate:

- Stage/Pod appearance controls;
- Typography panel controls;
- common Typography option sets and common role scales;
- repeated collection editor patterns;
- repeated policy/entitlement truth;
- repeated runtime behavior;
- generated catalog metadata.

### `widget.html`

`widget.html` is the widget shell.

It should own:

- stable root markup;
- stable hooks;
- required shared scripts/styles references.

It should not become a second content source or page-shaped template registry.

### `widget.css`

`widget.css` owns widget-specific styling.

Repeated Stage/Pod/wrapper styling should move to shared runtime/style primitives when the current codebase provides the place to do that cleanly.

After this slice, `widget.css` should mostly describe the actual widget surface:

- FAQ rows, accordion/list/multicolumn layout, FAQ item appearance.
- Countdown timer units, number mode, CTA/after-message layout.
- Logo Showcase strips, logo tiles, grid/carousel/ticker behavior.

It should not carry the generic `.stage` / `.pod` shell copied across every widget.

### `widget.client.js`

`widget.client.js` must separate:

```text
boot
init
render
```

Target shape:

```text
boot: finds root and payload for the current single-instance public runtime
init: initializes one widget root
render: renders deterministic widget state into that root
```

Page composition depends on this distinction. The page runtime should be able to initialize several placed widget roots without reinterpreting widget source.

The widget client should not keep repeating:

- current script lookup;
- widget root lookup;
- instance id resolution;
- widget payload lookup;
- preview translation update binding;
- shared Stage/Pod/Header/Typography/Locale boilerplate beyond calling the shared APIs.

The widget client should keep the widget's own rendering and behavior.

## Page Composer Implications

This PRD must prepare widget files for the page composition model.

The source widget is still one widget. It is not a block package.

But when the generated widget package is placed on a page, Page Composer must be able to absorb it cleanly:

```text
widget source files
  -> single widget package
    -> Page Composer reads generated index.html/styles.css/runtime.js
      -> page index.html/styles.css/runtime.js
```

That creates concrete source-file requirements.

### HTML Requirements

`widget.html` must keep one stable top-level widget package root:

```text
[data-ck-widget="{widgetType}"][data-ck-instance-id="{instanceId}"]
```

The widget package root must be extractable from the generated `index.html` without needing private source files.

Stage/Pod may live inside this root, but Stage/Pod is not the extraction boundary. Page Composer extracts exactly the widget root because the product unit is the widget instance.

If the widget has an embedded-widget field, the embedded widget root may appear inside the parent widget root. That nested root is widget-owned content, not a second page placement.

Page Composer extracts the parent package root. It does not inspect, reorder, or manage embedded child widgets inside that root.

Generated `index.html` must contain saved visible widget content inside that root. The runtime enhances the content; it is not the only way the content appears.

The source shell can still be a full document for Bob preview and current single-instance public serving, but the generated package must expose one body/root fragment Page Composer can stack.

### CSS Requirements

`widget.css` must distinguish:

- package shell CSS used for Bob preview and current single-instance public serving;
- shared Stage/Pod CSS that belongs in shared;
- widget-specific CSS that belongs to the widget surface.

For page composition, widget CSS must not depend on:

- `body` as the layout owner;
- `:root` as the place where instance-specific variables are written;
- generic `.stage` / `.pod` rules copied per widget;
- unscoped selectors that can style another placed widget.

Widget-specific selectors should stay under the widget surface, for example:

```text
.ck-faq...
.ck-countdown...
.ck-logoshowcase...
```

or under the stable widget root:

```text
[data-ck-widget="faq"] ...
[data-ck-widget="countdown"] ...
[data-ck-widget="logoshowcase"] ...
```

Forbidden for widget-owned CSS in composed-page output:

- `body` layout ownership;
- `html` layout ownership;
- `:root` instance-specific variables;
- global `.stage` / `.pod` shell ownership copied per widget;
- fixed/floating page-level chrome unless it is an explicit shared package feature.

### Runtime Requirements

`widget.client.js` must have a composable entrypoint:

```text
init(rootEl, payload, context) -> cleanup?
```

The current single-instance public runtime may auto-boot by finding the one root on the document, but the actual widget behavior must be callable for one root. Page Composer must be able to initialize many roots in one page without asking the widget to rediscover the whole document.

Page Composer cannot safely absorb widgets whose runtime only works by:

- reading `document.currentScript`;
- assuming one widget on the page;
- reading payload from `window.CK_WIDGET`;
- attaching global listeners without instance filtering;
- leaving intervals, animation frames, or observers with no cleanup path.

The target is not a second renderer. It is the same widget runtime with one root initializer used by both a single public widget page and a composed page.

### State And Payload Requirements

Current Tokyo Worker output writes both:

```text
window.CK_WIDGET
window.CK_WIDGETS[instanceId]
```

That is duplicate payload truth.

Target output writes one payload map only:

```text
window.CK_WIDGETS[instanceId]
```

A single public widget page is just a page with one entry in `CK_WIDGETS`.

No new runtime work should read, write, preserve, or fall back to `window.CK_WIDGET`.

### Single Embed And Page Stack Equivalence

The same generated widget package supports both output shapes.

Single widget embed:

```text
https://clk.live/{accountPublicId}/{instanceId}

index.html:
  one top-level [data-ck-widget][data-ck-instance-id] package root
  one CK_WIDGETS[instanceId] payload entry
  one runtime initializing that root
```

Page stack:

```text
Page Composer reads many widget packages
extracts many top-level [data-ck-widget][data-ck-instance-id] package roots
combines many CK_WIDGETS entries
writes one page index.html/styles.css/runtime.js
```

The widget runtime never needs to know whether it is running alone or inside a page. It receives one root, one payload, and one context.

### First Paint Requirement

Builder package generation must write the saved widget's public `index.html` now.

Runtime should hydrate behavior and dynamic effects. It should not be the only way search engines, AI crawlers, no-JS readers, or Page Composer see the main text.

This matters because Page Composer will stack the generated HTML fragments directly into the page HTML.

### Package Coherence Requirement

The three generated widget files must be treated as one package.

Page Composer must not be able to read:

```text
old index.html
new styles.css
old runtime.js
```

106B now verifies coherence by keeping the public package contract to the three concrete files that Builder submits and Tokyo stores:

```text
index.html
styles.css
runtime.js
```

Do not add revision stamps, hidden staging folders, package manifests, or package registries to solve this.

### `editable-fields.json`

Keep this as the content/translation contract.

Do not replace it with page metadata, editor UI metadata, or generic product theory.

### `limits.json`

Keep this as policy mapping only.

Tier truth stays in:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
```

## Pre-Execution Agent Review Addendum

Three-agent pre-execution review completed against `106__Umbrella__Composition_Vision.md`.

Consensus: 106A is directionally correct, but it is not a cosmetic cleanup. It changes the generated widget package contract and must be gated like a product/runtime boundary.

### Staff Engineer Findings

- Primary code vectors:
  - `tokyo/product/widgets/shared/`
  - `tokyo/product/widgets/faq/`
  - `tokyo/product/widgets/countdown/`
  - `tokyo/product/widgets/logoshowcase/`
  - `tokyo-worker/src/domains/account-instances/package-files.ts`
  - `tokyo-worker/src/routes/internal-instance-routes.ts`
  - `tokyo-worker/src/routes/clk-live-routes.ts`
  - `bob/lib/compiler/editor-contract.ts`
  - `bob/lib/compiler/modules/`
  - `bob/lib/api/compiled-widget-route.ts`
  - `tokyo-worker/src/generated/widget-definition-sources.ts`
- This slice changes the public artifact contract; it is not just CSS cleanup.
- Saved package output must stop emitting `window.CK_WIDGET` or this PRD cannot be considered green.
- Bob impact must stay narrow: reuse current shared editor modules, do not make Bob understand Page Composer or a second widget source model.

### Senior PM Findings

- The user-facing promise is: edit one widget instance in Bob, and every page placement recomposes from that same source.
- A single embed and a page placement must use the same generated widget package.
- Generated HTML must contain saved visible content before JavaScript, or pages become placeholder shells for users, crawlers, and AI systems.
- Locale controls can become incoherent on composed pages if every placed widget renders its own selector. V1 page-locale behavior must be decided or guarded before page composition ships.
- If Page Composer later consumes only public published widget artifacts, page-only widgets may accidentally require standalone public publishing. That workflow decision must remain explicit in 106B/106F.

### Principal TPM Findings

- Bob/Roma own submitted widget package bytes and product save acceptance; Tokyo Worker owns R2 storage-boundary checks and storage for coherent `index.html` / `styles.css` / `runtime.js`.
- Shared runtime cleanup is not a new platform layer. It is consolidation of existing behavior already present in `tokyo/product/widgets/shared/`.
- Package coherence is a dependency for 106B. 106A can define it, but actual package storage/readiness must stay a Tokyo storage concern before Page Composer consumes packages.
- Removing `window.CK_WIDGET` is a coordinated cutover across shared runtime files, target widget clients, preview behavior, tests, and materialized output.

### Required Pre-Execution Gates

106A cannot go green unless:

- FAQ, Countdown, and Logo Showcase still open/edit/save in Bob.
- Generated `index.html` contains saved visible content before JavaScript for all three target widgets.
- Each generated package has exactly one top-level `[data-ck-widget][data-ck-instance-id]` package root.
- Generated output writes and reads `CK_WIDGETS[instanceId]` only; no surviving `window.CK_WIDGET` runtime path.
- Target widgets and shared runtime files stop using `document.currentScript` or global single-widget assumptions for composed initialization.
- Each target widget has a root-scoped initializer and cleanup path for timers, observers, animation frames, and global listeners.
- Stage/Pod extraction boundary is explicit: Page Composer extracts the widget root; Stage/Pod must live inside it or be made root-contained.
- Widget-owned CSS does not depend on `html`, `body`, `:root`, global `.stage`, or global `.pod` for composed-page behavior.
- Shared context resolution exists once and is reused by `branding.js`, `localeSwitcher.js`, `typography.js`, and target widget clients.
- Repeated Stage/Pod shell CSS is deleted from FAQ, Countdown, and Logo Showcase rather than hidden behind more widget guards.
- A multi-placement fixture proves repeated same-widget and mixed-widget initialization with one `CK_WIDGETS` map.
- Locale-switcher behavior in composed-page context is explicitly decided or deferred with a hard guard.
- Package coherence is either implemented here or assigned as a hard 106B/106F gate.

### Scope Guard

Do not use 106A to create:

- a generic runtime framework;
- a package registry;
- sidecar schema files;
- a block abstraction;
- page-shaped taxonomy;
- page-only runtime;
- second payload shape;
- Bob page-source awareness;
- pre-work around sites, slugs, routing, nav, personalization, A/B tests, or customer-domain SEO.

Every new shared runtime/editor primitive must remove current duplicated behavior from at least two target widgets or current shared files.

## First Target Widgets

Execute against current real widgets:

```text
faq
countdown
logoshowcase
```

FAQ is the first detailed pass because it has the richest repeated/editor/content surface.

## Non-Scope

Do not:

- build Page Composer in this slice;
- build page source APIs in this slice;
- add page-source nested widget references;
- create a separate page-shaped package format;
- introduce new package files as theoretical cleanup;
- make Bob understand a second widget source model.

## Verification

This PRD is green when:

- current widget packages still validate;
- generated widget definition sources are stable;
- Bob can still open/edit/save current widgets;
- Tokyo can still materialize current widgets to `index.html`, `styles.css`, and `runtime.js`;
- generated `index.html` contains saved visible content before JavaScript for FAQ, Countdown, and Logo Showcase;
- each generated widget has exactly one top-level `[data-ck-widget][data-ck-instance-id]` package root;
- generated output writes `CK_WIDGETS[instanceId]` and does not write or read `window.CK_WIDGET`;
- widget runtime exposes or uses a root-scoped `init(rootEl, payload, context)` path;
- repeated Stage/Pod/editor machinery is shared where current code supports it;
- repeated Stage/Pod shell CSS is not copied across FAQ, Countdown, and Logo Showcase;
- repeated widget boot/context/preview listener code is moved into shared code or reduced to one tiny call per widget;
- widget-owned CSS does not depend on `body`, `html`, or `:root` for instance-specific composed-page behavior;
- no deleted duplication is replaced by widget-specific guards;
- no invented package files are introduced.
