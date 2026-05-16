# PRD 099B Deploy Roots Report

Generated: 2026-05-15T13:02:00Z

Status: **GREEN**

## What Changed

- Added `scripts/tokyo-r2-deploy-sync.mjs` to sync only git-authored deploy roots to R2:
  - `tokyo/product/widgets/**` -> `product/widgets/**`
  - `tokyo/product/assets/**` -> `product/assets/**`
  - `tokyo/product/themes/**` -> `product/themes/**`
  - `tokyo/product/dieter/**` -> `dieter/**`
  - `tokyo/product/fonts/**` -> `fonts/**`
  - `tokyo/roma/**` -> `product/roma/**`
  - `tokyo/prague/**` -> `prague/**`
- Updated Prague content publishing from root `l10n/prague/**` to canonical `prague/l10n/**`.
- Updated Tokyo Worker to serve friendly public asset URLs from canonical R2 keys:
  - `/widgets/**` -> `product/widgets/**`
  - `/dieter/**` -> `dieter/**`
  - `/themes/**` -> `product/themes/**`
  - `/prague/l10n/**` -> `prague/l10n/**`
  - `/prague/assets/**` -> `prague/assets/**`
  - `/fonts/**` remains `fonts/**`
- Added Tokyo Worker routes for those friendly asset URL prefixes.
- Removed the physical account `widgets/` storage key shape from Tokyo Worker helpers.
- Stopped writing any global published lookup outside the owning account path; old instance-only public render URLs now return 404 until the account-scoped public PBX route lands in the later slice.

## R2 Sync

Command:

```bash
node scripts/tokyo-r2-deploy-sync.mjs --remote
```

Result:

- Uploaded 761 git-authored deploy files.
- Roots written: `dieter/`, `fonts/`, `prague/`, `product/`.
- Runtime root `accounts/` was not written by the deploy sync.
- Stale roots `l10n/`, `public/`, `published/`, and `widgets/` were not written by the deploy sync.

Live post-sync root counts:

- Evidence: `Execution_Pipeline_Docs/02-Executing/evidence/099B__live_r2_root_counts.json`
- R2 now contains canonical deploy roots while stale roots remain untouched for later cleanup.

## Worker Deploy

Command:

```bash
pnpm -C tokyo-worker run deploy
```

Result:

- Deployed `tokyo-assets-dev`.
- Current Version ID: `c7d4aee5-658b-434f-9e56-82f2e8b129ff`.

## Live Friendly URL Checks

Evidence: `Execution_Pipeline_Docs/02-Executing/evidence/099B__live_friendly_url_r2_compare.jsonl`

All checked friendly URLs returned bytes identical to their canonical R2 object:

- `/widgets/faq/spec.json` -> `product/widgets/faq/spec.json`
- `/widgets/countdown/spec.json` -> `product/widgets/countdown/spec.json`
- `/widgets/logoshowcase/spec.json` -> `product/widgets/logoshowcase/spec.json`
- `/prague/l10n/widgets/faq/index.json` -> `prague/l10n/widgets/faq/index.json`
- `/fonts/special/Frari.woff2` -> `fonts/special/Frari.woff2`

## Scan Evidence

Required scan files:

- `Execution_Pipeline_Docs/02-Executing/evidence/099B__scan_forbidden_roots.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099B__scan_canonical_roots.txt`

The forbidden-root scan has four remaining hits:

- `prague/public/**` in workflow triggers: Astro source convention, not an R2 `public/` root.
- `tokyo/roma/i18n/public/**` in local Tokyo static serving: local build output, not an R2 `public/` root.
- `accounts/{accountPublicId}/instances/{instanceId}/published/config.json`: canonical account-owned published projection subtree, not root `published/`.

There are no remaining hits for:

- root `l10n/prague`
- root `published/widgets`
- account `accounts/{accountId}/widgets`

## Verification

- `node --check scripts/tokyo-r2-deploy-sync.mjs && node --check scripts/prague-sync.mjs`
- `pnpm tokyo:r2:sync:check`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check` for 099B artifacts

## Exit Criteria

- Non-account deploy roots are deploy-managed from git to R2.
- Friendly widget asset URLs resolve to R2 `product/widgets/`.
- `099C` can proceed with deploy roots and account runtime roots separated.
