# PRD106_realignment

Status: Active realignment PRD
Owner: Codex execution agent
Date: 2026-06-05
Surviving authority: `Execution_Pipeline_Docs/02-Executing/106__Umbrella__Composition_Vision.md`

This PRD is not a new product idea. It is a cleanup contract for removing code,
docs, tests, names, and workflows that contradict PRD 106's surviving product
truth.

If this file conflicts with `106__Umbrella__Composition_Vision.md`, the umbrella
wins.

## Problem

PRD 106 was supposed to add one simple product noun: page.

The intended model is:

- Widgets are system software.
- Instances are account-owned widgets created/edited through Roma/Bob and saved
  in Tokyo.
- Pages are account-owned ordered stacks of instances stored in Tokyo.
- Bob edits one widget in browser memory and submits save.
- Roma owns account routing, tier/product permission, save acceptance, page
  composition, and user-facing product errors.
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
instance = account-owned widget
page     = account-owned ordered stack of instance placements
```

Everything else is either:

- widget software under the system widget source;
- Roma account/product orchestration;
- Bob browser-memory editing;
- Tokyo R2 storage and public file serving;
- Prague marketing implementation that cannot define product architecture.

## Non-Goals

- Do not redesign the page product.
- Do not add execution sub-PRDs unless a deletion pass proves a real split is
  needed.
- Do not add compatibility shims for fake modes.
- Do not preserve old terms just because code calls them.
- Do not make Prague blocks a product concept by renaming them only in docs.
- Do not move product authority from one wrong service to another wrong service.

## Operating Rules

Before each edit:

1. Name the surviving authority for the concern.
2. Identify the fake noun or duplicate authority being removed.
3. Prefer deletion over adapters, flags, compatibility modes, or renamed layers.
4. Keep write scopes small and verifiable.
5. Do not add tests that preserve hallucinated internals.
6. Add or update tests only when they protect a surviving product boundary.
7. Keep documentation truth aligned in the same change.

## Tenet Audit Matrix

Each tenet gets a separate audit. The output must include concrete file/line
evidence, deletion targets, risks, and the surviving owner.

### 1. Widgets are software and live in the system

Surviving authority:

- `tokyo/product/widgets/{widgetType}/` is widget software truth.
- Roma may list system widgets for account creation.
- Account data may reference widget type/code, but cannot define widget
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
- Tokyo stores account instance source and submitted package files.

Pollution to remove:

- Durable anonymous/demo/minibob instance saves.
- Parallel Michael/account instance tables as product truth.
- Presets/catalogs that behave like instance sources.
- Admin-only create/duplicate lanes.

### 3. Pages are stacks of instances that live in Tokyo

Surviving authority:

- Page source is `head + ordered placements[]`.
- Each placement references an account-owned `instanceId`.
- Tokyo stores page source and submitted page package files.

Pollution to remove:

- Blocks, sections, containers, slots, route maps, slugs, nav, or site nouns as
  PRD 106 page model.
- Bob page mode.
- Page source copied into Prague, Michael, or generated package files as product
  truth.
- Any page composition path that does not start from saved instance packages.

### 4. Bob is an editor: open/edit in browser memory/user save

Surviving authority:

- Bob receives one open payload for one widget instance.
- Bob changes React/browser state.
- Bob save delegates to Roma.

Pollution to remove:

- Bob product policy authority.
- Bob tier/upsell decision authority.
- Bob page source/page editor authority.
- Bob demo/minibob subject modes that can shape shared Builder behavior.
- Bob durable storage or account routing assumptions.

### 5. Tokyo is responsible for R2, nothing more

Surviving authority:

- Tokyo validates storage safety: account coordinate, path, file shape,
  allowlisted package files, object existence, and public serve state.
- Tokyo writes/reads R2 objects and serves already-stored public files.

Pollution to remove:

- Tokyo product policy.
- Tokyo page composition or widget rendering.
- Tokyo source invention.
- Tokyo repair/healing of invalid product state.
- Tokyo package registries, route maps, slugs, blocks, or product-level
  publication decisions beyond stored serve-state transitions requested by Roma.

### 6. Roma is the app

Surviving authority:

- Roma routes the user to their current account.
- Roma checks account/tier authority.
- Roma accepts or rejects saves.
- Roma composes page packages from saved widget packages and page source.

Pollution to remove:

- Roma delegating product decisions to Bob, Prague, or Tokyo.
- Roma hiding duplicate widget/page truths behind caches or fallback groups.
- Roma preserving fake modes instead of account/tier authority.
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

## Consolidated Violation Ledger

This ledger is the result of the seven tenet audits. It is intentionally blunt:
each item names a live surface that must be deleted, moved, or explicitly fenced
before PRD 106 can be called realigned.

### A. Prague still teaches fake product nouns

Violated tenets:

- Widgets are system software.
- Pages are stacks of instances.
- Clickeen uses Clickeen.

Evidence:

- `prague/src/lib/blockRegistry.ts` defines `BlockType`, `BLOCK_REGISTRY`, and
  `minibob`.
- `prague/src/components/WidgetBlocks.astro` renders `blocks[]` through a
  product-shaped switch, including a `minibob` branch.
- `prague/src/blocks/minibob/minibob.astro` keeps a named demo lane around a
  public account instance embed.
- `tokyo/prague/pages/**.json` stores repo-authored Prague page source using
  `blocks[]`, `minibob`, and stale fields such as `mode: "extraction"`.
- `prague/src/lib/markdown.ts` loads `tokyo/prague/pages/**/*.json`, requires
  `blocks[]`, and validates account instance refs from that special source tree.
- `scripts/prague-l10n/*`, `sanfrancisco/src/agents/l10nPragueStrings.ts`, and
  `prague/content/allowlists/v1/blocks/**` preserve a Prague block translation
  model.

Required action:

- Delete or rename/fence Prague block vocabulary as marketing-only implementation
  that cannot be confused with PRD 106 pages.
- Delete `minibob` as a product/demo mode. If Prague needs a marketing embed,
  make it an explicit public artifact embed plus signup CTA, not a Builder mode
  or product noun.
- Replace `tokyo/prague/pages/**` as "page source" with either normal
  account-owned page/instance references or a renamed Prague marketing fixture
  path.

Risk:

- Prague marketing pages may still need repo-authored copy before account-owned
  pages are production-ready. If so, the temporary surface must be renamed and
  fenced in code, docs, scripts, and AI build guides.

### B. Bob still owns more than browser-memory editing

Violated tenets:

- Bob is an editor: open/edit in browser memory/user save.
- Roma is the app.

Evidence:

- `bob/lib/session/useSessionSaving.ts` imports and calls
  `buildSavedWidgetPublicPackage`, then sends `publicPackage` to Roma.
- `bob/lib/session/publicPackage.ts` owns widget package generation and public
  runtime payload shape.
- `roma/app/api/account/instances/[instanceId]/route.ts` accepts Bob-built
  package bytes and forwards them to Tokyo.
- `bob/app/api/widgets/[widgetname]/compiled/route.ts` and
  `bob/lib/api/compiled-widget-route.ts` expose a Bob server API that reads
  widget source/package inputs.
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

- Move widget package materialization from Bob to Roma.
- Remove `publicPackage` from Bob save payload. Bob submits edited widget state
  and explicit save intent only.
- Remove policy/upsell authority from Bob. Bob may display host-provided
  messages, but cannot decide account/tier capability.
- Delete or fence Bob server/proxy routes as non-product local development
  infrastructure.
- Decide whether translation review and asset upload are separate Roma-owned
  durable product commands or must wait for the single widget save.

Risk:

- Moving package generation requires Roma to have the same compiled widget inputs
  Bob currently uses. If this is split incorrectly, widget save output and page
  recomposition can diverge.

### C. Tokyo still owns product authority instead of storage only

Violated tenets:

- Tokyo is responsible for R2, nothing more.
- Roma is the app.
- Pages are stacks of instances.

Evidence:

- `tokyo-worker/src/routes/internal-page-routes.ts` exposes product-shaped
  create, save, delete, publish, and unpublish page verbs.
- `tokyo-worker/src/domains/pages/types.ts` defines page product schema in
  Tokyo.
- `tokyo-worker/src/domains/pages/source.ts` normalizes product fields, derives
  summaries, maintains `pages/index.json`, and maintains reverse placement
  indexes.
- `tokyo-worker/src/domains/pages/package-files.ts` decides package readiness
  for publish.
- `tokyo-worker/src/routes/clk-live-routes.ts` route-generates page `embed.js`
  instead of serving only submitted package files.
- `tokyo-worker/src/domains/account-instances/operations.ts` creates instances
  from widget defaults, mints IDs, and duplicates source.
- `tokyo-worker/src/domains/account-instances/source.ts` splits/recombines
  config/content, remaps overlays, and repairs locale sync state.
- `tokyo-worker/src/domains/account-translations/operations.ts` resolves AI
  runtime policy/budgets and owns translation generation liveness.
- `tokyo-worker/src/domains/widget-definitions.ts` builds an in-worker widget
  definition/defaults registry.

Required action:

- Collapse Tokyo page routes toward storage commands: write/read/delete
  `source.json`, write/read package files, write/read serve state.
- Move page source acceptance and product validation into Roma.
- Move product create/duplicate/default-source semantics out of Tokyo or mark
  them as a deliberate pre-existing exception with a separate corrective PRD.
- Delete generated `embed.js` from Tokyo or make it a submitted stored package
  file if the product keeps it.
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
  before reading R2 package files.
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
- Pages are stacks of instances.

Evidence:

- `roma/app/api/account/pages/route.ts` creates pages for any editor without a
  page entitlement or page cap.
- `roma/components/pages-domain.tsx` enables create page based only on mutation
  state.
- `roma/app/api/account/pages/[pageId]/route.ts` accepts a page source object
  after only route/body ID matching, then delegates deeper acceptance downstream.
- `roma/app/api/account/pages/[pageId]/publish/route.ts` checks role and empty
  placements, but does not apply page-specific tier/account policy.
- `roma/lib/account-instance-direct.ts` can save an instance and then report a
  failure if downstream page recomposition fails, leaving UX and stored state out
  of sync.

Required action:

- Add Roma-owned page create/save/publish policy gates.
- Add Roma-owned page source validation, including placement validity.
- Decide whether empty draft pages are allowed. If allowed, publish denial is
  Roma-owned and explicit.
- Decide whether instance save should succeed even when page recomposition fails,
  with a visible page-package stale/failure state.

Risk:

- There is no named page entitlement/cap yet. The policy matrix must either add
  one or deliberately define Tier 4 page availability another way.

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
- Rename Roma `systemWidgets` to `widgetDefinitions` or
  `availableWidgetTypes` if the current name keeps causing catalog confusion.
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

## Subagent Audit Assignments

Subagents must audit; they must not edit files.

| Tenet | Agent | Status |
| --- | --- | --- |
| Widgets are system software | Kuhn | Complete |
| Instances are created/saved through Roma/Bob/Tokyo account path | James | Complete |
| Pages are stacks of instances | Leibniz | Complete |
| Bob is browser-memory editor only | Halley | Complete |
| Tokyo is R2 only | Copernicus | Complete |
| Roma is the app/account authority | Popper | Complete |
| Clickeen uses Clickeen | Mill | Complete |

## Required Output From Each Audit

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

## Execution Plan

### Phase 0 - Audit Freeze

- Do not introduce new product concepts.
- Do not add new PRD 106 implementation surface.
- Collect tenet-specific findings.
- Build one deletion ledger from code and docs.

Status: complete.

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
- `tokyo/prague/pages/**` is not described as page source.

### Phase 2 - Restore Service Boundaries

Targets:

- Bob loses package generation, policy, upsell, and durable side-write authority
  on the edit path.
- Roma owns account/tier save acceptance and page composition.
- Tokyo routes read/write storage and serve stored files without product
  invention.

Acceptance:

- Bob cannot decide tier/product permission for a local edit.
- Bob does not submit public package bytes.
- Roma widget/page save composes packages and sends storage payloads.
- Tokyo page and instance operations can be described as storage safety and
  serve-state storage, not product composition or product source invention.

### Phase 3 - Remove Duplicate Instance Truth

Targets:

- `public.instances` and Tokyo's Supabase instance registry.
- Registry-backed publish state.
- Registry-backed translation status copied onto instance identity.
- Seed migrations that create current durable examples in Supabase instead of
  the account-owned Tokyo path.

Acceptance:

- Account instance existence is not dependent on a Michael/Supabase row.
- Publish state is not a Michael-owned instance truth.
- Translation jobs can validate an account instance without making Michael the
  instance owner.
- Listing uses either account-owned R2 data or an explicitly derived,
  non-authoritative projection.

### Phase 4 - Align Roma Product UI

Targets:

- Widgets domain shows all system widgets and account instances, including empty
  system widget rows with create action.
- Pages domain shows account pages as stacks of instance placements.
- No duplicate fallback groups or fake unknown widget rows.

Acceptance:

- A widget with zero account instances is visible and creatable.
- A page placement references an existing account instance.
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

## Open Product Decisions

These must be decided before implementation changes that depend on them:

- Are empty draft pages allowed? Current runtime allows create/save and blocks
  publish. If this stays, Roma owns the publish denial.
- What is the canonical page entitlement/cap? Current policy has widget limits,
  but page create/publish needs an explicit account-tier boundary.
- Is account asset upload during Bob editing an allowed explicit durable action,
  or must all editor-origin durability wait for widget save?
- Is manual translated-value review a Roma-owned product surface or removed from
  Bob for PRD 106 realignment?
- Is Tokyo translation liveness/policy out of scope because of PRD 103/105, or
  does "Tokyo is R2 only" require a separate translation realignment?
- Are page and placement indexes acceptable as submitted/derived storage
  projections, or must Roma own all recomposition indexing?
- Can Prague keep repo-authored marketing copy temporarily? If yes, what is the
  non-page, non-block name for that fixture model?

## Verification

Minimum verification after each implementation pass:

```text
pnpm lint
pnpm typecheck
pnpm test
```

Targeted verification must be added for changed boundaries:

- Bob session/edit path tests for browser-memory-only edit behavior.
- Roma page/widget route tests for account/tier save acceptance.
- Tokyo route tests for storage-only validation and serve-state behavior.
- Prague build/typecheck after deleting or fencing block/minibob paths.

## Completion Criteria

PRD106 realignment is complete only when:

- Every tenet audit has been closed with explicit findings or no findings.
- Every accepted violation has been deleted, moved, or fenced.
- No active code path contradicts the umbrella tenets.
- Docs and tests describe the same surviving system.
- CI is green after the final cleanup.
