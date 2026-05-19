# PRD 103_00 - Pre-103 Architecture Gate

Status: Draft / Must execute before PRD 103 resumes
Owner: Product + Architecture
Date: 2026-05-19
Blocks: PRD 103 and all 103A-103Z execution

## Purpose

Stop PRD 103 execution until the source model is simple, explicit, and shared by every service.

PRD 103 cannot continue while the system mixes widget software, starter content, account instance content, non-content config, generated files, generated indexes, manifest output, and translation contracts.

This is a pre-103 gate. It exists before PRD 103. It is not a translation slice.

## Product Truth

The product path is:

```text
Account opens one widget in Roma.
Bob edits one active locale.
Roma saves to Tokyo.
Translations are generated only from the Translations panel.
Tokyo stores account-owned instance source and overlays.
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

## Service Boundary Doctrine

Roma must speak product verbs, not storage-object paths.

Roma may call Tokyo, San Francisco, Berlin, or Bob service boundaries. Roma must not treat generated files, manifests, indexes, projections, overlay object paths, or public artifacts as product APIs.

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
```

Tokyo may internally use R2 objects, generated indexes, exact overlay files, and public static files. San Francisco may internally queue jobs. Public serving may internally depend on generated static artifacts. Those implementation choices must not leak upward as Roma product contracts.

If Roma depends on a generated file shape, a physical object name, a manifest, or an index, that is a pre-103 audit candidate by default.

## Product-Service Vocabulary Gate

PRD 103 remains blocked until active docs, routes, tests, and execution PRDs stop exposing storage-object vocabulary as product/service contracts.

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

Tokyo, Tokyo-worker, embed agents, and public serving internals may use physical storage objects, generated read models, manifests, overlays, and browser files only behind named product-service operations. Any doc that mentions those physical names must explicitly state: internal implementation detail, not a Roma/Bob/San Francisco product contract.

## Occurrence Inventory - Canonical Docs And Historical PRDs

These documents currently normalize storage-object vocabulary. They must be updated, marked superseded, or narrowed before PRD 103 runtime work resumes.

| Occurrence | Current problem | Required action |
| --- | --- | --- |
| `documentation/services/roma.md` | Names published projections, live pointers, account manifests, exact overlay objects, and locale-overlay routes as product behavior. | Rewrite Roma docs around product operations: open/save/publish instance and read/write translated locale values. |
| `documentation/architecture/Overview.md` | Normalizes Tokyo live pointers, serve flags, published projections, and R2 rewrites as architecture. | Narrow to public serving internals or supersede with operation vocabulary. |
| `documentation/services/tokyo-worker.md` | Documents `scripts/build-widget-catalog.mjs`, `tokyo/product/widgets/manifest.json`, `/catalog.json`, and overlay JSON routes as service surface. | Separate internal storage/deploy artifacts from Tokyo product operations. |
| `documentation/architecture/CONTEXT.md` | Blesses `catalog.json`, `spec.json`, `content.json`, generated manifests, `instances/index.json`, and `index.html` presence as current product truth. | Update after 103_01 and 103_02 lock the source model. |
| `documentation/capabilities/localization.md` | Describes localization through runtime projections and overlay files. | Rewrite around target locales, generated translations, and translated locale values. |
| `documentation/services/bob.md` | Says Bob preview reads actual Tokyo/R2 overlay files through Roma; treats Dieter manifest as a product contract. | Rename Bob/Roma commands to locale translation operations and clarify deploy artifact status. |
| `documentation/widgets/WidgetArchitecture.md` and `documentation/architecture/BabelProtocol.md` | Normalize published projection/config/overlay/widget bytes as public serving truth. | Mark storage-object terms as implementation detail or supersede. |
| `documentation/README.md` | Still teaches local DevStudio lanes and published projection vocabulary. | Mark local/bootstrap lanes as dev-only and remove projection vocabulary from product architecture. |
| `Execution_Pipeline_Docs/03-Executed/038__PRD__Infra_Published_Render_Snapshot_v1.md` | Uses `index.json` as mutable pointer and Tokyo/R2 paths as authority. | Mark superseded by PRD 100 public static serving and PRD 103_00 product-operation gate. |
| `Execution_Pipeline_Docs/03-Executed/054A__PRD__Read_Plane__Tokyo_Paths_Live_Pointers_Packs_Caching_Venice_Contract.md` | Frames public read surface as hashed packs plus live pointer files. | Keep historical only; cannot be cited as current architecture. |
| `Execution_Pipeline_Docs/03-Executed/083__PRD__Tokyo_Owned_Widget_Instance_Index_And_DB_Projection_Cutover.md` | Canonicalizes `instances/index.json`, listed indexes, saved/live pointers, and scripts writing indexes. | Supersede product-boundary language; any index that survives must be private behind `list account instances`. |
| `Execution_Pipeline_Docs/03-Executed/098__PRD__Overlay_Primitive_And_Locales_First_Application.md` | Builds around selected-overlay records, overlay object paths, and published projection truth. | Supersede UI/Roma overlay-object vocabulary with translated locale operations. |
| `Execution_Pipeline_Docs/03-Executed/100/100A__PRD__Instance_Folder_And_Save_Shape.md`, `100D`, `100E` | Correctly killed Venice runtime composition, but promoted `instance.json`, generated browser files, and physical `index.html` presence into product contracts. | Narrow PRD 100 to public serving internals; it must not govern authoring, translation, catalog, or publish APIs. |
| `Execution_Pipeline_Docs/02-Executing/103C0__PRD__Widget_Source_Split_And_Content_JSON.md` | Blesses `content.json` as widget-authored translation source while 103_01 moves toward `editable-fields.json`. | Mark blocked by 103_01 and align terminology before execution. |

## Audit Completion Rule

No PRD 103 runtime slice may proceed until:

- every generated manifest, account index, public file, overlay file, and bootstrap/materializer script has a keep, cloudify, dev-only, repair-only, or delete decision;
- every Roma-facing route currently named after a file or generated artifact is renamed or wrapped behind product vocabulary;
- canonical docs are updated or historical PRDs are marked superseded so they cannot be cited as current product architecture;
- PRD 100 static serving exceptions are narrowed to public static serving internals and cannot leak back into authoring, translation, catalog, or publish APIs.

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

## Required Pre-103 PRDs

1. `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
   - Locks the widget software folder contract.
   - Audits bootstrap-era `.mjs` scripts.
   - Removes or narrows catchall manifest/build-script dependencies.

2. `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`
   - Locks the account instance folder contract.
   - Splits content from non-content config.
   - Documents generated public files and account read models before any PRD 103 runtime work resumes.

## Non-Negotiables

- Do not resume PRD 103A-103Z implementation until 103_01 and 103_02 are complete.
- Do not add `instance.meta.json` or any replacement sidecar unless a real product/build/runtime consumer is named first.
- Do not keep `scripts/build-widget-catalog.mjs`, generated manifests, generated SEO registries, generated indexes, or sync scripts just because package scripts call them.
- Do not expose storage-object filenames or generated artifact names as Roma product boundaries.
- Do not let generated files become source authority.
- Do not let local-bootstrap scripts define Cloudflare-era product architecture.
- Do not preserve version markers, sidecars, provenance fields, readiness state, or review state unless the product source model explicitly requires them.

## Acceptance

- PRD 103 status names this gate as blocking.
- 103_01 and 103_02 exist and have explicit acceptance criteria.
- Every current widget-folder file is classified.
- Every current instance-folder file is classified.
- Every root `scripts/**/*.mjs` materializer/syncer is classified as keep, cloudify, dev-only, repair-only, or delete.
- Every Roma -> Tokyo/San Francisco path that currently speaks file/artifact vocabulary is either renamed to product-service vocabulary or explicitly documented as private implementation hidden behind a service contract.
- No PRD 103 runtime slice is marked resumable until these classifications are complete and reflected in docs.
