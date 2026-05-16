# PRD 099B - Git Deploy Roots And Product Asset Serving

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 2 of 8

## Purpose

Make the non-account R2 roots deploy-managed from git, not runtime-managed by account operations.

Only `accounts/` is runtime-managed. These roots are git-authored deploy artifacts synced/autodeployed to R2:

```text
dieter/
fonts/
product/
prague/
```

## Scope

In scope:

- sync git-authored product assets into canonical R2 roots
- make `product/widgets/` the R2 serving home for widget software
- fix Prague sync from root `l10n/prague/**` to `prague/l10n/**` if retained
- ensure local/dev Tokyo serving models friendly URLs mapping to canonical roots
- prevent deploy tooling from writing root `widgets/`, `l10n/`, `public/`, or `published/`

Out of scope:

- account runtime migration
- public published projection route shape
- stale-root deletion

## Required Mapping

```text
tokyo/product/widgets/**  -> product/widgets/**
tokyo/product/assets/**   -> product/assets/**
tokyo/product/themes/**   -> product/themes/**
tokyo/product/dieter/**   -> dieter/**
tokyo/product/fonts/**    -> fonts/**
tokyo/roma/**             -> product/roma/**
tokyo/prague/**           -> prague/**
```

## Blast Radius

Likely touched:

- `tokyo/_redirects`
- `tokyo/dev-server.mjs`
- `tokyo-worker/wrangler.toml`
- `.github/workflows/cloud-dev-workers.yml`
- `.github/workflows/cloud-dev-roma-app.yml`
- `.github/workflows/cloud-dev-prague-app.yml`
- `.github/workflows/cloud-dev-prague-content.yml`
- `scripts/tokyo-fonts-sync.mjs`
- `scripts/prague-sync.mjs`
- a small product asset sync script if no suitable one exists

## Required Work

1. Ensure `/widgets/{widgetType}/...` serves R2 `product/widgets/{widgetType}/...`.
2. Ensure `/dieter/...`, `/fonts/...`, `/themes/...`, and Prague content routes map to canonical deploy roots.
3. Update Prague content sync to `prague/l10n/**` or delete obsolete Prague l10n publishing.
4. Frame Tokyo Pages/static serving as local/source/deploy convenience only; it must not be a second product widget authority.
5. Add deploy verification that compares friendly URL output with the canonical R2 object.

## Verification

```bash
pnpm lint && pnpm typecheck
rg -n "l10n/prague|/l10n/prague|public/|published/|accounts/.*/widgets" tokyo tokyo-worker scripts .github/workflows
rg -n "tokyo/product/widgets|product/widgets|prague/l10n|tokyo/product/fonts|tokyo/product/dieter" scripts .github tokyo tokyo-worker prague
```

Live checks:

```text
/widgets/faq/spec.json
/widgets/countdown/spec.json
/widgets/logoshowcase/spec.json
```

These must serve the R2 `product/widgets/` objects, not stale static output or root `widgets/`.

## Stop Conditions

Stop if:

- product widget serving can diverge between static deploy output and R2 `product/widgets/`
- deploy tooling needs a root outside the canonical five
- a non-account deploy script writes into `accounts/`
- runtime account operations need to mutate `dieter/`, `fonts/`, `product/`, or `prague/`
- Prague sync still publishes to root `l10n/prague/`

## Exit Criteria

- Non-account roots are deploy-managed from git to R2.
- Friendly widget asset URLs resolve to R2 `product/widgets/`.
- `099C` can proceed knowing deploy roots and account runtime roots are separate.

## Execution Evidence

- Deploy roots report: `Execution_Pipeline_Docs/02-Executing/099B__Deploy_Roots_Report.md`
- R2 root counts after deploy sync: `Execution_Pipeline_Docs/02-Executing/evidence/099B__live_r2_root_counts.json`
- Friendly URL/R2 byte comparison: `Execution_Pipeline_Docs/02-Executing/evidence/099B__live_friendly_url_r2_compare.jsonl`
- Required forbidden-root scan: `Execution_Pipeline_Docs/02-Executing/evidence/099B__scan_forbidden_roots.txt`
- Required canonical-root scan: `Execution_Pipeline_Docs/02-Executing/evidence/099B__scan_canonical_roots.txt`

Green checks:

- `node scripts/tokyo-r2-deploy-sync.mjs --remote` uploaded 761 files to canonical deploy roots only.
- `pnpm -C tokyo-worker run deploy` deployed Tokyo Worker version `c7d4aee5-658b-434f-9e56-82f2e8b129ff`.
- `/widgets/faq/spec.json`, `/widgets/countdown/spec.json`, and `/widgets/logoshowcase/spec.json` match canonical R2 `product/widgets/**` bytes.
- `/prague/l10n/widgets/faq/index.json` matches canonical R2 `prague/l10n/**` bytes.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm --filter @clickeen/tokyo-worker test` passed.
