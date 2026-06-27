# 125D SubPRD: Widgets API And Client Payload

Status: Executed
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: Roma `/widgets` API, Widgets client data shape, Widgets UI rendering

## 0. Parent Law

Every account sees the full widget catalog. Tier does not hide catalog items and
does not disable monetization controls.

Create, Duplicate, and Publish remain clickable. Upgrade is decided only by the
command route after user intent.

125D is part of the single PRD 125 pre-GA cut. It consumes 125C helpers,
depends on 125B's Tokyo route contract, and exposes clickable monetization
actions that require 125E command upgrade gates. It must not deploy as a
standalone partial cut.

## 1. Owned Files

Primary:

```text
roma/app/api/account/widgets/route.ts
roma/components/use-roma-widgets.ts
roma/components/widgets-domain.tsx
roma/lib/account-shell-copy.ts
```

Possible tests:

```text
roma/tests/
```

## 2. Current Runtime Facts

Current API returns:

```text
systemWidgets[]
instances[]
canCreate
disabledReasonKey
actions booleans
```

Current UI disables Create based on `canCreate`.

Current wrong model:

```text
list payload decides monetization availability
```

## 3. Target API Shape

Required `GET /api/account/widgets` response:

```json
{
  "catalog": [
    {
      "widgetType": "faq",
      "displayName": "FAQ",
      "description": "Frequently asked questions"
    }
  ],
  "instances": [
    {
      "instanceId": "ABC1234567",
      "widgetType": "faq",
      "displayName": "FAQ",
      "status": "published",
      "updatedAt": "2026-06-26T00:00:00.000Z"
    }
  ]
}
```

Forbidden response fields:

```text
systemWidgets
canCreate
createDisabledReason
disabledReasonKey for Create instance
disabledReasonKey for Duplicate
disabledReasonKey for Publish
boolean Create instance availability
boolean Duplicate availability
boolean Publish availability
monetization actions booleans
```

No dual compatibility:

```text
Roma must not return both catalog and systemWidgets.
Client normalizer must not accept old systemWidgets/canCreate/actions fallback.
```

## 4. API Execution

`roma/app/api/account/widgets/route.ts` must:

1. resolve current account/session/policy as today;
2. load full widget catalog from existing widget definitions path;
3. call `loadAccountWidgetInstanceFacts`;
4. apply Roma display fallback when list-facts `displayName` is null;
5. return `catalog + instances`;
6. fail whole Widgets response when any enumerated id cannot open exactly.

It must not:

- enforce Create/Duplicate/Publish tier availability in the list payload;
- turn missing policy into disabled monetization controls;
- turn missing policy into a list-time monetization allowance;
- return `canCreate`;
- return action booleans for monetization;
- use Tokyo `publishedCount`;
- use Tokyo product summaries;
- use Supabase inventory.

## 5. Client Execution

`roma/components/use-roma-widgets.ts` must:

- normalize `catalog + instances`;
- reject old `systemWidgets` payload;
- remove `canCreate` and monetization `disabledReasonKey` types;
- preserve cached data only in the new shape.

`roma/components/widgets-domain.tsx` must:

- render catalog groups from `catalog`;
- render Create instance as clickable for every catalog widget;
- render Duplicate where duplicate is shown as clickable;
- render Publish where publish is shown as clickable;
- not disable monetization controls because of plan limits;
- not use tooltip/title as upgrade path;
- keep role/state UX separate from monetization UX.

User copy must not expose:

```text
account instance
system widget
invalid data
R2
Tokyo
Supabase
JSON
route
reasonKey
storage coordinate
package
```

## 5A. Pre-GA Cut Gate

125D changes the Widgets API/client contract and removes list-time monetization
availability. It must not deploy alone.

Required same-branch dependencies before deploy:

```text
125B Tokyo coordinate/list-facts route contract
125C Roma coordinate/list-facts helpers
125E Create/Duplicate/Publish HTTP 402 upgrade gates
125F old facts/list-summary removal
```

125D can be implemented before those slices locally, but cloud-dev/production
deploy happens only after the same branch verifies all active Roma callers have
moved off old Tokyo `accountInstances[]`, `publishedCount`, and
`/instances/facts`.

Compliance:

This keeps the UI from exposing click-time monetization actions before the
command routes own the upgrade decision, and keeps the API from consuming a
Tokyo payload contract that is not deployed yet.

## 5B. Docs Handoff

Update current docs in 125G before PRD 125 acceptance.

Docs affected by 125D behavior:

```text
documentation/services/roma.md
documentation/capabilities/multitenancy.md
documentation/architecture/CONTEXT.md
```

Required doc facts:

- Roma `/widgets` returns `catalog + instances`;
- full catalog visibility is not tier-gated;
- Widgets list payload does not carry monetization availability booleans;
- Create/Duplicate/Publish upgrade decisions happen in command routes;
- missing policy does not create disabled monetization controls or list-time
  monetization allowance.

## 6. Non-Goals

This subPRD must not:

- implement command-route upgrade gates;
- change Tokyo;
- change policy keys;
- add compatibility payloads;
- hide widgets by tier;
- deploy without 125E command upgrade gates;
- add new UX framework;
- use Supabase/Michael as inventory.

## 7. Verification

Required commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
```

Focused evidence:

- `/api/account/widgets` returns `catalog + instances`;
- `systemWidgets`, `canCreate`, and monetization action booleans are absent;
- UI renders full catalog when over tier;
- Create/Duplicate/Publish controls are clickable;
- missing policy does not create disabled monetization controls or list-time
  monetization allowance;
- display fallback happens in Roma product rendering, not Tokyo.

Search proof:

```bash
rg "systemWidgets|canCreate|disabledReasonKey|actions\\.publish|actions\\.duplicate" roma/app/api/account/widgets roma/components
```

Expected result:

- no old monetization list payload in active Widgets API/client.
- named retired-field rejection constants may mention old field names only to
  reject old payloads; they must not normalize, accept, or map those fields.

## 8. V1-V8 Audit

- V1: no invented Tokyo display fallback.
- V2: no normalizing old payload into new silently.
- V3: no omitted catalog item because of tier.
- V4: no disabled control when policy missing.
- V4 detail: missing policy must not become list-time monetization allowance
  either; monetization enforcement belongs to command routes.
- V5: corrupt row fails visible, not absent.
- V6: no partial Widgets list after failed exact open.
- V7: no `systemWidgets` compatibility wrapper.
- V8: no runtime test/probe dependency.

## 9. Done

This subPRD is done when:

1. Widgets API returns only `catalog + instances`.
2. Widgets client accepts only that shape.
3. Full catalog renders for every tier.
4. Monetization controls are clickable.
5. Missing policy creates no disabled monetization control and no list-time
   monetization allowance.
6. 125D deploys only as part of the same pre-GA cut as 125B/125C/125E/125F.
7. Roma/multitenancy/CONTEXT docs are updated by 125G before PRD 125 acceptance.
8. Checks are green.
