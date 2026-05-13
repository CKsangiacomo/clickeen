# PRD 089 Slice 10 - Closure Addendum

Status: Executed - runtime/docs green; authenticated product-path gate blocked by missing Roma cookie
Date: 2026-05-11

## Purpose

Close the remaining PRD 088/089 gaps without creating PRD 090, a second product theory, or a verification layer that checks its own source text.

The closure rule is deletion-first:

1. Remove stale product surfaces instead of preserving compatibility with fake starter/catalog modes.
2. Fail at the named boundary when source truth is invalid.
3. Keep verification behavioral. Source-regex self-tests are not closure proof.

## Required Runtime Fixes

1. Roma duplicate must not return success if Tokyo sync acceptance fails. The route must fail and clean up the just-created saved instance.
2. Roma Widgets actions must match real authorization. Viewer payloads must not advertise edit or rename as available mutations.
3. Tokyo published l10n reads must not serve overlays when the published lookup points at a missing or invalid source instance document.
4. Tokyo publish/unpublish must not perform split live writes in parallel. If a dependent write fails, the boundary must restore the prior publish document or fail explicitly.
5. Widget type catalog residue must be removed from the account widgets route/client path unless a real product create authority is introduced.

## Executed Changes

1. Roma duplicate now returns `502` and deletes the just-created Tokyo saved instance when sync acceptance fails.
2. Roma Widgets viewer payloads no longer advertise edit or rename actions.
3. Tokyo published l10n reads return 404 when the published lookup points at a missing or invalid source instance document.
4. Tokyo live publish/unpublish writes are sequential and restore the prior publish document if the dependent live lookup write/delete fails.
5. `widgetTypes` was removed from the Tokyo account index payload, Roma account widgets route, and Roma client normalization.
6. The PRD 89 source-text audit helpers were removed from active repo tooling.
7. `pnpm health:product-path --public-only` now requires `--instance-id` and cannot pass while skipping the public instance read.
8. `pnpm health:product-path --write` now requires `--source-instance-id` and cannot select its duplicate source from the Widgets API under test.
9. Active docs no longer promise starter/gallery/create-from-type account widget behavior.

## Required Verification Fixes

1. `pnpm health:product-path --public-only` may not pass while skipping the published instance read. Public-only mode requires `--instance-id`.
2. `pnpm health:product-path --write` may not pick its duplicate source from the account widgets API under test. Write mode requires `--source-instance-id`.
3. PRD 89 audit helpers that prove closure by grepping source code must not remain as active repo tooling.
4. Authenticated product-path closure remains blocked without `CK_ROMA_COOKIE` / `ROMA_COOKIE`; that block must be explicit, not converted into a green result.

## Verification

```bash
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm lint
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm test
node_modules/.bin/tsc -p roma/tsconfig.json --noEmit
node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
node --check scripts/health/product-path-smoke.mjs
node scripts/health/product-path-smoke.mjs --public-only --json
node scripts/health/product-path-smoke.mjs --write --cookie fake --json
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm health:product-path --json
```

Results:

- Lint, workspace typecheck, workspace tests, Roma TypeScript, Tokyo-worker TypeScript, and health script syntax are green.
- Public-only health without an instance ID fails as intended with `--public-only requires --instance-id / CK_HEALTH_INSTANCE_ID / VENICE_INSTANCE_ID`.
- Write health without a source instance ID fails as intended with `--write requires --source-instance-id / CK_HEALTH_SOURCE_INSTANCE_ID`.
- Full product-path smoke is not green because authenticated Roma verification is blocked by missing `CK_ROMA_COOKIE` / `ROMA_COOKIE`.

## Non-Goals

1. Do not build a starter gallery.
2. Do not add a new widget creation framework.
3. Do not introduce a second account widget identity.
4. Do not use source-text self-tests as proof of behavior.
