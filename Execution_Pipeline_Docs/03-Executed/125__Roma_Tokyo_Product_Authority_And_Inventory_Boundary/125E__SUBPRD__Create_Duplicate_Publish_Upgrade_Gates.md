# 125E SubPRD: Create Duplicate Publish Upgrade Gates

Status: Executed
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: Roma command routes and Widgets action handlers

## 0. Parent Law

Upgrade happens from user intent. Create, Duplicate, and Publish remain
clickable. Roma checks policy at command time.

Tokyo may be called for storage facts through 125C helpers before the gate.
Tokyo must not receive create, duplicate, publish, materialized package, or
serve-state transition writes after an over-tier gate.

125E is part of the single PRD 125 pre-GA cut. It depends on the new policy
key, the coordinate helpers, and the clickable Widgets client model. It must
not deploy as a standalone partial cut.

## 1. Owned Files

Primary command routes:

```text
roma/app/api/account/instances/route.ts
roma/app/api/account/instances/[instanceId]/duplicate/route.ts
roma/app/api/account/instances/[instanceId]/publish/route.ts
```

Primary client files:

```text
roma/components/widgets-domain.tsx
roma/components/use-roma-widgets.ts
```

Supporting copy:

```text
roma/lib/account-shell-copy.ts
```

## 2. Required Response Contract

Create over entitlement:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "ok": false,
  "kind": "UPGRADE_REQUIRED",
  "upgrade": {
    "gate": "widgets.instances.max",
    "action": "create_instance",
    "current": 3,
    "limit": 3
  }
}
```

Duplicate over entitlement:

```json
{
  "ok": false,
  "kind": "UPGRADE_REQUIRED",
  "upgrade": {
    "gate": "widgets.instances.max",
    "action": "duplicate_instance",
    "current": 3,
    "limit": 3
  }
}
```

Publish over entitlement:

```json
{
  "ok": false,
  "kind": "UPGRADE_REQUIRED",
  "upgrade": {
    "gate": "instances.published.max",
    "action": "publish_instance",
    "current": 5,
    "limit": 5
  }
}
```

The body must not be wrapped under `error`.

Policy limit contract:

```text
widgets.instances.max and instances.published.max must exist as finite numbers.
Missing, non-finite, null, or malformed limits are internal policy contract
failures. They do not become unlimited usage, generic permission errors, or
UPGRADE_REQUIRED popups.
```

Policy contract failure response:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json
```

```json
{
  "error": {
    "kind": "UPSTREAM_UNAVAILABLE",
    "reasonKey": "roma.errors.policy.invalidEntitlement",
    "detail": "widgets.instances.max"
  }
}
```

## 3. Create Route

`roma/app/api/account/instances/route.ts` must:

1. resolve current account and policy;
2. call `listAccountWidgetInstanceIds`;
3. require finite `widgets.instances.max`;
4. if `instanceIds.length >= widgets.instances.max`, return HTTP 402
   `UPGRADE_REQUIRED`;
5. if within tier, proceed with existing create/materialize/Tokyo write path.

It must not:

- open list-facts just to count;
- use widget type set;
- read `widgets.types.max`;
- generate the new instance id before the over-tier gate;
- compile widget software before the over-tier gate;
- materialize package bytes before the over-tier gate;
- call Tokyo create/write routes when over tier.

## 4. Duplicate Route

`roma/app/api/account/instances/[instanceId]/duplicate/route.ts` must:

1. resolve current account and policy;
2. validate the source `instanceId` belongs to the current account by loading the
   exact source instance;
3. if source load fails, return that failure visibly and do not create,
   materialize, or write anything;
4. call `listAccountWidgetInstanceIds`;
5. require finite `widgets.instances.max`;
6. if `instanceIds.length >= widgets.instances.max`, return HTTP 402
   `UPGRADE_REQUIRED`;
7. if within tier, proceed with existing duplicate/materialize/Tokyo create path.

It must not:

- generate the new instance id before the over-tier gate;
- materialize package bytes before the over-tier gate;
- call Tokyo create/write routes when over tier;
- report duplicate success after source load, package materialization, or Tokyo
  write failure.

## 5. Publish Route

`roma/app/api/account/instances/[instanceId]/publish/route.ts` must:

1. resolve current account and policy;
2. call `loadAccountWidgetInstanceFacts`;
3. find the target instance;
4. count `publishStatus === 'published'`;
5. if target is already published, preserve current idempotent behavior;
6. require finite `instances.published.max`;
7. if target is not already published and
   `publishedCount >= instances.published.max`, return HTTP 402
   `UPGRADE_REQUIRED`;
8. if within tier, call Tokyo publish transition.

It must not:

- ask Tokyo for `publishedCount`;
- use `/instances/facts`;
- wrap upgrade response under generic `error`;
- call Tokyo publish transition when over tier;
- show upgrade for an already-published target.

## 6. Client Action Handling

Widgets action handlers must inspect HTTP 402 JSON before generic error parsing.

Required client behavior:

```text
if body.kind === "UPGRADE_REQUIRED":
  open upgrade popup with gate, action, current, limit
else:
  use normal product error handling
```

The upgrade popup must render:

- primary copy:
  - Create/Duplicate: "Upgrade to create more widgets."
  - Publish: "Upgrade to publish more widgets."
- current/limit context;
- upgrade CTA.

`gate` and `action` are routing/data fields only. They must never render as
user-facing copy.

Forbidden:

- tooltip-only upgrade;
- title-only upgrade;
- toast-only upgrade;
- disabled control;
- generic permission dialog;
- raw `reasonKey` copy.
- raw `widgets.instances.max`, `instances.published.max`, `create_instance`,
  `duplicate_instance`, or `publish_instance` copy.

Implementation constraint:

```text
Widgets action handlers must use existing raw response capability where needed
(`accountApi.fetchRaw`) so HTTP 402 JSON can be inspected before generic
`fetchJson` error mapping. Do not add a new transport abstraction for this.
```

## 6A. Pre-GA Cut Gate

125E must not deploy alone.

Required same-branch dependencies before deploy:

```text
125A widgets.instances.max and finite instances.published.max
125B Tokyo coordinate/list-facts route contract
125C Roma coordinate/list-facts helpers
125D clickable Widgets API/client payload
125F old facts/list-summary removal
```

Compliance:

This prevents old list-time disabled controls, old 403 redress, and old Tokyo
payload assumptions from surviving beside the command-time upgrade model.

## 6B. Docs Handoff

Update current docs in 125G before PRD 125 acceptance.

Docs affected by 125E behavior:

```text
documentation/services/roma.md
documentation/capabilities/multitenancy.md
documentation/architecture/CONTEXT.md
```

Required doc facts:

- Create/Duplicate enforce `widgets.instances.max` at command time;
- Publish enforces `instances.published.max` at command time;
- over-tier commands return HTTP 402 `UPGRADE_REQUIRED`;
- Widgets list payload does not own monetization availability;
- upgrade UI copy is human product copy, not raw policy keys.

## 7. Non-Goals

This subPRD must not:

- change catalog/list payload shape beyond consuming 125D's result;
- change Tokyo storage behavior;
- change public serving;
- add queues/jobs/probes;
- add a saved-instance policy key;
- hide or disable controls by tier;
- fall back to `widgets.types.max`;
- wrap upgrade responses under generic error payloads.

## 8. Verification

Required commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
```

Focused route checks/tests:

- Create over `widgets.instances.max` returns 402 and does not call Tokyo.
- Duplicate over `widgets.instances.max` returns 402 and does not call Tokyo.
- Publish over `instances.published.max` returns 402 and does not call Tokyo.
- Create/Duplicate block exactly when coordinate count is `>=
  widgets.instances.max`;
- Publish blocks exactly when target is not already published and published
  count is `>= instances.published.max`;
- already-published Publish does not show upgrade and remains the current
  idempotent success/no-op behavior;
- Create and Duplicate generate no new id and materialize no package bytes
  before the over-tier gate;
- Duplicate source load failure returns visibly with no write and no success;
- malformed/missing policy limits return policy contract failure, not
  UPGRADE_REQUIRED and not unlimited usage;
- Publish uses list-facts publish state;
- Client opens upgrade popup from unwrapped body.

Search proof:

```bash
rg "widgets\\.types\\.max|coreui\\.upsell\\.reason\\.limitReached|publishedCount|/instances/facts" roma/app/api/account/instances roma/components/widgets-domain.tsx roma/components/use-roma-widgets.ts
```

Expected result:

```text
No old widget-type policy gate, old 403 upsell reason, Tokyo publishedCount,
or /instances/facts use remains in active Create/Duplicate/Publish/Widgets
action code.
```

## 9. V1-V8 Audit

- V1: no invented policy fallback.
- V2: no silent downgrade to generic error.
- V3: no dropped upgrade payload field.
- V4: missing policy does not fail open.
- V5: missing/corrupt duplicate source or publish target does not become
  absence success.
- V6: over-tier command does not report success.
- V7: no old 403/disabled-wrapper masquerade.
- V8: no runtime probe dependency.

## 10. Done

This subPRD is done when:

1. Create, Duplicate, Publish gates return exact 402 bodies.
2. Tokyo create/write/publish transition routes are not called over tier.
3. Client opens the upgrade popup from the exact body.
4. Create/Duplicate/Publish use exact threshold math and finite policy limits.
5. Already-published Publish remains idempotent and never opens upgrade.
6. Duplicate source failure fails visibly with no write.
7. 125E deploys only as part of the same pre-GA cut as
   125A/125B/125C/125D/125F.
8. Roma/multitenancy/CONTEXT docs are updated by 125G before PRD 125 acceptance.
9. Checks are green.
