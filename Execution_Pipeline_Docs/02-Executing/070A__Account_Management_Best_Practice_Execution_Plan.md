# 070A Account Management Best-Practice Execution Plan

Status: EXECUTING
Date: 2026-03-16
Owner: Product Dev Team
Depends on: `070A__PRD__Product_Boundary_Closure.md`

---

## One-line objective

Make account management match SaaS best practice and the 070A product-boundary tenets:
- Berlin provisions once and mints session/account truth
- Roma boots fully operational from that truth
- Bob never discovers account truth independently in account mode
- Tokyo/Tokyo-worker execute against Roma-provided account context
- Internal product paths stop repairing, re-checking, or re-deriving already-minted truth

---

## Why this plan exists

The current architecture has good bones:
- Berlin is already the auth/session authority
- Roma already bootstraps from Berlin
- Bob account mode is already host-only
- Roma already carries an account authz capsule

The remaining brittleness is concentrated in a few wrong patterns:
- Berlin bootstrap still repairs/provisions missing product state on the hot path
- Bootstrap still fans out to live budget counters and bakes mutable state into the signed capsule
- Roma does not proactively refresh the capsule before expiry
- Bob still carries bootstrap residue that should not exist on the account path
- Tokyo-worker still supports dual account auth shapes on product paths
- The account capsule is manually threaded through too many Roma surfaces
- The capsule still uses a shared secret instead of one-way Berlin signing

This plan fixes those problems without inventing a new system.

---

## Non-negotiable target state

1. `GET /v1/session/bootstrap` performs zero writes.
2. Product provisioning happens in login/signup/invitation/account-create flows, not during bootstrap.
3. Roma receives one explicit `activeAccount` object and can operate immediately.
4. The signed account capsule carries only stable authz truth.
5. Mutable locale state and live `used` counters are not inside the signed capsule.
6. Roma refreshes bootstrap/authz before the capsule expires.
7. Bob account mode never calls bootstrap.
8. Tokyo/Tokyo-worker product routes accept one account auth model: Roma internal identity plus account capsule.
9. Internal contract breakage fails fast instead of being normalized downstream.

---

## Keep vs change

### Keep

- Berlin as the sole auth/session/account-governance authority
- Roma same-origin API routes as the product backend
- Bob as host-booted editor-only UI in account mode
- The account authz capsule pattern itself
- `active_account_id` as a user preference in Berlin

### Change

- Hot-path reconciliation during bootstrap
- The bootstrap payload shape
- The capsule payload contents
- Shared-secret capsule signing
- Roma's lack of proactive refresh
- Bob account bootstrap residue
- Tokyo-worker dual auth fallback on product routes
- Ad hoc account-capsule threading across Roma

---

## Current hotspots

### Bootstrap and provisioning

- `berlin/src/account-state.ts`
- `berlin/src/account-state.types.ts`
- `berlin/src/account-reconcile.ts`
- `berlin/src/routes-login.ts`
- `berlin/src/routes-account.ts`

### Shared account contract

- `packages/ck-policy/src/authz-capsule.ts`
- `packages/ck-policy/src/policy.ts`
- `packages/ck-policy/src/gate.ts`
- `packages/ck-policy/src/registry.ts`

### Roma bootstrap and account execution

- `roma/app/api/bootstrap/route.ts`
- `roma/components/use-roma-me.ts`
- `roma/lib/account-authz-capsule.ts`
- `roma/components/builder-domain.tsx`
- `roma/components/assets-domain.tsx`
- `roma/components/templates-domain.tsx`
- `roma/components/settings-domain.tsx`
- `roma/components/widgets-domain.tsx`
- `roma/components/account-instance-cache.ts`
- `roma/components/account-locale-settings-card.tsx`
- `roma/components/roma-account-notice-modal.tsx`
- `roma/app/api/accounts/**`
- `roma/app/api/assets/**`

### Bob account-mode residue

- `bob/app/api/session/bootstrap/route.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/account-authz-capsule.ts`

### Tokyo-worker product auth

- `tokyo-worker/src/auth.ts`
- `tokyo-worker/src/index.ts`
- `tokyo-worker/src/domains/assets-handlers.ts`
- `tokyo-worker/src/domains/assets.ts`
- `tokyo-worker/src/domains/l10n-authoring.ts`
- `tokyo-worker/src/domains/l10n-read.ts`

---

## Execution rules

- Do not layer the new contract on top of the old one.
- Do not keep bootstrap repair "for now".
- Do not keep mutable truth in the capsule "for convenience".
- Do not keep dual auth shapes alive on the same product route.
- Do not add fallback refresh logic that hides expiry.
- Each cut must delete obsolete helpers, env usage, and docs in the same diff.

---

## Cut plan

## Cut 1: Make bootstrap read-only

### Goal

Berlin bootstrap becomes a pure read-and-mint path.

### Change

- Remove hot-path reconciliation from `loadPrincipalAccountState()` in `berlin/src/account-state.ts`.
- Delete `ensureCanonicalState()` from `berlin/src/account-state.ts`.
- Keep provisioning in:
  - `berlin/src/routes-login.ts`
  - invitation accept flow in `berlin/src/account-invitations.ts`
  - explicit account create path in `berlin/src/routes-account.ts` and `berlin/src/account-reconcile.ts`

### Files to change

- `berlin/src/account-state.ts`
- `berlin/src/routes-login.ts`
- `berlin/src/routes-account.ts`
- `berlin/src/account-invitations.ts`
- `berlin/src/account-reconcile.ts`

### Delete targets

- `ensureCanonicalState()` helper in `berlin/src/account-state.ts`

### Required runtime behavior

- If profile or memberships are missing at bootstrap, Berlin returns an internal contract error.
- Bootstrap no longer creates accounts, profiles, or memberships.

### Verification

- Search: no bootstrap path calls `ensureProductAccountState`
- Typecheck: `pnpm --filter @clickeen/berlin exec tsc -p tsconfig.json --noEmit`
- Manual: login/signup still provisions correctly, bootstrap fails fast for intentionally broken seeded state

---

## Cut 2: Simplify the bootstrap contract around `activeAccount`

### Goal

Roma receives one obvious operational account context instead of reconstructing it from multiple shapes.

### Change

- Add a first-class `activeAccount` payload to Berlin bootstrap.
- Keep `accounts` as summary/list data for the switcher and team screens.
- Stop making Roma derive the active context from `defaults.accountId + accounts[] + authz`.
- Keep connectors only if still required by live Roma screens; otherwise remove them from bootstrap.

### Target bootstrap shape

- `user`
- `profile`
- `activeAccount`
- `accountsSummary`
- `authz`
- optional non-authz UI seed data if truly needed

### Files to change

- `berlin/src/account-state.types.ts`
- `berlin/src/account-state.ts`
- `roma/components/use-roma-me.ts`
- `roma/components/roma-account-switcher.tsx`
- `roma/components/settings-domain.tsx`
- `roma/components/team-domain.tsx`
- any Roma consumers still reading `defaults.accountId`

### Delete targets

- `defaults.accountId` dependency inside Roma consumers
- Any dead `resolveDefaultRomaContext()` helper logic in `roma/components/use-roma-me.ts`

### Required runtime behavior

- Roma can read `me.data.activeAccount` directly.
- Account-switcher/list screens still receive the list they need.

### Verification

- Search: no live Roma consumer depends on `defaults.accountId`
- Typecheck: `pnpm --filter @clickeen/roma exec tsc -p tsconfig.json --noEmit`
- Manual: Roma home/widgets/settings open without reconstructing active account context

---

## Cut 3: Slim the signed capsule to stable authz truth only

### Goal

The capsule becomes a stable authorization artifact, not a bag of mutable product state.

### Keep in the capsule

- `userId`
- `accountId`
- `accountStatus`
- `accountIsPlatform`
- `accountName`
- `accountSlug`
- `accountWebsiteUrl`
- `role`
- `profile`
- `authzVersion`
- `iat`
- `exp`
- stable flags/caps/maxima needed for route authz

### Remove from the capsule

- `accountL10nLocales`
- `accountL10nPolicy`
- live `budgets.*.used`

### Change

- Redefine `RomaAccountAuthzCapsulePayload` in `packages/ck-policy/src/authz-capsule.ts`.
- Stop populating locale fields and `used` counters in `berlin/src/account-state.ts`.
- Separate bootstrap UI seed data from signed authz payload.
- Update any Roma/Tokyo-worker code that expects those fields in the verified capsule.

### Files to change

- `packages/ck-policy/src/authz-capsule.ts`
- `packages/ck-policy/src/policy.ts`
- `packages/ck-policy/src/gate.ts`
- `packages/ck-policy/src/registry.ts`
- `berlin/src/account-state.ts`
- `berlin/src/account-state.types.ts`
- `roma/components/use-roma-me.ts`
- `roma/lib/ai/account-copilot.ts`
- `roma/app/api/accounts/[accountId]/instances/[publicId]/publish/route.ts`
- `roma/app/api/assets/upload/route.ts`
- `tokyo-worker/src/auth.ts`
- `tokyo-worker/src/domains/assets-handlers.ts`

### Delete targets

- Locale fields from `RomaAccountAuthzCapsulePayload`
- Snapshot `used` counters from the signed authz path

### Required runtime behavior

- Signed authz remains sufficient for route authorization.
- Live usage checks read from canonical counters where enforcement actually happens.
- Locale truth is read from the real owner when needed, not from a stale capsule snapshot.

### Verification

- Search: no live code reads `accountL10nLocales` or `accountL10nPolicy` from the capsule payload
- Search: no signed capsule type contains `budgets.*.used`
- Typecheck across `ck-policy`, `berlin`, `roma`, `tokyo-worker`

---

## Cut 4: Remove budget fan-out from bootstrap

### Goal

Bootstrap stops paying latency for data that is stale by definition.

### Change

- Remove `readBudgetUsed()` fan-out from `buildBootstrapPayload()` in `berlin/src/account-state.ts`.
- If Roma needs usage for display, expose it as:
  - optional non-signed UI seed data, or
  - dedicated Roma same-origin reads for the relevant screen
- Keep live enforcement at the canonical owner:
  - AI usage where AI is metered
  - publish counts where publish truth is enforced
  - asset/storage counters where storage is enforced

### Files to change

- `berlin/src/account-state.ts`
- `berlin/src/account-state.types.ts`
- `packages/ck-policy/src/registry.ts`
- `packages/ck-policy/src/gate.ts`
- Roma screens that display usage data

### Delete targets

- `readBudgetUsed()` from bootstrap path if it becomes unused

### Required runtime behavior

- Bootstrap latency no longer scales with the number of budget keys.
- Product enforcement still uses live counters at the actual enforcement point.

### Verification

- Search: `buildBootstrapPayload` no longer calls `readBudgetUsed`
- Manual: usage screens still render, publish/assets/AI enforcement still works

---

## Cut 5: Move capsule signing to asymmetric crypto

### Goal

Only Berlin can mint the capsule. Downstream services verify with public material only.

### Change

- Replace HMAC signing in `packages/ck-policy/src/authz-capsule.ts` with asymmetric signing and verification.
- Berlin signs with a private key.
- Roma, Tokyo-worker, and any legitimate verifier read public verification material.

### Files to change

- `packages/ck-policy/src/authz-capsule.ts`
- `berlin/src/account-state.ts`
- `roma/lib/account-authz-capsule.ts`
- `tokyo-worker/src/auth.ts`
- `bob/lib/account-authz-capsule.ts`
- `roma/lib/minibob-handoff.ts`
- `roma/app/api/roma/instances/[publicId]/route.ts`

### Delete targets

- `ROMA_AUTHZ_CAPSULE_SECRET` usage from verifiers
- Shared-secret verification helpers

### Required runtime behavior

- Berlin is the only signer.
- Roma/Tokyo-worker/Bob verify without holding signing capability.

### Verification

- Search: no verifier reads `ROMA_AUTHZ_CAPSULE_SECRET`
- Typecheck across all capsule consumers
- Manual: bootstrap, builder open, assets upload, and handoff still verify authz correctly

---

## Cut 6: Add proactive Roma refresh

### Goal

Roma refreshes session/account authz before user actions hit expiry.

### Change

- Add background refresh in `roma/components/use-roma-me.ts`.
- Refresh before `authz.expiresAt`, not after.
- Trigger explicit reload after account-governance mutations:
  - account switch
  - locale save
  - owner transfer
  - invitation accept
  - any other account mutation that changes authz or active account

### Files to change

- `roma/components/use-roma-me.ts`
- `roma/components/settings-domain.tsx`
- `roma/components/team-domain.tsx`
- `roma/components/team-member-domain.tsx`
- `roma/components/account-locale-settings-card.tsx`
- `roma/components/roma-account-switcher.tsx`
- any mutation flows that should invalidate bootstrap state

### Delete targets

- Expiry-only passive reload behavior as the sole refresh model

### Required runtime behavior

- Idle user does not discover expiry on the first click after 15 minutes.
- Account mutations promptly refresh `activeAccount` and authz in memory.

### Verification

- Manual: idle session continues working without action-time bootstrap stall
- Manual: account switch immediately updates the active account context

---

## Cut 7: Delete Bob account bootstrap residue

### Goal

Account-mode Bob lives entirely from Roma host truth.

### Change

- Delete `bob/app/api/session/bootstrap/route.ts`.
- Keep MiniBob/public boot behavior only where it is a real external boundary.
- Keep account-mode `ck:open-editor` boot through Roma host messaging.

### Files to change

- `bob/app/api/session/bootstrap/route.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionTypes.ts`
- `roma/components/builder-domain.tsx`

### Delete targets

- `bob/app/api/session/bootstrap/route.ts`
- Any Bob account-mode caller that still expects to bootstrap independently

### Required runtime behavior

- Account-mode Bob opens only from Roma host payload.
- No account-mode path calls Berlin bootstrap from Bob.

### Verification

- Search: no account-mode caller hits `/api/session/bootstrap`
- Manual: Builder open/save/localization still work inside Roma

---

## Cut 8: Collapse Tokyo-worker product auth to one model

### Goal

Tokyo-worker product account routes stop accepting dual end-user auth shapes.

### Change

- Remove Berlin-user-JWT fallback from product account paths in `tokyo-worker/src/auth.ts`.
- Require Roma internal service identity plus account capsule for product account routes.
- Keep separate external-boundary auth only for truly external routes, if any remain.

### Files to change

- `tokyo-worker/src/auth.ts`
- `tokyo-worker/src/index.ts`
- `tokyo-worker/src/domains/assets-handlers.ts`
- `tokyo-worker/src/domains/assets.ts`
- `tokyo-worker/src/domains/l10n-authoring.ts`
- `tokyo-worker/src/domains/l10n-read.ts`
- `roma/app/api/assets/upload/route.ts`
- `roma/app/api/assets/[accountId]/route.ts`
- `roma/app/api/assets/[accountId]/[assetId]/route.ts`
- `roma/lib/account-instance-direct.ts`

### Delete targets

- Product-path Berlin JWT fallback inside Tokyo-worker account auth

### Required runtime behavior

- Product account writes and reads execute from Roma-issued internal account context.
- Tokyo-worker no longer re-discovers end-user auth on those product routes.

### Verification

- Search: product account auth path no longer calls Berlin JWKS verification
- Manual: asset upload/list/delete still work through Roma same-origin routes

---

## Cut 9: Centralize Roma account-capsule transport

### Goal

Roma stops hand-threading the capsule through every component.

### Change

- Introduce one Roma account API client/helper for same-origin account requests.
- Centralize:
  - reading current capsule
  - attaching `x-ck-authz-capsule`
  - cache invalidation hooks after mutations

### Files to change

- New helper under `roma/lib/` or `roma/components/`
- `roma/components/assets-domain.tsx`
- `roma/components/widgets-domain.tsx`
- `roma/components/templates-domain.tsx`
- `roma/components/settings-domain.tsx`
- `roma/components/account-instance-cache.ts`
- `roma/components/account-locale-settings-card.tsx`
- `roma/components/roma-account-notice-modal.tsx`
- `roma/components/builder-domain.tsx`

### Delete targets

- Repeated local `accountCapsule` extraction/header assembly blocks in Roma UI components

### Required runtime behavior

- Same-origin account calls remain identical in behavior.
- Capsule/header transport logic lives in one place.

### Verification

- Search: one helper owns `x-ck-authz-capsule` attachment for browser-side Roma account calls
- Manual: widgets/assets/templates/settings flows still work

---

## Cut 10: Delete residue and align docs/env

### Goal

Remove old contracts after the runtime is clean.

### Change

- Update active docs for the new bootstrap/capsule/account model.
- Remove dead env variables and stale helper names.
- Remove dead fallback code left by previous cuts.

### Files to change

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/tokyo-worker.md`
- any env docs that still reference shared-secret capsule verification or Bob account bootstrap

### Delete targets

- Dead env references to `ROMA_AUTHZ_CAPSULE_SECRET` in verifiers
- Dead Bob account bootstrap docs
- Any leftover old bootstrap payload contract descriptions

### Verification

- `rg -n "ROMA_AUTHZ_CAPSULE_SECRET|/api/session/bootstrap|defaults\\.accountId|accountL10nLocales|accountL10nPolicy" documentation roma bob berlin tokyo-worker packages`
- Docs and runtime match

---

## Order constraints

- Cut 1 must happen before Cut 2.
- Cut 3 and Cut 4 should land together or back-to-back.
- Cut 5 should not start until Cut 3 is stable.
- Cut 7 depends on Roma host boot remaining complete and stable.
- Cut 8 should not start until Roma account routes consistently pass the required internal context.
- Cut 10 happens continuously, but the final residue sweep comes last.

---

## Out of scope

- Re-architecting account governance away from Berlin
- Moving Bob public/MiniBob boot to a new system
- Redesigning the Roma product IA or UX
- Replacing all account APIs with a brand-new transport protocol
- Solving unrelated billing/product policy questions beyond what the capsule/bootstrap model requires

---

## Completion proof

070A account-management best-practice closure is done when all of the following are true:

1. Bootstrap writes nothing.
2. Broken product-state provisioning shows up as a producer bug, not a hot-path repair.
3. Roma boots from an explicit `activeAccount` contract.
4. The capsule contains only stable authz truth.
5. No signed authz path carries locale settings or live `used` counters.
6. Only Berlin signs the capsule.
7. Roma refreshes authz before expiry.
8. Bob account mode never bootstraps independently.
9. Tokyo-worker product account routes no longer accept end-user JWT fallback.
10. Account-capsule browser transport in Roma is centralized.
11. Active docs describe exactly that world.

