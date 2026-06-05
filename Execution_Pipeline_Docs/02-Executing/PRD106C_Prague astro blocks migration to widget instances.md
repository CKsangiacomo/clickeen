# PRD106C_Prague Astro Blocks Migration To Widget Instances

Status: Draft execution PRD
Owner: Widget system + Bob + Roma
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`

## Purpose

Port the valuable Prague Astro block work into real Clickeen widgets and
account-owned widget instances. This is a precise migration, not a rename.

Prague blocks are source material only. They may be read during migration, but
they must not survive as runtime, registry, state, IDs, page sections, or
product nouns. The migrated product surface is widgets and widget instances.

PRD106C does not build Page Composer. It prepares widget software and widget
instance packages that Page Composer consumes under PRD106B.

## Pre-Execution Alignment

Before implementation, refresh current evidence from:

- `prague/src/lib/blockRegistry.ts`.
- `prague/src/components/WidgetBlocks.astro`.
- `prague/src/blocks/**`.
- `tokyo/prague/pages/**/*.json`.
- `tokyo/product/widgets/{hero,split,cta,steps,cardgrid}`.
- Bob compiler/control contracts.
- Bob package generation tests.
- Roma widget create/open/save paths.

Do not start from the partial ports and polish around their current shape. Start
from the intended product: a user creates a widget instance, sees useful content
immediately, edits it in Bob with meaningful controls, saves it, and receives a
standalone package that also composes cleanly into a page.

## Surviving Authorities

- Prague blocks are source material only.
- Widget software lives in `tokyo/product/widgets/{widget}/`.
- Bob edits one widget instance in one active locale at a time.
- Roma opens/saves account-owned widget instances and materializes their output.
- Tokyo stores and serves exact instance files submitted through the product
  path.
- Page Composer stacks a flat ordered list of materialized widget instances; it
  does not inherit hidden Prague blocks, nested page sections, block IDs, block
  types, or Prague layout metadata.

No durable Prague migration state may survive as product truth:

- no `blockId`;
- no `blockType`;
- no Prague block registry in account product paths;
- no Prague preset catalog as hidden authority;
- no Prague-specific Bob/Roma branch;
- no page-owned override of a migrated widget instance;
- no admin-only storage lane for real customer instances.
- no hidden or non-rendered Prague blocks as migration carriers;
- no nested section/page-section model derived from Prague;
- no generic migration registry, adapter platform, or block-to-widget runtime
  resolver.

## Migration Artifact Contract

Each migrated block must produce normal Clickeen artifacts:

- Widget software under `tokyo/product/widgets/{widget}/`:
  - `spec.json`;
  - `widget.html`;
  - `widget.css`;
  - `widget.client.js`;
  - `editable-fields.json`;
  - `limits.json`;
  - any widget-owned static media/assets.
- Normal account instance source:
  - config values for behavior, structure, style, layout, URLs, and media refs;
  - content values for every customer-visible authored string;
  - optional locale overlays for translated content.
- Generated instance package:
  - `accounts/{account}/instances/{instance}/index.html`;
  - `accounts/{account}/instances/{instance}/styles.css`;
  - `accounts/{account}/instances/{instance}/runtime.js`.

PRD106C must not introduce another source-of-truth format, registry, migration
manifest, or adapter layer between Prague source material and normal widget
instance source.

## Current State

The repo already has partial Prague-derived widgets:

| Widget | Prague source idea | Current status |
| --- | --- | --- |
| `hero` | `prague/src/blocks/hero/hero.astro` | Partial, about 50% |
| `split` | `prague/src/blocks/split/*` | Partial, about 50% |
| `cta` | `cta` / `cta-bottom-block` behavior | Partial, about 50% |
| `steps` | `steps`, `control-moat`, `global-moat`, `platform-strip` family via `StepsPrimitive` | Partial, about 50% |
| `cardgrid` | `subpage-cards` style tile grid | Partial, about 50% |

"About 50%" means the widget shell exists, Bob can compile/open it, the runtime
has some structure, and editable field contracts exist. It does **not** mean the
widget is production-ready or faithful to Prague.

The screenshot failure mode is expected for a half-port: blank defaults produce
blank instances, and generic controls expose implementation knobs that do not
yet match the intended Prague authoring experience.

Current Prague page data shows broader migration demand:

| Prague block type | Current base-page count | PRD106C disposition |
| --- | ---: | --- |
| `hero` | 12 | Existing widget port; must become faithful and useful |
| `split` | 14 | Existing widget port; must resolve live preview/media/layout behavior |
| `steps` | 6 | Existing widget port; likely absorbs moat/strip variants if product fit is real |
| `cta-bottom-block` | 5 | Existing `cta` port; must clarify CTA semantics/defaults |
| `big-bang` | 4 | Unmapped; likely hero/CTA variant or new widget by product decision |
| `platform-strip` | 3 | Likely `steps` variant unless standalone authoring value proves distinct |
| `control-moat` | 1 | Likely `steps` variant unless standalone authoring value proves distinct |
| `global-moat` | 2 | Likely `steps` variant unless standalone authoring value proves distinct |
| `subpage-cards` | 1 | Existing `cardgrid` port; must resolve link semantics |
| `minibob` | 3 | Not account authoring truth; Prague funnel/demo behavior |
| `page-meta` | 12 | PRD106B/PRD106D page metadata concern, not widget migration |
| `navmeta` | 3 | PRD106D/navigation concern, not widget migration |

There are also source components registered in Prague that do not currently
appear in the observed base page JSON counts or are not yet represented in the
table above: `split-carousel`, `embed-carousel`, `feature-explorer`, and
`mobile-showcase`. They require explicit disposition before any implementation
may inspect them as migration scope. Disposition must be existing widget,
widget variant, new approved widget, NOT_ALLOWED, or
BLOCKED_PENDING_PIETRO_DECISION.

Several Prague source components use `accountInstanceRef` to render live widget
previews inside a block. They must not be migrated as nested widgets, hidden
child blocks, or page sections. Pietro must choose static media, separate
stacked widget instances, Prague-only source that does not enter account product
truth, or a separately approved composition feature.

## What A Complete Port Requires

For every Prague block migrated:

- map the Astro props and copy shape into widget instance config/content with
  explicit path ownership;
- define useful non-empty defaults so a new instance renders real content;
- preserve layout behavior, responsive behavior, hover behavior, media behavior,
  and visual rhythm from the Astro block;
- expose only meaningful Bob controls in product language;
- map every customer-visible string to content plus `editable-fields.json` for
  translation;
- ensure the widget materializes to standalone browser-readable files;
- verify the output can be composed by Page Composer without block-aware special
  cases, nested sections, hidden blocks, page-owned overrides, or Prague registry
  lookups.

## Definition Of A Complete Widget Instance

A migrated widget is not complete until a newly created instance is useful
without manual repair.

Required default behavior:

- `spec.json.defaults` renders non-blank, publication-worthy starter content.
- Repeated defaults include enough items to show the intended layout.
- Object-manager `default-item` values create useful added items with stable IDs.
- CTA defaults are enabled when the original Prague block expects a CTA.
- Media/fill defaults demonstrate the intended visual path when the Prague block
  relies on visuals, or the visual behavior is blocked pending Pietro decision.
- Defaults use real product-language content, not placeholders like empty
  strings, lorem ipsum, or "Untitled".

Starter content authority is part of this PRD. If existing widget policy prefers
blank author-owned content for some widgets, PRD106C must either define an
approved exception for Prague-derived starter content or mark the specific
widget blocked.

## Required Port Mapping Matrix

Each widget migration must include a table before code work:

| Prague source | Target widget | Instance path | Bob control | Editable field | Behavior | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| Astro prop/copy path | widget name | `content.*` or `config.*` | control label/type | path or none | preview/publish behavior | port/fix/block/delete |

Rules:

- Customer-visible authored strings go in content.
- Behavior, style, structure, URLs, media refs, and layout choices go in config.
- Generated visible strings must be classified as authored content,
  platform-owned copy, or BLOCKED_PENDING_PIETRO_DECISION.
- No text may hide in config because it was convenient for an Astro prop.
- Page metadata changes are out of PRD106C unless the field is already approved
  by PRD106B or explicitly assigned to PRD106D by Pietro.

## Layout Mapping Work

The hard work is translating Prague layout vocabulary into Clickeen widget
controls.

Examples:

- Prague rows/grids/columns cannot become page-level columns in PRD 106.
- If `subpage-cards` has a 3-column tile layout, that belongs to the `cardgrid`
  widget's own layout controls, not to Page Composer.
- If `StepsPrimitive` has `cards` and `value-props` variants, that may become a
  widget variant control.
- If multiple blocks share a layout need, create or extend a reusable Dieter/Bob
  editor control only after the repetition is real.
- If a Prague behavior depends on page context, CTA hrefs, route locale, market,
  or nav, decide whether it becomes widget config or remains Prague-only until
  PRD106D. It must not become ad hoc page metadata in PRD106C.

Bob currently does not have a generic columns primitive. Do not invent a page
column system to solve that. Options are:

- widget-specific controls such as `columns`, `gap`, `variant`, `mediaSide`;
- a reusable Dieter/Bob layout control if at least two widgets need the same
  product behavior;
- fixed variants when author control is not yet needed;
- block the behavior pending Pietro decision if it cannot be expressed without
  new architecture.

## Bob Control UX Rules

Bob controls must model user decisions, not expose internal implementation
knobs by default.

Required control behavior:

- Prefer product-language controls such as variant, media side, card density,
  column preset, CTA style, image fit, and visual mode.
- Raw numeric controls need min/max/step/unit and mobile-safe behavior.
- Conditional controls hide when their parent feature is disabled.
- Array editors create useful items with stable IDs.
- Layout controls describe responsive behavior, not only desktop columns.
- Controls that exist only to support a Prague implementation detail are removed
  unless the same control has clear customer authoring value.

If two or more widgets need the same real authoring control, consider a reusable
Dieter/Bob control. Do not add a generic abstraction before repetition is real.

## Translation Migration

Prague translations currently target Prague block paths. A migrated widget must
move translated customer-visible strings to widget editable fields.

Acceptance for translation:

- Every visible base-locale string resolves from widget content defaults or an
  explicit platform-owned copy source.
- `editable-fields.json` covers headline, body, CTA labels, card labels, image
  alt text, repeated item text, hover text, and any other authored visible copy.
- Repeated items use stable IDs so translations survive reorder.
- Bob translated preview applies locale values to the same in-memory instance
  state that will save and publish.
- No migrated section keeps a parallel Prague translation authority.

## Asset And Media Rules

Prague static assets may be used as references. Durable migrated widgets must
use approved product/widget/account asset coordinates:

- Widget-owned media may live with widget software if it is part of the widget
  template.
- Account-authored media must use the normal account asset path.
- Prague file paths must not be stored in account widget instances unless the
  asset was intentionally promoted to widget-owned runtime media.

## Block Inventory To Map

Initial inventory from Prague:

| Prague block/source | Migration disposition |
| --- | --- |
| `hero` | Widget port exists; needs faithful defaults and layout/control review |
| `split` | Widget port exists; needs variant/media/control review |
| `cta`, `cta-bottom-block` | Widget port exists; needs CTA semantics/defaults review |
| `steps` | Widget port exists; needs `StepsPrimitive` parity |
| `control-moat` | Likely `steps` variant or separate widget only if behavior proves distinct |
| `global-moat` | Likely `steps` variant or separate widget only if behavior proves distinct |
| `platform-strip` | Likely `steps` variant or separate widget only if behavior proves distinct |
| `subpage-cards` | `cardgrid` port exists; needs real defaults and page-link semantics review |
| `split-carousel` | Unmapped |
| `embed-carousel` | Unmapped |
| `feature-explorer` | Unmapped |
| `big-bang` | Unmapped |
| `mobile-showcase` | Unmapped |
| `minibob` | Not a widget architecture source; marketing embed/funnel only |
| `page-meta` | Not a widget; PRD106B/PRD106D metadata concern |
| `navmeta` | Not a widget; PRD106D navigation concern |

A separate widget may be created only when the behavior has standalone Roma/Bob
authoring value, needs its own meaningful defaults and controls, and cannot be
cleanly represented as a variant of an existing widget. Different Prague
implementation files alone are not enough.

## Package Contribution Readiness

PRD106C widgets must be structurally ready for PRD106B:

- one stamped root;
- stable instance identity;
- dedupe-able CSS/runtime module markers;
- runtime payload keyed by instance identity;
- no singleton global state that assumes only one instance on the document;
- visible failure for malformed output.

This does not mean the widget must be standalone published before Page Composer
can consume it. PRD106B owns the exact readiness rule.

## Non-Goals

- Do not migrate Prague blocks into a new product noun.
- Do not create page sections, slots, or layout columns in Page Composer.
- Do not create hidden blocks, nested page sections, generic migration
  platforms, or page-level columns/layout unless Pietro separately approves that
  product decision.
- Do not make Tokyo aware of Prague block/layout migration.
- Do not call a widget complete because it compiles in Bob.
- Do not migrate Prague nav, route, locale, or page metadata semantics into
  widget config unless the behavior belongs to a standalone widget instance.
- Do not preserve Prague `accountInstanceRef` as nested-widget behavior unless
  the product explicitly approves it.

## Implementation Sequence

1. Generate the actual Prague block inventory from `tokyo/prague/pages`.
2. Decide approved widget migration scope.
3. For each scoped block, write the port mapping matrix.
4. Decide whether each block maps to an existing widget, a variant, a new
   widget, NOT_ALLOWED, or BLOCKED_PENDING_PIETRO_DECISION.
5. Fix existing partial ports before adding more ports.
6. Replace empty defaults with useful starter instances.
7. Replace generic/low-level Bob controls with product-language controls.
8. Move visible strings into content/editable fields and remove Prague
   translation truth for migrated sections.
9. Validate saved package structure against PRD106B contribution needs.
10. Only then may PRD106D/PRD106B compose materialized widget instances from
    approved migrated widget packages.

## Blast Radius

Expected touched areas:

- `tokyo/product/widgets/{hero,split,cta,steps,cardgrid}` and any new widget
  directories approved by this PRD.
- Widget `spec.json`, `editable-fields.json`, `limits.json`, `widget.html`,
  `widget.css`, and `widget.client.js`.
- Shared widget runtime and appearance helpers only when repetition proves a
  real shared need.
- Bob compiler/control tests for migrated widget controls.
- Bob package generation tests for migrated widgets.
- Roma widget create/open/save/materialize paths.
- Tokyo widget definition validation tests.
- Prague block/page data only as migration reference or PRD106D preparation.
- Translation fixtures and locale-overlay tests.

Do not edit Page Composer behavior in PRD106C except to keep package contracts
aligned with PRD106B.

## Adopted Peer Review Constraints

The peer review's migration feedback is accepted:

- Do not turn every Prague block into a widget. A new widget exists only when it
  has standalone Roma/Bob authoring value, meaningful defaults, meaningful
  controls, and cannot be represented as a variant of an existing widget.
- PRD106C should focus on completing the current partial ports unless Pietro
  approves another widget migration scope: `hero`, `split`, `cta`, `steps`, and
  `cardgrid`.
- The required mapping matrix is per-widget/per-scope. Do not create a giant
  universal paperwork exercise before fixing the scoped widgets.
- Visual parity is practical, not academic: desktop and mobile for a canonical
  fixture, base locale plus at least one translated fixture where available, no
  blank default state, and package behavior when duplicate instances appear on
  one composed page.
- `page-meta` and `navmeta` are not widgets. They belong to PRD106B/PRD106D
  page/route metadata decisions.
- Nested `accountInstanceRef` behavior is not smuggled into widgets. It must be
  approved as static media, separate stacked instances, Prague-only source that
  does not enter account product truth, or a separately approved composition
  feature.
- Prague source paths must not survive in account instance state unless the
  asset is intentionally promoted to widget-owned media.

The accepted migration posture is: make normal widgets useful, translatable,
materialized, and composable. Do not build a migration runtime.

## Acceptance

For each migrated widget:

- creating a new instance renders useful content immediately;
- Bob controls are understandable and map to real widget behavior;
- preview, saved package output, standalone published output, and Page Composer
  output visually match the intended Prague block class within the approved
  parity bar;
- translation fields match all authored content and no Prague translation truth
  remains for migrated sections;
- the widget can be saved and materialized into browser-readable files;
- standalone publish works when standalone publish state allows it;
- Page Composer can consume the materialized package under PRD106B readiness
  rules;
- no Prague-only product branch is required for the widget to work.

## Verification

- Inventory script/test records all Prague source material and approved
  disposition.
- Per-widget migration matrix reviewed before implementation.
- Widget definition tests reject blank starter defaults for migrated widgets
  unless an explicit product exception exists.
- Bob control tests assert product-language controls, conditional visibility,
  bounded numeric controls, array item creation, and stable IDs.
- Runtime smoke tests render each migrated widget in Bob preview and from saved
  `index.html/styles.css/runtime.js`.
- Visual parity checks cover desktop and mobile against Prague references.
- Translation tests cover base locale plus at least one non-English locale and
  one RTL or non-Latin locale where fixtures exist.
- Package contribution tests prove each migrated widget can appear more than
  once on a composed page without CSS/runtime collisions.
- Each scoped migrated widget gets a duplicate-instance composition test before
  being called complete.
- Search tests or code review gates confirm no account product path depends on
  Prague block registry, block IDs, or block types.
