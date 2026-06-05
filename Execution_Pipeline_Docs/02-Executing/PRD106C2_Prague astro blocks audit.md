# PRD106C2_Prague Astro Blocks Audit

Status: Companion audit for `PRD106C_Prague astro blocks migration to widget instances.md`
Date: 2026-06-05
Purpose: keep the Prague block inventory factual while PRD106C stays simple.
Series step: 5
Depends on: `106__Umbrella__Composition_Vision.md`
Unlocks: `PRD106C_Prague astro blocks migration to widget instances.md`
Authority owned by this PRD: factual Prague block inventory and block-to-target classification.
Authority explicitly not owned by this PRD: widget implementation, Page Composer, Widget Shell extraction, Prague route cutover.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- The current step is the only execution permission.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.

## Mandatory PRD106 Execution Contract

This PRD is step-gated. Execute exactly one numbered step at a time.

Before executing any step:

1. Read `106__Umbrella__Composition_Vision.md`.
2. Refresh current Prague source evidence with exact commands.
3. Classify only what exists in Prague source.
4. Do not invent new widgets, blocks, or migration targets.

A step is green only when its named source evidence exists. A blocker report is
evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| Umbrella | Product tenets and authority table are current. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Refresh Prague block inventory.
```

Required evidence before marking green:

- Current block registry evidence.
- Current renderer switch evidence.
- Current page JSON type counts.

Stop conditions:

- Prague source cannot be read.
- A block target is ambiguous without product-owner decision.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Refresh Prague block inventory. | Commands and counts from Prague source. | Every used block type is listed. | Source evidence is stale/missing. |
| 2 | Classify each block. | Table mapping block to widget/Prague-only/dies. | Every block has one classification. | Classification needs product decision. |
| 3 | Map approved blocks to target widgets. | Mapping table. | Only Split, Cards, Big Bang, CTA remain customer widget targets. | New target widget is invented. |
| 4 | Record source-to-widget field hints. | Field mapping table. | Prague source informs body fields only. | Prague block architecture survives as product truth. |
| 5 | Run audit guards. | `rg`/command output. | No unmapped used block remains. | Any used block lacks disposition. |

## Audit Rule

The audit answers one question for every Prague block:

> Does this block become one of the four migrated widgets, stay Prague-only, or
> die as a Prague product concept?

Prague source may inform widget layout, copy, defaults, and controls. Prague
source must not survive as account product architecture.

## Evidence Files

| Surface | File(s) |
| --- | --- |
| Block registry | `prague/src/lib/blockRegistry.ts` |
| Block renderer switch | `prague/src/components/WidgetBlocks.astro` |
| Block implementations | `prague/src/blocks/**` |
| Shared card/step rendering | `prague/src/components/StepsPrimitive.astro` |
| Current page source | `tokyo/prague/pages/**/*.json` |
| Shared Widget Shell target | `packages/widget-shell/**` |
| Current widget source/body folders | `tokyo/product/widgets/**` |

## Current Prague Block Usage

Counts are from current first-party Prague page JSON under
`tokyo/prague/pages/**/*.json`.

| Block type | Count | Current use |
| --- | ---: | --- |
| `split` | 14 | Split copy/visual sections across Countdown and FAQ pages |
| `hero` | 12 | Top split-style page hero sections |
| `page-meta` | 12 | Nonvisual page metadata |
| `steps` | 6 | Card/step value sections |
| `cta-bottom-block` | 5 | Bottom CTA sections |
| `big-bang` | 4 | Large typography bands |
| `minibob` | 3 | Prague demo/live-preview sections |
| `navmeta` | 3 | Prague navigation metadata |
| `platform-strip` | 3 | Card/value sections |
| `global-moat` | 2 | Card/value sections |
| `control-moat` | 1 | Card/value section |
| `subpage-cards` | 1 | Linked card section |

## Registered But Not Used In First-Party Page JSON

These are registered/renderable source components, but they are not present in
the current first-party page JSON counts.

| Block type | Source |
| --- | --- |
| `split-carousel` | `prague/src/blocks/split-carousel/SplitCarousel.astro` |
| `embed-carousel` | `prague/src/blocks/embed-carousel/embed-carousel.astro` |
| `mobile-showcase` | `prague/src/blocks/mobile-showcase/mobile-showcase.astro` |
| `feature-explorer` | `prague/src/blocks/feature-explorer/feature-explorer.astro` |

They are not part of the four-widget migration unless Pietro separately assigns
them to a product widget decision.

## Final Migration Decision

| Prague block | Decision | Target PRD |
| --- | --- | --- |
| `hero` | Migrate as Split | `PRD106C3_Split_Widget.md` |
| `split` | Migrate as Split | `PRD106C3_Split_Widget.md` |
| `subpage-cards` | Migrate as Cards | `PRD106C4_Cards_Widget.md` |
| `steps` | Migrate as Cards treatment | `PRD106C4_Cards_Widget.md` |
| `global-moat` | Migrate as Cards content/treatment | `PRD106C4_Cards_Widget.md` |
| `platform-strip` | Migrate as Cards content/treatment | `PRD106C4_Cards_Widget.md` |
| `control-moat` | Migrate as Cards content/treatment | `PRD106C4_Cards_Widget.md` |
| `big-bang` | Migrate as Big Bang | `PRD106C5_BigBang_Widget.md` |
| `cta-bottom-block` | Migrate as CTA | `PRD106C6_CTA_Widget.md` |
| `page-meta` | Dies as Prague block | Page Composer SEO/GEO PRD |
| `navmeta` | Stays Prague navigation metadata | Prague route/nav system |
| `minibob` | Stays Prague/admin-only demo behavior | Prague/admin-only mechanism |
| `split-carousel` | Not in current migration | Separate product decision required |
| `embed-carousel` | Not in current migration | Separate product decision required |
| `mobile-showcase` | Not in current migration | Separate product decision required |
| `feature-explorer` | Not in current migration | Separate product decision required |

## FAQ Overview Example

The FAQ overview page currently stacks these blocks:

| Order | Block | What it looks like | Migration result |
| ---: | --- | --- | --- |
| 1 | `page-meta` | SEO title/description | Dies into Page Composer SEO/GEO |
| 2 | `hero` | Left copy/CTA, right live widget preview | Split |
| 3 | `navmeta` | Navigation label/description | Prague nav metadata |
| 4 | `minibob` | Prague demo section with live embedded instance | Prague/admin-only |
| 5 | `subpage-cards` | Header plus three linked cards | Cards |
| 6 | `steps` | Header plus three value cards | Cards treatment |
| 7 | `split` | Left copy/CTA, right visual/live preview | Split |
| 8 | `big-bang` | Large typography band | Big Bang |
| 9 | `global-moat` | Header plus three cards | Cards |
| 10 | `platform-strip` | Header plus three cards | Cards |
| 11 | `cta-bottom-block` | Centered CTA section | CTA |

This example proves why the migration is four widgets, not eleven widgets.

## Block Notes

### `page-meta`

Current values: `copy.title`, `copy.description`.

Decision: delete as a Prague block/product concept. Page-level SEO/GEO belongs
to Page Composer and the dedicated SEO/GEO PRD for instances and pages.

Possible future site-level defaults such as brand, domain, organization schema,
market, and locale policy belong to a site/account parent decision, not to
Prague blocks and not to widget instances.

### `hero`

Current layout: split section with copy/CTA on one side and a widget visual on
the other.

Decision: migrate into Split.

Do not keep a separate Hero widget only because Prague named this block `hero`.
The product behavior is Split with a first-section/hero typography treatment.

Delete Prague `accountInstanceRef` from the migrated product model.

### `navmeta`

Current values: `copy.title`, `copy.description`.

Decision: keep in Prague navigation/route metadata. Do not migrate to Bob or
Page Composer as widget content.

### `minibob`

Current layout: Prague marketing/demo copy plus an embedded account instance.

Decision: Prague/admin-only. Not a customer widget.

If Prague needs special demo injection, define it as an admin/site-owned
Prague mechanism. Do not turn it into a normal account widget.

### `subpage-cards`

Current layout: section heading/subhead plus three linked cards.

Decision: migrate into Cards.

The card widget may support links/CTAs, but it must not depend on Prague route
helpers, market, locale, or fixed subpage names.

### `steps`

Current layout: section heading/subhead plus repeated card-like items.

Decision: migrate into Cards as a steps treatment.

No standalone Steps widget in this migration.

### `split`

Current layout: split copy/CTA plus visual area.

Decision: migrate into Split.

The visual area may support image/media now. Embedded instance support requires
a separate core widget-inside-widget product feature.

### `big-bang`

Current layout: high-emphasis typography band with a large statement,
supporting copy, and shared Header CTA.

Decision: migrate into Big Bang.

This is a real widget because its value is the typography/layout treatment.

### `global-moat`, `platform-strip`, `control-moat`

Current layout: card/value sections with different content.

Decision: migrate into Cards. They are not separate widgets.

### `cta-bottom-block`

Current layout: centered CTA section.

Decision: migrate into CTA.

The word "bottom" is page placement, not widget identity.

## Bob Mapping

| Prague value | Widget destination |
| --- | --- |
| `headline`, `title`, `heading` | `header.title` for Widget Shell Header copy; Prague Big Bang statement maps to `bigBang.statement`. |
| `subheadline`, `subhead`, `body` | `header.subtitleHtml` for Widget Shell Header copy; `bigBang.supportingCopy` for Big Bang content; `items[].body` for card supporting copy. |
| `items[].title` | Repeated item content with stable item identity. |
| `items[].body` | Repeated item supporting copy with stable item identity. |
| `items[].iconName` | Repeated item config |
| `items[].imagePath`, `visual.image` | Widget/account media config after asset promotion |
| `items[].imageAlt` | Content if authored alt text is exposed |
| `primaryCta.label`, `secondaryCta.label` | `cta.label` through the shared Header CTA. |
| `primaryCta.href`, `secondaryCta.href`, card links | `cta.href` or card `items[].href` config. |
| `layout` | Product-labeled config, not raw Prague enum if unclear |
| `market`, `locale`, `resolvePragueHref` | Prague route context; not widget truth |
| `page-meta.copy.*` | Page Composer SEO/GEO concern |
| `navmeta.copy.*` | Prague navigation concern |
| `accountInstanceRef`, `accountPublicId`, `instanceId` | Delete from this migration |

## Verification Commands

| Purpose | Command |
| --- | --- |
| Page JSON type counts | `find tokyo/prague/pages -type f -name "*.json" \| xargs grep -hoE '"type"[[:space:]]*:[[:space:]]*"[^"]+"' \| sort \| uniq -c` |
| Block files | `find prague/src/blocks -type f -name "*.astro" \| sort` |
| Renderer cases | `grep -n "case '" prague/src/components/WidgetBlocks.astro` |
| Registry contracts | `sed -n '35,180p' prague/src/lib/blockRegistry.ts` |
| Shared shell target | `packages/widget-shell` |
| Current widget body/source targets | `find tokyo/product/widgets -maxdepth 1 -mindepth 1 -type d \| sort` |

## Acceptance

- Every used Prague block is listed.
- The four widget targets are clear: Split, Cards, Big Bang, CTA.
- `steps` is Cards treatment, not a standalone widget.
- `global-moat`, `platform-strip`, and `control-moat` are Cards content/treatments,
  not widgets.
- `page-meta` dies into Page Composer SEO/GEO work.
- `navmeta` remains Prague navigation metadata.
- `minibob` remains Prague/admin-only demo behavior.
- Prague `accountInstanceRef` is not migrated.
