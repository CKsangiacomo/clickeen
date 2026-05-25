# PRD 103J - Generic Widget Translation System

Status: Implemented locally / Cloud smoke pending
Owner: Product + Architecture
Date: 2026-05-25
Depends on: `103_DB_Pivot__EXEC__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`, `103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md`

## Purpose

Correct PRD 103 translation architecture from an FAQ vertical slice into the real Clickeen product boundary:

```text
Any account-owned widget instance with authored customer-visible text can generate, inspect, preview, and publish translations through the same product path.
```

The current FAQ path is useful evidence and salvage. It is not the platform architecture.

## Product Truth

Clickeen Builder is a multi-widget SaaS product. Translation must not be coupled to one widget type.

For every widget, the widget source declares its authored customer-visible text once:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

That contract includes every user-visible authored text primitive, regardless of which Bob panel owns the control:

- Content panel text;
- CTA button labels;
- header title and subtitle;
- timer labels;
- logo names, captions, alt text, and titles;
- FAQ section titles, questions, and answers;
- any other saved string or rich text that the customer authors and visitors see.

Bob may organize controls across Content, Design, CTA, Layout, or other panels. Panel ownership does not define translation ownership. `editable-fields.json` defines translation ownership.

Base authored text is still edited only on the real account Builder path:

```text
Roma opens one account-owned instance -> Bob edits -> Roma saves -> Tokyo persists.
```

Translation preview/review is not a second authoring surface. Translation generation reads the saved instance after Save and writes translated locale values through Tokyo product operations.

## Non-Negotiables

- `editable-fields.json` is the only product declaration of translatable authored widget text.
- FAQ helpers do not define the product operation.
- Tokyo owns Generate, generation state, changed/missing pickup, translated-locale writes, and completion/failure transitions.
- San Francisco translates generic primitive fields only.
- Bob renders product state from Tokyo and reviews/previews translated values through the generic contract.
- Translation does not create another widget, another authoring mode, overlay inventory, selected pointer, or storage-path identity.
- Unsupported widget translation must fail or be hidden at the named boundary. It must not silently degrade into partial product behavior.
- Adding a new widget must be boring: add widget source, add `editable-fields.json`, pass contract tests, and inherit the translation pipeline.

## Required System Model

### 1. Widget Text Contract

Each widget definition exposes a `WidgetEditableFieldsContract` with:

- `widgetType`;
- concrete or repeatable field paths;
- `type` of `string` or `richtext`;
- human label;
- semantic role;
- `arrayItemIdentity` declarations for repeated structures.

Repeatable paths such as `strips[].logos[].caption` must not rely on array index as product identity. The system must resolve stable identity from declared ID fields such as `strips[].id` and `strips[].logos[].id`.

The generic identity algorithm is part of this PRD, not an implementation detail left to FAQ helpers:

- parse the editable field pattern, including repeatable `[]` segments;
- for every concrete field instance, resolve each declared `arrayItemIdentity` value from the same repeated item ancestry;
- build `identityKey` from `widgetType`, field role or field pattern, and declared identity values;
- fail the widget/instance boundary if an identity declaration is missing, resolves to a non-string/non-number value, or is duplicated for two current field instances;
- use array index only as current display/path position, never as durable translation identity.

For non-repeated fields, `identityKey` may be the field pattern plus role. For repeated fields, `identityKey` must survive reorder, insert, and delete.

### 2. Generic Saved Text Field

Tokyo extracts saved text into a widget-generic field model:

```ts
type SavedTextField = {
  identityKey: string;
  fieldPattern: string;
  path: string;
  type: 'string' | 'richtext';
  label: string;
  role: string;
  baseText: string;
};
```

`path` is where the value currently lives. `identityKey` is the durable field identity across reorder, insert, and delete.

The first execution slice must move generic primitive extraction from index-only concrete paths to this identity-bearing field model. FAQ-specific identity code may be used as comparison evidence, but not as the product implementation.

### 2A. Contract Version And Basis

Queue jobs and completion validation must include a widget contract basis that can detect stale or incompatible jobs.

The current schema `v: 1` is only the editable-fields schema version. It is not enough to identify a widget's authored contract content.

The generic job basis must include:

- editable-fields schema version;
- widget type;
- deterministic hash of the normalized `editable-fields.json` contract;
- current saved base text for each changed field identity;
- current concrete path for each changed field identity;
- target locale set used for readiness;
- generated job id.

If the editable-fields hash, field identity set, or changed field base text no longer matches at completion time, Tokyo must treat the completion as stale/superseded.

### 2B. Translated Value Storage Shape

Product APIs continue to expose translated locale values as exact current path maps because Bob preview and public materialization apply values by concrete path.

Internally, Tokyo must use identity-aware merge semantics before emitting that exact path map:

- current extraction produces `identityKey -> current path`;
- existing translated values are associated to identities where possible;
- moved fields carry translated values by identity to their new current path;
- deleted identities are removed;
- new identities require translation;
- the final stored/read value map for a locale contains only current concrete paths.

This PRD does not approve path-only merge semantics for repeated fields. If the current `instance.content.json` shape cannot preserve identity safely, the execution PRD must change the private content shape or add an approved identity index behind Tokyo operations.

### 3. Changed And Missing Pickup

For each target locale, Tokyo queues work when any generic field is:

- new;
- changed in base text;
- missing translated value;
- marked not ready;
- moved to a new path under the same stable identity;
- affected by deletion cleanup.

Partial readiness is invalid. A locale is ready only when every current field has both `localeStatus[locale] = ok` and a string translated value.

### 4. Queue Job Contract

The queue job must be widget-generic. It must not carry `FaqSavedTextField` or any FAQ-specific graph.

The generic queue payload must be shaped around saved text fields:

```ts
type GenericInstanceTranslationJob = {
  v: 2;
  kind: 'instance.translation.locale_values';
  jobId: string;
  accountId: string;
  accountPublicId: string;
  userId: string;
  instanceId: string;
  widgetType: string;
  widgetContract: {
    schemaVersion: 1;
    hash: string;
  };
  baseLocale: string;
  targetLocale: string;
  targetLocales: string[];
  requestedAt: string;
  requestId?: string;
  ai: unknown;
  budgets: unknown;
  changedFields: SavedTextField[];
  deletedIdentityKeys: string[];
  basis: {
    fields: Array<{
      identityKey: string;
      fieldPattern: string;
      path: string;
      baseText: string;
    }>;
  };
};
```

The exact TypeScript may evolve during execution, but these product facts may not: no FAQ graph types, no widget-specific text graph, no queue payload without identity keys, and no completion validation that trusts current array indexes.

### 5. San Francisco Runtime

San Francisco receives generic saved text fields and sends generic producer items to the model:

```text
path, type, label, role, value
```

San Francisco validates that the model returns exactly the changed paths. Deterministic validation failures are terminal and must call Tokyo failure immediately; they must not sit in retry loops.

### 6. Tokyo Completion

On completion, Tokyo re-extracts current generic saved text fields for the widget instance and validates the job basis.

If the job is current and the source basis still matches, Tokyo composes a complete locale value map:

- changed fields come from San Francisco output;
- unchanged fields carry forward existing translated values;
- deleted fields are removed;
- moved fields follow stable identity;
- every current field gets a string translated value before the locale is ready.

If the basis does not match, Tokyo rejects the completion as stale/superseded and the product state remains owned by the current generation.

### 7. Bob UX

Bob must not display internal queue math as product progress.

Bob displays:

- whether generation is queued/running/failed/completed according to Tokyo;
- how many languages are ready according to Tokyo readiness;
- which translated locales can be previewed;
- translated content review rows derived from the same widget contract.

Copy such as `Queued 0 of 28` is not acceptable because it exposes backend state and confuses readiness with queue progress.

Bob must also define no-work and unsupported states:

- if a widget has no authored customer-visible text, the Translations panel must not offer a misleading Generate action;
- if Tokyo rejects generation for an unsupported contract, Bob must show a boundary failure in product language, not a spinner or readiness count;
- if a generation is active, Bob reads Tokyo generation state on panel entry instead of relying only on local click state.

### 8. Catalog Scale

The generic system must work for hundreds of widgets without hand-coded translation registration.

Execution must either:

- prove that the current widget-definition registration path can scale and is guarded for every widget source; or
- introduce a generated/discovered widget definition registration step that is a build-time source index, not a product state authority.

In both cases, every widget source included in the product catalog must pass editable-fields validation and translation contract tests. A widget without translatable authored text must declare that intentionally rather than being silently skipped.

Execution decision: use a generated Tokyo-worker source index. `scripts/generate-widget-definition-sources.mjs` discovers `tokyo/product/widgets/*/spec.json`, writes `tokyo-worker/src/generated/widget-definition-sources.ts`, and `pnpm validate:widgets` fails when the checked-in source index is stale. This removes hand-coded widget registration from the translation/widget-definition runtime while preserving the DB Pivot rule that generated catalog/manifest files are not product authority.

## Blast Radius / Required Runtime Edits

Execution must account for these surfaces explicitly:

- `packages/ck-contracts/src/translated-value-primitives.ts` - add identity-bearing generic extraction and validation.
- `packages/ck-contracts/src/instance-translation-jobs.ts` - replace FAQ-shaped queue contract with generic job contract.
- Deleted `packages/ck-contracts/src/faq-language-values.ts`, its package export, its test, and the FAQ-only vertical verifier. FAQ remains a proof fixture inside the generic verifier, not a product translation contract.
- `tokyo-worker/src/domains/render/translation-operations.ts` - remove FAQ generation/completion gates and use generic extraction/job basis.
- `tokyo-worker/src/domains/render/translation-generation-state.ts` - keep generation summaries generic and never expose widget-specific graph state.
- `tokyo-worker/src/domains/render/saved-config.ts` - preserve translated values across repeated-item reorder by identity or introduce an approved private identity index.
- `tokyo-worker/src/domains/render/translated-locales.ts` and `public-artifacts.ts` - prove read/write/publish consume generic value maps for every supported widget.
- `tokyo-worker/src/domains/widget-catalog.ts` - remove or justify the hard-coded widget registration chokepoint so hundreds of widgets do not require translation runtime edits.
- `sanfrancisco/src/instance-translation-queue.ts` - consume generic saved text fields and report deterministic validation failures terminally.
- `sanfrancisco/src/l10n-account-routes.ts` - keep only generic primitive translation behavior below the queue boundary.
- `roma/lib/account-instance-translations.ts`, Roma translation API routes, and `roma/components/builder-domain.tsx` - preserve Roma as request/account boundary without building translation jobs.
- `bob/components/TranslationsPanel.tsx` - replace queue/readiness copy and bind panel state to Tokyo generation truth.
- `bob/lib/translations-preview.ts` and Bob compiled widget loading - keep preview/review driven by generic editable-fields contracts.
- widget source files under `tokyo/product/widgets/*/editable-fields.json` - validate every current and future widget contract.
- verification scripts and drift guards - block FAQ graph imports in Tokyo/SF product translation modules.

## Deletion Targets

Delete or demote from product boundaries:

- FAQ-specific translation job contracts;
- Tokyo generation gates that require `widgetType === 'faq'`;
- completion gates that require a FAQ graph;
- San Francisco queue contracts carrying `FaqSavedTextField`;
- Bob/Roma fallback copy that treats local spinner state as generation truth;
- any product path that infers translation readiness from overlay inventory, selected pointers, storage paths, or public artifact files.

FAQ-specific code may remain only as:

- a fixture for proving nested/repeated content behavior;
- an internal adapter while being replaced;
- test data for stable identity, changed pickup, and publish materialization.

It must not be the product boundary.

## Acceptance Criteria

- FAQ, Countdown, and Logo Showcase all pass the same Generate -> complete/fail -> preview -> publish translation path.
- A widget with no translatable authored text cannot show a misleading Generate path.
- Reordering repeated items preserves translation ownership by stable identity.
- Inserting and deleting repeated items queues only the correct fields and removes obsolete translated values.
- CTA labels and other non-Content-panel text translate if they are authored and visitor-visible.
- Bob never shows `Queued 0 of N` style copy.
- Tokyo is the only generation authority; SF terminal outcomes always report to Tokyo.
- Tests prove the generic path without importing FAQ-specific translation graph types into Tokyo/SF product operations.

## Local Implementation Readout - 2026-05-25

Implemented locally:

- identity-bearing generic saved text extraction in `packages/ck-contracts/src/translated-value-primitives.ts`;
- generic `InstanceTranslationJob` v2 in `packages/ck-contracts/src/instance-translation-jobs.ts`;
- Tokyo Generate/complete over generic widget contracts in `tokyo-worker/src/domains/render/translation-operations.ts`;
- identity-aware translated value preservation across repeated reorder/delete in `tokyo-worker/src/domains/render/saved-config.ts`;
- generic San Francisco queue consumption in `sanfrancisco/src/instance-translation-queue.ts`;
- Bob product-state copy and no-translatable-fields Generate boundary in `bob/components/TranslationsPanel.tsx`;
- generated Tokyo-worker widget source index guarded by `pnpm validate:widgets`.

Local proof:

- `pnpm -C tokyo-worker test` proves FAQ, Countdown, and Logo Showcase generic Generate/complete behavior where applicable, including Logo Showcase nested repeated fields;
- `pnpm -C bob test` proves Bob no longer relies on local spinner-only generation state and disables Generate for widgets without translation fields;
- `pnpm verify:prd103-publish-language-files` proves translated public artifacts for FAQ, Countdown, and Logo Showcase through DB-backed instance registry and Tokyo current translated values;
- `node scripts/verify/prd103j-generic-translation-guard.mjs` blocks FAQ graph/gate regressions in Tokyo/San Francisco product translation modules.

Not yet closed:

- authenticated cloud-dev Roma smoke still must prove open, save, Generate, translated preview, and publish with FAQ plus at least one non-FAQ widget before `103_DB.9` can close.

## Required Tests And Guards

- Generic contract extraction tests for FAQ, Countdown, and Logo Showcase.
- Stable identity tests for repeated reorder, insert, delete, duplicate IDs, and missing IDs, with Logo Showcase nested arrays as the required proof case.
- Tokyo Generate tests for FAQ, Countdown, and Logo Showcase using the same generic path.
- Tokyo completion tests proving moved repeated fields preserve translated values by identity.
- San Francisco queue tests proving deterministic validation errors report Tokyo failure immediately and do not retry until attempt 8.
- Bob tests replacing `Queued 0 of N` with product-state copy and proving unsupported/no-text states.
- Publish materialization tests for translated FAQ, Countdown, and Logo Showcase public files.
- Drift guard forbidding `FaqSavedTextField`, `FaqLanguageValue`, `buildFaqSavedTextGraph`, and `widgetType: 'faq'` in Tokyo/San Francisco product translation modules outside tests/fixtures/adapters.

## Execution Rule

Do not patch the existing FAQ path forward as the platform.

The first execution slice must introduce the generic saved-text extraction and queue contract, then move FAQ onto that contract. Only after FAQ works through the generic path should Countdown and Logo Showcase be enabled.
