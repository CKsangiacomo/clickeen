# PRD106B_PageComposer

Status: Draft execution PRD
Owner: Roma
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`
Series step: 4
Depends on: `PRD106A_realignment.md`, `PRD106A2_WidgetShellExtraction.md`
Unlocks: `PRD106D_Prague migration from astro blocks to Page composer.md`
Authority owned by this PRD: Roma Page Composer, page source, page publish/serve-state intent, affected-page recomposition, page UX.
Authority explicitly not owned by this PRD: Widget Shell extraction, Widget Core design, Prague block inventory, Tokyo product logic.

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
2. Confirm dependencies are green or explicitly fenced.
3. Name the surviving authority for the concern being changed.
4. Refresh required `file:line` evidence.
5. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

If this PRD conflicts with a sibling PRD, the umbrella authority table decides.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A | Service-boundary drift affecting pages is audited/fenced. | REQUIRED |
| PRD106A2 | Shared Widget Shell package contribution shape is accepted or fenced. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Define page storage, source, and serve-state contracts.
```

Required evidence before marking green:

- Page source schema is named.
- Page output/serve-state coordinates are named.
- Storage identity uses `accountPublicId`, not private account UUID or generic
  `{account}`.
- `documentation/architecture/CONTEXT.md` and service docs either match the
  accepted page coordinates or carry an explicit temporary fence/delete gate.
- Tokyo payload contract is storage-only.

Stop conditions:

- Tokyo must interpret page source or compose page output.
- Page source needs page-specific instance edits or snapshots.
- Both `website/pages` and `pages/{pageId}` are described as current product truth.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Define page storage, source, and serve-state contracts. | Schema/coordinate diff or doc evidence. | Page source/output/serve-state are explicit and storage-only in Tokyo. | Tokyo interprets page source. |
| 2 | Implement Roma Page Composer UX skeleton. | UI diff/screenshot. | User can create/open page composer without editing instances. | UI edits instance content. |
| 3 | Implement Add Instances bulk flow. | UI diff/screenshot. | Large account can bulk-select saved instances and add them. | Dropdown-only picker or hidden search dependency. |
| 4 | Implement save/draft composition. | Code diff/tests. | Page draft saves ordered instance refs and materialized output. | Missing instance package is silently healed. |
| 5 | Implement publish/unpublish/copy. | Code diff/tests. | Publish gates match widget publish model; Copy uses existing embed/public model. | New page `embed.js` is generated. |
| 6 | Implement affected-page recomposition on instance save. | Tests/log evidence. | Editing an included instance updates affected pages. | Dependency truth lives in Tokyo. |
| 7 | Add SEO/GEO and localization controls specified here. | Tests/screenshot. | Crawlable initial HTML and page localization rules exist. | Host-nav integration is invented. |
| 8 | Run deletion/search guards. | `rg` output/tests. | No Tokyo composition/readiness/page `embed.js` authority remains. | Any forbidden authority remains active. |

## Purpose

Build the Page Composer workflow as the Roma-owned materializer that turns X
saved widget instances into one browser-readable page package:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
accounts/{accountPublicId}/pages/{pageId}/index.html
accounts/{accountPublicId}/pages/{pageId}/styles.css
accounts/{accountPublicId}/pages/{pageId}/runtime.js
accounts/{accountPublicId}/pages/{pageId}/serve-state.json
```

The product noun is page. Page Composer is the Roma workflow that owns page
composition, recomposition, publish/unpublish intent, and copied public
coordinates. Tokyo only stores and serves the exact files Roma submits.

This PRD is intentionally small in product shape. It is not a website builder,
site map, block system, layout engine, or page editor. It stacks existing
widget instances.

## Pre-Execution Alignment

This PRD must execute after PRD106A has removed or fenced the fake page
architecture enough that Roma can be the surviving authority for page product
truth.

Before implementation starts, engineers must refresh current file:line evidence
for:

- Roma Pages UI and APIs.
- Roma instance save and affected-page recomposition path.
- Roma page package composer.
- Tokyo page routes, keys, tests, and `clk.live` serving.
- Bob widget package output contract.

Existing callers are not proof that a concept belongs. If current code stores
page source, dependency indexes, publish readiness, generated embed files, or
composition decisions in Tokyo, that code is drift unless PRD106B explicitly
keeps it as dumb storage.

## Product Rule

A page arranges existing widget instances. It never edits, forks, snapshots, or
overrides those instances. If a user edits an instance, they open that instance
in Bob, save it, and Roma recomposes every page that uses it.

The WordPress mental model is the product truth:

1. A user creates and saves a widget instance in Clickeen.
2. They copy one embed line into a WordPress div and WordPress shows that one
   instance.
3. Later, they create a page in Roma by stacking several saved instances.
4. They copy one page embed line into the same WordPress div and WordPress shows
   all included instances, stacked in order.
5. Later, they edit any included instance in Bob and save it.
6. The same WordPress embed now shows the page with that instance updated.

The page must work this way because the widget instance remains atomic. A page
references the current materialized instance output; it does not create a new
editable copy of that instance.

## Intended Product Architecture

### Surviving Authorities

- Bob owns editing one widget instance in one active locale at a time.
- Roma owns account product workflows, including Widgets, Builder host, Pages,
  Page Composer, page source, page dependency knowledge, and recomposition.
- Tokyo stores and serves exact bytes submitted by Roma.
- The active `clk.live` public serving boundary serves stored public files; it
  does not derive page product truth.
- Prague is not account authoring truth and does not own pages.

### Allowed Page Source

The approved PRD106B page source may contain only:

- `pageId`.
- Display name/title.
- Ordered references to account-owned widget instances.
- Approved page-level metadata fields needed for SEO/GEO.
- Approved page-level localization settings.
- Timestamps and version fields needed for optimistic concurrency.

The approved PRD106B page source must not contain:

- Widget instance config, content, editor controls, or locale payloads.
- HTML/CSS/runtime snapshots copied out of an instance. Roma may read current
  materialized instance files only as composition input.
- Per-page overrides for an instance.
- Forks, variants, editable instance state, copied instance package snapshots,
  slots, blocks, sections, columns, layout wrappers, route maps, navigation,
  site settings, or page-owned component trees.
- Dependency reason strings, readiness decisions, dedupe plans, or SEO/GEO
  generation logic submitted to Tokyo as product meaning.

### Storage Contract

The canonical page storage shape for PRD106B mirrors widget instances: account
source and generated output live together under the page folder.

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
accounts/{accountPublicId}/pages/{pageId}/index.html
accounts/{accountPublicId}/pages/{pageId}/styles.css
accounts/{accountPublicId}/pages/{pageId}/runtime.js
accounts/{accountPublicId}/pages/{pageId}/serve-state.json
```

Current code and CONTEXT may still describe `website/pages/{page}` and
`website/publishes/{page}`. PRD106B must not paper over that conflict. Execution
must migrate away from those old coordinates or temporarily fence them with
tests and a delete gate while callers move.

Step 1 is not green while architecture/service docs teach the old
`accounts/{accountPublicId}/website/pages/**`,
`accounts/{accountPublicId}/website/publishes/**`, or placement-index paths as
current product truth.

Roma may use Tokyo to store dumb page-related objects only when Tokyo treats
them as opaque bytes. Tokyo may store page source and serve-state files, but it
must not create, interpret, validate, update, summarize, or derive product
meaning from them.

### Tokyo Payload Contract

Roma submits:

- Final `index.html`, `styles.css`, and `runtime.js` bytes.
- `source.json` bytes for page composition source.
- `serve-state.json` bytes for public serving state.

Tokyo may validate only:

- Account/path authorization.
- Object names and content types are allowlisted.
- Object size limits.
- Required generated files exist for public serving.

Tokyo must not validate selected instances, compute dependency indexes, decide
page readiness, dedupe files, generate SEO/GEO output, generate a page
`embed.js`, choose copy/embed artifacts, interpret recomposition state, or
compose page packages.

### Exact Page JSON Contracts

Step 1 must define these contracts before implementation. Field names may be
adjusted only to match existing repo conventions, not to add new product nouns.

`source.json`:

```json
{
  "schemaVersion": 1,
  "pageId": "PAGEID",
  "accountPublicId": "ACCOUNTID",
  "displayName": "Landing page",
  "metadata": {
    "title": "Page title",
    "description": "Page description",
    "robots": "index,follow",
    "canonicalUrl": "https://example.com/page"
  },
  "localization": {
    "defaultLocale": "en",
    "ipLocalizationEnabled": false,
    "countryLocaleRules": [],
    "languageSwitcherEnabled": false,
    "missingLocaleBehavior": "block_publish"
  },
  "placements": [
    {
      "placementId": "P1",
      "instanceId": "INSTANCEID"
    }
  ],
  "version": 1,
  "updatedAt": "ISO-8601"
}
```

`serve-state.json`:

```json
{
  "schemaVersion": 1,
  "pageId": "PAGEID",
  "accountPublicId": "ACCOUNTID",
  "state": "unpublished",
  "publishedAt": null,
  "updatedAt": "ISO-8601"
}
```

Roma-owned page status, stored either inside Roma-managed account page metadata
or as opaque Roma-managed page state, may use only:

```text
draft | published | recomposing | stale | failed
```

Derived dependency metadata is not Tokyo truth. If persisted for fast lookup, it
is Roma-owned and rebuildable from page `source.json` plus materialized package
dependency declarations:

Widget materialized packages may declare embedded widget-instance dependencies
using this Roma-owned package metadata shape. The field belongs to the
materialized package contract consumed by Roma/Page Composer; Tokyo stores it
only as opaque bytes when it appears in package metadata.

```json
{
  "schemaVersion": 1,
  "accountPublicId": "ACCOUNTID",
  "instanceId": "PARENT_INSTANCEID",
  "dependencies": {
    "instances": [
      {
        "instanceId": "CHILD_INSTANCEID",
        "path": "core.items[0].instance.instanceId"
      }
    ]
  },
  "updatedAt": "ISO-8601"
}
```

The `path` is for diagnostics and repair only. It must not become a product
graph, page-owned override, readiness reason store, or Tokyo-interpreted
contract.

```json
{
  "schemaVersion": 1,
  "accountPublicId": "ACCOUNTID",
  "instanceId": "INSTANCEID",
  "pageIds": ["PAGEID"],
  "updatedAt": "ISO-8601"
}
```

Do not add page route maps, site settings, block trees, page-owned instance
config/content, readiness reasons, or dependency graph objects to these
contracts.

## Roma Owns

- Page create/list/rename/delete/publish/unpublish UI.
- Selected instance list and order.
- Dependency knowledge: which pages use which instances.
- Recomposition after an included instance changes.
- Fetching current materialized widget instance files.
- Producing one page HTML file, one CSS file, and one runtime file.
- Deduping shared Dieter/runtime/CSS contributions.
- Keeping per-instance runtime state isolated.
- SEO/GEO output: real initial HTML, ordered semantic sections, title,
  description, canonical, and robots.
- Page-level localization settings: IP/country locale routing, default locale,
  missing-locale behavior, and optional Clickeen-owned language switcher.
- Visible failure when a selected instance is missing, unowned, invalid, stale,
  not materialized, malformed, or not allowed by policy.

## Tokyo Does Not Own

- Selected instance lists.
- Page source.
- Dependency graphs.
- Recomposition triggers.
- CSS/runtime dedupe.
- SEO/GEO generation.
- Readiness semantics.
- Product policy.
- Page composition.

Tokyo stores and serves exact files Roma submits.

## Page Localization Contract

Clickeen is global by default. Pages must inherit the existing instance
localization model instead of creating a second translation system.

The page-level product rule is:

```text
one composed page -> one resolved locale context -> all included instances render in that locale
```

Page Composer does not translate, edit, fork, or own per-instance locale truth.
Each included instance remains the source of its own locale outputs. Page
Composer only decides which locale context the composed page should serve and
coordinates that locale across the ordered instance stack.

For PRD106B, Clickeen pages support:

- IP/country localization: visitor country resolves to a configured page locale.
- Account/page default locale when no country rule matches.
- Optional Clickeen-owned language switcher at the top of the composed page.
- Manual internal integration for Clickeen's own Prague/site language switcher,
  because Clickeen controls that site and can wire its own chrome to its own
  embedded pages.

For PRD106B, Clickeen pages do not require customer host-nav integration.
Customer websites, WordPress themes, and third-party nav controls are outside
Clickeen's control. Asking normal users to wire JavaScript from their site nav
to a Clickeen page is not the product path.

Locale resolution for a public page is:

1. Visitor-selected locale from the Clickeen page language switcher, when the
   switcher is enabled and the visitor has selected a supported locale.
2. IP/country locale rule, when IP localization is enabled and a rule matches.
3. Page default locale.
4. Account default locale only when the page default is missing or invalid.

Localized public output must not require Tokyo to understand page source. Roma
owns locale resolution settings and materializes any locale-specific page
artifacts needed for crawlable output. The minimal PRD106B artifact strategy is:

```text
accounts/{accountPublicId}/pages/{pageId}/index.html              # default locale
accounts/{accountPublicId}/pages/{pageId}/styles.css
accounts/{accountPublicId}/pages/{pageId}/runtime.js
accounts/{accountPublicId}/pages/{pageId}/locales/{locale}/index.html
```

`styles.css` and `runtime.js` remain shared for the page unless Roma proves a
locale needs different bytes. The optional top language switcher links to the
materialized locale URL or toggles among Roma-authored locale artifacts. IP to
country routing may be implemented only in the public serving boundary as a
storage selection from already-materialized locale files using Roma-authored
opaque config; it must not parse page `source.json`, validate selected
instances, generate localized output, or decide product readiness at request
time. If that serving-boundary selection cannot be implemented without product
logic, IP localization is fenced and Step 7 ships default-locale plus optional
top language switcher only.

If the resolved page locale is unavailable for an included instance, Page
Composer must not silently produce a mixed-language page as if it were correct.
Roma must surface this before publish and choose one explicit product behavior:
block publish for that locale, or use the approved fallback locale with a visible
warning. The default execution posture for PRD106B is to block publish for a
configured locale when any included instance cannot render that locale.

## Intended Product UX

### Roma Pages Flow

PRD106B Pages UX must support:

- Create page.
- Name/rename page.
- Add existing saved widget instances through a bulk-selection surface.
- Show the selected stack in order.
- Reorder selected instances.
- Remove selected instances from the page.
- Save draft.
- Publish.
- Copy stable public URL and/or embed line.
- Unpublish.
- Delete page.

The composer surface may be simple. It must not present a page as an editable
canvas where the user edits instance content. To edit content, the user opens
the instance in Bob.

### Page Composer Surface

The Page Composer screen is the page stack manager. It shows:

- page name/title;
- page status;
- primary actions: save draft, publish/unpublish, copy, delete;
- selected instance stack in page order;
- per-selected-instance status badges for widget type, publish state,
  materialization/readiness, stale/failed impact, and whether it blocks publish;
- per-selected-instance actions: move up, move down, remove, edit instance.

Reordering happens in the composer after instances are added. The required
controls are move up/down buttons. Drag-and-drop may be added only as an
enhancement, not as the only reorder mechanism.

Removing an instance removes only the page reference. It does not delete,
unpublish, duplicate, fork, snapshot, or modify the widget instance.

### Page Settings Surface

Page localization controls live in Page Composer, not in Tokyo and not in the
customer's host website. The intended UX is a simple `Settings` panel or tab on
the Page Composer screen beside the instance stack.

Required controls:

- `Default locale`: the locale used when no IP/country rule matches.
- `IP localization`: on/off.
- `Country language rules`: a compact table of country -> locale rows, using
  only locales available to the account/page.
- `Language switcher`: on/off.
- `Language switcher position`: top of composed page. PRD106B does not add
  alternate placements.
- `Missing locale behavior`: block publish when a selected locale is missing
  from any included instance. Any fallback behavior requires explicit product
  approval because mixed-language output can damage trust and SEO/GEO.

The switcher, when enabled, controls the composed page locale as a whole. It is
not a per-instance selector repeated inside every widget. Selecting Italian
switches the page context to Italian, and every included instance renders its
Italian output if available.

The settings surface must show readiness impact:

- country rules whose target locale is missing from one or more included
  instances;
- whether the page can publish for each configured locale;
- which included instances block a configured locale;
- the current default locale and whether every selected instance can render it.

The language switcher is a Clickeen-owned control rendered at the top of the
composed page only when enabled. It solves the customer-facing manual override
case without requiring the customer's WordPress/site nav to know about Clickeen.

### Add Instances UX

`Add instances` opens a large modal or drawer. It must not be a dropdown.

The Add Instances surface lists existing account-owned widget instances in a
scannable table/list with checkboxes. The required row data is:

- checkbox;
- instance name;
- widget name/type;
- publish state;
- materialization/readiness state;
- updated timestamp when available.

The primary action is `Add selected`. The user may select multiple instances and
add them in one click. Selected instances are appended to the page stack in the
visible list order. After adding, the user returns to the composer and can
reorder/remove normally.

Required picker behavior:

- already-selected instances are shown as already selected or disabled;
- unmaterialized instances are disabled with a clear reason to open Builder and
  save first;
- unpublished-but-materialized instances can be selected but are marked as
  blocking publish;
- the picker does not create, edit, delete, duplicate, publish, or unpublish
  instances;
- the picker does not write page source until the user confirms `Add selected`;
- pagination or incremental loading is required so Tier 4 accounts with many
  instances are usable.

Search and filters are optional enhancements, not required for PRD106B. Bulk
selection and one-click `Add selected` are required.

### User-Visible States

Roma must expose states that match what the system can actually do:

- `draft`: page source exists but is not publicly served.
- `published`: public serving is enabled and generated files are current.
- `recomposing`: Roma is rebuilding generated page files after page or instance
  changes.
- `stale`: an included instance changed, but the public page still points at the
  last successful package.
- `failed`: recomposition failed and requires user-visible retry or correction.
- `missing-input`: an included instance is deleted, unowned, not materialized,
  malformed, or otherwise unavailable.

The UI must make action availability clear:

- Copy public URL/embed is enabled only when the page has a public serving
  coordinate.
- Publish is blocked when required inputs are missing or invalid.
- Retry is available after recomposition failure.
- Delete/unpublish behavior must not silently leave a stale public page.

Page publish state works exactly like widget publish state:

- `unpublished`: generated files may exist, but public serving is disabled.
- `published`: public serving is enabled when generated files exist and the
  page passes Roma publish checks.

`serve-state.json` stores the public serving gate. Roma owns publish/unpublish
intent and submitted state. Tokyo stores the bytes and `clk.live` uses them to
serve or not serve already-stored files.

### Instance Update UX

When a user saves an instance in Bob, the widget save remains the primary user
action. Roma then finds all pages using that instance and recomposes them.

If widget save succeeds but recomposition fails, Roma must not pretend the page
is current. The affected page appears as stale or failed with a retry path. The
old public page may continue serving the last successful package until a new
package succeeds, but the Roma UI must show the mismatch.

## Composer Input Readiness

A page can include only an account-owned widget instance that has a valid
materialized package available to Roma:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
```

Creating a new instance and immediately placing it on a page is allowed only if
that instance has already been materialized by the same widget package pipeline
Bob uses for preview/public output. Otherwise the UI must send the user to
Builder to save the instance before the page can publish.

Standalone instance publish status is not the same as composition readiness.
Page Composer may use unpublished-but-materialized instances while the page is
draft. Publishing a page is blocked if any included instance is unpublished,
because page publish would publicly expose that instance through the page.

## Widget Package Contribution Contract

Page Composer needs a stable contract for what each widget instance contributes
to the page package. Regex over arbitrary HTML is not a product contract.

The expected widget package shape is the shared Widget Shell package:

```text
Stage -> Pod -> ck-headerLayout(Header + Widget Core)
```

The surviving implementation source for that shape is the shared Widget Shell
package:

```text
packages/widget-shell/
```

Page Composer must treat the Shell as a stable contribution contract that was
already materialized into each instance package. It must not import Tokyo product
routes, parse widget-specific private layouts, or depend on copied shell code
inside every widget.

Page Composer consumes materialized widget instances. It does not care whether
the Widget Core is FAQ questions, Split image/video/embedded instance, Cards
items, Countdown timer, Logo Showcase strips, CTA empty Core, or Big Bang large
typography. It only needs the shared package contribution contract below.
Any widget that uses a different shell must be explicitly approved because it
adds page-composition risk.

Each materialized instance package must provide, directly or through a documented
extractable format:

- One stamped root HTML contribution for the instance.
- Stable instance identity attached to that root.
- CSS contributions that can be deduped by stable module key.
- Runtime payload keyed by instance identity.
- Runtime module contributions that can be deduped by stable module key.
- No singleton global state that assumes only one widget instance exists on the
  document.
- Locale information for the active materialized locale.

Negative cases must fail visibly before publish:

- Missing root.
- Multiple roots when one is required.
- Missing or malformed runtime payload.
- Missing or malformed CSS/runtime markers.
- Locale mismatch when locale behavior is in scope.
- Runtime module that cannot support multiple instances.

## Approved Composition

PRD106B composes full widget instances in order. It does not support nested
widgets, columns, slots, page-level blocks, page-owned layout wrappers, or
selected sub-regions of a widget. If a widget needs columns, that is
widget-specific layout behavior owned by that widget and its Bob controls.

The generated `index.html` must be a real initial document with ordered semantic
sections, not stacked iframes and not an empty loader shell. The generated
`styles.css` must include each required style contribution once where possible.
The generated `runtime.js` must initialize each instance independently while
sharing deduped runtime modules.

## SEO/GEO Contract

Page Composer matters for SEO/GEO because it creates one crawlable document from
multiple widget instances.

PRD106B must define and test exact page metadata fields before implementation:

- Title.
- Description.
- Robots.
- Canonical URL.

The initial HTML must include meaningful ordered content from the included
instances. A page package that depends on client-side rendering to reveal all
primary content fails this PRD.

Structured data merging is not part of the PRD106B core proof. If supported
later, Roma must own validation and merge rules and a separate PRD must approve
the exact fields. Tokyo must not generate or repair structured data.

## Dependency And Propagation Contract

Roma owns the dependency index that answers:

```text
given instanceId, return pageIds that include it
```

The Pages service owns this knowledge because it saves page source and composes
from materialized instance packages. If the account has no pages, widget save
does no page-recomposition work. If the account has pages, widget save asks Roma
Pages for affected pages. Roma Pages may answer from a derived
`instanceId -> pageIds` index, or rebuild/repair that index by scanning saved
page `source.json` files plus package-declared embedded instance dependencies
from the instances included by those pages. Tokyo must not own this reverse
placement truth.

The derived `instanceId -> pageIds` index is the fast path. Scanning saved page
`source.json` files and materialized package dependency metadata is the
correctness backstop and repair path. If the fast path and the scan disagree,
Roma must repair the derived index or mark the page dependency state
failed/stale visibly; it must not silently trust stale index state.

Embedded widget instances inside a widget, such as Split items with
`core.items[].instance.instanceId`, do not create a page graph service. Roma
flattens those materialized package dependencies into the same
`instanceId -> pageIds` answer. Example:

```text
Page P includes Split instance S.
Split instance S embeds FAQ instance F.
The derived index must answer:
  S -> [P]
  F -> [P]
```

When F is saved, Roma must re-materialize S before recomposing P, or mark the
affected dependency path stale/failed visibly. Missing P from F's affected page
set fails the WordPress propagation promise.

For PRD106B, embedded dependency support is a contract and projection rule, not
a broad graph engine. Full child-parent re-materialization becomes executable
only when the first Widget Core that embeds another widget instance is green.
Until then, PRD106B must preserve the package-declared dependency field shape
and fail visibly if runtime data requires unsupported nesting.

Depth and cycle rules:

- Direct page placements are depth 0.
- One embedded widget-instance level is depth 1 and is the PRD106B supported
  target once an embedding widget exists.
- Deeper nesting is blocked unless a later PRD explicitly approves it.
- Cycles fail materialization/publish visibly. Roma must not try to resolve,
  heal, or partially render cyclic dependencies.

This is the WordPress propagation promise: a user can paste one page embed into
WordPress, edit an included instance in Clickeen, save it, and the old WordPress
embed shows the recomposed page with that updated instance. Missing one affected
page is a product failure, not a tolerable cache miss.

The index must update when:

- A page is saved.
- A page removes an instance.
- A page is deleted.
- An instance is deleted or becomes unavailable.
- A materialized package declares, removes, or changes embedded instance
  dependencies.

When a widget instance save completes:

1. Roma saves the instance through the normal widget save path.
2. Roma records the new materialized instance package and its package-declared
   embedded instance dependencies.
3. Roma re-materializes any parent instances that depend on the saved instance,
   or marks that parent dependency path stale/failed visibly.
4. Roma finds affected pages from the flattened dependency index.
5. Roma recomposes each affected page package.
6. Roma stores the new generated page files.
7. Roma updates page status to current, stale, or failed.

Recomposition budget:

- Widget save must commit first.
- Roma then recomposes affected pages within a bounded request budget.
- If affected pages exceed that budget, Roma marks remaining affected pages
  `stale` with visible retry/recompose action instead of blocking the widget
  save or inventing a queue platform.
- If any recomposition fails, the last good public package may keep serving only
  when Roma shows the page as `stale` or `failed`.
- The derived index plus scan/backstop must be able to identify all affected
  pages before claiming the update is complete.

Partial failure is a first-class state, not an exception hidden from users.

## Adopted Peer Review Constraints

The peer review's Page Composer feedback is accepted as execution law:

- Page storage, serve-state, unpublished-instance publish behavior, copy
  artifact, and page tier caps are product-owner decisions recorded in this PRD.
- PRD106B dependency knowledge answers `instanceId -> pageIds`, including
  flattened package-declared embedded instance dependencies. Do not build a
  graph service, DAG, queue platform, readiness engine, or recomposition
  framework unless Pietro explicitly approves it in a separate PRD.
- The `instanceId -> pageIds` store must be consistent enough that an included
  instance save cannot miss an affected page. A missed affected page fails the
  WordPress test and fails PRD106B.
- The derived dependency index is the fast path; a scan of page `source.json`
  files plus materialized package dependency metadata is the repair/backstop
  path. Do not build a graph engine to solve this.
- Pages can place only existing account-owned instances with valid materialized
  packages. Page save must not create, auto-save, or silently materialize a new
  instance.
- A public page can keep serving the last good package after recomposition
  failure only if Roma shows stale/failed state. Stale output must never be
  presented as current.
- No new generated page `embed.js` exists in PRD106B. Copy must use the existing
  widget embed/public-serving model adapted to a page public coordinate.
- The widget contribution contract must be minimal and Page Composer-specific:
  one stamped root, stable instance identity, locale, dedupe-able style/runtime
  module identities, per-instance runtime payload, and no singleton global state.
- SEO/GEO in PRD106B means crawlable initial HTML with approved metadata. Advanced
  structured-data merging, Open Graph, Twitter metadata, and route/domain
  systems are NOT_ALLOWED unless Pietro explicitly approves them.
- Page localization in PRD106B means page-level locale resolution across the
  existing instance locale outputs. Do not build customer host-nav integration
  as the default product path. Customer-facing controls are IP localization and
  an optional Clickeen-owned top-of-page language switcher.

The accepted implementation shape remains boring:

1. Store page source at
   `accounts/{accountPublicId}/pages/{pageId}/source.json`.
2. Store generated page output beside it.
3. Store page serve-state beside it.
4. Store or derive the Roma-owned `instanceId -> pageIds` dependency index from
   saved page source.
5. On instance save, find affected pages.
6. Recompose each affected page.
7. Store new page files on success.
8. Mark stale/failed on failure while preserving last good public files only
   when that behavior is explicitly chosen.

## Implementation Sequence

1. Confirm PRD106A boundary cleanup is done or explicitly fenced.
2. Confirm `PRD106A2_WidgetShellExtraction.md` has accepted the shared Widget
   Shell package contract or explicitly fences Page Composer to the same
   contribution shape.
3. Implement the canonical page storage and serve-state coordinate.
4. Define the Roma-owned page source schema.
5. Define the widget package contribution contract with Bob/Roma tests.
6. Add Page Composer coverage for packages generated as shared Widget Shell plus
   existing Shell-based Widget Cores or a contract fixture. New Prague migration
   widgets are owned by PRD106C3-PRD106C6 and must not be pre-worked here.
7. Move dependency indexing to Roma-owned truth or opaque Roma-managed storage.
8. Replace Tokyo page product routes with storage-only routes or fence them out
   of product paths.
9. Implement Roma Page Composer save/publish/unpublish/delete flows.
10. Implement affected-page recomposition after instance save for every page that
   includes the instance. Unpublished pages may update draft package/status
   without enabling public serving.
11. Implement public serving from generated files only, including locale-file
    selection only if it can remain storage selection rather than product
    interpretation.
12. Delete old generated page `embed.js` behavior. A temporary fence is allowed
    only if it has an owner, tests proving it is not product authority, and a
    delete gate.

## Blast Radius

Expected touched areas:

- `roma/components/pages-domain*`: Pages list/composer UX.
- `roma/app/api/account/pages*`: page create/save/publish/unpublish/delete.
- `roma/lib/account-page-direct*`: Roma page source, package storage, and
  public serving calls.
- `roma/lib/page-package-composer*`: composition algorithm.
- `roma/lib/account-instance-direct*`: affected-page recomposition after widget
  save.
- Bob public package generation: stable widget package contribution contract.
- Tokyo page routes/keys/tests: remove or fence product-shaped page behavior.
- `tokyo-worker/src/routes/clk-live-routes*`: public serving from generated
  files only.
- Documentation and PRD106A references.

Do not touch Prague block migration in this PRD except to preserve the normal
widget instance package contract that Page Composer consumes.

## Acceptance

- A page can be saved from multiple account-owned widget instances.
- Users can select, reorder, remove, save draft, publish, unpublish, delete,
  and copy the public coordinate without editing any included instance.
- `Add instances` is a bulk-selection modal/drawer with checkboxes and
  `Add selected`; it is not a dropdown.
- Bulk-added instances append to the page stack in visible picker order.
- Already-selected instances cannot be added again unless a separate product
  decision explicitly allows duplicate placements.
- Reorder controls include move up/down buttons.
- Removing an instance removes only the page reference and does not modify the
  widget instance.
- The public page URL keeps working after an included instance is edited.
- The page output changes after the instance save without requiring a new embed
  line.
- The page output is one document, not stacked iframes.
- Duplicate shared runtime/CSS is not repeated per instance.
- Page status visibly reflects recomposing, stale, failed, and missing-input
  states.
- A malformed or unmaterialized selected instance blocks publish with a clear
  Roma error.
- A draft page can include unpublished-but-materialized instances.
- Publishing a page is blocked if any selected instance is unpublished.
- Empty draft pages are allowed; publishing an empty page is blocked.
- Page tier policy is enforced in Roma:
  - Free: 0 pages.
  - Tier 1: 1 page; instances/widgets allowed by that tier.
  - Tier 2: 3 pages; instances/widgets allowed by that tier.
  - Tier 3: 6 pages; instances/widgets allowed by that tier.
  - Tier 4: unlimited pages and unlimited instances/widgets.
  - Views are unlimited for all pages across all tiers.
- Tokyo never receives product composition state beyond opaque `source.json`,
  final files, and explicit `serve-state.json` bytes.
- Old Tokyo page source, reverse-index, readiness, and generated-embed behavior
  is removed from the product path or fenced with tests proving it is not the
  authority.
- Saving an included widget instance through the normal Builder path recomposes
  every page that includes it, or marks each failed page stale/failed with retry.
- Saving an embedded widget instance, such as an instance embedded inside a
  Split instance, uses the package-declared dependency contract. Full
  child-parent re-materialization is required only after the first
  embedded-instance Widget Core is green; before then unsupported nesting fails
  visibly.
- The flattened `instanceId -> pageIds` index includes package-declared
  embedded dependencies; embedded dependencies do not create a separate graph
  service.
- Embedded dependencies support at most one nested level for PRD106B; cycles and
  deeper nesting fail visibly unless a later PRD approves them.
- Roma recomposes affected pages within a bounded request budget; any remaining
  affected pages are marked stale with visible retry instead of blocking widget
  save or inventing a queue platform.
- Initial page HTML includes ordered semantic instance content and approved
  SEO/GEO metadata.
- Page Composer exposes localization controls in a page settings panel/tab:
  default locale, IP localization on/off, country -> locale rules, language
  switcher on/off, fixed top placement for the switcher, and missing-locale
  publish blocking.
- IP localization resolves visitor country to one page locale context and every
  included instance renders in that locale when available only if public serving
  can select among Roma-materialized locale artifacts without interpreting page
  product state. Otherwise IP localization is fenced and default-locale plus
  optional top language switcher ships first.
- The optional language switcher appears at the top of the composed page and
  switches the whole page locale, not individual instances.
- Publishing is blocked for any configured page locale that an included instance
  cannot render, unless a later explicit product decision approves fallback
  behavior.
- Clickeen's own Prague/site language switcher may be manually connected to
  Clickeen-owned pages because Clickeen controls that site. This is internal
  integration, not a required customer setup flow.

## Verification

- Unit tests for page source validation: allowed fields pass; instance config,
  HTML snapshots, overrides, blocks, columns, slots, routes, and site settings
  fail.
- Unit tests for package extraction: missing root, duplicate root, missing
  runtime payload, malformed markers, and multi-instance runtime hazards fail.
- Unit tests for CSS/runtime dedupe: shared modules are emitted once while
  per-instance payload remains isolated.
- Roma API tests for create, save draft, reorder, remove, publish, unpublish,
  delete, and copy coordinate readiness.
- UI tests for Add Instances bulk selection: multiple checkbox selections append
  in visible order, already-selected rows cannot duplicate, unmaterialized rows
  are disabled, unpublished materialized rows can be added but block publish,
  and `Add instances` is not implemented as a dropdown.
- UI tests for selected stack controls: move up, move down, remove reference,
  and edit instance route to Builder.
- Roma instance-save tests proving affected pages are recomposed or marked
  stale/failed.
- Roma dependency tests proving `instanceId -> pageIds` cannot miss affected
  pages after page save, page delete, page reorder, and instance delete.
- Roma dependency tests proving package-declared embedded instance dependencies
  flatten into `instanceId -> pageIds`; unsupported nesting and cycles fail
  visibly. Full child-parent re-materialization tests become required when the
  first embedded-instance Widget Core is green.
- Roma policy tests proving page limits by tier and instance-per-page limits by
  tier.
- Publish tests proving draft pages may include unpublished materialized
  instances, but publish is blocked until every included instance is published.
- Public serving test: same page URL serves updated content after included
  instance save.
- Tokyo negative tests proving product-shaped page source/index/readiness routes
  are not the authority.
- SEO/GEO tests inspecting generated initial HTML for title, description,
  robots, canonical, and ordered semantic content. Structured-data merging is
  not part of PRD106B core proof.
- Roma page settings tests proving default locale, IP localization, country ->
  locale rules, and language switcher settings are saved in page source and are
  not interpreted by Tokyo.
- Locale readiness tests proving publish is blocked when a configured page
  locale is missing from any included instance.
- Public serving tests proving the same page resolves one locale context from
  visitor-selected switcher locale, IP/country rule, or page default, and all
  included instances follow that context when locale artifact selection is
  implemented without Tokyo product interpretation.
- UI tests proving the language switcher, when enabled, appears once at the top
  of the composed page and controls the whole page rather than rendering
  repeated per-instance selectors.

## Product Owner Decisions Applied

- Page composition source lives at
  `accounts/{accountPublicId}/pages/{pageId}/source.json`.
- Page generated output lives at
  `accounts/{accountPublicId}/pages/{pageId}/index.html`, `styles.css`, and
  `runtime.js`.
- Locale-specific crawlable HTML, when enabled, lives under
  `accounts/{accountPublicId}/pages/{pageId}/locales/{locale}/index.html`.
- Page serve-state lives at
  `accounts/{accountPublicId}/pages/{pageId}/serve-state.json`
  and uses the same `published` / `unpublished` concept as widgets.
- Roma Pages service owns page dependency knowledge. It may maintain a derived
  `instanceId -> pageIds` index and repair it by scanning saved page
  `source.json` files.
- Draft pages may include unpublished-but-materialized instances. Publishing a
  page is blocked if any selected instance is unpublished.
- Copy uses the existing widget embed/public-serving model adapted to the page
  public coordinate. Pages expose the hosted URL and standard embed snippets;
  no generated page `embed.js` exists.
- Page tier policy:
  - Free: 0 pages.
  - Tier 1: 1 page; instances/widgets allowed by that tier.
  - Tier 2: 3 pages; instances/widgets allowed by that tier.
  - Tier 3: 6 pages; instances/widgets allowed by that tier.
  - Tier 4: unlimited pages and unlimited instances/widgets.
  - Views are unlimited for all pages across all tiers.
- Clickeen pages support IP/country localization for choosing the page language.
- Clickeen pages may render one optional Clickeen-owned language switcher at
  the top of the composed page.
- Customer host-nav integration is not required for PRD106B. Clickeen may
  manually connect Prague/site language switching to its own Clickeen pages
  because Clickeen controls that site.
