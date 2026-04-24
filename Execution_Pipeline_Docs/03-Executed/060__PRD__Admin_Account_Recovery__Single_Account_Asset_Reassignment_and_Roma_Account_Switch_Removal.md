# PRD 060 — Admin Account Recovery: Single Account, Asset Reassignment, and Roma Account-Switch Removal

Status: EXECUTED (cloud-dev recovery complete; local repo cleanup/docs aligned)
Date: 2026-03-07
Owner: Product Dev Team
Priority: P0 (cloud-dev recovery and product-surface cleanup)

Execution update (cloud-dev + local):
- Freeze landed locally:
  - Roma finish no longer auto-creates accounts when bootstrap has no account context.
  - Paris account create/handoff paths are frozen to the admin account in non-local stages.
  - Cloud-dev gate scripts no longer mint throwaway accounts.
- Recovery script landed in `scripts/dev/cloud-dev/recover-admin-account-ownership.mjs` with checkpointed stages: `inventory`, `migrate`, `verify`, `delete`.
- Cloud-dev inventory result:
  - `38` non-admin accounts targeted for cleanup
  - `51` user widget rows under those accounts
  - `0` curated rows outside admin
  - `0` surviving widget/overlay asset refs pointing at non-admin assets
- Cloud-dev migrate result:
  - `51` user widget rows moved to admin
  - `0` curated rows needed movement
  - `0` asset refs needed rewriting
- Cloud-dev verify result:
  - `remainingUserInstanceCount = 0`
  - `remainingCuratedInstanceCount = 0`
  - `staleRefs = []`
- Cloud-dev delete result:
  - all `38` non-admin accounts deleted
  - only account left in runtime bootstrap is `Clickeen Admin` (`00000000-0000-0000-0000-000000000100`)
- Important asset note:
  - the recovery script was prepared to rewrite foreign asset refs, but inventory found none in surviving widget rows/overlays
  - two non-admin accounts had orphaned asset manifests with no surviving refs; those were purged during delete rather than reassigned
- Roma cleanup landed locally:
  - Settings switch-account table removed
  - `?accountId=` bootstrap override removed
  - localStorage account preference removed
  - Home/Settings wording now treats Roma as a single-account shell

## What happened

During recent PRD execution, the system drifted into a bad state:

- cloud-dev now contains many junk accounts that were created by gate scripts, auth/account ensure flows, and MiniBob handoff flows
- Roma Settings exposes those accounts directly in product UI and lets users switch between them
- platform-owned widgets and curated instances are mixed into that polluted account graph
- assets were uploaded and persisted under different account IDs, so ownership now feels random
- curated/widget behavior breaks because account-owned asset refs must match the owning account, and that contract is now scattered across junk accounts

This is not a theoretical architecture problem. It is a concrete environment and ownership problem.

## What we do now

We hard-cut cloud-dev back to one real account:

- keep only the admin account: `00000000-0000-0000-0000-000000000100`
- move all surviving widgets, curated instances, and assets to the admin account
- delete all non-admin accounts and their memberships
- remove Roma account switching and cross-account account-management UI/code from the repo

After this PRD:

- cloud-dev has one real working account: admin
- curated widgets/assets are owned by admin only
- Roma stops pretending to be a platform account console
- any future platform-only account tooling belongs in DevStudio, not Roma

## Why we do it this way

Because this is the shortest path back to a sane system.

- We do **not** do a full tenancy redesign here.
- We do **not** rip `account_id` out of the schema in this PRD.
- We do **not** preserve compatibility for junk accounts.

Why:

- the runtime still keys widgets/assets/policies by `account_id`
- changing the whole data model right now would create a much bigger blast radius
- the urgent problem is that cloud-dev ownership is polluted and Roma is exposing that pollution as product UX

So this PRD does the practical fix:

1. stop making more junk
2. move surviving ownership to admin
3. delete polluted data
4. delete the Roma account-switch product surface

## How

Execution is four passes, in this order:

1. **Freeze account creation and account switching**
   - stop Roma finish and MiniBob handoff from creating more accounts
   - stop Roma from honoring `?accountId=` / localStorage account selection

2. **Move widgets and assets to admin**
   - reassign widget rows to admin
   - copy/rewrite asset manifests and variant keys to admin ownership
   - rewrite any widget config or overlay asset refs that still point at old account-owned assets

3. **Delete junk accounts**
   - remove non-admin memberships and account rows after data is safe

4. **Delete Roma account-management traces**
   - remove the account switcher from Settings
   - remove active-account preference code
   - remove any product-facing “use account” behavior from the repo

---

## Context

- PRDs 056/057/058 are closed.
- The documentation drift pass is complete enough that this PRD can now focus on system recovery.
- Canonical integration truth is `cloud-dev`.
- Local is for iteration only.
- Destructive Supabase reset remains prohibited.
- This PRD uses targeted cloud-dev data migration and code deletion only.

Hard environment rule for this PRD:

- **Reads and writes to data are against cloud-dev.**
- **Code changes happen locally in the repo.**
- **No blanket reset of Supabase, no environment wipe, no git history tricks.**

---

## One-line Objective

Collapse cloud-dev back to one real admin-owned account, move all surviving widget/asset ownership to admin, and delete Roma account-switch/account-management behavior from the product shell.

---

## The Real Problem

### 1. Junk accounts were created and left behind

Current sources of junk accounts:

- Roma finish flow auto-creates an account when bootstrap returns none
- MiniBob handoff path can create/ensure accounts
- cloud-dev gate scripts created test accounts and left them in shared state
- fallback naming/slugging created rows like `Account 0ffabf46` and `acct-...`

Concrete code:

- [roma/app/api/session/finish/route.ts](/Users/piero_macpro/code/VS/clickeen/roma/app/api/session/finish/route.ts)
- [paris/src/domains/roma/handoff-account-create.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/roma/handoff-account-create.ts)
- [scripts/dev/cloud-dev/gate1-live-toggle.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate1-live-toggle.mjs)
- [scripts/dev/cloud-dev/gate2-fingerprints.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate2-fingerprints.mjs)
- [scripts/dev/cloud-dev/gate3-locale-pipeline.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate3-locale-pipeline.mjs)
- [scripts/dev/cloud-dev/gate4-locale-policy.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate4-locale-policy.mjs)
- [scripts/dev/cloud-dev/gate5-seo-geo-tier-only.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate5-seo-geo-tier-only.mjs)

### 2. Roma is exposing internal account state as product UI

Current bad behavior:

- Settings shows every account the user belongs to
- Settings lets the user pick “Use account”
- Roma stores active account preference in localStorage
- Roma honors `?accountId=` state in the URL

That is not a customer product shell. That is internal platform control-plane behavior leaking into Roma.

Concrete code:

- [roma/components/settings-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/settings-domain.tsx)
- [roma/components/use-roma-me.ts](/Users/piero_macpro/code/VS/clickeen/roma/components/use-roma-me.ts)
- [paris/src/domains/identity/index.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/identity/index.ts)

### 3. Assets are now tied to polluted account ownership

Current reality:

- canonical asset refs encode account ownership in the version key
- asset manifests are stored under account-specific R2 prefixes
- asset validation enforces that widget config refs must match the owning account
- if widget rows move but asset refs do not, saves and curated behavior break

Concrete code:

- [tokyo-worker/src/domains/assets.ts](/Users/piero_macpro/code/VS/clickeen/tokyo-worker/src/domains/assets.ts)
- [paris/src/shared/assetUsage.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/shared/assetUsage.ts)
- [paris/src/domains/account-instances/helpers.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/account-instances/helpers.ts)

### 4. Cloud-dev scripts still encode the wrong world

The repo still contains scripts that assume:

- test accounts can be created freely in cloud-dev
- password login is part of the normal customer-facing cloud flow
- live-toggle/status semantics are still product reality

Those scripts are part of how the environment got polluted, so this PRD explicitly cleans them too.

---

## Dependency Map Before Deletion

This PRD does **not** delete accounts until every account-linked contract is either moved to admin or confirmed irrelevant.

The recovery script must inventory these concrete dependency surfaces first:

### Database rows

- `accounts.id`
- `account_members.account_id`
- `widget_instances.account_id`
- `curated_widget_instances.owner_account_id`

### Runtime payloads and config refs

- `widget_instances.config`
- `curated_widget_instances.config`
- locale overlay payloads in `OVERLAYS_R2`

### Asset ownership and storage

- account asset manifests under `assets/meta/accounts/{accountId}/assets/*.json`
- canonical asset blob keys under `assets/versions/{accountId}/...`

### Product/runtime contracts that currently expose multi-account behavior

- Roma bootstrap payload `accounts[]` and `defaults.accountId`
- Roma localStorage active-account preference
- Roma `?accountId=` override behavior

No deletion is allowed until the inventory pass proves that every non-admin dependency is either:

1. migrated to admin, or
2. explicitly listed as disposable in the recovery report

---

## Target State

After PRD 060:

### Accounts

- the only surviving cloud-dev account is the admin account
- all intended human users are members of the admin account
- no Roma product flow auto-creates accounts in cloud-dev
- Roma no longer supports account switching

### Widgets and curated instances

- `widget_instances.account_id = admin` for all surviving rows
- `curated_widget_instances.owner_account_id = admin` for all surviving rows
- Roma Widgets shows admin-owned rows only because that is the only real account

### Assets

- every surviving asset manifest is owned by admin
- every surviving asset variant key is rewritten to the admin account path
- every surviving widget config / locale overlay asset ref points at the admin-owned canonical version path

### Roma

- Settings does not contain a switch-account table
- there is no “Use account” action
- there is no stored active-account preference
- Roma resolves one account context only

---

## Scope

### In scope

- cloud-dev account cleanup
- cloud-dev widget/account/asset ownership migration to admin
- deleting non-admin accounts
- deleting Roma account-switch/account-management product behavior
- deleting or rewriting cloud-dev scripts that manufacture junk accounts
- documentation updates for accounts/assets/Roma after execution

### Explicitly not in scope

- dropping the `accounts` table
- removing `account_id` from widget/asset/runtime contracts
- rewriting the entire tenancy model
- a general “account admin console” in DevStudio
- local Supabase reset or local data cleanup beyond what the code changes naturally affect

Important practical note:

This PRD collapses the runtime and shared data to one account.  
It does **not** remove the account schema itself. That is a separate, bigger architectural decision.

---

## Execution Plan

This PRD executes in **4 passes**, not 7:

1. freeze creation/switching
2. run the recovery script through inventory -> migrate -> verify -> delete checkpoints
3. remove Roma account-switch code
4. update docs and close out

The recovery script is one file, but it must be **stage-based and rerunnable**.

Required interface:

- `--stage=inventory --dry-run`
- `--stage=migrate --apply`
- `--stage=verify`
- `--stage=delete --apply`

Required behavior:

- every stage writes a machine-readable checkpoint report
- rerunning a finished stage is safe
- `delete` refuses to run unless `verify` has passed
- `verify` refuses to pass if any non-admin account refs remain in rows, manifests, or overlays

Suggested checkpoint output location:

- `.artifacts/prd-060/` in local repo workspace for reports only

### Pass 1 — Freeze new junk account creation and account switching

### Goal

Make sure the system stops creating new non-admin accounts before any cleanup starts.

### Changes

1. **Roma finish must stop auto-creating accounts**
   - remove the `createAccountIfNeeded(...)` path from `GET /api/session/finish`
   - if bootstrap has no valid admin account context, fail clearly instead of creating a new account

2. **MiniBob handoff must stop creating new accounts**
   - handoff completion must resolve into the admin account only
   - if the user is not a member of admin, fail cleanly instead of minting a new account

3. **Cloud-dev scripts must stop creating test accounts**
   - remove or rewrite the current gate scripts so they use the admin account only
   - any “create account, run test, leave it behind” behavior is deleted

### Files touched

- [roma/app/api/session/finish/route.ts](/Users/piero_macpro/code/VS/clickeen/roma/app/api/session/finish/route.ts)
- [paris/src/domains/roma/handoff-account-create.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/roma/handoff-account-create.ts)
- [scripts/dev/cloud-dev/gate1-live-toggle.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate1-live-toggle.mjs)
- [scripts/dev/cloud-dev/gate2-fingerprints.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate2-fingerprints.mjs)
- [scripts/dev/cloud-dev/gate3-locale-pipeline.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate3-locale-pipeline.mjs)
- [scripts/dev/cloud-dev/gate4-locale-policy.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate4-locale-policy.mjs)
- [scripts/dev/cloud-dev/gate5-seo-geo-tier-only.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/gate5-seo-geo-tier-only.mjs)

### Acceptance for Pass 1

- signing into cloud-dev does not create a new account
- MiniBob publish/signup does not create a new account
- no gate script in repo creates a non-admin account

---

### Pass 2 — Run the recovery script with checkpoints

### Goal

Move all surviving ownership to admin with explicit checkpoint gates.

### Changes

Create one one-off cloud-dev recovery script that runs in stages.

Suggested new file:

- [scripts/dev/cloud-dev/recover-admin-account-ownership.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/recover-admin-account-ownership.mjs)

### `inventory` stage must report

1. all non-admin accounts
2. all memberships on those accounts
3. all `widget_instances` not owned by admin
4. all `curated_widget_instances` not owned by admin
5. all asset manifests not owned by admin
6. all asset refs in widget configs that still point to non-admin assets
7. any locale overlays that still point to non-admin assets

### `migrate` stage must do

1. move `widget_instances.account_id` to admin
2. move `curated_widget_instances.owner_account_id` to admin
3. copy manifests from old account prefixes to admin prefixes
4. rewrite manifest `accountId`
5. copy blobs to admin-owned canonical keys
6. build an `oldVersionId -> newVersionId` map
7. rewrite asset refs in:
   - `widget_instances.config`
   - `curated_widget_instances.config`
   - locale overlays in `OVERLAYS_R2`
8. re-enqueue mirror/publish jobs for affected published instances

### `verify` stage must prove

1. no surviving row is owned by a non-admin account
2. no surviving asset manifest is owned by a non-admin account
3. no surviving widget config points at a non-admin asset version
4. no surviving locale overlay points at a non-admin asset version
5. curated widgets render with their assets again

### `delete` stage may only run when all of the below are true

1. `verify` passed
2. checkpoint report shows zero non-admin refs in rows/configs/overlays/manifests
3. a recovery report has been written locally

### FK-safe delete order inside `delete`

The script must delete non-admin account data in this order only:

1. stale handoff/idempotency records that still reference non-admin accounts
2. non-admin `account_members`
3. non-admin `accounts`

Delete is blocked if any of these still exist for a non-admin account:

- `widget_instances.account_id`
- `curated_widget_instances.owner_account_id`
- asset manifests under non-admin account prefixes
- asset blobs under non-admin canonical account paths
- widget config refs or overlay refs pointing at non-admin asset versions

### Hard gate inside Pass 2

There is **no** valid partial-success state where:

- rows moved but refs were not rewritten
- refs were rewritten but overlays were not
- old blobs/manifests were deleted before verify passed

If migration is interrupted, rerun the current stage until checkpoints are clean.  
Do **not** advance to `delete`.

### Files touched

- [scripts/dev/cloud-dev/recover-admin-account-ownership.mjs](/Users/piero_macpro/code/VS/clickeen/scripts/dev/cloud-dev/recover-admin-account-ownership.mjs) (new)

### Recovery script guardrail

This is a one-off recovery script, not a runtime refactor.  
Do **not** touch Tokyo-worker or Paris runtime code unless an actual blocker is discovered during execution.  
Default assumption: the script does all migration work itself.

---

### Pass 3 — Remove Roma account-switch and account-management code

### Goal

Delete the product-shell account-management behavior from Roma so the repo stops teaching the wrong model.

### Changes

1. remove the Settings “Switch account” table
2. remove “Use account”
3. remove localStorage active-account preference
4. remove `?accountId=` override from Roma account context loading
5. stop treating bootstrap as a many-account selector contract
6. keep only the active admin account context Roma actually needs

### Practical target

After this phase:

- Settings may show the current admin account summary if still useful
- Settings must not expose multi-account control-plane behavior
- Roma should behave like a one-account product shell in cloud-dev

### Files touched

- [roma/components/settings-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/settings-domain.tsx)
- [roma/components/use-roma-me.ts](/Users/piero_macpro/code/VS/clickeen/roma/components/use-roma-me.ts)
- [roma/components/billing-domain.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/billing-domain.tsx)
- [roma/components/roma-account-notice-modal.tsx](/Users/piero_macpro/code/VS/clickeen/roma/components/roma-account-notice-modal.tsx)
- [paris/src/domains/identity/index.ts](/Users/piero_macpro/code/VS/clickeen/paris/src/domains/identity/index.ts)
- [documentation/services/roma.md](/Users/piero_macpro/code/VS/clickeen/documentation/services/roma.md)

### Acceptance for Pass 3

- no account switch UI exists in Roma
- no active-account preference code exists in Roma
- no Roma code path depends on cross-account switching

---

### Pass 4 — Remove stale repo traces and update docs

### Goal

Make the repo truthful again.

### Changes

1. delete or rewrite stale cloud-dev scripts that still encode junk-account creation flows
2. update docs so they say:
   - cloud-dev currently operates with one admin account
   - Roma is not the platform account-management console
   - curated assets/widgets are admin-owned
3. update any PRD execution notes affected by this cleanup

### Files touched

- [documentation/architecture/CONTEXT.md](/Users/piero_macpro/code/VS/clickeen/documentation/architecture/CONTEXT.md)
- [documentation/architecture/Overview.md](/Users/piero_macpro/code/VS/clickeen/documentation/architecture/Overview.md)
- [documentation/services/roma.md](/Users/piero_macpro/code/VS/clickeen/documentation/services/roma.md)
- [documentation/services/devstudio.md](/Users/piero_macpro/code/VS/clickeen/documentation/services/devstudio.md)
- [documentation/services/tokyo-worker.md](/Users/piero_macpro/code/VS/clickeen/documentation/services/tokyo-worker.md)
- [documentation/README.md](/Users/piero_macpro/code/VS/clickeen/documentation/README.md)

### Acceptance for Pass 4

- `documentation/` matches the executed code and cloud-dev state
- there is no remaining doc story that says Roma is a multi-account switchboard

---

## Verification

## Data verification (cloud-dev)

Must pass:

1. only admin account remains for runtime use
2. all surviving widgets belong to admin
3. all surviving curated rows belong to admin
4. all surviving assets belong to admin
5. no widget config contains non-admin asset refs
6. no locale overlay contains non-admin asset refs

## Product verification

Must pass:

1. Roma login lands in admin context
2. Roma Settings has no switch-account UI
3. Roma Widgets loads curated + main/admin-owned rows correctly
4. Assets page shows admin-owned assets only
5. Bob can open/edit curated and main/admin-owned rows without account mismatch errors
6. curated widgets render correctly in Prague/Venice after re-mirroring

## Repo verification

Must pass:

- `git diff --check`
- relevant lint/typecheck for touched apps
- recovery script supports `inventory`, `migrate`, `verify`, and `delete` stages
- documentation updated before PRD moves to `03-Executed`

---

## Risks

### Risk 1 — Asset refs are missed in overlays

Mitigation:

- scan both base config and locale overlays
- do not delete old blobs/manifests until verification passes

### Risk 2 — Roma still has hidden assumptions about multi-account payloads

Mitigation:

- remove switching code first in one pass
- grep for `accountId` URL overrides, localStorage active-account code, `Use account`, `Switch account`

### Risk 3 — cloud-dev sign-in breaks for non-admin members

Mitigation:

- ensure intended human users are members of admin before hard-cutting account creation
- fail clearly instead of silently creating more accounts

---

## Non-negotiable execution rules

1. No destructive Supabase reset.
2. No “keep old accounts around just in case” compatibility layer.
3. No new Roma account-admin subsystem.
4. No DevStudio expansion in this PRD.
5. No schema-theory rewrite; this PRD is recovery and simplification.

---

## Definition of Done

PRD 060 is done only when all of the below are true:

1. cloud-dev effectively operates on one real account: admin
2. all surviving widgets and curated rows belong to admin
3. all surviving assets and asset refs belong to admin
4. all non-admin accounts are deleted
5. Roma no longer contains account-switch/account-management product behavior
6. stale scripts are removed or rewritten
7. `documentation/` fully reflects the new reality
