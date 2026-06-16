# PRD106C_Prague Astro Blocks Migration To Widget Instances

Status: Execution map checkpoint - Steps 1-5 green; PRD106D not started.
Owner: Widget Core source + Bob controls + Roma save/materialization
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`
Audit: `PRD106C2_Prague astro blocks audit.md`
Series step: 6
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106C2_Prague astro blocks audit.md`
Unlocks: `PRD106C3_Split_Widget.md`, `PRD106C4_Cards_Widget.md`, `PRD106C5_BigBang_Widget.md`, `PRD106C6_CTA_Widget.md`, `../../01-Planning/112__PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md`
Authority owned by this PRD: Prague block-to-widget migration map and child PRD scope.
Authority explicitly not owned by this PRD: shared Shell extraction, Page Composer implementation, individual Widget Core implementation, Prague route cutover.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- The current step is the only execution permission.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- The goal is not to accommodate old drift. If existing code contradicts this
  PRD's intended architecture, delete it, fence it, or stop; do not preserve it
  and work around it.

## Mandatory PRD106 Execution Contract

This PRD is step-gated. Execute exactly one numbered step at a time.

Before executing any step:

1. Read `106__Umbrella__Composition_Vision.md`.
2. Confirm PRD106A2 and PRD106C2 are green or explicitly fenced.
3. Name the surviving authority for the block/widget concern being changed.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence                                      | Status   |
| ---------- | ------------------------------------------------------------ | -------- |
| PRD106A2   | `packages/widget-shell/` contract accepted or fenced.        | REQUIRED |
| PRD106C2   | Current Prague block inventory and classifications accepted. | REQUIRED |

## Current Step Gate

Current executable step:

```text
None for PRD106C. Surviving target set is confirmed by the PRD106C3 Split-family correction.
```

Green evidence:

- Target set is exactly Split-family, Cards, Big Bang, Call to Action.
- Out-of-scope Prague blocks are named and fenced/dropped.
- Existing drift widget folders were deleted as customer widget targets:
  `tokyo/product/widgets/hero`, `tokyo/product/widgets/steps`, and
  `tokyo/product/widgets/cardgrid`.
- `tokyo-worker/src/generated/widget-definition-sources.ts` now imports only
  `big-bang`, `calltoaction`, `cards`, `countdown`, `faq`, `logoshowcase`,
  `split-media`, and `split-carousel-media`. The legacy `split` target is
  deleted from product source/exposure, not kept as an alias or compatibility
  widget.
- `packages/ck-contracts/src/overlay-codebooks.ts` no longer assigns overlay
  codes to `hero`, `steps`, or `cardgrid`.
- No child PRD is asked to own Shell or Page Composer behavior.
- Split-family embedded-instance support is deferred by PRD106C3. The reserved
  future names are `split-instance` and `split-carousel-instance`, but no source
  folder, default, spec, Builder control, package payload, or migration output
  may be created until a product-owner-approved account-instance selector
  component exists. Prague `accountInstanceRef` is not preserved.

Stop conditions:

- A Prague block needs a fifth widget target.
- A child PRD needs Shell behavior not accepted by PRD106A2.
- `hero`, `steps`, or `cardgrid` remains exposed as a customer widget target
  without a deletion/fence/rename decision.
- Split embedded-instance support is treated as hidden nested behavior, as
  Prague `accountInstanceRef` compatibility, or as a mode inside one
  polymorphic `split` widget.

## Execution Steps

| Step | Action                               | Required evidence                  | Green criteria                                                | Stop condition                                 |
| ---: | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
|    1 | Confirm surviving widget target set. | Target table from C2.              | Only Split-family, Cards, Big Bang, CTA are customer targets. | New target widget needed.                      |
|    2 | Confirm shared Shell dependency.     | A2 green/fence evidence.           | Child PRDs consume Shell package.                             | Shell contract missing.                        |
|    3 | Assign Prague blocks to child PRDs.  | Mapping table.                     | Every migrated block maps to one child PRD.                   | Block spans multiple PRDs without owner.       |
|    4 | Confirm per-child scope.             | Child PRD links and scope bullets. | Each child owns Core-only controls/content.                   | Child owns Header/CTA/Stage/Pod/Page Composer. |
|    5 | Confirm migration readiness.         | Acceptance checklist.              | C3-C6 can execute one at a time.                              | Any block lacks source evidence or decision.   |

## Purpose

PRD106C migrates useful Prague Astro block work into normal Clickeen widget
software and normal account-owned widget instances.

This is not an implementation PRD for one widget. It is the execution map for
the Prague widget migration series.

The executable widget work is split into child PRDs:

| PRD                          | Widget                                                                                                                       | Absorbs Prague blocks                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `PRD106C3_Split_Widget.md`   | `split-media`, `split-carousel-media`; reserves `split-instance` and `split-carousel-instance` for later selector-gated work | `hero`, `split`, `split-carousel`; `embed-carousel` is deferred           |
| `PRD106C4_Cards_Widget.md`   | `cards`                                                                                                                      | `subpage-cards`, `steps`, `global-moat`, `platform-strip`, `control-moat` |
| `PRD106C5_BigBang_Widget.md` | `big-bang`                                                                                                                   | `big-bang`                                                                |
| `PRD106C6_CTA_Widget.md`     | `cta`                                                                                                                        | `cta-bottom-block`                                                        |

Do not execute a widget port from this umbrella alone. Execute the relevant
child PRD.

## Product Decision

The current Prague block migration creates or finishes **five** executable
customer widget types and reserves two selector-gated Split-family names:

1. `split-media`
2. `split-carousel-media`
3. `cards`
4. `big-bang`
5. `calltoaction`

Reserved, not executable in the current pass:

- `split-instance`
- `split-carousel-instance`

These are not widgets:

| Prague block | Decision                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `page-meta`  | Dies as a Prague block. Page SEO/GEO belongs to Page Composer and a dedicated SEO/GEO PRD for instances and pages.                       |
| `navmeta`    | Stays Prague navigation metadata.                                                                                                        |
| `minibob`    | Excluded from customer widget migration. May remain only as Prague admin/site-owned demo/funnel behavior, not save-capable product mode. |

Existing drift widget folders must not remain customer widget targets:

| Current folder                   | PRD106C decision                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tokyo/product/widgets/hero`     | Deleted from customer widgets. Media hero visuals are absorbed by `split-media`; embedded-widget hero visuals are deferred until selector-gated `split-instance` exists. |
| `tokyo/product/widgets/steps`    | Deleted from customer widgets. `steps` is a `cards` treatment.                                                                                                           |
| `tokyo/product/widgets/cardgrid` | Deleted from customer widgets. `cards` is the surviving widget.                                                                                                          |
| `tokyo/product/widgets/split`    | Deleted as a customer widget source/exposure. Existing account data that still names `split` is controlled cleanup input, not a reason to preserve source or aliases.    |

Current Prague `accountInstanceRef` dies. It must not be copied into migrated
widget state.

Split embedded-instance support is deferred. The only allowed future shape is
explicit Split-family widget identity: `split-instance` and
`split-carousel-instance`, after a real account-instance selector exists. It is
not a hidden mode of `split-media`, not a `split.items[].kind` variant, not a
Prague iframe assumption, not a locale override, not page-owned override
semantics, and not `accountInstanceRef` compatibility.

## How Bob Widget Controls Work

The child PRDs must be specific because Bob is not a vague form builder.

Widget controls are declared through the shared Widget Shell contract plus the
Widget Core definition. The current widget folders may still store Core source
files such as `spec.json`, but those files are repo product source, not
Tokyo-owned widget architecture.

- `defaults` defines the initial instance state.
- `editor.panels[]` defines the ToolDrawer panels Bob renders.
- Each panel has `clusters`.
- Each cluster has field nodes.
- Each field node has a control type, path, label, attrs, and optional
  `showIf`.
- Bob compiles these panels into an allowlisted `controls` list.
- User edits and AI ops can only write paths allowed by the compiled controls.

That means every migrated widget PRD must define:

- panel IDs;
- cluster names;
- control type;
- exact data path;
- content/config ownership;
- default value;
- allowed values or min/max/step where applicable;
- `showIf` behavior;
- why the control exists;
- what Prague value or layout it replaces.

If a control is not named in the child PRD, it is not part of the migration.

## Widget Shell Package Law

All four migrated widgets must consume the shared Widget Shell package defined
by `PRD106A2_WidgetShellExtraction.md`.

```text
Widget = Widget Shell + Widget Core

packages/widget-shell:
Stage
  Pod
    ck-headerLayout
      Header
      Widget Core
```

FAQ is the proof and extraction source. `PRD106A2_WidgetShellExtraction.md`
owns the extraction. `packages/widget-shell/` is the surviving authority for the
shared systems:

| Shared system         | Source of truth                         |
| --------------------- | --------------------------------------- |
| Header content        | Widget Shell package                    |
| Header layout         | Widget Shell package                    |
| Header CTA appearance | Widget Shell package                    |
| Stage/Pod layout      | Widget Shell package                    |
| Stage/Pod appearance  | Widget Shell package                    |
| Typography            | Widget Shell package                    |
| Locale selector       | Widget Shell package                    |
| Branding/settings     | Widget Shell package                    |
| Translation shell     | Widget Shell editable-field conventions |
| Runtime shell         | Widget Shell renderer/runtime helpers   |

Header has one meaning:

```text
Header = title + optional subtitle + optional CTA
```

Header paths are `header.*`; Header CTA paths are `headerCta.*`. Do not create
widget-specific `headline`, `subheadline`, `primaryCta`, `secondaryCta`,
`button`, `eyebrow`, or duplicate Header/CTA/layout paths.

For PRD106C, child PRDs define only the Widget Core:

```text
Split Media              -> splitMedia.* one image/video visual
Split Instance           -> splitInstance.* one embedded account-owned widget instance
Split Carousel Media     -> splitCarouselMedia.* 2-6 image/video visuals plus carousel behavior
Split Carousel Instance  -> splitCarouselInstance.* 2-6 embedded account-owned widget instances plus carousel behavior
Cards                    -> cards.* card/item content
BigBang                  -> bigBang.* large typography/content treatment
Calltoaction             -> calltoaction.* body/action content plus shared Shell Header/Header CTA
```

PRD106C widget execution is blocked until PRD106A2 accepts the shared Shell
contract or explicitly fences the exact same Shell contribution shape. After
that, Split, Cards, Big Bang, Call to Action, Countdown gold-standard repair, and Logo
Showcase gold-standard repair are Core work against the same shell.

Each child PRD must say which FAQ-specific content is removed, which
Widget Core is added, and which exact Core-specific controls and
editable fields exist. Layout, appearance, typography, locale, settings,
translation, and runtime shell come from `packages/widget-shell/` unless the
child PRD records an explicit product-owner exception.

## Surviving Authorities

- Shared widget architecture lives in `packages/widget-shell/`.
- Widget Core software may live in the current widget source folders during this
  execution track. Those folders are repo product source, not Tokyo service
  ownership.
- Useful starter defaults live in `spec.json.defaults` and object-manager
  `default-item` values.
- Customer-visible text lives in content paths and is declared in
  `editable-fields.json`.
- Behavior, layout, media, links, and appearance choices live in config paths.
- Bob edits one account-owned instance in one active locale.
- Roma opens/saves account-owned instances.
- Tokyo stores instance source and generated package files.
- Page Composer consumes saved/materialized instances; it does not edit the
  instances it stacks.

No migrated customer product path may depend on:

- Prague `blockId`;
- Prague `blockType`;
- Prague block registry;
- Prague route helpers;
- Prague page sections, slots, or columns;
- Prague translation paths;
- Prague `accountInstanceRef`;
- page-owned overrides of selected widget instances.

## `page-meta` And SEO/GEO

`page-meta` dies as a Prague block because SEO/GEO metadata is not visual
content and is not a widget.

Child widget PRDs may preserve semantic HTML and real customer-visible content.
They must not invent instance SEO fields, page SEO fields, structured-data
source models, schema merging, or site-level SEO objects from PRD106C.

A composed page needs one final page-level SEO/GEO result. Page Composer and a
later SEO/GEO PRD own that final output because Page Composer owns composition.

A later SEO/GEO PRD must define:

- what SEO/GEO source lives on an instance;
- what SEO/GEO source lives on a page;
- how Page Composer derives final page metadata from selected instances;
- whether a site-level parent object is needed for brand, domain, organization
  schema, market, and locale policy.

PRD106C only prevents Prague `page-meta` from becoming a fake widget.

## Prague-Only Material

`navmeta` remains Prague route/navigation metadata.

`minibob` may remain only as Prague-specific admin/site-owned demo/funnel
behavior. It is not a customer widget, account authoring surface, editor mode,
policy profile, save-capable path, or Page Composer input. If Prague needs to
inject special Clickeen-owned demo sections into marketing pages, that must be
admin/site-owned behavior, not a normal customer widget.

## Execution Sequence

1. Keep `PRD106C2` accurate as the factual block audit.
2. Fence obsolete customer widget targets before child widget execution:
   `hero`, `steps`, and unresolved `cardgrid`.
3. Execute `PRD106C3_Split_Widget.md`.
4. Execute `PRD106C4_Cards_Widget.md`.
5. Execute `PRD106C5_BigBang_Widget.md`.
6. Execute `PRD106C6_CTA_Widget.md`.
7. Delete or stop exposing any remaining obsolete partial widget targets that
   conflict with the four-widget decision.
8. Update PRD106D only after the four widgets are normal saved/materialized
   instances.

## Non-Goals

- No Page Composer implementation in PRD106C.
- No Prague block runtime in account product paths.
- No generic migration adapter.
- No hidden nested widget behavior.
- No Tokyo awareness of Prague migration.
- No standalone `steps` widget.
- No standalone `hero` widget unless Pietro reverses the current Split decision.
- No separate `global-moat`, `platform-strip`, or `control-moat` widgets.

## Acceptance

PRD106C is complete when:

- all four child PRDs exist and specify exact Bob panels/controls;
- all four child PRDs consume `packages/widget-shell/` and define only their
  Widget Core content/control deltas;
- `big-bang`, `calltoaction`, `cards`, `split-media`, and
  `split-carousel-media` are the only Prague-derived customer widget targets;
- legacy `split` is deleted from customer widget source/exposure and treated
  only as controlled account-data cleanup input;
- `hero` and `steps` are not exposed as customer widget targets;
- `cardgrid` is resolved into surviving `cards` or fenced/deleted;
- `page-meta`, `navmeta`, and `minibob` are explicitly excluded from customer
  widget migration;
- `accountInstanceRef` is excluded from all migrated widget state;
- any Split embedded-instance support is explicit PRD106C3 Core behavior or
  fenced out;
- each child PRD defines useful defaults, editable fields, control paths, and
  materialized output acceptance.
