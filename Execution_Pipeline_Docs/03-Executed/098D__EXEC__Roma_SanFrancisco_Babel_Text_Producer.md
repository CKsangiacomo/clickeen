# PRD 098D - Roma And San Francisco Babel Text Producer

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 4 of 6  
Depends On: 098A, 098B, 098C green

## Core Tenet: PRD 098 Truth Is The Only Truth

Roma and San Francisco must execute against the PRD 098 model only. Existing save/l10n flows that reference UUID account storage truth, `ins_*` instance IDs, widget-type storage folders, base fingerprints, wildcard paths, or op/text-pack generation must be replaced, not adapted.

The surviving product coordinate for generation is:

```text
accountPublicId + widgetCode + compactInstanceId + language + experiment=A01 + personalization=000
```

The surviving producer contract is:

```text
concrete primitive text variables in -> exact concrete primitive text values out
```

No compatibility call to old Tokyo sync, no old San Francisco op endpoint, no wildcard producer input, and no ID bridge is allowed. Existing pre-GA instances must be refactored to the new identity before this flow runs.

## Purpose

Move language generation to the correct product boundary.

Roma orchestrates after save. San Francisco produces exact text values. Tokyo stores. Bob later previews.

## Product Outcome

When a user saves a widget, language overlays are generated automatically for enabled account languages.

For FAQ, Italian/Czech/etc. must translate all declared text primitives, not only the title.

## Non-Negotiables

- Roma orchestrates save follow-up.
- Tokyo does not queue San Francisco.
- San Francisco receives concrete text variables, not wildcard paths and not widget JSON archaeology.
- San Francisco returns exact required path set: no more, no fewer.
- Missing path rejects generation for that language and names the path.
- Extra path rejects generation for that language and names the path.
- Base save success is not undone if one language production fails.
- Failed Czech must not block successful Italian.

## Product Flow

On `Save`:

1. Roma saves base config to Tokyo.
2. Roma reads account language policy from the account context.
3. Roma reads widget primitive graph.
4. Roma extracts concrete text variables from the saved config.
5. Roma calls San Francisco once per enabled non-base language.
6. San Francisco returns exact overlay values.
7. Roma asks Tokyo to write the overlay and selected pointer.
8. Roma returns base save result plus per-language follow-up result.

## New LOC Blast Radius

Expected new code is limited to:

- one Roma Babel save-follow-up orchestrator
- one Roma San Francisco client for exact text value production
- one San Francisco exact-value producer endpoint/handler
- typed request/response contracts imported from shared packages
- tests proving FAQ title/CTA/questions/answers are included

New code must not include:

- a job queue in Tokyo
- a producer registry
- incremental op merging
- wildcard expansion
- readiness/status truth
- a retry framework

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- Roma code that sends `l10nIntent`, `baseFingerprint`, or sync jobs to Tokyo
- San Francisco `LocalizationOp` and wildcard/incremental operation machinery
- old `generateAccountWidgetL10nOps` route/binding shape
- merge/delete helpers that exist only for old op-based l10n

Keep unrelated Prague marketing-copy translation only if it is explicitly outside widget overlays and not consumed by Prague widget runtime.

## Service Blast Radius

### `roma`

Affected files:

- `roma/app/api/account/instances/[instanceId]/route.ts`
- `roma/lib/account-instance-sync.ts`
- `roma/lib/account-l10n-intent.ts`
- `roma/lib/account-locales-sync.ts`
- `roma/lib/account-instance-direct.ts`
- `roma/lib/account-instance-translations.ts` later in 098E
- any San Francisco client helper

Delete:

- `enqueueTranslationAfterSave` as Tokyo queue delegation
- account instance sync intent that sends generation to Tokyo
- l10n base fingerprint request plumbing

Add:

- Babel producer client to San Francisco
- concrete primitive extraction from widget graph
- per-language producer call
- Tokyo overlay write call
- per-language follow-up result for the save response only; no durable readiness/status store

### `sanfrancisco`

Affected files:

- `sanfrancisco/src/l10n-account-routes.ts`
- `sanfrancisco/src/agents/l10nTranslationCore.ts`
- `sanfrancisco/src/index.ts`
- tests around translation routes

Delete:

- `LocalizationOp`
- wildcard pattern expansion
- changed/removed incremental op flow
- merge/delete helpers for old path operations
- `generateAccountWidgetL10nOps` route/binding shape

Add:

Target private endpoint shape:

```json
{
  "v": 1,
  "widgetType": "faq",
  "sourceLanguage": "en",
  "targetLanguage": "it",
  "items": [
    {
      "path": "sections.0.faqs.0.question",
      "value": "What rooms do you offer?"
    }
  ]
}
```

Target response:

```json
{
  "v": 1,
  "values": {
    "sections.0.faqs.0.question": "Che stanze offrite?"
  }
}
```

San Francisco may use internal prompts, but the API contract is exact values only.

Exactness rule:

- Roma sends the complete required concrete path set for the saved config.
- San Francisco must return exactly the same path set in `values`.
- Roma validates the returned set before calling Tokyo.
- Tokyo validates again at the storage boundary.
- Neither Roma nor Tokyo may drop extra paths, fill missing paths, or coerce values.

### `tokyo-worker`

Used only through 098C storage verbs.

Tokyo validates:

- caller auth
- account/widget/instance coordinate
- overlay ID contract/version allocation
- value path set against widget primitive contract
- policy caps

Tokyo does not generate.

### `bob`

Bob save result may receive per-language follow-up status from Roma. Bob preview changes in 098E.

### `berlin`

No new behavior beyond account locale policy already available to Roma.

## Implementation Steps

1. Replace Roma translation-after-save delegation with a local Babel orchestrator.
2. Use the saved config returned by Tokyo as the source for concrete text extraction.
3. For each enabled non-base language, call San Francisco with exact text primitive items.
4. Validate San Francisco response against required path set in Roma before calling Tokyo.
5. Send successful language value maps to Tokyo overlay storage.
6. Return per-language follow-up result in the save response only.
7. Delete Roma code that sends `l10nIntent`, `baseFingerprint`, or sync jobs to Tokyo.
8. Replace San Francisco route contract with exact value producer.
9. Delete San Francisco wildcard/op/merge code.
10. Add integration tests for FAQ Q/A translation coverage.
11. Add a `test` script to `sanfrancisco/package.json` if absent, covering exact path-set validation and route contract.

## UX And Product Notes

- Save button means "save base widget now".
- Language generation is follow-up work. It can fail per language without undoing base save.
- UI should show language follow-up only as operational information, never as overlay truth.
- A language is previewable only after selected-overlay exists in Tokyo.
- No stale translated text from a previous save may be shown as current.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/services/roma.md`
  - Update save flow: Roma saves base config to Tokyo, extracts concrete primitives, calls San Francisco, then asks Tokyo to store overlay values.
  - Remove statements that account-widget l10n generation uses Tokyo-worker private binding as the producer path.
  - Document per-language follow-up result as save-response UI information only, not durable overlay truth.
- `documentation/services/sanfrancisco.md`
  - Replace old l10n op-generation contract with exact text value producer contract.
  - State San Francisco receives concrete primitive variables and returns exact values only.
- `documentation/ai/infrastructure.md`
  - Update San Francisco agent responsibility: value production only; no storage, no wildcard expansion, no account overlay lifecycle.
- `documentation/architecture/BabelProtocol.md`
  - Update execution flow to Roma-orchestrated save follow-up and exact path-set validation.
- `documentation/architecture/CONTEXT.md`
  - Update Product-Path Account Editing localization/live follow-up to say Roma orchestrates and Tokyo stores.
- `documentation/capabilities/localization.md`
  - Document product behavior: base save succeeds independently; language failures are per-language follow-up.
- `documentation/strategy/Clickeen-Babel.md`
  - Update Babel description if it still implies queue/status/text-pack mechanics.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/sanfrancisco test
pnpm typecheck
```

Required scans:

```bash
rg -n "enqueueAccountInstanceSync|AccountInstanceSyncIntent|l10nIntent|baseFingerprint|generateAccountWidgetL10nOps|LocalizationOp|expandPathPatterns|deleteMergedByPathOrPattern|L10nOp" roma sanfrancisco
rg -n "wildcard|\\[\\*\\]|textPack|readyLocales" roma sanfrancisco
```

## Execution Result

Executed on 2026-05-14.

What changed:

- Roma now orchestrates Babel text generation after a successful base save.
- Roma reads account language policy from Berlin, extracts concrete text primitives from the widget primitive graph, calls San Francisco per target language, validates the exact returned path set, and writes successful language overlays through Tokyo's 098C storage verbs.
- San Francisco now exposes an exact text-value producer endpoint and no longer emits localization ops, wildcard path operations, or Tokyo storage intents.
- Tokyo remains a PBX/storage boundary for this slice: no San Francisco queueing, no text production, no old sync job.
- Roma translation reads now return selected overlay IDs and exact value maps, not readiness/status/text-pack truth.
- Documentation was updated for Roma, San Francisco, AI infrastructure, Babel protocol, localization behavior, and Babel strategy.

Deleted/replaced:

- Roma `account-instance-sync`, `account-locales-sync`, and `account-l10n-intent` flow.
- San Francisco account-widget localization op/wildcard contract.
- Tokyo-worker account-widget l10n route/binding references from the Roma/San Francisco generation path.

Verification passed:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/sanfrancisco typecheck
pnpm --filter @clickeen/sanfrancisco test
pnpm typecheck
rg -n "enqueueAccountInstanceSync|AccountInstanceSyncIntent|l10nIntent|baseFingerprint|generateAccountWidgetL10nOps|LocalizationOp|expandPathPatterns|deleteMergedByPathOrPattern|L10nOp" roma sanfrancisco
rg -n "wildcard|\\[\\*\\]|textPack|readyLocales" roma sanfrancisco
```

The two required scans returned no matches.

Manual/product smoke:

- open FAQ in Builder
- edit a question
- save
- confirm Roma calls San Francisco with the edited question value
- confirm Tokyo receives complete values for the target language
- confirm failed language result does not fail base save

## Stop Conditions

Stop immediately if:

- Roma needs Tokyo to decide what text changed
- San Francisco receives wildcard paths
- San Francisco returns ops instead of values
- a failed language causes base save rollback
- code adds another readiness/status truth for overlay selection

## Definition Of Done

- Save triggers automatic language value production from Roma.
- San Francisco is a value producer, not an op merger.
- Tokyo stores produced values through PBX verbs.
- FAQ Q/A text is included in the producer request and response.
