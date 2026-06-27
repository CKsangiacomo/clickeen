# 125B SubPRD: Tokyo Coordinate List And List-Facts

Status: Executed
Parent: `125__PRD__Roma_Tokyo_Product_Authority_And_Inventory_Boundary.md`
Scope: Tokyo-worker account instance storage routes only

## 0. Parent Law

Tokyo is the storage boundary. Tokyo must not build Widgets product rows, count
published instances for policy, infer display names, decide tier eligibility, or
repair account storage.

This subPRD changes Tokyo account instance list behavior only. It is part of
the single PRD 125 pre-GA cut: Roma callers must move to the new contract in
the same implementation branch before deploy.

## 1. Owned Files

Primary files:

```text
tokyo-worker/src/routes/internal-instance-routes.ts
tokyo-worker/src/domains/account-instances/source.ts
tokyo-worker/src/domains/account-instances/types.ts
tokyo-worker/src/domains/account-instances/keys.ts
```

Focused tests may be added under:

```text
tokyo-worker/tests/
```

## 2. Current Runtime Facts

Current route:

```text
GET /__internal/accounts/{accountId}/instances
```

Current wrong behavior:

- lists R2 keys under `accounts/{accountId}/instances/`;
- filters to `instance.config.json`;
- reads config;
- reads `serve-state.json`;
- returns `accountInstances[]`;
- returns `publishedCount`.

Current route to remove in the same pre-GA cut once the branch verifies no
active Roma caller remains:

```text
GET /__internal/accounts/{accountId}/instances/facts
```

## 3. Target Route Contracts

### Coordinate List

Keep:

```text
GET /__internal/accounts/{accountId}/instances
```

Required response:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "instanceIds": ["ABC1234567", "DEF1234567"]
}
```

Allowed work:

- list objects under `accounts/{accountId}/instances/`;
- derive unique immediate child `instanceId` coordinates from object keys under
  the account instance root;
- preserve existing R2 cursor pagination until all pages are enumerated;
- sort ids;
- return ids.

Forbidden work:

- read `instance.config.json`;
- read `instance.content.json`;
- read `serve-state.json`;
- read packages, overlays, locale packages, runtime bytes;
- return `accountInstances`;
- return `publishedCount`;
- return widget type, display name, publish status, or updated timestamp;
- skip malformed immediate child coordinates.

Valid coordinate predicate:

```text
The immediate child segment between
accounts/{accountId}/instances/
and
the next `/`
must satisfy isCompactInstanceId from @clickeen/ck-contracts.
```

Coordinate inclusion rule:

```text
Every valid immediate child segment under accounts/{accountId}/instances/
is returned as an instance id. Tokyo does not require instance.config.json to
exist before returning that coordinate.
```

Forbidden coordinate handling:

```text
normalizeStorageId
trim
case conversion
segment repair
accepting any non-empty child segment
```

Malformed coordinate response:

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/json
```

```json
{
  "error": {
    "kind": "VALIDATION",
    "reasonKey": "tokyo.errors.instance.malformedCoordinate",
    "detail": "accounts/CLICKEEN/instances/{badCoordinate}",
    "phase": "account-instance-coordinate-enumeration"
  }
}
```

Tokyo must not normalize, repair, skip, or continue after the malformed
coordinate.

### List-Facts

Add:

```text
GET /__internal/instances/{instanceId}/list-facts
```

Required response:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "instanceId": "ABC1234567",
  "widgetType": "faq",
  "displayName": null,
  "updatedAt": "2026-06-26T00:00:00.000Z",
  "publishStatus": "published"
}
```

Allowed reads:

```text
accounts/{accountId}/instances/{instanceId}/instance.config.json
accounts/{accountId}/instances/{instanceId}/serve-state.json
```

Forbidden reads:

```text
instance.content.json
overlays/
locales/
index.html
styles.css
runtime.js
public package bytes
```

Display name rule:

```text
Tokyo returns stored config displayName as string or null.
Tokyo does not infer a fallback label.
Roma owns fallback labels.
```

## 4. Execution Steps

### Step 1: Add Coordinate Enumerator

Implement a source helper that returns sorted unique immediate child
`instanceId`s from the account instance root.

Required implementation details:

- enumerate every R2 page through the returned cursor;
- for every listed object key under `accounts/{accountId}/instances/`, parse the
  immediate child segment after that prefix;
- if the child segment is missing, empty, or the key has no `/` after the child
  segment, return malformed coordinate;
- validate the child segment with `isCompactInstanceId`;
- add every valid child segment to the returned coordinate set, regardless of
  which object file exposed it;
- return HTTP 422 on the first malformed coordinate;
- do not read object bodies;
- do not require `instance.config.json` existence during coordinate
  enumeration;
- do not read `serve-state.json`.

Compliance:

This keeps Tokyo as storage coordinate authority without turning it into product
inventory.

### Step 1A: Pre-GA Cut Gate

125B changes the shared Tokyo route payload consumed by Roma. The account list
payload change must not be deployed to cloud-dev or production until the same
branch migrates and verifies Roma callers from 125C, 125D, 125E, and 125F.

Required before deploy:

```text
Roma no longer parses accountInstances[] or publishedCount from
GET /__internal/accounts/{accountId}/instances.
```

Search proof before deploy:

```bash
rg "accountInstances|publishedCount" roma/lib/account-instance-direct.ts roma/app/api/account roma/components
```

Allowed result:

```text
No active caller of the Tokyo account instance list route expects old fields.
```

Compliance:

This avoids a partial Roma/Tokyo contract swap while rejecting dual-read
compatibility and shadow payloads.

### Step 2: Change Account List Route Payload

Change `GET /__internal/accounts/{accountId}/instances` to return only
`{ ok, accountId, instanceIds }`.

Compliance:

This removes Tokyo product summaries and `publishedCount`.

### Step 3: Add List-Facts Route

Add `GET /__internal/instances/{instanceId}/list-facts`.

It uses the existing Roma-issued account/authz path proof and exact instance id
proof. It reads only config and serve-state.

Compliance:

This gives Roma exact storage facts when Roma needs row fields, without making
Tokyo an account list/product brain.

### Step 4: Keep Existing Exact Source/Package Routes

Do not change create/save/publish/unpublish/package/source behavior except where
type changes are required by the new helpers.

Compliance:

This prevents broad storage rewrites while fixing the boundary.

### Step 5: Retire Facts Route Only After Roma Moves

Do not delete:

```text
GET /__internal/accounts/{accountId}/instances
```

Remove in the same pre-GA cut after this branch updates all callers:

```text
GET /__internal/accounts/{accountId}/instances/facts
```

Compliance:

No broken build and no shadow product facts route after migration.

### Step 6: Tokyo Service Docs Handoff

Update `documentation/services/tokyo-worker.md` through 125G before PRD 125
acceptance.

Required doc facts:

- `GET /__internal/accounts/{accountId}/instances` returns only
  `ok`, `accountId`, and `instanceIds`;
- `GET /__internal/instances/{instanceId}/list-facts` returns exact minimal row
  facts;
- Tokyo returns stored `displayName` as string or `null`;
- Tokyo does not infer fallback labels, policy, tier, or product availability;
- `/__internal/accounts/{accountId}/instances/facts` is removed in the same
  pre-GA cut once the branch verifies no active Roma caller remains.

Compliance:

Current operator docs must not keep the old Tokyo product-summary contract alive
for future agents.

## 5. Non-Goals

This subPRD must not:

- add an R2 index JSON;
- use Supabase/Michael;
- add repair/reconciliation/probe routes;
- return product rows from the account list;
- infer fallback display names;
- validate tier policy;
- decide create/publish eligibility;
- change public `clk.live` serving.

## 6. Verification

Required commands:

```bash
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test:clk-live
pnpm --filter @clickeen/tokyo-worker test:locale-package
```

Focused evidence:

- account list route returns only `ok`, `accountId`, `instanceIds`;
- no `publishedCount` in account list response;
- coordinate enumeration consumes every R2 cursor page;
- coordinate enumeration accepts only exact `isCompactInstanceId` child
  segments parsed from immediate object-key children;
- coordinate enumeration returns valid child coordinates even when
  `instance.config.json` is missing;
- malformed coordinate returns HTTP 422 and no partial list;
- list-facts returns `displayName: null` when config has no stored display name;
- list-facts does not read content/overlays/packages;
- Roma old-field callers are migrated before Tokyo account list payload deploys;
- Tokyo service docs are updated in this release or the runtime change is held
  for 125G.

## 7. V1-V8 Audit

- V1: no inferred display name.
- V2: no malformed coordinate repair.
- V3: no silent coordinate omission.
- V4: no fail-open when list-facts read fails.
- V5: corrupt config does not become missing/empty.
- V6: no partial account list after malformed coordinate.
- V7: no product summary under a new route name.
- V8: no runtime dependency on test probes.

## 8. Done

This subPRD is done when:

1. Tokyo account list is coordinate-only.
2. Tokyo list-facts is exact and minimal.
3. Coordinate enumeration preserves R2 pagination and validates coordinates
   with `isCompactInstanceId` without normalization or config-file presence
   gating.
4. `/instances/facts` is removed in the same pre-GA cut once the branch
   verifies no active Roma caller remains.
5. Roma caller migration is completed and verified in the same implementation
   branch before deploy.
6. `documentation/services/tokyo-worker.md` is updated by 125G before PRD 125 is
   accepted.
7. Tests/checks are green.
