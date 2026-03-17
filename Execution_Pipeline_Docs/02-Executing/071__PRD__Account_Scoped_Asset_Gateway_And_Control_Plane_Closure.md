# PRD 071 — Account-Scoped Asset Gateway and Control-Plane Closure

Status: EXECUTED IN CODE (local boundary/build closure complete; cloud-dev binding/deploy verify pending)
Date: 2026-03-17
Owner: Product Dev Team
Priority: P0 (core account infrastructure)
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`

---

## One-line objective

Make account asset management one boring system:
- assets belong to an account
- Roma owns account-facing asset management
- Tokyo-worker is the sole asset authority
- Tokyo public origin serves immutable `/assets/v/*`
- the platform/admin account is only one consumer of that architecture

---

## Why this PRD exists

Assets are not a side tool.

They are core product infrastructure and must work the same way for:
- the platform/admin account
- a normal SMB account
- eventually millions of accounts

The current cloud-dev failure on the Roma Assets page exposed the real problem:
- the core Tokyo-worker asset model is mostly correct
- the Roma product boundary around assets is not
- the deploy/runtime checks are too weak to prove the simplest account asset lane

This PRD fixes the current fire in the shape of the final system.

This PRD is not:
- an admin-only repair
- a DevStudio-only patch
- a cloud-dev-only workaround

This PRD is:
- a hard-cut refactor of the Roma account asset gateway
- a control-plane seam cleanup for assets
- a deploy-verification closure for the real account asset lane

Execution posture:
- leaks must be closed by execution, not by adding defensive guards into the asset architecture
- the way to make this bulletproof is:
  - move all callers in one pass
  - delete the wrong routes in the same execution stream
  - fix env parity explicitly
  - close docs drift explicitly
  - prove the lane after deploy
- this PRD must not solve route/auth/env ambiguity by teaching the runtime to tolerate both old and new contracts

---

## Deterministic diagnosis

### What is already right

Tokyo-worker already looks like the correct asset authority:
- per-asset manifest metadata in R2
- immutable blob bytes in R2
- canonical public immutable reads via `/assets/v/:assetRef`

Relevant runtime:
- `tokyo-worker/src/domains/assets.ts`
- `tokyo-worker/src/domains/assets-handlers.ts`

### What is wrong

1. Roma asset management is still shaped as ad hoc root-level proxy routes.
   - `roma/app/api/assets/upload/route.ts`
   - `roma/app/api/assets/[accountId]/route.ts`
   - `roma/app/api/assets/[accountId]/resolve/route.ts`
   - `roma/app/api/assets/[accountId]/[assetId]/route.ts`

2. Roma uses the same Tokyo base resolver for public/software-plane reads and asset control-plane traffic.
   - `roma/lib/env/tokyo.ts`

3. The same proxy logic is duplicated four times instead of living in one gateway/helper.

4. Error semantics are bad.
   - local Roma env/auth/header failures are too easily collapsed into generic `502`
   - the asset page becomes a symptom of boundary confusion instead of surfacing the real contract failure

5. The current consumer list is wider than the obvious Roma pages.
   - Roma Assets page
   - Roma usage reads
   - Bob preview materialization
   - Dieter asset picker
   - Dieter asset upload path

6. Runtime verification is too weak.
   - deploy checks prove health and broad reachability
   - they do not prove the authenticated Roma -> Tokyo-worker account asset lane

### What the current cloud-dev failure means

The current Roma Assets `502` is not "no assets".

It means the internal account asset lane is broken:
- Roma is failing before or during the Roma -> Tokyo-worker account asset list call
- Roma asset-control binding, route auth, or account capsule forwarding is misconfigured enough that the private asset lane cannot complete

Therefore the current fire is a boundary/env failure on the simplest product asset workflow.

---

## Non-negotiable target state

1. Assets belong to an account.
2. Roma exposes account-scoped asset management to the product.
3. Tokyo-worker is the sole upload/list/resolve/delete authority.
4. Public immutable asset bytes are served by canonical refs only: `/assets/v/:assetRef`.
5. The platform/admin account uses the same account asset system as any other account.
6. No asset control-plane path depends on a public `NEXT_PUBLIC_*` Tokyo env var.
7. No root `/api/assets/*` product surface remains after hard cut.
8. Deploy verification proves the real authenticated account asset lane.
9. Roma -> Tokyo-worker trust is platform-native internal service identity, not a hand-managed mirrored shared secret copied across services.

---

## Scope

### In scope

- Roma account-facing asset management routes
- Roma asset gateway/helper
- asset-specific control-plane env seam
- server-side runtime asset materialization that still calls Tokyo resolve directly
- Bob/Dieter/Roma asset consumers that still encode the old route contract
- deploy/runtime verification for account assets
- docs/env contract updates

### Out of scope

- widening the Tokyo control-plane split for all Roma non-asset traffic in this PRD
- changing the immutable public asset read contract
- inventing a new asset store
- adding admin-only or DevStudio-only asset behavior

Important scope rule:
- `TOKYO_ASSET_CONTROL` is an asset-only private Cloudflare service binding in this PRD
- it does not commit this PRD to refactoring every non-asset Tokyo control-plane path yet

---

## Simple system truth

There are only three responsibilities here:

1. Roma owns account-facing asset management.
   - authorize the account request
   - expose product routes
   - call the asset authority

2. Tokyo-worker owns asset truth.
   - upload
   - list
   - resolve
   - delete
   - manifest/blob integrity

3. Public Tokyo serves immutable bytes.
   - `/assets/v/:assetRef`

That is the whole system.

Everything in this PRD must make the codebase closer to that model.

---

## Top-level tenets

1. Account scope is the product truth
   - Asset routes are account routes.
   - Asset management is never a platform-only special case.

2. Roma is the product gateway
   - Browser code talks to Roma only.
   - Roma owns session/capsule authorization and product route semantics.

3. Tokyo-worker is the asset authority
   - Roma does not infer asset storage layout.
   - Roma does not own asset metadata truth.

4. Public byte reads and control-plane writes are different planes
   - public/software-plane Tokyo stays on `NEXT_PUBLIC_TOKYO_URL`
   - Roma asset control-plane calls use a private Cloudflare service binding

5. Internal service trust must be platform-native
   - Browser auth proves the human to Roma.
   - Roma owns the customer-facing account asset API.
   - Downstream asset authority must trust Roma through platform-native internal service identity / private service binding.
   - A mirrored hand-managed `CK_INTERNAL_SERVICE_JWT` is not acceptable target architecture and must not be canonized by this PRD.

6. One gateway, not four copied proxies
   - Upload/list/resolve/delete must share one upstream gateway implementation in Roma.

7. All callers move in one pass
   - Pre-GA hard cut is allowed.
   - It is only correct if all live callers move together.

8. Preserve upload CORS/OPTIONS behavior
   - Upload is not just another route rename.
   - Bob/Dieter use it directly and require explicit CORS/OPTIONS continuity.

9. Do not hide local misconfiguration as upstream unavailability
   - Missing local env, broken header construction, or missing auth capsule should surface explicitly.

10. Deploy checks must prove the real lane
   - healthz is not enough
   - one authenticated account asset smoke must pass

11. Leak closure happens by cutover and deletion, not by dual-contract tolerance
   - No route should accept both old and new account asset contracts long-term.
   - No caller should be left on the old route family after the cut.
   - No runtime guard/check should exist solely to paper over incomplete caller migration.

---

## Canonical product route contract

Final Roma product routes:

- `GET /api/accounts/:accountId/assets`
- `POST /api/accounts/:accountId/assets/upload`
- `POST /api/accounts/:accountId/assets/resolve`
- `DELETE /api/accounts/:accountId/assets/:assetId`

Upload request contract on the new Roma route:

- path `:accountId` is the canonical account identity
- `x-account-id` is not part of the Roma browser/editor upload contract
- product callers must move to the path-scoped account contract in the same execution pass
- no dual path/header account contract is allowed on the final Roma route

Final Tokyo-worker authority routes:

- `POST /__internal/assets/upload`
- `GET /__internal/assets/account/:accountId`
- `POST /__internal/assets/account/:accountId/resolve`
- `DELETE /__internal/assets/:accountId/:assetId`
- `GET /assets/v/:assetRef`

No long-lived root product routes under `/api/assets/*` remain after cutover.

---

## Current hotspots

### Roma asset routes

- `roma/app/api/assets/upload/route.ts`
- `roma/app/api/assets/[accountId]/route.ts`
- `roma/app/api/assets/[accountId]/resolve/route.ts`
- `roma/app/api/assets/[accountId]/[assetId]/route.ts`

### Roma asset consumers

- `roma/components/assets-domain.tsx`
- `roma/components/usage-domain.tsx`
- `roma/components/builder-domain.tsx`

### Bob/Dieter asset consumers that also must move

- `bob/lib/session/runtimeConfigMaterializer.ts`
- `dieter/components/dropdown-fill/asset-picker-data.ts`
- `dieter/components/shared/assetResolve.ts`
- `dieter/components/shared/assetUpload.ts`

### Server-side asset consumers that also must move

- `roma/lib/account-asset-runtime.ts`

### Shared boundary/env/auth

- `roma/lib/env/tokyo.ts`
- `roma/lib/tokyo-product-auth.ts`
- `roma/lib/auth/session.ts`
- `roma/lib/account-authz-capsule.ts`
- `tokyo-worker/src/auth.ts`

### Verification/docs

- `.github/workflows/cloud-dev-runtime-verify.yml`
- `documentation/architecture/AssetManagement.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo.md`
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md`

---

## Execution rules

- Do not patch the admin/platform lane differently from real account lanes.
- Do not preserve root `/api/assets/*` routes after all callers move.
- Do not use `NEXT_PUBLIC_TOKYO_URL` for Roma asset control-plane traffic.
- Do not create a temporary Bob-only or DevStudio-only asset contract.
- Do not create a smoke check that pollutes the seeded platform account.
- Do not add a second asset authority anywhere outside Tokyo-worker.
- Every route/consumer cut must update docs in the same execution slice.
- Do not keep an "accept both old and new upload contract" phase in runtime.
- Do not add header/path mismatch guards as a substitute for moving the real callers.
- Do not leave one caller on the old route family and paper over it with an alias or proxy shim.

### Required bulletproofing method

PRD 071 is made safe by execution closure, not by more runtime tolerance.

That means:
- caller migration is atomic
- wrong routes are deleted
- env parity is made explicit
- docs contradictions are removed
- deploy proof is added

That does not mean:
- add more runtime checks
- add more fallback behavior
- accept both old and new route shapes
- keep extra compatibility headers around "for now"

---

## Cut plan

## Cut 1: Restore the broken cloud-dev lane

### Goal

Make the current live account asset lane work again before the route hard cut.

### Change

- Verify the currently deployed cloud-dev private asset-control binding is configured well enough to restore the broken lane.
- Verify Roma Pages has the `TOKYO_ASSET_CONTROL` service binding.
- Verify `TOKYO_ASSET_CONTROL` targets the asset-authority worker (`tokyo-assets-dev`).
- Verify public Tokyo only exposes the intended public runtime routes (`/healthz`, `/assets/v/*`, `/fonts/*`, `/l10n/*`, `/renders/*`).
- Prove one real account asset list call succeeds in cloud-dev.

### Acceptance

- Roma Assets page loads for the seeded account.
- `GET /api/accounts/:accountId/assets` no longer returns `502` in cloud-dev.
- Public Tokyo does not expose the asset control plane.

### Notes

This is a live-lane restore cut, not architecture ratification.

Explicit rule:
- Restoring the lane must happen on the same private service-binding architecture that PRD 071 defines.
- This cut does not permit a fallback shared-secret asset lane.

---

## Cut 2: Introduce the private asset control-plane seam

### Goal

Separate public Tokyo from the private asset control-plane in Roma code.

### Change

- Add the `TOKYO_ASSET_CONTROL` Cloudflare service binding on Roma Pages.
- Keep `NEXT_PUBLIC_TOKYO_URL` as public/software-plane only.
- Asset control-plane code must use `TOKYO_ASSET_CONTROL`.
- Move `roma/lib/account-asset-runtime.ts` to the same seam; it must not keep resolving assets through the public Tokyo/software-plane env.
- Tokyo-worker asset control routes must move to private internal paths that are not publicly routed.

### Files

- new Roma binding helper for private asset control fetches
- Roma asset route/gateway code
- `tokyo-worker/wrangler.toml`
- `tokyo-worker/src/index.ts`

### Acceptance

- Roma asset control-plane code no longer reads `NEXT_PUBLIC_TOKYO_URL`.
- `roma/lib/account-asset-runtime.ts` no longer uses the public Tokyo/software-plane env seam for asset resolve.
- asset control routes are not publicly reachable on `tokyo.dev.clickeen.com`
- Public byte/spec/Dieter reads remain on `NEXT_PUBLIC_TOKYO_URL`.
- This acceptance is limited to asset traffic in PRD 071.

---

## Cut 3: Build one shared Roma asset gateway

### Goal

Remove the four near-duplicate Roma asset proxies and replace them with one gateway helper.

### Change

Build one shared Roma helper that owns:
- upstream asset URL construction
- internal auth header construction
- `x-ck-internal-service: roma.edge`
- Roma account capsule forwarding
- request body/header forwarding where needed
- deterministic error mapping

### Required error behavior

- missing Roma env -> explicit `500 coreui.errors.misconfigured`
- missing/bad capsule on product route -> preserve local auth/deny status
- upstream network failure -> `502`
- upstream app/auth failure -> preserve upstream status/body

### Acceptance

- list/upload/resolve/delete all use the same Roma gateway helper
- no route duplicates the same internal proxy logic
- local Roma boundary failures are no longer masked as generic upstream errors

---

## Cut 4: Hard-cut to account-scoped Roma asset routes

### Goal

Move the product surface to its true account domain.

### Change

Create and cut over to:
- `GET /api/accounts/:accountId/assets`
- `POST /api/accounts/:accountId/assets/upload`
- `POST /api/accounts/:accountId/assets/resolve`
- `DELETE /api/accounts/:accountId/assets/:assetId`

### Caller move list (must move in one pass)

Roma:
- `roma/components/assets-domain.tsx`
- `roma/components/usage-domain.tsx`
- `roma/components/builder-domain.tsx`

Bob:
- `bob/lib/session/runtimeConfigMaterializer.ts`

Dieter/shared editor asset utilities:
- `dieter/components/dropdown-fill/asset-picker-data.ts`
- `dieter/components/shared/assetResolve.ts`
- `dieter/components/shared/assetUpload.ts`

Server-side runtime materialization:
- `roma/lib/account-asset-runtime.ts`

Atomic cut rule:
- these callers move in the same execution stream as the new routes
- the old root route family is deleted immediately after the caller move
- there is no long-lived transition phase where both contracts are treated as valid

### Upload-specific rule

Preserve explicit upload CORS/OPTIONS behavior on the new account-scoped upload route.

This is required because:
- Bob/Roma inject an absolute upload endpoint
- Dieter posts directly to it
- current upload route is the only asset route with explicit CORS/OPTIONS handling

Upload authority rule on the new Roma route:
- path `:accountId` is authoritative
- the Roma upload client contract is path-scoped only
- product callers must not send `x-account-id`
- if a caller still needs `x-account-id`, that caller has not been migrated and the execution cut is incomplete

### Acceptance

- no product caller uses root `/api/assets/*`
- all editor/runtime consumers use the new account-scoped route family
- upload continues to work with the same cross-origin/tool host expectations

---

## Cut 5: Delete the old root asset routes

### Goal

Finish the hard cut and remove the wrong product surface.

### Change

Delete:
- `roma/app/api/assets/upload/route.ts`
- `roma/app/api/assets/[accountId]/route.ts`
- `roma/app/api/assets/[accountId]/resolve/route.ts`
- `roma/app/api/assets/[accountId]/[assetId]/route.ts`

Delete any dead helpers or route references left behind.

### Acceptance

- no root `/api/assets/*` route remains in Roma
- grep shows only account-scoped Roma asset routes
- docs reflect only the new product contract

---

## Cut 6: Add real post-deploy account asset smoke

### Goal

Make deploy green mean the real authenticated account asset lane works.

### Change

Add a post-deploy smoke to `.github/workflows/cloud-dev-runtime-verify.yml` that uses:
- a dedicated smoke user credential secret
- a dedicated smoke account, or a disposable temp asset policy under a smoke-owned account

### Concrete auth sequence

1. `POST /api/session/login` with smoke email/password.
2. Store returned Roma session cookies.
3. `GET /api/bootstrap` with the cookie jar.
4. Parse:
   - `activeAccount.id`
   - `authz.accountCapsule`
5. Call Roma account asset routes with:
   - session cookies
   - `x-ck-authz-capsule: <accountCapsule>`

### Minimum smoke assertions

- `GET /api/accounts/:accountId/assets?limit=1` returns `200`
- `POST /api/accounts/:accountId/assets/upload` returns `200`
- `DELETE /api/accounts/:accountId/assets/:assetId` returns `200` or the expected explicit precondition contract if intentionally tested

### Smoke data rule

- Do not use the seeded main platform account as test debris.
- Use a dedicated smoke account or disposable temp asset flow.

### Acceptance

- deploy/runtime verify fails if authenticated Roma -> Tokyo-worker asset auth is broken
- healthz-only green is no longer enough for the account asset lane

---

## Verification matrix

Local:
- Roma typecheck
- Bob typecheck
- Dieter/shared consumer typecheck
- server-side runtime materialization typecheck for `roma/lib/account-asset-runtime.ts`
- targeted route tests for new account-scoped asset routes
- upload CORS/OPTIONS still passes
- one builder preview path still resolves assets correctly

Cloud-dev:
- authenticated account asset list through Roma
- authenticated upload through Roma
- authenticated delete through Roma
- public `/assets/v/:assetRef` still serves immutable bytes

Search/cleanup:
- no root `/api/assets/*` callers remain
- no Roma asset control-plane code reads `NEXT_PUBLIC_TOKYO_URL`
- no Roma/Bob/Dieter product upload caller sends `x-account-id`

Docs:
- `documentation/services/roma.md` no longer contradicts itself about asset auth
- Roma asset docs must say account asset routes execute through the `TOKYO_ASSET_CONTROL` Cloudflare service binding plus Roma account capsule
- docs must not say asset routes forward end-user session bearer directly to Tokyo-worker

---

## Required doc-closure item

The current Roma service docs contain an asset-auth contradiction:
- one section correctly says Roma -> Tokyo/Tokyo-worker residual product calls use `CK_INTERNAL_SERVICE_JWT` plus `x-ck-internal-service: roma.edge`
- another section still says asset routes forward with the user session bearer

PRD 071 is not done until that contradiction is removed and the executed asset auth model is documented in one way only.

---

## Red lines

- No admin/platform special-case asset contract
- No DevStudio-only asset route family
- No root-route compatibility kept after caller cutover
- No public env var reused as control-plane truth for assets
- No smoke that mutates the main seeded platform account
- No CI that calls this green without proving one authenticated account asset lane

---

## Done means

- account asset management is exposed only as account-scoped product routes in Roma
- Tokyo-worker is the only asset authority
- public immutable bytes still serve from `/assets/v/:assetRef`
- Bob/Dieter/Roma all consume the same account-scoped asset route contract
- the platform/admin account works because it is an account, not because it is special
- cloud-dev deploy verification proves the real authenticated account asset lane
- Roma -> Tokyo-worker trust is defined as platform-native internal service identity, not as a mirrored shared-secret architecture
