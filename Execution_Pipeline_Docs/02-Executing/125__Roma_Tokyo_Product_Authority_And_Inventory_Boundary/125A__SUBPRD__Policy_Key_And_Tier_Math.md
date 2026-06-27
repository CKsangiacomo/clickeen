# 125A SubPRD: Policy Key And Tier Math

Status: Draft for review
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: `@clickeen/ck-policy`, direct Roma policy reads, Berlin/Roma shared policy deployment, multitenancy docs

## 0. Parent Law

This subPRD implements only the policy-key and tier-math slice of PRD 125.

Hard inheritance:

- Roma owns account policy enforcement.
- Tokyo does not decide tier policy.
- Michael/Supabase provides account relational facts; it is not the entitlement
  matrix and not Widgets inventory.
- Full widget catalog remains visible to every tier.
- This slice removes the active `widgets.types.max` key and installs finite
  `widgets.instances.max` and `instances.published.max` matrix values.
- Exact HTTP 402 command responses and client upgrade popup handling are owned
  by 125E unless this slice is explicitly merged with 125E.
- No `widgets.types.max` active policy/read/doc remains after this slice.
- This slice is part of the single PRD 125 pre-GA cut. It must not deploy alone
  or create a deployed old/new policy coexistence window.

## 1. Current Runtime Facts

Current active policy files:

```text
packages/ck-policy/src/registry.ts
packages/ck-policy/entitlements.matrix.json
```

Current wrong key:

```text
widgets.types.max
```

Current publish key:

```text
instances.published.max
```

Current direct `widgets.types.max` references:

```text
packages/ck-policy/src/registry.ts
packages/ck-policy/entitlements.matrix.json
roma/app/api/account/widgets/route.ts
roma/app/api/account/instances/route.ts
documentation/capabilities/multitenancy.md
```

Related callers owned by other slices:

```text
roma/app/api/account/instances/[instanceId]/duplicate/route.ts
roma/app/api/account/instances/[instanceId]/publish/route.ts
roma/components/use-roma-widgets.ts
roma/components/widgets-domain.tsx
```

Ownership split:

- 125A removes active policy-key references and installs finite matrix values.
- 125D removes old Widgets list payload and client monetization availability.
- 125E adds the missing duplicate gate and exact HTTP 402 command responses.

## 2. Target Contract

Replace the active create/duplicate entitlement key:

```text
remove: widgets.types.max
add:    widgets.instances.max
```

`widgets.instances.max` means:

```text
Maximum widget instances an account can create through create-like actions.
```

Create-like actions:

```text
Create instance
Duplicate
```

`widgets.instances.max` does not mean:

```text
widget type access
catalog visibility
catalog filtering
opening an already-saved widget
using an already-saved widget
Tokyo storage permission
disabled Create/Duplicate controls
```

Tier values:

```json
{
  "free": 3,
  "tier1": 10,
  "tier2": 25,
  "tier3": 100,
  "tier4": 250
}
```

Update `instances.published.max` to finite values:

```json
{
  "free": 1,
  "tier1": 1,
  "tier2": 5,
  "tier3": 25,
  "tier4": 100
}
```

Invariant:

```text
For every tier: widgets.instances.max >= instances.published.max
```

## 3. Execution Steps

### Step 1: Registry Rename

Edit `packages/ck-policy/src/registry.ts`.

Required changes:

- remove `widgets.types.max` from `ENTITLEMENT_KEYS`;
- add `widgets.instances.max`;
- remove `widgets.types.max` from `PLAN_LIMIT_KEYS`;
- add `widgets.instances.max`;
- replace `ENTITLEMENT_META['widgets.types.max']` with
  `ENTITLEMENT_META['widgets.instances.max']`.

Metadata requirements:

```text
label: Widget instances
description: Maximum widget instances the account can create through create-like actions.
enforcement.owner: Roma create and duplicate routes
enforcement.note: Roma enforces this only when Create instance or Duplicate would create another account widget instance.
```

Compliance:

This keeps tier policy in Roma/account policy and removes the false widget-type
gate.

### Step 2: Matrix Values

Edit `packages/ck-policy/entitlements.matrix.json`.

Required changes:

- rename `widgets.types.max` to `widgets.instances.max`;
- set values to `3/10/25/100/250`;
- set `instances.published.max` to `1/1/5/25/100`;
- leave other keys untouched.

Compliance:

This gives Roma finite account policy facts without inventing a saved-instance
policy key or moving policy to Tokyo.

### Step 3: Direct Runtime References

Remove active `widgets.types.max` reads.

`roma/app/api/account/instances/route.ts`:

- stop counting distinct widget types;
- after the 125C coordinate helper exists, use
  `listAccountWidgetInstanceIds().instanceIds.length` for
  `widgets.instances.max`;
- if 125A is executed before 125C, do not release the create-route migration
  until the coordinate helper exists;
- do not mention `widgets.types.max` in details;
- do not implement exact HTTP 402 popup response here unless 125A is merged
  with 125E.
- do not count Tokyo `accountInstances[]`;
- do not open config, serve-state, content, overlays, or package files just to
  enforce the create limit.

`roma/app/api/account/widgets/route.ts`:

- remove tier/monetization create availability from the list response;
- do not preserve the old payload shape for staged deploy;
- if this file is touched in the same branch, make it conform to the 125D
  payload contract before deploy;
- do not introduce an instance-count disabled control;
- do not compute `canCreate` from `widgets.instances.max`.

`roma/app/api/account/instances/[instanceId]/duplicate/route.ts`:

- do not list this as a simple replacement; current duplicate has no
  `widgets.types.max` read;
- adding its missing create-like gate is 125E work unless 125A is merged with
  125E.

Forbidden after this slice:

```text
policy.limits['widgets.types.max']
widgets.types.max in user-facing error details
widgets.types.max in active policy docs
```

Do not edit publish behavior in this subPRD except for preserving the new finite
`instances.published.max` values; exact publish HTTP 402 behavior is executed
in 125E.

Compliance:

This prevents policy-name compatibility aliases and keeps the blast radius
inside policy lookup and named callers.

### Step 3A: Active Docs Update

Edit `documentation/capabilities/multitenancy.md`.

Required changes:

- replace the operational example `widget create enforces widgets.types.max`
  with `Create instance and Duplicate enforce widgets.instances.max`;
- replace the entitlement table row for `widgets.types.max` with
  `widgets.instances.max`;
- set enforcement owner to `Roma create and duplicate command routes`;
- document finite `widgets.instances.max` and `instances.published.max` tier
  values;
- document the invariant `widgets.instances.max >= instances.published.max`;
- remove any active-doc wording that describes widget type limits, system widget
  limits, catalog filtering, or disabled create options.

Compliance:

Active docs must not keep the old widget-type entitlement alive for future
agents.

### Step 4: Arithmetic Guard

Add:

```text
packages/ck-policy/tests/run-entitlements-matrix-invariants.ts
```

Add package script:

```json
{
  "test:entitlements": "tsx tests/run-entitlements-matrix-invariants.ts"
}
```

Required assertion:

```text
registry keys and matrix keys match exactly
widgets.instances.max exists
widgets.types.max does not exist
every widgets.instances.max tier value is finite
every instances.published.max tier value is finite
for every tier: widgets.instances.max >= instances.published.max
```

Compliance:

This is not a runtime probe. It is a code contract check for the static policy
matrix.

### Step 5: Deploy And Session Blast Radius

`@clickeen/ck-policy` is shared by Roma and Berlin. Berlin mints bootstrap
entitlement snapshots and Roma consumes account/authz policy.

125A must be released with coordinated Berlin and Roma deployment evidence, or
must stay in the same implementation branch until the dependent Roma
command/client slices are complete. There is no deployed old/new policy
coexistence window.

Required deploy/session verification after code deployment:

```text
GET /api/bootstrap
one authenticated Roma account route that consumes account policy
```

Compliance:

This prevents old/new entitlement snapshots from failing open or failing closed
silently across separately deployed Berlin and Roma surfaces.

## 4. Non-Goals

This subPRD must not:

- change Tokyo code;
- change R2 paths;
- create `instances.saved.max`;
- hide catalog widgets by tier;
- disable Create/Duplicate buttons;
- implement upgrade popup UI;
- route Widgets inventory through Supabase/Michael;
- add compatibility aliases for `widgets.types.max`.
- deploy as an isolated production/runtime release without Berlin and Roma
  policy-session verification.

## 5. Verification

Required commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/berlin typecheck
pnpm --filter @clickeen/ck-policy typecheck
pnpm --filter @clickeen/ck-policy test:entitlements
```

```bash
rg "widgets\\.types\\.max" packages/ck-policy roma berlin documentation/capabilities/multitenancy.md
```

Expected result:

- no active runtime/policy references;
- only historical PRD references may remain outside active code/docs.

## 6. V1-V8 Audit

- V1: no invented fallback key or alias.
- V2: no silent policy normalization.
- V3: no lost publish limit update.
- V4: no `null` limits.
- V5: no missing key treated as unlimited.
- V6: no policy-key slice claimed complete while command behavior is still
  owned by 125E.
- V7: no `widgets.types.max` under another wrapper.
- V8: no runtime dependence on test probes.

## 7. Done

This subPRD is done when:

1. `widgets.instances.max` is active in registry and matrix.
2. `widgets.types.max` is removed from active policy code.
3. `instances.published.max` is finite for every tier.
4. `widgets.instances.max >= instances.published.max` for every tier.
5. Roma create policy reads use `widgets.instances.max` by
   `listAccountWidgetInstanceIds().instanceIds.length`; if 125A is implemented
   before 125C, this runtime change is not deployed until the coordinate helper
   exists in the same branch.
6. Widgets list payload no longer uses any tier limit to disable Create.
7. Duplicate gate is explicitly deferred to 125E unless 125A is merged with
   125E and returns exact HTTP 402.
8. `documentation/capabilities/multitenancy.md` names
   `widgets.instances.max` and contains no active `widgets.types.max` policy
   reference.
9. `@clickeen/ck-policy` invariant test and typecheck are green.
10. Roma typecheck/lint are green.
11. Berlin typecheck is green.
12. Berlin/Roma session blast radius is verified after the coordinated pre-GA
    cut deploy.
