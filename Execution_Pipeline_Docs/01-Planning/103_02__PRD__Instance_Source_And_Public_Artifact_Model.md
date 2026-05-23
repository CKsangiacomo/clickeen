# PRD 103_02 - Instance Source And Public Artifact Model

Status: Planning Hold / Superseded By `103_DB_Pivot`
Owner: Product + Architecture
Date: 2026-05-21
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`
Execution ledger: `103_02__EXEC__Instance_Source_And_Public_Artifact_Model.md`

## Purpose

2026-05-21 update: this PRD's split-file model is no longer the target architecture. It remains evidence for field semantics, but the storage location is superseded. Instance authoring state, translated locale values, workflow state, and publish/materialization state must move to Supabase-backed product operations. R2 is only for public artifacts and other true blobs.

Lock the account instance storage model before PRD 103 resumes.

This PRD decides what lives under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

PRD 103 translation must target the approved instance source model, not current accidental storage shape.

## Product Truth

An instance is account-owned data plus generated static visitor files.

The instance must split user-visible base content from non-content config:

```text
instance.content.json = every user-editable string in the widget, in the same paths/shape the editor exposes for content text
instance.config.json = every non-text setting plus instance identity, structure, style, behavior, and publish state
```

`instance.content.json` includes all customer-visible copy that a user can edit in ToolDrawer, content panels, or widget-specific text controls: titles, subtitles, CTA labels, FAQ questions and answers, captions, item labels, and any other widget string. This is the translation input.

Every editable content field is stored as a string. `richtext` means sanitized HTML string, not an object. Tokyo's save/source split is the single write boundary that materializes the widget editable-field contract so downstream translation, review, publish, and runtime paths do not re-interpret content shapes service by service.

`instance.config.json` includes everything else that belongs to the instance itself: `instanceId`, widget type/code, display name, styles, layout, structure, behavior, non-text settings, publish state, and any other non-content control state.

Account locale setup is not instance source. `localePolicy` belongs to account policy/settings and defines the base/source locale and allowance. `selectedTargetLocales` belongs to Roma account settings and defines the locales the user has chosen to generate/review.

Translated locale values apply to `instance.content.json`, not to mixed config. The product model is `locale -> translated content values`; Roma and Bob must not see `overlayId` as translation identity.

Roma must read and command Tokyo through product operations, not through file-shaped route contracts.

This PRD deletes storage-shaped product concepts. It does not merely hide them.

Physical persistence can remain. Tokyo may still write bytes to R2, KV, D1, or generated static files. But `saved.json`, `index.json`, overlay pointers, overlay inventories, published projections, and file lanes cannot remain as the instance model. They either become direct implementations of `instance`, `instance content`, `instance config`, `translation values`, `publish status`, and `public artifact`, or they are deleted.

This PRD also removes file-handoff latency. Instance save, translation generation, translation review, publish, and public serving must not require chains of "write object, read object, list siblings, validate by re-reading source, write another object." The owning service should resolve source once and return/accept the product operation.

The following current Roma-facing shapes are audit targets:

- `/__internal/renders/widgets/index.json`
- `/__internal/widgets/definitions`
- `/__internal/renders/widgets/{instanceId}/saved.json`
- `/__internal/renders/widgets/{instanceId}/save.json`
- `/__internal/overlays/languages/list.json`
- `/__internal/overlays/{overlayId}.json`
- `/__internal/overlays/languages/write.json`

These names leak Tokyo storage/generated artifact vocabulary into Roma. The target is service vocabulary:

- list account instances
- get widget catalog
- open instance
- save instance
- rename instance
- publish/unpublish instance
- list translated locales
- generate translations
- read translated locale values
- write translated locale values

The cleanup must be operation-shaped, not route-rename-shaped. A new endpoint that wraps today's storage walk is not acceptable. The product operation owner must collapse the current chain into one command or one query, then keep storage details private inside that owner.

Example failure to avoid:

```text
Roma calls a new "generate translations" route.
That route still fetches catalog JSON, lists overlay files, reads overlay objects, and builds queue payloads in Roma.
```

That is still storage-mediated coupling with better names. The target is:

```text
Roma sends generate translations for an instance.
Tokyo resolves instance content, field contract, existing values, missing/changed fields, model policy, and queue work.
Roma never sees overlay inventory, overlay IDs, selected pointers, or catalog artifacts.
```

## Scope

Audit and classify:

- current `instance.json`
- target `instance.config.json`
- target `instance.content.json`
- possible metadata fields currently inside `instance.json`
- `overlays/{overlayId}.json`
- `index.html`
- `styles.css`
- `script.js`
- versioned generated files such as `styles.vN.css`, `script.vN.js`, `{locale}.html`, and locale JS files
- `accounts/{accountPublicId}/instances/index.json`
- any generated public files, cache-busting files, compatibility files, read models, or repair paths connected to instance serving.

## Initial Decisions

- Kill the current catchall `instance.json` model.
- Do not add `instance.meta.json` unless a real product/build/runtime consumer is named first.
- If metadata is unused, delete it instead of moving it.
- `instance.content.json` is all editable user-visible strings, in the same semantic paths/shape the editor uses for text editing.
- `instance.config.json` is all non-text instance state plus identity/display/locale/publish state.
- Translated locale values are `locale -> translated content values` stored on `instance.content.json` fields. They are not overlay IDs, selected pointers, version slots, or storage-object identities.
- Legacy overlay files may exist only until data cleanup. They are not the current translated-locale value store and no product operation may read or write them as translation truth.
- Manual translation edits overwrite current translated locale values temporarily. Regeneration may overwrite them.
- Generated public files are not source authority and must not define publish state.
- Delete `accounts/{accountPublicId}/instances/index.json` as a product model. `listAccountInstances` is the product operation. Do not preserve a JSON file handoff that Roma knows about.
- Roma must not compute translation jobs from widget catalog artifacts plus overlay files. Roma's responsibility is to accept the user's Generate intent for an instance. The translation owner must load the saved instance content, editable-fields contract, field-level locale status, policy/model profile, and delta rules.
- Roma must not expose overlay file/object identity as the UI contract. Bob/Roma should ask for translated locale inventory and translated locale values; Tokyo may store those as overlay files internally.
- Delete `generation.translations.status`, `generation.embed.status`, file lanes, and generated file inventories from the instance source model. Async job state belongs to the queue/job/workflow infrastructure, not to `instance.content.json` or `instance.config.json`. Product operations may expose accepted/running/complete/error status from that infrastructure when needed.
- Rename must not use the full saved-config/source write path if it only changes identity/display metadata.
- Publish state belongs to the approved instance state in `instance.config.json`; public artifacts are generated output. Roma should receive publish status/public URL behavior, not reason about projections, live pointers, file presence, or generated file lanes. Projection/pointer/lane concepts should be deleted unless they are private physical mechanics with no product-facing name.

## Starter Instance Decision

Widget software must not contain starter customer content.

Starter/default business copy belongs in normal account-owned starter instances under the Clickeen/admin account. Roma create-new-widget may duplicate a starter instance, but the widget software folder itself must not carry “Bed and Breakfast” or other customer-specific starter content as product source.

## Product Operation Owners

| Operation/concern | Surviving owner | Notes |
| --- | --- | --- |
| `createAccountInstance` / duplicate starter instance | Tokyo-worker | Roma sends create/duplicate intent. Tokyo mints IDs and writes account-owned source. |
| `listAccountInstances` | Tokyo-worker | Product operation. `instances/index.json` is deleted as a product model; any future read model must be a deliberate private implementation detail, not a Roma-facing JSON contract. |
| `openAccountInstance` | Tokyo-worker with Roma authorization | Builder open loads one approved instance source; publish state must not block editing. |
| `saveAccountInstance` / rename | Tokyo-worker | Save writes approved content/config source. Rename is an identity/display transition in config, not a content or generated-artifact rewrite. |
| `generateTranslations` | Tokyo-worker operation owner; San Francisco text-production delegate | Roma accepts user intent only. Tokyo resolves source, fields, existing locale values, policy/model profile, and queued work. |
| San Francisco translation production | San Francisco | SF translates changed text values and writes completion through Tokyo product operations, not overlay storage routes. |
| `completeLocaleTranslation`, `listTranslatedLocales`, `readTranslatedLocaleValues`, `writeTranslatedLocaleValues` | Tokyo-worker | Tokyo validates against approved instance content/editable-field contract and owns persisted locale values. |
| Public artifact materialization | Tokyo-worker, with San Francisco as text/AI delegate only where needed | Tokyo owns readiness because it owns source, translation values, publish state, and public serving. |
| `publishInstance` / `unpublishInstance` | Tokyo-worker | Product publish state lives in approved instance config/state and is not file presence or file rename state. |
| Public visitor serving | Tokyo-worker/Venice public serving boundary as currently deployed | Serving uses publish/artifact readiness, not authoring source or storage path names as product API. |

## Implementation Blast Radius - Code Vectors

The implementation plan must account for these active vectors. Existing callers prove blast radius, not product legitimacy.

| Vector | Current coupling | Required implementation action |
| --- | --- | --- |
| `roma/lib/account-instance-direct.ts` | Calls `saved.json`, `save.json`, `serve-state.json`, `index.json`, `catalog.json`, and overlay language routes. | Replace with product operation client methods; no Roma helper should expose file-shaped route names. |
| `roma/app/api/account/instances/[instanceId]/route.ts` | Save path calls Tokyo save, then translation job orchestration. | Keep save as one Tokyo source operation; translation generate must be explicit user operation or one accepted async product command, not Roma storage assembly. |
| `roma/lib/account-instance-translation-jobs.ts` | Loads Tokyo catalog, overlay inventory, each overlay object, then queues SF jobs. | Delete this storage-composition role from Roma. Move delta/job construction to Tokyo's translation generation operation. |
| `roma/lib/account-instance-locale-overlays.ts` and `roma/app/api/account/instances/[instanceId]/locale-overlays/**` | Account API speaks locale-overlay storage vocabulary. | Replace with translations list/read/write APIs by locale. Remove overlay IDs from product responses. |
| `roma/components/builder-domain.tsx`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/sessionTransport.ts` | Session commands use `list-locale-overlays`. | Rename to translation/preview locale commands and update Bob/Roma message contracts together. |
| `tokyo-worker/src/routes/internal-render-routes.ts` | Contains storage-shaped routes and overlay write/list/read/pointer behavior. | Add product operation routes; route shims may delegate to new operations only during migration. |
| `tokyo-worker/src/domains/render/saved-config.ts` | `readSavedRenderConfig`, `writeSavedRenderConfig`, `SavedRenderPointer`, generation lanes. | Replace saved-render/pointer model with approved instance source model and delete generation ghost fields unless backed by a named workflow primitive. |
| `tokyo-worker/src/domains/render/account-instance-transitions.ts` | Save/publish/unpublish transitions read/write source, serve state, index, and public files. | Split source save, publish state, artifact readiness, and cache/index update responsibilities under product operations. |
| `tokyo-worker/src/domains/render/overlays.ts` | Overlay objects, selected pointer, inventory, and version allocation are exposed through service routes. | Keep exact value-map persistence only as private Tokyo implementation; product API is locale translation values. |
| `tokyo-worker/src/domains/render/keys.ts` | Defines account index and instance storage keys. | Classify keys as private implementation; delete product dependencies on key names. |
| `tokyo-worker/src/domains/render/generation-status.ts` | Models translation/embed lanes as source fields. | Delete or replace with named workflow status owner/writer/reader. |
| `tokyo-worker/src/queue-handler.ts`, `tokyo-worker/src/domains/render/queue.ts`, `tokyo-worker/wrangler.toml` `RENDER_SNAPSHOT_QUEUE` | Mirror/snapshot queue vocabulary suggests duplicate source truth. | Rename/delete as public artifact build/cleanup work only if queue remains. |
| `sanfrancisco/src/instance-translation-queue.ts` and `sanfrancisco/src/tokyo-translation-client.ts` | Queue consumer writes overlay storage route. | Complete translations through Tokyo locale-value operation and prevent stale completions from overwriting newer saves. |
| `sanfrancisco/src/l10n-account-routes.ts` | Agent operation is `translate_saved_instance`. | Rename around account instance locale translation values; storage target is not part of the SF contract. |
| `sanfrancisco/src/embed-file-writer.ts` | Reads/writes generation lanes and exact public files. | Either move ownership to Tokyo or narrow SF to an explicit artifact-build operation with Tokyo-owned writes/readiness. |
| `scripts/health/product-path-smoke.mjs` | Exercises locale-overlay account routes. | Rewrite smoke coverage to translations routes and public publish behavior. |
| Public serving tests/routes in Tokyo-worker | Use `index.html` presence as availability oracle. | Assert publish/artifact readiness behavior, not filename existence as state. |

## Occurrence Inventory - Active Service Boundaries

| Occurrence | Severity | Current problem | Required product operation |
| --- | --- | --- | --- |
| `/__internal/renders/widgets/index.json` in Tokyo-worker and Roma direct client | P1 | Roma loads an account instance index by filename. | `listAccountInstances`; delete the product concept of an account index. No Roma-facing index JSON or cache contract survives. |
| `/__internal/renders/widgets/{instanceId}/saved.json` and `readSavedRenderConfig` | P1 | Saved source is exposed as a render/file object. | `openAccountInstance`; response shape must match the approved instance model. |
| `/__internal/renders/widgets/{instanceId}/save.json` and `writeSavedConfigToTokyo` | P1 | Save is named as writing saved render config. | `saveAccountInstance`; save writes approved config/content model only. |
| `SavedRenderPointer`, `SavedRenderDocument`, and `pointer` types | P1 | Pointer/render vocabulary implies a second product truth. | `AccountInstanceSummary` / `AccountInstanceDocument`; no product pointer concept unless explicitly approved. |
| `result.pointer.sourceVersion`, `saved.value.pointer`, and pointer-shaped HTTP payloads | P1 | Pointer vocabulary leaks through response bodies, not only internal types. | Response bodies should carry approved instance summary/content/config fields directly. Any freshness contract must be named by the owning operation, not inherited from pointer/source vocabulary. |
| `/__internal/overlays/languages/write.json` in Roma, Tokyo-worker, and San Francisco | P1 | Translation write is exposed as overlay JSON storage operation. | `writeInstanceLocaleTranslationValues` or equivalent translated-locale write command. |
| Roma/Bob host commands `list-locale-overlays`, `read-locale-overlay`, `write-locale-overlay` | P1 | UI/session command vocabulary is storage-overlay vocabulary. | `listPreviewLocales`, `readLocaleTranslation`, `saveLocaleTranslation`. |
| Roma route family `locale-overlays/list`, `locale-overlays/read`, `locale-overlays/write` | P1 | Account-facing route names expose overlay implementation. | Account instance translations API: list/read/write translated locale values. |
| `writeSelectedOverlayPointer`, `readSelectedOverlayPointer`, `deleteSelectedOverlayPointer` | P2 | Function names claim pointer persistence; current behavior infers latest complete overlay files. | Delete selected-overlay pointer as a product concept unless selection is explicitly approved. Translation availability should derive from locale translation values. |
| `InstanceGenerationLane`, `GenerationLaneName`, `lane`, `files`, `generation` surfaced after save | P2 | Build/file-lane state leaks into account save responses and is duplicated across Tokyo-worker and San Francisco. | Delete from instance source. If product status is needed, expose it from the job/workflow system through a named operation, not source files. |
| `/__internal/renders/widgets/serve-state.json`, `serveStates`, and `internal.render.serveState.body` | P2 | Serving mechanics obscure the product question: is this instance published? | `publishStatus` / `publishStatuses`; route as `instances/publish-status` or equivalent product operation. |
| `TokyoMirrorJob`, `delete-instance-mirror`, `RENDER_SNAPSHOT_QUEUE` | P2 | Mirror/snapshot vocabulary suggests duplicate source truth. | Delete mirror/snapshot as product concepts. If a queue survives, it performs named artifact cleanup/build work against approved instance/public artifact concepts. |
| San Francisco routes/contracts `translate-saved-instance`, `translate_saved_instance`, `instance.translation.render_overlay` | P2 | Translation job names describe saved/overlay storage targets. | `translateAccountInstanceLocale` / `generateLocaleTranslationValues`. |
| `materializeConfigMedia`, `materializeImageFill`, `materializeVideoFill`, `materializeLogoAssetNode` in shared contracts/Bob | P3 | Materialize vocabulary leaks transformation/storage concept onto product preview. | `resolveAssetReferences`, `resolveImageReference`, `resolveVideoReference`, `resolveLogoReference`. |
| `materializeAccountAdditionalLocales` in Roma account locales | P3 | Database/materialized-view vocabulary for computing account locale set. | `resolveAdditionalAccountLocales` or `computeAccountLocaleSet`. |
| `AccountLocaleOverlayInventoryPayload`, `LocaleOverlayInventoryEntry`, `loadAccountInstanceLocaleOverlayInventory`, `listLocaleOverlayInventory`, `normalizeLocaleOverlayInventory` | P3 | Inventory vocabulary describes storage stock, not translations. | `InstanceTranslationList`, `InstanceTranslationSummary`, `loadInstanceTranslations`, `listInstanceTranslations`, `normalizeInstanceTranslationList`. |
| `ck-policy` text mentioning Tokyo-worker sync and SEO/GEO artifact sync | P3 | Policy metadata describes sync mechanics instead of policy enforcement. | Describe policy-controlled capabilities, limits, or embed build output. |

## Required Product Operation Replacement Map

Routes are implementation details. This is the concrete product-operation cleanup target. Old storage-shaped routes may temporarily coexist as migration shims only. PRD 103 cannot complete while callers still use them, and the old routes must be removed after migration.

| Product operation | Replaces today's storage-shaped chain | Owner expectation |
| --- | --- | --- |
| `createAccountInstance` | `create.json` plus starter/default copy from widget software | Tokyo creates account-owned instance config/content from an approved starter instance, not widget source defaults. |
| `listAccountInstances` | `index.json` account read model as Roma product API | Tokyo returns account instance summaries. `instances/index.json` is deleted as product model; no Roma-facing JSON handoff survives. |
| `openAccountInstance` | `saved.json` render-file source read | Tokyo returns approved instance config/content and product metadata. |
| `saveAccountInstance` | save render config, re-read source, patch account index | Tokyo writes approved source once and returns saved state/summary. |
| `generateTranslations` | Roma catalog fetch + overlay inventory list + N overlay reads + queue send | Tokyo resolves editable fields, content field locale status, policy/model profile, and queues work. |
| `completeLocaleTranslation` | SF writes overlay object through storage route | Tokyo accepts changed locale values, merges them into current translation values, and triggers downstream artifact work if needed. |
| `listTranslatedLocales` | overlay inventory, selected pointer, latest complete overlay resolution | Tokyo returns locale summaries without exposing overlay IDs or file paths. |
| `readTranslatedLocaleValues` | `overlays/{overlayId}.json` reads | Tokyo returns values by `instanceId + locale`, not overlay object identity. |
| `writeTranslatedLocaleValues` | manual overlay write route | Tokyo overwrites current locale values; manual edits are temporary and may be replaced by regeneration. |
| `publishInstance` | publish route plus `index.html` existence checks | Tokyo checks product build readiness and publishes the instance. |
| `unpublishInstance` | `index.html` to `index.html.off` file surgery | Tokyo updates product publish state; generated files are implementation details. |

Route names may follow the operation map, but naming alone is not enough:

| Current storage route | Replacement product route |
| --- | --- |
| `POST /__internal/renders/widgets/create.json` | `POST /__internal/instances` |
| `POST /__internal/renders/widgets/serve-state.json` | `GET /__internal/instances/{instanceId}/publish-status` only if publish status remains queryable |
| `GET /__internal/renders/widgets/index.json` | `GET /__internal/accounts/{accountId}/instances` |
| Historical `GET /__internal/renders/widgets/catalog.json` | Replaced by `GET /__internal/widgets/definitions` in 103_01.3b; 103_02 must not reintroduce catalog-file output. |
| `POST /__internal/renders/widgets/index/rebuild.json` | repair-only `POST /__internal/accounts/{accountId}/instances/reindex`, never product path |
| `POST /__internal/overlays/languages/write.json` | `PUT /__internal/instances/{instanceId}/translations/{locale}` |
| `POST /__internal/overlays/languages/clear.json` | `DELETE /__internal/instances/{instanceId}/translations/{locale}` |
| `GET /__internal/overlays/languages/selected.json` | delete unless selected translation remains a product concept |
| `GET /__internal/overlays/languages/list.json` | `GET /__internal/instances/{instanceId}/translations` |

## Cutover And Deletion Sequence

1. Freeze new product callers of storage-shaped routes and overlay/pointer/generation-lane types.
2. Approve the final instance source model: `instance.config.json`, `instance.content.json`, identity/display fields, publish state, timestamps, freshness/revision contract if explicitly needed by an operation, and metadata keep/delete decisions. Approve account locale policy and selected target locale ownership separately so locale state does not leak back into instance source.
3. Add product operation routes and clients for open/save/list/create/rename/publish/unpublish and translations list/read/write/generate/complete.
4. Move Roma direct clients and account routes from storage-shaped Tokyo routes to product operation clients.
5. Move Bob/Roma session commands from locale-overlay vocabulary to translation/preview-locale vocabulary.
6. Move San Francisco translation completion from overlay storage write to Tokyo translated-locale completion.
7. Assign and implement public artifact materialization ownership before changing publish semantics. If Tokyo owns it, Tokyo owns readiness and final artifact writes.
8. Rewrite publish/unpublish/public serving so readiness and availability are product state/workflow state, not `index.html` / `index.html.off`.
9. Rewrite tests and verifiers listed below to assert product behavior.
10. Delete old storage-shaped routes, pointer helpers, generation ghost fields, and unused storage readers after callers move. Do not leave zero-caller compatibility routes.

## Migration Shim Constraints

- Shims are temporary adapters from old route names to new product operations. New product operations must not call old storage-shaped routes.
- Shims must not expose `overlayId`, selected pointers, file lanes, generated file lists, `SavedRenderPointer`, `InstanceGenerationLane`, or raw storage keys in product payloads.
- Roma must not keep a fallback path that reconstructs translation jobs by catalog fetch + overlay inventory + N overlay reads.
- SF completion must not be a stale last-write-wins overlay write. Completion must be accepted only for the current instance/locale work according to the operation owner, or it must be ignored/rejected with a clear reason.
- A shim may preserve an old HTTP path during cutover, but logs/docs/tests must name the new product operation. Acceptance cannot be based on old route tests passing.
- No caller may observe `index.json` shape or repair mechanics. If a future read model is separately approved, it is private below `listAccountInstances` and is not a PRD 103_02 product model.
- If generated files survive, shims may not use file presence as publish truth. Publish checks the named readiness/publish state.

## Required Roma/Bob API Replacement Map

Bob and Roma are product surfaces. They must not say "locale overlay" in API routes or session commands.

| Current product-facing route/command | Replacement product route/command |
| --- | --- |
| `GET /api/account/instances/{instanceId}/locale-overlays/list` | `GET /api/account/instances/{instanceId}/translations` |
| `GET /api/account/instances/{instanceId}/locale-overlays/read` | `GET /api/account/instances/{instanceId}/translations/{locale}` |
| `POST /api/account/instances/{instanceId}/locale-overlays/write` | `PUT /api/account/instances/{instanceId}/translations/{locale}` |
| `list-locale-overlays` | `list-preview-locales` or `list-translations` |
| `read-locale-overlay` | `read-translation` |
| `write-locale-overlay` | `save-translation` |

## Occurrence Inventory - Tests And Verifiers

Tests that assert exact storage filenames must be rewritten before they can guard PRD 103. The target is behavior at the named product boundary, not path trivia.

| Occurrence | Current assertion | Required assertion |
| --- | --- | --- |
| `roma/lib/account-instance-translation-jobs.test.ts` | Imports widget manifest and mocks `/catalog.json`, `/overlays/languages/list.json`, `/overlays/{id}.json`. | Generate intent asks Tokyo to resolve widget contract, existing values, and missing/changed fields through service APIs. |
| `roma/lib/account-instance-locale-overlays.test.ts` | Mocks `saved.json` and `/overlays/languages/write.json`. | Manual locale write loads the saved account instance and submits a full locale value map through translated-locale write API. |
| `sanfrancisco/src/instance-translation-queue.test.ts` | Mocks `/overlays/languages/write.json`. | Queue handler emits one complete translated-locale write command with retained previous values plus changed translations. |
| `sanfrancisco/src/embed-file-writer.test.ts` | Asserts exact files: `index.html`, `styles.v1.css`, `script.v1.js`, `it.html`, `script.v1.it.js`, and `generation.embed.files`. | Successful build makes base and translated public experiences serveable and private authoring/control URLs absent. |
| `scripts/verify/prd103-publish-language-files.test.ts` | Seeds overlay object paths and fetches exact generated filenames. | Published base and translated locale URLs return localized FAQ behavior through the public serving boundary. |
| `tokyo-worker/src/routes/clk-live-routes.test.ts` | Makes `index.html` presence and support filenames the availability oracle. | Public route serves only when instance is publicly available; support assets remain private generated artifacts. |
| `tokyo-worker/src/domains/render/saved-config.test.ts` | Asserts `instance.json`, absence of old `config.json`/`publish.json`, and `index.html.off` mechanics. | Tokyo owns one approved authoring source, publish requires completed public build, unpublish makes public URL unavailable. |
| `tokyo-worker/src/domains/render/overlays.test.ts` | Asserts overlay folder/object placement and selected overlay projection shape. | Overlay writes preserve exact value maps; inventory exposes valid translated locales without leaking folder paths. |
| `tokyo-worker/src/domains/render/generation-status.test.ts` | Asserts queued/ready lane fields on saved source. | Assert named workflow readiness behavior, or delete if generation lanes are removed. |
| `bob/lib/embed-snippets.test.ts` | Asserts snippets use `/script.js`. | Snippets reference only the public instance URL contract and loadable script entry defined by serving contract. |
| `scripts/health/product-path-smoke.mjs` | Calls account `locale-overlays` routes. | Exercise translations routes and public publish behavior through Roma/public URLs. |
| `scripts/verify/prd100-static-public-guard.mjs` | Guards against obsolete storage route strings. | Verify generated public artifacts do not perform runtime composition or private/control fetches. |
| `scripts/verify/prd99-storage-guard.mjs` | Bans old storage roots by string. | Verify active product paths use account-scoped ownership and reject private UUID account folders. |

## Occurrence Inventory - Public Artifact Boundary

Public visitor output can still be static files. The error is letting authoring, translation, catalog, and publish APIs speak those filenames or treat them as source state.

| Occurrence | Current problem | Required boundary |
| --- | --- | --- |
| `index.html`, `styles.css`, `script.js` | Treated in some tests/docs as source or availability truth. | Generated public artifacts only. Publish availability is product state/serve behavior, not file presence as model. |
| Versioned generated files such as `styles.vN.css`, `script.vN.js`, `{locale}.html`, locale JS files | Exact filenames are asserted as product contract. | Cache-busting/compatibility details decided by public serving model, not Roma or translation logic. |
| `generation.embed.files` | Exposes generated file inventory through instance state. | Embed build status may expose readiness, not internal file list. |
| `index.html.off` | Unpublish represented as file rename/toggle. | Delete as product concept. Unpublish is product state/operation; file mechanics are implementation only if still needed. |
| `accounts/{accountPublicId}/instances/index.json` | Generated read model risks becoming Roma source truth. | Delete as product concept. Do not preserve it as a Roma-facing handoff. |

## Embed Materialization Owner

This PRD must name the owner of writing public visitor artifacts. Today Publish can fail because `index.html` is treated as readiness, while no service is clearly named as the owner that materializes it.

Recommended owner: Tokyo owns embed materialization end-to-end because Tokyo owns approved instance source, translation values, publish state, and public serving. Tokyo may delegate AI/content work to San Francisco, but public artifact readiness is still a Tokyo product operation.

Required operation shape:

```text
saveAccountInstance or completeLocaleTranslation accepts source changes.
Tokyo enqueues or runs materializeInstancePublicArtifacts.
materializeInstancePublicArtifacts reads approved instance config/content and translated locale values.
It writes public artifacts as generated output.
It reports build readiness through the named workflow primitive.
publishInstance checks that readiness, not index.html presence.
```

Alternative owner, if deliberately chosen: San Francisco may own materialization only through a product operation such as `materializeInstancePublicArtifacts`, with Tokyo remaining the authority for source, translations, publish state, and final public artifact write. San Francisco must not write R2 files that Tokyo later guesses about by filename.

Leaving this owner implied is a blocker.

## Runtime And Service Dependencies

- Roma depends on Tokyo private service bindings for instance operations and must keep browser authz on same-origin Roma routes.
- Tokyo-worker depends on account authorization, R2/KV/D1 bindings as currently deployed, and any queue/workflow primitive selected for artifact readiness.
- San Francisco depends on its existing model providers and queue consumer, but must receive/emit product translation work rather than storage overlay work.
- Cloudflare Queue bindings such as `RENDER_SNAPSHOT_QUEUE` must be renamed/re-scoped or deleted if they no longer represent current product artifact work.
- Public serving depends on generated visitor artifacts, cache purge behavior, and publish availability checks. It must not require authoring source reads per visitor request.
- Account index JSON dependencies must be deleted from product paths. A future private read model would require a separate explicit approval, writer, rebuild rule, and failure behavior.
- Existing health/verify scripts must run through Roma account routes and public URLs, not Tokyo storage routes.

## Slow Path Inventory - Instance, Translation, Publish

The following flows must be redesigned as direct product operations. The target is fewer storage/network hops and one clear owner per operation.

| Flow | Current read/write chain | Why it is slow | Target operation |
| --- | --- | --- | --- |
| Save instance | Read existing instance, write instance JSON, re-read instance to patch account `index.json`, read index, write index. | A save updates source plus a derived file cache through read-after-write. | `saveAccountInstance` writes approved source once and returns instance summary. Derived cache is updated from in-memory result or deleted. |
| List account instances | Roma reads `index.json`; repair path can rebuild by listing every instance document and reading each one. | Listing depends on generated read model and repair scans. | `listAccountInstances` is owned by Tokyo and sourced from the approved instance model. No Roma-facing index JSON handoff. |
| Generate translations | Roma reads instance, reads widget catalog, lists overlay inventory, reads overlay object per locale, then sends queue jobs. | Generate reconstructs translation delta from storage artifacts before queueing. | `generateTranslations(instanceId)` accepts user intent; Tokyo resolves field contract, field-level locale status, missing/changed fields, and queues work. |
| Translation review/list | Bob/Roma list overlay inventory, then read an overlay object by ID. Tokyo inventory lists files and validates latest complete overlay by re-reading source. | UI path pays R2 list + object reads + source reads to answer "which locales exist?" | `listTranslatedLocales(instanceId)` reads content field locale status, and `readTranslatedLocaleValues(instanceId, locale)` reads current translated field values directly from `instance.content.json`. |
| Manual translation edit | Roma reads saved instance only to discover widget type, then writes overlay object. | Edit uses source read as a workaround for overlay storage requirements. | `writeTranslatedLocaleValues(instanceId, locale, values)` validates and writes in Tokyo using approved instance content. |
| San Francisco translation write | SF calls Tokyo overlay write; Tokyo reads saved instance, validates overlay against saved config, allocates version by listing overlay files, writes object, returns overlay ID. | One completed translation still triggers source read, list, validation, version-slot scan, and object write. | SF submits changed translated locale values; Tokyo merges them into current content-field locale values and returns no overlay ID in the product response. |
| Publish | Tokyo reads instance, checks `index.html`, may rename `index.html.off`, reads publish state, writes publish state, purges cache. | Publish state is split between file presence and instance field. | `publishInstance` checks product readiness, sets publish status in approved config/state, and public serving uses publish status plus generated artifacts. |
| Unpublish | Tokyo renames `index.html` to `index.html.off`, reads publish state, writes publish state, purges cache. | Unpublish is file surgery plus product state mutation. | `unpublishInstance` sets publish status; generated files may stay in place as unpublished artifacts. |
| Public serving | For non-index files, serving first reads `index.html` to prove availability, then reads requested asset. | Every support asset can pay an extra R2 read. | Serving checks publish/artifact availability once through publish state or artifact manifest; support assets are served directly. |
| Embed generation | SF reads instance, writes "building", reads widget files, lists overlay files per locale, reads overlay object, writes many files, re-reads each support file, writes `index.html`, writes "ready" with file list. | Build latency scales with locales + overlay files + generated file count. | Builder receives approved instance source and translation values, writes artifact set, and records build status without file-list verification choreography. |

## Performance Acceptance

- Save/open/list/publish/translation APIs are measured in product operations, not storage object counts.
- Save does not require Roma to call Tokyo again for catalog, overlay list, overlay reads, or translation queue payload assembly.
- `listTranslatedLocales` does not list overlay files or validate translations by re-reading saved instance for every locale.
- `readTranslatedLocaleValues` takes `instanceId + locale`, not `overlayId`, and performs one content-source read.
- `generateTranslations` does not make Roma assemble jobs from widget catalog artifacts plus overlay files.
- Translation completion cannot overwrite newer instance source for the fields in that job. Manual translated-locale edits are temporary overrides and may be overwritten by a later Generate completion for the same fields.
- `publishInstance` and `unpublishInstance` do not model state as `index.html` or `index.html.off`.
- Public serving does not use `index.html` existence as the only publish-state oracle for every support asset request.
- Embed generation does not re-read every support file immediately after a successful write unless a documented storage consistency risk requires it.

## Concrete Acceptance Criteria

These criteria are implementation-facing and must be checkable by code review, tests, or a verifier.

- Roma has no product-path call sites for `/__internal/renders/widgets/{instanceId}/saved.json`, `/save.json`, `/index.json`, `/catalog.json`, `/serve-state.json`, `/__internal/overlays/languages/list.json`, `/__internal/overlays/{overlayId}.json`, or `/__internal/overlays/languages/write.json`.
- Bob/Roma account routes and session commands no longer contain `locale-overlay` or `overlayId` in product-facing names or payloads.
- San Francisco no longer calls Tokyo overlay storage write routes for instance translation completion and no longer sends a full merged locale overlay. It sends changed translated values; Tokyo owns merge/write.
- Tokyo product operation responses do not include storage keys, overlay IDs, selected pointers, generated file inventories, or file lane names unless a later PRD explicitly approves one as product state.
- `generation.translations.status` and `generation.embed.status` are deleted from authoring source. Product status, if needed, comes from the async job/workflow system through a named operation.
- Publish and unpublish tests prove URL availability behavior without asserting `index.html.off` mechanics.
- Public serving tests prove unpublished support assets are unavailable without using `index.html` as the only availability oracle.
- Product smoke coverage creates/opens/saves/generates translations/publishes through Roma product routes and public URLs only.

## Current Execution Snapshot

The scoped 103_02.4a/4b/5 publish, artifact, and cleanup slices are green:

- Roma calls Tokyo product operations for publish/unpublish.
- Roma calls Tokyo product operations for duplicate/delete.
- Public serving checks `publishStatus` before serving canonical HTML or support assets.
- Unpublish changes publish state and does not rename `index.html` to `index.html.off`.
- Tokyo owns public artifact materialization.
- Publish materializes generated visitor files from approved instance source and translated locale values before setting `publishStatus: "published"`.
- San Francisco embed writer and widget generation job code are deleted; San Francisco remains the Instance Translation text-production delegate.
- Saved instance source no longer writes or normalizes generic `sourceVersion` or `generation.*` lanes.
- Old `renders/widgets/*.json` compatibility routes for instance source/list/create/save/duplicate/publish/unpublish/delete/serve-state are deleted from Tokyo-worker.
- The old render snapshot/mirror queue consumer and `RENDER_SNAPSHOT_QUEUE` binding/provisioning are deleted.
- The publish-language verifier proves `clk.live` base and translated output through Tokyo publish/materialization, not San Francisco artifact code or versioned support filenames.

Still pending after 103_02.5:

- final 103_00.4 reconciliation and broad architecture-doc rewrite/signoff;
- final cleanup of private overlay storage helpers/tests if Product decides physical overlay files should also disappear below translated-locale operations;
- final decision on whether physical `accounts/{accountPublicId}/instances/index.json` remains as private cache or is deleted entirely.

## Acceptance

- Final instance folder file list is documented.
- Current `instance.json` fields are mapped to split into config, split into content, move to job/workflow state, generated artifact, or delete.
- `instance.config.json` and `instance.content.json` shapes are approved.
- A decision exists for identity, display name, widget type/code, freshness/revision contract if explicitly needed, generation/workflow state, publish state, timestamps, and any current metadata.
- A separate decision exists for account `localePolicy` and account `selectedTargetLocales`; instance source is not their authority.
- Public generated files are classified as canonical generated artifact, compatibility artifact, cache-busting artifact, or delete.
- `accounts/{accountPublicId}/instances/index.json` is deleted as product model. Roma-facing instance list/create paths no longer depend on `index.json` as a product API.
- Any future account-instance read model requires a separate approval and remains private below `listAccountInstances`.
- Roma-facing overlay list/read/write paths no longer expose overlay object file names as the product API.
- Translation Generate ownership is assigned to Tokyo; Roma does not plan rich translation jobs from catalog and overlay artifacts.
- Translation Generate ownership/freshness is green in 103_02.3b: Roma forwards one intent, Tokyo assembles and queues work from `instance.content.json`, San Francisco completes through Tokyo, and stale source completion is ignored without a generic `sourceVersion`.
- Changed-field delta for already-translated locales is closed in 103_02.3c. Tokyo writes `instance.content.json` field status, Generate selects fields whose locale status is not `ok`, and completion writes only those changed fields back into current translated locale values. Per-locale status prevents one completed locale from clearing a changed field before every Generate target locale finishes.
- Public artifact materialization ownership is assigned. Publish readiness is checked through the named product/workflow state, not through `index.html` presence.
- Async status fields are removed from authoring source. Any product-visible async status comes from a named job/workflow operation with one owner.
- Stale translation queue completion cannot overwrite a newer save for the translated fields. Newer locale edits are temporary overrides and can be replaced by regeneration.
- Rename has an explicit identity/display transition or the relevant metadata is deleted/split by the final source model.
- Publish generated files are classified as generated public artifacts. Roma sees publish status and public URL behavior, not serve-state, generated file inventories, or artifact filenames.
- The slow path inventory above is resolved or explicitly assigned to a later non-PRD-103 performance PRD with owner and rationale.
- Starter instance creation/duplication is documented.
- No PRD 103 translation code resumes until this PRD is complete.
