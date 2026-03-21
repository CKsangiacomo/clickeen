# 075F - Delete Ghost Scaffolding And Dead Future Product Paths

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md`
- `documentation/architecture/CONTEXT.md`

---

## What This PRD Is About

This PRD is about one narrow cleanup job:

Delete product-path scaffolding that still teaches the repo a Builder product that does not exist.

This is not a broad refactor PRD.
This is not a "simplify whatever looks old" PRD.

It is a deletion ledger for specific dead branches, dead type members, and stale residue that survive inside the active authoring path.

---

## Product Truth

The active authoring product is:

1. Roma hosts Builder for the current account.
2. Bob runs inside that Roma-hosted Builder session.
3. Bob edits one widget in memory.
4. Account commands go through the Roma host boundary.
5. Roma saves that widget to Tokyo.

If shared code still teaches:

- Bob as a standalone account client
- AI execution surfaces that do not exist
- grant-budget systems that do not exist
- dead parameters that imply state is seeded from a concern that is not used

then that code should be deleted.

---

## Non-Negotiable Preserves

These are not deletion targets in `75F`:

- `curated` is live product truth and must survive.
- The real Roma -> Bob Builder host path must survive.
- The real Bob `ck:open-editor` boot contract must survive.
- Live widget copilot, localization, and personalization policy must survive.

`75F` must not delete a concept just because it looks like an alternate mode.
It must delete only concepts that are proven to be dead on the real current product path.

---

## In Scope

This PRD covers:

- dead Bob authoring-path fallback branches that preserve a fake standalone account mode
- dead shared AI type members that advertise execution or budget systems the product does not have
- dead parameters and stale authoring-path residue that imply product behavior that is not real

This PRD does not cover:

- `curated` / templates / starter designs
- localization cleanup from `75E`
- Minibob/demo identity cleanup from `75C`
- asset-path cleanup from `75B`
- broad registry or policy redesign

---

## The Surviving Authorities

- Roma host owns account-command dispatch for Builder.
- Bob owns in-memory editing only.
- Tokyo save remains the one widget save boundary.
- Shared AI policy types may advertise only real execution surfaces and real live budget fields.

If a field or branch survives after `75F`, it must have a real current owner.

---

## Execution Ledger

### Slice 1 - Delete Bob's Fake Standalone Account-Command Path

#### Why

The product has one real Builder topology:

- Roma hosts Builder
- Bob runs in the iframe
- Bob delegates account commands through the Roma host

`bob/lib/session/sessionTransport.ts` still preserves a second authoring story:

- Bob directly fetching account asset/account command routes itself

That second story is not the product.

#### Delete

- direct asset fallback branches in `accountAssets.listAssets`
- direct asset fallback branches in `accountAssets.resolveAssets`
- direct asset fallback branches in `accountAssets.uploadAsset`
- direct `executeAccountCommand` fallback path
- any now-dead hosted/non-hosted branching that only exists to preserve Bob-as-standalone account mode

#### Files

- `bob/lib/session/sessionTransport.ts`
- `bob/components/ToolDrawer.tsx` only if dead transport error copy disappears
- any Bob session type file only if needed for fallout cleanup

#### Must Preserve

- non-command direct fetches that are still real, such as same-origin panel/API reads that are not host-dispatched account commands
- the Roma host message boundary

#### Verification Gate

- no Bob direct fetch remains for:
  - `/api/account/assets`
  - `/api/account/assets/resolve`
  - `/api/account/assets/upload`
- Bob save still works through the Roma host path
- Bob asset list/resolve/upload still works through the Roma host path
- Bob copilot/account command flow still works through the Roma host path
- `pnpm exec tsc -p bob/tsconfig.json --noEmit`
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`

---

### Slice 2 - Delete Dead AI Execution Surface `queue`

#### Why

`AiExecutionSurface` still advertises `queue`, but the live registry only uses:

- `execute`
- `endpoint`

`queue` teaches the repo that a third AI dispatch system exists when it does not.

#### Delete

- `'queue'` from `AiExecutionSurface`
- any now-dead switch/if branches that only exist because `queue` was in the union

#### Files

- `packages/ck-policy/src/ai.ts`
- any fallout file that typechecks against `AiExecutionSurface`

#### Verification Gate

- no live registry entry uses `queue`
- no branch remains that handles `queue`
- `pnpm exec tsc -p sanfrancisco/tsconfig.json --noEmit`
- `pnpm exec tsc -p admin/tsconfig.json --noEmit`

---

### Slice 3 - Delete Dead Rolling Token Budget Fields

#### Why

`AiGrantPolicy` still advertises:

- `tokenBudgetDay`
- `tokenBudgetMonth`

Those fields imply a rolling token-budget system that the product does not populate or enforce.

The real live budget surface remains:

- `budgetsByProfile`
- `AiBudget.maxTokens`
- `AiBudget.timeoutMs`
- `AiBudget.maxRequests`

#### Delete

- `tokenBudgetDay`
- `tokenBudgetMonth`
- any parsing/serialization code that exists only for those fields

#### Files

- `packages/ck-policy/src/ai.ts`
- `sanfrancisco/src/grants.ts`

#### Must Preserve

- real live entitlement and budget registry
- real live per-profile AI budgets

#### Verification Gate

- no `tokenBudgetDay` remains in product code
- no `tokenBudgetMonth` remains in product code
- `AiGrantPolicy` names only live fields
- `pnpm exec tsc -p sanfrancisco/tsconfig.json --noEmit`
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`
- `pnpm exec tsc -p bob/tsconfig.json --noEmit`

---

### Slice 4 - Delete Dead Session Initial-State Parameter

#### Why

`createInitialSessionState(policy)` accepts a `policy` parameter and then discards it.

That signature teaches callers that policy seeds initial session state.
It does not.

#### Delete

- the unused `policy` parameter
- any dead call-site argument

#### Files

- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/WidgetDocumentSession.tsx`

#### Verification Gate

- no `void policy`
- no caller passes a policy into `createInitialSessionState`
- `pnpm exec tsc -p bob/tsconfig.json --noEmit`

---

### Slice 5 - Delete Stale Builder Error Residue

#### Why

The active Builder product path is not Paris-proxied authoring.
Stale Builder error copy must stop teaching that old path.

#### Delete

- stale Paris-era Builder open error copy

#### Files

- `roma/components/builder-domain.tsx`

#### Verification Gate

- no stale Paris Builder-open error copy remains on the active authoring path
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`

---

## Conditional Slice - `debug.grantProbe`

This slice is not automatic.

`debug.grantProbe` is not dead code.
It is live dev/ops probe code currently normalized into the shared AI registry.

This slice should execute only if product direction is:

- product AI registry should contain product agents only

If that direction is confirmed, then:

- move/gate/delete `debug.grantProbe`
- remove its budget entry
- preserve any deliberate dev-only replacement path if needed

If that direction is not confirmed, defer this slice.

---

## Deferred Slice - Preview Host Cleanup

This slice is not part of core `75F` unless separately proven safe.

`PreviewSettings.host` still advertises:

- `canvas`
- `column`
- `banner`
- `floating`

Those values still affect Workspace and CSS.

So this is not a one-line enum cleanup.

Do not execute this slice inside core `75F` unless all of the following are true:

1. non-canvas host values are proven unreachable in product UX
2. runtime branches for them are removed
3. CSS branches for them are removed
4. canvas preview still behaves correctly after deletion

If that proof does not exist, defer the slice.

---

## Files Touched

Core `75F` files:

- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/WidgetDocumentSession.tsx`
- `roma/components/builder-domain.tsx`
- `packages/ck-policy/src/ai.ts`
- `sanfrancisco/src/grants.ts`

Possible fallout files:

- `bob/components/ToolDrawer.tsx`
- `admin/src/main.ts`
- any file that only type-falls out from the narrowed AI policy types

---

## Verification Plan

Each slice must go green before the next slice starts.

Required typechecks:

- `pnpm exec tsc -p bob/tsconfig.json --noEmit`
- `pnpm exec tsc -p roma/tsconfig.json --noEmit`
- `pnpm exec tsc -p sanfrancisco/tsconfig.json --noEmit`
- `pnpm exec tsc -p admin/tsconfig.json --noEmit`

Required residual audit after core `75F` slices:

- no Bob direct fetch to `/api/account/assets`
- no Bob direct fetch to `/api/account/assets/resolve`
- no Bob direct fetch to `/api/account/assets/upload`
- no `AiExecutionSurface` member `queue`
- no `tokenBudgetDay`
- no `tokenBudgetMonth`
- no dead `createInitialSessionState(policy)` signature
- no stale Paris Builder-open error copy
- `curated` still survives where product needs it

---

## Done Means

`75F` is done only when:

- Bob no longer teaches a fake standalone account-command authoring mode
- shared AI policy types advertise only real live execution surfaces and live budget fields
- Bob session initialization signatures stop implying policy-seeded state when none exists
- stale authoring-path residue is deleted
- `curated` survives untouched as live product truth
- the real Roma -> Bob Builder host path remains the only authoring host story
- the residual audit above is empty for the executed slices

This PRD is successful only if the codebase is narrower and more honest without deleting live product truth.
