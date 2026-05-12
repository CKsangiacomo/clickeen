# PRD 093 Execution Notes

Status: In progress
Owner: Codex
Date: 2026-05-12
PRD: `Execution_Pipeline_Docs/02-Executing/093__PRD__PRD_092_Intent_Closure_And_Widget_Catalog_Truth.md`

## Slice 0 - Evidence Refresh

Status: GREEN

Required context read:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- PRD 093

Evidence commands:

```bash
rg -n "\b(faq|countdown|logoshowcase)\b|FAQ|Countdown|Logo" prague/src --glob '*.{astro,ts,tsx}'
rg -n "catalog.json|manifest.json|tokyo/product/widgets|titleCaseWidget|titleCaseWidgetType" prague/src tokyo/product/widgets --glob '*.{astro,ts,json}'
rg -n "/api/builder|loadBuilderOpenEnvelope|loadTokyoAccountInstanceDocument|loadTokyoAccountInstanceServeStates|open-editor" roma bob tokyo-worker/src --glob '*.{ts,tsx}'
rg -n "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'
rg -n "function isRecord|const isRecord|isPlainRecord|isPlainObject" packages tokyo-worker bob roma prague berlin dieter sanfrancisco --glob '*.{ts,tsx}'
rg -n "sha256Hex" packages tokyo-worker bob roma prague berlin dieter sanfrancisco --glob '*.{ts,tsx}'
rg -n "pendingPolicy|evaluateLightEditsPolicy|validateOpsAgainstControls|sensitive" sanfrancisco/src/agents/widgetCopilotCore.ts
node scripts/build-widget-catalog.mjs --check
```

Findings:

- Prague has one product-code widget literal outside widget-owned source: `prague/src/blocks/site/footer.astro` links generic "Widgets" chrome to `/widgets/faq/`.
- Prague derives widget labels from slug helpers in widget overview, widget subpage, `StepsPrimitive.astro`, and `InstanceEmbed.astro`.
- Builder open path is Roma `/api/builder/{instanceId}/open` -> `loadBuilderOpenEnvelope` -> Tokyo saved authoring config -> Bob `ck:open-editor`. Publish/serve state is not part of the editor-open gate.
- Roma has three local `asTrimmedString` definitions returning `string` instead of canonical `string | null`.
- Tokyo-worker exports a service-local `isRecord` from `tokyo-worker/src/route-helpers.ts`; remaining object guards are private parser helpers to classify in closure.
- `packages/l10n/src/index.ts` has a private `sha256Hex`; direct import from `ck-contracts` would currently create a package ownership concern because `ck-contracts` depends on `l10n`.
- San Francisco `widgetCopilotCore.ts` contains PRD 092-added edit-policy markers: `pendingPolicy`, `validateOpsAgainstControls`, and `evaluateLightEditsPolicy`.
- Local verification script gaps confirmed: Bob lacks `test`; Dieter lacks `lint` and `test`; `ck-contracts` lacks `typecheck` and `lint`; `l10n` has no local scripts.
- `node scripts/build-widget-catalog.mjs --check` passed.

## Slice 1 - Builder Open Product-Path Regression

Status: GREEN

Change:
- `roma/lib/builder-open.ts` opens Bob from the saved authoring envelope only.
- `tokyo-worker/src/routes/internal-render-routes.ts` returns saved authoring config without reading or embedding publish/serve state.
- `roma/lib/account-instance-direct.ts` no longer carries `publishStatus` on the saved authoring row.
- `roma/components/builder-domain.tsx` no longer requires `publishStatus` in the Builder-open response.
- Publish/unpublish remains owned by the Widgets-domain and Tokyo serve-state flows; it must not block opening an unpublished widget for editing.

Verification:
- `corepack pnpm --filter @clickeen/roma typecheck`
- `corepack pnpm --filter @clickeen/tokyo-worker typecheck`
- `rg "publishStatus|readInstanceServeState|serve-state" roma/lib/builder-open.ts tokyo-worker/src/routes/internal-render-routes.ts`

## Slice 2 - Prague Catalog Label Helper

Status: GREEN

Change:
- Added `prague/src/lib/widgetCatalog.ts`.
- The helper reads `tokyo/product/widgets/manifest.json`, validates the manifest shape, and throws on malformed entries or unknown widget types.
- There is no title-case fallback and no invented placeholder label path.

Verification:
- `corepack pnpm --filter @clickeen/prague typecheck` passed with 0 errors. Existing generated/dist hints remain outside this slice.

## Slice 3 - Replace Prague Slug Labels

Status: GREEN

Change:
- Widget overview and subpage CTAs now use `resolvePragueWidgetLabel(widgetKey)` instead of title-casing the URL slug.
- `StepsPrimitive` uses the same manifest label helper.
- `InstanceEmbed` resolves share copy from the manifest label through `data-ck-widget-label`; share chrome now fails if it is rendered without an explicit `widgetType`.
- `WidgetBlocks`, `Hero`, `Split`, `SplitCarousel`, and `Carousel` pass page widget identity through to the embed where share chrome needs it.

Verification:
- `rg "titleCaseWidget|titleCaseWidgetType|replace\\(/\\[_-\\]|Create a free .*Widget|data-ck-widget-label|resolvePragueWidgetLabel" prague/src --glob '*.{astro,ts}'`
- `corepack pnpm --filter @clickeen/prague typecheck` passed with 0 errors. Existing generated/dist hints remain outside this slice.

## Slice 4 - Remove Prague Footer FAQ Link

Status: GREEN

Change:
- Removed the footer's hardcoded `/widgets/faq/` link.
- Replaced it with non-linked Pre-GA placeholder text. No catalog route, widget index, or fake footer authority was introduced.

Verification:
- `rg "widgets/faq|>Widgets<|FAQ|faq" prague/src --glob '*.{astro,ts}'` shows no footer FAQ link; remaining hit is the real localized widgets page heading.
- `corepack pnpm --filter @clickeen/prague typecheck` passed with 0 errors. Existing generated/dist hints remain outside this slice.

## Slice 5 - Revert AI-Made San Francisco Copilot Policy

Status: GREEN

Change:
- Removed the PRD 092-added copilot edit-policy state and behavior from `sanfrancisco/src/agents/widgetCopilotCore.ts`.
- Deleted `pendingPolicy`, policy-version metadata, scope/group confirmation flows, sensitive-path detection, and the local ops policy validator.
- Preserved the intended generic copilot posture: no FAQ/countdown/logoshowcase prompt shortcut or widget-name regex behavior was introduced.

Verification:
- `rg "pendingPolicy|evaluateLightEditsPolicy|validateOpsAgainstControls|policy_|policyVersion|LightEdits|pathLooksSensitive|filterOpsBy|selectScope|selectGroup|inferScopeFromPath|bestControlForPath|validationResult|invalidReason|touchedScopes|touchedGroups|touchedControls|FAQ|faq|countdown|logoshowcase" sanfrancisco/src/agents/widgetCopilotCore.ts` returns no matches.
- `corepack pnpm --filter @clickeen/sanfrancisco typecheck`

## Slice 6 - Converge Roma `asTrimmedString`

Status: GREEN

Change:
- Removed Roma-local `asTrimmedString` implementations from account storage usage, account copilot, and the account instance copilot route.
- Imported the canonical `asTrimmedString` from `@clickeen/ck-contracts`.
- Updated call sites that require plain strings to handle the canonical `string | null` contract explicitly.

Verification:
- `rg "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'` returns no matches.
- `corepack pnpm --filter @clickeen/roma typecheck`

## Slice 7 - Close Exported Primitive Drift

Status: GREEN

Change:
- Removed the exported service-local `isRecord` from `tokyo-worker/src/route-helpers.ts`.
- Updated `tokyo-worker/src/routes/internal-render-routes.ts` to import the canonical `isRecord` from `@clickeen/ck-contracts`.
- Left private parser-local object guards alone, per PRD 093 scope.

Cycle-blocked item:
- `packages/l10n/src/index.ts` still owns a private `sha256Hex` copy. Importing `@clickeen/ck-contracts/security` from `@clickeen/l10n` would create a cycle because `ck-contracts` imports `@clickeen/l10n`. PRD 093 records this as blocked by current package ownership rather than adding a cycle.

Verification:
- `rg "export function isRecord|export const isRecord" tokyo-worker/src packages --glob '*.{ts,tsx}'` shows only `packages/ck-contracts/src/index.ts`.
- `corepack pnpm --filter @clickeen/tokyo-worker typecheck`
- `rg "sha256Hex" packages/l10n/src/index.ts packages/ck-contracts/src/security.ts packages/ck-contracts/src/index.ts`

## Slice 8 - Verification Command Surfaces

Status: GREEN

Change:
- Added `test` script to `@clickeen/bob`.
- Added `lint` and `test` scripts to `@ck/dieter`.
- Added `lint` and `typecheck` scripts plus a package tsconfig to `@clickeen/ck-contracts`.
- Added `lint`, `typecheck`, and `test` scripts plus a package tsconfig to `@clickeen/l10n`.
- `lint` for Dieter/ck-contracts/l10n is a current-toolchain static TS check, not a new ESLint platform.

Verification:
- `corepack pnpm --filter @clickeen/bob test`
- `corepack pnpm --filter @ck/dieter lint`
- `corepack pnpm --filter @ck/dieter test`
- `corepack pnpm --filter @clickeen/ck-contracts typecheck`
- `corepack pnpm --filter @clickeen/ck-contracts lint`
- `corepack pnpm --filter @clickeen/ck-contracts test`
- `corepack pnpm --filter @clickeen/l10n typecheck`
- `corepack pnpm --filter @clickeen/l10n lint`
- `corepack pnpm --filter @clickeen/l10n test`
- Package script scan confirms the required scripts exist.

## Slice 9 - Product-Path Smoke

Status: BLOCKED

Attempted command:
- `corepack pnpm health:product-path --json`

Result:
- Public checks passed:
  - Roma unauthenticated account API rejects: HTTP 401.
  - Venice loader: HTTP 200.
- Venice public instance read skipped because no published instance id was supplied or discovered.
- Authenticated Roma product path blocked because this shell has no `--cookie`, `CK_ROMA_COOKIE`, or `ROMA_COOKIE`.

Required follow-up input:
- A current Roma browser cookie for `https://roma.dev.clickeen.com`.
- Optional: `CK_HEALTH_INSTANCE_ID` for a published Venice read.
- Optional write smoke: `CK_HEALTH_SOURCE_INSTANCE_ID`.

## Slice 10 - Docs And Closure

Status: GREEN

Documentation:
- Updated `documentation/architecture/CONTEXT.md` so the Builder open path names Tokyo saved authoring config as the required authoring input and explicitly excludes publish/serve state as an editor-open blocker.
- Updated `documentation/architecture/CONTEXT.md` so Prague public widget labels come from the generated widget manifest and unknown widget types fail at the page/content boundary.
- Updated PRD 093 status to executed with the credentialed product smoke explicitly blocked by missing Roma cookie.

Workspace verification:
- `PATH="/tmp/codex-bin:$PATH" pnpm build:widgets:check`
- `PATH="/tmp/codex-bin:$PATH" pnpm typecheck`
- `PATH="/tmp/codex-bin:$PATH" pnpm test`
- `PATH="/tmp/codex-bin:$PATH" pnpm lint`
- `git diff --check`

Final drift scans:
- `rg "widgets/faq|titleCaseWidget|titleCaseWidgetType" prague/src --glob '*.{astro,ts}'` returns no matches.
- `rg "pendingPolicy|evaluateLightEditsPolicy|validateOpsAgainstControls|policy_|policyVersion|LightEdits|light-edits|light edits" sanfrancisco/src/agents/widgetCopilotCore.ts` returns no matches.
- `rg "export function isRecord|export const isRecord" tokyo-worker/src packages --glob '*.{ts,tsx}'` shows only `packages/ck-contracts/src/index.ts`.
- `rg "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'` returns no matches.
- `node scripts/build-widget-catalog.mjs --check`

Note:
- Root `pnpm` commands were run with a temporary `/tmp/codex-bin/pnpm` shim to call `corepack pnpm`; this shell did not expose a global `pnpm` binary.
