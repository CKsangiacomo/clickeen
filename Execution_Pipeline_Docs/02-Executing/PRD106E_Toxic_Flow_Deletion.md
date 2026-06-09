# PRD106E_Toxic_Flow_Deletion

Status: Draft execution PRD
Owner: Cross-system cleanup owner
Date: 2026-06-05
Parent: `106__Umbrella__Composition_Vision.md`
Depends on:
- `PRD106A_realignment.md`
- `PRD106A2_WidgetShellExtraction.md`
- `PRD106B_PageComposer.md`
- `PRD106C_Prague astro blocks migration to widget instances.md`
- `PRD106D_Prague migration from astro blocks to Page composer.md`
Series step: 9
Unlocks: clean PRD106 execution slate.
Authority owned by this PRD: deletion/fencing of toxic flows, functions, files, routes, tests, storage shapes, docs, and LOCs.
Authority explicitly not owned by this PRD: inventing replacement product behavior, changing product decisions, implementing page/widget features.

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
2. Confirm the PRD that owns the target concern has accepted or fenced the
   surviving authority.
3. Name what survives before deleting what dies.
4. Execute only the current step. Long reference sections are context, not
   execution permission.

A step is green only when its named completion evidence exists. A blocker report
is evidence to stop, not evidence to proceed.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| PRD106A | Drift/deletion target is identified with surviving authority. | REQUIRED |
| PRD106A2 | Shared Shell authority accepted for Shell-related deletions. | REQUIRED for Shell deletions |
| PRD106B | Page Composer authority accepted for page-related deletions. | REQUIRED for page deletions |
| PRD106C/D | Prague migration/cutover authority accepted for Prague deletions. | REQUIRED for Prague deletions |

## Current Step Gate

Current executable step:

```text
Step 1: Build deletion ledger from accepted PRD evidence.
```

Required evidence before marking green:

- Every deletion/fence target has an owning PRD.
- Every target names the surviving authority.
- Every target has a delete/fence decision.

Stop conditions:

- Target's surviving authority is unclear.
- Deleting target would remove current generated account artifacts.

## Execution Steps

| Step | Action | Required evidence | Green criteria | Stop condition |
| ---: | --- | --- | --- | --- |
| 1 | Build deletion ledger from accepted PRD evidence. | Ledger with owner PRD and surviving authority. | Every target has delete/fence decision. | Any target lacks authority. |
| 2 | Delete/fence fake product nouns. | Diff/`rg` evidence. | Fake nouns are gone or fenced outside product paths. | Valid widget identity would be deleted. |
| 3 | Delete/fence wrong-service authority. | Diff/tests/`rg`. | Tokyo/Bob no longer own product logic outside their boundary. | Runtime path needs deleted behavior. |
| 4 | Delete/fence duplicate durable truth. | Diff/tests/`rg`. | One source/publish/dependency authority remains. | Two authorities still active. |
| 5 | Delete/fence duplicate Shell implementations. | Diff/tests/`rg`. | Widgets consume `packages/widget-shell/`. | Core requires copied Shell code. |
| 6 | Delete/fence Prague block product paths. | Diff/screenshot/`rg`. | Migrated routes no longer use block architecture as product truth. | Prague route still needs unmigrated block. |
| 7 | Run final search/test guards. | `rg` output/tests. | No forbidden active hits remain. | Any active forbidden hit lacks fence. |

## Purpose

Delete or explicitly fence active toxic flows, functions, files, routes, tests,
storage shapes, docs, and LOCs that contradict PRD106 product truth.

This PRD is not another architecture document. It is the single execution
deletion ledger for PRD106. PRD106A names authority drift; PRD106E turns those
findings and PRD106B/C/D's desired boundaries into executable deletion or
temporary cutover fence entries with gates, tests, and search guards.

The goal is not to save tokens or hide complexity. The goal is to remove active
code paths that let future agents keep using fake architecture.

## Product Truth

The surviving product path remains:

```text
Roma account -> Bob edits one widget instance -> Roma saves -> Tokyo stores files.
Roma Pages -> selects/orders existing instances -> Page Composer materializes page files -> Tokyo stores files.
Prague -> marketing site/customer of composed output/source material before migration only, not account authoring truth.
```

Surviving authorities:

- Bob edits one widget instance in browser memory. It is not a storage,
  materialization, entitlement, policy, page, or durable side-effect authority.
- FAQ is the approved extraction source for the shared Widget Shell package.
  New/migrated widgets consume `packages/widget-shell/` and replace only
  Widget Core.
- `PRD106A2_WidgetShellExtraction.md` owns the exact Shell extraction and
  validation contract used by this deletion campaign.
- Roma owns account product orchestration, product policy, Page Composer, page
  source, page dependency knowledge, recomposition, and user-facing states.
- Tokyo stores and serves exact bytes submitted by product authorities. It does
  not render, compose, dedupe, infer readiness, track dependencies, or decide
  product policy.
- Prague owns website chrome, route shell, marketing copy still outside Clickeen
  artifacts, and migration source material before migration only. It is not
  account authoring truth and not Page Composer authority.

## Non-Negotiable Preserves

Deletion must preserve the real product behavior:

- Account user can list/create/open/edit/save/rename/duplicate/delete widget
  instances through Roma/Bob.
- Builder edits one active widget instance and one active locale at a time.
- Instance save writes account-owned source and generated browser files through
  the normal product path.
- Instance publish/unpublish still controls standalone public serving.
- Page Composer can select/order/remove account-owned instances and produce one
  page package.
- Public serving uses stored browser-readable files and explicit
  `serve-state.json`.
- Prague pages keep working until a route passes PRD106C/D cutover gates.

If deleting a toxic path breaks one of these behaviors, the old path is not
kept as product truth. Instead, the replacement authority must be completed or
the item must be fenced with an explicit sunset gate.

## Toxic Taxonomy

An active path is toxic when it is any of the following:

- A fake product noun: block, fake/legacy widget-type abstraction, section,
  slot, page builder, website workspace, preset, template, package registry,
  demo mode, or minibob mode presented as account product truth. Real `widget`
  and `widgetType` identifiers are valid when they refer to Clickeen-authored
  widget software.
- A duplicate widget shell: widget-specific Header/CTA/layout/translation
  paths that bypass `packages/widget-shell/`, such as `headline`,
  `subheadline`, `primaryCta`, `secondaryCta`, block-specific layout variants,
  copied FAQ shell code inside each widget, or Prague copy/layout names
  preserved as account widget truth.
- Duplicate durable truth for widget source, page source, publish state,
  translation state, dependency indexes, readiness, or policy.
- Product authority in the wrong service.
- Request-time invention of browser files instead of serving stored files.
- A temporary cutover path that has no owner, no sunset/delete gate, or
  public/user-visible product semantics.
- Test code that preserves fake internals instead of the real boundary.
- Documentation that teaches an old path as current architecture.
- Silent healing, defaulting, or broad acceptance that normalizes invalid product
  truth.

## Scope

### Immediate Deletion Or Movement Candidates

These areas must enter the deletion ledger with refreshed file:line evidence:

- Tokyo page product domain:
  - page create/save/update/delete verbs;
  - page source normalization;
  - page summaries;
  - reverse placement indexes;
  - package readiness;
  - page publish/unpublish product decisions.
- Tokyo page storage shape:
  - `accounts/{account}/website/pages`;
  - `accounts/{account}/website/publishes`;
  - `accounts/{account}/website/indexes/placements`.
- Tokyo route-generated page `embed.js`.
- Roma page code that treats Tokyo page routes/types as product authority.
- Roma page source acceptance that permits blocks, routes, snapshots, widget
  config/content, overrides, or missing account policy.
- Instance-save recomposition that depends on Tokyo reverse placement truth.
- Bob `publicPackage` save payload, after Roma widget materialization parity
  exists.
- Bob-side entitlement, upsell, SEO/GEO, or policy decisions that are more than
  display of Roma-provided decisions.
- Active account product imports of Prague block concepts.
- Active tests that assert old product-shaped page storage, page source, or
  generated embed behavior.

### Fence Scope

These areas may be fenced temporarily only with explicit owner, reason it cannot
be deleted now, public reachability, tests, surviving boundary, sunset, and
delete gate:

- Prague `blocks[]`, `BlockType`, `BLOCK_REGISTRY`, `WidgetBlocks`, block JSON,
  and block translation sidecars until PRD106C/D migrate a route.
- Prague `minibob` as a marketing/funnel surface only. It must not be an account
  authoring mode, save-capable product identity, policy profile, or Builder mode.
- Bob asset upload and manual translation save commands until product ownership
  is clarified. If they survive, they must be named Roma-owned product commands,
  not ambient Builder durability.
- Bob compiled widget/static proxy routes if they are strictly local/dev widget
  software infrastructure and not product save/public authority.
- `public.instances` and related registry paths until a separate approved PRD
  replaces account instance listing/open/publish/translation authority. This PRD
  must not opportunistically delete it unless that replacement scope is approved.

## Deletion Ledger

Every deletion/fence item must use this format before implementation:

```text
Finding:
  id:
  file:line:
  current behavior:
  toxic category:
  violated PRD106 tenet:
  surviving authority:
  recommended action: DELETE_NOW | MOVE_TO_SURVIVING_AUTHORITY | RENAME_TO_TRUE_BOUNDARY | FENCE_NOW_WITH_DELETE_GATE | BLOCKED_PENDING_PIETRO_DECISION
  caller migration:
  storage/data impact:
  tests to add/update/delete:
  search guard:
  deletion gate:
  cutover risk:
  dependent product decision:
```

Rules:

- PRD106E is the only executable deletion ledger. PRD106A may summarize drift,
  but implementation agents must refresh evidence here before editing.
- No stale audit-only deletion. Refresh `file:line` evidence immediately before
  editing.
- A caller existing is not proof the path should survive.
- A test failing because it asserted toxic behavior is a deletion signal, not a
  reason to keep the toxic behavior.
- A file can be deleted only after callers move or the product path is removed.
- A function can be renamed only when the old name itself taught the wrong
  product model.
- A fence must prove the path is not public product truth.

## Temporary Cutover Fence Ledger

Temporary cutover fences are exceptional. Each entry must include:

```text
Temporary Cutover Fence:
  file/routes/storage:
  reason it cannot be deleted now:
  surviving authority already in place:
  owner:
  public/user reachability:
  write behavior:
  sunset/delete gate:
  tests proving it is not product truth:
```

Temporary cutover fences may not:

- preserve duplicate durable truth without an approved migration;
- remain visible in copied snippets, product docs, or public UX;
- recreate old R2/Supabase shapes after deletion;
- silently repair invalid product payloads;
- become the easiest path for future agents.

## Required Service Plans

### Bob

Inventory and delete/fence:

- `publicPackage` generation from save payload after Roma materialization parity.
- Bob-side policy/upsell/SEO/GEO decisions beyond display.
- Durable side-write commands not owned by a named Roma product command.
- Any page/product mode or minibob subject mode affecting shared Builder code.

Preserve:

- Bob preview/editor ergonomics.
- Bob compiler/widget control surface.
- Builder editing one instance in memory.

### Roma

Inventory and delete/fence:

- Page code that treats Tokyo as page product authority.
- Broad page source acceptance.
- Missing account policy/page caps.
- Instance save recomposition dependent on Tokyo placement indexes.
- Failure handling that hides stale/failed recomposition.

Preserve:

- Account context.
- Widget lifecycle.
- Page Composer ownership.
- User-visible failure states.

### Tokyo

Inventory and delete/fence:

- Product-shaped page routes.
- Page source, summary, index, reverse-placement, readiness, publish, and
  generated embed behavior.
- `website/pages`, `website/publishes`, and `website/indexes` page coordinates.

Preserve:

- Storage-safe writes/reads of exact submitted files.
- Explicit serve-state storage/serving at
  `accounts/{account}/pages/{page}/serve-state.json`.
- Standalone instance publish/serve-state behavior.

### Prague

Inventory and delete/fence:

- `BlockType`, `BLOCK_REGISTRY`, `WidgetBlocks`, `blocks[]`, block JSON, and
  block translation sidecars on migrated routes.
- `minibob` as anything other than a marketing/funnel surface.
- `accountInstanceRef` nested live-widget previews. Current PRD106C/D
  migration does not approve them; Split-family embedded-instance behavior is
  deferred until a real account-instance selector exists.

Preserve:

- Website shell until route cutover.
- Nav/footer/market/locale route behavior.
- Prague marketing pages until their composed replacements pass parity.

### Docs And Tests

Inventory and delete/fence:

- Active docs that teach old product nouns or storage shapes.
- Tests that assert Tokyo page product authority, `website/*` page storage,
  generated `embed.js`, Bob `publicPackage` save authority, or Prague blocks as
  PRD106 page architecture.

Preserve:

- Historical executed PRDs may mention old terms when clearly historical.
- Active docs must teach only current/surviving authority.

## Execution Sequence

1. Refresh evidence and fill deletion ledger.
2. Name surviving authority for every item.
3. Decide DELETE_NOW, MOVE_TO_SURVIVING_AUTHORITY,
   RENAME_TO_TRUE_BOUNDARY, FENCE_NOW_WITH_DELETE_GATE, or
   BLOCKED_PENDING_PIETRO_DECISION.
4. Add/adjust tests for the surviving boundary.
5. Move callers to the surviving path.
6. Delete or fence old path.
7. Delete or rewrite tests that preserved the toxic path.
8. Add search/CI guards.
9. Update active docs.
10. Run verification.

Do not start with broad file deletion. Start with authority, callers, tests, and
then remove the old path.

## Adopted Peer Review Findings

The peer review's strongest deletion findings are accepted into PRD106E:

- The PRD106 series must be committed or otherwise made the active execution
  source before implementation agents begin, because the old single
  `PRD106_realignment.md` mental model is now superseded.
- Toxic cleanup is not optional hygiene. It is the substrate PRD that prevents
  PRD106B/C/D from being implemented on fake foundations.
- The deletion campaign must prefer small, provable gates over broad rewrites:
  authority lock, test surviving boundary, move callers, delete/fence old path,
  add search guard.
- A temporary cutover path that survives without owner, sunset/delete gate,
  tests, and non-product reachability is itself toxic.
- Current tests preserving fake internals are deletion targets. They should be
  rewritten around surviving boundaries, not used to preserve drift.
- Rollback restores service availability during cutover only when explicitly
  approved with an owner and delete gate. It does not re-legitimize removed
  architecture.
- Search guards must become part of execution, not an after-the-fact report.

Accepted high-value deletion targets:

- Tokyo page source, summaries, reverse placement indexes, readiness, product
  publish/unpublish, and generated `embed.js`.
- Old `website/pages`, `website/publishes`, and `website/indexes/placements`
  page storage shapes.
- Bob `publicPackage` as save authority after Roma materialization parity.
- Bob-side policy/upsell/SEO/GEO decisions beyond display of Roma decisions.
- Prague block product nouns on migrated product paths.
- Prague block translation sidecars after their routes migrate.
- Any page source acceptance path that permits blocks, routes, snapshots,
  widget config/content, forks, or overrides.

## Verification Gates

Minimum commands:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Targeted gates:

- Bob save payload tests prove `publicPackage` is absent only after Roma
  materialization parity exists.
- Roma tests reject page input containing blocks, sections, route maps, widget
  config/content, HTML snapshots, forks, overrides, or missing ownership.
- Roma tests show affected pages recompose or become stale/failed after included
  instance save.
- Tokyo negative tests prove old product-shaped page source/index/readiness
  routes are gone or fenced.
- Tokyo tests prove old `website/pages`, `website/publishes`, reverse placement
  indexes, and route-generated `embed.js` are gone or fenced.
- Public serving tests prove composed pages come from stored files and explicit
  serve state.
- Prague build/typecheck proves migrated routes no longer depend on
  `WidgetBlocks`, `blockRegistry`, `blocks[]`, or Prague block translation
  sidecars.
- Active docs scan proves old nouns/storage paths survive only in historical or
  explicitly fenced contexts.

Search gates:

```sh
rg -n "website/pages|website/publishes|website/indexes|accountPage|PageSource|verifyAccountPagePublicPackageReady|embed\\.js" \
  tokyo-worker roma documentation Execution_Pipeline_Docs

rg -n "publicPackage|buildSavedWidgetPublicPackage|compiled-widget-route|tokyo-static-proxy|/compiled/route" \
  bob roma documentation Execution_Pipeline_Docs

rg -n "BlockType|BLOCK_REGISTRY|WidgetBlocks|blocks\\[\\]|accountInstanceRef|mode\\\": \\\"extraction|minibob" \
  prague tokyo/prague scripts documentation Execution_Pipeline_Docs

rg -n "productMode|authoringMode|editorMode|subject.*minibob|policy\\.profile.*minibob|systemWidgets|preset|template" \
  bob roma prague packages documentation Execution_Pipeline_Docs
```

Each hit must be one of:

- deleted;
- moved to surviving authority;
- historical executed-doc mention;
- explicit temporary cutover fence ledger entry;
- explicit Pietro product decision preventing deletion.

## Data And Storage Rules

No remote R2/Supabase deletion is allowed without:

- inventory;
- dry run;
- restore manifest;
- proof active code no longer recreates the old shape;
- approval for deleting or migrating the data.

Pre-GA allows hard cuts in code. It does not allow blind deletion of data that
could be needed to validate or restore product behavior.

## Completion Criteria

PRD106E is complete when:

- Every ledger item is deleted, moved, fenced with owner/delete gate, or
  explicitly blocked by a Pietro product decision.
- No active product path contradicts PRD106 authority.
- Tokyo page logic is storage-only.
- Roma owns Page Composer product truth.
- Bob no longer owns product materialization/policy decisions beyond its editor
  role.
- Prague block architecture is absent from migrated product paths and fenced as
  migration source/marketing implementation elsewhere.
- Migrated widgets use `packages/widget-shell/` and only add Widget Core
  content/controls.
- Tests and active docs teach the surviving architecture.
- Search guards have no unexplained hits.

## Product Owner Decisions Applied

- Page source is stored at `accounts/{account}/pages/{page}/source.json`.
- Page output is stored at `accounts/{account}/pages/{page}/index.html`,
  `styles.css`, and `runtime.js`.
- Page serve-state is stored at
  `accounts/{account}/pages/{page}/serve-state.json` and uses `published` /
  `unpublished` like widgets.
- Generated page `embed.js` is a deletion target. Copy/embed behavior uses the
  existing widget embed/public-serving model adapted to page coordinates.
- Draft pages may include unpublished-but-materialized instances. Page publish
  is blocked if any selected instance is unpublished.
- Widget save commits the instance save; affected page recomposition failures
  mark pages stale/failed with retry.
- Page tier policy:
  - Free: 0 pages.
  - Tier 1: 1 page; instances/widgets allowed by that tier.
  - Tier 2: 3 pages; instances/widgets allowed by that tier.
  - Tier 3: 6 pages; instances/widgets allowed by that tier.
  - Tier 4: unlimited pages and unlimited instances/widgets.
  - Views are unlimited for all pages across all tiers.
- `public.instances`, Bob manual translation edits, account asset upload during
  editing, Tokyo translation liveness, and Tokyo instance create/duplicate/
  default-source authority remain outside PRD106E deletion unless a separate
  approved PRD takes them on.
- Prague repo-authored marketing content may remain only as Prague marketing
  fixtures until PRD106C/D migrate it into real widget instances and pages.
