# PRD 106D - Page-Shaped Widgets V1

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `../01-Planning/106__PRD__Page_Composer_Widget_Instance_Materializer_Foundation.md`
Depends on: `106A__PRD__Widget_File_Structure_V2.md`, `106B__PRD__Widget_Package_Composition_Contract.md`

## Purpose

Build the first page-shaped widgets as normal Clickeen widgets.

Hero, Split, CTA, image/title, and similar page-shaped surfaces are not blocks.

They are widgets.

## 2026-06-04 Repair Pass

Status: Executed / verified

What changed:

- Removed browser-runtime full saved-state validators from `cta`, `hero`, `split`, `steps`, and `cardgrid`.
- Kept runtime failures for missing DOM roots and missing shared modules.
- Added a widget-source validation guard so page-shaped widgets cannot reintroduce full `assert*State(...)` browser validators.

Why this is correct:

- Page-shaped widgets are normal widgets whose public runtime renders already accepted package state.
- Full product-state validation belongs at the named authoring/save/materialization boundaries, not inside every visitor runtime.
- The converted widgets stay simpler for AI agents to edit and safer for Page Composer to absorb.

Verification:

- `pnpm validate:widgets`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `git diff --check`

This PRD converts the useful Prague content block system into normal Clickeen widgets so Page Composer can stack them exactly like FAQ, Countdown, and Logo Showcase.

It does not introduce a block product type.

## Current Prague Block Audit

Before building new widget folders, audit the current Prague block inventory:

```text
prague/src/blocks/big-bang/big-bang.astro
prague/src/blocks/control-moat/control-moat.astro
prague/src/blocks/cta/cta.astro
prague/src/blocks/embed-carousel/embed-carousel.astro
prague/src/blocks/feature-explorer/feature-explorer.astro
prague/src/blocks/global-moat/global-moat.astro
prague/src/blocks/hero/hero.astro
prague/src/blocks/minibob/minibob.astro
prague/src/blocks/mobile-showcase/mobile-showcase.astro
prague/src/blocks/platform-strip/platform-strip.astro
prague/src/blocks/split-carousel/SplitCarousel.astro
prague/src/blocks/split/split.astro
prague/src/blocks/steps/steps.astro
prague/src/blocks/subpage-cards/subpage-cards.astro
```

For each block, decide:

```text
convert to normal widget
merge into a more general widget
defer because it is Prague-only marketing/internal surface
keep as Prague site chrome
```

The default is conversion for content/page blocks. Deferral requires a concrete reason.

## Executed Slice 1 - Prague Block Audit Matrix

Status: Executed / verified

The current Prague block source was audited before creating new widget folders.

| Prague source | Decision | Target | Reason |
| --- | --- | --- | --- |
| `big-bang/big-bang.astro` | Merge | `cta` / conversion widget family | Self-contained headline, body, and CTA row. The Prague name is internal marketing language; the customer job is a conversion CTA section. Preserve brown band, larger gutter, CTA row gap, and display/body scale. |
| `control-moat/control-moat.astro` | Merge | `steps` / value-props widget family | Thin wrapper around `StepsPrimitive`. It should not become a separate customer widget. |
| `cta/cta.astro` | Convert | `cta` | Lowest-risk self-contained page-shaped widget: headline, subheadline, action. No live embeds, no Prague route dependency, strong first proof target. |
| `embed-carousel/embed-carousel.astro` | Defer | Embedded widget field / carousel later | It is live widget composition via `InstanceEmbed`. Build after the simple widgets and embedded-widget dropdown/materialization are proven. |
| `feature-explorer/feature-explorer.astro` | Defer/redesign | Card grid or feature explorer later | Source is placeholder-like (`JSON.stringify(feature)` content area). Not suitable as a gold-standard widget. |
| `global-moat/global-moat.astro` | Merge | `valueprops` / card-grid family | Reusable title/subhead/items/icon/card grid. Customer job is value props, not "global moat." Preserve 3-column grid, gray cards, 4xl radius, icon spacing. |
| `hero/hero.astro` | Convert after CTA | `hero` | Reusable page hero. Has optional live widget visual/carousel, so self-contained hero lands first; embedded visual variant waits for embedded-widget field. |
| `minibob/minibob.astro` | Defer | Demo section later | Prague funnel/demo surface with route-derived create URL and live `InstanceEmbed`. Not a first customer widget. |
| `mobile-showcase/mobile-showcase.astro` | Defer | Embedded widget carousel/showcase later | Live widget composition. Wait for embedded-widget field and contained child rendering. |
| `platform-strip/platform-strip.astro` | Merge | `steps` / value-props widget family | Thin wrapper around `StepsPrimitive`; customer job is value props/steps. |
| `split-carousel/SplitCarousel.astro` | Merge/defer variant | `split` with carousel/media variant later | Copy/CTA split is reusable, but carousel visual is composition-heavy. Build simple `split` first. |
| `split/split.astro` | Convert after CTA/hero | `split` | Reusable page split. Self-contained media variant first; embedded widget visual waits for dropdown/materialization slice. |
| `steps/steps.astro` | Convert/merge | `steps` / value-props | Thin wrapper around `StepsPrimitive`. Build as one reusable normal widget, not separate "steps/control/platform" widgets. |
| `subpage-cards/subpage-cards.astro` | Merge/defer | `cardgrid` / link-grid later | Real reusable card/link-grid shape, but current source depends on Prague route/market/locale link resolution. Convert only after customer-owned URL fields replace Prague route helpers. |
| `site/nav/Nav.astro` | Site chrome keep | Prague-owned | Nav, markets, locales, routes, and URL management stay in Prague/customer site. Not a widget. |
| `site/footer.astro` | Site chrome keep | Prague-owned | Footer is site chrome, not page-shaped widget content for V1. |

First implementation sequence from the audit:

```text
1. cta
2. hero self-contained
3. split self-contained
4. steps/valueprops
5. cardgrid/link-grid
6. embedded-widget field variants after the simple widgets are green
```

Why `cta` first:

- it proves the new page-shaped widget model with the smallest blast radius;
- it has no embedded widget dependency;
- it needs normal widget files only;
- it can preserve Prague visual values directly;
- it gives Page Composer a real section-style widget without inventing blocks.

## Executed Slice 2 - CTA Normal Widget

Status: Executed / verified

Implemented `cta` as the first page-shaped widget under the normal widget source path:

```text
tokyo/product/widgets/cta/widget.html
tokyo/product/widgets/cta/widget.css
tokyo/product/widgets/cta/widget.client.js
tokyo/product/widgets/cta/spec.json
tokyo/product/widgets/cta/editable-fields.json
tokyo/product/widgets/cta/limits.json
```

What landed:

- CTA is a normal widget type, not a block or section type.
- CTA uses the shared Stage/Pod shell.
- CTA uses the shared typography runtime and the same `globalFamily` / `roles` shape as existing widgets.
- CTA has blank author-owned content defaults: title, body, primary CTA, and secondary CTA start empty.
- CTA has normal editable fields for translation: `title`, `body`, `primaryCta.label`, and `secondaryCta.label`.
- CTA has normal policy mapping for Made with Clickeen and paid social share.
- Builder save writes CTA first-paint HTML as a normal widget package with saved text visible before JavaScript.
- CTA runtime registers through `CKWidgetRuntime.register('cta', ...)`.
- CTA does not use `window.CK_WIDGET`.
- CTA does not use `document.currentScript`.
- CTA is included in the generated widget definition source and overlay codebook.

Tokyo changes:

```text
packages/ck-contracts/src/overlay-codebooks.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/generated/widget-definition-sources.ts
```

Bob / policy changes:

```text
bob/lib/compiler/editor-contract.test.ts
packages/ck-policy/src/limits.test.ts
```

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/ck-policy test
git diff --check
```

All checks passed.

Slice 2 conclusion:

CTA proves the boring model: a page-shaped widget is just a widget. Page Composer can later place this instance without a block registry, section renderer, or widget-type special branch.

## Executed Slice 3 - Hero Normal Widget

Status: Executed / verified

Implemented `hero` as a self-contained normal widget under the normal widget source path:

```text
tokyo/product/widgets/hero/widget.html
tokyo/product/widgets/hero/widget.css
tokyo/product/widgets/hero/widget.client.js
tokyo/product/widgets/hero/spec.json
tokyo/product/widgets/hero/editable-fields.json
tokyo/product/widgets/hero/limits.json
```

What landed:

- Hero is a normal widget type, not a block or section type.
- Hero uses the shared Stage/Pod shell.
- Hero preserves the Prague hero surface values that matter: gray band, 40px vertical rhythm, 1560px content width, large split gap, and CTA row behavior.
- Hero has blank author-owned content defaults: eyebrow, headline, subheadline, primary CTA, and secondary CTA start empty.
- Hero supports a self-contained optional visual fill. It does not embed another widget yet.
- Hero uses the shared typography runtime and normal typography role shape.
- Hero has normal editable fields for translation: `eyebrow`, `headline`, `subheadline`, `primaryCta.label`, and `secondaryCta.label`.
- Hero has normal policy mapping for Made with Clickeen and paid social share.
- Builder save writes Hero first-paint HTML as a normal widget package with saved text visible before JavaScript.
- Hero runtime registers through `CKWidgetRuntime.register('hero', ...)`.
- Hero does not use `window.CK_WIDGET`.
- Hero does not use `document.currentScript`.
- Hero is included in the generated widget definition source and overlay codebook.

Deferred deliberately:

- live widget preview/carousel inside Hero;
- embedded widget dropdown;
- parent/child package composition for embedded visuals.

Those belong to the later embedded-widget field slice. Keeping them out of this slice prevents Hero from becoming a hidden container system.

Tokyo changes:

```text
packages/ck-contracts/src/overlay-codebooks.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/generated/widget-definition-sources.ts
```

Bob / policy changes:

```text
bob/lib/compiler/editor-contract.test.ts
packages/ck-policy/src/limits.test.ts
```

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/ck-policy test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

All checks passed.

Slice 3 conclusion:

Hero proves the second page-shaped conversion can still stay on the normal widget path. The live widget visual remains a product decision for the embedded-widget dropdown slice, not an accidental nested composer.

## Executed Slice 4 - Split Normal Widget

Status: Executed / verified

Implemented `split` as a self-contained normal widget under the normal widget source path:

```text
tokyo/product/widgets/split/widget.html
tokyo/product/widgets/split/widget.css
tokyo/product/widgets/split/widget.client.js
tokyo/product/widgets/split/spec.json
tokyo/product/widgets/split/editable-fields.json
tokyo/product/widgets/split/limits.json
```

What landed:

- Split is a normal widget type, not a block, section, or container type.
- Split uses the shared Stage/Pod shell.
- Split preserves the Prague split surface values that matter: white band, 80px desktop section rhythm, 1560px content width, large split gap, CTA row behavior, and mobile stacking.
- Split has blank author-owned content defaults: headline, subheadline, primary CTA, and secondary CTA start empty.
- Split supports self-contained `visual-right`, `visual-left`, and `stacked` layouts.
- Split supports a self-contained optional visual fill. It does not embed another widget yet.
- Split uses the shared typography runtime and normal typography role shape.
- Split has normal editable fields for translation: `headline`, `subheadline`, `primaryCta.label`, and `secondaryCta.label`.
- Split has normal policy mapping for Made with Clickeen and paid social share.
- Builder save writes Split first-paint HTML as a normal widget package with saved text visible before JavaScript.
- Split runtime registers through `CKWidgetRuntime.register('split', ...)`.
- Split does not use `window.CK_WIDGET`.
- Split does not use `document.currentScript`.
- Split is included in the generated widget definition source and overlay codebook.

Deferred deliberately:

- live widget preview inside Split;
- split-carousel live widget composition;
- embedded widget dropdown;
- parent/child package composition for embedded visuals.

Those belong to the later embedded-widget field slice. This slice keeps Split a leaf widget so Page Composer can stack it exactly like FAQ, Countdown, Logo Showcase, CTA, and Hero.

Tokyo changes:

```text
packages/ck-contracts/src/overlay-codebooks.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/generated/widget-definition-sources.ts
```

Bob / policy changes:

```text
bob/lib/compiler/editor-contract.test.ts
packages/ck-policy/src/limits.test.ts
```

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/ck-policy test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

All checks passed.

Slice 4 conclusion:

Split proves that Prague two-column page content can be converted into normal widgets without introducing a container subsystem. Embedded widget visuals remain a separate explicit capability.

## Executed Slice 5 - Steps Normal Widget

Status: Executed / verified

Implemented `steps` as the reusable normal widget target for Prague `steps`, `platform-strip`, and `control-moat` style content.

Source files:

```text
tokyo/product/widgets/steps/widget.html
tokyo/product/widgets/steps/widget.css
tokyo/product/widgets/steps/widget.client.js
tokyo/product/widgets/steps/spec.json
tokyo/product/widgets/steps/editable-fields.json
tokyo/product/widgets/steps/limits.json
```

What landed:

- Steps is a normal widget type, not a block, section, or Prague wrapper.
- Steps uses the shared Stage/Pod shell.
- Steps preserves the Prague steps/value-props values that matter: white band, 80px desktop section rhythm, 1560px content width, centered header, card/value-props variants, large card padding, 4xl radius, and mobile responsive columns.
- Steps has blank author-owned content defaults: title, subhead, and repeated items start empty.
- Steps supports ordered repeated items with title/body and optional Dieter icon name.
- Steps uses `normalization.idRules` so repeated items get stable IDs before save.
- Steps has normal editable fields for translation: `title`, `subhead`, `items[].title`, and `items[].body`.
- Steps uses `items[].id` as the repeated-item translation identity.
- Steps has normal policy mapping for Made with Clickeen and paid social share.
- Builder save writes Steps first-paint HTML as a normal widget package with saved repeated content visible before JavaScript.
- Steps runtime registers through `CKWidgetRuntime.register('steps', ...)`.
- Steps does not use `window.CK_WIDGET`.
- Steps does not use `document.currentScript`.
- Steps is included in the generated widget definition source and overlay codebook.

Deliberately not preserved from Prague:

- Prague route-derived CTA labels;
- Prague widget-label lookup;
- Prague Tokyo page-asset path resolver;
- live widget or carousel composition.

Those were Prague implementation details, not the customer widget contract.

Tokyo changes:

```text
packages/ck-contracts/src/overlay-codebooks.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/generated/widget-definition-sources.ts
```

Bob / policy changes:

```text
bob/lib/compiler/editor-contract.test.ts
packages/ck-policy/src/limits.test.ts
```

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/ck-policy test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

Additional repeated-item verification:

```text
steps normalization assigns stable repeated item ids before save
Builder save writes Steps repeated first-paint content as a normal widget package
```

All checks passed.

Slice 5 conclusion:

Steps proves repeated page-shaped content can stay on the normal widget path with stable translation identity. This lets Page Composer stack value-prop/steps sections without inventing a block inventory or section renderer.

## Executed Slice 6 - Card Grid Normal Widget

Status: Executed / verified

Implemented `cardgrid` as the reusable normal widget target for Prague `subpage-cards` / link-grid style content.

Source files:

```text
tokyo/product/widgets/cardgrid/widget.html
tokyo/product/widgets/cardgrid/widget.css
tokyo/product/widgets/cardgrid/widget.client.js
tokyo/product/widgets/cardgrid/spec.json
tokyo/product/widgets/cardgrid/editable-fields.json
tokyo/product/widgets/cardgrid/limits.json
```

What landed:

- Card Grid is a normal widget type, not a block, section, Prague route adapter, or page navigation subsystem.
- Card Grid uses the shared Stage/Pod shell.
- Card Grid preserves the Prague subpage-card values that matter: white band, centered header, 1560px content width, 3-column cards, 4xl radius, elevated hover, focus outline, CTA hint, and mobile responsive columns.
- Card Grid has blank author-owned content defaults: title, subhead, and repeated cards start empty.
- Card Grid supports ordered repeated cards with title, body, customer-owned URL, CTA label, and optional Dieter icon name.
- Card Grid uses `normalization.idRules` so repeated cards get stable IDs before save.
- Card Grid has normal editable fields for translation: `title`, `subhead`, `items[].title`, `items[].body`, and `items[].ctaLabel`.
- Card Grid uses `items[].id` as the repeated-card translation identity.
- Card Grid has normal policy mapping for Made with Clickeen and paid social share.
- Builder save writes Card Grid first-paint HTML as a normal widget package with saved repeated content and hrefs visible before JavaScript.
- Card Grid runtime registers through `CKWidgetRuntime.register('cardgrid', ...)`.
- Card Grid does not use `window.CK_WIDGET`.
- Card Grid does not use `document.currentScript`.
- Card Grid is included in the generated widget definition source and overlay codebook.

Deliberately not preserved from Prague:

- Prague `resolvePragueHref`;
- Prague market/locale/widget route replacement;
- fixed examples/features/pricing page logic.

Those are Prague site concerns. The normal widget stores explicit customer-owned URLs per card so it works in Clickeen pages and external sites.

Tokyo changes:

```text
packages/ck-contracts/src/overlay-codebooks.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/generated/widget-definition-sources.ts
```

Bob / policy changes:

```text
bob/lib/compiler/editor-contract.test.ts
packages/ck-policy/src/limits.test.ts
```

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/ck-policy test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

Additional repeated-card verification:

```text
cardgrid normalization assigns stable repeated item ids before save
Builder save writes Card Grid repeated first-paint content as a normal widget package
```

All checks passed.

Slice 6 conclusion:

Card Grid proves Prague link-grid content can become a portable normal widget by making URLs customer-owned fields. No route helper, market helper, locale helper, or page section model is needed.

## Executed Slice 7 - 106D Closure And Embedded Boundary

Status: Executed / verified

106D is complete with five normal page-shaped widget families:

```text
cta
hero
split
steps
cardgrid
```

Those widgets cover the V1 conversion set from the Prague audit without introducing a block or section product model.

Final audit closure:

| Prague source | 106D closure |
| --- | --- |
| `cta/cta.astro` | Converted to `cta`. |
| `big-bang/big-bang.astro` | Merged into the CTA/conversion family; no separate customer widget in V1. |
| `hero/hero.astro` | Converted to self-contained `hero`; live embedded visual waits for the embedded-widget field path. |
| `split/split.astro` | Converted to self-contained `split`; live embedded visual waits for the embedded-widget field path. |
| `split-carousel/SplitCarousel.astro` | Merged into `split` only where self-contained; carousel/live composition waits. |
| `steps/steps.astro` | Converted to `steps`. |
| `platform-strip/platform-strip.astro` | Merged into `steps`. |
| `control-moat/control-moat.astro` | Merged into `steps`. |
| `global-moat/global-moat.astro` | Merged into reusable steps/value-props/card-grid shapes. |
| `subpage-cards/subpage-cards.astro` | Converted to `cardgrid` with customer-owned URLs. Prague route helpers were removed from the model. |
| `feature-explorer/feature-explorer.astro` | Deferred/redesign; current Prague source is not a clean reusable widget. |
| `embed-carousel/embed-carousel.astro` | Deferred to embedded-widget field execution. |
| `mobile-showcase/mobile-showcase.astro` | Deferred to embedded-widget field execution. |
| `minibob/minibob.astro` | Deferred as Prague demo/funnel surface until it can be self-contained. |
| `site/nav/Nav.astro` | Kept Prague-owned. Not a widget. |
| `site/footer.astro` | Kept site-owned. Not a widget. |

Embedded-widget-heavy Prague blocks are deliberately not converted in 106D because they need a normal widget content field:

```text
embeddedWidgetInstanceId
```

That field is edited in Bob as a dropdown and saved on the parent widget config. Page Composer does not manage it. Page source still places only the parent widget instance.

The next implementation step is PRD 106E, which creates the page source and Roma Page Composer that can stack the normal widget instances already produced here.

Verification:

```text
pnpm validate:widgets
pnpm --filter @clickeen/ck-policy test
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

Slice 7 conclusion:

106D is green. The Prague content block vocabulary has been collapsed into normal widgets where it is reusable, deferred where it depends on embedded-widget composition, and kept site-owned where it is nav/footer chrome.

## Prague Nav Boundary

Do not convert Prague global nav into a widget in this PRD.

Current nav is well coded and well working:

```text
prague/src/blocks/site/nav/Nav.astro
```

Prague continues to manage its own URLs, markets, locales, navigation, and site chrome.

Clickeen pages are injected into Prague as composed page packages. They do not take over Prague URL/nav management.

This same boundary applies to customer sites:

```text
customer site nav/header/footer stays customer-owned
Clickeen injects whole pages or selected widget placements
```

That is why page-shaped widgets must be portable content, not a website management system.

## V1 Widget Targets

V1 scope is not "hero only."

V1 must produce an audit-backed conversion plan for all current Prague content block types and implement the selected conversion set needed to replace the current block/page composition path with normal widgets.

Initial expected widget families include:

```text
hero
split
cta
image-title / media-title
steps
feature grid / card grid
platform strip
global moat / control moat
embed carousel / mobile showcase
minibob-like demo section
big-bang style conversion section
subpage cards
```

Existing widgets remain usable as page placements:

```text
faq
countdown
logoshowcase
```

## Conversion Sequencing

Do not convert all Prague blocks before the composition pipeline is proven.

First prove the end-to-end path on a thin widget set:

```text
hero
split
cta
faq
countdown
logoshowcase
```

This thin set must prove:

- Bob edit;
- Roma create/open;
- Roma save / Tokyo package storage;
- optional embedded widget dropdown on a page-shaped widget;
- page placement;
- page materialization;
- recomposition after widget edit;
- public page delivery.

Only after that pipeline is green should the broader Prague block conversion expand to the full audit inventory.

## Audit Refresh Decisions

The audit refresh is useful here because it confirms no page-shaped Tokyo widgets currently exist. PRD 106D must therefore prove the model with normal widget folders, not documentation language.

Use:

- page-shaped widgets must be implemented as normal widget types;
- the first conversion set must prove Bob edit, Roma create, Roma save/Tokyo package storage, and Page Composer placement;
- no `block`, `section`, or `container` noun should appear in customer page source.

Reject:

- the audit's `catalog.json` requirement for a page-shaped widget. `catalog.json` is deleted widget source and must not come back;
- literal one-file-per-Prague-block conversion if several Prague blocks map to the same reusable customer widget family.

## Product Rules

Each page-shaped widget uses the normal widget path:

```text
Bob controls
Roma account instance
Tokyo source storage
stored widget package
editable-fields.json translation contract
limits.json policy mapping when needed
```

Do not create a separate section inventory.

Do not resurrect Prague `blocks` as a second customer product model.

## V1 Shape

Keep first page-shaped widgets simple:

- fields owned by the widget instance;
- full-width section rendering;
- normal Stage/Pod behavior;
- normal translation path;
- optional embedded widget field only where the widget product shape requires it.

If a Prague block currently embeds a live widget visual, the conversion must decide whether the new widget is:

- self-contained, with its own media/demo fields; or
- a page-shaped widget with a normal `widgetInstanceRef` field.

Do not create page-source slots, block slots, container children, or a nested page composer.

## Embedded Widget Field UX

An embedded widget is a widget content field.

It is not a block.

It is not a page placement.

It is not a Page Composer concept.

Example: Split widget.

```text
left side = Split text/media fields
right side = embedded widget dropdown
```

Bob shows a dropdown:

```text
Embedded widget: [ FAQ - Pricing Questions v ]
```

The saved parent widget config stores:

```json
{
  "embeddedWidgetInstanceId": "FAQ123456"
}
```

Roma validates on save:

- embedded instance exists;
- embedded instance belongs to the same account;
- parent does not embed itself;
- parent/child references do not create a cycle.

The parent widget package materializes the embedded child package inside the parent widget root.

Page Composer only sees and places the parent widget instance.

## Stage / Pod Conversion Rules

Stage/Pod must be preserved as the shared widget shell, not duplicated or improvised per Prague block.

Rules:

- every converted Prague block becomes a normal widget with one top-level widget package root;
- the parent page-shaped widget owns the full-width Stage/Pod band when placed on a page;
- embedded child widgets render inside a parent content cell, not as another full-width page band;
- child widget output must not bring `body`, `html`, `:root`, or page-level Stage ownership into the parent;
- shared Stage/Pod code must support contained rendering cleanly instead of each converted widget inventing local padding/width hacks;
- Prague block CSS must be mapped into shared Stage/Pod plus widget-specific CSS, not copied wholesale;
- no converted Prague widget may depend on Prague routes, Prague nav, Prague page chrome, or Prague-only layout wrappers.

## Prague Visual Value Preservation

Do not lose Prague's working visual craft during conversion.

For every converted Prague block, audit and preserve the real values that make it look right:

```text
spacing
padding
margin
gap
max-width
border radius
border width/color
shadow
background fill
text color
surface color
hover/focus states
breakpoints
mobile padding
z-index where relevant
motion timing where relevant
```

Preserve does not mean copy Prague CSS blindly.

It means:

- extract the actual Prague values before porting;
- map shared shell values into Stage/Pod/widget config and expose them through Bob panels where the value should be user-editable;
- keep widget-specific visual values in the new widget CSS where they are part of that widget's product shape;
- document any value intentionally changed and why;
- verify the converted widget against the Prague reference before deleting or replacing the Prague block.

Do not replace Prague's working proportions with generic default spacing.

Do not flatten distinctive borders, radii, shadows, colors, or responsive behavior into vague shared defaults.

The conversion target is:

```text
same visual quality
cleaner product architecture
shared Stage/Pod plus widget config where appropriate
widget-specific CSS where necessary
```

This is how current Prague blocks avoid becoming a clusterfuck:

```text
Prague block visual intent
  -> reusable widget type
    -> shared Stage/Pod shell
    -> widget-specific fields/CSS
    -> optional widgetInstanceRef dropdown when the design embeds a real widget
```

Do not preserve Prague implementation topology if it fights this model.

## Pre-Execution Agent Review Addendum

### Staff Engineer Review

This PRD is correct only if it stays normal widget-system work.

Prague blocks are migration input. They are not a customer product model.

Primary code vectors:

```text
tokyo/product/widgets/{widgetType}/
packages/ck-contracts/src/overlay-codebooks.ts
scripts/generate-widget-definition-sources.mjs
tokyo-worker/src/generated/widget-definition-sources.ts
scripts/validate-widget-source.mjs
tokyo-worker/src/domains/widget-catalog.ts
tokyo-worker/src/routes/internal-widget-definition-routes.ts
tokyo-worker/src/domains/account-instances/package-files.ts
tokyo-worker/src/routes/internal-instance-routes.ts
bob/lib/api/compiled-widget-route.ts
bob/lib/compiler/editor-contract.ts
bob/lib/compiler/modules/*
roma/app/api/account/widgets/route.ts
roma/app/api/account/instances/route.ts
roma/app/api/widgets/[widgetname]/compiled/route.ts
prague/src/components/WidgetBlocks.astro
prague/src/lib/blockRegistry.ts
prague/src/composition/contracts.ts
tokyo/prague/pages/**
```

P0 engineering gates:

- every Prague content block has an explicit convert, merge, defer, or site-chrome decision;
- no new noun is introduced: no `block`, `pageSection`, `section`, section registry, section renderer, or second source package type;
- new page-shaped surfaces are created only under `tokyo/product/widgets/{widgetType}`;
- every converted widget opens, saves, translates, and materializes as a normal account-owned widget instance;
- `prague/src/blocks/site/nav/Nav.astro` stays Prague-owned;
- every converted widget has `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `editable-fields.json`, and `limits.json`;
- widget validation, codebook coverage, and generated definition freshness pass;
- `/__internal/widgets/definitions`, Roma widget listing, and Roma instance creation recognize every converted widget without special casing;
- Bob compiled route returns the normal widget contract for every converted widget;
- generated `index.html` contains visible saved content before JavaScript;
- runtime does not emit or read `window.CK_WIDGET`;
- runtime does not depend on `document.currentScript`;
- two instances of the same converted widget type can initialize in one document;
- PRD 106E can place converted widgets by `instanceId` with no widget-type branch and no block/section branch.

P1 engineering gates:

- use validator-safe widget type names; prefer `imagetitle` or `mediaTitle` over risky dashed IDs unless validation deliberately supports them;
- merge Prague `cta-bottom-block` behavior into `cta` unless a distinct product need exists;
- merge `platform-strip`, `control-moat`, `global-moat`, and `steps` into a small reusable steps/value-props family when possible;
- convert `split-carousel`, `embed-carousel`, `mobile-showcase`, `feature-explorer`, and `minibob` only if they are self-contained;
- convert embedded live widget visuals through a normal `widgetInstanceRef` field when the UX is a simple dropdown;
- reuse Dieter/shared Stage, Pod, Header, and Typography primitives;
- avoid `html`, `body`, and `:root` instance behavior leakage in widget CSS;
- do not resurrect `catalog.json`.

### Senior PM Review

The product experience must stay simple:

```text
user creates a widget
user edits it in Bob
Roma owns the account instance
Tokyo saves and materializes it
Page Composer stacks that instance in a page
```

Users should not learn a second object called a block, section, or page block.

Prague names such as `global moat`, `control moat`, and `big-bang` are internal marketing concepts. They should not leak into the customer-facing widget catalog unless they map to a clear reusable customer job.

Customer-facing widget families should be plain and reusable:

```text
hero
split
cta
media title
steps / value props
card grid / link grid
carousel
demo section, only if self-contained
```

PM gates:

- every converted widget has a clear customer job;
- every converted widget has editable fields a user understands;
- every converted widget works as a standalone embed and as a placement inside a page;
- no widget depends on Prague route, locale, nav, funnel, or demo state;
- the page-shaped widget list stays small enough to be useful, not a literal mirror of Prague implementation files;
- demo-heavy surfaces such as `minibob` are deferred unless they are truly self-contained content widgets.

### Principal TPM Review

The systems boundary is:

```text
page-shaped content = widget instance
composition = page placement list
Prague nav/site chrome = Prague-owned
```

Systems must talk to each other through existing authorities:

```text
Bob edits one widget instance
Roma creates/opens/saves account instances
Tokyo stores source and submitted widget packages
Page Composer consumes coherent widget packages
Prague consumes composed page packages while keeping its own nav/routes/markets/locales
San Francisco remains the existing editable-fields/translation authority path
```

Do not invent a subsystem between these authorities.

Audit direction:

```text
convert as normal widgets:
  cta
  big-bang only if it maps to a reusable CTA/hero/conversion widget
  global-moat only if it maps to reusable value-props content

merge:
  steps, platform-strip, control-moat, global-moat -> steps/value-props family
  subpage-cards -> card-grid/link-grid family
  hero, split, split-carousel -> hero/split/media-title family when self-contained

defer or redesign:
  embed-carousel
  mobile-showcase
  minibob
  feature-explorer

keep Prague-owned:
  global nav
  Prague route/market/locale/site chrome
```

Execution sequence:

1. Finish 106A and 106B package foundation first.
2. Complete the Prague block audit matrix.
3. Implement low-risk self-contained widgets first: `cta`, `card-grid`, `steps/value-props`, `hero`, `split`.
4. Prove Bob edit, Roma create, Roma save/Tokyo package storage, and Page Composer placement without special branches.
5. Revisit demo/embed-heavy Prague blocks only after the simple widgets are proven.

### Scope Guard

Do not use this PRD to build:

- a generic section framework;
- container widgets;
- page-source widget slots;
- nested page composer behavior;
- a layout DSL;
- page-specific editor controls;
- a block library;
- a fragment manifest;
- a section publish mode;
- Prague or customer nav management.

## Non-Scope

Do not:

- build generic containers;
- build drag/drop canvas editing;
- implement page-source widget-inside-widget composition;
- create a separate section renderer;
- create a second source package type;
- convert Prague global nav into a widget;
- make Clickeen Pages manage Prague URLs/nav;
- make Clickeen Pages manage customer site nav/header/footer.

## Verification

This PRD is green when:

- every Prague content block listed in the audit has a decision: convert, merge, defer, or site-chrome keep;
- every converted page-shaped widget materializes to `index.html`, `styles.css`, and `runtime.js`;
- every converted page-shaped widget opens and edits in Bob as a normal widget;
- Roma can create every converted widget as a normal account-owned instance;
- visible text for every converted widget is covered by `editable-fields.json`;
- converted widgets can be placed in a page by PRD 106E without special handling;
- no block object, block inventory, section renderer, or second source package type is introduced;
- Prague global nav remains Prague-owned and continues to manage Prague URLs/markets/locales.
