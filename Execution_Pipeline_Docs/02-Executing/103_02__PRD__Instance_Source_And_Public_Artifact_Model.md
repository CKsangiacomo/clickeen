# PRD 103_02 - Instance Source And Public Artifact Model

Status: Draft / Pre-103 prerequisite
Owner: Product + Architecture
Date: 2026-05-19
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`

## Purpose

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
instance.config.json = non-content settings, structural values, style, behavior
instance.content.json = base user-visible content used for overlays/translations
```

Translation overlays apply to `instance.content.json`, not to mixed config.

Roma must read and command Tokyo through product operations, not through file-shaped route contracts.

The following current Roma-facing shapes are audit targets:

- `/__internal/renders/widgets/index.json`
- `/__internal/renders/widgets/catalog.json`
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
- Overlay objects are exact current value maps only. They do not store provenance, readiness, review state, source hash, generation ID, or manual override status.
- Manual translation edits overwrite overlay values temporarily. Regeneration may overwrite them.
- Generated public files are not source authority.
- Account read models are not source authority.
- Roma must not compute translation jobs from widget catalog artifacts plus overlay files. Roma's responsibility is to accept the user's Generate intent for an instance. The translation owner must load the saved instance content, editable-fields contract, existing translated values, policy/model profile, and delta rules.
- Roma must not expose overlay file/object identity as the UI contract. Bob/Roma should ask for translated locale inventory and translated locale values; Tokyo may store those as overlay files internally.
- Rename must not use the full saved-config/source write path if it only changes identity/display metadata.
- Publish artifacts are private generated output. Roma should receive publish/serve-state results, not reason about projections, live pointers, or generated file lanes.

## Starter Instance Decision

Widget software must not contain starter customer content.

Starter/default business copy belongs in normal account-owned starter instances under the Clickeen/admin account. Roma create-new-widget may duplicate a starter instance, but the widget software folder itself must not carry “Bed and Breakfast” or other customer-specific starter content as product source.

## Occurrence Inventory - Active Service Boundaries

| Occurrence | Severity | Current problem | Required product operation |
| --- | --- | --- | --- |
| `/__internal/renders/widgets/index.json` in Tokyo-worker and Roma direct client | P1 | Roma loads an account instance index by filename. | `listAccountInstances`; any index file is private Tokyo implementation. |
| `/__internal/renders/widgets/{instanceId}/saved.json` and `readSavedRenderConfig` | P1 | Saved source is exposed as a render/file object. | `openAccountInstance`; response shape must match the approved instance model. |
| `/__internal/renders/widgets/{instanceId}/save.json` and `writeSavedConfigToTokyo` | P1 | Save is named as writing saved render config. | `saveAccountInstance`; save writes approved config/content model only. |
| `SavedRenderPointer`, `SavedRenderDocument`, and `pointer` types | P1 | Pointer/render vocabulary implies a second product truth. | `AccountInstanceSummary` / `AccountInstanceDocument`; no product pointer concept unless explicitly approved. |
| `result.pointer.sourceVersion`, `saved.value.pointer`, and pointer-shaped HTTP payloads | P1 | Pointer vocabulary leaks through response bodies, not only internal types. | Response bodies should carry approved instance summary/current version fields directly. |
| `/__internal/overlays/languages/write.json` in Roma, Tokyo-worker, and San Francisco | P1 | Translation write is exposed as overlay JSON storage operation. | `writeInstanceLocaleTranslationValues` or equivalent translated-locale write command. |
| Roma/Bob host commands `list-locale-overlays`, `read-locale-overlay`, `write-locale-overlay` | P1 | UI/session command vocabulary is storage-overlay vocabulary. | `listPreviewLocales`, `readLocaleTranslation`, `saveLocaleTranslation`. |
| Roma route family `locale-overlays/list`, `locale-overlays/read`, `locale-overlays/write` | P1 | Account-facing route names expose overlay implementation. | Account instance translations API: list/read/write translated locale values. |
| `writeSelectedOverlayPointer`, `readSelectedOverlayPointer`, `deleteSelectedOverlayPointer` | P2 | Function names claim pointer persistence; current behavior infers latest complete overlay files. | `selectLatestCompleteLocaleTranslation` / `clearLocaleTranslation` only if selection is a real product behavior. |
| `InstanceGenerationLane`, `GenerationLaneName`, `lane`, `files`, `generation` surfaced after save | P2 | Build/file-lane state leaks into account save responses and is duplicated across Tokyo-worker and San Francisco. | Separate `translationJobStatus` and `embedBuildStatus`; keep generated file names private; deduplicate shared task types. |
| `/__internal/renders/widgets/serve-state.json`, `serveStates`, and `internal.render.serveState.body` | P2 | Serving mechanics hide the product question: is this instance published? | `publishStatus` / `publishStatuses`; route as `instances/publish-status` or equivalent product operation. |
| `TokyoMirrorJob`, `delete-instance-mirror`, `RENDER_SNAPSHOT_QUEUE` | P2 | Mirror/snapshot vocabulary suggests duplicate source truth. | `deleteAccountInstanceArtifacts` / `removeGeneratedServeFiles` if the queue only cleans public artifacts. |
| San Francisco routes/contracts `translate-saved-instance`, `translate_saved_instance`, `instance.translation.render_overlay` | P2 | Translation job names describe saved/overlay storage targets. | `translateAccountInstanceLocale` / `generateLocaleTranslationValues`. |
| `materializeConfigMedia`, `materializeImageFill`, `materializeVideoFill`, `materializeLogoAssetNode` in shared contracts/Bob | P3 | Materialize vocabulary leaks transformation/storage concept onto product preview. | `resolveAssetReferences`, `resolveImageReference`, `resolveVideoReference`, `resolveLogoReference`. |
| `materializeAccountAdditionalLocales` in Roma account locales | P3 | Database/materialized-view vocabulary for computing account locale set. | `resolveAdditionalAccountLocales` or `computeAccountLocaleSet`. |
| `AccountLocaleOverlayInventoryPayload`, `LocaleOverlayInventoryEntry`, `loadAccountInstanceLocaleOverlayInventory`, `listLocaleOverlayInventory`, `normalizeLocaleOverlayInventory` | P3 | Inventory vocabulary describes storage stock, not translations. | `InstanceTranslationList`, `InstanceTranslationSummary`, `loadInstanceTranslations`, `listInstanceTranslations`, `normalizeInstanceTranslationList`. |
| `ck-policy` text mentioning Tokyo-worker sync and SEO/GEO artifact sync | P3 | Policy metadata describes sync mechanics instead of policy enforcement. | Describe policy-controlled capabilities, limits, or embed build output. |

## Required HTTP Contract Replacement Map

This is the concrete route-level cleanup target. Old storage-shaped routes may temporarily coexist as shims during migration, but PRD 103 cannot complete while callers still use them as the named product boundary.

| Current storage route | Replacement product route |
| --- | --- |
| `POST /__internal/renders/widgets/create.json` | `POST /__internal/instances` |
| `POST /__internal/renders/widgets/serve-state.json` | `POST /__internal/instances/publish-status` or `GET /__internal/accounts/{accountId}/instances/publish-status` |
| `GET /__internal/renders/widgets/index.json` | `GET /__internal/accounts/{accountId}/instances` |
| `GET /__internal/renders/widgets/catalog.json` | `GET /__internal/widgets/catalog` |
| `POST /__internal/renders/widgets/index/rebuild.json` | `POST /__internal/accounts/{accountId}/instances/reindex` |
| `POST /__internal/overlays/languages/write.json` | `PUT /__internal/instances/{instanceId}/translations/{locale}` |
| `POST /__internal/overlays/languages/clear.json` | `DELETE /__internal/instances/{instanceId}/translations/{locale}` |
| `GET /__internal/overlays/languages/selected.json` | `GET /__internal/instances/{instanceId}/translations/selected` only if selected translation remains a product concept |
| `GET /__internal/overlays/languages/list.json` | `GET /__internal/instances/{instanceId}/translations` |

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
| `roma/lib/account-instance-translation-jobs.test.ts` | Imports widget manifest and mocks `/catalog.json`, `/overlays/languages/list.json`, `/overlays/{id}.json`. | Generate intent asks the translation owner to resolve widget contract, existing values, and missing/changed fields through service APIs. |
| `roma/lib/account-instance-locale-overlays.test.ts` | Mocks `saved.json` and `/overlays/languages/write.json`. | Manual locale write loads the saved account instance and submits a full locale value map through translated-locale write API. |
| `sanfrancisco/src/instance-translation-queue.test.ts` | Mocks `/overlays/languages/write.json`. | Queue handler emits one complete translated-locale write command with retained previous values plus changed translations. |
| `sanfrancisco/src/embed-file-writer.test.ts` | Asserts exact files: `index.html`, `styles.v1.css`, `script.v1.js`, `it.html`, `script.v1.it.js`, and `generation.embed.files`. | Successful build makes base and translated public experiences serveable and private authoring/control URLs absent. |
| `scripts/verify/prd103-publish-language-files.test.ts` | Seeds overlay object paths and fetches exact generated filenames. | Published base and translated locale URLs return localized FAQ behavior through the public serving boundary. |
| `tokyo-worker/src/routes/clk-live-routes.test.ts` | Makes `index.html` presence and support filenames the availability oracle. | Public route serves only when instance is publicly available; support assets remain private generated artifacts. |
| `tokyo-worker/src/domains/render/saved-config.test.ts` | Asserts `instance.json`, absence of old `config.json`/`publish.json`, and `index.html.off` mechanics. | Tokyo owns one approved authoring source, publish requires completed public build, unpublish makes public URL unavailable. |
| `tokyo-worker/src/domains/render/overlays.test.ts` | Asserts overlay folder/object placement and selected overlay projection shape. | Overlay writes preserve exact value maps; inventory exposes valid translated locales without leaking folder paths. |
| `bob/lib/embed-snippets.test.ts` | Asserts snippets use `/script.js`. | Snippets reference only the public instance URL contract and loadable script entry defined by serving contract. |
| `scripts/verify/prd100-static-public-guard.mjs` | Guards against obsolete storage route strings. | Verify generated public artifacts do not perform runtime composition or private/control fetches. |
| `scripts/verify/prd99-storage-guard.mjs` | Bans old storage roots by string. | Verify active product paths use account-scoped ownership and reject private UUID account folders. |

## Occurrence Inventory - Public Artifact Boundary

Public visitor output can still be static files. The error is letting authoring, translation, catalog, and publish APIs speak those filenames.

| Occurrence | Current problem | Required boundary |
| --- | --- | --- |
| `index.html`, `styles.css`, `script.js` | Treated in some tests/docs as source or availability truth. | Private generated artifacts behind public serve-state and public URL behavior. |
| Versioned generated files such as `styles.vN.css`, `script.vN.js`, `{locale}.html`, locale JS files | Exact filenames are asserted as product contract. | Cache-busting/compatibility details decided by public serving model, not Roma or translation logic. |
| `generation.embed.files` | Exposes generated file inventory through instance state. | Embed build status may expose readiness, not internal file list. |
| `index.html.off` | Unpublish represented as file rename/toggle. | Unpublish is product operation; storage mechanics private to Tokyo/public serving. |
| `accounts/{accountPublicId}/instances/index.json` | Generated read model risks becoming Roma source truth. | Private index behind `listAccountInstances`, with writer, rebuild rule, and failure behavior documented if kept. |

## Acceptance

- Final instance folder file list is documented.
- Current `instance.json` fields are mapped to keep, split into config, split into content, generated/read-model, or delete.
- `instance.config.json` and `instance.content.json` shapes are approved.
- A decision exists for identity, display name, widget type/code, base locale, target locales, source version, generation state, publish state, timestamps, and any current metadata.
- Public generated files are classified as canonical generated artifact, compatibility artifact, cache-busting artifact, or delete.
- `accounts/{accountPublicId}/instances/index.json` has a keep/delete decision with writer, reader, rebuild rule, and failure behavior.
- Roma-facing instance list/create paths no longer depend on `index.json` as a product API. If Tokyo keeps an index, it is private implementation behind `list account instances`.
- Roma-facing overlay list/read/write paths no longer expose overlay object file names as the product API.
- Translation Generate ownership is assigned to the correct service boundary; Roma does not plan rich translation jobs from catalog and overlay artifacts.
- Rename has an explicit identity/display transition or the relevant metadata is deleted/split by the final source model.
- Publish generated files are classified as private artifacts with a Roma-facing serve-state/result contract.
- Starter instance creation/duplication is documented.
- No PRD 103 translation code resumes until this PRD is complete.
