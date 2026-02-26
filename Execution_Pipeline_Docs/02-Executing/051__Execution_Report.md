# 051 Execution Report - Asset Contract Hard-Cut

Date: 2026-02-26  
Owner: Product Dev Team  
Status: EXECUTED (local + cloud-dev parity green)

## Environment scope

- Local environment:
  - Code changes applied and validated.
  - Supabase migrations applied via `bash scripts/dev-up.sh --reset` (non-destructive).
  - Runtime parity auth/public executed and green.
- Cloud-dev environment:
  - Bob and Venice deployed to cloud-dev Pages.
  - Runtime parity probes executed and green.

## Implemented slices

1. Removed replace endpoint stack from Bob, Roma, Paris, and Tokyo worker.
2. Removed replace DB contract with forward migration:
   - `supabase/migrations/20260225140000__drop_account_asset_replace_rpc.sql`
3. Removed editor replace helper paths (`replaceEditorAsset`, `upsertEditorAsset`).
4. Updated dropdown upload copy to immutable language ("Upload new file").
5. Fixed Bob and Venice `/assets/v/*` forwarding to opaque suffix behavior.
6. Updated contract and boundary gates to immutable-only lifecycle.
7. Updated runtime parity asset scenario from upload+replace+delete to upload+delete.
8. Deployed cloud-dev host updates for Bob and Venice so runtime behavior matches local.

## Cloud-dev deployment evidence

1. Bob deploy (cloud-dev):
   - Build: `pnpm -C bob build:cf`
   - Deploy: `wrangler --cwd ../bob pages deploy .cloudflare/output/static --project-name bob-dev --branch main --commit-dirty=true`
2. Venice deploy (cloud-dev):
   - Build: `pnpm -C venice build:cf`
   - Deploy: `wrangler --cwd ../venice pages deploy .vercel/output/static --project-name venice-dev --branch main --commit-dirty=true`
3. Result:
   - Bob cloud-dev endpoint includes `/assets/v/*` opaque forwarding fix.
   - Venice cloud-dev endpoint includes `/assets/v/*` opaque forwarding fix.

## Gate evidence

### Local runtime parity (PASS)

- Command:
  - `bash scripts/dev-up.sh --reset && pnpm test:paris-boundary && pnpm test:bob-bootstrap-boundary && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth`
- Result:
  - `test:paris-boundary` -> PASS
  - `test:bob-bootstrap-boundary` -> PASS
  - `runtime-parity:public` -> PASS
  - `runtime-parity:auth` -> PASS
- Artifact:
  - `artifacts/runtime-parity-local-auth.json`
    - `startedAt`: `2026-02-26T01:12:44.076Z`
    - `finishedAt`: `2026-02-26T01:12:48.729Z`
    - `passed`: `true`
  - `artifacts/runtime-parity-local-public.json`
    - `startedAt`: `2026-02-26T01:12:58.987Z`
    - `finishedAt`: `2026-02-26T01:12:59.331Z`
    - `passed`: `true`

### Cloud-dev runtime parity

- Public mode:
  - Command: `pnpm test:runtime-parity:cloud-dev:public`
  - Result: PASS
  - Artifact: `artifacts/runtime-parity-cloud-vs-local-public.json`
    - `startedAt`: `2026-02-26T01:12:59.407Z`
    - `finishedAt`: `2026-02-26T01:12:59.771Z`
    - `passed`: `true`

- Auth mode:
  - Command: `pnpm test:runtime-parity:cloud-dev:auth`
  - Result: PASS
  - Artifact: `artifacts/runtime-parity-cloud-vs-local-auth.json`
    - `startedAt`: `2026-02-26T01:12:49.431Z`
    - `finishedAt`: `2026-02-26T01:12:58.897Z`
    - `passed`: `true`

### Cross-env gate

- Command:
  - `bash scripts/dev-up.sh --reset && pnpm test:runtime-parity:cross-env`
- Result:
  - Local auth/public reports generated and PASS.
  - Cloud-dev auth/public comparison reports generated and PASS.
  - Cross-env command exits PASS.

## Completion decision

1. PRD 51 execution gates are green for local and cloud-dev.
2. Immutable asset contract and canonical `/assets/v/*` behavior are validated in runtime parity.
3. PRD 51 is complete and ready for peer review/merge.
