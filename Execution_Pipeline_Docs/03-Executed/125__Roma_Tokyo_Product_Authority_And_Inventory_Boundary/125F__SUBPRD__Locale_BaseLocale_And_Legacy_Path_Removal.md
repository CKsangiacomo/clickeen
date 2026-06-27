# 125F SubPRD: Locale Base-Locale And Legacy Path Removal

Status: Executed
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: locale fan-out, base-locale lock, old facts/list-summary route removal

## 0. Parent Law

Locale fan-out and base-locale lock need account instance coordinates, not
Widgets product summaries.

This subPRD is the final old-path cleanup gate in the single PRD 125 pre-GA
cut. It verifies the locale and base-locale migrations owned by 125C, then
removes the legacy facts route and old list-summary helper in the same branch
after 125B, 125C, 125D, and 125E update every active caller.

125F must not deploy alone.

## 1. Owned Files

Primary:

```text
roma/lib/account-instance-direct.ts
tokyo-worker/src/routes/internal-instance-routes.ts
```

Verification-owned files:

```text
roma/app/api/account/locales/route.ts
roma/lib/account-base-locale-lock.ts
```

Docs are updated by 125G before PRD 125 acceptance.

## 2. Current Runtime Facts

Locale route currently uses:

```text
listAccountInstancesInTokyo()
instances.value.accountInstances.length
for (const instance of instances.value.accountInstances)
```

Base-locale lock currently uses:

```text
loadAccountInstanceFactsFromTokyo()
GET /__internal/accounts/{accountId}/instances/facts
```

These are too broad.

## 3. Target Behavior

Locale fan-out:

```text
listAccountWidgetInstanceIds()
changed non-base locales
coordinates = instanceIds.length * changedLocaleCount
for each instanceId in instanceIds
```

Base-locale lock:

```text
locked = listAccountWidgetInstanceIds().instanceIds.length > 0
```

No config, serve-state, content, overlays, packages, or list-facts are opened
for either path unless a future product field explicitly requires it.

## 4. Execution Steps

### Step 1: Verify Locale Route Migration

Verify `roma/app/api/account/locales/route.ts`.

Required state:

- it uses `listAccountWidgetInstanceIds`;
- it computes cost from `instanceIds.length`;
- it iterates ids only;
- keep existing Translation Agent/materialization behavior untouched.
- `GET/PUT /api/account/locales` response shape remains unchanged except for
  the inventory source used to compute follow-up coordinates.
- coordinate-list failure returns visible locale settings follow-up failure
  (`overlayUpdate.ok: false` for saved-setting follow-up) and must not become
  zero instances or empty success.

Compliance:

This preserves direct synchronous overlay fan-out while removing product-summary
inventory from Tokyo.

### Step 2: Verify Base-Locale Lock Migration

Verify `roma/lib/account-base-locale-lock.ts`.

Required state:

- it does not import or call `loadAccountInstanceFactsFromTokyo`;
- it calls `listAccountWidgetInstanceIds`;
- it derives locked from length > 0;
- base-locale lock error behavior and user-facing copy remain unchanged except
  for the inventory source.

Compliance:

Base-locale lock is an existence check, not a product row read.

### Step 3: Remove Old Facts Route And Helper

After every active runtime caller is gone, remove:

```text
GET /__internal/accounts/{accountId}/instances/facts
```

Remove matching Roma helper:

```text
loadAccountInstanceFactsFromTokyo
```

Also remove old list-summary helper/types in the same branch once verification
proves no active caller remains:

```text
listAccountInstancesInTokyo
TokyoAccountInstanceList
TokyoAccountInstanceListEntry
normalizeTokyoInstanceListEntry
normalizeTokyoInstanceListEntries
```

Do not remove:

```text
GET /__internal/accounts/{accountId}/instances
accountInstancesRoot
```

That route remains active as the coordinate-only route from 125B. Storage key
helpers that name the R2 account instance root are not old product-summary
payloads.

Compliance:

No shadow facts path remains after coordinate/list-facts migration.

### Step 4: Update Tests

Update tests that assert old `accountInstances.length` locale cost or old facts
route behavior.

Do not change product behavior to satisfy old tests.

### Step 5: Docs Handoff

Update current docs in 125G before PRD 125 acceptance.

Docs affected by 125F behavior:

```text
documentation/capabilities/localization.md
documentation/services/roma.md
documentation/services/tokyo-worker.md
```

Required doc facts:

- locale fan-out iterates account instance coordinate ids;
- locale fan-out cost is coordinate count times changed non-base locale count;
- base-locale lock derives existence from coordinate count;
- Tokyo `/instances/facts` is removed in the same pre-GA cut once verification
  proves no active caller remains.

## 5. Non-Goals

This subPRD must not:

- change Translation Agent behavior;
- change overlay schema;
- change locale package materializer behavior;
- add background locale jobs;
- add status/probe/reconciliation paths;
- open Widgets list-facts for locale/base-locale count;
- change publish package refresh behavior.
- change `GET/PUT /api/account/locales` response shape or user copy except
  where current docs are updated by 125G to describe the coordinate source.

## 6. Verification

Required commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test:clk-live
pnpm --filter @clickeen/tokyo-worker test:locale-package
```

Focused evidence:

- `locales/route.ts` uses `instanceIds.length`;
- `locales/route.ts` iterates instance ids, not `accountInstances`;
- base-locale lock uses coordinate count;
- no active runtime caller uses `/instances/facts`;
- no active runtime caller imports or calls `loadAccountInstanceFactsFromTokyo`;
- no active runtime caller imports or calls `listAccountInstancesInTokyo`;
- Tokyo `/instances/facts` route is removed in the same pre-GA cut once
  verification proves no active caller remains;
- locale cascade behavior remains direct and synchronous.
- coordinate-list failure produces visible locale follow-up failure and never
  zero-instance success.

Search proof:

```bash
rg "listAccountInstancesInTokyo|loadAccountInstanceFactsFromTokyo|TokyoAccountInstanceList|TokyoAccountInstanceListEntry|normalizeTokyoInstanceListEntry|normalizeTokyoInstanceListEntries|publishedCount|accountInstances\\[\\]|value\\.accountInstances|payload\\.accountInstances|/instances/facts" roma tokyo-worker
```

Expected result:

```text
No active runtime hits outside historical PRD/docs text. The coordinate-only
`GET /__internal/accounts/{accountId}/instances` route and storage-root helper
names such as `accountInstancesRoot` are allowed to remain.
```

## 7. V1-V8 Audit

- V1: no invented locale count.
- V2: no silent repair of missing instance coordinates.
- V3: no omitted coordinate in fan-out.
- V4: coordinate-list failure blocks settings follow-up visibly.
- V5: corrupt coordinate state does not become zero instances.
- V6: settings response does not claim full follow-up if fan-out fails.
- V7: no facts route under a new wrapper.
- V8: no locale probes/status jobs.

## 8. Done

This subPRD is done when:

1. Locale fan-out is coordinate-only.
2. Base-locale lock is coordinate-only.
3. `/instances/facts` is removed in the same pre-GA cut once verification
   proves no active runtime caller remains.
4. Old list-summary helper/types are removed in the same pre-GA cut once
   verification proves no active runtime caller remains.
5. Locale settings response/user behavior is unchanged except for coordinate
   source.
6. Coordinate-list failure cannot become zero-instance success.
7. Localization/Roma/Tokyo docs are updated by 125G before PRD 125 acceptance.
8. Checks are green.
