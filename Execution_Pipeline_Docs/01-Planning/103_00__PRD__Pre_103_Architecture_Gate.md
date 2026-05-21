# PRD 103_00 - Pre-103 Architecture Gate

Status: Planning Hold / Superseded By `103_DB_Pivot`
Owner: Product + Architecture
Date: 2026-05-21
Blocks: PRD 103 and all 103A-103Z execution

## Purpose

2026-05-21 update: this pre-103 gate is now itself blocked by the DB pivot. Its earlier service-vocabulary doctrine was correct but too shallow. It tried to delete storage-shaped product contracts while still allowing operational application state to live in Cloudflare/R2 JSON objects. The corrected architecture is now captured by `103_DB_Pivot`: operational state belongs in Supabase, public served artifacts belong in R2/CDN, and publish/materialization is the bridge.

This file remains planning context only. Do not execute more product PRD 103 work from this plan until `103_DB_Pivot` is green.

Stop PRD 103 execution until the source model is simple, explicit, and shared by every service.

PRD 103 cannot continue while the system mixes widget software, starter content, account instance content, non-content config, generated files, generated indexes, manifest output, and translation contracts.

This is a pre-103 gate. It exists before PRD 103.

2026-05-20 update: human smoke exposed that translation generation still lacked a product-owned job-state primitive. Bob could show "Generating translations..." while Tokyo received only translated-locale inventory polling and no Generate product command. That is now captured as `103_03__PRD__Translation_Generation_Job_State.md`. The automated implementation is green; deployed Roma/Bob human smoke remains pending.

## Product Truth

The product path is:

```text
Account opens one widget in Roma.
Bob edits one active locale.
Roma saves to Tokyo.
Translations are generated only from the Translations panel.
Tokyo stores account-owned instance source and translated locale values.
Publish generates static visitor files.
```

Every file in the widget software folder and every file in the account instance folder must have one clear role:

- source truth
- generated artifact
- generated read model
- local/dev helper
- explicit repair tool
- delete candidate

Existing callers are not proof that a concept belongs.

## Execution Scope Boundary

This gate owns the decision surface for pre-103 architecture cleanup. It does not own PRD 103 translation feature implementation.

In scope:

- classify widget-source files, instance-source files, public artifacts, read models, overlays, generated manifests, and bootstrap/materializer scripts;
- decide which concepts survive as product operations and which concepts are deleted;
- assign one product-operation owner for every cross-service path that currently reconstructs truth from storage objects;
- define temporary migration shims only where they are needed to move active callers off old contracts;
- update or supersede docs that currently teach storage objects as product truth;
- add verification that prevents storage-shaped contracts from crossing Roma, Bob, San Francisco, Tokyo, or public-serving boundaries.

Out of scope until this gate closes:

- PRD 103A-103Z runtime implementation;
- new translation UI behavior beyond renaming/removing storage-shaped preview commands, except the 103_03 job-state slice opened by human smoke;
- new widget capability work, starter-instance marketplace work, or Minibob/demo save behavior;
- broad cleanup unrelated to widget source, account instance source, translation values, workflow state, publish state, or public artifacts;
- backwards compatibility for fake product/storage concepts that are not on the real account authoring path.

Every execution task must name the surviving authority before touching code: widget source contract, account instance config/content, translated locale values, workflow state, publish state, public artifact builder, or delete.

## Service Boundary Doctrine

Roma must speak product verbs, not storage-object paths.

Roma may call Tokyo, San Francisco, Berlin, or Bob service boundaries. Roma must not treat generated files, manifests, indexes, projections, overlay object paths, or public artifacts as product APIs.

No service may compose a product operation by reading multiple storage objects from another service.

If Service A needs N pieces of Service B state to produce one product result, Service B owns that product operation. Service A makes one call. Service B may read N storage objects internally if that is still the approved implementation.

Concrete examples:

- Roma must not iterate over Tokyo overlay inventory.
- Roma must not read Tokyo selected-overlay pointers.
- Roma must not fetch Tokyo widget catalog artifacts to build translation jobs.
- Roma must ask Tokyo for one product operation, and Tokyo resolves its own state.

This gate is not a "hide storage behind nicer APIs" pass. It is a "delete storage-shaped product concepts" pass.

Physical persistence still exists. R2, KV, D1, generated static files, queues, and deploy artifacts may remain when they are the simplest way to implement the product model. What must disappear is storage as the product model. If a concept exists only because an old file/object layout existed, the default action is delete, not wrap.

Bad Roma-facing vocabulary:

```text
read index.json
read catalog.json
read overlays/{overlayId}.json
write selected overlay JSON
publish projection
live pointer
generated file lane
manifest authority
```

Good Roma-facing vocabulary:

```text
list account instances
get widget catalog
open instance
save instance
rename instance
publish instance
list translated locales
generate translations
read translated locale values
write translated locale values
read translation generation job
```

Tokyo may persist product concepts in R2, KV, D1, generated indexes, exact files, and public static files when that is the approved implementation. San Francisco may queue jobs. Public serving may emit generated static artifacts. Those physical forms are not allowed to survive as product concepts. They either implement an approved product concept or they are deleted.

If Roma depends on a generated file shape, a physical object name, a manifest, or an index, that is a pre-103 audit candidate by default.

## Product-Service Vocabulary Gate

PRD 103 was blocked until active docs, routes, tests, and execution PRDs stopped exposing storage-object vocabulary as product/service contracts. That architecture gate is now green; runtime implementation resumes one slice at a time.

Allowed product/service vocabulary:

```text
get widget catalog
list account instances
open instance
save instance
rename instance
publish instance
unpublish instance
list translated locales
generate translations
read translated locale values
write translated locale values
build public visitor files
serve public visitor files
```

Forbidden product-boundary vocabulary:

```text
read or write index.json
read or write catalog.json as the API
treat instance.json as the product API shape
generated manifest authority
published projection
live pointer
overlay file/object as Roma, Bob, or UI contract
file lane
R2 key/path/object name as the product contract
script materializer as architecture
```

Tokyo, Tokyo-worker, embed agents, and public serving internals may use physical storage objects, generated read models, manifests, overlays, and browser files only when those objects directly implement an approved product concept. Any doc that mentions those physical names must state the product concept they implement and why the physical artifact must exist. If the artifact only preserves old local/bootstrap storage vocabulary, it must be deleted.

## Performance Doctrine

Storage-object vocabulary is also a performance bug.

Clickeen must not use R2/files/generated JSON as inter-service IPC when the product operation can be expressed directly. The slow anti-pattern is:

```text
service A writes object/file
service B reads object/file
service B lists sibling objects
service B re-reads source to validate
service B writes another object/index/file
service C later lists/reads again
```

That pattern makes small product operations 5-15 storage/network steps. It also creates race windows, stale reads, duplicated validation, and brittle retries.

World-class target:

```text
Roma sends one product command.
The owning service resolves source once.
The owning service returns product state or accepts async work.
Generated/public artifacts are written only by artifact builders.
No product operation reconstructs truth by walking storage objects.
```

Any design that requires one service to write a file so another service can read it must justify why a direct product operation is impossible. Existing file handoffs are delete candidates by default.

A product operation should complete in one cross-service request unless the PRD names the async workflow primitive. Composing several Tokyo reads inside Roma to make one Roma action is a contract failure even if every route has product-sounding names.

Workflow state must not be a write-only field on a data object.

Queues, Durable Objects, Cloudflare Workflows, or another named workflow primitive may own async state. A JSON field such as `generation.translations.status` or `generation.embed.status` is valid only if one named writer advances it and one named product operation consumes it. Write-once ghost flags must be deleted, not renamed.

Translation generation job state is now a named pre-103 blocker. Bob's local spinner and translated-locale inventory are not job state. Tokyo must own the generation job product state; San Francisco must report every terminal locale outcome back to Tokyo; Bob must read job state through Roma/Tokyo instead of inferring progress from inventory polling.

Wrong shape, current class of failure:

```text
Roma saves.
Tokyo writes instance storage.
Roma reads Tokyo catalog storage.
Roma lists Tokyo overlay storage.
Roma reads N Tokyo overlay objects.
Roma queues translation work.
San Francisco later writes overlay storage.
Publish later guesses readiness from generated file presence.
```

Right shape, boring target:

```text
Roma calls save instance.
Tokyo writes approved instance source and returns the saved state.
Roma calls generate translations when the user asks.
Tokyo or the translation owner resolves field contract, current content, existing translations, and delta.
The named workflow primitive runs translation and artifact build work.
Publish checks product readiness, not file presence.
```

## Slow Path Inventory

These are architecture-level latency multipliers created by storage-shaped product concepts. PRD 103_01 and PRD 103_02 must remove them from the product path, not merely rename them.

| Slow path | Current shape | Required simplification |
| --- | --- | --- |
| Widget catalog lookup | Roma reads a generated widget catalog route backed by manifest/build output. | Roma asks for widget definitions through a product service/resolver; generated artifacts are not source authority. |
| Account widget listing | Roma reads `index.json`, then separately reads catalog. | `listAccountInstances` returns account instance summaries; catalog is resolved from product source, not a generated index handoff. |
| Instance save | Tokyo writes instance JSON, then re-reads source/index to patch account index. | Save persists approved instance source once and returns the instance summary; any cache is derived from in-memory result or deleted. |
| Translation generate | Roma loads catalog, lists overlay inventory, reads overlay objects per locale, then queues jobs; Bob can also show local generating state without a Tokyo job. | `generateTranslations(instanceId)` is one async command; Tokyo owns the job state, resolves instance content, field contract, existing translation values, and delta, and exposes accepted/running/failed/superseded progress. |
| Translation review | UI lists overlay inventory, then reads exact overlay object by ID. | UI reads translated locales and translated locale values by locale; overlay IDs do not exist in the product path. |
| Manual translation edit | Roma reads saved instance to discover widget type, then writes overlay JSON. | `writeTranslatedLocaleValues(instanceId, locale, values)` validates against approved instance source in the owning service. |
| Publish/unpublish | Tokyo probes/renames `index.html`/`index.html.off`, reads publish state, then writes state. | Publish status is product state; public artifacts are generated output and are not the state machine. |
| Public serving | Non-index assets read `index.html` first as availability oracle, then read the requested asset. | Serving checks approved publish/serve state or artifact manifest once; asset serving does not use file presence as product truth. |
| Embed generation | San Francisco reads instance JSON, writes "building", lists overlay files per locale, writes support files, re-reads support files, then writes "ready". | Builder receives approved instance source and translation values, writes artifact output once, and reports build status without file-list choreography. |

## Blast-Radius Ledger

103_01 and 103_02 must maintain a blast-radius ledger while they execute. A checklist of renamed files is not enough.

Each ledger row must include:

- product concern: catalog, open, save, translation generate, translation review, manual translation edit, publish, unpublish, public serving, embed build, account listing, starter creation, or delete-only cleanup;
- current storage-shaped mechanism: routes, file names, R2/KV/D1 keys, generated artifacts, scripts, shared types, tests, and docs involved;
- active product path affected: Roma account Builder, Bob editor/preview, Tokyo save/list/publish, San Francisco translation queue, Venice/public serving, Prague/funnel, or dev-only/admin;
- surviving authority: one approved product operation or one explicit deletion decision;
- owner service and code owner role responsible for the replacement;
- blast radius severity: P0 blocks save/open/publish, P1 crosses service boundaries, P2 touches generated artifacts/tests/docs, P3 local/dev-only;
- migration shim, if any: old entrypoint, new entrypoint, allowed callers during migration, deletion commit/PR, and final removal verification;
- rollback/deletion plan: exact way to disable or revert without restoring fake product truth;
- verification: tests, CI guard, docs update, and a deferred manual smoke path for post-runtime PRD 103 completion;
- remaining risk or follow-up: only allowed when owned by a named later PRD and not blocking PRD 103 resume.

The ledger must cover every row in the slow path inventory, every occurrence inventory row in 103_01 and 103_02, and any additional storage-object crossing found during code audit. A row cannot close with "wrapped behind API" as the decision; it must say keep as private implementation, cloudify, dev-only, repair-only, or delete, with the product operation it implements if kept.

## Occurrence Inventory - Canonical Docs And Historical PRDs

These documents currently normalize storage-object vocabulary. They must be updated, marked superseded, or narrowed before PRD 103 runtime work resumes.

| Occurrence | Current problem | Required action |
| --- | --- | --- |
| `documentation/services/roma.md` | Names published projections, live pointers, account manifests, exact overlay objects, and locale-overlay routes as product behavior. | Rewrite Roma docs around product operations: open/save/publish instance and read/write translated locale values. |
| `documentation/architecture/Overview.md` | Normalizes Tokyo live pointers, serve flags, published projections, and R2 rewrites as architecture. | Narrow to public serving internals or supersede with operation vocabulary. |
| `documentation/services/tokyo-worker.md` | Widget definition docs were updated in 103_01.3b; broader overlay/storage JSON route language remains to be rewritten. | Keep Tokyo product operations explicit and prevent deleted generated catalog vocabulary from returning. |
| `documentation/architecture/CONTEXT.md` | Blesses `catalog.json`, `spec.json`, `content.json`, generated manifests, `instances/index.json`, and `index.html` presence as current product truth. | Update after 103_01 and 103_02 lock the source model. |
| `documentation/capabilities/localization.md` | Describes localization through runtime projections and overlay files. | Rewrite around target locales, generated translations, and translated locale values. |
| `documentation/services/bob.md` | Says Bob preview reads actual Tokyo/R2 overlay files through Roma; treats Dieter manifest as a product contract. | Rename Bob/Roma commands to locale translation operations and clarify deploy artifact status. |
| `documentation/widgets/WidgetArchitecture.md` and `documentation/architecture/BabelProtocol.md` | Normalize published projection/config/overlay/widget bytes as public serving truth. | Delete those terms as product concepts or supersede with public serving/product-operation vocabulary. |
| `documentation/README.md` | Still teaches local DevStudio lanes and published projection vocabulary. | Mark local/bootstrap lanes as dev-only and remove projection vocabulary from product architecture. |
| `Execution_Pipeline_Docs/03-Executed/038__PRD__Infra_Published_Render_Snapshot_v1.md` | Uses `index.json` as mutable pointer and Tokyo/R2 paths as authority. | Mark superseded by PRD 100 public static serving and PRD 103_00 product-operation gate. |
| `Execution_Pipeline_Docs/03-Executed/054A__PRD__Read_Plane__Tokyo_Paths_Live_Pointers_Packs_Caching_Venice_Contract.md` | Frames public read surface as hashed packs plus live pointer files. | Keep historical only; cannot be cited as current architecture. |
| `Execution_Pipeline_Docs/03-Executed/083__PRD__Tokyo_Owned_Widget_Instance_Index_And_DB_Projection_Cutover.md` | Canonicalizes `instances/index.json`, listed indexes, saved/live pointers, and scripts writing indexes. | Supersede product-boundary language; delete index/pointer concepts unless they are proven necessary physical implementations of approved operations. |
| `Execution_Pipeline_Docs/03-Executed/098__PRD__Overlay_Primitive_And_Locales_First_Application.md` | Builds around selected-overlay records, overlay object paths, and published projection truth. | Supersede UI/Roma overlay-object vocabulary with translated locale operations. |
| `Execution_Pipeline_Docs/03-Executed/100/100A__PRD__Instance_Folder_And_Save_Shape.md`, `100D`, `100E` | Correctly killed Venice runtime composition, but promoted `instance.json`, generated browser files, and physical `index.html` presence into product contracts. | Narrow PRD 100 to public serving internals; it must not govern authoring, translation, catalog, or publish APIs. |
| `Execution_Pipeline_Docs/01-Planning/103C0__PRD__Widget_Source_Split_And_Content_JSON.md` | Historical PRD blesses `content.json` as widget-authored translation source. 103_01.3a moved FAQ to `editable-fields.json`; 103_01.3b deleted generated manifest/catalog authority. | Keep as historical proof only; do not use as current source authority. |

## Audit Completion Rule

No PRD 103 runtime slice may proceed until:

- every generated manifest, account index, public file, overlay file, and bootstrap/materializer script has a keep, cloudify, dev-only, repair-only, or delete decision, with delete as the default when the artifact preserves old storage vocabulary;
- every Roma-facing route currently named after a file or generated artifact is replaced by product vocabulary and the old storage-shaped route is removed after migration;
- every product operation that currently reconstructs truth by reading/listing generated files has a direct owner and a product-operation replacement;
- every async workflow state field has a named workflow primitive and writer, or the field is deleted;
- translation generation has a Tokyo-owned job-state primitive, San Francisco terminal outcome reporting, Bob/Roma job-state reads, and no indefinite local spinner;
- canonical docs are updated or historical PRDs are marked superseded so they cannot be cited as current product architecture;
- PRD 100 static serving exceptions are narrowed to public static serving internals and cannot leak back into authoring, translation, catalog, or publish APIs.

## Dependency And Sequencing Gate

Pre-103 execution order:

1. Freeze PRD 103A-103Z runtime work. Docs may be edited only to mark blocking dependencies or supersession.
2. Execute 103_01 first, then 103_02. 103_01 owns widget source, catalog, editable-field contract, and bootstrap scripts. 103_02 owns account instance source, translated locale values, workflow state, publish state, and public artifacts.
3. Execute 103_03 before resuming PRD 103 runtime. 103_03 owns translation generation job state, duplicate/supersede semantics, San Francisco terminal outcome reporting, Bob/Roma job-state UX, and invalid partial translated-locale cleanup.
4. Reconcile the audits before route or type migration begins. The shared contract names must match: widget field contract, account instance config/content, translated locale values, translation generation job state, widget catalog operation, and public artifact readiness.
5. Replace cross-service contracts from the product boundary inward. Roma/Bob/San Francisco callers move to product operations before storage-shaped routes are deleted. Tokyo may keep private storage helpers only after the public/internal service boundary no longer exposes them.
6. Delete old routes, shared types, and docs references in the same PRD pack that introduced the replacement. A shim that survives past its replacement PRD is a blocker unless the human architecture owner approves a dated exception.
7. Run verification, close blast-radius ledger rows, update docs, and then request signoff.

Sequencing constraints:

- 103_02 cannot finalize `instance.content.json` translation behavior until 103_01 finalizes the widget editable-field contract.
- Translation generation ownership cannot finalize until 103_02 assigns the owner of existing translated locale values and delta calculation, and 103_03 assigns the owner of generation job state and terminal outcomes.
- Publish readiness cannot finalize until 103_02 names the public artifact materialization owner and workflow primitive.
- PRD 103 runtime work may not resume while any P0 or P1 blast-radius ledger row is open. P2 rows may remain only if they are doc/test-only, have an owner, and are not on the account open/save/translation/publish/public-serving path.

## Owner And Signoff Gates

Human signoff is required. Codex or another implementation agent may prepare evidence, but cannot close this gate alone.

Required owner decisions:

| Gate | Required owner | Signoff evidence |
| --- | --- | --- |
| Product truth | Product + Architecture | The real path remains account opens widget in Roma, Bob edits one active locale, Roma saves to Tokyo, translations are explicit follow-up work. |
| Widget source | 103_01 owner | Final widget folder contract, catalog decision, editable-field contract, and bootstrap script classification. |
| Instance source | 103_02 owner | Final instance config/content model, translated locale value model, public artifact model, publish readiness model, and starter instance decision. |
| Roma/Bob boundary | Roma/Bob code owners | Product-facing routes and session commands no longer expose overlay/file/catalog/index vocabulary. |
| Tokyo boundary | Tokyo-worker code owner | Tokyo owns product operations and keeps storage objects private or deletes them. |
| San Francisco boundary | San Francisco code owner | Translation queue inputs/outputs use product operations, not overlay object inventory or storage snapshots. |
| Public serving boundary | Tokyo/Venice owner | Public URLs serve from approved publish/artifact state, not authoring source or file-presence truth. |
| Translation generation job state | 103_03 owner | Tokyo-owned job state, San Francisco terminal outcome reporting, Bob/Roma deterministic UX, duplicate/supersede rules, and invalid partial-state handling are green. |
| Verification | Dev Manager or release owner | CI guard, tests, docs, and architecture evidence are attached to the ledger. End-to-end smoke evidence is required after 103_03 runtime work is complete enough to test. |

The final architecture signoff must explicitly say: "PRD 103 may resume because the remaining contracts are product-operation contracts, not renamed storage-object contracts."

## Migration Shim And Deletion Policy

Delete is the default decision for fake product/storage concepts.

Temporary shims are allowed only when all of the following are true:

- the shim moves an active caller from an old storage-shaped contract to an approved product operation;
- the shim has one owner, one allowed caller set, and one deletion PR or commit named in the ledger;
- the shim does not introduce a new product noun, sidecar, status field, pointer, lane, projection, manifest authority, or generated-file dependency;
- the shim fails closed if old storage truth is missing or invalid; it must not silently synthesize a new normal;
- the shim is removed before PRD 103 runtime implementation resumes unless the human architecture owner grants a dated exception.

Rollback policy:

- Rollback may restore the previous deployable behavior, but it must not re-bless deleted fake concepts in docs.
- If deleting a storage-shaped route breaks an active path, restore the route only as a temporary compatibility shim with a ledger row and deletion date.
- If data migration is required, prefer one-way repair tooling with dry-run output and explicit operator invocation. Product runtime must not carry indefinite dual-write or dual-read behavior.
- If a generated read model survives, its rebuild path must be repair-only or owner-internal. Runtime callers may not depend on the rebuild scan as normal product operation behavior.

## Remediation Order

The storage-vocabulary cleanup must move from contained names to cross-service contracts:

1. Rename contained exported helpers and types that do not change HTTP payloads:
   - saved/render/overlay function names
   - `materialize*` helpers
   - translation `inventory` helpers

2. Rename shared cross-service types and de-duplicate duplicated concepts:
   - `pointer` as current instance version
   - `InstanceGenerationLane`
   - overloaded `manifest` names

3. Replace HTTP contracts with product-operation routes:
   - add new Tokyo routes alongside old storage-shaped routes;
   - move Roma/San Francisco callers to the new routes;
   - move Bob/Roma product APIs from `locale-overlays` to `translations`;
   - remove old routes only after callers have moved.

This order prevents the repo from mixing new product vocabulary with old on-the-wire contracts in a way that would make the architecture look cleaner while still behaving like the old storage-object system.

The end state is deletion of the old storage-shaped contracts, not permanent shims and not renamed wrappers over the same product model.

## Required Pre-103 PRDs

1. `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
   - Locks the widget software folder contract.
   - Audits bootstrap-era `.mjs` scripts.
   - Removes or narrows catchall manifest/build-script dependencies.

2. `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`
   - Locks the account instance folder contract.
   - Splits content from non-content config.
   - Documents generated public files and account read models before any PRD 103 runtime work resumes.

103_01 and 103_02 may execute in parallel because widget-source cleanup and instance-source cleanup are different inventories. PRD 103 resumes only after both are closed and one human architecture owner signs off that the resulting contracts are product-operation contracts, not renamed storage-object contracts.

## Verification Gates

Verification must prove behavior at product boundaries, not just file/path assertions.

Required gates before PRD 103 resumes:

- Vocabulary CI guard fails if active product modules expose storage-shaped nouns across Roma, Bob, San Francisco, Tokyo, or public-serving boundaries.
- Route/API tests prove Roma account open/save/list/rename/publish and Bob preview commands use product-operation vocabulary.
- Translation tests prove Generate, list translated locales, read translated locale values, and manual translated-locale write do not require Roma to read catalog artifacts, overlay inventory, selected pointers, or overlay object IDs.
- Save tests prove `saveAccountInstance` writes approved source once, returns the product summary/state needed by Roma, and does not require a follow-up Roma storage walk.
- Publish tests prove `publishInstance` checks named build/readiness state and never treats `index.html` or `index.html.off` as the product state machine.
- Public-serving tests prove support assets do not use authoring source or `index.html` presence as their product availability oracle.
- Workflow tests prove every remaining async status has one writer and one reader, or the status field is deleted.
- Docs verification proves current architecture docs and executing PRDs do not cite superseded storage-object contracts as current truth.

Manual smoke after PRD 103 runtime completion:

```text
Open an account-owned FAQ instance in Roma.
Edit the base locale in Bob.
Save through Roma to Tokyo.
Generate translations from the Translations panel.
Review one translated locale by locale code, not overlay ID.
Publish.
Load the public base URL and one translated public URL.
Unpublish and confirm public serving is unavailable while authoring open still works.
```

This smoke is not required to resume PRD 103 implementation. It is required before PRD 103 is called product-complete or releasable. Any failed verification gate reopens the relevant blast-radius ledger row.

## PRD 103 Resume Definition

PRD 103 may resume only when all of the following are true:

- 103_01 and 103_02 are marked complete by their owners;
- every P0/P1 blast-radius ledger row is closed, and any remaining P2 row is explicitly non-runtime with owner and follow-up;
- the final widget source, instance source, translation value, workflow, publish, and public artifact contracts are documented in current docs;
- all storage-shaped migration shims introduced during pre-103 work are deleted, or have a dated human-approved exception that does not touch PRD 103 runtime paths;
- CI and required product-boundary tests pass;
- Product + Architecture signs off that PRD 103 now has one source model and one operation model to build against.

If any later PRD 103 slice discovers a new storage-shaped product concept, PRD 103 pauses again until that concept is added to the ledger and resolved.

## Non-Negotiables

- Do not resume PRD 103A-103Z implementation until 103_01 and 103_02 are complete.
- Do not add `instance.meta.json` or any replacement sidecar unless a real product/build/runtime consumer is named first.
- Do not keep `scripts/build-widget-catalog.mjs`, generated manifests, generated SEO registries, generated indexes, or sync scripts just because package scripts call them.
- Do not expose storage-object filenames or generated artifact names as Roma product boundaries.
- Do not keep storage-shaped concepts internally just because they can be hidden behind product-named APIs.
- Do not use object writes plus later object reads as the normal communication pattern between Roma, Tokyo, San Francisco, Bob, or public serving.
- Do not keep `generation.translations.status`, `generation.embed.status`, or equivalent readiness ghosts in authoring source. Product-visible status must come from a named workflow operation with a clear owner.
- Do not let generated files become source authority.
- Do not let local-bootstrap scripts define Cloudflare-era product architecture.
- Do not preserve version markers, sidecars, provenance fields, readiness state, or review state unless the product source model explicitly requires them.

## Acceptance

- PRD 103 status names this gate as blocking.
- 103_01 and 103_02 exist and have explicit acceptance criteria.
- Every current widget-folder file is classified.
- Every current instance-folder file is classified.
- Every root `scripts/**/*.mjs` materializer/syncer is classified as keep, cloudify, dev-only, repair-only, or delete.
- Blast-radius ledger rows exist for every slow path, every 103_01/103_02 occurrence row, and every newly discovered storage-object crossing.
- Every Roma -> Tokyo/San Francisco path that currently speaks file/artifact vocabulary is replaced by product-service vocabulary, and the old storage-shaped route/function/type is deleted after callers move.
- Every listed slow path has a direct product-operation owner and an expected reduction in storage/network hops.
- Every temporary migration shim has an owner, allowed caller set, deletion commit/PR, and dated exception if it survives pre-103 closure.
- Product, Architecture, service-boundary owners, and Dev Manager/release owner signoff evidence is attached to the ledger.
- A CI vocabulary guard exists for active product modules. It fails on storage-shaped product nouns crossing Roma/Bob/San Francisco/Tokyo boundaries, including overlay inventory, selected overlay, saved render, pointer, generated lane, projection, and manifest-as-authority names.
- The architecture verification gates pass, and the post-runtime manual smoke path is recorded as a later PRD 103 completion gate.
- PRD 103 is marked resumable only after the PRD 103 Resume Definition is satisfied and reflected in docs.
