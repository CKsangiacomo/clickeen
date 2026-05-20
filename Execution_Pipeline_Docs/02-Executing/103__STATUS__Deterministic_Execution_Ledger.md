# STATUS 103 - Deterministic Execution Ledger

Status: Automated runtime proofs green; human Bob/Roma/public smoke is the next PRD 103 gate
Date: 2026-05-20
Parent: `103__PRD__One_Save_Language_Overlay_Refactor.md`

## Product Truth

```text
One FAQ instance.
One save action.
Clickeen knows all editable text.
Clickeen derives translation text from the approved editable-fields contract and saved instance content.
Clickeen gives Copilot the whole widget package.
Clickeen translates missing/new/changed whole fields only when the user triggers Generate in the Translations panel.
Clickeen shows translated locale values stored by Tokyo.
Clickeen can generate translations on demand from the saved instance.
Clickeen publishes generated files.
```

Bob does not own translation status. Roma settings define expected target languages. Tokyo translated locale values define which translations are ready. Internal storage may still use overlay objects, but product payloads speak locale/value-map operations.

```text
X = translated locale values found for enabled target locales
Y = enabled target locales from Roma settings
```

Bob may show `X of Y translations ready` while `X !== Y`. The preview dropdown contains only the base locale plus translated languages that have Tokyo translated locale values.

Save persists the base locale only. `Generate translations` is the translation trigger. Bob sends instance context only; the backend loads the saved instance and current language values from Tokyo.

## Source Model Gate

PRD 103 is no longer blocked by the pre-103 architecture gate. Runtime translation work resumed one slice at a time. The reopened 103V proof path is green, 103G publish proof is green, and 103F translated-locale override reproof is green.

Required pre-103 PRDs:

- `103_00__PRD__Pre_103_Architecture_Gate.md`
- `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
- `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`

The blocker is not whether translation can call an agent. The blocker is that the current product source model mixes widget software, starter content, account instance content, config, generated public bytes, generated read models, and translation contracts in ways that are no longer acceptable.

### Locked Product Decisions

- Widget software must not own account starter business copy.
- `tokyo/product/widgets/{widgetType}/editable-fields.json` is now the editable/translatable field contract for all current widgets. FAQ moved from `content.json` in 103_01.3a; Countdown and Logo Showcase moved from `spec.overlays.text` in 103_01.3c.3. No widget software file named `content.json` and no `spec.overlays.text` array is product authority.
- `agent.md` is deleted as widget source in 103_01.3c.1. San Francisco no longer checks for it, fixtures no longer seed it, and widget source validation fails if it returns.
- `catalog.json` must either be a small useful file with proven consumers or be removed.
- `limits.json` is useful only as a widget path/operation/cap mapping to real `ck-policy` keys, such as `items.group.small.max`, `items.group.medium.max`, and `items.group.large.max`.
- Widget `seo-geo.ts` source and catalog SEO/GEO capability flags are deleted in 103_01.3c.2. SEO/GEO can return only through a later named static publish/SEO operation.
- `tokyo/product/widgets/manifest.json` and `scripts/build-widget-catalog.mjs` were deleted in 103_01.3b. Their previous consumers were moved to direct widget source and widget-definition operations.
- Account instance values must split content from non-content config:
  - `instance.config.json` = all non-text instance state plus identity, display, widget type/code, locale setup, structure, style, behavior, publish state, and timestamps.
  - `instance.content.json` = every user-editable customer-visible string in the widget, in the same semantic paths/shape the editor exposes for text editing.
- Translated locale values apply to `instance.content.json`, not to mixed config.
- Translated locale values are modeled as `locale -> translated content values`; Bob/Roma product payloads must not expose overlay IDs, selected pointers, version slots, raw storage keys, provenance, review state, source hashes, generation IDs, or manual override status.
- Manual translation edits are temporary overlay value overwrites. No override status, review status, source hash, generation sidecar, or protection check is stored. Regeneration may overwrite the manual edit.
- Do not add `instance.meta.json` unless a real product/build/runtime path needs it. If metadata is not used, it is deleted instead of moved.
- `instance.json` and `accounts/{accountPublicId}/instances/index.json` are killed as product models.
- Async job state belongs to queue/job/workflow infrastructure, not instance content/config. No generic `sourceVersion` is approved as product model; any freshness/revision rule must be named by the owning operation before coding.
- Generated files are generated artifacts, not source truth or publish state. Roma sees publish status and public URL behavior, not serve-state, generated file inventories, artifact filenames, or file presence.

### Current Verified Widget Definition Reality

103_01.3b removed the catchall generated widget manifest dependency:

- Root `pnpm build` and `pnpm typecheck` run `pnpm validate:widgets`.
- `scripts/validate-widget-source.mjs` validates widget source and writes nothing.
- Tokyo-worker resolves widget definitions through `listWidgetDefinitions` and `getWidgetDefinition`.
- Roma calls `GET /__internal/widgets/definitions`.
- Prague reads widget source metadata directly.
- `tokyo/product/widgets/manifest.json` is deleted.
- `tokyo-worker/src/generated/widget-seo-geo-registry.ts` is deleted.

Current widgets now all use `editable-fields.json` for editable/translatable field contracts. Tokyo-worker derives any overlay validation primitives internally from that contract; Roma receives editable fields, not generated overlay-shaped widget field contracts. Widget `limits.json` files are validated as mappings to real `ck-policy` keys/kinds, and the stale Prague l10n sync path is deleted from scripts/workflows.

### Bootstrap-Era Script Audit Gate

The source model gate also includes repo `.mjs` scripts. Several scripts were created when local Node scripts acted as the assembly line before the Cloudflare product/runtime model was settled. Existing package scripts or runtime consumers do not prove those scripts still belong.

Current inventory of root `scripts/**/*.mjs`:

| Class | Files | Gate |
| --- | --- | --- |
| Product materializers / deploy syncers | `scripts/tokyo-r2-deploy-sync.mjs`, `scripts/tokyo-fonts-sync.mjs`, `scripts/prague-l10n/translate.mjs`, `scripts/prague-l10n/verify.mjs`, `scripts/prague-l10n/lib.mjs`, `scripts/i18n/build.mjs`, `scripts/i18n/extract-keys.mjs`, `scripts/i18n/validate.mjs`, `scripts/l10n/build.mjs`, `scripts/l10n/validate.mjs` | Highest risk. Prove current Cloudflare-era writer/reader/rebuild/delete semantics or delete/cloudify. These must not be hidden product authorities. `scripts/build-widget-catalog.mjs` was deleted in 103_01.3b; `scripts/prague-sync.mjs` was deleted in 103_01.3c.4. |
| Cloudflare build helpers | `scripts/build-bob-cf.mjs`, `scripts/build-roma-cf.mjs`, `scripts/infra/ensure-queues.mjs` | Keep only if Cloudflare Pages/Workers deploy still requires them and the build/deploy contract is documented. Otherwise replace with direct Cloudflare-native config/commands. |
| Verification guards | `scripts/verify/primitive-drift.mjs`, `scripts/verify/prd99-storage-guard.mjs`, `scripts/verify/prd100-static-public-guard.mjs`, `scripts/verify/prd85a-learning-contract.mjs`, `scripts/health/product-path-smoke.mjs` | Keep only as non-mutating guards. They must not generate product source or repair product state. |
| Local development only | `scripts/dev/generate-berlin-keys.mjs`, `scripts/dev/local-root-env.mjs`, `scripts/dev/local-supabase.mjs` | Keep only if clearly marked local-only and absent from product build/deploy/runtime paths. |
| Content validation | `scripts/prague-blocks/validate.mjs` | Keep only if Prague JSON remains repo-authored source and validation is documented as a guard, not product materialization. |

Framework config `.mjs` files such as `next.config.mjs`, `eslint.config.mjs`, and `astro.config.mjs` are not part of this bootstrap-script deletion pass unless they generate or sync product truth.

Gate decision: product materializer/sync scripts must be classified as keep, cloudify, dev-only, repair-only, or delete before any slice depends on them. If a script exists only because local bootstrap once needed an assembly step, it is a delete candidate.

## Audit Sources

- Local repo audit after the `content.json` pivot.
- Subagent documentation audit: PRD intent preserved, with outdated 103A wording corrected.
- Subagent code/source audit: removed legacy translation field names and per-field Copilot allowlists; Bob review UI and Tokyo-worker overlay tests were restarted in execution.
- Subagent verification audit: lower-level proofs exist, product E2E remains unproven.

## Active Pre-103 Execution Ledger

PRD 103_00 now executes through:

- `103_00__EXEC__Pre_103_Architecture_Gate.md`

Current rule: execute one slice at a time. Pre-103 slices are complete; runtime PRD 103 continues from the next named slice only.

Important: historical green for `103_00.1` meant only blocker/status wiring. PRD 103 became resumable only after `103_00`, `103_01`, and `103_02` closed green.

## Execution Status

| Slice | Status | Evidence | Product Result |
| --- | --- | --- | --- |
| 103_00 - Pre-103 Architecture Gate | Complete / Green | `103_00__PRD__...`, `103_00__EXEC__...` | Widget-source, instance-source, product-operation vocabulary, docs, guards, and architecture resume signoff are green. PRD 103 runtime resumed at 103V. |
| 103_00.1 - Execution ledger and blocker wiring | Green / Docs only | `103_00__EXEC__...` | Does not change runtime behavior. Green means only that the pre-103 ledger, blockers, and doc status banners exist. |
| 103_01 - Widget Source And Bootstrap Script Audit | Complete / Green | `103_01__PRD__...`, `103_01__EXEC__...` | Consumer inventory, file-role decisions, FAQ editable-fields migration, widget-definition operation migration, `agent.md` deletion, SEO/GEO source deletion, non-FAQ editable-fields migration, limits mapping, stale Prague sync deletion, and closure/handoff are green. |
| 103_01.1 - Widget source consumer inventory | Green / Docs only | `103_01__EXEC__...`, code/docs subagent scans, local repo search | Records all active consumers of widget source files, generated manifest/catalog output, and bootstrap scripts. Does not change runtime behavior. |
| 103_01.2 - Widget source file-role decisions | Green / Docs only | `103_01__EXEC__...`, architecture/docs verification subagents | Locks target roles for spec, editable fields, runtime assets, shared assets, media, limits, catalog metadata, agent.md, SEO/GEO, generated manifest, catalog route, and bootstrap scripts. Does not change runtime behavior. |
| 103_01.3a - FAQ editable-fields migration | Green / Code and docs | `tokyo/product/widgets/faq/editable-fields.json`, Bob/Roma/San Francisco/Tokyo-worker/ck-contracts tests, `validate:widgets`, `verify:prd103-faq-vertical`, typechecks/lints | FAQ field contract is no longer named `content.json`. Current product/test/verifier callers use editable-fields vocabulary. Later 103_01 slices closed the remaining widget-source cleanup. |
| 103_01.3b - Widget catalog operation migration | Green / Code and docs | `listWidgetDefinitions`, `getWidgetDefinition`, `GET /__internal/widgets/definitions`, `scripts/validate-widget-source.mjs`, targeted tests/typechecks/verifiers | Generated widget manifest, generated SEO/GEO registry, broad build-widget catalog script, and storage-shaped widget catalog route are deleted from product paths. Later 103_01 slices deleted `agent.md`, widget `seo-geo.ts`, `spec.overlays.text`, catalog capabilities, and detached limits/bootstrap drift. |
| 103_01.3c.1 - Widget `agent.md` deletion | Green / Code and docs | San Francisco embed writer, publish verifier, widget source validation, active docs | Widget `agent.md` files are deleted. Runtime no longer checks them, fixtures no longer seed them, and validation fails if they return. |
| 103_01.3c.2 - Widget SEO/GEO source deletion | Green / Code and docs | Widget catalog files, Tokyo-worker/Roma/Prague catalog types, widget source validation, active docs | Widget `seo-geo.ts` files and catalog SEO/GEO capability flags are deleted. Instance `seoGeo.*` config is not product source generator authority. |
| 103_01.3c.3 - Non-FAQ editable-fields migration | Green / Code and docs | Countdown/Logo Showcase `editable-fields.json`, `spec.json` cleanup, Tokyo-worker widget definitions, ck-contracts primitive extraction, widget source validation, active docs | All current widgets declare editable/translatable fields through `editable-fields.json`; `spec.overlays.text` and generated overlay-shaped widget field contracts are deleted translation field authority. |
| 103_01.3c.4 - Limits and bootstrap-script closure | Green / Code and docs | Widget source validator, ck-policy tests, root/package workflows, primitive drift guard, active docs | Widget `limits.json` cannot become detached policy truth, and the old Prague l10n sync/publish flow is deleted from scripts and GitHub Actions. |
| 103_01.4 - Closure and 103_02 handoff | Green / Docs and verification | `103_01__EXEC__...`, `103_00__EXEC__...`, `103__STATUS__...`, active drift checks | All 103_01-owned blast-radius rows are GREEN. 103_00.2 went green and handed off to 103_02. |
| 103_02 - Instance Source And Public Artifact Model | Complete / Green | `103_02__PRD__...`, `103_02__EXEC__...` | Inventory, immediate doc supersession notes, final field/state decisions, translated-locale read/write, Generate/complete ownership/freshness, changed-field delta from `instance.content.json`, product open/save/list/create/rename/duplicate/delete, publish-state serving, Tokyo-owned artifact materialization, old route cleanup, and mirror/snapshot queue deletion are green. |
| 103Z - Verification Protocol | Draft / Gate only | `103Z__PRD__...` | Gate protocol exists; no implementation slice. |
| 103A - Teardown Map And Agent Boundary | Complete / Green after wording correction | `103A__EXEC__...` | Product boundary named: translate saved instance. Outdated Copilot wording corrected to whole widget package. |
| 103B - Instance Translation Agent Contract | Complete / Boundary green | `103B__EXEC__...`, San Francisco tests | Saved-instance translation route exists and rejects loose old text-value requests. The trigger is now panel-owned Generate, not Save. |
| 103C.0 - Widget Source Split And Content JSON | Historical proof only / Superseded by 103_01.3a, 103_01.3b, and 103_01.4 | Historical `tokyo/product/widgets/faq/content.json`, `spec.json`, `manifest.json`, `ck-contracts` tests, `tokyo-worker` tests, historical `build:widgets:check` | The `content.json` name is superseded by `editable-fields.json`; generated manifest/catalog authority is deleted. Current widget-source authority is 103_01, not 103C.0. |
| 103C.1 - FAQ Gold Standard Contract | Complete / Product path green | `103C1__PRD__...`, `103C1__EXEC__...`, content tests, 103I.2 Copilot package proof, 103F override proof | FAQ translation authority exists. Bob review, Tokyo-worker translated-locale tests, Copilot package view, manual translated-locale edit, and publish proof are green. |
| 103C - Agent Source Projections | Superseded / Closed by 103I.2 | `103C__EXEC__...`, `103I__PRD__...`, San Francisco Copilot payload test | Translation uses content projection in lower-level paths. Copilot now receives widget package context rather than only compiled editor controls. |
| 103D.0 - FAQ Identity/Diff/Merge Contract | Complete / Product proof green | `faq-language-values` tests, Bob review tests, publish verifier | Stable identity, changed-field selection, complete current language merge, fail-closed missing translations, Bob review, manual translated-locale edits, and publish use of edited values are proven. |
| 103D - Changed Field Translation | Reopened / Delta authority green below 103_02 gate | Tokyo `generateTranslations`, San Francisco `instance-translation-queue`, `faq-language-values`, `instance.content.json` status | Save no longer enqueues translation. Panel Generate is Tokyo-owned and queues missing fields plus fields marked `changed` in `instance.content.json`. Completion writes only changed fields, preserves unrelated current values, and clears field status only after all Generate target locales complete. |
| 103E - Bob Translation Panel Review | Product path green inside 103V / human smoke deferred | `TranslationsPanel.tsx`, `TranslationsPanel.test.tsx`, Bob tests/typecheck, Roma Generate route, Tokyo Generate operation, 103V proof | Production `TranslationsPanel` renders editable-fields-based current language values and owns the Generate trigger. Human smoke remains a completion/release gate after 103G. |
| 103V - Single-Language Vertical Slice | Complete / Green after panel-owned Generate reproof | `pnpm verify:prd103-faq-vertical`, Bob tests/typecheck, Roma tests/typecheck, Tokyo-worker tests/typecheck, San Francisco tests/typecheck, ck-contracts tests/typecheck, `validate:widgets`, primitive drift guard | Save persists base content only. Panel Generate queues the edited FAQ answer from `instance.content.json`, San Francisco executes the Instance Translation Agent job, Tokyo writes current translated locale values, and Bob review renders the translated FAQ answer. |
| 103G - Save/Publish Generated Language Files | Complete / Green after 103V reproof | `103G__PRD__...`, `103G__EXEC__...`, `pnpm verify:prd103-publish-language-files`, Tokyo-worker tests, Roma tests | Publish verifier proves Tokyo-owned materialization and public base/translated output through `clk.live`, without San Francisco artifact writer, sourceVersion, generation lanes, overlay path setup, runtime assembly, or versioned support filename assertions. |
| 103H - Shared Agent Model Profiles | Complete / Shared policy proof green | `ck-policy` tests, San Francisco tests | Free and Tier 3 resolve different model profiles for both Instance Translation and Copilot through the shared matrix/catalog path. Copilot model picker policy is covered. Translation audit emits account subject, agent ID, policy profile, policy version, provider, model, token usage, and result status. |
| 103I - San Francisco Agent Runtime Cleanup | Complete / Copilot package context green | `103I__PRD__...`, San Francisco tests/typecheck, Bob typecheck, Roma typecheck | Old text-value route removed. Active account-widget translation code is named around Instance Translation, saved text graph, and current language values. Bob now sends Copilot `widgetPackage`; Roma forwards it; San Francisco includes content, spec, markup, styles, and client behavior context in the Copilot prompt. No new runtime framework added. |
| 103F - Translation Override UX | Complete / Green after translated-locale reproof | `103F__PRD__...`, `103F__EXEC__...`, Bob tests/typecheck, Roma tests/typecheck, Tokyo-worker tests/typecheck, publish verifier | Manual edit behavior is proven as a temporary full translated-locale value-map overwrite. Product payloads expose locale/value-map operations; partial maps are rejected; later regeneration may overwrite the manual edit. |

## Current Authorities

- Widget translation authority: current widget field contracts are `tokyo/product/widgets/{widgetType}/editable-fields.json`; PRD 103 automated runtime proofs are green after 103V, 103G, and 103F.
- Instance source authority decision: `instance.content.json` is all editable customer-visible strings; `instance.config.json` is all non-text instance state plus identity/display/widget type/code/locale setup/publish state/timestamps.
- Translated locale value decision: `locale -> translated content values`; overlay IDs, selected pointers, version slots, provenance, source hashes, generation IDs, and manual override status are not product payloads.
- Current translated-locale product surface: Bob/Roma list/read/save translations by locale and value map only. Roma account `locale-overlays/*` routes are deleted.
- Async workflow decision: generation state is removed from authoring source; job status comes from queue/job/workflow operations when needed. Generic `sourceVersion` and generation lanes are no longer written by Tokyo saved instance source.
- Publish decision: publish state lives in approved config/state; public files are generated artifacts and not publish truth. Roma publish/unpublish now call Tokyo product operations; publish materializes artifacts in Tokyo before setting `published`; public serving checks `publishStatus` before generated artifacts.
- FAQ translation field parser and overlay derivation: `packages/ck-contracts/src/overlay-primitives.ts`.
- FAQ identity/diff/merge authority: `packages/ck-contracts/src/faq-language-values.ts`.
- Current widget definition composition: Tokyo-worker reads approved widget source through `listWidgetDefinitions` and `getWidgetDefinition`; no generated widget manifest remains.
- Final widget catalog decision from 103_01.2: replace generated manifest authority with `listWidgetDefinitions` and `getWidgetDefinition`; keep `catalog.json` only as small listing metadata; delete broad manifest/catalog product assembly.
- Current-language storage primitive: Tokyo overlay object `{ v: 1, values }` under the owning instance.
- Delta source for Generate: `instance.content.json` marks editable text fields `changed` or `ok`, with per-locale completion status; Tokyo Generate selects missing translated values plus fields marked `changed`.
- Account instance authoring operations: Roma calls Tokyo product operations for list/create/open/save/rename/duplicate/delete, not `index.json`, `saved.json`, `save.json`, or storage-shaped duplicate/delete routes.
- Account instance publish operations: Roma calls Tokyo product operations for publish/unpublish, not publish/unpublish storage file routes or `serve-state.json`.
- Translation job acceptance implementation: Tokyo `generateTranslations`; Roma is only the account/request boundary.
- Translation job execution implementation: San Francisco `instance-translation-queue.ts`, completing through Tokyo `completeLocaleTranslation`.
- Instance Translation Agent endpoint: `sanfrancisco/src/l10n-account-routes.ts` and `sanfrancisco/src/index.ts`.
- Bob expected/ready count source: Roma settings plus Tokyo overlay inventory.
- Copilot widget package source: Bob compiled widget payload `widgetPackage`, forwarded by Roma to San Francisco.
- Copilot prompt package context: `sanfrancisco/src/agents/csPromptPayload.ts`.

## Green Checks

- `pnpm --filter @clickeen/bob test`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/bob lint`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/roma lint`
- `pnpm validate:widgets`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/ck-policy test`
- `pnpm --filter @clickeen/ck-policy typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm verify:prd103-faq-vertical`
- `pnpm verify:prd103-publish-language-files`
- Repo search for removed legacy translation field names and per-field Copilot allowlists is clean outside this status note.

## Deferred Product Checks

- Human product re-smoke is not a pre-103 architecture gate. It remains a PRD 103 completion/release gate after runtime implementation and automated product proofs are complete.

## Hard Blockers

- Widget/instance source model gate is resolved. Continue PRD 103 runtime implementation only one slice at a time.
- 103V, 103G, and 103F are complete. Human Bob/Roma/public smoke is now the next PRD 103 gate.

## Human Smoke Regression Reopened

- Human/product decision: Save must not own translation generation. The Translations panel owns the only user-facing Generate trigger.
- Fix: Roma save now returns after Tokyo saves the base instance and does not enqueue translation.
- Generate loads the current saved instance and current Tokyo language values.
- Removed invented sidecars. Tokyo language overlays remain exact current value objects only.
- Changed-field Generate after an existing translated locale uses `instance.content.json` field status and has targeted Tokyo domain proof on `sections.0.faqs.0.answer`. Full product smoke is deferred until runtime implementation/proofs are complete.
- Manual translation edits are temporary overlay value overwrites. The system does not remember override status; a later regeneration may overwrite the manual edit.
- 2026-05-20 human smoke reopened a Tokyo completion race: parallel locale completions could overwrite `instance.content.json` because each completion performed whole-object writes. Tokyo now uses conditional R2 writes with retry for content updates and writes translated values plus completion status in one operation. Automated proof: `concurrent locale completions preserve every locale value on instance content`.

## Next Execution Order

1. Run human Bob/Roma/public smoke for the completed automated runtime path.
2. Do not continue broad San Francisco runtime reshaping outside a named follow-up.

## Do Not Proceed Gates

- Do not add `instance.meta.json` or any replacement sidecar unless a real product/build/runtime consumer is named first.
- Do not keep generated manifests, indexes, SEO registries, or public artifacts without a named writer, reader, rebuild rule, and deletion/rebuild rule.
- Do not keep bootstrap-era `.mjs` materializers/syncers in product build/runtime paths without a current Cloudflare-era contract.
- Do not add a San Francisco runtime framework without an explicit new slice.
- Do not introduce Bob-owned translation state names. Only `X of Y translations ready` is allowed.
- Do not add a readiness subsystem for publish or translation.
- Do not restore removed legacy translation field names, per-field Copilot allowlists, or `spec.json.overlays.text[]` as authored FAQ translation authority.
