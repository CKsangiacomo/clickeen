# PRD 103_00 Execution - Pre-103 Architecture Gate

Status: Planning Hold / Superseded By `103_DB_Pivot`
Date: 2026-05-21
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`
Blocks: `103_01`, `103_02`, `103_03`, and all PRD 103 runtime slices until their gate rows are green

## 2026-05-21 Execution Hold

This execution ledger is no longer active execution. It has moved back to planning because the surviving architecture boundary changed.

The active execution ledger is:

- `../02-Executing/103_DB_Pivot__EXEC__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`

Do not continue these slices until the DB pivot has moved operational state out of R2/object JSON and into Supabase-backed product operations.

## Execution Rule

This execution file is the controlling ledger for PRD 103_00.

Execution rules:

- execute one PRD at a time;
- execute one slice at a time;
- do not move to the next slice while the current slice has a red or unverified gate;
- do not preserve toxic storage-shaped contracts just because active callers exist;
- do not use route wrappers, migration shims, or docs wording to hide storage-object contracts;
- every slice must close code, docs, tests/verifiers, and deletion decisions before it is green.

## Slice Plan

| Slice | Status | Scope | Green condition |
| --- | --- | --- | --- |
| 103_00.1 - Execution ledger and blocker wiring | Green | Create this execution ledger, wire PRD/status docs, seed blast-radius rows, and prove no runtime work moved. | `git diff --check` passes for the docs-only slice; all later work has a ledger row and owner slice. |
| 103_00.2 - Widget source audit execution | Green | Execute `103_01`: widget folder roles, bootstrap scripts, manifest/catalog deletion decisions, docs/test blast radius. | `103_01` acceptance green and every widget-source ledger row closed or explicitly owned. |
| 103_00.3 - Instance source/public artifact audit execution | Green / 103_02.5 cleanup complete | Execute `103_02`: instance config/content model, translation values, workflow state, publish/public artifact model, docs/test blast radius. | `103_02` acceptance green and every instance/public-artifact ledger row closed or explicitly owned. |
| 103_00.4 - Contract reconciliation and resume decision | Previously Green / Reopened by human smoke | Reconcile 103_01 and 103_02, run required verification, update canonical docs, and decide if PRD 103 can resume. | Product + Architecture signoff said remaining contracts were product-operation contracts, not renamed storage-object contracts. Human smoke later exposed missing translation generation job state. |
| 103_00.5 - Translation generation job-state execution | Automated Green / Human Smoke Pending | Execute `103_03`: Tokyo-owned generation job state, San Francisco terminal outcome reporting, Bob/Roma job-state UX, duplicate/supersede rules, invalid partial translated-locale cleanup. | Automated `103_03` acceptance is green. Human smoke must still prove Generate reaches Tokyo, San Francisco reports terminal outcomes, and Bob exits generating deterministically. |

No later slice may begin until the preceding slice is green. PRD 103 runtime cannot resume until 103_00.5 is green.

## 103_01.2 Decision Snapshot

The widget source decision slice is green for decisions, not implementation.

Locked decisions:

- `spec.json` survives only as editor schema, normalization, and non-content software defaults; existing starter/customer-visible defaults are migration debt.
- FAQ `content.json` became `editable-fields.json` in 103_01.3a; `spec.overlays.text` is not final translation authority.
- Runtime files, shared files, and widget media survive as runtime software assets.
- `limits.json` survives only as mapping to real `ck-policy` keys.
- `catalog.json` survives only as small listing metadata read by the widget catalog operation.
- `agent.md` is deleted as widget source in 103_01.3c.1. Widget `seo-geo.ts` and catalog capability flags are deleted in 103_01.3c.2. Countdown and Logo Showcase `spec.overlays.text` was migrated to `editable-fields.json` in 103_01.3c.3. Limits policy mapping and stale Prague sync deletion are green in 103_01.3c.4.
- The generated catalog route vocabulary is replaced by `listWidgetDefinitions` and `getWidgetDefinition`.

103_01.4 closed the widget source audit. No 103_01 implementation work remains before 103_02.

## 103_01.3a Implementation Snapshot

The FAQ editable-field contract migration is green.

- `tokyo/product/widgets/faq/content.json` moved to `tokyo/product/widgets/faq/editable-fields.json`.
- Bob, Roma, San Francisco, Tokyo-worker, ck-contracts tests, and the PRD 103J generic verifier now use editable-field vocabulary for all widget text fields. The old FAQ-only vertical verifier has been deleted.
- Later 103_01 slices removed generated widget manifest authority and closed remaining widget-source cleanup.
- 103_00.2 closed in 103_01.4. The next open pre-103 slice is 103_02.

## 103_01.3c.3 Implementation Snapshot

The non-FAQ editable-field migration is green.

- `tokyo/product/widgets/countdown/editable-fields.json` was added.
- `tokyo/product/widgets/logoshowcase/editable-fields.json` was added.
- Countdown and Logo Showcase no longer declare `spec.overlays.text`.
- `scripts/validate-widget-source.mjs` requires `editable-fields.json` for all current widgets and fails if `spec.overlays.text` returns.
- Tokyo-worker derives overlay validation primitives internally from `editable-fields.json` and does not expose a generated `overlays.text` widget field contract to Roma.
- 103_00.2 closed in 103_01.4. The next open pre-103 slice is 103_02.

## 103_01.3c.4 Implementation Snapshot

The limits and bootstrap-script closure is green.

- `scripts/validate-widget-source.mjs` now validates every current widget `limits.json` against `ck-policy` matrix keys/kinds and rejects tier truth in widget folders.
- `packages/ck-policy/src/limits.test.ts` proves widget limits parse through `ck-policy` and do not define detached policy.
- `scripts/prague-sync.mjs` was deleted.
- Root `package.json` and Prague GitHub Actions no longer call or watch the old `tokyo/prague/l10n` sync path.
- `scripts/verify/primitive-drift.mjs` blocks deleted generated widget manifest/catalog routes, stale Prague l10n roots, deleted widget source files, `spec.overlays.text`, and catalog capabilities.
- Active docs now describe widget `limits.json` as path/op mappings to `ck-policy`, with server save/publish enforcement marked as a gap where not proven.

## 103_01.3b Implementation Snapshot

The widget catalog operation migration is green.

- `tokyo/product/widgets/manifest.json` was deleted.
- `tokyo-worker/src/generated/widget-seo-geo-registry.ts` was deleted.
- `scripts/build-widget-catalog.mjs` was deleted.
- `scripts/validate-widget-source.mjs` was added as a non-mutating source guard.
- Tokyo-worker reads widget definitions directly from approved widget source through `listWidgetDefinitions` and `getWidgetDefinition`.
- Roma calls `GET /__internal/widgets/definitions`.
- Prague reads widget source metadata directly.
- 103_00.2 closed in 103_01.4. The next open pre-103 slice is 103_02.

## Slice 103_00.1 Scope

This slice does not change runtime behavior.

Included:

- add this execution ledger;
- mark the PRD 103 status ledger as executing 103_00 first;
- seed the blast-radius ledger with every known storage-as-product crossing from `103_00`, `103_01`, and `103_02`;
- assign each row to the slice that must close it;
- document verification required before the row can close.

Excluded:

- no route changes;
- no TypeScript refactors;
- no widget source renames;
- no instance source migration;
- no translation generation changes;
- no publish/public serving changes.

Pre-existing dirty runtime files before this slice began:

- `roma/app/api/account/instances/[instanceId]/route.ts`
- `roma/lib/account-instance-translation-jobs.test.ts`

They are not part of `103_00.1` and must not be used as evidence that this slice moved runtime implementation forward.

## Initial Blast-Radius Ledger

Status values:

- `OPEN`: must be resolved before PRD 103 resumes.
- `PENDING 103_01`: owned by widget source audit.
- `PENDING 103_02`: owned by instance/public artifact audit.
- `PENDING 103_00.4`: owned by final reconciliation.
- `GREEN`: verified closed.

| ID | Severity | Product concern | Current toxic mechanism | Active path affected | Surviving authority | Owner slice | Status | Required verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BR-001 | P1 | Widget catalog | `tokyo/product/widgets/manifest.json` treated as source authority | Tokyo-worker, Roma widgets, Prague, tests | Widget catalog product operation from approved widget source | 103_01 | GREEN | 103_01.3b removed generated manifest product-path imports and deleted the file. |
| BR-002 | P1 | Widget build script | `scripts/build-widget-catalog.mjs` validates, bundles, and writes multiple product artifacts | Root build/typecheck, Tokyo-worker generated registry | Non-mutating source validation | 103_01 | GREEN | 103_01.3b deleted the writer and replaced it with `scripts/validate-widget-source.mjs`; root build/typecheck use `pnpm validate:widgets`. |
| BR-003 | P2 | Prague widget catalog | Prague imports generated widget manifest directly | Prague marketing/funnel pages | Direct widget source metadata reader | 103_01 | GREEN | 103_01.3b moved Prague off generated manifest. |
| BR-004 | P1 | Editable field contract | FAQ `content.json` was named like widget-owned customer content | Bob compiled widget, ck-contracts, verify scripts | `editable-fields.json` field contract | 103_01 | GREEN | Final FAQ file name and current callers are migrated in 103_01.3a. |
| BR-005 | P2 | Widget guidance | `agent.md` looked like source/schema authority | Copilot/agent docs, widget folders | Delete | 103_01 | GREEN | 103_01.3c.1 deleted widget `agent.md`, removed runtime/fixture dependency, and added validator guard. |
| BR-006 | P2 | Widget catalog metadata | `catalog.json` mixed listing metadata and capability soup | Tokyo catalog, Prague, docs | Small listing metadata read by the widget-definition operation | 103_01 | GREEN | 103_01.3c.2 removed catalog capabilities; direct widget-definition consumers use label, description, category, and order only. |
| BR-007 | P2 | Widget limits | `limits.json` detached from policy | Entitlements and widget limits | Mapping to real `ck-policy` keys only | 103_01 | GREEN | 103_01.3c.4 validates every current widget `limits.json` against `ck-policy` matrix keys/kinds and rejects tier truth in widget folders. |
| BR-008 | P2 | SEO/GEO registry | `seo-geo.ts` and generated SEO registry were stale/static-model drift | Publish/SEO build, generated registry | Delete until named SEO/GEO operation exists | 103_01 | GREEN | 103_01.3b deleted generated registry. 103_01.3c.2 deleted source files and catalog capability coupling. |
| BR-009 | P2 | Bootstrap scripts | Root `.mjs` materializers/syncers can write product truth | Build/deploy/runtime scripts | keep, cloudify, dev-only, repair-only, or delete | 103_01 | GREEN | 103_01.3c.4 classifies bootstrap scripts, deletes stale Prague sync, and extends drift guards for deleted product-authority paths. |
| BR-010 | P0 | Instance source | Catchall `instance.json` / saved-render document mixes content, config, generation, publish, metadata | Roma open/save, Tokyo save/publish, SF/embed | Approved `instance.config.json` + `instance.content.json` or final model | 103_02 | PARTIAL / 103_02.4b | Tokyo save writes `instance.config.json` and `instance.content.json`; legacy `instance.json` remains compatibility only and no longer carries generic sourceVersion/generation lanes. |
| BR-011 | P1 | Account listing | `accounts/{account}/instances/index.json` as Roma product API | Roma account widget list, Tokyo repair/index update | `listAccountInstances` product operation | 103_02 | GREEN / 103_02.5 | Roma list/create/base-locale-lock use `listAccountInstances`; the account index file is no longer a Roma-facing product contract, and the old index/rebuild route shim was deleted. |
| BR-012 | P0 | Roma direct instance client | Roma calls `saved.json`, `save.json`, `index.json`, `catalog.json`, `serve-state.json`, overlay routes | Roma account Builder | Product operation clients | 103_02 | GREEN / 103_02.5 | Roma open/save/list/create/rename/duplicate/delete/publish/unpublish use product operation clients. Old storage-shaped Tokyo instance route shims were deleted. |
| BR-013 | P0 | Translation Generate | Roma assembles jobs by catalog fetch + overlay inventory + N overlay reads | Translations panel Generate, queue acceptance | Tokyo-owned `generateTranslations(instanceId)` operation | 103_02 | GREEN / 103_02.3c.1 | Generate no longer requires Roma storage walk; tests prove one product command. Missing fields and `instance.content.json` fields marked `changed` are queued; per-locale status prevents early global clearance. |
| BR-014 | P1 | Translation review/list | Bob/Roma list overlay inventory and read overlay object IDs | Bob preview/translations panel | `listTranslatedLocales` + `readTranslatedLocaleValues` by locale | 103_02 | GREEN | 103_02.3a moved Bob/Roma preview/review list/read to translated-locale payloads with locale values, not overlay IDs. |
| BR-015 | P1 | Manual translation edit | Roma writes overlay storage object after saved-instance lookup | Translation override/edit path | `writeTranslatedLocaleValues(instanceId, locale, values)` | 103_02 | GREEN | 103_02.3a moved manual edit to translated-locale write; edits overwrite current values with no review/override state. |
| BR-016 | P1 | Tokyo overlay internals | Selected pointer, overlay inventory, version scan exported as service surface | Tokyo-worker overlay routes, Roma/SF callers | Private exact value-map persistence or delete | 103_02 | PARTIAL / 103_02.3b | Product payloads expose no overlay IDs/pointers/storage paths for translation list/read/write/generate/complete. Private overlay storage remains until publish/artifact cleanup. |
| BR-017 | P0 | SF translation completion | SF writes overlay storage route; stale queued jobs can last-write-win | San Francisco translation queue | `completeLocaleTranslation` through Tokyo product operation | 103_02 | GREEN / 103_02.3b | Older completion cannot overwrite newer save or newer locale value. |
| BR-018 | P1 | Workflow state | `generation.translations.status`, `generation.embed.status`, file lanes, generated file lists as authoring source fields | Tokyo saved source, SF embed writer, publish | Named workflow primitive with writer/reader, or delete | 103_02 | GREEN / 103_02.4b | Generic sourceVersion/generation lanes and generated file inventories were deleted from saved source; SF embed writer/job code was deleted. |
| BR-019 | P0 | Publish/unpublish | `index.html` / `index.html.off` file presence and rename as state machine | Tokyo publish/unpublish, public serving | `publishInstance` / `unpublishInstance` product state | 103_02 | GREEN / 103_02.4b | Publish materializes artifacts then sets `publishStatus`; unpublish only changes state; no `index.html.off` product mechanic remains. |
| BR-020 | P1 | Public serving | Non-index assets use `index.html` as availability oracle | clk.live/static serving | Publish/artifact readiness check or artifact manifest | 103_02 | GREEN / 103_02.4b | Public serving requires `publishStatus` and reads the requested generated file directly; support assets no longer pre-read `index.html`. |
| BR-021 | P1 | Public artifact materialization | SF file writer reads/writes generation lanes and exact support files | Publish language files, SF embed generation | Tokyo-owned materialization by default, or explicit alternate owner | 103_02 | GREEN / 103_02.4b | Tokyo owns materialization from approved instance source and translated locale values; SF artifact writer/job code was deleted. |
| BR-022 | P2 | Mirror/snapshot queue | `TokyoMirrorJob`, `delete-instance-mirror`, `RENDER_SNAPSHOT_QUEUE` suggest duplicate truth | Tokyo queues, worker config | Public artifact build/cleanup work only, or delete | 103_02 | GREEN / 103_02.5 | Queue and binding were deleted because no public artifact queue remained. |
| BR-023 | P3 | Policy wording | `ck-policy` text references sync/artifact mechanics | Policy docs/config | Capability/limit/policy vocabulary | 103_00.4 | GREEN / 103_00.4 | Policy text describes policy enforcement, not sync storage mechanics. |
| BR-024 | P1 | Product smoke | Smoke scripts exercise `locale-overlays` storage routes | `scripts/health/product-path-smoke.mjs`, PRD verifiers | Roma product routes + public URLs | 103_02 | PARTIAL / 103_02.5 | Product smoke no longer calls account `locale-overlays`; Generate route moved to Tokyo ownership; product open/save/list/create/rename/duplicate/delete and publish/materialization paths have targeted proof. Human Bob/Roma re-smoke remains pending. |
| BR-025 | P1 | Canonical docs | Service/architecture docs teach projections, pointers, manifests, overlay files as product truth | `documentation/**`, executed PRDs | Current product-operation docs | 103_00.4 | GREEN / 103_00.4 | Canonical docs updated or marked superseded before PRD 103 resumes. |
| BR-026 | P1 | Vocabulary guard | No CI guard blocks storage-shaped product nouns from crossing boundaries | Active product modules | Vocabulary CI guard | 103_00.4 | GREEN / 103_00.4 | Guard fails on overlay inventory, saved render, pointer, lane, projection, manifest-as-authority at product boundaries. |
| BR-027 | P0 | Human resume gate | PRD 103 can be resumed without proof of source/operation model closure | PRD 103 execution process | Product + Architecture signoff | 103_00.4 | GREEN / 103_00.4 | Signoff states remaining contracts are product-operation contracts, not renamed storage objects. |
| BR-028 | P2 | Widget contract tests | Tests assert generated manifest/content JSON as contract truth | `packages/ck-contracts`, Roma tests, Bob tests | Tests assert approved widget source/product catalog behavior | 103_01 | GREEN | 103_01.3a and 103_01.3b rewrote content/manifest tests to approved source/product operation vocabulary. |
| BR-029 | P1 | Roma/Bob translation API tests | Tests and session contracts assert `locale-overlays` commands/routes | Bob/Roma API/session tests | Translations/read/write commands by locale | 103_02 | GREEN | 103_02.3a replaced Bob/Roma session commands, account routes, and tests with translations list/read/write by locale and value map. |
| BR-030 | P1 | Tokyo source/publish tests | Tests assert `instance.json`, generation lanes, `index.html.off`, and overlay storage placement | Tokyo-worker saved-config, overlays, generation, clk-live tests | Instance source, translated locale values, publish/artifact readiness | 103_02 | GREEN / 103_02.5 | Tokyo source/publish/route tests assert split source, no generic sourceVersion/generation lanes, product routes, Tokyo materialization, publish-state serving, no unpublish file surgery, and no old instance route shims. |
| BR-031 | P1 | San Francisco tests | Tests mock overlay write route and generated file inventories | SF translation queue and embed writer tests | Locale translation completion and artifact materialization operation | 103_02 | GREEN / 103_02.4b | SF translation tests complete through Tokyo product operation; stale SF embed writer/generation job tests were deleted. |
| BR-032 | P1 | Publish verifier | `prd103-publish-language-files` seeds overlay paths and exact generated filenames | PRD 103 publish verifier | Public base/translated URLs through product serving boundary | 103_02 | GREEN / 103_02.4b | Verifier now publishes through Tokyo materialization and asserts public base/translated behavior without SF writer imports, sourceVersion, overlay paths, or versioned support filenames. |
| BR-033 | P2 | Embed snippet tests | Snippet tests assert `/script.js` as product contract | Bob embed snippets | Public instance URL contract and serving-owned loadable entry | 103_02 | PENDING 103_02 | Tests assert public contract, not internal support filename as product state. |
| BR-034 | P2 | Static/storage guards | Guards ban old strings but do not enforce product-operation vocabulary | PRD 99/100 guards, primitive drift verifier | Vocabulary/storage-boundary guard suite | 103_00.4 | GREEN / 103_00.4 | Guard suite blocks new product-boundary storage vocabulary. |
| BR-035 | P0 | Translation generation job state | Bob local generating spinner plus translated-locale inventory polling can claim work while no Tokyo Generate job exists | Bob Translations panel, Roma account command bridge, Tokyo Generate, San Francisco queue | Tokyo-owned translation generation job state plus SF terminal outcome reporting | 103_03 | AUTOMATED GREEN / HUMAN SMOKE PENDING | 103_03 automated tests/typechecks/lints prove deterministic Generate/job/progress/failure behavior. Deployed smoke must still prove the live click path. |

## Ledger Closure Details

Each row above must also close these fields before it can turn green.

| ID | Shim/deletion plan | Risk or follow-up allowed before PRD 103 resumes |
| --- | --- | --- |
| BR-001 | GREEN in 103_01.3b: generated manifest product use and file deleted. | None. |
| BR-002 | GREEN in 103_01.3b: broad build script deleted and replaced by non-mutating validation. | None for `build-widget-catalog`; broader bootstrap scripts remain under BR-009. |
| BR-003 | GREEN in 103_01.3b: Prague direct manifest import removed. | None. |
| BR-004 | GREEN in 103_01.3a: FAQ `content.json` was migrated to `editable-fields.json`. | No PRD 103 runtime slice may depend on `content.json` as final name. |
| BR-005 | GREEN in 103_01.3c.1: `agent.md` deleted and guarded. | None. |
| BR-006 | GREEN in 103_01.3c.2: `catalog.json` narrowed to listing metadata and capability fields deleted. | None. |
| BR-007 | GREEN in 103_01.3c.4: widget limits map to real `ck-policy` keys/kinds; source validation and ck-policy tests reject detached tier truth. | Server save/publish enforcement for widget limits remains an explicit ck-policy gap, not implied product behavior. |
| BR-008 | GREEN in 103_01.3c.2: generated registry, source files, and catalog capability coupling deleted. | None. |
| BR-009 | GREEN in 103_01.3c.4: root materializers/syncers are classified; `scripts/prague-sync.mjs` is deleted; drift guard blocks deleted product-authority paths. | Future cleanup may cloudify/fold deploy helpers, but no open bootstrap script blocks PRD 103 runtime work. |
| BR-010 | PARTIAL in 103_02.4b: Tokyo writes `instance.config.json` and `instance.content.json`, and content fields carry `ok`/`changed` status for Generate. Legacy `instance.json` remains compatibility-only and no longer carries generic `sourceVersion` or generation lanes. | No sidecars/versioning/provenance fields without named consumer. |
| BR-011 | GREEN in 103_02.5: account index is no longer a product concept, and the old account index/read/rebuild route shims were deleted. | Any future private cache requires separate approval below `listAccountInstances`. |
| BR-012 | GREEN in 103_02.5: Roma list/create/open/save/rename/duplicate/delete/publish/unpublish callers use product clients; old Tokyo compatibility routes were deleted. | No product-path fallback storage walk. |
| BR-013 | GREEN in 103_02.3c.1: Roma job assembler deleted; Roma Generate forwards one product command to Tokyo; Tokyo resolves current instance, editable-fields contract, translated locale values, policy/model profile, queue work, and `instance.content.json` changed-field/per-locale status. | No queueing from save unless a later PRD explicitly reopens product decision. |
| BR-014 | GREEN in 103_02.3a: Bob/Roma preview/review list/read routes and session commands now use translations by locale. | No `overlayId` in UI payloads. |
| BR-015 | GREEN in 103_02.3a: manual edit writes translated locale values by locale and value map. | No override/review/provenance state added. |
| BR-016 | PARTIAL in 103_02.3b: old overlay HTTP route surface deleted for translation product paths and product payloads no longer expose overlay IDs. Private exact value-map storage remains below Tokyo operations until publish/artifact cleanup. | No selected-overlay product concept unless Product explicitly reopens. |
| BR-017 | GREEN in 103_02.3b: SF completion calls Tokyo `completeLocaleTranslation`; Tokyo ignores stale source or stale locale completions. | No last-write-wins stale queue completion. |
| BR-018 | Delete ghost fields or implement one named workflow primitive with writer/reader. | No write-only readiness flags. |
| BR-019 | GREEN in 103_02.4b: publish materializes current artifacts through Tokyo and updates `publishStatus`; unpublish updates state only. | No `index.html.off` product assertion. |
| BR-020 | GREEN in 103_02.4b: public serving requires published state and then serves the requested generated file directly. | No visitor request authoring-source dependency. |
| BR-021 | GREEN in 103_02.4b: Tokyo owns public artifact materialization from approved instance source and translated locale values. | Owner cannot remain implied. |
| BR-022 | GREEN in 103_02.5: mirror/snapshot queue vocabulary was deleted, including `RENDER_SNAPSHOT_QUEUE`, the queue handler, and deploy queue provisioning. | No duplicate source truth queue. |
| BR-023 | GREEN in 103_00.4: `ck-policy` registry wording no longer describes overlay storage version enforcement or Tokyo sync mechanics as current product behavior. | `l10n.versions.max` remains a matrix key, but it is now a gap unless a later workflow owns translated-value history. |
| BR-024 | PARTIAL in 103_02.5: account translation smoke route now uses translated-locale API; Generate is Tokyo-owned; changed-delta, product instance lifecycle, and publish/materialization have targeted proof. Human product re-smoke still remains. | Credentialed smoke may be blocked only with explicit credential note, not skipped. |
| BR-025 | GREEN in 103_00.4: canonical docs were rewritten/narrowed to product operations: config/content source, translated locale values, Tokyo product operations, publish status, and public artifacts as output. | Product + Architecture signoff recorded in this ledger. |
| BR-026 | GREEN in 103_00.4: `scripts/verify/primitive-drift.mjs` now blocks old storage-shaped route/vocabulary regressions in Roma/Bob/San Francisco/Tokyo product-boundary modules. | Internal Tokyo helper names outside product boundaries remain cleanup debt only if they leak upward later. |
| BR-027 | GREEN in 103_00.4: Product + Architecture signoff recorded after 103_01/103_02 closure and verification evidence. | PRD 103 runtime may resume at the reopened proof path; this is not a product-completion smoke signoff. |
| BR-028 | GREEN in 103_01.3b: manifest/content-json tests rewritten to source/product operation vocabulary. | None. |
| BR-029 | GREEN in 103_02.3a: Bob/Roma route and session tests use translations vocabulary. | No `locale-overlay` product command. |
| BR-030 | GREEN in 103_02.5: Tokyo tests assert split source, no generic sourceVersion/generation lanes, product instance operations, Tokyo materialization, publish-state serving, no unpublish file surgery, and deleted storage-shaped route/queue vocabulary. | Private storage assertions allowed only below service boundary. |
| BR-031 | GREEN in 103_02.4b: SF translation queue tests complete through Tokyo product operation, and stale SF embed writer/job tests were deleted. | No overlay write mock as final completion proof. |
| BR-032 | GREEN in 103_02.4b: publish verifier now publishes through Tokyo materialization and public serving, without SF writer imports, sourceVersion, overlay paths, or versioned support filenames. | Exact filenames may be asserted only as public artifact implementation, not authoring truth. |
| BR-033 | Rewrite snippet tests to public URL contract. | Internal script filename assertion cannot define product state. |
| BR-034 | GREEN in 103_00.4: guard suite blocks deleted route families, deleted product-authority files, mirror/snapshot queue vocabulary, Bob locale-overlay payloads, Roma saved-render routes, SF overlay completion routes, and Tokyo product-route saved-render vocabulary. | Broad historical-doc greps are intentionally not used as CI because historical PRDs may preserve superseded vocabulary. |
| BR-035 | AUTOMATED GREEN in 103_00.5: Bob/Roma/Tokyo/San Francisco now share one generation job contract. | Deployed human smoke still required before release/resume signoff. |

## Documentation Update Queue

Docs to update or mark superseded before PRD 103 resumes:

| Doc | Current issue | Owner slice | Status |
| --- | --- | --- | --- |
| `103__STATUS__Deterministic_Execution_Ledger.md` | Needs to point at this execution ledger and reflect slice-gated execution. | 103_00.1 | GREEN |
| `103__PRD__One_Save_Language_Overlay_Refactor.md` | Already blocked, but used old overlay-product wording for account instance content. | 103_00.4 | BLOCKED TERM REMOVED / final rewrite pending |
| `documentation/services/roma.md` | Taught published projections, live pointers, account manifests, exact overlay objects, and locale-overlay routes. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/architecture/Overview.md` | Normalized Tokyo live pointers, serve flags, published projections, and R2 rewrites as architecture. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/services/tokyo-worker.md` | Previously documented build-widget-catalog, manifest/catalog, overlay JSON routes, render widget routes, and snapshot queue as service surface. | 103_01.3b / 103_02.5 / 103_00.4 | PRODUCT ROUTES UPDATED / PRODUCT-OP NOTE PREPARED |
| `documentation/architecture/CONTEXT.md` | Blessed catalog/spec/content/generated manifest/instances index/index.html presence as current truth. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/capabilities/localization.md` | Described localization through runtime projections and overlay files. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/services/bob.md` | Said Bob preview reads Tokyo/R2 overlay files through Roma and treats Dieter manifest as product contract. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/widgets/WidgetArchitecture.md` | Normalized published projection/config/overlay/widget bytes as public serving truth. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/architecture/BabelProtocol.md` | Normalized storage-shaped public serving vocabulary. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `documentation/README.md` | Still taught local DevStudio lanes and projection vocabulary. | 103_00.4 | PRODUCT-OP REWRITE PREPARED |
| `Execution_Pipeline_Docs/03-Executed/038__PRD__Infra_Published_Render_Snapshot_v1.md` | Historical PRD uses `index.json` mutable pointer and Tokyo/R2 paths as authority. | 103_00.4 | SUPERSESSION NOTE ADDED / final rewrite pending |
| `Execution_Pipeline_Docs/03-Executed/054A__PRD__Read_Plane__Tokyo_Paths_Live_Pointers_Packs_Caching_Venice_Contract.md` | Historical PRD frames public read surface as hashed packs plus live pointer files. | 103_00.4 | SUPERSESSION NOTE ADDED / final rewrite pending |
| `Execution_Pipeline_Docs/03-Executed/083__PRD__Tokyo_Owned_Widget_Instance_Index_And_DB_Projection_Cutover.md` | Historical PRD canonicalizes instance indexes, listed indexes, saved/live pointers, and scripts writing indexes. | 103_00.4 | SUPERSESSION NOTE ADDED / final rewrite pending |
| `Execution_Pipeline_Docs/03-Executed/098__PRD__Overlay_Primitive_And_Locales_First_Application.md` | Historical PRD builds around selected-overlay records, overlay object paths, and published projection truth. | 103_00.4 | SUPERSESSION NOTE ADDED / final rewrite pending |
| `Execution_Pipeline_Docs/03-Executed/100/100A__PRD__Instance_Folder_And_Save_Shape.md`, `100D`, `100E` | PRD 100 static-serving exceptions leak back into authoring/translation/catalog/publish docs. | 103_00.4 | SCOPE-NARROWING NOTES ADDED / final rewrite pending |
| `Execution_Pipeline_Docs/01-Planning/103C0__PRD__Widget_Source_Split_And_Content_JSON.md` | Historical PRD blessed `content.json`; 103_01.3a superseded the name with `editable-fields.json`; 103_01.3b deleted generated manifest/catalog authority. | 103_01 | SUPERSEDED BY 103_01.3a/103_01.3b; no 103_01 blocker |
| `103_03__PRD__Translation_Generation_Job_State.md` | Blocker opened by human smoke; defines Tokyo-owned generation job state and deployed smoke gate. | 103_00.5 | AUTOMATED GREEN / HUMAN SMOKE PENDING |

## Slice 103_00.4 - Reconciliation And Resume Signoff

This slice was green. Product + Architecture accepted the pre-103 source/operation model and approved PRD 103 runtime resumption from the reopened proof path.

2026-05-20 update: human smoke reopened the gate because translation generation still lacked Tokyo-owned job state. Slice 103_00.5 / PRD 103_03 is now automated green; deployed human smoke remains pending.

This is not the finished-product smoke gate. Manual end-to-end smoke belongs after PRD 103 runtime implementation is complete enough to test. Running human smoke here would confuse architecture readiness with product completion and would create false failures.

Included:

- rewrote/narrowed canonical docs to the product-operation model:
  - `documentation/architecture/CONTEXT.md`;
  - `documentation/architecture/Overview.md`;
  - `documentation/capabilities/localization.md`;
  - `documentation/architecture/BabelProtocol.md`;
  - `documentation/services/bob.md`;
  - `documentation/services/roma.md`;
  - `documentation/services/tokyo-worker.md`;
  - `documentation/widgets/WidgetArchitecture.md`;
  - `documentation/README.md`;
- updated `ck-policy` wording so it no longer describes retained overlay versions or Tokyo sync as current product behavior;
- renamed the Tokyo product-control auth helper from saved-render vocabulary to account-instance vocabulary;
- extended `scripts/verify/primitive-drift.mjs` to guard product-boundary modules against old storage-shaped route/vocabulary regressions.

Verification evidence:

- `node scripts/verify/primitive-drift.mjs` passed.
- `pnpm --filter @clickeen/tokyo-worker typecheck` passed.
- `pnpm --filter @clickeen/ck-policy test` passed.
- `git diff --check` passed.

Deferred product smoke gate after PRD 103 runtime completion:

- Open account-owned FAQ instance in Roma.
- Edit base locale in Bob.
- Save through Roma to Tokyo.
- Generate translations from the Translations panel.
- Review one translated locale by locale code, not overlay ID.
- Publish.
- Load public base URL and one translated public URL.
- Unpublish and confirm public serving is unavailable while authoring open still works.

Required signoff phrase before PRD 103 resumes:

```text
PRD 103 may resume because the remaining contracts are product-operation contracts, not renamed storage-object contracts.
```

Signoff evidence:

- Date: 2026-05-20.
- Authority: Product + Architecture direction in the current execution session.
- Scope: architecture resume only. Full Bob/Roma/public smoke remains a later PRD 103 completion/release gate after runtime implementation and automated proofs are green.

## Verification For Slice 103_00.1

Required before marking this slice green:

- this execution ledger exists;
- `103_00` remains executing, not complete;
- `103__STATUS__Deterministic_Execution_Ledger.md` points to this execution ledger;
- no additional runtime/code files are edited by this slice beyond the two pre-existing dirty Roma files recorded before `103_00.1`;
- `git diff --check` passes.

Slice 103_00.1 cannot close if any runtime implementation moved forward.
