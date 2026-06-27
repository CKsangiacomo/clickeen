# 125C SubPRD: Roma Inventory Helpers And Callers

Status: Draft for review
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: Roma direct Tokyo helper layer and non-UI callers

## 0. Parent Law

Roma owns product policy and command boundaries. Tokyo owns storage facts.

This subPRD updates Roma helper APIs so callers use the cheapest exact truth:

- coordinates for id/count/existence/fan-out;
- list-facts only for row fields; publish counts are computed by Roma callers
  from list-facts rows and are never returned as Tokyo `publishedCount`.

This subPRD is not independently deployable with 125B until 125D, 125E, and
125F migrate the remaining active callers that still need the old Tokyo payload.

## 1. Owned Files

Primary:

```text
roma/lib/account-instance-direct.ts
roma/lib/account-base-locale-lock.ts
roma/app/api/account/locales/route.ts
```

Possible tests:

```text
roma/tests/
```

## 2. Current Runtime Facts

Current helper:

```text
listAccountInstancesInTokyo()
```

Current wrong payload:

```text
accountInstances[]
publishedCount
```

Current facts helper:

```text
loadAccountInstanceFactsFromTokyo()
```

Current callers:

```text
roma/app/api/account/widgets/route.ts
roma/app/api/account/instances/route.ts
roma/app/api/account/instances/[instanceId]/publish/route.ts
roma/app/api/account/locales/route.ts
roma/lib/account-base-locale-lock.ts
```

## 3. Target Helper Contracts

### Coordinate Helper

Add or replace with:

```ts
listAccountWidgetInstanceIds(args): Promise<
  | { ok: true; value: { accountId: string; instanceIds: string[] } }
  | RouteFailure
>
```

This helper calls:

```text
GET /__internal/accounts/{accountId}/instances
```

It accepts only:

```text
ok
accountId exactly equal to the requested accountId
instanceIds[] as an array of unique strings that satisfy isCompactInstanceId
from @clickeen/ck-contracts
```

It rejects as upstream contract failure:

```text
missing ok: true
mismatched accountId
missing instanceIds
non-array instanceIds
duplicate instanceIds
empty instanceIds entries
malformed instanceIds entries
any accountInstances field
any publishedCount field
```

It must not accept, normalize, or fallback to old `accountInstances[]`.

### List-Facts Helper

Add:

```ts
loadAccountWidgetInstanceFacts(args): Promise<
  | { ok: true; value: { accountId: string; instances: AccountWidgetInstanceListFact[] } }
  | RouteFailure
>
```

It:

- calls `listAccountWidgetInstanceIds`;
- opens each id through `GET /__internal/instances/{instanceId}/list-facts`;
- uses a simple bounded promise pool with max concurrency 8;
- fails the whole response if any listed id fails exact open;
- rejects mismatched `accountId`;
- rejects mismatched returned `instanceId`;
- rejects invalid `widgetType`, invalid `updatedAt`, invalid `publishStatus`,
  or `displayName` values that are neither string nor null;
- rejects duplicate returned `instanceId`s;
- sorts by `updatedAt` descending, then `instanceId` ascending.

List fact type:

```ts
type AccountWidgetInstanceListFact = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  updatedAt: string;
  publishStatus: 'published' | 'unpublished';
};
```

Display name rule:

```text
Helper preserves null. It does not invent fallback label.
Roma UI/API layer applies fallback only for product rendering.
```

Forbidden helper machinery:

```text
scheduler
queue
cache
background fan-out job
old-payload dual read
accountInstances[] fallback
publishedCount fallback
```

## 4. Caller Migration

### Locale Fan-Out

`roma/app/api/account/locales/route.ts` must use
`listAccountWidgetInstanceIds` for:

- instance count;
- coordinate cost;
- loop over account instances.

It must not open list-facts just to discover ids.

### Base-Locale Lock

`roma/lib/account-base-locale-lock.ts` must use
`listAccountWidgetInstanceIds.length > 0`.

It must not call `/instances/facts`.

### Widgets/Create/Publish

Widgets API and create/publish command migration are executed in 125D and 125E.
This subPRD provides helpers they consume.

125C must not migrate Widgets API, Create, Duplicate, or Publish route behavior
unless it is explicitly merged with 125D/125E in the same execution slice.

### Release Sequencing Gate

125C alone does not make the 125B Tokyo payload swap deployable.

Before 125B can deploy, the release train must include:

```text
125C locale/base-locale helper consumers
125D Widgets API/client consumer migration
125E Create/Duplicate/Publish command consumer migration
125F old facts route removal
```

125C done means its owned callers are migrated and the helper contracts are
ready. PRD 125 release done means no active Roma caller expects old
`accountInstances[]`, `publishedCount`, or `/instances/facts`.

Compliance:

This keeps helper work from smuggling product UX or command-gate changes into
125C while still protecting the Roma/Tokyo route swap from partial deployment.

### Docs Handoff

Update current docs in 125G or hold this slice for the same PRD 125 release.

Docs affected by 125C behavior:

```text
documentation/services/roma.md
documentation/capabilities/localization.md
```

Required doc facts:

- locale fan-out derives cost from account instance coordinate count;
- base-locale lock derives existence from account instance coordinate count;
- Roma helper row fallback labels are product rendering only, not Tokyo/list
  helper truth.

## 5. Non-Goals

This subPRD must not:

- edit Tokyo;
- edit policy keys;
- change Widgets UI payload;
- implement upgrade popup;
- use Supabase/Michael for inventory;
- add background jobs;
- add fallback to old `accountInstances[]`;
- keep dual-read compatibility.

## 6. Verification

Required commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
```

Focused evidence:

- `account-instance-direct.ts` no longer parses `publishedCount`;
- `account-instance-direct.ts` no longer normalizes Tokyo `accountInstances[]`;
- locale route uses `instanceIds.length` and loops ids;
- base-locale lock uses coordinate length;
- no 125C-owned Roma caller uses `/instances/facts` after migration;
- helper rejects old `accountInstances[]` and `publishedCount` payloads;
- helper rejects any instance id that fails `isCompactInstanceId`;
- helper rejects mismatched account/instance ids and invalid list-facts fields;
- this slice is marked release-held until 125D/125E/125F migrate remaining
  active callers.

125C-owned search proof:

```bash
rg "accountInstances|/instances/facts|loadAccountInstanceFactsFromTokyo" roma/app/api/account/locales roma/lib/account-base-locale-lock.ts
```

Expected result:

```text
No active 125C-owned caller uses old list-summary or facts helpers.
```

Full PRD 125 release search proof, owned by 125G after 125D/125E/125F:

```bash
rg "publishedCount|accountInstances|/instances/facts|loadAccountInstanceFactsFromTokyo" roma tokyo-worker
```

## 7. V1-V8 Audit

- V1: no fallback display name in helper.
- V2: no repair of failed list-facts.
- V3: no omitted id on failed exact open.
- V4: no fail-open if coordinate list fails.
- V5: corrupt row facts do not become missing facts.
- V6: no partial success from list-facts fan-out.
- V7: no old helper preserved under new name.
- V8: no runtime probe/test dependency.

## 8. Done

This subPRD is done when:

1. Roma has coordinate and list-facts helpers.
2. Locale fan-out uses coordinates only.
3. Base-locale lock uses coordinate existence only.
4. Helpers reject old Tokyo payload fields and mismatched exact facts.
5. Old facts/list-summary helper paths are gone from 125C-owned callers.
6. 125C is release-held until 125D/125E/125F remove the remaining active old
   callers, or all four slices execute in the same release train.
7. Roma/localization docs are updated by 125G before PRD 125 acceptance, or this
   slice remains release-held.
8. Checks are green.
