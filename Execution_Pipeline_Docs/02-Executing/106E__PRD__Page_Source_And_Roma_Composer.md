# PRD 106E - Page Source And Roma Composer

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `../01-Planning/106__PRD__Page_Composer_Widget_Instance_Materializer_Foundation.md`
Related: `106B__PRD__Widget_Package_Composition_Contract.md`, `106F__PRD__Page_Materializer_And_Recomposition.md`, `106G__PRD__Page_Publish_Edge_Serve_And_SEO_GEO_Baseline.md`

## 2026-06-04 System Tenets Correction

Functional execution is not enough for 106E to remain green.

Under the 106 umbrella tenets:

```text
Roma is the product authority.
Tokyo is the R2/storage boundary.
```

That means previous language saying "Tokyo owns durable page operations and
validation" must be read as too broad and must be repaired.

Correct ownership:

- Roma owns the page product workflow, account/tier authority, page composer UX,
  save intent, and user-facing failures.
- Tokyo stores page source files and any storage projections/index files that
  Roma submits or asks it to maintain as R2 bookkeeping.
- Tokyo may reject invalid account coordinates, unsafe paths, non-allowlisted
  files, and malformed storage payloads.
- Tokyo must not become the page product brain, route-local policy authority,
  hidden page editor, or repair system.

The next 106E repair slice must audit current Tokyo page routes/domains and
move product decisions back to Roma without changing the simple page source:

```json
{
  "head": {},
  "placements": [{ "instanceId": "HERO123456" }]
}
```

## Purpose

Create the Roma product surface where users manage pages by stacking widget instances.

This PRD introduces the editable page source and the Roma Page Composer workflow.

It does not turn pages into public HTML. That is 106F:

```text
page source.json
  -> Page Composer
    -> page index.html / styles.css / runtime.js
```

It does not serve public URLs. That is 106G.

## Batch 2 Split

This PRD has two execution slices:

```text
106E1 - Page Source Authority
106E2 - Roma Page Composer
```

106E1 defines the durable page source, validation, and indexes.

106E2 defines the actual Roma UX where users create pages, add widgets, move placements up/down, remove placements, and open placed widgets in Bob.

## 106E1 - Page Source Authority

### Product Model

A page is an account-owned ordered list of widget instance placements.

The page does not copy widget content. It references widget instances.

The page does not own widget translation overlays, content overlays, or page-specific widget overrides in V1. Widget content, translations, and overlays remain widget-owned.

### Source Storage

Roma owns the product workflow and save intent.

Tokyo stores the submitted page files in R2.

The intended path is:

```text
Roma Pages UI
  -> Roma account API facade
    -> Tokyo R2 storage operation
      -> source.json + storage projections
```

### Page Source

Minimum source:

```json
{
  "v": 1,
  "id": "P9Q8R7S6T5",
  "head": {
    "title": "Home",
    "description": "",
    "robots": "index,follow"
  },
  "placements": [
    {
      "instanceId": "HERO123456"
    }
  ]
}
```

Rules:

- `id` is the durable page identity.
- `id` is minted by Tokyo and opaque to the user.
- `id` is not a slug, route name, display name, or editable URL field.
- `head` is page-owned SEO/GEO source for the eventual generated page.
- `placements` array order is the page order.
- no separate `order` field in V1;
- no `region` field in V1;
- no `layout` field in V1;
- no placement `overrides` field in V1.

Moving a placement up/down only reorders the `placements` array:

```json
{
  "placements": [
    { "instanceId": "FAQ123456" },
    { "instanceId": "HERO123456" },
    { "instanceId": "COUNT123456" }
  ]
}
```

That is the whole model. No block rows. No page-specific widget snapshots. No layout graph.

### Page Identity And URL

V1 does not use slugs.

The page id is the public object coordinate for Clickeen page delivery.

That keeps V1 out of website routing, slug uniqueness, aliases, redirects, and old-slug behavior.

Public page delivery is object-addressed:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
```

The rule is:

```text
page id = identity
page id = public Clickeen page object coordinate
```

Pretty URLs, custom domains, website routes, and slugs are future website-routing work, not V1 page composition work.

Do not add `slug` to page source in this PRD.

### Source Storage

Editable page source lives under the account website workspace:

```text
accounts/{accountPublicId}/website/
  pages/{pageId}/source.json
```

Do not store pages under widget `instances/`.

Do not create page locale overlay folders in V1. Locale overlays remain widget-owned until a separate hosted-page localization PRD defines page-level localized routes and metadata.

### Required Indexes

R2 source files are not enough for product operations at scale.

Tokyo must maintain operational indexes/projections for:

- account page listing;
- reverse placement lookup: `(accountId, instanceId) -> pageIds`.
- reverse embedded-widget lookup: `(accountId, childInstanceId) -> parentInstanceIds`.

These indexes are required because:

- listing pages cannot scan every R2 page source;
- widget save recomposition cannot scan every page to find affected pages.
- embedded child widget saves cannot scan every instance to find parent widgets that embed them.

The exact index storage can be chosen by implementation, but the behavior is required.

Embedded widget references are widget-owned fields, not page source.

Roma Page Composer does not manage embedded child widgets. Bob manages them through the parent widget editor as a dropdown.

Page source still contains only ordered placements.

## Audit Refresh Decisions

The audit refresh is useful for 106E because it confirms there is no executable page source architecture in the current production paths.

Use these findings:

- `tokyo-worker/src/routes/internal-render-routes.ts` has no internal page route group yet;
- `tokyo-worker/src/route-dispatch.ts` public serving host currently routes only through the existing static handler;
- Roma has no active Pages domain or page-source client path yet;
- no production `accounts/{accountPublicId}/website/pages/{pageId}/source.json` path was found.

Execution must add a real page domain beside the instance domain:

```text
tokyo-worker/src/domains/pages/*
tokyo-worker/src/routes/internal-page-routes.ts
roma/lib/account-page-direct.ts
roma/app/api/account/pages/route.ts
roma/app/api/account/pages/[pageId]/route.ts
roma/app/(authed)/pages/page.tsx
roma/components/pages-domain.tsx
```

Do not implement pages by extending instance source, instance indexes, or widget routes.

New page APIs must fail at the boundary:

- invalid JSON parse returns a named API failure;
- invalid page source returns a named Tokyo page validation failure;
- cross-account placement returns a named Tokyo page validation failure;
- index update failure returns a non-green page operation.

Route/auth handling should reuse the existing Roma/Tokyo account boundary helpers where possible. Do not hand-copy route-local trust choreography into every page route. A broader internal command envelope can be considered later, but it is not required for 106E.

### Placement Integrity

A placement is simple:

```json
{
    "instanceId": "inst_456"
}
```

Validation rules:

- `instanceId` exists;
- `instanceId` belongs to the same account;
- moving a placement only changes array order;
- removing a placement does not delete the widget instance;
- deleting a widget instance that is placed on a page must be blocked in V1 or handled by a named page-aware delete operation.

V1 allows the same widget instance to appear more than once on a page. That is still only repeated placement by array order; it does not create page-owned widget copies or page-owned overrides.

Embedded widget integrity is separate from placement integrity:

```json
{
  "embeddedWidgetInstanceId": "FAQ123456"
}
```

Validation belongs to the widget save/materialization path:

- embedded instance exists;
- embedded instance belongs to the same account;
- parent does not embed itself;
- parent/child graph has no cycle.

The page does not store or reorder embedded widget references.

## Executed Slice 1 - Page Source Authority

Status: Executed / verified

Implemented durable page storage without building the Roma UI yet.

2026-06-04 tenets note: the implementation below made Tokyo too much of a page
operation authority. That ownership is now a repair target. The simple source
shape remains correct; product authority must move back to Roma.

What landed:

- Tokyo stores page source files in R2.
- Page source is stored at `accounts/{accountPublicId}/website/pages/{pageId}/source.json`.
- Page list is maintained as an explicit projection, not an R2 folder scan.
- Reverse placement lookup is maintained as an explicit projection by `instanceId`, not an R2 folder scan.
- Current Tokyo code validates page id, head metadata, instance existence, and same-account ownership; under the 106 tenets this must become Roma-owned product/save validation with Tokyo keeping only storage-boundary checks.
- The same widget instance may appear in multiple placements on the same page. Placement identity is array position; widget instance identity remains widget-owned.
- Widget instance deletion is blocked when the reverse placement index shows that the instance is placed on one or more pages.
- Roma has a server-side page direct helper that calls Tokyo page product operations.
- Roma has account API facades for page list/create/open/save/delete.
- No page materializer, public page serving, slug manager, page override model, block object, section object, or Bob page mode was added.

Tokyo files:

```text
tokyo-worker/src/domains/pages/keys.ts
tokyo-worker/src/domains/pages/types.ts
tokyo-worker/src/domains/pages/source.ts
tokyo-worker/src/domains/pages/index.ts
tokyo-worker/src/routes/internal-page-routes.ts
tokyo-worker/src/routes/internal-page-routes.test.ts
tokyo-worker/src/routes/internal-render-routes.ts
tokyo-worker/src/routes/internal-instance-routes.ts
tokyo-worker/src/routes/internal-route-test-utils.test.ts
tokyo-worker/package.json
```

Roma files:

```text
roma/lib/account-page-direct.ts
roma/lib/account-page-direct.test.ts
roma/app/api/account/pages/route.ts
roma/app/api/account/pages/[pageId]/route.ts
roma/package.json
```

Verification:

```text
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/roma test
pnpm --filter @clickeen/roma typecheck
git diff --check
```

Slice 1 conclusion:

The system now has one real page noun: a Tokyo-owned page source with ordered widget instance placements. Roma can call page operations through its account API boundary, but the product UI is still 106E2.

## 106E2 - Roma Page Composer

Roma Page Composer is the product UI for managing the page source.

It is not Bob. It is not a new Builder mode. It does not edit widget internals.

### Required Workflow

Users must be able to:

- list pages;
- create page;
- edit page title/description/robots;
- add existing widget instance;
- create a new widget instance from the composer;
- place that widget instance on the page;
- move placements up and down;
- remove placement without deleting the widget instance;
- open placed instance in Bob;
- return from Bob to the page composer.

First UI can be an ordered vertical list. No freeform canvas.

### Create New And Place

Create New is a Roma product workflow using the normal account widget instance creation path.

Place is a Roma Page Composer workflow that adds the new instance id to the page source placements.

The simple V1 behavior is:

```text
Roma creates a normal widget instance
Roma adds that instance id to the page placements
Roma saves the page source
```

If widget creation succeeds but page placement save fails:

```text
the widget remains as a normal account widget
the page does not get the placement
Roma shows the placement/save failure
```

No hidden compensation deletion. No fake transaction. No separate section publish mode.

### Bob Flow

Bob remains the one-widget editing surface.

Opening a placed widget sends the user to the existing Bob edit route for that widget instance.

Roma must preserve a return context so the user can come back to the page composer after editing.

## Executed Slice 2 - Roma Page Composer

Status: Executed / verified

Implemented the Roma Pages product surface.

What landed:

- Roma nav now includes `Pages`.
- `/pages` opens a Pages domain.
- Users can create a page.
- Users can list account pages.
- Users can select and open a page source.
- Users can edit title, description, and robots metadata.
- Users can add an existing widget instance to the page.
- Users can create a normal widget instance from the composer and place it on the page.
- Users can move placements up and down by reordering the `placements` array.
- Users can remove a placement without deleting the widget instance.
- Users can delete a page.
- Users can open a placed widget in the existing Bob one-widget editor.
- Builder now preserves a safe `returnTo` route context so users can return to the page composer.

Roma files:

```text
roma/components/use-roma-pages.ts
roma/components/pages-domain.tsx
roma/components/builder-domain.tsx
roma/lib/domains.ts
roma/app/(authed)/pages/page.tsx
```

What did not land:

- no page materializer;
- no public page serving;
- no slug manager;
- no page override model;
- no page-local widget content;
- no block object;
- no section object;
- no Bob page mode;
- no freeform canvas.

Verification:

```text
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

Slice 2 conclusion:

106E is functionally green but needs ownership cleanup. Roma can manage pages as ordered widget instance placements, Bob remains the one-widget editor, and Tokyo must be reduced to the page storage boundary.

## 2026-06-04 Repair Pass

Status: Executed / verified

What changed:

- Removed stale `placement.id` language from the PRD. The executed code uses the simpler surviving source shape: `placements: [{ instanceId }]`.
- Confirmed placement movement is array reordering, not id/order-field mutation.
- Confirmed repeated use of the same widget instance on one page remains allowed and does not create page-owned widget copies.

Why this is correct:

- Page source stays simple enough for Roma users and AI agents: ordered widget instance references only.
- Widget identity and content remain widget-owned.
- Page Composer has no block rows, section objects, placement ids, layout graph, or override model.

Verification:

```text
pnpm --filter @clickeen/roma test
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

## Pre-Execution Agent Review Addendum

### Staff Engineer Review

Execute this as a Roma-owned page product workflow plus Tokyo R2 storage.

Do not turn it into a page builder substrate.

A page is only:

```text
head metadata + ordered placements of existing widget instances
```

Primary code vectors:

```text
roma/lib/domains.ts
roma/app/(authed)/pages/page.tsx
roma/components/pages-domain.tsx
roma/app/api/account/pages/route.ts
roma/app/api/account/pages/[pageId]/route.ts
roma/lib/account-page-direct.ts
tokyo-worker/src/routes/internal-page-routes.ts
tokyo-worker/src/domains/pages/*
tokyo-worker/src/routes/internal-instance-routes.ts
roma/components/use-roma-widgets.ts
roma/app/(authed)/builder/[instanceId]/page.tsx
```

P0 engineering gates:

- page source lives only under `accounts/{accountPublicId}/website/pages/{pageId}/source.json`;
- pages are not stored under `instances/`;
- Roma validates every page write: page id, head fields, placement shape, instance existence, tier/account permission, and same-account ownership before saving;
- moving placements only reorders the `placements` array;
- removing a placement never deletes the widget instance;
- create-new-and-place uses the normal Roma instance creation path, then adds the returned `instanceId` to page source;
- if placement save fails after widget creation, the widget remains a normal account widget;
- no hidden compensation delete is allowed;
- page listing and reverse placement lookup exist as storage projections without R2 scans;
- instance delete is blocked when the reverse placement index says the instance is used by a page, unless a named page-aware delete operation is implemented;
- Bob receives only `instanceId`;
- Bob receives no page source, placement source, or page editor mode;
- return-to-composer is Roma route context only.

2026-06-04 ownership repair note:

- Tokyo keeps the reverse placement index as storage bookkeeping.
- Roma asks Tokyo for page ids that place a saved widget instance.
- Roma re-saves those affected pages through the existing page save path so page package files are refreshed.
- Tokyo does not compose or repair pages during widget save.

Indexes are projections, not product truth.

Required behavior:

```text
account page list:
  accountId -> page summaries

reverse placement lookup:
  accountId + instanceId -> pageIds
```

Storage can be R2 projection, DB, or another Tokyo-owned implementation detail. The invariant is no scan-on-list and no scan-on-widget-save/recompose.

### Senior PM Review

The product direction is correct if 106E stays focused on one thing:

```text
Roma lets users build a page by ordering existing account-owned widget instances.
```

The user workflow is:

1. Create a page.
2. Set title, description, and robots metadata.
3. Add an existing widget or create a new widget.
4. Move widgets up/down.
5. Remove a widget from the page without deleting it.
6. Open any placed widget in Bob.
7. Return to the page composer.

Primary product surfaces:

```text
Roma Pages list
Roma Page Composer detail view
existing Roma widget creation flow
existing Bob open/edit/save flow
Tokyo page source operations
Tokyo page listing index
Tokyo reverse placement lookup
```

The scalable product model is:

```text
Widget instance = reusable thing the account already owns
Page = ordered use of those things
```

Users should not learn a new `block`, `section`, or page-local widget concept.

Product decisions to freeze before execution:

- V1 URL identity is `pageId`, not slug;
- the same widget instance may appear more than once on a page; placement identity is its array position;
- removing a placement never deletes the widget instance;
- if create-new succeeds but placement save fails, the widget remains;
- deleting a widget placed on a page is blocked in V1 or handled by an explicit page-aware delete operation;
- Page Composer shows an ordered list first, not a visual canvas;
- open-in-Bob must preserve return context back to the page composer.

### Principal TPM Review

106E creates one new product noun:

```text
page
```

The clean system split is:

```text
Roma = product UI + same-origin account API facade
Tokyo = R2 storage for page source, package files, and storage projections
Bob = existing one-widget editor
106F = page package materialization
106G = public delivery
```

The cost-effective architecture is:

```text
page source = head metadata + ordered placement refs
widget source = unchanged
widget package = unchanged
page package = later output from 106F
```

This avoids a second editor, second translation system, second widget source model, and second public artifact model.

106E must leave 106F with clear trigger inputs:

- page source changed means that page needs recomposition;
- widget instance saved/materialized means all pages from reverse placement lookup need recomposition;
- placement added, removed, or reordered means that page needs recomposition;
- page deleted means composed page output and delivery state must be cleaned by later publish/materialization scope;
- widget delete while placed is blocked in V1 or handled by a named page-aware delete operation.

106E does not run the materializer.

It creates the durable source and indexes that make 106F cheap and deterministic.

Failure boundaries:

- invalid page source fails in Tokyo page API;
- missing or cross-account `instanceId` fails in Tokyo;
- invalid placement shape or cross-account `instanceId` fails in Tokyo;
- index update failure fails the page operation or returns an explicit non-green state;
- Roma displays the failure and does not invent repaired source;
- if instance creation succeeds but placement save fails, the widget remains a normal widget and the page is unchanged;
- deleting a placed widget is blocked in V1 unless a page-aware delete operation is implemented.

### Scope Guard

Do not build:

- slug manager;
- route map;
- block objects;
- section inventory;
- page-local widget content;
- placement override engine;
- page locale overlays;
- widget snapshots;
- Bob page mode;
- freeform canvas;
- nav or site settings;
- custom domains;
- transaction framework;
- hidden compensation cleanup;
- request-time page assembly;
- page materializer in this PRD.

## Non-Scope

Do not:

- materialize page packages in this PRD;
- serve hosted pages in this PRD;
- add slugs, pretty URLs, redirects, or website route maps;
- add domains/nav/global site settings;
- add A/B tests or personalization;
- add page-specific widget overrides;
- add page locale overlays;
- add block/section inventory;
- add widget snapshots inside page source;
- add Bob page mode;
- add freeform canvas behavior.

## Verification

This PRD is green when:

- Roma exposes a `Pages` area;
- account pages can be created, saved, listed, and deleted;
- page source references existing account instance IDs;
- users can add an existing widget instance to a page;
- users can create a normal widget instance and then place it;
- users can move placements up/down by changing placement array order;
- removing a placement does not delete the widget instance;
- opening a placed widget uses the existing Bob one-widget edit flow;
- users can return from Bob to the page composer;
- Tokyo maintains page listing and reverse placement indexes without R2 scans;
- invalid page source fails at the page API boundary;
- page source contains no block object, section inventory, widget snapshot, page locale overlay, or page-specific widget override.
