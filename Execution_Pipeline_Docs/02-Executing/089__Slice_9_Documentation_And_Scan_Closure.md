# PRD 089 Slice 9 - Documentation And Scan Closure

Status: repository checks green; authenticated live product-path smoke blocked by missing Roma cookie

Date: 2026-05-11

## Scope

Updated active docs and verification tooling so they match the PRD 088/089 account widget instance contract.

## Changes

1. Replaced active `publicId` documentation with `instanceId`.
2. Replaced old Venice `/e` and `/r` examples with `/widget/{instanceId}` and current `/renders/widgets/{instanceId}/...` examples.
3. Replaced Prague `systemInstanceRef` / `curatedRef` wording with `accountInstanceRef.instanceId` where a Prague page intentionally points at a real account widget instance.
4. Clarified that Prague page translations and account widget overlays are separate localization domains.
5. Removed active docs that implied starter/gallery/system instance product truth.
6. Marked `documentation/widgets/**/CompetitorAnalysis/**` as third-party historical research archives and excluded those vendor downloads from PRD contract scans.
7. Updated `scripts/health/product-path-smoke.mjs` to use `--instance-id` and `CK_HEALTH_INSTANCE_ID` / `VENICE_INSTANCE_ID`, removing the stale public-id CLI vocabulary.
8. Renamed Tokyo dev-server local instance validation helpers and CORS header vocabulary from public-id to instance-id.

## Verification

Static scans were run with competitor-analysis archives excluded:

```bash
rg -n "publicId|public_id|data-ck-public-id|CK_WIDGET\.publicId|public id|public-id|PUBLIC_ID|CK_HEALTH_PUBLIC_ID|VENICE_PUBLIC_ID|x-public-id" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages scripts documentation --glob '!Execution_Pipeline_Docs/03-Executed/**' --glob '!**/node_modules/**' --glob '!documentation/widgets/**/CompetitorAnalysis/**'
rg -n "wgt_curated|wgt_system|systemInstanceRef|curatedRef|/l10n/instances|/l10n/v/.*/instances|/renders/instances|public/instances|accounts/\{accountId\}/instances" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages scripts documentation --glob '!Execution_Pipeline_Docs/03-Executed/**' --glob '!**/node_modules/**' --glob '!documentation/widgets/**/CompetitorAnalysis/**'
rg -n "/e/|/r/" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages scripts documentation --glob '!Execution_Pipeline_Docs/03-Executed/**' --glob '!**/node_modules/**' --glob '!documentation/widgets/**/CompetitorAnalysis/**'
rg -n '"source"\s*:\s*"curated"' tokyo/product/widgets --glob '!**/node_modules/**'
```

Results:

- All four scans returned no active matches.
- Raw scans without the competitor-analysis exclusion still hit third-party downloaded vendor files; those folders are explicitly archived and not active Clickeen contract documentation.

Syntax and workspace checks:

```bash
node --check tokyo/dev-server.mjs
node --check scripts/health/product-path-smoke.mjs
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm lint
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm test
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm health:product-path --public-only --instance-id <publishedInstanceId> --json
```

Results:

- `node --check` passed for both edited scripts.
- Workspace lint passed.
- Workspace typecheck passed; Prague reports cached Astro hints but zero errors and exits 0.
- Workspace tests passed.
- Slice 10 changed public-only product health smoke so it cannot pass while skipping the published instance read.

## Remaining Gate

Authenticated product-path verification is still blocked because this session has no `CK_ROMA_COOKIE` / `ROMA_COOKIE` and no authenticated local product fixture:

```bash
PATH="/tmp/clickeen-corepack-shims:$PATH" pnpm health:product-path --write --instance-id <publishedInstanceId> --cookie '<romaCookie>'
```

Do not move PRD 089 to executed until that authenticated smoke is run or an equivalent authenticated product-path harness is provided.
