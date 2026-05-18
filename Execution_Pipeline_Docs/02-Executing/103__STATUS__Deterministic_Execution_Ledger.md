# STATUS 103 - Deterministic Execution Ledger

Status: Runtime fix green pending human UX re-smoke
Date: 2026-05-18
Parent: `103__PRD__One_Save_Language_Overlay_Refactor.md`

## Product Truth

```text
One FAQ instance.
One save action.
Clickeen knows all editable text.
Clickeen derives translation text from authored content JSON.
Clickeen gives Copilot the whole widget package.
Clickeen translates changed whole fields.
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

`Generate translations` is a manual trigger for the same saved-instance translation agent path. Bob sends instance context only; Roma loads the saved instance from Tokyo.

## Audit Sources

- Local repo audit after the `content.json` pivot.
- Subagent documentation audit: PRD intent preserved, with outdated 103A wording corrected.
- Subagent code/source audit: removed legacy translation field names and per-field Copilot allowlists; Bob review UI and Tokyo-worker overlay tests were restarted in execution.
- Subagent verification audit: lower-level proofs exist, product E2E remains unproven.

## Execution Status

| Slice | Status | Evidence | Product Result |
| --- | --- | --- | --- |
| 103Z - Verification Protocol | Draft / Gate only | `103Z__PRD__...` | Gate protocol exists; no implementation slice. |
| 103A - Teardown Map And Agent Boundary | Complete / Green after wording correction | `103A__EXEC__...` | Product boundary named: translate saved instance. Outdated Copilot wording corrected to whole widget package. |
| 103B - Instance Translation Agent Contract | Complete / Boundary green | `103B__EXEC__...`, San Francisco tests | Saved-instance translation route exists and rejects loose old text-value requests. This does not prove production save follow-up. |
| 103C.0 - Widget Source Split And Content JSON | Complete / Test floor green | `tokyo/product/widgets/faq/content.json`, `spec.json`, `manifest.json`, `ck-contracts` tests, `tokyo-worker` tests, `build:widgets:check` | FAQ translation source moved to authored `content.json`; FAQ `spec.json` no longer owns translated fields; generated catalog exposes `content` and derived `overlays`; Tokyo overlay fixtures now use the catalog-derived contract. Full widget source split is not complete because editor/defaults/normalization still live in `spec.json`, but this restart slice is green. |
| 103C.1 - FAQ Gold Standard Contract | Complete / Product path green | `103C1__PRD__...`, `103C1__EXEC__...`, content tests, 103I.2 Copilot package proof, 103F override proof | FAQ translation authority exists. Bob review, production save follow-up, Tokyo-worker overlay tests, Copilot package view, manual overlay edit, and publish proof are green. |
| 103C - Agent Source Projections | Superseded / Closed by 103I.2 | `103C__EXEC__...`, `103I__PRD__...`, San Francisco Copilot payload test | Translation uses content projection in lower-level paths. Copilot now receives widget package context rather than only compiled editor controls. |
| 103D.0 - FAQ Identity/Diff/Merge Contract | Complete / Product proof green | `faq-language-values` tests, Bob review tests, publish verifier | Stable identity, changed-field selection, complete current language merge, fail-closed missing translations, Bob review, manual overlay edits, and publish use of edited values are proven. |
| 103D - Changed Field Translation | Complete / Queue acceptance proof green | `roma/lib/account-instance-translation-jobs.ts`, `roma/lib/account-instance-translation-jobs.test.ts`, `sanfrancisco/src/instance-translation-queue.ts`, `sanfrancisco/src/instance-translation-queue.test.ts` | Roma test proves previousConfig -> currentConfig -> whole changed field -> durable job acceptance. San Francisco queue test proves changed values -> complete current language values -> source-version-guarded Tokyo overlay write. |
| 103E - Bob Translation Panel Review | Complete / Bob UI proof green | `TranslationsPanel.tsx`, `TranslationsPanel.test.tsx`, Bob tests/typecheck | Production `TranslationsPanel` renders `content.json`-based current language values. Dropdown readiness/count refresh rules are covered by Bob tests. |
| 103V - Single-Language Vertical Slice | Complete / Product vertical proof green | `pnpm verify:prd103-faq-vertical`, Bob tests, Roma tests, Tokyo-worker tests, San Francisco tests | In-memory verifier proves content JSON -> diff -> agent request normalization -> merge -> review -> preview overlay. Product-path companion tests prove Bob panel rendering, Roma save follow-up, San Francisco agent boundary, and Tokyo overlay write/read. |
| 103G - Save/Publish Generated Language Files | Complete / Publish language files proof green | `pnpm verify:prd103-publish-language-files`, San Francisco tests, Tokyo-worker tests | Saved FAQ instance plus current language overlay generates base and translated browser files; clk.live serves both statically. |
| 103H - Shared Agent Model Profiles | Complete / Shared policy proof green | `ck-policy` tests, San Francisco tests | Free and Tier 3 resolve different model profiles for both Instance Translation and Copilot through the shared matrix/catalog path. Copilot model picker policy is covered. Translation audit emits account subject, agent ID, policy profile, policy version, provider, model, token usage, and result status. |
| 103I - San Francisco Agent Runtime Cleanup | Complete / Copilot package context green | `103I__PRD__...`, San Francisco tests/typecheck, Bob typecheck, Roma typecheck | Old text-value route removed. Active Roma save follow-up and San Francisco account-widget translation code are named around Instance Translation, saved text graph, and current language values. Bob now sends Copilot `widgetPackage`; Roma forwards it; San Francisco includes content, spec, markup, styles, and client behavior context in the Copilot prompt. No new runtime framework added. |
| 103F - Translation Override UX | Complete / Manual overlay edit green | `103F__PRD__...`, Bob tests/typecheck, Roma tests/typecheck, Tokyo-worker tests/typecheck, publish verifier | Bob edits current-language values for an existing translated overlay, Roma writes the full overlay values object through Tokyo's existing language overlay primitive, and publish consumes the edited overlay value. Old base-text hash / review-state contract shape removed. |

## Current Authorities

- FAQ translation authority: `tokyo/product/widgets/faq/content.json`.
- FAQ translation field parser and overlay derivation: `packages/ck-contracts/src/overlay-primitives.ts`.
- FAQ identity/diff/merge authority: `packages/ck-contracts/src/faq-language-values.ts`.
- Widget catalog composition: `scripts/build-widget-catalog.mjs` generates `tokyo/product/widgets/manifest.json`.
- Current-language storage primitive: Tokyo overlay object `{ v: 1, values }` under the owning instance.
- Save before/after source: Tokyo save response `previousConfig`.
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

- None currently listed for the PRD 103 core path.

## Hard Blockers

- None currently listed for the PRD 103 core path.

## Human Smoke Regression Closed

- Human Bob/Roma smoke found that save waited for translation follow-up across all enabled languages and timed out before overlays could appear.
- Fix: Roma save now returns after Tokyo saves the base instance and starts translation as follow-up work tied to the request lifetime.
- Fix: Bob no longer reads the old `babel` response field after save.
- Added: Bob has a `Generate translations` button that triggers Roma to run the Instance Translation Agent from the current saved instance.
- Added proof: manual generate translates all current FAQ content fields without requiring a save diff or Bob-sent text.

## Next Execution Order

1. Human UX re-smoke in Bob/Roma: open FAQ, save text, inspect translations, edit one translated value, publish.
2. Do not continue broad San Francisco runtime reshaping.

## Do Not Proceed Gates

- Do not add a San Francisco runtime framework without an explicit new slice.
- Do not introduce Bob-owned translation state names. Only `X of Y translations ready` is allowed.
- Do not add a readiness subsystem for publish or translation.
- Do not restore removed legacy translation field names, per-field Copilot allowlists, or `spec.json.overlays.text[]` as authored FAQ translation authority.
