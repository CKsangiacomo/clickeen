# PRD 098 - Overlay Primitive And Locales First Application

Status: Executed  
Owner: Product + Architecture  
Date: 2026-05-14

PRD 103_00 NOTE: this PRD remains historical context for why overlays existed, but its UI/Roma selected-overlay, overlay object path, overlay ID as product contract, and published-projection language is superseded for PRD 103 by translated-locale product operations in `Execution_Pipeline_Docs/02-Executing/103_00__EXEC__Pre_103_Architecture_Gate.md`.

## Purpose

Clickeen returns to the original product truth: a widget is software declared as data.

Each widget declares its primitive variable graph once. ToolDrawer, Copilot, Babel, Tokyo, Bob preview, and Venice runtime all work from that same graph. A producer may change declared primitive values. A consumer may apply declared primitive values. No surface invents a second schema for the same widget.

Babel v1 is the first application: language overlays for text variables.

## Core Tenet: OverlayID Is The Overlay SKU

An overlay is a SKU-like object. The `overlayId` is the only overlay identity.

There is no second overlay name. There is no separate value name. There is no indirection from `overlayId` to another object name. Tokyo must not open overlay bodies to understand what an overlay is.

The physical overlay object lives at:

```text
overlays/{overlayId}.json
```

The overlay body is only:

```json
{
  "v": 1,
  "values": {}
}
```

The body must not repeat account ID, widget code, instance ID, language, experiment coordinate, personalization coordinate, version, checksum, job state, lifecycle state, or product meaning.

The `overlayId` is a fixed-layout code:

```text
[account][widget][instance][language][experiment][personalization][version][checksum]
```

Segments:

```text
account          8 uppercase base36 chars; canonical compact account ID
widget           3 uppercase base36 chars; platform-owned widget code
instance         10 uppercase base36 chars; canonical compact instance ID
language         4 uppercase base36 chars; platform-owned Babel language coordinate
experiment       3 uppercase base36 chars; default A01
personalization  3 uppercase base36 chars; PRD 098 writes 000
version          2 digits; 00 through 99, then wraps
checksum         2 uppercase base36 chars; typo/corruption guard, not security
```

PRD 098 is widget-only. Do not rename this segment. Future non-widget work gets its own PRD after widget overlays work.

The full ID is 35 characters and is parsed by fixed offsets only:

```text
0..7    account
8..10   widget
11..20  instance
21..24  language
25..27  experiment
28..30  personalization
31..32  version
33..34  checksum
```

There are no delimiters and no lowercase characters. The parser rejects anything outside `0-9A-Z`.

The checksum algorithm is shared by every service:

```text
CRC-16/XMODEM over the first 33 characters
take the result modulo 1296
encode the number as two uppercase base36 chars, zero-padded
```

Bob, Roma, Tokyo, and Venice must use the same shared implementation. No service may implement its own local variant.

Execution blocker:

- Account and instance segments must be real canonical platform IDs.
- They must not be derived, truncated, transformed, or compacted from UUIDs or `ins_...` strings at overlay-write time.
- A helper that maps current IDs into overlay ID segments is a hidden second identity system and is forbidden.
- If the platform does not yet have canonical compact account and instance IDs, PRD 098C does not proceed until that product identity decision is made and implemented.
- Widget code and language code are platform codebook values. They must be declared in a single shared contract, not invented in individual services.

The version segment is not value meaning. It is a small local version slot inside one overlay coordinate. Retained versions are capped by account policy, using `l10n.versions.max`. If the next version would overwrite an overlay still referenced by selected-overlay or published projection records, the write fails visibly at the overlay ID boundary.

Selected-overlay and published projection records decide what is active. Version number does not decide currentness.

## Core Tenet: Primitive Value Graph

Every widget declares what can change and how.

That declaration is the surviving authority for:

- ToolDrawer controls
- Copilot edits
- Babel language production
- future personalization and experiment producers
- Tokyo validation
- Bob preview resolution
- Venice runtime resolution

No producer or consumer may invent a path that is not declared by the widget primitive variable graph. This is the rule that prevents translation, Copilot, runtime, and editor from becoming separate products.

## Core Tenet: Tokyo Is PBX

Tokyo-worker is a PBX, not a brain.

It receives a call, authenticates it, routes it to the right storage operation, and returns the answer. It does not translate, infer, repair, generate, reason about readiness, or rediscover product meaning from JSON bodies.

Tokyo may:

- validate an `overlayId` layout
- write `overlays/{overlayId}.json`
- read `overlays/{overlayId}.json` by exact ID
- write selected-overlay records that point to `overlayId`
- write published projections that point to `overlayId`
- enforce account policy caps

Tokyo must not:

- queue San Francisco work
- translate text
- normalize producer output
- infer missing values
- drop extra values
- scan overlay bodies to classify overlays
- maintain a second readiness/status truth for overlays
- create route frameworks or generic workflow engines

Roma orchestrates product work. San Francisco produces values. Tokyo stores and routes. Venice serves the published projection.

## Core Tenet: No Self-Checking Product Truth

The system must not check, heal, normalize, or reinterpret values produced by the system itself after they have crossed the named boundary.

Valid boundaries:

- widget contract validation before sending producer work
- producer response validation before writing an overlay
- `overlayId` parser validation before storage
- account policy enforcement before write

Invalid patterns:

- "ready" flags deciding whether selected content is usable
- runtime fallbacks from one overlay to another
- body scanning to rediscover account/widget/language
- partial overlays treated as selectable
- old l10n readers kept alive as compatibility shims
- system-generated JSON being repaired by another system-generated JSON reader

If producer output is wrong, reject it and name the concrete path. Do not fix it.

## Product Model

Base config is the current saved widget instance.

Overlay values are primitive value changes for that same widget graph.

Resolved widget equals:

```text
base config + one overlay value map
```

PRD 098 ships only the two-argument resolver:

```text
resolveOverlay(baseConfig, overlayValues)
```

Multi-layer composition is out of scope. Locale plus geo plus experiment plus personalization is a later PRD after the single-overlay model is correct.

## Language Overlay Model

Locales are text overlays.

For FAQ, Babel v1 must translate every declared text primitive:

- title
- CTA text
- section labels
- every question
- every answer
- any other FAQ-owned text primitive declared by the widget

There is no wildcard path sent to San Francisco. The producer receives concrete primitive variables and returns concrete primitive values.

The producer response must contain the exact required path set: no more, no fewer. Extra path means reject and name the path. Missing path means reject and name the path.

## Storage Model

Account-private selected language overlay:

```text
accounts/{accountId}/widgets/{widgetCode}/{instanceId}/selected-overlays/{language}/{experiment}/{personalization}.json
```

Selected-overlay body:

```json
{
  "overlayId": "..."
}
```

Overlay object:

```text
overlays/{overlayId}.json
```

Overlay object body:

```json
{
  "v": 1,
  "values": {
    "path.to.primitive": "value"
  }
}
```

Published projection:

```json
{
  "base": {},
  "overlays": {
    "languages": {
      "it": "..."
    }
  }
}
```

No authoritative mutable per-instance overlay index ships in PRD 098. If an index appears later, it is a derived cache only and never the authority for selecting or publishing an overlay.

## Save To Language Generation

When a user saves a widget:

1. Roma saves the base widget config to Tokyo.
2. Roma reads the widget primitive variable graph.
3. Roma extracts concrete text primitives for each enabled language.
4. Roma calls San Francisco for each language.
5. San Francisco returns the exact primitive value map for that language.
6. Roma asks Tokyo to validate the response and write `overlays/{overlayId}.json`.
7. Tokyo writes or replaces the selected-overlay pointer for that language coordinate.
8. Bob may preview the selected language overlay after the pointer exists.

Tokyo does not queue San Francisco. Tokyo stores the result.

Multiple languages are independent. A failed Czech production must not block Italian if Italian succeeded. Publish does not wait for in-flight production; it projects the base widget and selected overlay IDs that exist at publish/sync time.

## Version Discipline

The version segment runs `00` through `99`.

The account policy cap decides how many old language overlay versions are retained. Current policy key:

```text
l10n.versions.max
```

Current matrix:

```text
free  = 1
tier1 = 3
tier2 = 5
tier3 = 10
```

The retention cap is per exact coordinate:

```text
account + widget + instance + language + experiment + personalization
```

Future experiment or personalization PRDs must budget the multiplication explicitly before enabling more coordinates.

An overlay object is referenced if its `overlayId` appears in any selected-overlay record, any current published projection record, or any archived published projection record.

On write:

- choose the next version slot for that exact account/widget/instance/language/experiment/personalization coordinate
- keep only the policy-allowed retained versions
- never delete an overlay object still referenced by selected-overlay or published projection records
- if wrap would overwrite a referenced object, fail visibly instead of guessing

## Bob Preview

Bob previews one active language at a time.

If no selected overlay exists for the selected language, Bob shows the base language and an honest producer-progress message from a separate operational read model if needed. That operational read model is UI progress only. It must not decide overlay selectability.

Bob must never show stale translated values from a previous base save as if they apply to the current saved widget.

## Venice Runtime

Venice serves only published projection truth.

Venice receives a base config and selected overlay IDs from the published projection, reads exact overlay objects by ID, applies values with `resolveOverlay(baseConfig, overlayValues)`, and returns the resolved widget.

Venice must not read account-private selected-overlay records. Venice must not search for overlays. Venice must not decide readiness. Venice must not fall back to stale overlays.

## Prague Disposition

Prague is not account authoring truth.

Any Prague localization or demo path that duplicates Babel language logic is deleted or routed through the same published Venice runtime contract. Prague must not keep its own base fingerprint, wildcard localization, or text override model.

## Surviving Authorities

098A confirmed these authorities before implementation:

| Concern | Surviving authority |
| --- | --- |
| Widget primitive variable graph | The widget-owned declaration in `tokyo/product/widgets/{widgetType}/spec.json`; any generated helper must be derived from it. |
| Base widget config | Tokyo account instance config at `accounts/{accountId}/widgets/{widgetType}/{instanceId}/config.json`. |
| Selected language overlay | Account-private selected-overlay record pointing to `overlayId`. |
| Overlay object | `overlays/{overlayId}.json` with body `{ "v": 1, "values": {} }`. |
| Published runtime overlay selection | Published projection names selected overlay IDs. |
| Producer progress UI | Optional Roma/Bob operational read model only; never overlay truth and never read by Venice. |
| Language labels and locale codebook | Platform-owned locale codebook; it does not define widget variable paths or overlay storage. |

## 098A Kill List

098A found the current pre-GA localization system is active across product surfaces and must be hard-cut. These files/functions are deletion or replacement targets in 098B-098E.

| Path | Function/type/constant | Why it dies | Replacement authority | Slice |
| --- | --- | --- | --- | --- |
| `tokyo/product/widgets/*/localization.json` | entire file | Separate wildcard path schema duplicates widget truth and misses concrete FAQ paths. | Widget primitive graph in `spec.json`. | 098B |
| `packages/l10n/src/index.ts` | `AllowlistEntry`, `AllowlistItem`, `AllowlistValue`, `collectAllowlistedEntries`, `buildL10nSnapshot`, `computeBaseFingerprint`, layer constants | Package currently owns wildcard extraction, layered overlay theory, and base snapshot identity. That is no longer overlay truth. Locale-codebook helpers may survive; widget paths must not. | Widget primitive graph + exact overlay values. | 098B |
| `tokyo-worker/src/domains/render/localization.ts` | `loadWidgetLocalizationAllowlist`, `ensureSavedRenderL10nBase`, `loadSavedRenderL10nBase` | Builds base snapshots from `localization.json` and stores base fingerprint state. | Roma extracts concrete text primitives from widget graph. | 098B/098C |
| `tokyo-worker/src/domains/l10n-authoring.ts` | `L10nOp`, `upsertL10nOverlay`, `normalizeTextPack`, `deletePrefix` | Writes old `overlays/l10n/{locale}/overlay.json` documents with status, ops, base fingerprint, and text packs. | Tokyo writes `overlays/{overlayId}.json` and selected-overlay pointers. | 098C |
| `tokyo-worker/src/domains/account-localization-state.ts` | `loadOverlayOps`, `generateAccountWidgetL10nOps`, `loadAccountTranslationsPanelData`, `normalizeTextPack` | Tokyo calls San Francisco, merges ops, computes ready locales, and serves text packs. That makes Tokyo orchestrator and status owner. | Roma calls San Francisco; Tokyo stores exact overlay objects; Bob reads selected overlay values. | 098C/098D |
| `tokyo-worker/src/domains/account-instance-sync.ts` | `SyncL10nIntent`, `diffL10nSnapshots`, `buildApprovedTranslationItems`, `resolveTranslationCompletion`, `syncAccountInstance`, `enqueueAccountInstanceSyncJob`, `runQueuedAccountInstanceSync` l10n branches | Tokyo queues generation, performs incremental diffing, and writes status/ready locale truth. | Roma save follow-up orchestrates language production; Tokyo PBX stores results. | 098C |
| `tokyo-worker/src/domains/render/packs.ts` | `writeTextPack` | Rewrites old text pack shape into old overlay path. | `writeOverlayObject` style storage at `overlays/{overlayId}.json`. | 098C |
| `tokyo-worker/src/domains/render/keys.ts` | `accountInstanceL10nBaseSnapshotKey`, `accountInstanceL10nOverlayKey`, `accountInstanceL10nOverlayPrefix` | Old storage paths encode l10n state and locale folders instead of overlay IDs. | `overlays/{overlayId}.json` and selected-overlay records. | 098C |
| `tokyo-worker/src/domains/render/types.ts` | `LocalePolicy.readyLocales`, `AccountInstanceDocument.l10n` status fields, `L10nOverlayDocument`, `WriteTextPackJob`, `SyncInstanceOverlaysJob` | Types encode old readiness, base fingerprint, ops, and text pack state. | Overlay ID projection plus optional producer progress outside overlay truth. | 098C/098E |
| `tokyo-worker/src/domains/render/saved-config.ts` | `deriveL10nBase`, l10n base/status writes | Save path derives old base localization state while saving config. | Save stores base config; Roma separately orchestrates Babel follow-up. | 098C |
| `tokyo-worker/src/queue-handler.ts` | `sync-instance-overlays`, `writeTextPack` branches | Queue makes Tokyo the producer orchestrator. | Roma orchestrates; Tokyo stores. | 098C |
| `tokyo-worker/src/types.ts` | `SANFRANCISCO_L10N` binding shape for `generateAccountWidgetL10nOps` | Tokyo must not own San Francisco language generation calls. | Roma-to-San Francisco orchestration contract. | 098C |
| `roma/lib/account-instance-sync.ts` | `enqueueAccountInstanceSync`, `AccountInstanceSyncIntent` | Roma currently asks Tokyo to queue l10n work. | Roma calls San Francisco directly, then calls Tokyo storage verbs. | 098C |
| `roma/app/api/account/instances/[instanceId]/route.ts` | `enqueueTranslationAfterSave` current Tokyo queue path | Save follow-up delegates generation to Tokyo. | Save follow-up orchestrates Babel directly from Roma. | 098C |
| `roma/lib/account-instance-translations.ts` | `AccountTranslationsPanelPayload`, `loadAccountInstanceTranslationsPanel`, `normalizeTranslationsPanelPayload` | Reads old ready-locale/text-pack panel payload. | Reads selected-overlay pointer and overlay values by overlayId. | 098D |
| `roma/app/api/account/instances/[instanceId]/translations/route.ts` | existing GET response shape | Route returns old text-pack/status shape. | Route returns selected overlay values for preview plus separate producer progress if needed. | 098D |
| `bob/components/useTranslationsPreviewState.ts` | `TranslationsPreviewData`, `normalizePreviewData` | Client model is ready locales plus text packs. | Client model is selected overlay values plus optional progress. | 098D |
| `bob/components/BuilderApp.tsx` | `translationTextPacks`, polling on old status | Bob depends on old status and text pack truth. | Bob uses selected overlay values; progress is separate UI only. | 098D |
| `bob/components/Workspace.tsx` | `translationTextPacks`, `effectiveTranslationTextPack` | Preview sends old text pack into iframe. | Preview sends resolved overlay values or resolved config from shared resolver. | 098D |
| `bob/components/TranslationsPanel.tsx` | ready-locale/status copy | UI teaches users old readiness model. | UI exposes selected language overlay availability without making status truth. | 098D |
| `venice/app/widget/[instanceId]/route.ts` | `applyTextOverrides`, old `/l10n/widgets/.../overlay.json` read | Runtime applies text packs and decides overlay validity. | Published projection names overlay IDs; Venice applies values with resolver. | 098E |
| `venice/app/embed/runtime-locale.ts` | `readyLocales` runtime selection | Runtime locale selection depends on old ready-locale truth. | Published projection language map. | 098E |
| `venice/lib/tokyo.ts` | l10n overlay cache branches | Venice knows old l10n URL shape. | Overlay IDs in published projection. | 098E |
| `venice/README.md` | l10n route documentation | Documents old public l10n proxy. | Venice overlay runtime contract. | 098E |
| `prague/src/lib/pragueL10n.ts` | `PragueOverlay`, `LayerIndex`, `fetchLayerIndex`, `fetchOverlay`, `applyPragueLayeredOverlaysWithMeta` | Prague owns a separate layered localization system. | Prague routes through published Venice/runtime contract or deletes divergent path. | 098E |
| `sanfrancisco/src/l10n-account-routes.ts` | `LocalizationOp`, `generateAccountWidgetL10nOps`, incremental changed/removed path flow | Producer emits ops and handles old incremental patching. | Producer receives exact concrete primitive variables and returns exact values. | 098C |
| `sanfrancisco/src/agents/l10nTranslationCore.ts` | `expandPathPatterns`, `deleteMergedByPathOrPattern`, op merge helpers | Producer supports wildcard/incremental ops. | Exact required path set, no merge, no wildcard. | 098C |
| `sanfrancisco/src/index.ts` | `generateAccountWidgetL10nOps` binding | Existing binding name/shape returns ops. | Babel value producer contract. | 098C |
| `sanfrancisco/src/agents/l10nPragueStrings.ts` | Prague string l10n agent path | Separate Prague translation architecture. | Out of product path unless Prague explicitly routes through new runtime contract. | 098E |

## Deletion Targets

PRD 098 deletes the old pre-GA localization system instead of migrating it.

Deletion targets include:

- wildcard localization path declarations
- text pack readers/writers
- base fingerprint product logic
- `L10nOp[]` authoring formats
- old text override application paths
- stale ready-locale truth
- compatibility readers for old pre-GA overlay storage
- duplicate Prague localization flow

If a cloud-dev instance needs language values after the hard cut, regenerate them through the new Babel path.

## Non-Negotiables

- `overlayId` is the only overlay identity.
- Overlay objects live at `overlays/{overlayId}.json`.
- Overlay object bodies contain only `{ "v": 1, "values": {} }`.
- No second overlay name exists.
- No selected-overlay record points to anything except `overlayId`.
- No published projection points to anything except `overlayId`.
- No producer receives wildcard paths.
- No producer receives widget JSON archaeology.
- Producer output must be the exact required path set.
- Extra producer paths are rejected and named.
- Missing producer paths are rejected and named.
- No value normalization in the overlay write path.
- No value healing in the overlay write path.
- No value coercion in the overlay write path.
- No inferred missing values.
- No dropped unknown values.
- No partial overlay is selectable.
- No stale overlay is selectable.
- No readiness/status flag is overlay truth.
- No runtime fallback from one overlay to another.
- No compatibility shim for old pre-GA language formats.
- No route DSL.
- No global Result rewrite.
- No new package.
- No schema validation framework.
- No error class hierarchy.
- No multi-layer resolver in PRD 098.
- No Tokyo producer orchestration.
- No Tokyo body scanning to understand overlays.
- No authoritative mutable overlay index.

## Sub-PRDs

Execution happens through sub-PRDs in `Execution_Pipeline_Docs/02-Executing`:

- `098A` Evidence and kill list
- `098B` Widget primitive contract and single-overlay resolver
- `098C` Locale overlay generation
- `098D` Builder preview uses overlay resolver
- `098E` Venice runtime uses overlay resolver
- `098F` Docs and guards

Each sub-PRD must preserve this PRD's tenets. If a sub-PRD reintroduces secondary overlay identity, status truth, old l10n compatibility, or Tokyo orchestration, the sub-PRD is wrong.

## Verification

PRD 098 cannot close until:

- FAQ language production covers title, CTA, section labels, questions, answers, and all declared text primitives.
- A saved edit triggers automatic language overlay regeneration through Roma orchestration.
- Bob preview shows the selected language only after selected-overlay points to a complete overlay object.
- Venice serves published language overlays from overlay IDs in the published projection.
- Prague has no independent language override path.
- Repository scans show no old wildcard/text pack/base fingerprint localization path remains on product surfaces.
- PRD and guard scans show no secondary overlay identity model has been reintroduced.

## End State

Clickeen has one widget primitive variable graph.

Manual editing, Copilot, Babel, Tokyo, Bob preview, and Venice runtime all work on that graph.

Languages are fast text overlays. Overlay IDs are SKU-like product object IDs. Tokyo is PBX. Venice serves published truth. The system stops fighting itself.
