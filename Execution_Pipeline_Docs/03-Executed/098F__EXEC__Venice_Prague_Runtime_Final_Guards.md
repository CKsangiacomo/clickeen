# PRD 098F - Venice, Prague, Runtime, Docs, And Final Guards

Status: Executed  
Parent: `Execution_Pipeline_Docs/01-Planning/098__PRD__Overlay_Primitive_And_Locales_First_Application.md`  
Owner: DEV + TPM  
Sequence: 6 of 6  
Depends On: 098A, 098B, 098C, 098D, 098E green

## Core Tenet: PRD 098 Truth Is The Only Truth

Public runtime must serve the PRD 098 model only. Existing pre-GA public widget URLs, published lookups, Prague demo references, old l10n routes, and old localization objects must be moved to the new identity/runtime model or deleted.

The old runtime truth:

```text
ins_* public instanceId + /l10n/widgets/... + readyLocales/textPack + Prague layer overlays
```

does not survive.

The surviving runtime truth is:

```text
compactInstanceId -> published projection -> overlayId -> overlays/{overlayId}.json
```

No public redirect from old IDs, no old l10n proxy, no Prague-specific widget overlay resolver, no stale overlay fallback, and no compatibility route is allowed. Existing public/demo references must be rewritten to PRD 098 IDs or removed.

## Purpose

Finish PRD 098 by making public runtime use published overlay IDs only, deleting Prague's independent localization path, and adding guard scans so the old system does not return.

## Product Outcome

Venice serves the same widget truth that Builder produced:

- base config from published projection
- selected language overlay IDs from published projection
- overlay objects fetched by exact `overlayId`
- one resolver

Prague stops having its own translation architecture.

## Non-Negotiables

- Venice reads published projection truth only.
- Venice does not read account-private selected-overlay records.
- Venice does not search for overlays.
- Venice does not consume `readyLocales`.
- Venice does not fall back from one overlay to another.
- Venice does not read old `/l10n/widgets/.../overlay.json`.
- Prague does not keep a separate overlay/layer/localization model.
- Final guards reject reintroduced old l10n product concepts.

## New LOC Blast Radius

Expected new code is limited to:

- Venice published projection overlay reader
- exact overlay object fetch by `overlayId`
- runtime resolver call
- Prague deletion/reroute glue required to remove the independent path
- guard scripts/scans for banned PRD 098 concepts
- runtime tests for full FAQ translated render

New code must not include:

- account-private overlay reads from Venice
- overlay search
- alternate overlay selection when the selected overlay is unavailable
- Prague-specific widget overlay resolver
- a public old l10n proxy replacement with the same semantics

## Deletion LOC Blast Radius

Expected deletions/replacements include:

- Venice `applyTextOverrides`
- Venice old public l10n overlay reads/proxy/cache branches
- runtime `readyLocales` selection
- Prague layered localization runtime for widgets
- San Francisco Prague widget-string overlay path if it only exists for Prague's old widget overlay model
- docs describing `/l10n/widgets/.../overlay.json` as runtime truth

Keep non-widget Prague marketing copy localization only if it is clearly separate from widget overlays and cannot affect Builder/Venice widget runtime.

## Service Blast Radius

### `venice`

Affected files:

- `venice/app/widget/[instanceId]/route.ts`
- `venice/app/embed/runtime-locale.ts`
- `venice/lib/tokyo.ts`
- `venice/lib/tokyo-proxy.ts`
- `venice/README.md`
- runtime tests under `venice/tests`

Delete:

- `applyTextOverrides`
- old public l10n overlay reads
- `readyLocales` runtime selection
- old l10n cache/proxy branches

Add:

- published projection reader that includes overlay IDs
- exact overlay object fetch by `overlayId`
- runtime application through shared `resolveOverlay`
- unavailable response when projection names invalid/missing overlay

### `tokyo-worker`

Publish/sync output must be final:

```json
{
  "base": {},
  "overlays": {
    "languages": {
      "ITIT": "..."
    }
  }
}
```

Tokyo public reads expose published projection and overlay objects as needed by Venice. No account-private reads from Venice.

### `prague`

Affected files:

- `prague/src/lib/pragueL10n.ts`
- `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro`
- `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro`
- San Francisco Prague string translation path if only used for old Prague overlays

Disposition:

- delete independent Prague overlay/layer path
- if Prague still needs widget previews, route them through published Venice runtime contract

No separate base fingerprint, layer index, or text override model may remain.

### `bob` and `roma`

No new behavior unless final smoke finds a mismatch. They are part of end-to-end verification.

### `sanfrancisco`

No old Prague string l10n producer remains on active product/runtime path unless explicitly separated from widget overlays and documented as non-product marketing copy.

## Implementation Steps

1. Update Tokyo published projection shape if not completed in 098C.
2. Change Venice widget route to resolve base config plus selected language overlay ID from published projection.
3. Fetch overlay object by exact `overlayId`.
4. Apply `resolveOverlay(baseConfig, values)`.
5. Delete old Venice l10n proxy/cache/runtime-locale behavior.
6. Remove old locale switcher dependency on `readyLocales`; it should use published projection language keys.
7. Delete Prague independent localization code; if a Prague widget page remains, route it through published Venice runtime.
8. Update runtime docs.
9. Add guard scans and CI scripts for banned PRD 098 concepts.
10. Run full product smoke across Builder save, Bob preview, publish, Venice render.

## UX And Product Notes

- Public visitors should either see the selected published language overlay or a clear unavailable response if the published projection is invalid.
- Public runtime must not silently serve stale language values.
- If no language overlay is published for requested language, base language serving is allowed only when locale resolution selects base. It must not pretend the requested target language is available.

## Documentation Updates Required

This slice is not done until these docs are updated or explicitly marked unchanged in the PR description with a reason:

- `documentation/services/venice.md`
  - Replace old `/l10n/widgets/...` runtime model with published projection overlay IDs.
  - Document that Venice reads exact `overlayId` objects and applies `resolveOverlay(baseConfig, overlayValues)`.
  - Remove `readyLocales`, text-pack, and old l10n proxy routes from active runtime truth.
- `documentation/services/prague/prague-overview.md`
  - Document that Prague has no independent widget localization/overlay runtime.
  - State Prague widget demos route through published Venice runtime or do not apply widget overlays.
- `documentation/architecture/OverlayArchitecture.md`
  - Rewrite as PRD 098 overlay architecture: SKU-like `overlayId`, body `{ v, values }`, selected pointers, published projections, no status truth.
- `documentation/architecture/BabelProtocol.md`
  - Rewrite as Babel v1 over PRD 098 overlays: Roma orchestrates, San Francisco produces, Tokyo stores, Bob previews, Venice serves.
- `documentation/architecture/CONTEXT.md`
  - Update Canonical Concepts, Product-Path Account Editing, Tokyo Worker, Venice, Prague, and glossary sections to match the final PRD 098 model.
- `documentation/capabilities/localization.md`
  - Update customer/product behavior for locales as text overlays, no old l10n readiness model.
- `documentation/strategy/GlobalReach.md`
  - Ensure geography/localization strategy points to Babel overlays, not old l10n path/status mechanics.
- `documentation/strategy/WhyClickeen.md`
  - Update only if it contains concrete old implementation claims; keep strategy-level language if still accurate.
- `documentation/README.md`
  - Update docs index if Overlay/Babel docs changed names, scope, or status.
- `documentation/services/tokyo-worker.md`, `documentation/services/roma.md`, `documentation/services/bob.md`, and `documentation/services/sanfrancisco.md`
  - Final consistency pass after runtime wiring so no service doc preserves old l10n/text-pack/ready-locale truth.

## Verification Gates

This slice is not green until all pass:

```bash
pnpm --filter @clickeen/venice verify:runtime
pnpm --filter @clickeen/venice typecheck
NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm --filter @clickeen/venice build
pnpm --filter @clickeen/prague typecheck
pnpm --filter @clickeen/prague build
pnpm typecheck
```

Browser matrix:

- Chromium
- Firefox
- Microsoft Edge through GitHub Actions if local Edge is unavailable
- WebKit/Safari through GitHub Actions if local macOS cannot install Playwright WebKit

Required repository scans:

```bash
rg -n "localization\\.json|AllowlistEntry|collectAllowlistedEntries|buildL10nSnapshot|computeBaseFingerprint|baseFingerprint|L10nOp|textPack|readyLocales|overlays/l10n|l10n/base|/l10n/widgets|sync-instance-overlays|writeTextPack|generateAccountWidgetL10nOps|LocalizationOp|expandPathPatterns|applyTextOverrides|PragueOverlay|LayerIndex|fetchLayerIndex|fetchOverlay" packages bob roma tokyo-worker sanfrancisco venice prague tokyo/product/widgets
rg -n "overlayHash|valuehash|valueHash|contentHash|body scanning|fallback.*overlay|compat.*l10n|readiness.*overlay" documentation Execution_Pipeline_Docs packages bob roma tokyo-worker sanfrancisco venice prague tokyo/product/widgets
```

No product-path exceptions are allowed. Non-product matches are allowed only for historical PRD text or locale label helpers, and must be listed in the PR description before merge.

End-to-end smoke:

1. Create a FAQ widget.
2. Edit title, CTA, at least two questions, and two answers.
3. Save.
4. Confirm Roma generates language overlays through San Francisco.
5. Confirm Bob previews target language fully.
6. Publish.
7. Load Venice public widget with target language.
8. Confirm public runtime displays translated title, CTA, questions, and answers.
9. Confirm no console noise or public l10n fetch to old routes.

## Stop Conditions

Stop immediately if:

- Venice needs to read account-private selected-overlay state
- Prague still applies its own widget text override model
- runtime falls back to stale overlays
- scans find old product l10n concepts outside documented non-product exceptions
- public widget renders only title translated while body remains base language

## Definition Of Done

- Venice serves language overlays from published overlay IDs.
- Prague has no independent widget localization path.
- Old localization system is gone from product surfaces.
- Guard scans prevent reintroduction.
- Parent PRD 098 verification criteria are all green.

## Execution Result

Executed locally on May 14, 2026.

What changed:

- Tokyo-worker now exposes public published overlay objects at `/renders/widgets/{instanceId}/overlays/{overlayId}.json`.
- Tokyo-worker validates the requested `overlayId` against the published lookup and current published projection before serving `{ v, overlayId, values }`.
- Venice `/widget/{instanceId}` resolves locale availability from the published render pointer's overlay IDs, fetches the exact selected overlay object, and applies `resolveOverlay(baseConfig, values)`.
- Venice no longer exposes the old public `/l10n/**` proxy or old l10n cache path.
- Venice widget asset proxy no longer allows widget `localization.json`.
- Venice runtime tests now use a local Tokyo mock with a compact instance ID and published overlay ID fixture.
- Prague no longer applies an independent widget localization/layer path. Prague widget pages load canonical page JSON and validate compact account-instance embed IDs.
- Prague old public/demo `ins_*` references were rewritten to PRD 098 compact instance IDs.
- Active docs were updated for Venice, Prague, Tokyo-worker, Roma, Bob, San Francisco, Overlay/Babel, localization, SEO/GEO, widget build, and widget compliance truth.

Verification:

- `pnpm --filter @clickeen/venice verify:runtime` -> 18 passed across Chromium desktop, Firefox desktop, and Android Chrome.
- `CK_VENICE_INCLUDE_MSEDGE=1 pnpm --filter @clickeen/venice verify:runtime` -> 24 passed including Microsoft Edge desktop.
- `pnpm --filter @clickeen/tokyo-worker typecheck` -> passed.
- `pnpm --filter @clickeen/venice typecheck` -> passed.
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm --filter @clickeen/venice build` -> passed.
- `pnpm --filter @clickeen/prague typecheck` -> passed with existing Astro hints and 0 errors.
- `pnpm --filter @clickeen/prague build` -> passed.
- `pnpm typecheck` -> passed.

Scans:

- Product-path old-l10n scan over `packages bob roma tokyo-worker sanfrancisco venice prague tokyo/product/widgets` returned no matches.
- Active-doc scan has only anti-goal statements that explicitly say old files/routes are not product truth.
- Broad PRD/documentation scan has historical PRD/report matches and explicit anti-goal docs only; no product-code exception was accepted.

Browser matrix note:

- WebKit/Safari remains the GitHub Actions browser-matrix lane for the pushed commit because local Playwright WebKit is not available on this macOS setup.
