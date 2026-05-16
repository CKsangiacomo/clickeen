# PRD 099E - Venice Public PBX And Published Projection

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 5 of 8

## Purpose

Make Venice a pure public PBX for published projections.

Venice serves an existing published projection or returns a miss such as 404. Venice does not decide billing, tier, compliance, caps, or publish eligibility.

## Scope

In scope:

- update Venice to resolve published projections by `accountPublicId + instanceId`
- implement the PRD99 public route contract
- remove dependency on root `published/`, root `public/`, and root `l10n/`
- return miss/404 when a projection is missing or disabled
- update embed/runtime mocks and smoke tests

Out of scope:

- account policy enforcement
- publish/unpublish mutation
- downgrading accounts
- repairing bad published data

## Blast Radius

Likely touched:

- `venice/app/widget/[instanceId]/route.ts`
- `venice/app/renders/[...path]/route.ts`
- `venice/app/embed/v2/loader.ts`
- `venice/lib/tokyo.ts`
- `venice/lib/tokyo-proxy.ts`
- `venice/tests/runtime/mock-tokyo.mjs`
- `scripts/health/product-path-smoke.mjs`
- Venice README/runtime docs

Current hot spots:

- Venice fetches `/renders/widgets/{instanceId}/live/r.json`
- Venice route params are instance-only
- loader text still references `ins_...`
- mock Tokyo routes expect instance-only public paths

## Required Work

1. Implement the chosen route shape:

```text
/widget/{accountPublicId}/{instanceId}
/renders/accounts/{accountPublicId}/instances/{instanceId}/...
```

2. Update Venice route parsing and Tokyo fetches to pass both coordinates.
3. Keep public fetches limited to Tokyo's published-projection contract.
4. Ensure missing projection equals a clear miss/404 path, not a policy computation.
5. Remove stale `ins_...` assumptions from public embed messaging unless kept only as rejected legacy examples.
6. Update Bob embed output, Prague references, and health smokes to carry `accountPublicId + instanceId`.

## Verification

Required checks:

```bash
pnpm --filter @clickeen/venice test
rg -n "published/widgets|/public/|/l10n/|ins_|billing|tier|entitlement|cap|compliance" venice
rg -n "accountPublicId|accountId|instanceId|published projection|published-projection|renders/accounts|/widget/" venice scripts/health bob prague
```

Expected behavior:

- valid account projection returns widget runtime
- missing projection returns 404/miss
- Venice does not call billing/tier/account policy modules

## Stop Conditions

Stop if:

- public runtime can only work with `instanceId`
- instance-only `/widget/{instanceId}` or `/renders/widgets/{instanceId}/...` remains the active public contract
- Venice needs root `published/widgets/{instanceId}.json`
- Venice evaluates whether something should be published
- Venice reads raw account authoring state instead of the published projection contract

## Exit Criteria

- Venice is PBX-only.
- Published projection resolution uses `accountPublicId + instanceId`.
- Missing/disabled projection behavior is deterministic and boring.

## Execution Notes

Completed in this slice:

- Replaced Venice public shell contract with `GET /widget/{accountPublicId}/{instanceId}`.
- Removed the old `venice/app/widget/[instanceId]/route.ts`; instance-only public shell URLs now fall through to 404.
- Changed Venice render proxy allowlist from `/renders/widgets/{instanceId}/...` to `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`.
- Updated Venice loader, SEO/GEO enhancement fetches, Tokyo cache classification, mock Tokyo, and runtime tests to use account-scoped published projection routes.
- Updated Bob embed output and preview-shadow to emit `accountPublicId + instanceId`.
- Updated Prague account instance references, embed components, locale resolution, validation, and README to require the account public id.
- Updated product-path health smoke to accept/discover account public id and read Venice through account-scoped public routes.

Verification completed:

```bash
pnpm --filter @clickeen/venice test
pnpm --filter @clickeen/venice typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/prague typecheck
pnpm lint
pnpm typecheck
git diff --check
```

Evidence:

- `Execution_Pipeline_Docs/02-Executing/evidence/099E__scan_venice_policy_legacy.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099E__scan_account_scoped_public_routes.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099E__scan_removed_instance_only_public_contract.txt`
