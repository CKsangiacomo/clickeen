# STATUS 103 - Deterministic Execution Ledger

Status: Blocked / Widget-instance source model gate
Date: 2026-05-18
Parent: `103__PRD__One_Save_Language_Overlay_Refactor.md`

## Product Truth

```text
One FAQ instance.
One save action.
Clickeen knows all editable text.
Clickeen derives translation text from the approved editable-fields contract and saved instance content.
Clickeen gives Copilot the whole widget package.
Clickeen translates missing/new/changed whole fields only when the user triggers Generate in the Translations panel.
Clickeen shows translations from Tokyo overlays.
Clickeen can generate translations on demand from the saved instance.
Clickeen publishes generated files.
```

Bob does not own translation status. Roma settings define expected target languages. Tokyo overlays define which translations are ready.

```text
X = Tokyo overlays found for enabled target locales
Y = enabled target locales from Roma settings
```

Bob may show `X of Y translations ready` while `X !== Y`. The preview dropdown contains only the base locale plus translated languages that have Tokyo overlays.

Save persists the base locale only. `Generate translations` is the translation trigger. Bob sends instance context only; the backend loads the saved instance and current language values from Tokyo.

## Source Model Gate

PRD 103 is blocked by the pre-103 architecture gate. Runtime translation work must not continue until the widget software source model and account instance storage model are simple, named, and documented.

Required pre-103 PRDs:

- `103_00__PRD__Pre_103_Architecture_Gate.md`
- `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
- `103_02__PRD__Instance_Source_And_Public_Artifact_Model.md`

The blocker is not whether translation can call an agent. The blocker is that the current product source model mixes widget software, starter content, account instance content, config, generated public bytes, generated read models, and translation contracts in ways that are no longer acceptable.

### Locked Product Decisions

- Widget software must not own account starter business copy.
- `tokyo/product/widgets/{widgetType}/content.json` is misnamed. It is the editable/translatable field contract and must become `editable-fields.json`.
- `agent.md` is not schema authority and is a kill candidate. If no real system consumes it as necessary guidance, it must be removed.
- `catalog.json` must either be a small useful file with proven consumers or be removed.
- `limits.json` is useful only as a widget path/operation/cap mapping to real `ck-policy` keys, such as `items.group.small.max`, `items.group.medium.max`, and `items.group.large.max`.
- `seo-geo.ts` must either be useful in the current static embed model with proven consumers or be removed.
- `tokyo/product/widgets/manifest.json` and `scripts/build-widget-catalog.mjs` are kill candidates. Their current consumers do not prove the architecture is valid; they prove only that the system started depending on a catchall generated artifact.
- Account instance values must split content from non-content config:
  - `instance.config.json` = non-content settings, structural values, style, behavior.
  - `instance.content.json` = base user-visible content used for overlays/translations.
- Translation overlays apply to `instance.content.json`, not to mixed config.
- Manual translation edits are temporary overlay value overwrites. No override status, review status, source hash, generation sidecar, or protection check is stored. Regeneration may overwrite the manual edit.
- Do not add `instance.meta.json` unless a real product/build/runtime path needs it. If metadata is not used, it is deleted instead of moved.
- Generated files and account read models must be documented as source, generated artifact, compatibility file, cache-busting file, or delete candidate before implementation resumes.

### Current Verified Build-Catalog Reality

`scripts/build-widget-catalog.mjs` is not unused, but it is currently too broad:

- Root `pnpm build` runs `pnpm build:widgets`.
- Root `pnpm typecheck` runs `pnpm build:widgets:check`.
- The script writes `tokyo/product/widgets/manifest.json`.
- `tokyo-worker/src/domains/widget-catalog.ts` imports that generated manifest.
- Tokyo-worker exposes manifest-derived entries through `GET /__internal/renders/widgets/catalog.json`.
- Roma calls that Tokyo-worker catalog route.
- The script also writes `tokyo-worker/src/generated/widget-seo-geo-registry.ts`; current repo search shows that generated registry is not consumed by runtime code.

Gate decision: remove the catchall manifest dependency. Each product path must read the smallest direct source it actually needs, or use a narrow purpose-specific generated file only when direct source consumption is impossible. Delete anything unconsumed. Do not preserve `build-widget-catalog.mjs` or `tokyo/product/widgets/manifest.json` just because build/typecheck currently call them.

### Bootstrap-Era Script Audit Gate

The source model gate also includes repo `.mjs` scripts. Several scripts were created when local Node scripts acted as the assembly line before the Cloudflare product/runtime model was settled. Existing package scripts or runtime consumers do not prove those scripts still belong.

Current inventory of root `scripts/**/*.mjs`:

| Class | Files | Gate |
| --- | --- | --- |
| Product materializers / deploy syncers | `scripts/build-widget-catalog.mjs`, `scripts/tokyo-r2-deploy-sync.mjs`, `scripts/tokyo-fonts-sync.mjs`, `scripts/prague-sync.mjs`, `scripts/prague-l10n/translate.mjs`, `scripts/prague-l10n/verify.mjs`, `scripts/prague-l10n/lib.mjs`, `scripts/i18n/build.mjs`, `scripts/i18n/extract-keys.mjs`, `scripts/i18n/validate.mjs`, `scripts/l10n/build.mjs`, `scripts/l10n/validate.mjs` | Highest risk. Prove current Cloudflare-era writer/reader/rebuild/delete semantics or delete/cloudify. These must not be hidden product authorities. |
| Cloudflare build helpers | `scripts/build-bob-cf.mjs`, `scripts/build-roma-cf.mjs`, `scripts/infra/ensure-queues.mjs` | Keep only if Cloudflare Pages/Workers deploy still requires them and the build/deploy contract is documented. Otherwise replace with direct Cloudflare-native config/commands. |
| Verification guards | `scripts/verify/primitive-drift.mjs`, `scripts/verify/prd99-storage-guard.mjs`, `scripts/verify/prd100-static-public-guard.mjs`, `scripts/verify/prd85a-learning-contract.mjs`, `scripts/health/product-path-smoke.mjs` | Keep only as non-mutating guards. They must not generate product source or repair product state. |
| Local development only | `scripts/dev/generate-berlin-keys.mjs`, `scripts/dev/local-root-env.mjs`, `scripts/dev/local-supabase.mjs` | Keep only if clearly marked local-only and absent from product build/deploy/runtime paths. |
| Content validation | `scripts/prague-blocks/validate.mjs` | Keep only if Prague JSON remains repo-authored source and validation is documented as a guard, not product materialization. |

Framework config `.mjs` files such as `next.config.mjs`, `eslint.config.mjs`, and `astro.config.mjs` are not part of this bootstrap-script deletion pass unless they generate or sync product truth.

Gate decision: no PRD 103 implementation resumes until product materializer/sync scripts are classified as keep, cloudify, dev-only, repair-only, or delete. If a script exists only because local bootstrap once needed an assembly step, it is a delete candidate.

## Audit Sources

- Local repo audit after the `content.json` pivot.
- Subagent documentation audit: PRD intent preserved, with outdated 103A wording corrected.
- Subagent code/source audit: removed legacy translation field names and per-field Copilot allowlists; Bob review UI and Tokyo-worker overlay tests were restarted in execution.
- Subagent verification audit: lower-level proofs exist, product E2E remains unproven.

## Execution Status

| Slice | Status | Evidence | Product Result |
| --- | --- | --- | --- |
| 103_00 - Pre-103 Architecture Gate | Draft / Blocks all PRD 103 work | `103_00__PRD__...` | Names the architecture gate that must close before 103A-103Z resumes. |
| 103_01 - Widget Source And Bootstrap Script Audit | Draft / Pre-103 prerequisite | `103_01__PRD__...` | Must classify widget-folder files and bootstrap-era `.mjs` materializers/syncers. |
| 103_02 - Instance Source And Public Artifact Model | Draft / Pre-103 prerequisite | `103_02__PRD__...` | Must classify account instance source files, generated public artifacts, overlays, and read models. |
| 103Z - Verification Protocol | Draft / Gate only | `103Z__PRD__...` | Gate protocol exists; no implementation slice. |
| 103A - Teardown Map And Agent Boundary | Complete / Green after wording correction | `103A__EXEC__...` | Product boundary named: translate saved instance. Outdated Copilot wording corrected to whole widget package. |
| 103B - Instance Translation Agent Contract | Complete / Boundary green | `103B__EXEC__...`, San Francisco tests | Saved-instance translation route exists and rejects loose old text-value requests. The trigger is now panel-owned Generate, not Save. |
| 103C.0 - Widget Source Split And Content JSON | Complete / Test floor green | `tokyo/product/widgets/faq/content.json`, `spec.json`, `manifest.json`, `ck-contracts` tests, `tokyo-worker` tests, `build:widgets:check` | FAQ translation source moved to authored `content.json`; FAQ `spec.json` no longer owns translated fields; generated catalog exposes `content` and derived `overlays`; Tokyo overlay fixtures now use the catalog-derived contract. Full widget source split is not complete because editor/defaults/normalization still live in `spec.json`, but this restart slice is green. |
| 103C.1 - FAQ Gold Standard Contract | Complete / Product path green | `103C1__PRD__...`, `103C1__EXEC__...`, content tests, 103I.2 Copilot package proof, 103F override proof | FAQ translation authority exists. Bob review, Tokyo-worker overlay tests, Copilot package view, manual overlay edit, and publish proof are green. |
| 103C - Agent Source Projections | Superseded / Closed by 103I.2 | `103C__EXEC__...`, `103I__PRD__...`, San Francisco Copilot payload test | Translation uses content projection in lower-level paths. Copilot now receives widget package context rather than only compiled editor controls. |
| 103D.0 - FAQ Identity/Diff/Merge Contract | Complete / Product proof green | `faq-language-values` tests, Bob review tests, publish verifier | Stable identity, changed-field selection, complete current language merge, fail-closed missing translations, Bob review, manual overlay edits, and publish use of edited values are proven. |
| 103D - Changed Field Translation | Reopened / Delta authority blocked | `roma/lib/account-instance-translation-jobs.ts`, `roma/lib/account-instance-translation-jobs.test.ts`, `sanfrancisco/src/instance-translation-queue.ts`, `sanfrancisco/src/instance-translation-queue.test.ts` | Save no longer enqueues translation. Panel Generate can queue missing-locale work, but changed-field delta after an existing overlay needs a PRD-approved authority. |
| 103E - Bob Translation Panel Review | Reopened / Panel-owned generation cutover in progress | `TranslationsPanel.tsx`, `TranslationsPanel.test.tsx`, Bob tests/typecheck | Production `TranslationsPanel` renders `content.json`-based current language values and owns the Generate trigger. Needs product re-smoke after Save no longer enqueues. |
| 103V - Single-Language Vertical Slice | Reopened / Needs reproof after panel-owned Generate cutover | `pnpm verify:prd103-faq-vertical`, Bob tests, Roma tests, Tokyo-worker tests, San Francisco tests | Previous proof covered save follow-up. New proof must cover Save base only -> Generate -> one changed field -> Bob review. |
| 103G - Save/Publish Generated Language Files | Complete / Publish language files proof green | `pnpm verify:prd103-publish-language-files`, San Francisco tests, Tokyo-worker tests | Saved FAQ instance plus current language overlay generates base and translated browser files; clk.live serves both statically. |
| 103H - Shared Agent Model Profiles | Complete / Shared policy proof green | `ck-policy` tests, San Francisco tests | Free and Tier 3 resolve different model profiles for both Instance Translation and Copilot through the shared matrix/catalog path. Copilot model picker policy is covered. Translation audit emits account subject, agent ID, policy profile, policy version, provider, model, token usage, and result status. |
| 103I - San Francisco Agent Runtime Cleanup | Complete / Copilot package context green | `103I__PRD__...`, San Francisco tests/typecheck, Bob typecheck, Roma typecheck | Old text-value route removed. Active account-widget translation code is named around Instance Translation, saved text graph, and current language values. Bob now sends Copilot `widgetPackage`; Roma forwards it; San Francisco includes content, spec, markup, styles, and client behavior context in the Copilot prompt. No new runtime framework added. |
| 103F - Translation Override UX | Complete / Manual overlay edit green | `103F__PRD__...`, Bob tests/typecheck, Roma tests/typecheck, Tokyo-worker tests/typecheck, publish verifier | Bob edits current-language values for an existing translated overlay, Roma writes the full overlay values object through Tokyo's existing language overlay primitive, and publish consumes the edited overlay value. Old base-text hash / review-state contract shape removed. |

## Current Authorities

- FAQ translation authority: blocked pending `content.json` -> `editable-fields.json` rename and instance content/config split.
- FAQ translation field parser and overlay derivation: `packages/ck-contracts/src/overlay-primitives.ts`.
- FAQ identity/diff/merge authority: `packages/ck-contracts/src/faq-language-values.ts`.
- Widget catalog composition: `scripts/build-widget-catalog.mjs` generates `tokyo/product/widgets/manifest.json`.
- Current-language storage primitive: Tokyo overlay object `{ v: 1, values }` under the owning instance.
- Delta source for Generate: blocked until PRD 103 names the owned-system authority for comparing current saved FAQ text with the language values already stored in Tokyo.
- Translation job acceptance implementation: `roma/lib/account-instance-translation-jobs.ts`.
- Translation job execution implementation: `sanfrancisco/src/instance-translation-queue.ts`.
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
- `pnpm build:widgets:check`
- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/ck-policy test`
- `pnpm --filter @clickeen/ck-policy typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm verify:prd103-publish-language-files`
- Repo search for removed legacy translation field names and per-field Copilot allowlists is clean outside this status note.

## Red Checks

- Human product re-smoke is not green after the panel-owned Generate cutover.

## Hard Blockers

- Widget/instance source model gate is unresolved. Do not continue PRD 103 runtime implementation until it is resolved.
- 103V and 103G cannot be called complete again until the real Bob/Roma panel-owned Generate path is re-proven.

## Human Smoke Regression Reopened

- Human/product decision: Save must not own translation generation. The Translations panel owns the only user-facing Generate trigger.
- Fix: Roma save now returns after Tokyo saves the base instance and does not enqueue translation.
- Generate loads the current saved instance and current Tokyo language values.
- Removed invented sidecars. Tokyo language overlays remain exact current value objects only.
- Changed-field Generate after an existing overlay remains blocked until the PRD names the real delta authority.
- Manual translation edits are temporary overlay value overwrites. The system does not remember override status; a later regeneration may overwrite the manual edit.

## Next Execution Order

1. Execute 103_00.
2. Execute 103_01.
3. Execute 103_02.
4. Only then resume PRD 103 Generate/delta implementation against the approved source model.
5. Re-smoke Bob/Roma: edit FAQ, Save, confirm no translation starts until Generate.
6. Decide the real delta authority for changed-field Generate without overlay provenance or sidecar generation state.
7. Re-run 103V product proof for the real Bob/Roma path.
8. Re-run 103G publish proof after 103V is green.
9. Do not continue broad San Francisco runtime reshaping.

## Do Not Proceed Gates

- Do not add `instance.meta.json` or any replacement sidecar unless a real product/build/runtime consumer is named first.
- Do not keep generated manifests, indexes, SEO registries, or public artifacts without a named writer, reader, rebuild rule, and deletion/rebuild rule.
- Do not keep bootstrap-era `.mjs` materializers/syncers in product build/runtime paths without a current Cloudflare-era contract.
- Do not add a San Francisco runtime framework without an explicit new slice.
- Do not introduce Bob-owned translation state names. Only `X of Y translations ready` is allowed.
- Do not add a readiness subsystem for publish or translation.
- Do not restore removed legacy translation field names, per-field Copilot allowlists, or `spec.json.overlays.text[]` as authored FAQ translation authority.
