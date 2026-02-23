# 050 Execution Report (Local + Cloud-dev)

Date: 2026-02-22  
Environment: local + cloud-dev  
PRD: `Execution_Pipeline_Docs/02-Executing/050__PRD__Runtime_Parity_and_Truth_Recovery.md`

## Status

Historical tranches reached green for local + cloud-dev at that point in time.  
Current continuation tranche status (2026-02-22):

1. Local runtime gates are green in canonical chained execution:
   - `bash scripts/dev-up.sh --reset >/tmp/dev-up-runtime-parity.log 2>&1 && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth`
2. Cloud-dev auth parity is green:
   - `pnpm test:runtime-parity:cloud-dev:auth` -> pass.
3. Cloud-dev public parity is green:
   - `pnpm test:runtime-parity:cloud-dev:public` -> pass.
4. Cross-env parity is green (local vs cloud-dev):
   - `pnpm test:runtime-parity:cross-env` -> pass (auth + public comparisons).

## Verification tenets truth table (historical snapshot: 2026-02-20)

At the 2026-02-20 execution snapshot, all PRD 50 tenets were `TRUE` on executable runtime evidence:

1. DevStudio and Roma (local) use Bob the same way. -> `TRUE`
2. DevStudio and Roma use the same account. -> `TRUE`
3. Editing instances in DevStudio and Roma works the same way. -> `TRUE`
4. Uploading assets in DevStudio and Roma works the same way. -> `TRUE`
5. Assets in Roma (local) can be managed via UI. -> `TRUE`
6. Published updates are immediately visible in embeds. -> `TRUE`
7. Behavior translates to Cloudflare with same runtime contract. -> `TRUE`

Current truth is tracked in the `Status` section above (including cloud-dev drift detected on 2026-02-22).

## Code + deploy changes in this tranche

### Local repo write
1. Paris mutable account-asset operations now prefer worker base URL while public asset URL normalization keeps Tokyo public base behavior:
   - File: `paris/src/domains/accounts/index.ts`
   - Added split resolvers:
     - `resolveTokyoPublicAssetBase`
     - `resolveTokyoMutableAssetBase`
   - Applied mutable resolver for:
     - `handleAccountAssetDelete`
     - `handleAccountAssetReplaceContent`

### Cloud-dev write
1. Deployed updated Paris worker:
   - Command: `pnpm -C paris run deploy`
   - Service: `paris-dev`
   - Version ID: `4b04406a-a6b9-45f4-a324-c8c992d7b4af`

## Local runtime evidence (executed this tranche)

Startup evidence:
1. Ran canonical startup: `bash scripts/dev-up.sh`.
2. `dev-up` confirmed local Supabase usage and non-destructive migration apply.

C1/C2 host + account context parity:
1. `GET http://localhost:3000/api/paris/roma/bootstrap` -> `200`
2. `GET http://localhost:3004/api/bootstrap` -> `200`
3. Bootstrap identity parity:
   - `user.id=2653ea0a-b3c0-446c-ac60-cd4dccf6b641`
   - `defaults.accountId=00000000-0000-0000-0000-000000000100`
   - `defaults.workspaceId=00000000-0000-0000-0000-000000000001`
4. Instance envelope parity:
   - Bob `GET /api/paris/workspaces/:workspaceId/instance/:publicId?subject=workspace` -> `200`
   - Roma `GET /api/paris/instance/:publicId?workspaceId=:workspaceId` -> `200`
   - Matched fields: `publicId`, `ownerAccountId`, `workspace.id`, `workspace.accountId`
5. Negative parity:
   - Bob `GET /api/paris/instance/:publicId?subject=workspace` -> `422 coreui.errors.workspaceId.invalid`
   - Roma `GET /api/paris/instance/:publicId?subject=workspace` -> `422 coreui.errors.workspaceId.invalid`

C3 account-asset lifecycle parity:
1. Bob:
   - `POST /api/assets/upload` -> `200`
   - `PUT /api/assets/:accountId/:assetId/content` -> `200`
   - `DELETE /api/assets/:accountId/:assetId` -> `200`
   - second delete -> `404 coreui.errors.asset.notFound`
2. Roma:
   - `POST /api/assets/upload` -> `200`
   - `PUT /api/assets/:accountId/:assetId/content` -> `200`
   - `DELETE /api/assets/:accountId/:assetId` -> `200`
   - second delete -> `404 coreui.errors.asset.notFound`

C4 publish immediacy + cache contract:
1. Trigger: `POST http://localhost:8791/renders/instances/:publicId/snapshot` -> `200`
2. Pointer: `GET http://localhost:8791/renders/instances/:publicId/published.json` -> `200` with `cache-control: no-store`
3. Venice:
   - `GET http://localhost:3003/r/:publicId` -> `200`
   - `GET http://localhost:3003/e/:publicId` -> `200`
   - Both include:
     - `cache-control: no-store`
     - `x-ck-render-pointer-updated-at`
     - `x-venice-render-mode: snapshot`
4. Local visibility latency:
   - `deltaMs=262` (passes local gate `<= 5000`)
5. Local publish pipeline status:
   - Bob proxy `GET /api/paris/workspaces/:workspaceId/instances/:publicId/publish/status?subject=workspace` -> `200`
   - Summary: `overall=ready`, `pointerFlipped=29`, `awaitingSnapshot=0`, `awaitingL10n=0`, `failed=0`

DevStudio contract proof (local):
1. Ran: `pnpm --filter @clickeen/devstudio test -- dev-widget-workspace.test.ts` -> pass (`8/8`)
2. Includes coverage for:
   - Default local runtime profile on localhost
   - Bob bootstrap path usage
   - Bob asset upload path usage

## Cloud-dev runtime evidence (re-confirmed this tranche)

Auth context:
1. Runtime probes used a Supabase session token minted for `system@clickeen.dev`.

C1/C2 host + account context parity:
1. `GET https://bob-dev.pages.dev/api/paris/roma/bootstrap` -> `200`
2. `GET https://roma-dev.pages.dev/api/bootstrap` -> `200`
3. Bootstrap identity parity:
   - `user.id=11111111-1111-1111-1111-111111111111`
   - `defaults.accountId=00000000-0000-0000-0000-000000000100`
   - `defaults.workspaceId=00000000-0000-0000-0000-000000000001`
4. Instance parity for same workspace/publicId:
   - Bob workspace instance route -> `200`
   - Roma instance route -> `200`
   - Matched fields: `publicId`, `ownerAccountId`, `workspace.id`, `workspace.accountId`
5. Negative parity:
   - Bob missing workspace context -> `422 coreui.errors.workspaceId.invalid`
   - Roma missing workspace context -> `422 coreui.errors.workspaceId.invalid`

C3 account-asset lifecycle parity:
1. Bob:
   - upload -> `200`
   - replace -> `200`
   - delete -> `200`
   - second delete -> `404 coreui.errors.asset.notFound`
2. Roma:
   - upload -> `200`
   - replace -> `200`
   - delete -> `200`
   - second delete -> `404 coreui.errors.asset.notFound`

C4 publish immediacy + cache contract:
1. Trigger: `POST https://tokyo.dev.clickeen.com/renders/instances/:publicId/snapshot` -> `200`
2. Pointer: `GET https://tokyo.dev.clickeen.com/renders/instances/:publicId/published.json` -> `200` + `cache-control: no-store`
3. Venice:
   - `GET https://venice.dev.clickeen.com/r/:publicId` -> `200`
   - `GET https://venice.dev.clickeen.com/e/:publicId` -> `200`
   - Both include no-store + pointer timestamp + snapshot render mode
4. Cloud visibility latency:
   - `deltaMs=1249` (passes cloud gate `<= 7000`)
5. Publish pipeline:
   - `GET https://paris.dev.clickeen.com/api/workspaces/:workspaceId/instances/:publicId/publish/status?subject=workspace` -> `200`
   - Summary: `overall=ready`, `pointerFlipped=29`, `awaitingSnapshot=0`, `awaitingL10n=0`, `failed=0`

## Gates progress vs PRD 50 (historical snapshot: 2026-02-20)

1. C1 (one host-to-Bob contract): `PASS` (local + cloud-dev)
2. C2 (one account-context contract): `PASS` (local + cloud-dev)
3. C3 (one account-asset lifecycle contract): `PASS` (local + cloud-dev)
4. C4 (publish-to-embed immediacy contract): `PASS` (local + cloud-dev)
5. C5 (runtime-complete release contract): `PASS` on executable runtime matrix

Current gate state and blockers are tracked in `Status` and `Remaining work`.

## Runtime parity governance automation (Slice E)

1. Added runtime parity runner with host-correct scenarios:
   - `scripts/ci/runtime-parity/index.mjs`
   - `scripts/ci/runtime-parity/scenarios/public-access-parity.mjs`
   - `scripts/ci/runtime-parity/scenarios/bootstrap-parity.mjs`
   - `scripts/ci/runtime-parity/scenarios/instance-open-parity.mjs`
   - `scripts/ci/runtime-parity/scenarios/asset-lifecycle-parity.mjs`
   - `scripts/ci/runtime-parity/scenarios/roma-assets-ui-copy.mjs`
   - `scripts/ci/runtime-parity/scenarios/publish-immediacy.mjs`
2. Added package scripts:
   - `pnpm test:runtime-parity`
   - `pnpm test:runtime-parity:public`
   - `pnpm test:runtime-parity:cloud-dev`
   - `pnpm test:runtime-parity:cloud-dev:public`
   - `pnpm test:runtime-parity:cross-env`
3. Wired cloud-dev deploy workflows to execute runtime parity checks and upload JSON artifacts:
   - `.github/workflows/cloud-dev-workers.yml`
   - `.github/workflows/cloud-dev-roma-app.yml`
   - both workflows now run auth parity (`--mode auth`) and public parity (`--mode public`) as separate blocking steps.
4. Extended bootstrap parity contract script to require runtime parity workflow wiring:
   - `scripts/ci/check-bootstrap-parity.mjs`

## Continuation tranche (2026-02-22, local write)

1. Runtime parity auth no longer depends on manually exporting local bearer:
   - `scripts/ci/runtime-parity/env-profiles.mjs`
   - Local auth mode now auto-mints a probe bearer from local Supabase (`supabase status --output env`) with deterministic persona fallback.
   - Cloud-dev auth mode still requires explicit `RUNTIME_PARITY_SUPABASE_BEARER`.
2. Runtime parity HTTP layer hardened for transient dev/runtime instability:
   - `scripts/ci/runtime-parity/http.mjs`
   - Added timeout + retry behavior for fetches (`RUNTIME_PARITY_FETCH_TIMEOUT_MS`, `RUNTIME_PARITY_FETCH_RETRIES`, `RUNTIME_PARITY_FETCH_RETRY_DELAY_MS`).
3. Runtime parity entrypoint now hydrates local auth automatically:
   - `scripts/ci/runtime-parity/index.mjs`
   - Usage text updated to clarify bearer requirement split (cloud-dev required, local optional).
4. Verified local gates in canonical chained execution (to keep `dev-up` owner process alive in this terminal context):
   - `bash scripts/dev-up.sh --reset >/tmp/dev-up-gates.log 2>&1 && pnpm test:paris-boundary && pnpm test:bootstrap-parity && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth`
   - Result: all pass.
5. Local admin credential contract hardened (no insecure default passwords):
   - `scripts/dev-up.sh` now fails fast when `CK_ADMIN_PASSWORD` is missing before local persona seeding.
   - `scripts/dev/seed-local-personas.mjs` requires `CK_ADMIN_PASSWORD` (no hardcoded fallback).
   - `bob/lib/auth/session.ts` local DevStudio bootstrap path no longer has a default password fallback.
6. Removed remaining Tokyo upload entitlement fork tied to platform flag:
   - `tokyo-worker/src/domains/assets-handlers.ts`
   - `tokyo-worker/src/domains/assets.ts`
   - Upload budget/cap tier now resolves only from workspace/account policy context, not `account.is_platform`.
7. Re-verified local runtime parity after Tokyo cleanup:
   - `bash scripts/dev-up.sh --reset >/tmp/dev-up-continue.log 2>&1 && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth`
   - Result: both pass.
8. Standardized unauth bootstrap reason contract in code + parity gate:
   - `roma/lib/auth/session.ts`
   - `bob/lib/auth/session.ts`
   - `scripts/ci/runtime-parity/scenarios/public-access-parity.mjs`
   - Canonical expected reasonKey for missing/invalid session: `coreui.errors.auth.required`.
9. Cloud-dev parity re-run with auto-provisioned probe:
   - `pnpm test:runtime-parity:cloud-dev:auth` -> pass
   - `pnpm test:runtime-parity:cloud-dev:public` -> pass
10. Resolved Bob cloud runtime drift (runtime env contract mismatch):
    - Symptom was Bob replace/delete `404` while Roma matched expected `200` in cloud-dev.
    - Root cause: `bob-dev` Pages production runtime vars were stale (`PARIS_BASE_URL` / `NEXT_PUBLIC_TOKYO_URL`) compared to Roma.
    - Applied cloud-dev runtime alignment for `bob-dev` and redeployed Bob Pages.
    - Re-verified with direct Bob/Roma probes + runtime parity auth/public.
11. Runtime parity harness now supports env-scoped bearer inputs (cross-env safe):
    - `scripts/ci/runtime-parity/env-profiles.mjs`
    - Added `RUNTIME_PARITY_SUPABASE_BEARER_CLOUD` and `RUNTIME_PARITY_SUPABASE_BEARER_LOCAL` (with backward-compatible fallback to `RUNTIME_PARITY_SUPABASE_BEARER`).
12. Cross-env parity diff normalization now ignores volatile non-contract fields:
    - `scripts/ci/runtime-parity/diff-reporter.mjs`
    - Ignores probe-id/timing/timestamp fields that are environment-data artifacts, not runtime contract drift.
    - Cross-env auth/public comparisons now pass on semantic parity.

## Post-PRD hardening (Week 2 extraction wave)

1. Paris local direct execution shims removed in favor of queue-only orchestration:
   - Removed local l10n direct publish path from Paris:
     - `paris/src/domains/l10n/service.ts`
     - `paris/src/domains/l10n/layers-handlers.ts`
   - Removed direct render snapshot trigger path from Paris:
     - `paris/src/domains/workspaces/service.ts`
2. Paris boundary gate now forbids these legacy local execution patterns (allowlist set to zero):
   - `scripts/ci/check-paris-boundary.mjs`
3. Local validation after extraction:
   - `pnpm test:paris-boundary` -> pass
   - `pnpm test:bootstrap-parity` -> pass
   - `pnpm test:bootstrap-parity:cloud-dev` -> pass
   - `pnpm test:runtime-parity:public` -> pass
4. Added PR-time architecture gate workflow so Paris boundary checks run on pull requests:
   - `.github/workflows/pr-architecture-gates.yml`
5. Admin entitlement path cleanup (asset lifecycle):
   - Removed non-policy `account.isPlatform` budget bypass in Tokyo upload path.
   - Upload budgets now resolve from entitlement matrix/profile consistently.
   - File: `tokyo-worker/src/domains/assets-handlers.ts`

## Remaining work

1. Optional hardening: mirror Bob/Roma runtime var alignment directly in automated cloud-dev app deploy configuration so stale Pages project settings cannot reintroduce drift.
2. Optional hardening: decide whether cloud deploy workflows should run parity before and/or after deploy to satisfy strict “deploy only if parity passes” semantics.
3. Optional human QA: visual click-through in Roma/DevStudio for final UX sign-off before moving PRD 50 to executed.
