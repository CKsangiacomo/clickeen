# PRD106A_realignment

Status: Active realignment PRD
Owner: Codex execution agent
Date: 2026-06-05
Surviving authority: `Execution_Pipeline_Docs/02-Executing/106__Umbrella__Composition_Vision.md`
Series step: 2
Depends on: `106__Umbrella__Composition_Vision.md`
Unlocks: `PRD106A2_WidgetShellExtraction.md`, `PRD106B_PageComposer.md`, `PRD106C_Prague astro blocks migration to widget instances.md`, `PRD106E_Toxic_Flow_Deletion.md`
Authority owned by this PRD: drift audit, realignment plan, surviving authority map.
Authority explicitly not owned by this PRD: implementing Page Composer, extracting Widget Shell, building Widget Cores, cutting over Prague routes.

This PRD is not a new product idea. It is a cleanup contract for removing code,
docs, tests, names, and workflows that contradict PRD 106's surviving product
truth.

This PRD is green for realignment intent only. It is not green for broad
implementation until each drift item has an owner PRD, replacement boundary,
delete/fence decision, and blast-radius gate. PRD106A may audit, order, fence,
and delete drift. It must not implement Page Composer, Widget Shell extraction,
Prague route cutover, or PRD105 instance/translation replacement work.

If this file conflicts with `106__Umbrella__Composition_Vision.md`, the umbrella
wins.

Sibling PRDs:

- `PRD106B_PageComposer.md` owns the Page Composer implementation boundary.
- `PRD106C_Prague astro blocks migration to widget instances.md` owns the
  Prague block-to-widget migration.
- `PRD106D_Prague migration from astro blocks to Page composer.md` owns the
  Prague site migration from Astro block assembly to composed page output after
  Page Composer and migrated widget instances exist.
- `PRD106E_Toxic_Flow_Deletion.md` owns the executable deletion/fencing ledger
  for toxic active flows, functions, files, routes, tests, and LOCs found during
  this realignment.

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- Treat this long PRD body as reference/evidence. The active execution surface
  is the current step below.
- A blocker report stops execution; it does not unlock the next step.
- Do not clean around toxic mechanisms. Delete, fence, or mark blocked.
- The goal is not to accommodate old drift. If existing code contradicts this
  PRD's intended architecture, delete it, fence it, or stop; do not preserve it
  and work around it.
- Do not preserve fake product nouns, fake product modes, duplicate truth, or
  placeholders just because code still calls them.
- Do not use PRD106A to implement Page Composer, Widget Shell extraction, Prague
  Widget Cores, or Prague route cutover. Those have their own PRDs.
- Every step must end with evidence: `rg` output, diff summary, tests, or a
  precise blocker.

## Dependency Gate

| Dependency | Required green evidence | Status |
| --- | --- | --- |
| Umbrella | Product tenets and authority table are current. | REQUIRED |

## Current Step Gate

Current executable step:

```text
Step 2: Dependency And Cutover Plan
```

Required evidence before marking green:

- Every audited drift item has a surviving authority.
- Every audited drift item has an owner PRD or explicit follow-up approval
  requirement.
- Every audited drift item has a delete/fence/block decision.
- Cross-service blast radius is listed before implementation edits.

Stop conditions:

- A drift item has no surviving authority.
- A product decision is missing.
- A drift item would require Page Composer, Widget Shell, Prague migration, or
  PRD105 replacement implementation inside PRD106A.

## Step-Gated Execution

### Step 1 - Audit Freeze

Scope: identify active drift without editing product code.

Allowed:

- Read current code/docs/tests.
- Record drift against the umbrella and this PRD.
- Produce exact deletion/fencing targets.

Not allowed:

- Implement fixes.
- Rename concepts.
- Add compatibility layers.

Green:

- Evidence list identifies fake nouns, wrong-service authority, duplicate
  instance truth, Page Composer drift, Prague block drift, and copied Widget
  Shell drift.

Stop if:

- The surviving authority for a concern cannot be named.

### Step 2 - Dependency And Cutover Plan

Scope: order deletion/fencing safely across Roma, Bob, Tokyo, Prague, and docs.

Allowed:

- Define which PRD owns each cleanup.
- Mark blockers for PRD106B, PRD106A2, PRD106C, PRD106D, or PRD106E.

Not allowed:

- Execute cross-PRD work locally inside PRD106A.

Green:

- Each drift item has a surviving authority, owner PRD, and delete/fence
  decision.

Stop if:

- Any drift item requires a product decision not already recorded.

### Step 3 - Delete Fake Product Nouns

Scope: remove/fence fake product nouns from active execution paths.

Allowed:

- Delete or fence active `block`, fake `widget type`, preset/template/demo mode,
  old page builder, and minibob-as-product paths.

Not allowed:

- Delete valid `widget` or `widgetType` references that identify Clickeen-authored
  widget software.

Green:

- Search guards show fake nouns are absent from active product paths or are
  explicitly fenced as non-product/migration source.

Stop if:

- A fake noun is still required by active account authoring.

### Step 4 - Restore Service Boundaries

Scope: enforce Bob/Roma/Tokyo ownership.

Allowed:

- Fence or delete Tokyo product-brain behavior.
- Fence Bob materialization/policy authority outside its editor role.
- Restore Roma as product orchestration authority.

Not allowed:

- Move Page Composer implementation into Tokyo.
- Make Bob a page product.

Green:

- Active routes follow: Bob edits, Roma orchestrates/composes, Tokyo stores and
  serves submitted files.

Stop if:

- A required runtime path still depends on Tokyo product composition.

### Step 5 - Fence Duplicate Durable Truth

Scope: eliminate PRD106 page duplicate source/publish/dependency truth and
fence broader PRD103/105 duplicate truth for explicit follow-up.

Allowed:

- Delete/fence obsolete page source, publish/readiness, reverse index, instance
  source, and old package authority shapes.

Not allowed:

- Delete generated package bytes needed as current account artifacts.

Green:

- One authority remains for widget source, page source, publish state,
  dependency knowledge, and Shell architecture.
- `public.instances`, Tokyo instance registry, and translation liveness are
  marked follow-up-only unless a separate approved PRD owns replacement.

Stop if:

- Two active paths still claim the same durable product truth.

### Step 6 - Align Product UI And Docs

Scope: ensure Roma/Bob/Prague/docs teach the surviving model.

Allowed:

- Update labels, navigation, errors, docs, and tests to the surviving authority.

Not allowed:

- Add new UX flows not specified by PRD106B/C/D.

Green:

- User-facing surfaces and docs no longer teach deleted concepts.

Stop if:

- UI needs a product decision not recorded in the owning PRD.

## Problem

PRD 106 was supposed to add one simple product noun: page.

The intended model is:

- Widgets are Clickeen-authored software units that produce browser-readable
  code.
- Widget instances are account-owned saved widgets created/edited through
  Roma/Bob and saved in Tokyo.
- Pages are account-owned browser-readable code composed from X widget
  instances.
- Bob edits one widget in browser memory and submits save.
- Roma owns account routing, tier/product permission, save acceptance, page
  composition, and user-facing product errors.
- Roma Pages selects, orders, removes, saves, and publishes widget instances as a
  page. It must not edit the instances it uses.
- Tokyo stores submitted files in R2 and serves already-stored public files.
- Clickeen/admin examples are normal account-owned widgets and pages.

The implementation drifted into extra nouns and authorities: blocks, catalogs,
demo/minibob paths, Bob policy state, Prague-specific product branches, and
Tokyo product-shaped page authority. Some drift was deleted, but the system has
not been fully realigned.

## Goal

Make the active repo obey the PRD 106 tenets with the smallest possible product
surface:

```text
widget instance = one account-owned widget compiled to browser-readable files
page            = X widget instances compiled together to browser-readable files
```

Everything else is either:

- widget software under the system widget source;
- Roma account/product orchestration;
- Bob browser-memory editing;
- Tokyo R2 storage and public file serving;
- Prague marketing implementation that cannot define product architecture.

Tokyo has no business in Page Composer. It does not decide page input,
dependencies, recomposition, dedupe, SEO/GEO, or readiness. Roma sends finished
files; Tokyo stores and serves them.

The product proof is the WordPress embed workflow:

1. A user saves one widget instance, copies its embed line, pastes it into a
   WordPress div, and WordPress shows that instance.
2. The user creates more widget instances, opens Clickeen Pages, selects/orders
   several instances, saves/publishes the page, copies the page embed line, and
   pastes it into the same kind of WordPress div. WordPress shows X Clickeen
   instances stacked together.
3. The user edits one of those instances through the normal Builder/Bob path and
   saves. WordPress keeps the same page embed line, and the page shows the
   updated instance after recomposition.

Any implementation that requires repasting into WordPress after an instance edit,
or lets the page keep a stale copy of the edited instance, violates PRD 106.

## Non-Goals

- Do not redesign the page product.
- Do not add execution sub-PRDs unless a deletion pass proves a real split is
  needed.
- Do not add shims for fake modes.
- Do not preserve old terms just because code calls them.
- Do not make Prague blocks a product concept by renaming them only in docs.
- Do not move product authority from one wrong service to another wrong service.

## Operating Rules

Before each edit:

1. Name the surviving authority for the concern.
2. Identify the fake noun or duplicate authority being removed.
3. Prefer deletion over adapters, flags, temporary bridges, or renamed layers.
4. Keep write scopes small and verifiable.
5. Do not add tests that preserve hallucinated internals.
6. Add or update tests only when they protect a surviving product boundary.
7. Keep documentation truth aligned in the same change.
8. Do not execute narrative audit sections as implementation permission. Every
   implementation-shaped finding must route to the owner PRD named in the
   dependency/cutover plan.

## Pre-Execution Scope Gate

PRD106A is a realignment PRD, not permission to rewrite every current
PRD103/105 mechanism in one pass. Its primary target is drift that blocks the
PRD106 page/product boundary.

PRD106A's "Tokyo stores files only" rule applies to PRD106 page composition and
page delivery. Current Tokyo instance operations and translation machinery that
exist under PRD105 are explicitly out of scope for PRD106A implementation unless
a separate approved PRD takes them on.

Allowed immediately under PRD106A:

- delete, move, or fence PRD106 page-composition drift;
- remove page-owned instance edits, page overrides, page snapshots, blocks,
  route maps, website workspaces, publish folders, and Tokyo page composition;
- make Roma the explicit owner of page input acceptance, page recomposition
  intent, and page-facing errors;
- make Tokyo store/serve only the exact page files Roma submits.

Requires a named follow-up PRD or explicit human approval before implementation:

- replacing `public.instances` as current instance listing/open/publish truth;
- moving all Tokyo instance create/duplicate/default semantics;
- moving translation liveness/generation authority out of Tokyo;
- moving durable asset upload out of Bob;
- changing Supabase migration history or seed strategy.

Those areas are listed because they are architectural drift against the
umbrella, but they are also live PRD103/105 machinery. Agents must not delete
them opportunistically while "cleaning pages." For any dependent edit, stop and
name the follow-up PRD or get explicit confirmation.

## Intended Product Architecture

The surviving architecture users should experience is:

```text
Roma Widgets -> create/open account widget instances.
Bob Builder  -> edit one instance in browser memory.
Roma Save    -> accept save, enforce account/tier policy, materialize widget files.
Tokyo        -> store and serve exact submitted files.
Roma Pages   -> select/order existing instances and compose page files.
clk.live     -> serve stored instance/page files behind stable public URLs.
```

Allowed minimal page input:

- page identity owned by the account;
- ordered references to account-owned widget instances;
- page-level metadata needed for composed output, such as title, description,
  robots, canonical, and structured data, only if PRD106B approves the exact
  fields;
- explicit publish/unpublish intent.

Forbidden page input:

- widget instance config/content;
- inline Builder edits;
- page-specific instance overrides;
- instance forks, snapshots, or frozen HTML copies;
- blocks, sections, slots, columns, containers, route maps, slugs, nav, or site
  settings;
- dependency indexes, recomposition reasons, SEO intent, or readiness semantics
  sent to Tokyo.

Approved PRD 106 delivery:

```text
single widget: https://clk.live/{accountPublicId}/{instanceId}
composed page: https://clk.live/{accountPublicId}/pages/{pageId}

page files:
accounts/{accountPublicId}/pages/{pageId}/source.json
accounts/{accountPublicId}/pages/{pageId}/index.html
accounts/{accountPublicId}/pages/{pageId}/styles.css
accounts/{accountPublicId}/pages/{pageId}/runtime.js
```

Page publish state works like widget publish state: `published` or
`unpublished`. Roma owns publish/unpublish intent; Tokyo stores the submitted
page source, output files, and serve-state bytes as account R2 files. Tokyo must
not derive that state from page source, page input, dependency indexes, or file
contents.

Page composition source lives beside page output, the same way widget instance
source lives beside widget output. `source.json` stores page identity, allowed
metadata, and ordered instance references. `index.html`, `styles.css`, and
`runtime.js` are generated browser-readable output.

Tokyo may store `source.json` only as an opaque allowlisted file submitted by
Roma. Tokyo must not parse, normalize, summarize, index, validate, or derive
placement/dependency/product state from that file. Roma owns the meaning of page
source and any derived affected-page lookup.

Roma widget materialization must use the same system widget software inputs as
Bob preview: the shared Widget Shell package, the Widget Core definition, and
shared Dieter/runtime contracts. Before removing the old Bob `publicPackage`
surface, add parity coverage that Bob preview, Roma materialization, and Page
Composer input are generated from the same saved widget state and widget
definition contract.

Widget Shell authority:

- FAQ is the approved implementation reference for normal widget architecture.
- Every normal widget is `Widget Shell + Widget Core`.
- The surviving Widget Shell authority must be a shared repo package,
  `packages/widget-shell/`, not copied FAQ code and not a Tokyo-owned helper
  folder.
- `PRD106A2_WidgetShellExtraction.md` owns the detailed extraction contract:
  exact FAQ source files, Shell panels, Shell state paths, Core extension rules,
  validation, and acceptance gates.
- Widget Shell means the FAQ-proven Stage, Pod, Header, CTA, Header layout,
  Header CTA appearance, Stage/Pod layout, Stage/Pod appearance, Typography,
  locale switcher, branding/settings, editable-fields translation mechanism,
  Bob preview, Roma save/materialization, and runtime/package pattern.
- `packages/widget-shell/` owns shell schema/defaults, shell editor controls,
  shell renderer/helpers, shell CSS/runtime helpers, and shell validation.
- Header always means title, optional subtitle, and optional CTA through
  `header.*` and `headerCta.*`.
- New or migrated widgets must consume the shared Widget Shell and add only the
  new Widget Core content, Core controls, Core editable fields, and Core
  runtime/CSS.
- Duplicate widget-specific paths such as `headline`, `subheadline`,
  `primaryCta`, `secondaryCta`, `copyWidth`, `bodyWidth`, and
  `layout.variant` are deletion targets unless a child PRD explicitly records
  Pietro's approval for a separate widget architecture.
- Current `tokyo/product/widgets/{widget}/` folders are repo product source
  locations for Widget Core definitions and package assets. They are not
  evidence that Tokyo owns widget architecture.
- Countdown and Logo Showcase gold-standard upgrades are rebase work: keep the
  shared Widget Shell, replace/fix only Countdown Core behavior and Logo
  Showcase Core behavior.

## Intended Product UX

The cleanup must preserve and clarify these workflows:

- Widgets tab: the user sees available widget definitions with a Create action.
  These are not templates, presets, examples, or catalogs. Existing rows are
  account-owned widget instances with edit/rename/duplicate/delete/publish
  actions according to Roma account policy.
- Builder: the user edits one widget instance, sees the preview for that same
  instance, and saves through Roma. Bob can show host-provided policy messages,
  but cannot calculate policy or upsell authority.
- Pages tab: the user creates a page, bulk-selects existing saved instances from
  a large Add Instances surface, reorders/removes references in the page stack,
  saves/publishes the page, and copies one stable page embed/public URL.
- Propagation: when the user edits an included widget instance and saves it,
  Roma recomposes every affected page. The old page embed line keeps working and
  the page reflects the updated instance.
- Prague funnel: visitors may preview public artifacts and use signup CTAs, but
  Prague cannot create durable account truth. Durable widgets/pages start only
  in authenticated Roma account flows.

Visible failure states must be Roma-owned:

- instance missing, unowned, deleted, invalid, unpublished when publish requires
  published inputs, or lacking materialized files;
- page with zero instances if empty draft pages are allowed but publish is not;
- account/tier denial for create, save, publish, or cap overflow;
- public page request after unpublish/delete/missing stored files;
- widget save accepted but affected page recomposition failed or is stale.

The last case is resolved product behavior: the widget save remains committed,
and Roma exposes affected pages, stale/failed recomposition status, and a
retry/recompose path.

## Evidence Refresh Required

The consolidated ledger below is a directionally useful audit, but it is not a
license for blind deletion. Before code execution on any ledger item, refresh the
evidence with current `file:line` references and record:

```text
Finding:
  file:line
  surviving authority:
  violated tenet:
  why it violates:
  recommended action: delete | move | rename | keep with explicit boundary
  dependent product decision:
  rollback risk:
```

If the evidence points at live PRD103/105 machinery rather than PRD106 page
drift, stop and route that item to a named follow-up PRD or human confirmation.

## Tenet Audit Matrix

Each tenet gets a separate audit. The output must include concrete file/line
evidence, deletion targets, risks, and the surviving owner.

### 1. Widgets are software and live in the system

Surviving authority:

- `packages/widget-shell/` is shared widget architecture truth.
- Current `tokyo/product/widgets/{widget}/` folders are repo product source for
  Widget Core software and package assets. Existing code may still spell this
  coordinate `widgetType`; that is implementation naming, not a product noun and
  not Tokyo service ownership of widget architecture.
- Roma may list available widgets for account creation.
- Account data may reference widget identity/code, but cannot define widget
  software.

Pollution to remove:

- Widget catalog as product truth.
- Prague marketing blocks treated as widgets or product sections.
- Account/admin/example data that pretends to define system widgets.
- Duplicate widget metadata sources unless they are explicitly product-owned
  display/reference data.

### 2. Users create instances in Roma/Bob and save them in their account in Tokyo

Surviving authority:

- Roma account routes own create/open/save commands.
- Bob edits the in-browser working copy.
- Tokyo stores account instance input and submitted browser-readable files.

Pollution to remove:

- Durable anonymous/demo/minibob instance saves.
- Parallel Michael/account instance tables as product truth.
- Presets/catalogs that behave like widget instance input.
- Admin-only create/duplicate lanes.

### 3. Pages are composed browser files from widget instances

Surviving authority:

- A page is composed from one or more account-owned widget instances.
- A widget instance is the atomic editable unit. Pages can use instances, but
  cannot edit, override, fork, or snapshot them.
- The public page output is ordinary browser-readable code:
  `accounts/{accountPublicId}/pages/{pageId}/index.html`,
  `accounts/{accountPublicId}/pages/{pageId}/styles.css`, and
  `accounts/{accountPublicId}/pages/{pageId}/runtime.js`.
- Any saved list/order needed to recompose a page is page input owned by Roma's
  product boundary. It must not become a separate product architecture called
  page source, website workspace, publish folder, block tree, or route map.
- Tokyo stores and serves the submitted page files. It has no page-composition
  authority.

Page Composer authority:

- Page Composer is the Roma-owned, dependency-aware materializer for pages.
- It tracks which pages use which widget instances so an instance save can
  trigger recomposition of every affected page.
- It composes the current browser-readable files of selected widget instances
  into one page `index.html`, one page `styles.css`, and one page `runtime.js`.
- It dedupes shared CSS/runtime contributions and keeps per-instance runtime
  state isolated.
- It produces crawlable, semantic, SEO/GEO-friendly page output: real initial
  content, ordered sections, page title/description/robots/canonical, and
  structured data where valid.
- It coordinates page-level localization across included instances by resolving
  one page locale context from IP/country rules, page default locale, or the
  optional Clickeen-owned top-of-page language switcher.
- It fails visibly when selected instances are missing, unowned, invalid, stale,
  or not ready to compose.
- None of this authority belongs to Tokyo. Tokyo must not track dependencies,
  decide recomposition, dedupe CSS/runtime, generate SEO/GEO metadata, decide
  page readiness, resolve page locale behavior, or interpret page input.

Pollution to remove:

- Blocks, sections, containers, slots, route maps, slugs, nav, or site nouns as
  PRD 106 page model.
- Bob page mode.
- Page-owned instance edits, page-specific overrides, forked instances, frozen
  instance snapshots, or inline Builder controls inside the page domain.
- Composer logic that blindly concatenates repeated CSS/JS, produces stacked
  iframes instead of one document, hides stale outputs, or generates request-time
  page output.
- Any Tokyo code path that needs the selected instance list, dependency graph,
  recomposition reason, CSS/runtime dedupe plan, SEO/GEO intent, or readiness
  meaning.
- Page input copied into Prague, Michael, or generated files as product truth.
- Any page composition path that does not start from saved widget instance files.
- Customer host-nav language integration as the required page localization path.
  Customer pages use IP localization and the optional Clickeen page switcher;
  only Clickeen-owned Prague/site pages may be manually wired to Clickeen's own
  language controls.

### 4. Bob is an editor: open/edit in browser memory/user save

Surviving authority:

- Bob receives one open payload for one widget instance.
- Bob changes React/browser state.
- Bob save delegates to Roma.

Pollution to remove:

- Bob product policy authority.
- Bob tier/upsell decision authority.
- Bob page state/page editor authority.
- Bob demo/minibob subject modes that can shape shared Builder behavior.
- Bob durable storage or account routing assumptions.

### 5. Tokyo is responsible for R2, nothing more

Surviving authority:

- Tokyo receives exact storage payloads from Roma.
- Tokyo validates storage safety only: account coordinate, allowed path, file
  shape, allowlisted browser files, content type, and object existence.
- Tokyo writes/reads/deletes R2 objects and serves already-stored public files.
- Tokyo may enforce mechanical file-serving gates such as "is this object allowed
  to be public?" only when Roma has submitted that state explicitly. It must not
  derive product meaning from page contents or page inputs.

Pollution to remove:

- Tokyo product policy.
- Tokyo page composition or widget rendering.
- Tokyo source/product invention.
- Tokyo repair/healing of invalid product state.
- Tokyo dependency tracking, reverse placement indexes, recomposition triggers,
  CSS/runtime dedupe, SEO/GEO metadata generation, or page readiness decisions.
- Tokyo package registries, page source authorities, website workspaces, publish
  folders, route maps, slugs, blocks, or product-level publication decisions
  beyond explicit file-serving state requested by Roma.

### 6. Roma is the app

Surviving authority:

- Roma routes the user to their current account.
- Roma checks account/tier authority.
- Roma accepts or rejects saves.
- Roma composes page files from saved widget instance files and page input.
- Roma Pages arranges widget instances only. Instance editing stays in Bob.

Pollution to remove:

- Roma delegating product decisions to Bob, Prague, or Tokyo.
- Roma hiding duplicate widget/page truths behind caches or duplicate grouping.
- Roma preserving fake modes instead of account/tier authority.
- Roma page UI/API that edits instance config/content or creates page-owned
  instance overrides.
- Roma create/list UI that does not reflect system widgets plus account
  instances/pages.

### 7. Clickeen uses Clickeen

Surviving authority:

- Admin/Clickeen is a normal account with broader permissions.
- Admin examples are normal account-owned instances and pages.
- Prague can embed public admin-owned instances, but cannot create a separate
  product lane.

Pollution to remove:

- Admin-only storage, API, widget, page, preset, or demo lanes.
- Minibob/demo examples that become durable product truth.
- Prague references that bypass normal account-owned instance/page artifacts.
- Special product branches for Clickeen-authored content.

## Authority Drift Audit Summary

This section is an audit summary, not the executable deletion ledger.

PRD106A names authority drift and surviving ownership. PRD106E is the only
execution deletion ledger. Before any implementation edit, each item below must
be refreshed with current file:line evidence and entered into PRD106E's deletion
or temporary cutover fence ledger with caller migration, tests, search guard,
data impact, and delete gate.

This summary is intentionally blunt: each item names a live surface that must be
deleted, moved, renamed to its true boundary, fenced with a delete gate, or
blocked pending Pietro decision before PRD 106 can be called realigned.

### A. Prague still teaches fake product nouns

Violated tenets:

- Widgets are system software.
- Pages are composed browser files from widget instances.
- Clickeen uses Clickeen.

Evidence:

- `prague/src/lib/blockRegistry.ts` defines `BlockType`, `BLOCK_REGISTRY`, and
  `minibob`.
- `prague/src/components/WidgetBlocks.astro` renders `blocks[]` through a
  product-shaped switch, including a `minibob` branch.
- `prague/src/blocks/minibob/minibob.astro` keeps a named demo lane around a
  public account instance embed.
- `tokyo/prague/pages/**.json` stores repo-authored Prague page-like data using
  `blocks[]`, `minibob`, and stale fields such as `mode: "extraction"`.
- `prague/src/lib/markdown.ts` loads `tokyo/prague/pages/**/*.json`, requires
  `blocks[]`, and validates account instance refs from that special source tree.
- `scripts/prague-l10n/*`, `sanfrancisco/src/agents/l10nPragueStrings.ts`, and
  `prague/content/allowlists/v1/blocks/**` preserve a Prague block translation
  model.

Required action:

- Fence Prague block vocabulary as marketing-only implementation that cannot be
  confused with PRD 106 pages.
- Keep the current Prague-derived Tokyo widgets as partial migration artifacts
  while PRD106C maps them properly. They are approximately 50% complete: they
  compile/open in Bob and have initial widget shells, but they do not yet prove
  faithful Prague block migration, real defaults, complete layout controls, or
  production-ready instance behavior.
- Delete `minibob` as a product/demo mode. If Prague needs a marketing embed,
  make it an explicit public artifact embed plus signup CTA, not a Builder mode
  or product noun.
- Replace `tokyo/prague/pages/**` as PRD 106 page data with either normal
  account-owned public widget/page references or a renamed Prague marketing
  fixture path.

Risk:

- Prague marketing pages may still need repo-authored copy before account-owned
  pages are production-ready. If so, the temporary surface must be renamed and
  fenced in code, docs, scripts, and AI build guides.

### B. Bob still owns more than browser-memory editing

Violated tenets:

- Bob is an editor: open/edit in browser memory/user save.
- Roma is the app.

Evidence:

- Current `bob/lib/session/useSessionSaving.ts` submits widget state/save intent,
  not a `publicPackage`. Keep that as the target behavior.
- `bob/lib/session/publicPackage.ts` and any remaining imports are legacy package
  materialization surface and must be deleted/fenced once Roma materialization
  parity is green.
- `roma/app/api/account/instances/[instanceId]/route.ts` currently owns widget
  package materialization on save. That is closer to the intended architecture,
  but it must prove parity with Bob preview and Page Composer input before old
  Bob package/server paths are deleted.
- `bob/app/api/widgets/[widgetname]/compiled/route.ts` and
  `bob/lib/api/compiled-widget-route.ts` expose a Bob server API that reads
  widget source/browser-file inputs.
- `bob/lib/tokyo-static-proxy.ts` and Bob `app/assets`, `app/widgets`,
  `app/dieter`, `app/l10n`, and `app/fonts` proxy routes make Bob own
  static/account routing.
- `bob/lib/session/sessionTypes.ts`, `bob/lib/session/useSessionBoot.ts`, and
  `bob/lib/session/WidgetSessionChrome.tsx` carry account policy and upsell
  state.
- `bob/components/EmbedModal.tsx` and `bob/components/CopilotPane.tsx` make
  entitlement/readiness decisions from Bob policy state.
- `bob/lib/session/sessionTransport.ts` and `bob/components/TranslationsPanel.tsx`
  expose a durable translated-value save lane from Bob.
- `bob/lib/session/sessionTransport.ts` exposes durable account asset upload
  during editing.

Required action:

- Preserve the current Bob save payload shape: Bob submits edited widget state
  and explicit save intent only.
- Delete/fence the old Bob `publicPackage` and compiled-widget server surfaces
  only after Roma materialization parity is green.
- Remove policy/upsell authority from Bob. Bob may display host-provided
  messages, but cannot decide account/tier capability.
- Delete or fence Bob server/proxy routes as non-product local development
  infrastructure.
- Decide whether translation review and asset upload are separate Roma-owned
  durable product commands or must wait for the single widget save.

Risk:

- Moving browser-file generation requires Roma to have the same compiled widget inputs
  Bob currently uses. If this is split incorrectly, widget save output and page
  recomposition can diverge.

### C. Tokyo still owns product authority instead of storage only

Violated tenets:

- Tokyo is responsible for R2, nothing more.
- Roma is the app.
- Pages are composed browser files from widget instances.

Evidence:

- `tokyo-worker/src/routes/internal-page-routes.ts` exposes product-shaped
  create, save, delete, publish, and unpublish page verbs.
- `tokyo-worker/src/domains/pages/types.ts` defines page product schema in
  Tokyo.
- `tokyo-worker/src/domains/pages/source.ts` normalizes product fields, derives
  summaries, maintains `pages/index.json`, and maintains reverse placement
  indexes. That dependency graph belongs to Roma Page Composer, not Tokyo.
- `tokyo-worker/src/domains/pages/package-files.ts` decides package readiness
  for publish. Page readiness is a Roma Page Composer/product concern, not a
  Tokyo storage concern.
- `tokyo-worker/src/domains/pages/keys.ts` stores pages under the invented
  `accounts/{account}/website/pages` and
  `accounts/{account}/website/publishes` architecture instead of the parallel
  instance-like page path.
- `tokyo-worker/src/routes/clk-live-routes.ts` route-generates page `embed.js`
  instead of serving only submitted browser files.
- `tokyo-worker/src/domains/account-instances/operations.ts` creates instances
  from widget defaults, mints IDs, and duplicates source.
- `tokyo-worker/src/domains/account-instances/source.ts` splits/recombines
  config/content, remaps overlays, and repairs locale sync state.
- `tokyo-worker/src/domains/account-translations/operations.ts` resolves AI
  runtime policy/budgets and owns translation generation liveness.
- `tokyo-worker/src/domains/widget-definitions.ts` builds an in-worker widget
  definition/defaults registry.

Required action:

- Collapse Tokyo page routes toward storage commands: write/read/delete page
  browser files under `accounts/{accountPublicId}/pages/{pageId}/`.
- Delete the `website/pages` and `website/publishes` storage shape.
- Move page input acceptance and product validation into Roma.
- Move page dependency tracking, affected-page lookup, recomposition triggers,
  CSS/runtime dedupe, SEO/GEO metadata generation, and readiness decisions into
  Roma Page Composer.
- Delete reverse placement indexes, package readiness logic, page summaries, and
  page source normalization from Tokyo.
- Move product create/duplicate/default-source semantics out of Tokyo or mark
  them as a deliberate pre-existing exception with a separate corrective PRD.
- Delete generated `embed.js` from Tokyo. Page copy/embed behavior must use the
  existing widget embed/public-serving model adapted by PRD106B.
- Decide whether translation liveness in Tokyo is outside PRD 106 scope or must
  be realigned too.

Risk:

- Roma currently depends on Tokyo product-shaped routes. Cutting Tokyo first will
  break current flows. The endpoint shape must be changed in lockstep with Roma.

### D. `public.instances` is a second instance truth

Violated tenets:

- Users create instances in Roma/Bob and save them in their account in Tokyo.
- Tokyo is responsible for R2, nothing more.

Evidence:

- `supabase/migrations/20260522090000__prd103_db_core_foundation.sql` creates
  `public.instances`.
- `supabase/migrations/20260522114000__prd103_current_instance_registry_seed.sql`
  seeds durable instance rows, including admin examples.
- `supabase/migrations/20260526110000__prd104a_admin_account_coordinate.sql`
  migrates admin instance rows.
- `supabase/migrations/20260528120000__prd105_translation_generation_operations.sql`
  creates translation-operation foreign keys to `public.instances`.
- `tokyo-worker/src/domains/account-instances/registry.ts` reads, lists, creates,
  updates, and deletes instance identity through Supabase.
- `tokyo-worker/src/domains/account-instances/source.ts` resolves source pointers
  through the registry and lists registry rows before hydrating R2.
- `tokyo-worker/src/domains/account-instances/serve-state.ts` reads/writes
  publish state through the registry.
- `tokyo-worker/src/routes/clk-live-routes.ts` checks registry-backed serve state
  before reading R2 browser files.
- `tokyo-worker/src/domains/account-translations/operations.ts` writes derived
  translation status back to the instance registry.

Required action:

- Replace `public.instances` as durable instance authority.
- Move publish state out of Michael/Supabase and into the account-owned Tokyo
  path, unless a separate account-governance PRD explicitly keeps a derived
  projection.
- Remove copied `translation_status` from instance identity rows.
- Replace FK dependency from translation operations to `public.instances` with a
  boundary that validates account instance existence without making Michael the
  owner.
- For pre-GA migration cleanup, remove old `widget_instances`,
  `curated_widget_instances`, and `wgt_*` residues if migrations are being
  squashed.

Risk:

- Current runtime likely uses `public.instances` for listing, opening,
  publishing, serving, and translation gates. Removing it requires a replacement
  R2 read/list path or an explicitly derived, non-authoritative index.

### E. Roma does not yet fully own account/page acceptance

Violated tenets:

- Roma is the app.
- Pages are composed browser files from widget instances.

Evidence:

- `roma/app/api/account/pages/route.ts` creates pages for any editor without a
  page entitlement or page cap.
- `roma/components/pages-domain.tsx` enables create page based only on mutation
  state.
- `roma/components/pages-domain.tsx` must remain an arrangement surface. Any
  inline instance editing, override controls, fork/snapshot actions, or
  page-owned instance state would violate PRD 106.
- `roma/app/api/account/pages/[pageId]/route.ts` accepts a page source object
  from the old architecture after only route/content ID matching, then delegates
  deeper acceptance downstream.
- `roma/app/api/account/pages/[pageId]/publish/route.ts` checks role and empty
  placements, but does not apply page-specific tier/account policy.
- `roma/lib/account-instance-direct.ts` can save an instance and then report a
  failure if downstream page recomposition fails, leaving UX and stored state out
  of sync.

Required action:

- Add Roma-owned page create/save/publish policy gates.
- Enforce page tier policy:
  - Free: 0 pages.
  - Tier 1: 1 page; instances/widgets allowed by that tier.
  - Tier 2: 3 pages; instances/widgets allowed by that tier.
  - Tier 3: 6 pages; instances/widgets allowed by that tier.
  - Tier 4: unlimited pages and unlimited instances/widgets.
  - Views are unlimited for all pages across all tiers.
- Replace page source validation with Roma-owned page input validation: which
  widget instances are selected, in what order, and whether the account is
  allowed to compose/publish the resulting page files.
- Add explicit guards or tests that page save input cannot carry instance
  config/content, page-specific instance overrides, fork/snapshot instructions,
  or inline edit payloads.
- Add dependency/recomposition behavior at the Roma Page Composer boundary:
  saving an instance must identify affected pages and recompose their page files.
- Add composer output validation for deduped shared CSS/runtime, isolated
  per-instance runtime state, and crawlable SEO/GEO page HTML.
- Empty draft pages are allowed; publish is blocked until the page has at least
  one valid selected instance.
- Widget save succeeds when the instance save succeeds. Affected page
  recomposition failures are surfaced on the page as stale/failed with retry;
  they do not silently roll back the saved instance.

Risk:

- Page policy must be enforced in Roma before page create/publish, not in Bob or
  Tokyo.

### F. Duplicate widget metadata/reference data still exists

Violated tenets:

- Widgets are software and live in the system.
- Roma is the app.

Evidence:

- `prague/src/lib/widgetLabels.ts` hardcodes label/category data for a subset of
  widgets.
- Roma API/UI uses `systemWidgets` terminology for available widget definitions.
- Prague page JSON and docs still use examples/templates/presets language that
  can be mistaken for reusable instance sources.

Required action:

- Source widget labels from the system widget definition/reference boundary or
  rename/fence Prague labels as marketing-only display copy.
- Rename Roma `systemWidgets` to `widgetDefinitions` or `availableWidgets` if
  the current name keeps causing catalog confusion.
- Delete docs that ask for `templates.json`, preset lanes, or catalog-like
  example sources.

Risk:

- A label list can be harmless display copy, but if it becomes the place agents
  add widgets, it is another catalog.

### G. Documentation still contradicts the umbrella

Violated tenets:

- All of them.

Evidence:

- `documentation/architecture/CONTEXT.md` still says Tokyo owns broad instance
  product operations and publish/unpublish authority.
- `documentation/services/tokyo-worker.md` still describes Tokyo product verbs,
  policy, liveness, and publish verification.
- `documentation/services/tokyo.md` still describes instance listing through
  Tokyo operations backed by DB rows.
- `documentation/services/bob.md`, `documentation/capabilities/multitenancy.md`,
  and `packages/ck-policy/src/registry.ts` still describe Bob policy/upsell
  enforcement.
- `documentation/services/prague/*`, `documentation/ai/BUILD_PraguePage.md`,
  `documentation/widgets/WidgetComplianceSteps.md`,
  `documentation/widgets/WidgetGTMStrategy.md`,
  `documentation/widgets/WidgetPraguePagesBuilder.md`,
  `documentation/widgets/FAQ/FAQ_PraguePages.md`,
  `documentation/strategy/Clickeen-Babel.md`,
  `documentation/strategy/MarketPosition.md`, and
  `documentation/strategy/WhyClickeen.md` still contain block, minibob, demo,
  template, or blocks/pages language.

Required action:

- Rewrite docs only after each code boundary is corrected or deliberately
  fenced.
- Historical terms may remain only in explicitly historical sections.
- AI build guides must not instruct agents to build PRD 106 with blocks,
  catalogs, templates, or minibob.

## Required Audit Evidence

For each finding:

```text
Finding:
  file:line
  surviving authority:
  violated tenet:
  why it violates:
  recommended action: delete | move | rename | keep with explicit boundary
  risk:
```

Do not encode agent names, codenames, or audit staffing into the PRD. The
product-relevant artifact is refreshed evidence plus surviving authority.

## Adopted Peer Review Gates

The peer review correctly identified that PRD106A can become an audit book if
findings do not force execution. Every PRD106A finding must end in exactly one
of these outcomes:

1. `DELETE_NOW`: the path has no legitimate surviving role.
2. `FENCE_NOW_WITH_DELETE_GATE`: the path is temporarily needed, but tests,
   naming, and a removal gate prove it is not product authority.
3. `BLOCK_PRD106B`: Page Composer cannot proceed until the finding is resolved.
4. `BLOCKED_PENDING_PIETRO_DECISION`: the concern is real, affects execution,
   and needs Pietro, Product Owner, to decide the surviving behavior.
5. `OUT_OF_PRD106A_BY_PIETRO_DECISION`: Pietro has explicitly kept the concern
   outside PRD106A; the PRD must record the owner, reason, and follow-up PRD.

No other state is allowed. "Existing callers use it" is not a state.

The review also correctly validates these PRD106A priorities:

- Treat Tokyo reverse placement indexes as current drift unless moved to
  Roma-owned truth or made opaque storage with tests proving Tokyo does not
  interpret them.
- Decide Bob package authority before deleting `publicPackage`. If Bob remains
  a candidate package producer temporarily, the PRD language must say that Roma
  is the accepting product authority and Tokyo stores only accepted bytes.
- Keep `public.instances` fenced from opportunistic PRD106 deletion unless a
  replacement instance listing/open/publish/translation authority is explicitly
  approved.
- Close PRD106A with search gates and tests, not with more narrative audit.

## Execution Plan

### Phase 0 - Audit Freeze

- Do not introduce new product concepts.
- Do not add new PRD 106 implementation surface.
- Collect tenet-specific findings.
- Build one deletion ledger from code and docs.

Status: complete.

### Phase 0.5 - Dependency And Cutover Plan

Status: required before code execution.

Build a cutover table before changing live service boundaries:

| Concern | Current authority | Surviving authority | Caller migration | Deletion gate |
| --- | --- | --- | --- | --- |
| Widget browser-file materialization | Bob `publicPackage` path | Roma save/materialization | Roma uses same widget package inputs; Bob submits state only | Bob save payload parity tests pass and `publicPackage` is absent |
| Page input acceptance | Old page source/Tokyo page routes | Roma Page Composer | Roma validates ordered instance refs + allowed metadata | Tokyo no longer receives page source/placements |
| Page file storage | Tokyo `website/pages` / `website/publishes` | Tokyo storage-only page files | Roma submits `source.json`, `index.html`, `styles.css`, `runtime.js`, and `serve-state.json` | old `website/*` paths are unused and rejected |
| Page public serving | Tokyo product-shaped publish/readiness | Roma-submitted `serve-state.json` + stored files | `clk.live` checks serve-state and serves stored files | `clk.live` does not generate page output or `embed.js` |
| Affected-page recomposition | old reverse placement/index ideas | Roma Page Composer dependency knowledge | instance save asks Roma to find/recompose affected pages | recomposition failure is visible and retryable |
| Instance registry / `public.instances` | Supabase/Tokyo registry | unresolved follow-up scope | do not change until replacement listing/open/publish truth exists | named follow-up PRD or approval |
| Translation liveness | Tokyo PRD105 machinery | unresolved follow-up scope | do not change under PRD106A unless approved | named follow-up PRD or approval |

Execution must respect dependency order:

1. Define replacement authority and route contract.
2. Add parity/negative tests against the new boundary.
3. Move Roma callers.
4. Keep an old path only as a temporary migration bridge when it has an owner,
   tests, and a delete gate.
5. Delete the old path after callers and tests prove it is unused.

Do not reduce Tokyo instance/page operations to storage-only before Roma has the
replacement route and persistence path. Do not remove `public.instances` before
the replacement account-owned instance listing/open/publish/index truth exists.

### Phase 1 - Delete Fake Product Nouns

Targets:

- Active block/product-section language that leaks into PRD 106.
- Catalog/preset lanes that behave like product truth.
- Minibob/demo code that shapes account Builder semantics.
- Admin-only account/widget/page branches.

Acceptance:

- Repo search for PRD 106 forbidden nouns returns only fenced Prague marketing
  implementation or historical docs.
- Fenced Prague implementation docs explicitly say it is not account page
  architecture.
- `minibob` is not a product mode, Builder mode, or PRD 106 noun.
- `tokyo/prague/pages/**` is not described as PRD 106 page data.

### Phase 2 - Restore Service Boundaries

Targets:

- Bob loses browser-file generation, policy, upsell, and durable side-write authority
  on the edit path.
- Roma owns account/tier save acceptance and page composition.
- Tokyo routes read/write storage and serve stored files without product
  invention.
- Tokyo never needs selected instance lists, page dependency graphs,
  recomposition reasons, CSS/runtime dedupe plans, SEO/GEO intent, or page
  readiness semantics.
- Define exact Roma-to-Tokyo storage contracts before implementation. Tokyo
  accepts allowlisted file writes/reads/deletes and explicit serve-state writes
  only. It may receive `source.json` only as an opaque allowlisted file. It must
  not receive typed `placements`, dependency indexes, readiness, SEO intent, or
  recomposition reason, and must not parse page source to derive them.

Acceptance:

- Bob cannot decide tier/product permission for a local edit.
- Bob does not submit public browser-file bytes.
- Roma widget/page save composes browser files and sends storage payloads.
- Tokyo page and instance operations can be described as storage safety plus
  byte read/write/serve only, not product composition, dependency tracking,
  readiness, SEO/GEO, or product invention.
- Bob preview, Roma widget materialization, and Page Composer input have parity
  coverage across all active widgets before Bob browser-file generation is
  removed from the save path.

### Phase 3 - Fence Duplicate Instance Truth For Follow-Up

Targets:

- `public.instances` and Tokyo's Supabase instance registry.
- Registry-backed publish state.
- Registry-backed translation status copied onto instance identity.
- Seed migrations that create current durable examples in Supabase instead of
  the account-owned Tokyo path.

Acceptance:

- PRD106A does not delete or replace these live PRD103/105 paths.
- Each target is marked with surviving intended authority, blast radius, and
  named follow-up PRD/approval requirement.
- Any local edit that touches these paths stops unless it is required to fence
  them from PRD106 page execution.
- Account instance existence, publish state, translation validation, and
  listing replacement are not claimed green under PRD106A.

### Phase 4 - Align Roma Product UI

Targets:

- Widgets domain shows all system widgets and account instances, including empty
  system widget rows with create action.
- Pages domain shows account pages as ordered widget instance selections.
- Pages domain does not edit widget instance config/content.
- Pages domain does not expose page-specific instance overrides, forks, or
  snapshots.
- No duplicate grouping or fake unknown widget rows.

Acceptance:

- A widget with zero account instances is visible and creatable.
- A page selection references an existing account widget instance.
- Changing an instance happens through the normal Builder/Bob path and triggers
  recomposition of pages that use that instance.
- Invalid account data fails visibly at Roma boundary.

### Phase 5 - Documentation Truth

Targets:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/{bob,roma,tokyo-worker,prague}.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/strategy/*`
- Prague AI/build docs

Acceptance:

- Docs describe only the surviving authorities.
- Historical or marketing terms are fenced and cannot be mistaken for PRD 106
  product nouns.

## Product Owner Decisions Applied

- Page source lives at `accounts/{accountPublicId}/pages/{pageId}/source.json`, beside the
  generated page files. Roma owns its meaning; Tokyo stores it only as an opaque
  allowlisted file.
- Page public output lives at `accounts/{accountPublicId}/pages/{pageId}/index.html`,
  `styles.css`, and `runtime.js`.
- Page serve-state works like widget serve-state: `published` or `unpublished`.
  Public `clk.live` serving is enabled only when the page is published and files
  exist. Unpublished, deleted, or missing pages are not publicly served.
- Roma Pages owns affected-page dependency knowledge. It can keep a derived
  page-service index from saved page sources; Tokyo must not own reverse
  placement truth.
- Empty draft pages are allowed. Publish requires at least one valid selected
  instance.
- Page Composer may use unpublished-but-materialized instances in draft. Page
  publish is blocked if any included instance is unpublished, because publishing
  the page would publicly expose that instance through the page.
- Widget save commits the widget save first. Page recomposition failures mark
  affected pages stale/failed with retry.
- Page tier policy is:
  - Free: 0 pages.
  - Tier 1: 1 page; instances/widgets allowed by that tier.
  - Tier 2: 3 pages; instances/widgets allowed by that tier.
  - Tier 3: 6 pages; instances/widgets allowed by that tier.
  - Tier 4: unlimited pages and unlimited instances/widgets.
  - Views are unlimited for all pages across all tiers.
- Account asset upload, Bob manual translation review, Tokyo translation
  liveness, Tokyo instance create/duplicate/default-source authority, and
  `public.instances` replacement are not PRD106A implementation scope unless a
  separate PRD explicitly takes them on.
- Prague repo-authored marketing content may remain only as Prague marketing
  fixtures until PRD106C/D migrate it into real widget instances and pages.

## Verification

Minimum verification after each implementation pass:

```text
pnpm lint
pnpm typecheck
pnpm test
```

Targeted verification must be added for changed boundaries:

- Bob session/edit path tests for browser-memory-only edit behavior.
- Negative Bob save payload tests proving Bob cannot send `publicPackage`,
  policy decisions, translated-value durable writes, or account asset uploads
  through the ordinary widget save path unless a separate approved command owns
  that durability.
- Roma widget materialization parity tests proving Bob preview, Roma save output,
  and Page Composer input derive from the same widget state and widget software
  contract.
- Roma page/widget route tests for account/tier save acceptance.
- Roma page save negative tests proving payloads with instance config/content,
  overrides, forks, snapshots, inline edit data, blocks, sections, route maps, or
  slugs are rejected.
- Tokyo route tests for storage-only validation and byte read/write/serve
  behavior. Tests must prove Tokyo does not receive or require selected instance
  lists, page dependency graphs, recomposition reasons, CSS/runtime dedupe plans,
  SEO/GEO intent, or page readiness semantics.
- Tokyo negative tests proving old product-shaped page routes, `website/pages`,
  `website/publishes`, reverse placement indexes, generated page `embed.js`, and
  page readiness/package logic are gone or explicitly fenced.
- `clk.live` tests proving composed pages are served from stored page files and
  not generated at request time.
- Prague build/typecheck after deleting or fencing block/minibob paths.
- A page recomposition test: save/publish a page composed from multiple widget
  instances, update one included instance through the normal instance-save path,
  and verify the page files served behind the same page embed URL include the
  updated instance output without requiring a new embed line.
- A composer quality test: compose multiple instances that share CSS/runtime and
  verify the page output dedupes shared code, preserves ordered real HTML
  sections, keeps per-instance runtime data distinct, and includes page-level
  SEO/GEO metadata.
- Forbidden-term grep gates for active product paths, scoped to avoid historical
  docs and explicitly fenced Prague implementation:

```text
rg -n "website/pages|website/publishes|reverse placement|publicPackage|minibob|blocks\\[\\]|BlockType" \
  bob roma tokyo-worker prague/src scripts documentation/ai documentation/services
```

Any remaining hit must be deleted, moved, or explicitly fenced with a surviving
authority.

## Completion Criteria

PRD106 realignment is complete only when:

- Every tenet audit has been closed with explicit findings or no findings.
- Every accepted violation has been deleted, moved, or fenced.
- No active code path contradicts the umbrella tenets.
- Docs and tests describe the same surviving system.
- CI is green after the final cleanup.
