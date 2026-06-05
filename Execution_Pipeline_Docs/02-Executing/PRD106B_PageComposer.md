# PRD106B_PageComposer

Status: Draft execution PRD
Owner: Roma
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`

## Purpose

Build the Page Composer workflow as the Roma-owned materializer that turns X
saved widget instances into one browser-readable page package:

```text
accounts/{account}/pages/{page}/source.json
accounts/{account}/pages/{page}/index.html
accounts/{account}/pages/{page}/styles.css
accounts/{account}/pages/{page}/runtime.js
accounts/{account}/pages/{page}/serve-state.json
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
- Venice/`clk.live` serves public files; it does not derive page product truth.
- Prague is not account authoring truth and does not own pages.

### Allowed Page Source

The approved PRD106B page source may contain only:

- `pageId`.
- Display name/title.
- Ordered references to account-owned widget instances.
- Approved page-level metadata fields needed for SEO/GEO.
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
accounts/{account}/pages/{page}/source.json
accounts/{account}/pages/{page}/index.html
accounts/{account}/pages/{page}/styles.css
accounts/{account}/pages/{page}/runtime.js
accounts/{account}/pages/{page}/serve-state.json
```

Current code and CONTEXT may still describe `website/pages/{page}` and
`website/publishes/{page}`. PRD106B must not paper over that conflict. Execution
must migrate away from those old coordinates or temporarily fence them with
tests and a delete gate while callers move.

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
  description, canonical, robots, and structured data where valid.
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
accounts/{account}/instances/{instance}/index.html
accounts/{account}/instances/{instance}/styles.css
accounts/{account}/instances/{instance}/runtime.js
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
- Structured data when the source and merge rules are valid.

The initial HTML must include meaningful ordered content from the included
instances. A page package that depends on client-side rendering to reveal all
primary content fails this PRD.

If structured data is supported, Roma must own validation and merge rules. Tokyo
must not generate or repair structured data.

## Dependency And Propagation Contract

Roma owns the dependency index that answers:

```text
given instanceId, return pageIds that include it
```

The Pages service owns this knowledge because it saves page source. If the
account has no pages, widget save does no page-recomposition work. If the
account has pages, widget save asks Roma Pages for affected pages. Roma Pages
may answer from a derived `instanceId -> pageIds` index, or rebuild/repair that
index by scanning saved page `source.json` files. Tokyo must not own this
reverse placement truth.

The index must update when:

- A page is saved.
- A page removes an instance.
- A page is deleted.
- An instance is deleted or becomes unavailable.

When a widget instance save completes:

1. Roma saves the instance through the normal widget save path.
2. Roma records the new materialized instance package.
3. Roma finds affected pages from the dependency index.
4. Roma recomposes each affected page package.
5. Roma stores the new generated page files.
6. Roma updates page status to current, stale, or failed.

Partial failure is a first-class state, not an exception hidden from users.

## Adopted Peer Review Constraints

The peer review's Page Composer feedback is accepted as execution law:

- Page storage, serve-state, unpublished-instance publish behavior, copy
  artifact, and page tier caps are product-owner decisions recorded in this PRD.
- PRD106B dependency knowledge is only `instanceId -> pageIds`. Do not build a
  graph service, DAG, queue platform, readiness engine, or recomposition
  framework unless Pietro explicitly approves it in a separate PRD.
- The `instanceId -> pageIds` store must be consistent enough that an included
  instance save cannot miss an affected page. A missed affected page fails the
  WordPress test and fails PRD106B.
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

The accepted implementation shape remains boring:

1. Store page source at `accounts/{account}/pages/{page}/source.json`.
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
2. Implement the canonical page storage and serve-state coordinate.
3. Define the Roma-owned page source schema.
4. Define the widget package contribution contract with Bob/Roma tests.
5. Move dependency indexing to Roma-owned truth or opaque Roma-managed storage.
6. Replace Tokyo page product routes with storage-only routes or fence them out
   of product paths.
7. Implement Roma Page Composer save/publish/unpublish/delete flows.
8. Implement affected-page recomposition after instance save for every page that
   includes the instance. Unpublished pages may update draft package/status
   without enabling public serving.
9. Implement public serving from generated files only.
10. Delete old generated page `embed.js` behavior. A temporary fence is allowed
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
- Initial page HTML includes ordered semantic instance content and approved
  SEO/GEO metadata.

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
- Roma policy tests proving page limits by tier and instance-per-page limits by
  tier.
- Publish tests proving draft pages may include unpublished materialized
  instances, but publish is blocked until every included instance is published.
- Public serving test: same page URL serves updated content after included
  instance save.
- Tokyo negative tests proving product-shaped page source/index/readiness routes
  are not the authority.
- SEO/GEO tests inspecting generated initial HTML for title, description,
  robots, canonical, ordered semantic content, and valid structured data when
  supported.

## Product Owner Decisions Applied

- Page composition source lives at `accounts/{account}/pages/{page}/source.json`.
- Page generated output lives at `accounts/{account}/pages/{page}/index.html`,
  `styles.css`, and `runtime.js`.
- Page serve-state lives at `accounts/{account}/pages/{page}/serve-state.json`
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
