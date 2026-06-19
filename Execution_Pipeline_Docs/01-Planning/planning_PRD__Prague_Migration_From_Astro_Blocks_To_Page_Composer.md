# Planning PRD - Prague Migration From Astro Blocks To Page Composer

Status: Draft execution PRD
Owner: Prague + Roma
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`
Series step: 8
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106B_PageComposer.md`, `PRD106C_Prague astro blocks migration to widget instances.md`, `PRD106C3`-`PRD106C6`
Unlocks: Prague route cutover to composed Clickeen pages.
Authority owned by this PRD: Prague route cutover from Astro block assembly to composed page output.
Authority explicitly not owned by this PRD: Widget Shell extraction, Widget Core implementation, Page Composer implementation, account authoring truth.

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
3. Name the surviving authority for any route/page/widget concern being changed.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency  | Required green evidence                                       | Status   |
| ----------- | ------------------------------------------------------------- | -------- |
| PRD106A2    | Shared Widget Shell package accepted.                         | REQUIRED |
| PRD106B     | Page Composer save/publish/public model accepted.             | REQUIRED |
| PRD106C     | Prague block target map accepted.                             | REQUIRED |
| PRD106C3-C6 | Required migrated widgets produce composition-ready packages. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 1: Select one Prague route for cutover readiness.
```

Required evidence before marking green:

- Route block stack is listed.
- Every required block has a migrated widget instance target.
- Page Composer can represent the route content stack.

Stop conditions:

- Route needs an unmigrated block.
- Route needs Prague block architecture as product truth.

## Execution Steps

| Step | Action                                                   | Required evidence                       | Green criteria                                                       | Stop condition                                 |
| ---: | -------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
|    1 | Select one Prague route for cutover readiness.           | Route stack and widget target evidence. | Every migrated visual/content section is representable as instances. | Unmapped block required.                       |
|    2 | Create account-owned widget instances for route content. | Instance source/package evidence.       | Instances are normal account-owned widgets.                          | Prague stores account truth.                   |
|    3 | Create composed page through Page Composer.              | Page source/output evidence.            | Page stack matches route content order.                              | Page needs block/page-specific instance edits. |
|    4 | Integrate Prague route to composed output.               | Route diff/screenshot.                  | Prague chrome survives; content comes from composed page output.     | Route recreates Page Composer locally.         |
|    5 | Verify localization/SEO behavior.                        | Locale screenshots/HTML evidence.       | Approved route metadata and page content render.                     | Host-nav/customer integration is invented.     |
|    6 | Delete/fence old block assembly for route.               | Diff/`rg` evidence.                     | Route no longer depends on migrated Astro blocks.                    | Old block path remains active.                 |

## Purpose

Move Prague from Astro block assembly to Clickeen-composed page output after the
needed Prague blocks have been faithfully migrated into widgets and widget
instances.

This PRD is intentionally after PRD106C. Prague cannot migrate to Page Composer
until the widgets it needs are real.

PRD106D is a cutover PRD. It does not invent a new page, site, block, fragment,
or embed architecture. It decides how Prague consumes already-composed Clickeen
page output while preserving Prague website responsibilities.

## Preconditions

PRD106D is blocked until all of the following are true:

- PRD106B has accepted the Page Composer source schema, storage coordinate,
  serve-state coordinate, public URL/embed shape, widget package contribution
  contract, affected-page recomposition, and Tokyo/Roma authority split.
- PRD106A2 has accepted the shared Widget Shell package contract.
- PRD106C has accepted the scoped Prague block inventory and all widgets needed
  by the target Prague route have composition-ready packages built from the
  shared Widget Shell package.
- PRD106C decisions are resolved or explicitly fenced outside migrated route
  truth for nested `accountInstanceRef` visuals, `subpage-cards` route
  semantics, locale overlays, `minibob`, carousel blocks, and unmapped blocks.
- Prague has a route-by-route cutover matrix with delivery mode, retained
  Prague chrome, target Roma page, locale behavior, parity bar, and rollback
  path.

If any missing Page Composer capability is needed, fix PRD106B. If any missing
widget capability is needed, fix PRD106C. Do not fill the gap inside Prague.

## Product Rule

Prague is a customer of Clickeen output. It may embed or serve composed
Clickeen pages, but it must not define account page architecture, composed
content semantics, storage, dependency tracking, or migrated SEO/GEO content.

Prague can own website routes and chrome. It cannot own account page source,
widget instance source, composition order, dependency tracking, dedupe,
recomposition, or SEO/GEO generation for migrated composed content.

All migrated Prague sections must become normal widget instances using the
Widget Shell:

```text
Stage -> Pod -> ck-headerLayout(Header + Widget Core)
```

Prague must not preserve Astro block Header/CTA/layout names inside migrated
widget state. Prague block values are migration source only; PRD106C converts
them into shell paths (`header.*`, `headerCta.*`, Stage/Pod) plus the approved
Widget Core.

## Migration Shape

1. Keep current Astro block pages working as a temporary cutover fence while
   widget ports are incomplete. Each fence needs an owner, route scope, tests,
   and delete gate.
2. Create account-owned Clickeen instances for the migrated widgets.
3. Create Roma pages that stack those instances in the order Prague needs.
4. Publish composed page files.
5. Point Prague pages at the composed public output or inject that output through
   a deliberate delivery integration.
6. Remove the replaced Astro block assembly only after visual, SEO/GEO, locale,
   and routing parity are proven.

## Prague Delivery Contract

Each migrated route must choose one approved delivery mode before implementation:

- `link-or-redirect`: Prague links or redirects to the composed public page URL.
- `reverse-proxy-full-document`: Prague serves the exact composed full document
  from the public/generated coordinate.
- `same-route-shell-with-composed-content`: Prague keeps its route shell/chrome
  and injects an exact read-only composed content package using a named
  integration approved by PRD106B.

Forbidden delivery behavior:

- Prague request-time composition.
- Prague parsing widget/page source to rebuild content.
- Prague copying page packages into new snapshots that do not update with Roma.
- Prague mutating composed HTML/CSS/runtime.
- Stacked iframes as the composed page.
- Prague block-shaped wrappers around migrated content.
- Prague-owned per-page widget overrides.
- Current generated `embed.js` behavior. PRD106D must use the PRD106B-approved
  page public serving/embed model, not invent or preserve a page `embed.js`.

If `same-route-shell-with-composed-content` is chosen, PRD106B must explicitly
support the required package shape. A full-document Page Composer output cannot
be blindly placed inside Prague `Base.astro` without duplicating `<html>` and
`<head>` or damaging SEO.

## Route Cutover Matrix

Before migration, create a table for every route in scope:

| Prague route                                   | Current source                   | Target Roma page | Delivery mode                 | Prague-owned chrome | Blocked/unmigrated content | Delete gate     |
| ---------------------------------------------- | -------------------------------- | ---------------- | ----------------------------- | ------------------- | -------------------------- | --------------- | ---- | -------------- |
| `/{market}/{locale}/widgets/{widget}/`         | `overview.json` + `WidgetBlocks` | page id          | mode                          | Nav/Footer/etc.     | list                       | parity + tests  |
| `/{market}/{locale}/widgets/{widget}/{examples | features                         | pricing}/`       | subpage JSON + `WidgetBlocks` | page id             | mode                       | Nav/Footer/etc. | list | parity + tests |

The matrix must also capture:

- trailing-slash 301 behavior;
- invalid market/locale redirects;
- overview canonicalization from `/overview/` to the overview route;
- fixed subpage set and 404 behavior;
- query/cookie/geo redirect behavior if the route participates in it;
- approved temporary cutover behavior while a route is partially migrated.

## Data Migration Contract

Current Prague page data under `tokyo/prague/pages/**.json` is migration source
material, not the future page source for migrated routes.

For each migrated route:

- Convert eligible block content into normal account-owned widget instances.
- Confirm those widget instances were materialized as shared Widget Shell
  package plus Widget Core, not Prague-derived block/control
  architecture and not copied per-widget shell logic.
- Convert the route's visual/content stack into a normal Roma page.
- Store only the approved Prague routing map needed to choose the public
  composed page for `{market, locale, widget, page}`.
- Do not store private instance source, page source, blocks, block IDs, or block
  translation operations in Prague after cutover.

Prague-owned directory and navigation data may survive only as website metadata:
widget labels, nav labels, card descriptions, route availability, CTA hrefs, and
locale URLs. It must not become account page truth.

## What Prague Still Owns

- Site chrome.
- Navigation.
- Markets and locale routes.
- Marketing URLs.
- Any copy or routing that is explicitly Prague website content and not a
  Clickeen widget/page artifact yet.
- Route redirects, 404s, trailing slash policy, locale selector, mega menu,
  footer, and Prague-only funnel surfaces.

## What Prague Must Stop Owning

- Page section product architecture.
- Widget-equivalent block rendering after the corresponding widget port is
  complete.
- Private instance/page source.
- Translation or locale truth for embedded account-owned widget/page artifacts.
- `page-meta` and `navmeta` as block-shaped product page source.
- `WidgetBlocks` rendering for migrated sections.
- Prague block registry dependencies for migrated routes.

## SEO/GEO Authority Matrix

Every migrated route must name one authority for each field:

| Field               | Candidate authority                                  | Rule                                                                 |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `<html lang>`       | Prague route shell or composed page                  | Must match route locale                                              |
| `dir`               | Prague route shell or composed page                  | Must match locale text direction                                     |
| Title               | PRD106B page metadata or Prague route shell          | No duplicate conflicting titles                                      |
| Description         | PRD106B page metadata or Prague route shell          | No duplicate conflicting descriptions                                |
| Robots              | Prague route shell or PRD106B page metadata          | Dev noindex behavior preserved                                       |
| Canonical           | Prague route shell or PRD106B page metadata          | Must preserve canonical marketing URL if Prague route remains public |
| Hreflang alternates | Prague route shell                                   | Must preserve market/locale alternates                               |
| Structured data     | PRD106B page metadata unless explicitly Prague-owned | Must be valid and non-duplicated                                     |
| OG/Twitter metadata | Blocking decision                                    | Decide before implementation if route SEO/GEO parity depends on it   |

SEO/GEO acceptance requires primary migrated content to be present in initial
HTML at the public Prague route or approved public destination. Client-only
loading of primary marketing content fails this PRD.

## Locale Contract

Prague still owns market/locale routing and chrome locale. Migrated widget/page
content locale must come from the Clickeen composed artifact contract.

Rules:

- A Prague route locale selects the approved composed page/locale coordinate.
- Prague must not inspect widget locale overlays or apply Prague block
  translation operations to migrated content.
- Missing required composed locale output fails before cutover or uses an
  explicitly approved temporary cutover fence. The fence is not a product mode
  and must have an owner, tests, and delete gate.
- Existing `tokyo/prague/pages/**/*.translations/{locale}.json` paths must be
  deleted, migrated to widget/page content, or retained only for unmigrated
  routes.
- RTL and non-Latin locales must be verified for both Prague chrome and composed
  content.

## Chrome And Navigation Contract

Prague keeps website chrome unless a route explicitly chooses full-document
takeover.

Chrome parity includes:

- `Base.astro` behavior where still used.
- `Nav` and `Footer`.
- Locale selector.
- Mega menu.
- CTA hrefs.
- Hero overlay behavior.
- `WidgetSubnav` or its approved replacement.
- Directory cards and widget labels.

Because current navigation reads `navmeta` from Prague page JSON, PRD106D must
define the replacement Prague-owned website metadata source before deleting the
block JSON for migrated routes.

## Update, Cache, And Failure Behavior

When an included Clickeen instance changes:

1. Roma recomposes the affected page under PRD106B.
2. Prague's public route must serve the updated composed output without editing
   Prague block code.
3. The delivery mode must define cache invalidation, revalidation, or direct
   live consumption.

Failure handling must be explicit:

- If recomposition fails, Prague either serves the last good composed package,
  returns a controlled failure, or uses an approved temporary cutover fence.
- The chosen behavior must not silently serve stale content while Roma reports
  the page current.
- Rollback is not a product mode. It may preserve current Astro block pages only
  as temporary cutover safety until the replacement route passes parity and
  update tests, and it must have an owner, tests, and delete gate.

## Implementation Sequence

1. Complete PRD106B and PRD106C gates.
2. Build the route cutover matrix.
3. Choose delivery mode per route.
4. Define SEO/GEO authority per route.
5. Define locale mapping per route.
6. Seed normal account-owned widget instances.
7. Create normal Roma pages for target routes.
8. Publish composed pages through the normal Page Composer path.
9. Integrate Prague route delivery without parsing or mutating composed output.
10. Verify route, SEO/GEO, locale, visual, cache/update, and temporary cutover
    behavior.
11. Delete replaced Astro block rendering/data only after the delete gate passes.

## Blast Radius

Expected touched areas:

- Prague route files under `prague/src/pages/**`.
- Prague `Base`, `Nav`, `Footer`, `WidgetSubnav`, and directory/mega-menu data
  loading only where the chosen delivery mode requires it.
- `prague/src/components/WidgetBlocks.astro` and block components for deletion
  or fencing on migrated routes with owner, tests, and delete gate.
- `prague/src/lib/markdown.ts` and Prague l10n scripts for removing block JSON
  authority on migrated routes.
- `tokyo/prague/pages/**` page JSON and translation sidecars as migration
  source, then deletion/fencing for migrated routes.
- Roma page IDs and Clickeen-owned account instances used for Prague marketing.
- PRD106B public serving/cache behavior.

## Adopted Peer Review Constraints

The peer review's Prague cutover feedback is accepted:

- PRD106D stays blocked until PRD106B and PRD106C close their gates. Prague must
  not fill missing Page Composer or widget capability locally.
- Start with one representative route. Build the cutover matrix for that route,
  prove the end-to-end path, then expand.
- Choose delivery mode before implementation. Agents must not improvise between
  redirect, full-document proxy, same-route shell integration, iframe, or
  fragment behavior.
- If same-route shell integration is chosen, PRD106B must first define the exact
  composed content package shape. Prague must not carve fragments out of full
  documents itself.
- Define replacements for `page-meta`, `navmeta`, directory snippets, widget
  card descriptions, subpage links, and CTA labels before deleting block JSON.
- Temporary cutover safety is allowed only when explicitly approved. It is not
  legacy support, not a product mode, and not a second public product path.
- Search gates proving migrated routes no longer import `WidgetBlocks`,
  `blockRegistry`, `blocks[]`, or Prague block translation sidecars are required
  for each cutover.

The accepted migration posture is: seed normal account-owned instances and pages
for a route, publish through normal Page Composer, integrate the route, verify
SEO/GEO/locale/update propagation, then delete or temporarily fence the old
block path for that route with owner, tests, and delete gate.

## Acceptance

- A Prague page can be represented as a Page Composer stack of real widget
  instances where all required blocks have migrated.
- Updating an included Clickeen instance updates the Prague-composed page output
  without editing Prague Astro block code.
- Prague no longer needs a parallel block implementation for migrated sections.
- Prague keeps only website concerns: chrome, routing, markets, locales, and
  delivery integration.
- Current public route behavior is preserved or intentionally changed in the
  cutover matrix.
- Initial HTML remains crawlable and contains correct title, description,
  canonical, robots, hreflang, `lang`, `dir`, and visible primary content.
- Prague block JSON, `WidgetBlocks`, and block translation sidecars are not used
  by migrated routes after their delete gate passes.
- Cache/update behavior is proven for at least one migrated route.
- Approved temporary cutover path is available until parity is accepted.

## Verification

- Route matrix tests for overview routes, subpage routes, redirects, trailing
  slash behavior, invalid market/locale, and 404s.
- Static HTML assertions for title, description, canonical, robots, hreflang,
  `lang`, `dir`, and primary content.
- Desktop and mobile screenshot parity against current Prague pages.
- RTL and non-Latin locale checks where translation fixtures exist.
- Update propagation test: edit included widget instance, wait for Page Composer
  recomposition, verify Prague route serves updated content.
- Cache/cutover-fence test for recomposition failure or stale page state.
- Search gate proving migrated routes no longer import/use `WidgetBlocks`,
  `blockRegistry`, `blocks[]`, or Prague block translation sidecars.
- Prague build/typecheck and l10n verification updated for the new authority.
