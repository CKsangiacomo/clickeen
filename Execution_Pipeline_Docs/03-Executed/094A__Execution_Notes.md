# PRD 094A - Execution Notes

Date: 2026-05-12
Status: Executed - code/build verified; credentialed cloud-dev browser smoke pending deployed build

## Slice 0 - Evidence And Route Matrix

Status: GREEN

Evidence:
- `roma/lib/account-authz-capsule.ts` produced `authz_capsule_required` when a current-account API request lacked `x-ck-authz-capsule`.
- `roma/lib/current-account-route.ts` used browser request-header authz for all current-account API callers.
- `roma/components/account-api.ts` read `authz.accountCapsule` from React bootstrap state and attached it to current-account fetches.
- `/api/bootstrap` proxied Berlin bootstrap, including raw `authz.accountCapsule`.

Route matrix:
- Current-account API routes: shared `resolveCurrentAccountRouteContext`.
- Roma-to-Tokyo account product calls: server helpers forward `accountCapsule`.
- Client current-account calls: now same-origin cookie auth only.
- Tokyo-worker product-control routes: still require signed account authz capsule.

## Slice 1/2 - Server-Owned Capsule Cookie And Resolver

Status: GREEN

Change:
- Added `ck-authz-capsule` as a server-owned httpOnly cookie through the existing Roma cookie helper.
- Added `resolveJwtCookieMaxAge` so the cookie follows the Berlin capsule `exp` claim.
- `/api/session/finish` stores the capsule cookie after Berlin bootstrap succeeds.
- Added `resolveServerAccountAuthz`, which reads the cookie, verifies the capsule, checks role, and refreshes once from Berlin bootstrap using the server-side access token when missing/invalid.
- `resolveCurrentAccountRouteContext` now uses `resolveServerAccountAuthz`.
- Removed Roma's request-header account authz resolver so browser-carried `x-ck-authz-capsule` is not a valid Roma current-account API path.

Verification:
- `corepack pnpm --filter @clickeen/roma typecheck`

## Slice 3 - Delete Client Capsule Plumbing

Status: GREEN

Change:
- Removed `accountCapsule` from `RomaAccountApi`.
- Removed `resolveRomaAccountCapsule`.
- Removed client setting of `x-ck-authz-capsule`.
- Removed raw `authz.accountCapsule` from `RomaMeResponse`.
- `/api/bootstrap` now strips `authz.accountCapsule` from the JSON response while setting the httpOnly cookie server-side.

Verification:
- `rg "accountCapsule|x-ck-authz-capsule|ROMA_AUTHZ_CAPSULE_HEADER|resolveRomaAccountCapsule" roma/components roma/components/use-roma-me.ts` returns no matches.
- `rg "authorizeRequestRoleFromCapsule|authorizeRequestAccountRoleFromCapsule|readRomaAuthzCapsuleHeader" roma -n` returns no matches.

## Slice 4 - Preserve Roma-To-Tokyo Proof

Status: GREEN

Change:
- `roma/lib/tokyo-product-control.ts` and `roma/lib/tokyo-asset-control.ts` still attach `x-ck-authz-capsule` from server route context.
- Tokyo-worker auth code was not weakened or changed.

Verification:
- `rg "x-ck-authz-capsule|assertRomaAccountCapsuleAuth|readRomaAuthzCapsuleHeader" tokyo-worker roma/lib/tokyo-product-control.ts roma/lib/tokyo-asset-control.ts packages/ck-policy -n`

## Slice 5/6 - Product API Verification

Status: Executed - local product API verification green; credentialed cloud-dev browser smoke pending deployed build

Local verification:
- `corepack pnpm --filter @clickeen/roma typecheck`
- `PATH="/tmp/codex-bin:$PATH" pnpm typecheck`
- `PATH="/tmp/codex-bin:$PATH" pnpm lint`
- `PATH="/tmp/codex-bin:$PATH" pnpm test`
- `PATH="/tmp/codex-bin:$PATH" pnpm --filter @clickeen/roma build:cf`

Credentialed cloud-dev browser smoke:
- Pending deployed build and active Roma browser session.
- Required smoke after deploy:
  - `/api/bootstrap` response contains no `authz.accountCapsule`.
  - Response sets/refreshes `ck-authz-capsule` as httpOnly.
  - `/api/builder/:instanceId/open` returns `200` without browser JavaScript adding `x-ck-authz-capsule`.
  - Existing unpublished widget opens in Bob.
  - Existing published widget opens in Bob.
  - `/api/account/widgets`, `/api/account/instances`, `/api/account/usage`, and `/api/account/assets` work from the normal browser session.

## Slice 7 - Documentation And Residue Scans

Status: GREEN

Docs:
- Updated `documentation/architecture/CONTEXT.md` with the server-owned authz model.
- Updated PRD 094 execution status and decisions.

Residue scans:
- `rg "accountCapsule|x-ck-authz-capsule|ROMA_AUTHZ_CAPSULE_HEADER|resolveRomaAccountCapsule" roma/components roma/components/use-roma-me.ts`
- `rg "authorizeRequestRoleFromCapsule|authorizeRequestAccountRoleFromCapsule|readRomaAuthzCapsuleHeader" roma -n`
- `rg "x-ck-authz-capsule|assertRomaAccountCapsuleAuth|readRomaAuthzCapsuleHeader" tokyo-worker roma/lib/tokyo-product-control.ts roma/lib/tokyo-asset-control.ts packages/ck-policy -n`
- `git diff --check`
