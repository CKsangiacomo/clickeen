# PRD 103L - Translation Workflow Refactor

Status: Active refactor authority
Owner: Product + Architecture
Date: 2026-05-25

## Purpose

Refactor the account-widget translation workflow so the product behavior is clear, deterministic, and generic across widgets.

This PRD exists because the current runtime still leaks internal translation machinery into the user experience. The clearest example is Bob showing translated-locale inventory copy such as `0 of 28 translations ready` while Tokyo reports an active generation. That copy is technically derived from loaded translated artifacts, but product-wise it reads like failed generation progress. It must be removed from the active product workflow.

The refactor must not be implemented as another local copy patch. It must align Bob, Roma, Tokyo, San Francisco, contracts, and tests around one product contract.

## Product Contract

The user workflow is:

1. User edits base content in the Content panel.
2. User saves base content.
3. User opens the Translations panel.
4. Bob reads Tokyo/Roma translation product state.
5. The panel tells the user whether translated locales match the current saved base content.
6. User clicks Generate translations when translations are missing, failed, or out of sync.
7. While generation is active, Generate is disabled.
8. San Francisco translates Tokyo-created locale jobs.
9. Tokyo applies only completions that match the current saved base content marker.
10. Bob shows translated locales only when Tokyo says those locales are reviewable for the current saved base content.

Save does not translate. Artifact presence is not sync truth. Bob local state is not generation truth.

## Pre-Execution Guardrails

Use this as the execution mantra:

```text
No competing generations. No inventory progress UI. No queue math in UX. Markers decide truth. One resolver decides UI.
```

Hard rules before implementation begins:

- If any generation is active for the instance, Generate remains disabled. Do not create a competing generation because base content or target locales changed mid-flight.
- If active generation's `generationRequestMarker` matches the current request scope, Bob shows `Generating translations.`.
- If active generation's `baseContentMarker` differs from the current saved base marker, Bob shows `The base content has changed. Regenerate translations when generation finishes.`.
- Base locale preview may always exist. Translated-locale review options appear only for locales where Tokyo returns `reviewable: true`.
- The migration is additive first: introduce the product DTO, move Roma/Bob to it, then remove or isolate queue-progress arrays from Bob-facing UX.
- Keep the existing timeout reason key unless there is a deliberate one-time contract migration. Current preferred key for this PRD is `instance.translation.timed_out`.

## User-Visible States

Bob must keep translation UI local and direct. It may show the temporary
translation activity box while the agent command is active, a save-before-generate
message when local edits are unsaved, or a direct command error. It must not add
a separate translation product-state interpreter, queue monitor, reconciliation
layer, or status vocabulary over the agent writing overlays.

Only one panel message may be shown. Bob must not stack independent generation,
inventory, error, and instruction messages that imply conflicting states.

| State | Meaning | Generate button | Primary message |
| --- | --- | --- | --- |
| `loading` | Bob has not yet read Tokyo product state for the instance. | Disabled | `null` or `Loading translations...` |
| `unsaved` | Bob has unsaved base content changes. | Disabled | `Save changes before generating translations.` |
| `unavailable` | No instance, no target locales, or no translatable fields. | Disabled | Specific unavailable reason if useful |
| `ready` | Saved base content exists and at least one target locale is missing work. | Enabled | `No translations generated yet.` or `null` |
| `generating` | Tokyo has active accepted work for the current saved base content. | Disabled | `Generating translations.` |
| `baseChangedWhileGenerating` | Saved base content changed while older generation is still active. | Disabled | `The base content has changed. Regenerate translations when generation finishes.` |
| `baseChanged` | Existing translated locale values were generated from older saved base content. | Enabled | `The base content has changed. Regenerate translations.` |
| `partialFailure` | At least one locale failed, while other locales may still be reviewable. | Enabled | Failure copy with locale detail when available |
| `failed` | Current generation failed and no locale is reviewable. | Enabled | Failure copy with detail when available |
| `available` | One or more locales are in sync and reviewable. | Enabled when no job is active and work exists | `null` |

Required base-changed copy:

```text
The base content has changed. Regenerate translations.
```

Required active copy:

```text
Generating translations.
```

Forbidden copy:

```text
0 of 28 translations ready
N of M translations ready
Preparing translations.
```

## State Precedence

Bob's product-state resolver must use this precedence:

1. If base content is dirty or saving, state is `unsaved`.
2. If no instance, no target locales, or no editable translation fields, state is `unavailable`.
3. If Tokyo product state has not loaded yet, state is `loading` and Generate is disabled.
4. If Tokyo reports active work whose `baseContentMarker` differs from the current saved base marker, state is `baseChangedWhileGenerating`.
5. If Tokyo reports active work whose `generationRequestMarker` matches the current request scope, state is `generating`.
6. If Tokyo reports any other active work for the same instance, Generate remains disabled and state must be either `generating` or `baseChangedWhileGenerating` based on whether the active work's base marker matches current saved base content. It must not create competing work.
7. If any locale has state `outOfSync`, state is `baseChanged`.
8. If at least one locale failed and at least one locale is reviewable, state is `partialFailure`.
9. If all attempted work failed and no locale is reviewable, state is `failed`.
10. If at least one locale is reviewable, state is `available`.
11. Otherwise state is `ready`.

Reviewable locales are only locales whose Tokyo product state is `inSync`. Bob must not use translated artifact presence alone to decide reviewability.

## Marker Model

There are two markers. They must not be collapsed.

### Base Content Marker

`baseContentMarker` is the sync identity for translated values.

It includes:

- widget type;
- editable-fields contract hash;
- base locale;
- identity-bearing saved text fields;
- current base text for each identity.

It does not include the target locale set.

Use `baseContentMarker` to decide whether a translated locale value map is in sync with current saved base content.

### Generation Request Marker

`generationRequestMarker` is the idempotency identity for active generation work.

It includes:

- `baseContentMarker`;
- requested target locale set.

Use `generationRequestMarker` to decide whether Generate should return an already-active operation for the same request scope.

Adding a new target locale must not make existing good translated locales stale. Existing locales remain `inSync` when their stored `baseContentMarker` matches current base content. Newly selected locales become `missing`.

Changing the request scope while any generation is active must not create a competing generation. It can change Bob's visible state only by showing that the active generation is still running or that base content changed while that older generation is running.

## Durable Locale Sync Model

Tokyo must persist or derive from persisted Tokyo-owned state a per-locale sync record. String presence is not enough.

Required private model, either embedded with translated locale values or stored adjacent:

```ts
type TranslationLocaleSyncRecord = {
  locale: string;
  baseContentMarker: string;
  widgetContractHash: string;
  generatedAt: string;
  status: 'inSync' | 'failed';
  reasonKey?: string;
  detail?: string;
};
```

Tokyo derives public locale state from current saved base content plus this record:

1. active current-marker locale job -> `generating`;
2. current-marker failed locale -> `failed`;
3. translated values exist and stored marker equals current `baseContentMarker` -> `inSync`;
4. translated values exist and stored marker differs from current `baseContentMarker` -> `outOfSync`;
5. no translated values -> `missing`.

Saving base content recomputes the current `baseContentMarker`. Prior translated values are not deleted solely because the marker changed; they become `outOfSync` until Generate creates current-marker values.

## Target Product Payload

Tokyo/Roma must expose Bob a product summary shaped around product states:

```ts
type TranslationGenerationProductSummary = {
  v: 2;
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
  active: boolean;
  baseContentMarker: string;
  generationRequestMarker: string;
  isCurrentBaseContent: boolean;
  locales: Array<{
    locale: string;
    state: 'missing' | 'generating' | 'inSync' | 'outOfSync' | 'failed';
    reviewable: boolean;
    reasonKey?: string;
    detail?: string;
  }>;
  reasonKey?: string;
  detail?: string;
};
```

Bob may derive translation UX only from this product summary plus local unsaved/saving/availability facts.

Queue internals must not be required by Bob:

- `queuedLocales`;
- `pendingLocales`;
- `completedLocales`;
- `currentReadyLocales`;
- `supersededLocales`;
- queue message counts;
- job lineage.

If diagnostics are still needed, they must live behind a debug-only shape or route that Bob does not consume for UX.

## Migration Rule

The final public contract must omit queue-progress arrays from Bob's UX model. Because the current Roma and Bob normalizers still require old arrays, implementation must migrate additively:

1. Tokyo adds `v: 2`, `generationRequestMarker`, and `locales[]` product states while old fields may still exist internally.
2. Roma accepts and forwards the product summary. Old queue arrays become optional and non-authoritative.
3. Bob derives UX directly from saved instance facts and local command activity.
4. Bob stops requiring and rendering old progress arrays.
5. Tokyo/Roma stop exposing queue arrays to Bob-facing routes, or move them into diagnostics that Bob does not consume.

No implementation may add a new Bob UI dependency on the old arrays during this migration.

## Current Divergence

### Bob

Bob currently mixes:

- Tokyo generation state;
- local button state;
- loaded translated-locale inventory;
- translation errors;
- review instructions.

The problematic branch is:

```text
bob/components/TranslationsPanel.tsx
```

It renders inventory progress:

```text
{readyTranslationsCount} of {expectedTranslationsCount} translations ready
```

This must be deleted from user-visible product UI.

Bob also currently shows:

```text
Select a translated language to review it.
```

That copy must only appear when at least one `reviewable` translated locale exists. If no translated locale is reviewable, show `No translations generated yet.` or no copy, according to the resolver state. Do not imply a translated language can be selected before one exists.

Bob must re-read Tokyo/Roma translation product state:

- when the Translations panel opens;
- after Generate returns;
- while generation is active;
- after base content is saved.

Until the first read resolves for the current instance, Generate is disabled.

### Tokyo

Tokyo owns:

- base content marker;
- generation request marker;
- per-locale sync records;
- active generation liveness;
- stale completion rejection;
- translated locale value writes;
- failed generation reporting.

Tokyo must not expose `superseded` as a public UX status. Internal stale/superseded work maps publicly to locale state `outOfSync` and top-level non-active state unless a current generation is active.

Missing and out-of-sync are different:

- `missing`: no prior translated values for the locale.
- `outOfSync`: prior translated values exist, but their stored `baseContentMarker` differs from the current one.

### Roma

Roma must normalize and pass Tokyo product translation summaries through to Bob without creating a second translation state model.

Roma may validate payload shape. It must not rederive readiness from translated artifact inventory or queue arrays.

### San Francisco

San Francisco's contract is narrow:

```text
Tokyo creates one marker-bearing InstanceTranslationJob per target locale.
San Francisco consumes the job.
San Francisco translates only job.changedFields.
San Francisco calls Tokyo /complete or /fail with the full job.
Tokyo decides whether the result applies.
```

San Francisco must preserve the full job when reporting completion/failure, especially:

- `jobId`;
- `baseContentMarker`;
- `generationRequestMarker` if present on the job;
- `accountId`;
- `accountPublicId`;
- `userId`;
- `instanceId`;
- `widgetType`;
- `widgetContract.hash`;
- `baseLocale`;
- `targetLocale`;
- `targetLocales`;
- `requestId`;
- `changedFields`;
- `deletedIdentityKeys`;
- `basis.fields`.

Tokyo must create marker-bearing product jobs. San Francisco must reject new product queue messages that lack `baseContentMarker` after any existing in-flight markerless queues are drained. Tokyo may keep legacy fallback normalization only for already-created markerless jobs during the compatibility window.

## Liveness

Active generation must not poll forever.

Required liveness rules:

- Tokyo owns active generation timeout.
- Timeout may be generation-level in this PRD; per-locale timeout may be added later if needed.
- Timeout changes active generation to terminal `failed`.
- Timeout reason key must be stable. Use the existing key `instance.translation.timed_out` unless a separate migration explicitly renames it.
- San Francisco retry exhaustion reports terminal failure to Tokyo.
- Bob sees timed-out or retry-exhausted work as `failed` or `partialFailure` depending on whether any locale remains reviewable.
- Repeated Generate after terminal failure is allowed.

Operational events must be correlated by:

- `requestId`;
- `jobId`;
- `accountPublicId`;
- `instanceId`;
- `locale`;
- `baseContentMarker` prefix;
- `generationRequestMarker` prefix where available.

Tokyo should emit or preserve enough events/metadata for generate, read, complete, fail, and timeout. San Francisco should emit or preserve enough events/metadata for consume, complete, fail, retry, and retry exhaustion.

## Required Refactor Scope

### Bob

Edit:

- `bob/components/TranslationsPanel.tsx`
- `bob/components/TranslationsPanel.test.tsx`
- `bob/lib/translations-preview.ts` only if inventory helper names need to be narrowed
- `bob/lib/translations-preview.test.ts` only if helper behavior changes

Required changes:

- implement one translation panel product-state resolver;
- delete user-visible inventory-progress copy;
- make active generation show only `Generating translations.`;
- make base-changed state show only the required regenerate copy;
- implement `baseChangedWhileGenerating`;
- disable Generate while Tokyo state is loading or active;
- keep base locale preview available;
- show translated review dropdown/options only for `reviewable` / `inSync` locales;
- hide translated-language instruction when no translated locale is reviewable;
- re-read translation summary after base save.

### Tokyo

Edit:

- `tokyo-worker/src/domains/render/translation-operations.ts`
- `tokyo-worker/src/domains/render/translation-generation-state.ts`
- `tokyo-worker/src/domains/render/types.ts`
- translated-locale storage code if needed for sync record persistence
- related Tokyo tests

Required changes:

- keep `baseContentMarker` source-content-only;
- add `generationRequestMarker`;
- persist or derive durable per-locale sync records with marker identity;
- provide product locale states;
- keep active generation idempotent by generation request marker;
- reject stale completions by base content marker;
- map internal `superseded` to public `outOfSync`;
- keep internal diagnostics out of Bob-facing product progress.

### Roma

Edit:

- `roma/lib/account-instance-translations.ts`
- `roma/lib/account-instance-translations.test.ts`

Required changes:

- normalize/pass product summary from Tokyo;
- do not invent Roma-side generation state;
- do not expose queue progress to Bob UX;
- accept the additive migration shape while Bob switches to the product DTO.

### Contracts / San Francisco

Edit:

- `packages/ck-contracts/src/instance-translation-jobs.ts`
- `sanfrancisco/src/instance-translation-queue.test.ts`
- `sanfrancisco/src/instance-translation-queue.ts` only if queue boundary validation is required

Required changes:

- product jobs must be marker-bearing;
- preserve marker fields on `/complete`;
- preserve marker fields on `/fail`;
- accept Tokyo `applied: false` stale completion response as terminal because Tokyo owns sync truth;
- validate provider output before calling Tokyo complete.

## Explicit Non-Scope

Do not touch:

- public publish/materialization behavior;
- widget runtime rendering;
- auth/session/account policy;
- Dieter styling or tokens;
- Cloudflare deployment configuration;
- San Francisco provider prompt quality, except where tests require contract preservation;
- new widget onboarding automation, except to validate that this refactor remains generic.

## Tests

### Bob Tests

Must prove:

- one resolver returns exactly one primary state/message;
- unsaved base changes disable Generate and show `Save changes before generating translations.`;
- initial Tokyo state loading disables Generate;
- active generation renders `Generating translations.`;
- active generation does not render `0 of N translations ready`;
- active generation disables Generate;
- base-changed while generating renders the combined-state copy and disables Generate;
- target-locale changes while generation is active do not enable Generate or create a competing-generation UI path;
- out-of-sync state renders `The base content has changed. Regenerate translations.`;
- no reviewable translated locales means no translated-language instruction;
- partial translated artifacts do not create progress copy;
- only `inSync` locales create dropdown options and review rows.

### Tokyo Tests

Must prove:

- `baseContentMarker` changes when base text changes;
- `baseContentMarker` does not change when only target locale set changes;
- `generationRequestMarker` changes when target locale set changes;
- repeated Generate while active returns the active operation and creates no competing work;
- target-locale changes while active generation exists do not create competing work;
- first-time missing locale is `missing`, not `outOfSync`;
- existing locale with old marker is `outOfSync`;
- stale completion rejects with base-changed semantics;
- internal `superseded` maps to public `outOfSync`;
- timeout becomes terminal failure with `instance.translation.timed_out`;
- product payload exposes locale states without requiring queue progress arrays.

### Roma Tests

Must prove:

- Roma normalizes product summary without queue-progress semantics;
- Roma passes active, failed, missing, out-of-sync, in-sync, and reviewable locale states correctly;
- old arrays are optional during migration and are not required for Bob-facing UX.

### San Francisco Tests

Must prove:

- marker-bearing job is preserved in `/complete`;
- marker-bearing job is preserved in `/fail`;
- markerless new product job is rejected after the compatibility window or at the queue boundary selected by implementation;
- non-FAQ generic `changedFields` job works;
- non-FAQ fixture includes nested/repeated fields and CTA/button text from the content panel;
- provider output with missing, extra, or non-string values is rejected before `/complete`;
- Tokyo `applied: false` stale completion response is acknowledged as terminal;
- retry exhaustion reports terminal failure to Tokyo.

## Generic Widget Fixture Requirement

FAQ remains a required repeated-field fixture, but it is not enough.

This PRD must also pass with a named non-FAQ fixture that includes:

- nested editable fields;
- repeated editable fields;
- CTA/button text from the content panel;
- at least one plain string field.

If no existing widget fixture satisfies this, the implementation must either identify the closest existing widget and document the gap, or add a minimal test fixture without changing product runtime behavior.

## Acceptance

- Bob never shows `0 of N translations ready`.
- Bob never shows queue progress copy.
- Bob renders one primary translation state/message at a time.
- Generate is disabled while Tokyo state is loading, while base content is unsaved, or whenever Tokyo reports active generation.
- No request path creates a competing generation while an instance already has active generation work.
- Base-changed state shows the required regenerate copy.
- Base-changed-while-generating state disables Generate and tells the user to regenerate when generation finishes.
- Saving base content recomputes the base marker and makes prior locale sync records out of sync without deleting translated values.
- Adding a target locale does not invalidate existing in-sync locales.
- Generate creates or returns one active operation for the current generation request marker.
- San Francisco completions apply only when their base marker still matches current saved base content.
- Bob preview/review dropdown includes only in-sync reviewable locales.
- The same workflow works for FAQ and the required non-FAQ fixture.
- Tests cover Bob, Roma, Tokyo, San Francisco, and contracts at the product-state boundary.

## Execution Controls

This PRD must be executed as a refactor, not as a patch series around the current broken UI.

### Gate Rules

- Commit this PRD before implementation begins.
- Execute one gate at a time, in the execution order below.
- Use one commit per gate.
- Before editing each gate, declare the exact files in scope.
- Do not edit files outside the declared gate. If a new file is required, stop and explain why before editing it.
- Do not move to the next gate until that gate's targeted tests pass.
- Do not push/deploy until all gates pass and final grep tripwires are clean.
- Do not implement a Bob-only copy fix before the Tokyo/Roma product DTO exists, except as part of the Bob gate after DTO adoption.

### Gate Commit Map

| Gate | Commit scope | Allowed edit set | Required proof |
| --- | --- | --- | --- |
| 0 | PRD authority | `Execution_Pipeline_Docs/01-Planning/103L__PRD__Translation_Workflow_Refactor.md` | PRD committed alone |
| 1 | Tokyo product DTO | Tokyo render translation files and Tokyo tests only | marker split, durable locale states, no competing generation |
| 2 | Roma normalization | Roma translation API library/tests only | `v: 2` product summary accepted, old arrays optional |
| 3 | Bob resolver/UI | Bob translation panel/helpers/tests only | one resolver, no inventory progress UI, reviewable-only translated locales |
| 4 | Contracts/SF | `ck-contracts` job contract, SF queue/tests only | marker-bearing jobs preserved/rejected as specified |
| 5 | Cleanup | Files already touched by gates 1-4 | Bob-facing queue arrays isolated/removed; public `superseded` gone |

### Drift Stop Conditions

Stop implementation and revise the plan if any of these become necessary:

- touching publish/materialization, widget runtime rendering, auth/session/account policy, Dieter styling, or Cloudflare config;
- adding a second Bob state resolver;
- deriving Bob reviewability from translated artifact inventory;
- allowing Generate to create competing work while any generation is active;
- collapsing `baseContentMarker` and `generationRequestMarker`;
- preserving public `superseded` as a Bob/Roma UX state;
- requiring old queue arrays for Bob-facing UX after the Bob gate.

### Final Grep Tripwires

Before push, these searches must be clean or intentionally limited to internal diagnostics/tests:

```sh
rg -n "translations ready|Preparing translations" bob roma tokyo-worker packages sanfrancisco -S
rg -n "currentReadyLocales|pendingLocales|completedLocales|supersededLocales" bob roma -S
rg -n "superseded" bob roma -S
rg -n "readyTranslationsCount|allExpectedTranslationsReady" bob/components bob/lib -S
```

Expected final state:

- no user-facing `translations ready` progress copy;
- no Bob dependency on queue-progress arrays;
- no public Bob/Roma `superseded` UX state;
- translated-locale inventory helpers do not decide product state or reviewability.

## Blast Radius And Deletion Map

Current file sizes at PRD creation:

| Area | File | Current LOC | Expected action |
| --- | --- | ---: | --- |
| Bob UI | `bob/components/TranslationsPanel.tsx` | 706 | Replace scattered generation/inventory state with one resolver; delete forbidden progress UI |
| Bob helpers | `bob/lib/translations-preview.ts` | 323 | Keep inventory only for base/translated value loading; remove or rename fields if they imply product progress |
| Roma API | `roma/lib/account-instance-translations.ts` | 407 | Add `v: 2` product DTO normalization; make old queue arrays optional/non-authoritative |
| Tokyo ops | `tokyo-worker/src/domains/render/translation-operations.ts` | 1271 | Marker split, locale product states, no competing generation, stale completion by base marker |
| Tokyo state | `tokyo-worker/src/domains/render/translation-generation-state.ts` | 305 | Product summary derivation, public mapping away from `superseded`, durable locale state derivation |
| Tokyo types | `tokyo-worker/src/domains/render/types.ts` | 194 | Add product DTO/sync types; isolate internal diagnostics |
| Job contract | `packages/ck-contracts/src/instance-translation-jobs.ts` | 195 | Require/enforce marker-bearing product jobs after compatibility window |
| SF queue | `sanfrancisco/src/instance-translation-queue.ts` | 325 | Preserve marker fields; treat Tokyo `applied:false` as terminal; reject markerless new product jobs if chosen here |

### Exact Delete / Replace Targets

#### Bob

- Delete user-visible inventory progress at `bob/components/TranslationsPanel.tsx:660-663`.
  - Current bad output: `{readyTranslationsCount} of {expectedTranslationsCount} translations ready`.
  - Replacement: no progress copy; only direct panel messages and active command activity.
- Replace old `TranslationGenerationSummary` shape at `bob/components/TranslationsPanel.tsx:24-47`.
  - Remove public UX dependence on `completedLocales`, `pendingLocales`, `currentReadyLocales`, and `supersededLocales`.
  - Add `v: 2`, `active`, `generationRequestMarker`, and product `locales[]`.
- Replace old normalizer requirements at `bob/components/TranslationsPanel.tsx:176-225`.
  - Old queue arrays must be optional or ignored for UX.
  - Product `locales[]` must be required for `v: 2`.
- Replace message resolver at `bob/components/TranslationsPanel.tsx:256-268`.
  - Public `superseded` branch must disappear.
  - Message must come from the product-state resolver.
- Replace panel state helper at `bob/components/TranslationsPanel.tsx:298-318`.
  - Stop using `completedLocales.length` / `outOfSyncLocales` as separate refresh/message truth.
- Replace local generation truth at `bob/components/TranslationsPanel.tsx:430`, `:502`, `:556-580`.
  - Local `isGeneratingTranslations` must not be product truth.
  - Button state derives from resolver output and latest Tokyo/Roma product summary.
- Gate translated review instruction at `bob/components/TranslationsPanel.tsx:673-678`.
  - Base preview may exist.
  - Translated-locale review instruction/options require `reviewableLocales.length > 0`.
- In `bob/lib/translations-preview.ts:44-52` and `:157-185`, remove or narrow `readyTranslationsCount` / `allExpectedTranslationsReady` if they imply product progress.
  - These values may remain only as internal inventory helpers and must not feed Bob product state.

#### Roma

- Replace old public generation status union at `roma/lib/account-instance-translations.ts:45-51`.
  - `superseded` must not be exposed as Bob UX state.
- Replace summary type at `roma/lib/account-instance-translations.ts:53-69`.
  - Add `v: 2`, `active`, `generationRequestMarker`, `locales[]`.
  - Make old arrays optional/non-authoritative during migration.
- Replace normalizer at `roma/lib/account-instance-translations.ts:152-199`.
  - It must accept product DTO and not require old queue arrays.

#### Tokyo

- Replace marker semantics at `tokyo-worker/src/domains/render/translation-operations.ts:75-95`.
  - Keep `baseContentMarker` source-content-only.
  - Add separate `generationRequestMarker`.
- Review legacy marker fallback at `tokyo-worker/src/domains/render/translation-operations.ts:228-243`.
  - Keep only for compatibility with already-created markerless jobs.
  - Do not let markerless jobs define new product behavior.
- Replace active generation idempotency around `tokyo-worker/src/domains/render/translation-operations.ts:668-708`.
  - Use `generationRequestMarker` for same-scope idempotency.
  - Any active generation still blocks competing work.
- Replace stale completion mapping around `tokyo-worker/src/domains/render/translation-operations.ts:975-1040` and `:1041-1090`.
  - Internal stale/superseded work must map publicly to `outOfSync`.
- Replace old public status/types at `tokyo-worker/src/domains/render/types.ts:79-94` and summary fields at `:146-157`.
  - Public product status excludes `superseded`.
  - Product DTO exposes locale states instead of queue progress.
- Replace summary derivation at `tokyo-worker/src/domains/render/translation-generation-state.ts:119-254`.
  - Internal arrays may exist as diagnostics only.
  - Public product summary derives `missing`, `generating`, `inSync`, `outOfSync`, `failed` by the priority in this PRD.
- Replace `outOfSyncLocalesForContent` usage at `tokyo-worker/src/domains/render/translation-generation-state.ts:148-156`.
  - Missing is not out-of-sync.
  - Out-of-sync requires existing translated values with a stale marker.

#### Contracts / San Francisco

- Replace optional marker contract at `packages/ck-contracts/src/instance-translation-jobs.ts:10-44` and normalizer at `:118-190`.
  - Product jobs must be marker-bearing after compatibility window.
  - Legacy markerless acceptance may remain only if explicitly isolated.
- Preserve full job on completion in `sanfrancisco/src/instance-translation-queue.ts:101-109`.
  - Tests must assert `baseContentMarker` and `generationRequestMarker` if present.
- Preserve full job on failure in `sanfrancisco/src/instance-translation-queue.ts:201-210`.
  - Tests must assert marker fields.
- Keep Tokyo `applied:false` as terminal in `sanfrancisco/src/instance-translation-queue.ts:101-139`.
  - Do not retry stale completions.

## Execution Order

1. Tokyo additive product summary: add durable locale states, marker split, and `v: 2` payload without breaking existing callers.
2. Roma normalization: accept/pass the product summary and make old arrays optional/non-authoritative.
3. Bob product-state resolver and UX deletion: remove inventory-progress UI and consume product locale states.
4. Contract/San Francisco validation: enforce marker-bearing product jobs and prove preservation.
5. Cleanup: remove or isolate Bob-facing queue arrays and public `superseded` exposure.
6. Full targeted verification.
7. Push and Cloudflare autodeploy.

No implementation step may add a new user-visible translation state outside this PRD.
