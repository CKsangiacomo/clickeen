# PRD 105G - Translation Workflow State And Sync Verification

Status: Green / contract verified
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`, `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`, `105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md`

## Purpose

Verify the user-facing translation workflow state model after the PRD 105 reset.

This PRD extracts the surviving doctrine from the 103K/103L translation workflow plans while correcting the parts that conflict with the PRD 105 instance-folder tenets.

The core product rule:

```text
Bob must show whether translated locales match the current saved base content.
Bob must not expose queue math, storage inventory, job lineage, or operation-controller JSON as product truth.
```

This PRD is the single authority for Bob/Roma translation panel state, resolver precedence, reviewability, and user-visible copy. Other 105 PRDs may reference these UX rules, but must not redefine them.

## Source Documents Reviewed

This PRD extracts from:

```text
103K__PRD__Saved_Base_Content_Translation_Sync.md
103K__EXEC__Saved_Base_Content_Translation_Sync_Runtime_Wiring.md
103L__PRD__Translation_Workflow_Refactor.md
```

Those documents become historical planning evidence after this extraction. They must not remain active execution authority.

## Product Contract

The product workflow is:

```text
User edits one widget in Bob.
User saves base content through Roma/Tokyo.
User opens Translations panel.
Bob reads Tokyo/Roma translation product state.
Bob tells the user whether translated locales match the current saved base content.
User clicks Generate translations when translations are missing, failed, or out of sync.
Generate is disabled while loading, while base content is unsaved, or while any generation is active.
San Francisco translates Tokyo-created marker-bearing locale jobs.
Tokyo applies only completions that match current saved base content.
Bob shows translated locale review only when Tokyo says that locale is reviewable.
```

Translation is derived output. It is not a second authoring source, a queue monitor, a job-history surface, or a FAQ-specific workflow.

## User-Visible State Contract

Bob must render one primary translation state at a time through one resolver.

Required resolver concept:

```ts
resolveTranslationPanelProductState(...)
```

Required state vocabulary:

```text
loading
unsaved
unavailable
ready
generating
baseChangedWhileGenerating
baseChanged
partialFailure
failed
available
```

Required copy:

```text
Generating translations.
The base content has changed. Regenerate translations.
The base content has changed. Regenerate translations when generation finishes.
Save changes before generating translations.
```

Forbidden copy:

```text
0 of 28 translations ready
N of M translations ready
Preparing translations.
```

Base locale preview may always exist. Translated-locale review options appear only for locales Tokyo marks `reviewable: true` for the current saved base content.

## State Precedence

Bob's resolver must use this product precedence:

1. Unsaved or saving base content -> `unsaved`, Generate disabled.
2. No instance, no target locales, or no editable translation fields -> `unavailable`, Generate disabled.
3. Tokyo product state not loaded -> `loading`, Generate disabled.
4. Active generation whose `baseContentMarker` differs from current saved base marker -> `baseChangedWhileGenerating`, Generate disabled.
5. Active generation for current saved base/request -> `generating`, Generate disabled.
6. Any other active generation for the same instance -> Generate disabled; no competing work.
7. Any locale state `outOfSync` -> `baseChanged`.
8. Failed locales plus at least one reviewable locale -> `partialFailure`.
9. Failed work and no reviewable locale -> `failed`.
10. At least one reviewable locale -> `available`.
11. Otherwise -> `ready`.

No state may derive from translated artifact inventory alone.

## Marker Contract

There are two markers. They must not be collapsed.

### Base Content Marker

`baseContentMarker` proves whether translated values match current saved base content.

It includes:

- widget type;
- editable-fields contract hash;
- base locale;
- identity-bearing saved text fields;
- current base text for each identity.

It does not include the target locale set.

It must be a versioned SHA-256 digest over canonical JSON:

```text
sha256:v1:{digest}
```

A short non-cryptographic hash is not acceptable for translation apply/reject truth.

### Generation Request Marker

`generationRequestMarker` is the idempotency identity for active generation work.

It includes:

- `baseContentMarker`;
- requested target locale set.

It must also be a versioned SHA-256 digest over canonical JSON:

```text
sha256:v1:{digest}
```

Adding a target locale must not make existing good translated locales stale. Existing locales remain `inSync` when their stored `baseContentMarker` matches current saved base content. Newly selected locales become `missing`.

Changing request scope while any generation is active must not create a competing generation.

## Locale Sync Contract

Tokyo owns per-locale sync truth.

Public locale states:

```text
missing
generating
inSync
outOfSync
failed
```

Reviewability:

```text
reviewable = true only when locale state is inSync for current saved base content
```

Required private sync facts:

- locale;
- base content marker;
- widget contract hash;
- generated timestamp;
- terminal status;
- failure reason/detail when applicable.

Durable translated locale output belongs under the PRD 105 storage target:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Operation-controller JSON must not be used as sync authority.

Locale overlay documents must conform to the v1 schema in `105__PRD__Instance_Folder_Tenets.md`. For PRD 105 execution, the stored `values` map is concrete-path keyed. Stable field identities may be used for marker derivation and extraction, but must not create a second persisted locale overlay schema during 105M.

Forbidden instance-folder operation files:

```text
translation-generation-job.json
generation.json
queue.json
status.json
worker-state.json
retry-state.json
```

## Tokyo / Roma / San Francisco Responsibilities

Tokyo owns:

- base content marker;
- generation request marker;
- active generation liveness;
- per-locale sync state;
- translated locale overlay writes;
- stale completion rejection;
- timeout and terminal failure reporting.

Roma owns:

- account-authorized pass-through to Tokyo;
- payload shape validation;
- no second translation state model.

San Francisco owns:

- AI translation of Tokyo-created jobs;
- preserving marker-bearing job fields on complete/fail;
- strict provider output validation;
- treating Tokyo `applied: false` stale outcomes as terminal.

San Francisco must not decide sync truth, write public artifacts, or write operation state into the instance folder.

## Bob Delete Targets

Bob must not render or depend on:

- queue progress arrays;
- storage inventory as readiness truth;
- `readyTranslationsCount`;
- `expectedTranslationsCount`;
- `currentReadyLocales` as UX truth;
- public `superseded` state;
- local spinner truth as a substitute for Tokyo state.

If diagnostics still need old arrays, they must live behind an explicit debug-only route/shape that Bob does not consume for product UX.

## PRD 105 Corrections To 103K/103L

The old 103K marker definition included target locale set inside the saved base content marker. That is not active authority.

Correct PRD 105 rule:

```text
baseContentMarker = source-content sync identity
generationRequestMarker = baseContentMarker + requested target locale set
```

The old docs sometimes reasoned around job documents and queue progress. That is not active authority.

Correct PRD 105 rule:

```text
operation state is not stored as instance-folder JSON
Bob UX is product state, not queue state
```

## Verification Scope

This PRD is green only when active code/docs are checked for:

- Bob has one translation panel product-state resolver;
- Bob never renders `0 of N translations ready`, `N of M translations ready`, or `Preparing translations.`;
- Generate is disabled while Tokyo state is loading;
- Generate is disabled while base content is unsaved/saving;
- Generate is disabled while any generation is active for the instance;
- no active path creates competing generation work while an instance has active generation;
- base-changed state renders `The base content has changed. Regenerate translations.`;
- base-changed-while-generating renders `The base content has changed. Regenerate translations when generation finishes.`;
- only `inSync` locales appear as translated review options;
- missing and out-of-sync are distinct states;
- adding a target locale does not invalidate existing in-sync locales;
- `baseContentMarker` changes when saved base text changes;
- `baseContentMarker` does not change when only target locale set changes;
- `generationRequestMarker` changes when target locale set changes;
- stale San Francisco completion is terminal and does not create retry churn;
- Roma passes Tokyo's product summary without inventing readiness;
- no active Bob/Roma UX state exposes public `superseded`;
- no active docs present operation-controller JSON as translation workflow authority.

## Archive Decision For Source Batch

After this PRD is created, the 103K/103L workflow sync batch must move to `03-Executed` as historical planning evidence.

Required archive status:

```text
Historical planning evidence.
Surviving workflow-state doctrine extracted to PRD 105G.
Superseded by PRD 105/105D/105E/105F/105G where conflicting.
```

## Non-Scope

This PRD does not:

- implement the Tokyo operation ledger/store by itself;
- implement zero-touch generate-on-save;
- implement automatic rematerialization after translation completion;
- implement SEO/GEO locale pages;
- change Prague dogfood pages;
- change account coordinate migration;
- change widget runtime rendering;
- change Dieter styling or tokens;
- change San Francisco provider prompt quality.

Those require later focused PRD 105 sub-PRDs if verification proves they are needed.

## Final Verification - 2026-06-02

Status: Green. Bob/Roma translation workflow state is verified locally as product locale state, not queue-detail UI state.

Evidence:

- `queuedLocales` was removed from the active product API surface.
- `pnpm --filter @clickeen/bob test` passes translation-panel state, unsaved-edit blocking, Tokyo-owned generation state, base-change copy, and reviewable locale tests.
- `pnpm --filter @clickeen/roma test` passes v2 generation product state without legacy queue arrays.
- `pnpm --filter @clickeen/tokyo-worker test` passes marker, out-of-sync, stale completion, and generation summary tests.
- `pnpm verify:prd105-runtime-boundary` passes.
