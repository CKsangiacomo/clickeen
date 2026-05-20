# PRD 103_02 Execution - Instance Source And Public Artifact Model

Status: Complete / Green; handed off to PRD 103 reopened proof path
Date: 2026-05-19
Parent: `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`
Controlling gate: `103_00__EXEC__Pre_103_Architecture_Gate.md`

## Execution Rule

This execution file is the controlling ledger for PRD 103_02.

Execution rules:

- execute one slice at a time;
- do not migrate routes, rename payloads, split source files, or alter publish behavior until the current slice is green;
- active callers prove blast radius only, not product legitimacy;
- storage-shaped concepts are deletion candidates by default;
- no PRD 103 translation runtime work resumes while this PRD is open.

## Slice Plan

| Slice | Status | Scope | Green condition |
| --- | --- | --- | --- |
| 103_02.1 - Instance/public artifact inventory | Green | Inventory active code, test, verifier, docs, and generated-artifact consumers for instance source, translated locale values, workflow state, publish state, and public artifacts. | Subagent code/docs scans complete; local repo evidence recorded; no runtime files changed by this slice; `git diff --check` passes. |
| 103_02.1a - Immediate doc supersession notes | Green | Add narrow warning notes to active/recent docs that still teach stale instance/overlay/generation storage vocabulary without enough PRD 103_02 warning. | Named docs have supersession notes; broad rewrites remain assigned to 103_00.4; no runtime files changed; `git diff --check` passes. |
| 103_02.2 - Instance file and state decisions | Green | Decide keep/split/delete for current `instance.json` fields, target `instance.config.json`, target `instance.content.json`, metadata, translation values, workflow state, publish state, and account indexes. | Every current field or artifact has one final role and named owner operation, or is marked delete. |
| 103_02.3a - Translated-locale read/write contract cutover | Green | Move Bob/Roma preview/review/manual edit paths from locale-overlay routes and overlay IDs to translated-locale list/read/write operations. | Bob/Roma product payloads use locale and values only; Tokyo product routes exist; no product-facing overlay IDs remain in this surface; targeted tests/typechecks pass. |
| 103_02.3b - Translation generate/complete ownership and freshness | Green / scoped | Move Generate and San Francisco completion from Roma-assembled overlay jobs to Tokyo-owned translation work and `completeLocaleTranslation`. | Generate is one Tokyo product command; SF completes through Tokyo; stale completion cannot overwrite newer content or newer locale values without generic `sourceVersion`. |
| 103_02.3c - Instance open/save/list contract migration | Green / scoped | Move Roma direct instance clients from `saved.json`, `save.json`, and `index.json` to product operations. | Product callers use open/save/list/create/rename operations and do not expose saved-render pointers, index JSON, sourceVersion, or generation lanes. |
| 103_02.4 - Public artifact and publish model migration | Green / scoped 103_02.4b | Assign public artifact materialization ownership and replace file-presence publish state with product readiness/status. | Publish/unpublish/public-serving tests assert URL behavior and readiness, not `index.html`/`index.html.off` mechanics. |
| 103_02.5 - Cleanup and 103_00.4 handoff | Green / scoped | Delete zero-caller storage routes/helpers, update docs/verifiers/guards, and hand off to final reconciliation. | 103_02 acceptance green; 103_00.3 can close. |

No later slice may begin until the preceding slice is green.

## Slice 103_02.2 Final Decisions

This slice locks the instance source/state model before any implementation resumes.

Final decisions:

- `instance.json` is killed as the product model. Current fields must be split into content, config, job/workflow state, generated artifact, or delete.
- `instance.content.json` contains every user-editable customer-visible string in the same semantic paths/shape the editor exposes for text editing: titles, subtitles, CTA labels, FAQ questions and answers, captions, item labels, and any other widget string. This is the only translation source.
- `instance.config.json` contains every non-text setting plus identity/display/widget type/code/base locale/target locales/structure/style/behavior/publish state/timestamps. It must not contain editable customer-visible text.
- `instance.meta.json` is not added. Metadata survives only if a real product/build/runtime consumer is named; otherwise it is deleted or folded into the approved config/content/job/artifact model.
- Translated locale values are modeled as `locale -> translated content values`. Bob/Roma/Tokyo product payloads must not expose `overlayId`, selected pointers, version slots, raw storage keys, provenance, review state, source hashes, generation IDs, or manual override status.
- Tokyo may keep physical overlay files only as private exact current value maps during migration. They are not product identity and not a cross-service contract.
- Manual translation edits temporarily overwrite current translated locale values. Regeneration may overwrite them. No override status, protection check, or review state is stored.
- Translation Generate is a Tokyo-owned product operation. Roma sends user intent only. Tokyo resolves instance content, editable-fields contract, existing translated values, missing/changed fields, policy/model profile, and queued work.
- Async job state belongs to queue/job/workflow infrastructure, not `instance.content.json` or `instance.config.json`. Product-visible accepted/running/complete/error state, if needed, comes from a named operation owned by that infrastructure.
- No generic `sourceVersion` is approved as product model. Any freshness/revision rule needed to reject stale translation completions must be named by the owning save/generate/complete operation before coding.
- `accounts/{accountPublicId}/instances/index.json` is deleted as product model. `listAccountInstances` is the product operation. No Roma-facing JSON handoff/cache contract survives.
- A future account-instance read model would require separate approval and must remain private below `listAccountInstances` with one writer, rebuild rule, and failure behavior. It is not part of PRD 103_02's product model.
- Publish state lives in approved instance config/state. `index.html`, `index.html.off`, support files, locale HTML/JS, and generated file lists are generated artifacts, not publish state.
- Roma sees publish status and public URL behavior. Roma does not reason about serve-state, generated file inventories, artifact filenames, public file pointers, or file presence.
- Rename is an identity/display transition in config. It must not use the full content/save/generated-artifact path for display-only changes.
- Public artifact materialization is Tokyo-owned by default because Tokyo owns source, translations, publish state, and public serving. San Francisco is a text/AI delegate only unless a later slice deliberately assigns another product operation.
- Starter customer copy lives in account-owned starter instances, not widget software. Create-new-widget duplicates an approved starter instance.

This is a decision slice only. It does not migrate routes, split files, change queues, alter publish behavior, or edit runtime code.

## Slice 103_02.3a - Translated-Locale Contract Cutover

This slice migrated the translation preview/review/manual-edit surface only.

Included:

- Tokyo-worker exposes product-shaped translated-locale routes:
  - `GET /__internal/instances/{instanceId}/translations`;
  - `GET /__internal/instances/{instanceId}/translations/{locale}`;
  - `PUT /__internal/instances/{instanceId}/translations/{locale}`.
- Tokyo may still persist exact overlay files privately, but the new product routes return locale summaries and locale value maps only.
- Roma exposes account routes:
  - `GET /api/account/instances/{instanceId}/translations`;
  - `GET /api/account/instances/{instanceId}/translations/{locale}`;
  - `PUT /api/account/instances/{instanceId}/translations/{locale}`.
- Bob/Roma session commands changed from locale-overlay vocabulary to:
  - `list-translations`;
  - `read-translation`;
  - `save-translation`.
- Bob translation preview state, review panel, and workspace preview no longer carry `overlayId`.
- Old Roma account `locale-overlays/*` route files were deleted from the product surface.
- Product health smoke now checks the translated-locale list route.

Excluded:

- no Generate ownership migration;
- no San Francisco completion migration;
- no source split into `instance.content.json` / `instance.config.json`;
- no `saved.json`, `save.json`, or `index.json` instance open/save/list migration;
- no publish/public artifact behavior change.

Remaining after this slice:

- Translation Generate ownership is assigned to 103_02.3b.
- San Francisco completion ownership is assigned to 103_02.3b.
- Instance open/save/list migration remains assigned to 103_02.3c.
- Public artifact and publish behavior remains assigned to 103_02.4.

## Slice 103_02.3b - Translation Generate/Complete Ownership And Freshness

This slice migrated Generate acceptance and San Francisco completion ownership only.

Included:

- Bob sends Generate intent with `instanceId`, `baseLocale`, and active `targetLocales`; Bob does not send overlay IDs or translation storage details.
- Roma Generate is a thin account boundary. It validates the account request and forwards one product command to Tokyo:
  - `POST /__internal/instances/{instanceId}/translations/generate`.
- Roma no longer loads widget definitions, loads overlay inventory, reads overlay objects, or builds queue jobs for Generate.
- Tokyo owns Generate assembly:
  - reads the current account instance;
  - reads the widget `editable-fields.json` contract through `getWidgetDefinition`;
  - builds the saved FAQ text graph;
  - reads current translated locale values;
  - resolves the Instance Translation Agent policy/model/budget through `ck-policy`;
  - enqueues `instance.translation.locale_values` jobs on `INSTANCE_TRANSLATION_JOBS`.
- San Francisco consumes `instance.translation.locale_values` jobs and completes through Tokyo:
  - `PUT /__internal/instances/{instanceId}/translations/{locale}/complete`.
- San Francisco no longer writes Tokyo overlay storage routes and no longer receives/emits `overlayId` as completion output.
- Tokyo completion re-reads current instance text and current translated locale values before writing. Stale completions are ignored when:
  - the saved text graph no longer matches the job basis;
  - the translated locale values no longer match the job basis.
- Old Tokyo overlay HTTP routes for selected/inventory/object/write/read language storage were deleted from the service surface.
- Roma's old translation job assembler and locale-overlay helper libraries were deleted.

Excluded:

- no instance source split into `instance.content.json` and `instance.config.json`;
- no changed-field marker model for already-translated locales;
- no open/save/list migration from `saved.json`, `save.json`, and `index.json`;
- no publish/public artifact migration.

Important boundary:

- 103_02.3b is green for operation ownership and stale-completion safety only.
- Changed-field delta for already-ready translated locales is now closed by 103_02.3c content status, not by this slice.

Verification:

- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm verify:prd103-faq-vertical`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `node scripts/verify/primitive-drift.mjs`
- `git diff --check`

Guard search for deleted product-boundary vocabulary is clean:

```text
account-instance-translation-jobs
acceptInstanceTranslationJobs
instance.translation.render_overlay
writeInstanceLanguageOverlayToTokyo
overlay_written
locale-overlays
list-locale-overlays
read-locale-overlay
write-locale-overlay
/__internal/overlays/languages/write.json
/__internal/overlays/languages/list.json
```

## Slice 103_02.3c.1 - Instance Content Status Delta

This sub-slice added the approved source-side changed marker needed by PRD 103 Generate.

Included:

- Tokyo save writes split source files under the instance folder:
  - `instance.config.json`;
  - `instance.content.json`.
- `instance.content.json` stores editable customer-visible strings as field paths with:
  - `value`;
  - `status: "ok" | "changed"`.
- Content fields may also carry per-locale status so one completed locale cannot clear a changed field before every Generate target locale finishes.
- On save:
  - new instances initialize content fields as `ok`;
  - changed string values become `changed`;
  - unchanged fields preserve their prior status.
- Tokyo Generate now selects:
  - fields missing from the target locale's current translated values;
  - fields marked `changed` in `instance.content.json`.
- Existing translated locales no longer get skipped wholesale. Editing only `header.title` after Italian already exists queues only `header.title`.
- San Francisco merges produced translations by `job.changedFields`, not by re-deriving source diff from old overlay/storage state.
- Tokyo completion writes only the translated changed fields into the current locale value map and preserves unrelated current values.
- Tokyo marks the completed locale `ok` for each changed path and clears the field's global `changed` status only after every target locale from that Generate batch has completed.

Deliberate limits:

- Legacy `instance.json`, `sourceVersion`, generation lanes, and account `index.json` still exist in current source/publish internals. They are not closed by this sub-slice.
- Roma direct instance clients still called `saved.json`, `save.json`, and `index.json` after this sub-slice. That is closed by 103_02.3c.2.
- Publish/public artifact behavior is untouched and remains 103_02.4.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`

## Slice 103_02.3c.2 - Product Instance Open/Save/List/Create/Rename

This sub-slice moved the active Roma authoring/client surface off file-shaped instance routes.

Included:

- Tokyo-worker exposes product-shaped instance operations:
  - `GET /__internal/accounts/{accountId}/instances`;
  - `POST /__internal/instances`;
  - `GET /__internal/instances/{instanceId}`;
  - `PUT /__internal/instances/{instanceId}`;
  - `POST /__internal/instances/{instanceId}/rename`.
- Roma direct instance helpers now call those product operations for list, create, open, save, and rename.
- Roma no longer calls these storage-shaped routes for the active authoring flow:
  - `/__internal/renders/widgets/index.json`;
  - `/__internal/renders/widgets/{instanceId}/saved.json`;
  - `/__internal/renders/widgets/{instanceId}/save.json`.
- Save responses returned to Bob/Roma no longer expose `sourceVersion`, `generation`, or `previousConfig`.
- Rename is now a display-state operation in Tokyo and does not resubmit the full widget config/content.
- `listAccountInstances` reads instance source inside Tokyo and does not expose `accounts/{accountPublicId}/instances/index.json` as a Roma product contract.

Deliberate limits:

- Closed in 103_02.5: the old storage-shaped Tokyo instance route shims were deleted after duplicate/delete moved to product routes.
- Closed in 103_02.5: Roma delete now uses `DELETE /__internal/instances/{instanceId}`.
- Publish/unpublish, serve-state, public artifact readiness, `index.html`/`index.html.off`, San Francisco embed materialization, legacy `sourceVersion`, and generation lanes remain assigned to 103_02.4/103_02.5.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/bob lint`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma lint`
- `pnpm verify:prd103-faq-vertical`
- `pnpm verify:prd103-publish-language-files`
- `node scripts/verify/primitive-drift.mjs`
- `git diff --check`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm verify:prd103-faq-vertical`

## Slice 103_02.4a - Product Publish Routes And Publish-State Serving

This sub-slice moved publish/unpublish and public serving off file-rename publish state.

Included:

- Tokyo-worker exposes product-shaped publish operations:
  - `POST /__internal/instances/{instanceId}/publish`;
  - `POST /__internal/instances/{instanceId}/unpublish`.
- Roma direct instance helpers now call those product operations for publish and unpublish.
- Roma no longer calls these storage-shaped routes for publish controls:
  - `/__internal/renders/widgets/{instanceId}/publish.json`;
  - `/__internal/renders/widgets/{instanceId}/unpublish.json`;
  - `/__internal/renders/widgets/serve-state.json`.
- Unpublish now updates `publishStatus` only. It no longer renames `index.html` to `index.html.off`.
- Public `clk.live` serving now requires published instance state before serving canonical HTML or support assets.
- Generated `index.html` is still checked as artifact readiness. It is no longer the publish-state model.
Deliberate limits:

- Closed in 103_02.5: old Tokyo storage-shaped publish/serve-state route shims were deleted.
- Closed in 103_02.5: Roma delete now uses the product instance route.
- Artifact materialization ownership, generation lanes, sourceVersion, San Francisco embed writer deletion, exact support filename expectations, and support-file serving were closed by 103_02.4b.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm verify:prd103-faq-vertical`
- `pnpm verify:prd103-publish-language-files`

## Slice 103_02.4b - Tokyo-Owned Public Artifact Materialization

This sub-slice moved generated public artifact ownership to Tokyo and deleted the stale San Francisco embed writer path.

Included:

- Tokyo-worker owns `materializeInstancePublicArtifacts`.
- Publish now materializes current public artifacts from:
  - approved account instance source;
  - deploy-managed widget runtime files under `product/widgets/{widgetType}`;
  - current translated locale values.
- Publish writes generated visitor files before setting `publishStatus: "published"`.
- Public serving still requires `publishStatus: "published"`, but it no longer reads `index.html` first before serving every support asset.
- Generated public files are stable artifacts:
  - `index.html`;
  - `styles.css`;
  - `script.js`;
  - `{locale}.html`;
  - `script.{locale}.js`.
- Bob's public script snippet keeps `/script.js` as the intentional stable public contract.
- Tokyo saved instance source no longer writes or normalizes generic `sourceVersion` or `generation.*` lanes.
- `tokyo-worker/src/domains/render/generation-status.ts` and its tests were deleted.
- San Francisco `embed-file-writer` and `widget-generation-jobs` source/tests were deleted. San Francisco remains the Instance Translation text-production delegate only.
- The PRD 103 publish-language verifier now proves public base and translated output through Tokyo publish/materialization and `clk.live`, not by importing San Francisco artifact code or asserting versioned support filenames.
- `primitive-drift` now blocks reintroducing the deleted SF embed writer/generation-job files, Tokyo generation-status source, and versioned/SF/sourceVersion publish verifier proof.

Deliberate limits:

- Legacy `instance.json` still exists as a compatibility source document alongside split `instance.config.json` and `instance.content.json`; it no longer carries `sourceVersion` or `generation.*`.
- Closed in 103_02.5: old storage-shaped Tokyo route shims were deleted.
- Closed in 103_02.5: Roma delete now uses the product instance route.
- Closed in 103_02.5: mirror/snapshot queue vocabulary and bindings were deleted.
- Private overlay storage remains below translated-locale operations until a later cleanup slice; product payloads still use locale values only.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm verify:prd103-faq-vertical`
- `pnpm verify:prd103-publish-language-files`

## Slice 103_02.5 - Cleanup And 103_00.4 Handoff

This sub-slice deleted the remaining zero-caller storage-shaped instance routes and mirror/snapshot queue vocabulary after product callers moved.

Included:

- Roma duplicate now calls `POST /__internal/instances/{instanceId}/duplicate`.
- Roma delete now calls `DELETE /__internal/instances/{instanceId}`.
- Tokyo-worker exposes product duplicate/delete routes and no longer exposes the old `renders/widgets/*.json` compatibility shims for:
  - `serve-state.json`;
  - `index.json`;
  - `index/rebuild.json`;
  - `create.json`;
  - `{instanceId}/save.json`;
  - `{instanceId}/duplicate.json`;
  - `{instanceId}/publish.json`;
  - `{instanceId}/unpublish.json`;
  - `{instanceId}/saved.json`.
- Tokyo-worker removed the dead render snapshot/mirror queue consumer and binding:
  - deleted `tokyo-worker/src/domains/render/queue.ts`;
  - deleted `tokyo-worker/src/queue-handler.ts`;
  - removed `RENDER_SNAPSHOT_QUEUE` from `Env`, `wrangler.toml`, and deploy queue provisioning.
- Account-instance delete is now named `deleteAccountInstanceSubtree`, not `deleteInstanceMirror`.
- `primitive-drift` now blocks reintroducing the deleted storage-shaped route family and mirror/snapshot queue binding/provisioning.
- Active service docs now list product-operation routes and state that Tokyo-worker does not consume the old render snapshot/mirror queue.

Deliberate limits:

- Legacy `instance.json` remains a compatibility mirror alongside `instance.config.json` and `instance.content.json`; it is not product authority and no longer carries `sourceVersion` or generic generation lanes.
- Physical `accounts/{accountPublicId}/instances/index.json` and private overlay storage helpers may still exist below Tokyo internals while product callers use operations. Final deletion/rebuild policy is part of 103_00.4 reconciliation, not this route cleanup.
- Broader architecture docs with supersession banners remain queued for 103_00.4 final rewrite/signoff.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`

## Slice 103_02.1 Scope

This slice does not change runtime behavior.

Included:

- inventory active consumers of `instance.json`, saved-render documents, pointer/source-version payloads, and account instance indexes;
- inventory Roma/Bob/San Francisco/Tokyo paths that expose `saved.json`, `save.json`, `index.json`, `serve-state.json`, locale-overlay routes, overlay IDs, selected overlay pointers, generation lanes, or generated file inventories;
- inventory publish/public serving paths that treat `index.html`, `index.html.off`, support filenames, or generated file lists as product state;
- inventory tests, verifiers, health scripts, and docs that teach those storage-shaped concepts as product contracts;
- record deletion/keep/private-implementation candidates for the next decision slice.

Excluded:

- no `instance.config.json` / `instance.content.json` split implementation;
- no route rename or shim;
- no overlay/translation API migration;
- no San Francisco queue contract migration;
- no publish/public serving behavior change;
- no generated artifact deletion.

Current dirty worktree note:

- The repository already contains prior 103_01 source/code/doc changes and pre-existing Roma edits. They are not evidence that this slice moved runtime implementation forward.
- 103_02.1 may edit only PRD/status documentation.

## Consumer Inventory

| Source or artifact | Active consumers found | Current product problem | 103_02.2 decision / next action |
| --- | --- | --- | --- |
| Current saved instance document / `instance.json` / saved-render document | Tokyo saved-config domain, Roma open/save/rename/publish paths, tests, docs | One catchall source shape mixes identity, widget type, config/content, generation state, publish status, timestamps, and public artifact hints. | Kill catchall `instance.json`; split into `instance.content.json`, `instance.config.json`, job/workflow state, generated artifact, or delete. |
| `sourceVersion` and pointer-shaped saved responses | Roma save/open callers and Tokyo transition responses | Version/pointer vocabulary leaks through product payloads and risks becoming concurrency architecture by accident. | No generic `sourceVersion` product model. Any freshness/revision rule must be named by the owning save/generate/complete operation. |
| `accounts/{accountPublicId}/instances/index.json` | Roma account widget list through Tokyo index routes; Tokyo repair/index update tests | Generated account index is treated like Roma product API. | Delete as product model. `listAccountInstances` is the product operation; no Roma-facing index JSON handoff survives. |
| `/__internal/renders/widgets/{instanceId}/saved.json` | Roma direct client and account APIs | Saved source is exposed as render/file route vocabulary. | Replace product callers with `openAccountInstance`. |
| `/__internal/renders/widgets/{instanceId}/save.json` | Roma save route and Tokyo save transitions | Save is named as writing saved render config. | Replace product callers with `saveAccountInstance`. |
| `/__internal/renders/widgets/index.json` | Roma widget list and Tokyo index routes | Account list is a file-shaped read model crossing the service boundary. | Replace with `listAccountInstances`; delete index JSON as product model. |
| `/__internal/renders/widgets/serve-state.json` | Roma publish controls and Tokyo serve-state route | Serving mechanics leak into product API. | Replace with publish status/readiness product operation or delete if not needed. |
| Roma `locale-overlays` account route family | Bob/Roma translation preview and manual edit APIs | Account routes expose overlay implementation, overlay IDs, and storage vocabulary. | Replace with translations list/read/write by locale. |
| Tokyo overlay object, inventory, selected pointer, and overlay ID helpers | Tokyo internal routes, Roma overlay client, San Francisco completion client, tests | Locale translation values are modeled as versioned overlay storage objects crossing boundaries. | Keep exact value-map persistence only as private Tokyo implementation; product payloads must be translated locale values. |
| San Francisco translation completion | Queue handler writes Tokyo overlay storage route | SF writes storage overlay objects instead of completing a product translation operation. | Replace with `completeLocaleTranslation` or equivalent Tokyo operation. |
| `generation.translations.*`, `generation.embed.*`, lanes, generated file lists | Tokyo saved source, San Francisco embed writer, tests/docs | Workflow/file status lives in authoring source without one named writer/product reader. | Delete from authoring source. Product status comes from job/workflow operations if needed. |
| `index.html`, `index.html.off`, `styles.css`, `script.js`, versioned public files, locale HTML/JS files | Tokyo publish/unpublish/public serving, San Francisco embed writer, publish verifier, public serving tests | Generated browser files are sometimes treated as publish state or product contract. | Generated public artifacts only. Publish state lives in approved config/state. |
| `accounts/{account}/instances/{instance}/public artifact file lists` | San Francisco embed writer and tests | Generated file inventories leak implementation details and slow build verification. | Do not expose generated file inventories in instance state or Roma-facing product payloads. |
| `TokyoMirrorJob`, `delete-instance-mirror`, `RENDER_SNAPSHOT_QUEUE` | Tokyo queue/config/code/tests | Mirror/snapshot vocabulary suggests duplicate source truth. | Delete or rename/re-scope to public artifact build/cleanup if a queue remains. |
| Product smoke and PRD verifiers | `scripts/health/product-path-smoke.mjs`, `scripts/verify/prd103-publish-language-files.test.ts`, public-serving tests | Guards still exercise locale-overlay routes and exact generated filenames. | Rewrite after operation decisions; 103_02.1 records blast radius only. |
| Canonical and historical docs | `documentation/**`, PRD 100/103 family docs | Docs still normalize projection, pointer, overlay, generated file, and index vocabulary. | Supersede now where dangerous; final rewrites remain owned by 103_00.4 after 103_02 decisions. |

## Initial Product Operation Target

The replacement vocabulary is:

- `createAccountInstance`
- `listAccountInstances`
- `openAccountInstance`
- `saveAccountInstance`
- `renameAccountInstance`
- `publishInstance`
- `unpublishInstance`
- `generateTranslations`
- `completeLocaleTranslation`
- `listTranslatedLocales`
- `readTranslatedLocaleValues`
- `writeTranslatedLocaleValues`
- `materializeInstancePublicArtifacts`
- `servePublicInstance`

Route names are implementation details. Product callers must not depend on file names, storage keys, overlay IDs, pointer IDs, generation lanes, or generated file lists.

## Local Evidence Snapshot

103_02.1 local repo scan found active product-path evidence for the inventory above. Rows already closed by later 103_02 slices are marked here so this inventory does not become stale truth:

- `roma/lib/account-instance-direct.ts` still models instance rows with `sourceVersion`, `publishStatus`, and `meta`, and calls Tokyo storage-shaped routes for `saved.json`, `save.json`, `create.json`, `duplicate.json`, `serve-state.json`, and `index.json`.
- CLOSED in 103_02.3a: Roma `locale-overlays` account routes and helper library were removed from the product surface. Bob/Roma now use translated-locale list/read/write by locale and values.
- CLOSED in 103_02.3b: Roma's translation job assembler was deleted. Roma Generate now forwards one product command to Tokyo.
- CLOSED in 103_02.3a: Bob/Roma session commands no longer expose `list-locale-overlays`, `read-locale-overlay`, or `write-locale-overlay`.
- CLOSED in 103_02.5: `tokyo-worker/src/routes/internal-render-routes.ts` no longer exposes the old overlay selected/inventory/object/write/read language route surface or the old storage-shaped instance route family. Active instance, translation, publish, duplicate, and delete routes use product-operation paths.
- CLOSED in 103_02.4b: `tokyo-worker/src/domains/render/saved-config.ts`, `normalize.ts`, and `types.ts` no longer model generic `sourceVersion` or `generation.*` lanes as saved instance state. `generation-status.ts` was deleted.
- CLOSED in 103_02.4b: `tokyo-worker/src/domains/render/account-instance-transitions.ts` materializes artifacts before publish and no longer uses `index.html.off` mechanics.
- `tokyo-worker/src/domains/render/keys.ts` still defines account index keys and overlay object keys as storage implementation.
- CLOSED in 103_02.3b: San Francisco translation completion now calls Tokyo `completeLocaleTranslation` and no longer receives/emits `overlayId`.
- CLOSED in 103_02.4b: `sanfrancisco/src/embed-file-writer.ts` and `widget-generation-jobs.ts` were deleted. Tokyo now owns materialization.
- CLOSED in 103_02.5: `tokyo-worker/src/domains/render/queue.ts` and `tokyo-worker/src/queue-handler.ts` were deleted, and `RENDER_SNAPSHOT_QUEUE`/`delete-instance-mirror` vocabulary was removed from Tokyo types, config, and deploy queue provisioning.
- CLOSED in 103_02.5: `scripts/verify/prd103-publish-language-files.test.ts`, Tokyo saved-config/public-serving tests, San Francisco tests, and Roma direct-client tests no longer assert SF embed writer output, versioned support filenames, sourceVersion/generation lanes, `index.html.off` mechanics, or old storage-shaped instance routes.

This evidence is inventory only. It does not approve route shims, renames, source splitting, or runtime behavior changes.

## Code Audit Findings

Read-only code scout findings for 103_02.1:

| Finding | Severity | Evidence | Required decision owner |
| --- | --- | --- | --- |
| Mixed instance source | P1 | `AccountInstanceDocument` still combines identity, widget type, config, base/target locales, source version, generation lanes, publish state, and timestamps. `SavedRenderPointer` is returned by `saved.json` and `save.json`; Roma surfaces `sourceVersion` and `generation` from save. | 103_02.2 classified the target model: content, config, job/workflow state, generated artifact, or delete. 103_02.3/103_02.4 implement the migration. |
| Storage-shaped Roma/Tokyo routes | P1 | Roma calls `saved.json`, `save.json`, `serve-state.json`, `index.json`, and overlay language routes; Tokyo serves those routes. | 103_02.3 must replace product callers with named operations, not route-name wrappers. |
| Account index is product-visible | P1 | `accounts/{account}/instances/index.json` backs Roma widgets list, create checks, and base-locale lock. | 103_02.2 decided delete as product model. 103_02.3 moves callers to `listAccountInstances`. |
| Overlay IDs leak through UI | P1 | Bob/Roma session commands and account routes expose `locale-overlay`, `overlayId`, selected overlay, inventory, and overlay object reads. | 103_02.3 must replace with translated-locale list/read/write operations by locale. |
| Translation generation is Roma-assembled | P1 | Roma loads widget definitions, overlay inventory, existing overlay objects, then queues San Francisco jobs. SF completion writes Tokyo overlay storage and records `overlayId`. | 103_02.3 must assign `generateTranslations` and `completeLocaleTranslation` to Tokyo, with San Francisco as text-production delegate. |
| Translation completion freshness is not modeled | P1 | Current instance translation job contract does not carry source/revision/freshness data; completion can only write overlay values. | 103_02.2 rejected generic `sourceVersion`; 103_02.3 must name the operation-level freshness rule before code migration. |
| Generation lanes and file lists are product state | P2 | `generation.translations`, `generation.embed`, lane status, and `files` are stored in saved instance state; San Francisco and Tokyo can both write related state. | 103_02.2 decided they leave authoring source; product-visible status comes from job/workflow operations if needed. |
| Publish/unpublish uses file presence | P2 | Tokyo publish checks `index.html`; unpublish renames `index.html` to `index.html.off`; public serving gates support assets by `index.html`. | 103_02.4 must replace product readiness with publish/artifact state and test URL behavior, not file surgery. |
| Public artifact materialization owner is unclear | P2 | San Francisco embed writer builds files in tests/verifiers, but no active runtime queue path was found beyond translation queue handling. | 103_02.2 assigned Tokyo as default owner; 103_02.4 implements and verifies the publish/artifact model. |
| Mirror/snapshot queue vocabulary survived | P2 | `TokyoMirrorQueueJob`, `delete-instance-mirror`, and `RENDER_SNAPSHOT_QUEUE` remained in Tokyo code/config. | CLOSED in 103_02.5: deleted rather than renamed because no public artifact queue remained. |
| Rename reuses source save semantics | P1 | Rename path depends on saved-config/source write flow and can disturb source/generation semantics. | 103_02.2 decided rename is an identity/display transition in config; 103_02.3 implements it. |

Implementation blockers after 103_02.3a:

- translation queue completion needs an operation-level freshness guard, not generic `sourceVersion`;
- Generate still belongs to Roma job assembly and must move to Tokyo-owned `generateTranslations`;
- San Francisco completion still writes old overlay storage and must move to Tokyo-owned `completeLocaleTranslation`;
- public artifact materialization needs runtime migration to the Tokyo-owned model;
- instance open/save/list still use saved-render/index vocabulary and must move to product operations.

## Docs, Tests, And Verifiers Audit Findings

Read-only docs/tests/verifiers scout findings for 103_02.1:

| Finding | Evidence | Required owner |
| --- | --- | --- |
| `instance.json` and source revision language need separate decisions | Active docs and tests still teach `instance.json`; saved-config and embed fixtures assert product-facing `sourceVersion` and generation source versions. | 103_02.2 classified `instance.json` as killed and rejected generic `sourceVersion`; 103_02.3/103_02.4 must update callers/tests. |
| Storage route vocabulary is spread across docs and tests | Docs/tests still mention `saved.json`, `save.json`, `index.json`, `serve-state.json`, and direct Tokyo storage route behavior. | 103_02.3 must replace product docs/tests with named Tokyo operations. |
| Overlay identity leaks into preview/manual edit/completion/smoke tests | Bob preview tests use `{ locale, overlayId }`; Roma/SF tests write overlay routes; Tokyo overlay tests assert selected pointer/projection; smoke calls `locale-overlays/list`. | 103_02.3 must rewrite tests around translated locale values, with overlay objects private to Tokyo if kept. |
| Generation lane and file inventory tests are still authoritative | Tokyo generation-status tests assert lane transitions; SF embed tests assert generated file list recording. | 103_02.2 deleted generation lanes/file inventories from authoring source; 103_02.4 must replace tests with workflow/artifact behavior. |
| Public artifact tests assert physical publish mechanics | Public serving tests rely on `index.html`; unpublish tests assert `index.html.off`; publish verifier asserts exact generated filenames; embed snippets assert `/script.js`. | 103_02.4 must preserve only intentional public serving contract and remove file presence as publish state. |
| Verifiers seed old storage object fixtures | PRD 103 publish verifier seeds `instance.json`, source version, generation lanes, and overlay paths. | 103_02.4/103_02.5 must make verifiers guard the new boundary, not old fixture layout. |
| Some active/recent docs need immediate warning notes | `documentation/services/tokyo.md`, `documentation/architecture/OverlayArchitecture.md`, PRD 102, and PRD 100B still teach stale product vocabulary without enough local warning. | 103_02.1a owns narrow supersession notes before 103_02.2 decisions begin. |

Immediate supersession notes to add in 103_02.1a:

- `documentation/services/tokyo.md`: storage tree docs still teach `index.json`, `instance.json`, public files, and `overlays/{overlayId}.json` as product model.
- `documentation/architecture/OverlayArchitecture.md`: overlay ID/body/storage docs still claim active product identity and `spec.overlays.text` source.
- `Execution_Pipeline_Docs/03-Executed/102/102__PRD__Translation_Overlay_Panel_Simplification.md`: recent executed PRD still locks Bob/Roma preview to overlay ID inventory.
- `Execution_Pipeline_Docs/03-Executed/100/100B__PRD__San_Francisco_Agent_Contract.md`: executed PRD still teaches generation status in `instance.json`.

Leave broad rewrites for 103_00.4 where block banners already exist or where historical docs need full architecture replacement:

- `documentation/architecture/CONTEXT.md`;
- `documentation/architecture/Overview.md`;
- `documentation/services/roma.md`;
- `documentation/services/bob.md`;
- `documentation/services/tokyo-worker.md`;
- `documentation/capabilities/localization.md`;
- `documentation/architecture/BabelProtocol.md`;
- `documentation/widgets/WidgetArchitecture.md`;
- `documentation/README.md`;
- historical PRDs 038, 054A, 083, 098, 100A, and 100E.

## Verification For Slice 103_02.1

Required before marking this slice green:

- code-path subagent completed read-only inventory;
- docs/tests/verifiers subagent completed read-only inventory;
- local repo search confirms active consumers and storage-shaped route/product vocabulary;
- this execution ledger exists;
- `103_02` remains executing, not complete;
- no runtime/code files are edited by this slice;
- `git diff --check` passes.

Slice 103_02.1 cannot close if implementation moved before final instance/source/public-artifact decisions.

Observed green on 2026-05-19:

- code-path subagent completed read-only inventory;
- docs/tests/verifiers subagent completed read-only inventory;
- local repo search confirmed active consumers of storage-shaped instance/public-artifact routes, overlay product vocabulary, generation lanes, publish file mechanics, and public artifact filenames;
- this execution ledger exists;
- `103_02` remains executing, not complete;
- no runtime/code file was edited by this slice;
- `git diff --check` passed.

## Verification For Slice 103_02.1a

Observed green on 2026-05-19:

- `documentation/services/tokyo.md` has a PRD 103_02 warning that current physical storage tree docs are not product-boundary authority;
- `documentation/architecture/OverlayArchitecture.md` has a PRD 103_02 warning that overlay IDs, selected pointers, inventories, and physical overlay files must not be exposed as product contracts after 103_02;
- `Execution_Pipeline_Docs/03-Executed/102/102__PRD__Translation_Overlay_Panel_Simplification.md` has a PRD 103_02 supersession note for overlay-inventory/`overlayId` preview contracts;
- `Execution_Pipeline_Docs/03-Executed/100/100B__PRD__San_Francisco_Agent_Contract.md` has a PRD 103_02 supersession note for `instance.json` generation state, overlay output, and generated-file contracts;
- broad architecture rewrites remain assigned to 103_00.4;
- no runtime/code file was edited by this slice;
- `git diff --check` passed.

## Verification For Slice 103_02.2

Observed green on 2026-05-19:

- final instance source/state decisions are recorded in this execution ledger and in `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`;
- `instance.json` is killed as product model and mapped to content/config/job workflow/generated artifact/delete;
- `instance.content.json` is defined as all editor-visible customer text and the translation source;
- `instance.config.json` is defined as all non-text instance state plus identity/display/widget type/code/locale setup/publish state/timestamps;
- `instance.meta.json` is not introduced;
- translated locale values are defined as `locale -> translated content values`, with no product-facing `overlayId`, pointer, version slot, provenance, review state, source hash, generation ID, or manual override status;
- manual translation edits remain temporary current-value overwrites that regeneration may replace;
- generation lanes and generated file inventories are deleted from authoring source;
- generic `sourceVersion` is rejected as product model; any freshness/revision rule must be named by the owning operation before coding;
- `accounts/{accountPublicId}/instances/index.json` is deleted as product model;
- publish state belongs to approved config/state and generated files are artifacts, not state;
- public artifact materialization owner is Tokyo by default;
- no runtime/code file was edited by this slice;
- targeted status/stale-wording search found no pending 103_02.2 status or stale decision wording outside historical evidence rows;
- `git diff --check` passed.

## Verification For Slice 103_02.3a

Observed green on 2026-05-19:

- Bob/Roma translation-preview product surface has no `locale-overlays`, `list-locale-overlays`, `read-locale-overlay`, `write-locale-overlay`, `LocaleOverlay`, `localeOverlay`, or `overlayId` references;
- Roma account `locale-overlays/list`, `locale-overlays/read`, and `locale-overlays/write` route files were deleted;
- Tokyo translated-locale domain proof covers list/read/write by locale with no product-facing overlay identity;
- Roma translated-locale client proof covers list/read/write by locale with no product-facing storage identity;
- Bob translation-preview proof covers translated-locale list/value payloads and manual edit value replacement;
- `scripts/health/product-path-smoke.mjs` uses the translated-locale route instead of locale-overlay routes;
- `node scripts/verify/primitive-drift.mjs` passed;
- `pnpm --filter @clickeen/bob typecheck` passed;
- `pnpm --filter @clickeen/roma typecheck` passed;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passed;
- `pnpm --filter @clickeen/bob test` passed;
- `pnpm --filter @clickeen/roma test` passed;
- `pnpm --filter @clickeen/tokyo-worker test` passed;
- `git diff --check` passed.
