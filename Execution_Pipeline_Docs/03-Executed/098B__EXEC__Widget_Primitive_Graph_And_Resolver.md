# PRD 098B - Widget Primitive Graph And Resolver

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 2 of 6  
Depends On: 098A green

## Core Tenet: PRD 098 Truth Is The Only Truth

PRD 098 is a hard-cut refactor. Existing pre-GA widget declarations, localization sidecars, old instance IDs, old account storage paths, and old runtime assumptions must be moved to the PRD 098 model or deleted.

The old product identity/storage shape:

```text
uuid accountId + widgetType folder + ins_* instanceId + localization.json/textPack paths
```

does not survive as product truth.

The surviving model is:

```text
accountPublicId + widgetCode + compactInstanceId + spec.json primitive graph + overlayId
```

No compatibility reader, path adapter, wildcard sidecar, dual schema, or old-path support is allowed. If an existing widget/instance does not fit this model, refactor it to the new truth or discard it.

## Purpose

Make each widget declare its primitive variable graph once, then delete wildcard localization declarations.

This slice creates the shared contract used by ToolDrawer, Copilot, Babel, Tokyo validation, Bob preview, and Venice runtime.

## Product Outcome

For FAQ, the system can identify every text primitive that must be translated:

- title
- CTA text
- section labels
- every question
- every answer
- all other declared FAQ-owned text

The title-only translation bug dies here because translation no longer has a separate path schema.

## Non-Negotiables

- Widget primitive graph is widget-owned.
- No `localization.json`.
- No wildcard path is sent to San Francisco.
- No producer or consumer invents paths outside the primitive graph.
- No multi-layer resolver.
- No schema framework.
- No value normalization, coercion, inference, or repair.
- No body scanning to rediscover product meaning.

## Surviving Authority

`tokyo/product/widgets/{widgetType}/spec.json` is the source for the primitive variable graph.

Generated helpers may exist only if they are built from widget source and checked by a build script.

## New LOC Blast Radius

Expected new code is limited to:

- widget primitive graph declarations in `spec.json`
- shared primitive graph reader/extractor/resolver tests in `@clickeen/ck-contracts`
- small contract helpers needed by later Roma, Tokyo, Bob, and Venice slices

New code must not include:

- a second schema file beside `spec.json`
- a schema validation framework
- a producer registry
- a multi-overlay resolver
- a compatibility reader for old localization sidecars

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- `tokyo/product/widgets/*/localization.json`
- widget `layers/*.allowlist.json` files used only by old l10n
- `@clickeen/l10n` wildcard allowlist/path extraction/base snapshot/fingerprint exports
- agent docs that teach producers to use localization sidecars

Keep locale labels and locale parsing helpers if they are independent of widget path extraction.

## Service Blast Radius

### `tokyo/product/widgets`

Affected files:

- `faq/spec.json`
- `countdown/spec.json`
- `logoshowcase/spec.json`
- any remaining `localization.json`
- any widget `agent.md` that describes translation/editable paths

Required shape:

```json
{
  "overlays": {
    "v": 1,
    "text": [
      {
        "path": "title",
        "label": "Title"
      }
    ]
  }
}
```

Collections must be declared in a way that resolves to concrete saved config paths before producer calls. San Francisco never receives wildcard notation.

Contract rule for collections:

- The widget declaration may describe a repeatable collection only as a way to extract concrete paths from the current saved config.
- The extracted producer payload must contain concrete paths such as `sections.0.faqs.0.question`.
- The producer payload must never contain wildcard, glob, or template paths.

### `packages/ck-contracts`

Own shared functions:

- read widget overlay contract from `spec.json`
- expand text primitives against a saved base config into concrete paths
- validate producer output is exact required path set
- apply one overlay value map to base config with `resolveOverlay(baseConfig, overlayValues)`

The resolver is intentionally only:

```text
base + one overlay
```

It must not accept arrays of overlays or precedence layers.

### `packages/l10n`

Reduce `@clickeen/l10n` to locale data only.

Allowed to keep:

- supported locale data
- locale label helpers
- locale parsing helpers used by account settings

Must not keep:

- wildcard allowlist entry types
- base snapshot builder
- base fingerprint logic
- overlay layer constants
- widget path extraction

### `bob`

No UX change in this slice. Bob will use the graph in 098E. This slice only ensures the graph can support Bob later.

### `roma`

No save orchestration in this slice. Roma will use extraction in 098D.

### `tokyo-worker`

No storage behavior in this slice. Tokyo will validate overlay values in 098C using this shared contract.

### `sanfrancisco`

No route shape change in this slice. Producer input changes in 098D.

### `venice`

No runtime change in this slice. Runtime uses `resolveOverlay` in 098F.

## Implementation Steps

1. Add `overlays.v = 1` text primitive declarations in every current widget `spec.json`.
2. Ensure FAQ text primitives include every customer-visible text field, especially repeated Q/A fields.
3. Delete all widget `localization.json` files.
4. Delete widget layer allowlist files that exist only for the old overlay system.
5. Move shared overlay contract and resolver into `@clickeen/ck-contracts`.
6. Remove widget path extraction from `@clickeen/l10n`; keep locale labels only.
7. Update widget `agent.md` files to reference the primitive graph, not localization sidecars.
8. Add tests that extract FAQ concrete paths from a real saved config and prove questions/answers are present.
9. Add tests that producer output with extra or missing paths is rejected with the concrete path named.
10. Add tests for `resolveOverlay(base, values)` on nested FAQ Q/A text.
11. Update `packages/l10n` tests/types if exports are removed.

## UX And Product Notes

- Translation UI may remain unavailable until later slices.
- This slice must not create a fake "translation ready" experience.
- This slice should not change ToolDrawer controls unless the spec currently omits text primitives that ToolDrawer already edits.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/widgets/WidgetArchitecture.md`
  - Replace old widget contract lists that include `localization.json` / `layers/*.allowlist.json` as active widget translation authority.
  - Document that `spec.json` owns the widget primitive variable graph.
- `documentation/widgets/WidgetBuildContract.md`
  - Add the `overlays.v = 1` text primitive declaration contract and collection-to-concrete-path rule.
  - State that producers never receive wildcard/template paths.
- `documentation/widgets/WidgetAgentGuide.md`
  - Update agent/widget authoring guidance so new widgets declare editable/translatable primitives in `spec.json`, not sidecars.
- `documentation/architecture/CONTEXT.md`
  - Update the Widget Architecture and `spec.json` glossary sections to include primitive graph authority.
  - Remove active-truth references to widget-owned `localization.json` and l10n allowlist sidecars.
- `documentation/architecture/OverlayArchitecture.md`
  - Document primitive graph authority and the single-overlay `resolveOverlay(baseConfig, overlayValues)` model.
- `documentation/architecture/BabelProtocol.md`
  - Replace allowlist/snapshot/fingerprint language with concrete primitive extraction from `spec.json`.
- `documentation/capabilities/localization.md`
  - Update locale/Babel capability docs so language values come from concrete text primitives, not wildcard allowlists.
- Widget docs for current widgets:
  - `documentation/widgets/FAQ/FAQ_PRD.md`
  - `documentation/widgets/Countdown/Countdown_PRD.md`
  - `documentation/widgets/LogoShowcase/LogoShowcase_PRD.md`
  - Document each widget's PRD 098 text primitive coverage or explicitly state the widget is WIP but still declares the contract.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/ck-contracts test
pnpm --filter @clickeen/ck-contracts typecheck
pnpm --filter @clickeen/l10n typecheck
pnpm --filter @clickeen/l10n test
pnpm build:widgets:check
pnpm typecheck
```

Required scans:

```bash
find tokyo/product/widgets -name localization.json -o -path "*/layers/*.allowlist.json"
rg -n "AllowlistEntry|AllowlistItem|collectAllowlistedEntries|buildL10nSnapshot|computeBaseFingerprint|baseFingerprint|L10nOp|textPack|readyLocales" packages tokyo/product/widgets
rg -n "wildcard|\\*\\]|\\[\\*\\]" tokyo/product/widgets packages/ck-contracts packages/l10n
```

Expected:

- no widget localization sidecars
- no wildcard localization contract
- no old snapshot/fingerprint/text pack model in shared packages

## Stop Conditions

Stop immediately if:

- FAQ repeated questions/answers cannot be resolved to exact paths
- a widget needs a second translation schema to explain its text
- a producer output validator silently drops extra paths
- resolver starts accepting layered overlay arrays

## Definition Of Done

- The widget primitive graph is declared once per widget.
- FAQ exact text primitive extraction covers all displayed text.
- `resolveOverlay(base, values)` is shared and tested.
- Old widget localization sidecars are gone.

## Execution Result

Completed.

Code changes:

- Added `spec.json.overlays.v = 1` text primitive declarations for FAQ, Countdown, and LogoShowcase.
- Deleted all current widget `localization.json` files and old widget layer allowlist sidecars.
- Added shared primitive graph extraction, exact producer value validation, and single-overlay resolver in `@clickeen/ck-contracts`.
- Reduced `@clickeen/l10n` to locale registry/helpers only.
- Updated temporary old-flow consumers so shared package truth no longer exports widget path extraction.
- Updated widget agent docs and required architecture/widget/localization docs to point at `spec.json` primitive graph authority.

Verification:

- `pnpm --filter @clickeen/ck-contracts test`
- `pnpm --filter @clickeen/ck-contracts typecheck`
- `pnpm --filter @clickeen/l10n typecheck`
- `pnpm --filter @clickeen/l10n test`
- `pnpm build:widgets:check`
- `pnpm typecheck`

Required scans:

- No widget `localization.json` or `layers/*.allowlist.json` files remain.
- No old shared l10n extraction/fingerprint/text-pack terms remain in `packages` or widget packages.
- No wildcard primitive contract terms remain in widget packages, `@clickeen/ck-contracts`, or `@clickeen/l10n`.
