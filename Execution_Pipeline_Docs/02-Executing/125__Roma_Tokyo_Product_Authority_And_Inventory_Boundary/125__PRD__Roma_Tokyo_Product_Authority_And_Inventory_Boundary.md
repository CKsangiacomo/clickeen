# PRD 125: Roma/Tokyo Product Authority And Inventory Boundary

Status: Executing
Date: 2026-06-26
Owner: Clickeen product architecture
Scope: Roma Widgets domain, Roma widget create/publish upgrade gates, Roma account locale fan-out, Roma base-locale lock, Roma Assets domain, Tokyo-worker account storage routes, Michael boundary docs

## 0. Execution Facts

Current live Widgets path:

```text
Roma /api/account/widgets
  -> Roma loads the full widget catalog
  -> Tokyo /__internal/accounts/{accountId}/instances
  -> Tokyo R2 list accounts/{accountId}/instances/
  -> Tokyo reads instance.config.json
  -> Tokyo reads serve-state.json
  -> Tokyo returns product-shaped accountInstances[]
```

Target Widgets path for this PRD:

```text
Roma /api/account/widgets
  -> Roma loads the full widget catalog
  -> Tokyo /__internal/accounts/{accountId}/instances
  -> Tokyo R2 list accounts/{accountId}/instances/
  -> Tokyo returns instanceIds[] only
  -> Roma opens exact instances by id
  -> Roma builds Widgets product response: full catalog + account instances
```

Current live Assets path:

```text
Roma /api/account/assets
  -> Tokyo /__internal/assets/account/{accountId}
  -> Tokyo R2 list accounts/{accountId}/assets/
  -> Tokyo returns asset storage records
  -> Roma renders Assets product response
```

PRD 125 execution target:

```text
Assets pattern and Widgets pattern must match.
Roma owns product response and policy.
Tokyo owns storage facts and exact R2 operations.
Catalog visibility is not entitlement.
Action intent is the upgrade/conversion boundary.
```

Hard no:

```text
No Supabase public.instances Widgets list source.
No new R2 index JSON.
No Tokyo product-shaped Widgets summaries.
No fallback scans beyond storage-coordinate enumeration.
No probes, repair jobs, reconciliation jobs, or dual-read safety nets.
No widget-type entitlement gate.
No disabled-action payload as the product model.
No saved-instance policy invented to justify inventory fan-out.
No active `widgets.types.max` policy after execution.
```

## 1. Product Law

Clickeen is an agent-operated, schema/artifact-first product. The system must
stay lean enough that agents can operate it directly.

Widgets and Assets are sibling account-owned object domains.

They use the same product pattern:

- an account owns objects;
- Roma lists, opens, creates, edits, duplicates or copies where the domain
  supports it, deletes, and applies account policy;
- Tokyo stores, reads, lists storage facts for, writes, and deletes exact
  account-owned R2 artifacts;
- R2 stores the bytes/artifacts;
- Berlin/Michael provide the account/user/role/tier facts that Roma uses to
  enforce policy.

The domains differ only in object-specific validation:

- Assets validate file/blob safety, MIME type, SVG safety, storage usage, and
  asset metadata.
- Widgets validate widget type, config/content, source package, publish state,
  overlays, and generated package artifacts.

PRD 125 does not permit different authority models for Widgets and Assets.

The active authority law for this work:

- Roma is the account cockpit and current-account command boundary.
- Berlin/Michael provide account, user, role, tier, and account-control facts.
- Tokyo-worker is the storage boundary for exact account runtime artifacts.
- R2 stores account runtime bytes.
- Supabase/Michael stores relational account/control truth, not rendered
  product artifacts.
- Browser surfaces call Roma, not Tokyo directly for account control.
- Tokyo internal routes receive already-authorized account operations from
  Roma.
- Tokyo must not decide account policy, tier policy, product eligibility, or UI
  meaning.

The hard rule:

```text
Roma may ask Tokyo for storage facts and exact artifacts.
Tokyo must not turn those facts into product authority decisions.
```

For Widgets and Assets alike:

```text
Berlin/Michael -> account/user/tier facts
Roma -> product policy and command boundary
Tokyo -> exact R2 storage facts and object operations
R2 -> bytes/artifacts
```

## 1A. Deterministic Route Contract

This PRD is not allowed to stay abstract. Execution must follow these concrete
route contracts.

### Assets Current Pattern

Assets already use the shape this PRD wants to preserve:

```text
Roma /api/account/assets
  -> Tokyo /__internal/assets/account/{accountId}
  -> R2 accounts/{accountId}/assets/...
```

Upload:

```text
Roma /api/account/assets/upload
  -> Tokyo /__internal/assets/upload
  -> R2 accounts/{accountId}/assets/...
```

Resolve:

```text
Roma /api/account/assets/resolve
  -> Tokyo /__internal/assets/account/{accountId}/resolve
  -> R2 accounts/{accountId}/assets/...
```

Delete:

```text
Roma /api/account/assets/{assetRef}
  -> Tokyo /__internal/assets/account/{accountId}/asset/{assetRef}
  -> R2 accounts/{accountId}/assets/{assetRef}
```

Roma decides:

- current account;
- current user role;
- account tier;
- upload size limit;
- storage limit;
- whether the operation is allowed.

Tokyo does:

- list asset storage records for the account;
- read asset metadata;
- resolve exact asset refs;
- write exact asset bytes;
- delete exact asset bytes;
- validate storage path, filename, MIME type, SVG safety, and blob metadata.

Same pattern means same authority ownership, not identical payload minimalism.
Tokyo returns asset storage records and storage bytes because those are storage
facts. Tokyo must not decide account policy or UI action availability.

### Widgets Target Pattern

Widgets must use the same product shape:

```text
Roma /api/account/widgets
  -> Tokyo /__internal/accounts/{accountId}/instances
  -> R2 accounts/{accountId}/instances/...
```

The Tokyo account-instance list route must return storage coordinates only.

Required response shape:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "instanceIds": ["ABC1234567", "DEF1234567"]
}
```

Forbidden response shape:

```json
{
  "accountInstances": [
    {
      "instanceId": "ABC1234567",
      "widgetType": "faq",
      "displayName": "FAQ",
      "publishStatus": "published",
      "updatedAt": "2026-06-26T00:00:00.000Z"
    }
  ]
}
```

After receiving `instanceIds`, Roma opens exact instances by id:

```text
Roma -> Tokyo /__internal/instances/{instanceId}
Roma -> Tokyo /__internal/instances/{instanceId}/package when package metadata is needed
```

Roma builds the Widgets product response:

```json
{
  "catalog": [
    {
      "widgetType": "faq",
      "displayName": "FAQ"
    }
  ],
  "instances": [
    {
      "instanceId": "ABC1234567",
      "widgetType": "faq",
      "displayName": "FAQ",
      "status": "published"
    }
  ]
}
```

Roma decides:

- current account;
- current user role;
- account tier;
- `widgets.instances.max`;
- `instances.published.max`;
- whether a create click executes or returns an upgrade popup response;
- whether a publish click executes or returns an upgrade popup response;
- permission or state denials for non-upgrade operations;
- how to describe validation/denial to the product surface.

Tokyo does:

- enumerate instance storage coordinates under the exact account storage root;
- open exact instance source by id;
- write exact instance source/package bytes;
- delete exact instance source/package bytes;
- write exact publish/unpublish storage state;
- validate storage path, instance id, source/package shape, and package metadata.

Tokyo instance coordinate enumeration:

- lists objects under `accounts/{accountId}/instances/`;
- derives unique immediate child `instanceId` coordinates from object keys;
- rejects malformed immediate child coordinates;
- returns sorted ids only;
- does not require `instance.config.json` to exist before returning an id;
- does not read config, content, serve-state, package files, or overlays while
  building the account list.

Tokyo does not:

- build Widgets UI rows;
- decide product action meaning;
- decide account tier policy;
- decide create/publish limits;
- infer display name for the Widgets list response;
- return publish counts for policy decisions;
- repair missing objects;
- omit corrupt objects.

If Tokyo enumerates an instance id and the exact instance open fails, Roma must
fail the Widgets response visibly. Roma must not silently drop that instance.

Failure response contract:

- Roma returns a whole-library failure when any enumerated `instanceId` cannot
  be opened exactly.
- The operator/debug payload includes `instanceId`, phase, and request id.
- Primary user copy must not expose raw R2, Tokyo, Supabase, JSON, route, or
  `reasonKey` wording.

### Deterministic Rejections

This PRD rejects the following as implementation paths for this correction:

```text
Roma /api/account/widgets -> Supabase public.instances -> product list
Roma /api/account/widgets -> R2 index JSON -> product list
Tokyo /__internal/accounts/{accountId}/instances -> product summaries
Tokyo /__internal/accounts/{accountId}/instances -> publish counts
Tokyo /__internal/accounts/{accountId}/instances -> display names
Tokyo /__internal/accounts/{accountId}/instances -> widget types
```

The only allowed Widgets list output from Tokyo in this PRD is:

```text
accountId + instanceIds[]
```

No alternate Widgets list output is permitted in PRD 125.

## 2. Current Runtime Facts To Preserve

These facts are current runtime facts, not target design guesses.

### Widgets

Current Roma `/widgets` needs:

- full widget catalog
- saved account instances
- instance id
- widget type
- display name
- publish state
- account policy limits
- click-time create and publish upgrade responses
- delete/rename/duplicate availability when those actions are permission or
  state dependent

Current code obtains the account instance list through:

```text
Roma /api/account/widgets
  -> roma/lib/account-instance-direct.ts
  -> Tokyo /__internal/accounts/{accountId}/instances
  -> R2 folder walk and summary reconstruction
```

That Tokyo account-list route is the boundary problem.

### Assets

Current Roma `/assets` uses Roma current-account routes and Tokyo asset-control
routes.

Current asset behavior is closer to the desired boundary:

- Roma resolves current account/session/policy.
- Roma applies account upload/storage limits.
- Roma asks Tokyo for storage facts such as asset list and storage bytes used.
- Tokyo validates file/path/metadata safety and writes exact asset bytes.
- R2 stores the asset bytes and metadata.

The remaining concern is that Tokyo also repeats some account/role/status
checks. That must be reviewed as a boundary question, but it is not the same
problem as Tokyo reconstructing a Widgets product list.

## 3. What Must Not Happen

This PRD forbids these implementation moves:

- Do not promote `public.instances` into Widgets inventory authority.
- Do not introduce a new account index JSON.
- Do not preserve Tokyo's current R2 folder-walk summary reconstruction as a
  product list.
- Do not hide broken rows/files by dropping them from the UI.
- Do not add fallback scans, repair probes, reconciliation jobs, dual reads, or
  "temporary" compatibility paths.
- Do not make Tokyo validate Roma's product decision.
- Do not make Supabase store widget source, overlays, generated packages,
  assets, or rendered product artifacts.
- Do not reinterpret this PRD into an ideal system and then add machinery to
  enforce that interpretation.

## 4. Locked Execution Contract

PRD 125 has one execution path.

Tokyo account-instance listing is storage-coordinate enumeration only.

```text
Roma /api/account/widgets
  -> Tokyo /__internal/accounts/{accountId}/instances
  -> Tokyo R2 list accounts/{accountId}/instances/
  -> Tokyo returns accountId + instanceIds[]
  -> Roma opens each exact instance by id
  -> Roma builds the Widgets product response
  -> Roma enforces account policy
```

Roma open fan-out contract:

- the full widget catalog is always visible;
- widget catalog visibility is not tier-gated;
- create controls are always rendered and clickable from the catalog;
- publish controls are always rendered and clickable from an instance surface;
- `widgets.instances.max` is an action-time upgrade gate, not a
  catalog visibility gate;
- `instances.published.max` is an action-time publish upgrade gate, not an
  instance visibility gate;
- Roma opens returned `instanceIds` because they are the account's actual saved
  instance coordinates, not because Tokyo approved product eligibility;
- Roma opens returned `instanceIds` with bounded concurrency, maximum 8 open
  requests at a time;
- Roma builds product rows only after every exact open succeeds;
- Roma sorts final Widgets rows by opened instance `updatedAt` descending, then
  `instanceId` ascending;
- Roma does not ask Tokyo for `publishedCount`, `widgetType`, `displayName`, or
  `publishStatus` summaries.

Allowed Tokyo list response:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "instanceIds": ["ABC1234567", "DEF1234567"]
}
```

All other Widgets list authorities must not be implemented in PRD 125.

Forbidden in PRD 125 implementation:

- `Roma /api/account/widgets -> Supabase public.instances -> product list`
- `Roma /api/account/widgets -> new R2 index JSON -> product list`
- `Tokyo /__internal/accounts/{accountId}/instances -> accountInstances[]`
- `Tokyo /__internal/accounts/{accountId}/instances -> widgetType`
- `Tokyo /__internal/accounts/{accountId}/instances -> displayName`
- `Tokyo /__internal/accounts/{accountId}/instances -> publishStatus`
- `Tokyo /__internal/accounts/{accountId}/instances -> updatedAt`
- `Tokyo /__internal/accounts/{accountId}/instances -> publishedCount`
- `Tokyo /__internal/accounts/{accountId}/instances/facts`

Roma derives all product fields after exact instance opens.

Roma enforces:

- `widgets.instances.max`
- `instances.published.max`
- create-click upgrade response before Tokyo writes
- publish-click upgrade response before Tokyo writes
- product error wording

Tokyo stores and returns:

- exact storage coordinates;
- exact instance source/package artifacts by id;
- exact asset records and bytes;
- exact storage write/delete results.

Code execution must not invent a saved-instance product policy. This PRD
replaces the current incorrect `widgets.types.max` concept with
`widgets.instances.max`. `widgets.instances.max` is the create-click upgrade
gate for how many widget instances the account can create/open/use. The
account's published instance entitlement is the publish-click upgrade gate.
Those two gates are separate and both belong to Roma.

## 4A. Roma Widgets Product Payload, Upgrade, And Copy Contract

The Roma Widgets surface renders:

```text
full widget catalog
saved account instances
clickable Create instance controls
clickable Publish controls
```

The product model is not "disabled button with reason." The product model is
"user expresses intent, Roma either executes or returns upgrade_required."

Create click contract:

```text
User clicks Create instance
Roma counts current account widget instances from exact opened instance facts
Roma reads widgets.instances.max from Michael/Berlin policy

If within entitlement:
  Roma mints the instance id
  Roma submits the exact create command to Tokyo

If entitlement is reached:
  Roma returns upgrade_required
  Roma does not call Tokyo
  UI opens the upgrade popup
```

Publish click contract:

```text
User clicks Publish
Roma counts currently published account instances from exact opened instance facts
Roma reads instances.published.max from Michael/Berlin policy

If within entitlement:
  Roma submits the exact publish command to Tokyo

If entitlement is reached:
  Roma returns upgrade_required
  Roma does not call Tokyo
  UI opens the upgrade popup
```

The UI may show loading while the click is being handled. It must not remove the
catalog item, hide the action, or convert an upgrade opportunity into a dead
disabled control.

Primary Widgets user copy:

| State | Primary copy |
| --- | --- |
| Inventory/open failure | We couldn't load your widgets. No widgets were changed. Try again. |
| Corrupt saved widget | One saved widget needs attention before this list can load. No widgets were changed. |
| Create upgrade gate | Upgrade to create more widgets. |
| Publish upgrade gate | Upgrade to publish more widgets. |
| Upstream unavailable | Widgets are unavailable right now. Please try again. |
| Permission denial | You do not have permission to change widgets in this account. |

Primary UI copy must not say:

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

## 4B. Exact Policy Key Change

PRD 125 changes the active policy key:

```text
remove: widgets.types.max
add:    widgets.instances.max
```

`widgets.instances.max` means:

```text
Maximum widget instances the account can create/open/use.
```

`widgets.instances.max` does not mean:

```text
Maximum widget types.
Catalog visibility.
Catalog filtering.
Disabled Create instance button.
Tokyo storage permission.
```

Initial tier values preserve the current commercial count while correcting the
meaning:

```json
{
  "free": 1,
  "tier1": 1,
  "tier2": 3,
  "tier3": null,
  "tier4": null
}
```

Execution requirements:

- replace `widgets.types.max` with `widgets.instances.max` in
  `packages/ck-policy/src/registry.ts`;
- replace `widgets.types.max` with `widgets.instances.max` in
  `packages/ck-policy/entitlements.matrix.json`;
- update Roma create route policy reads to use `widgets.instances.max`;
- update Roma Widgets route policy reads to use `widgets.instances.max`;
- remove user copy that says "widget type(s)" as a plan limit;
- do not keep `widgets.types.max` as an alias or fallback;
- do not add a saved-instance policy key.

## 5. Execution Slices

### Slice 1: Current Call Graph And Authority Lock

Read current runtime code and current docs only:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/michael.md`
- Roma Widgets routes
- Roma instance create route
- Roma instance publish route
- Roma account locales route
- Roma base-locale lock helper
- Roma Assets routes
- Tokyo instance routes
- Tokyo asset routes
- Michael migrations/docs for `public.instances`

Output:

- exact current call graph
- helper rewrite plan for every current caller to consume `accountId + instanceIds[]`
- policy migration plan from `widgets.types.max` to `widgets.instances.max`
- evidence that `widgets.types.max` is removed from active policy code and is
  not preserved as an alias
- exact current policy key used for `instances.published.max`
- exact routes and UI surfaces that must return/open upgrade popup responses
- V1-V8 risk list

Compliance:

This prevents old PRDs or agent memory from becoming hidden authority. It also
prevents coding outside the locked route contract.

### Slice 2: Widgets Inventory Boundary

Move Roma Widgets away from Tokyo product-list reconstruction.

Required behavior:

- Roma returns the full widget catalog independent of account tier.
- Roma returns saved account instances derived from exact instance opens.
- Roma owns product interpretation and account policy.
- Tokyo returns `accountId + instanceIds[]` only.
- Missing/corrupt inventory truth fails visibly.
- No fallback to Supabase.
- No new R2 index JSON.
- No silent omission of broken instances.

Compliance:

This removes Tokyo as product brain without replacing it with an inferred
authority.

### Slice 3: Widget Create/Publish Upgrade Gates

Update create and publish enforcement so Roma uses exact opened instance facts
from the `instanceIds[]` list.

Required behavior:

- `widgets.instances.max` is enforced by Roma at Create instance click
  time.
- `instances.published.max` is enforced by Roma at Publish click time.
- create and publish upgrade gates use the same Roma-derived opened-instance
  facts as Widgets list.
- create remains clickable from the full catalog.
- publish remains clickable from the instance surface.
- when create exceeds entitlement, Roma returns `upgrade_required` and does not
  call Tokyo.
- when publish exceeds entitlement, Roma returns `upgrade_required` and does
  not call Tokyo.
- Roma does not use Tokyo `publishedCount`.
- Roma does not use Tokyo widget type summaries.
- Roma does not use `/instances/facts`.
- Tokyo stores exact addressed artifacts and state transitions only.
- No fail-open when inventory/control facts are unavailable.

Compliance:

Policy remains in Roma/account authority. Tokyo does not validate account tier
or product eligibility. Upgrade is triggered by user intent, which preserves the
product conversion path instead of hiding or disabling the product.

### Slice 4: Widget Mutations And Integrity

Update create, duplicate, save, rename, publish, unpublish, and delete paths only
as required by the locked route contract.

Required behavior:

- one operation either leaves the locked route-contract state coherent or
  fails visibly;
- create and publish over entitlement return upgrade responses before Tokyo is
  called;
- duplicate follows the same widget instance count entitlement as create unless
  product explicitly defines a different upgrade rule;
- no background repair path;
- no dual-authority success response;
- no cleanup operation that pretends partial completion is full success.

Compliance:

This protects V6 partial-success and V7 masquerade/redress.

### Slice 5: Assets Boundary Review

Review the existing Assets boundary against the same authority law.

Required behavior:

- Roma keeps account/session/tier decisions.
- Tokyo keeps storage/file/path/metadata safety.
- Tokyo returns storage facts from R2, such as bytes used and asset metadata.
- Tokyo must not become the account policy authority.

Compliance:

Assets already use storage facts from Tokyo; this slice prevents the Widgets
fix from overcorrecting or breaking the working asset lane.

### Slice 6: Tokyo Instance List Route Contract

Keep the account instance list route and change its payload.

Required route contract:

```text
GET /__internal/accounts/{accountId}/instances
  -> { ok: true, accountId, instanceIds }
```

Delete this route only after Roma base-locale lock and every other caller uses
the coordinate list:

```text
GET /__internal/accounts/{accountId}/instances/facts
```

Compliance:

No broken build. No preserved product-summary route. No shadow product path.

### Slice 7: Documentation Update

Update current docs after runtime behavior is green:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/michael.md`
- `documentation/capabilities/multitenancy.md` if policy key naming changes
- `documentation/capabilities/localization.md` because locale fan-out cost
  depends on account instance count
- asset docs if the Assets boundary changes

Compliance:

`documentation/` remains current operator truth after implementation. PRD history
does not substitute for current docs.

## 6. Verification

Required checks depend on touched surfaces, but must include:

```bash
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test:clk-live
pnpm --filter @clickeen/tokyo-worker test:locale-package
```

If docs only are changed, run repo formatting/diff checks appropriate for docs.

Product verification must prove:

- Roma Widgets loads from `accountId + instanceIds[]`.
- Full widget catalog remains visible to every account tier.
- Create controls remain visible and clickable for every catalog widget.
- Publish controls remain visible and clickable from the instance surface.
- Create over entitlement returns upgrade_required and does not call Tokyo.
- Publish over entitlement returns upgrade_required and does not call Tokyo.
- Locale settings fan-out iterates the exact returned ids.
- Base-locale lock derives instance existence from the coordinate list.
- `widgets.instances.max` is not implemented as widget-type gating.
- `widgets.instances.max` is not implemented as catalog hiding.
- `widgets.instances.max` is not implemented as a disabled button.
- `widgets.types.max` is gone from active policy code after execution.
- Rename/delete/publish/unpublish do not produce split truth.
- Assets still list/upload/resolve/delete through the current account lane.
- Tokyo no longer returns Widgets product summaries from the account list route.
- User copy for inventory corruption, upgrade-required create, upgrade-required publish,
  and upstream unavailable states does not render raw storage route, JSON,
  `reasonKey`, or implementation detail as primary user copy.

Focused tests or route-level checks must prove:

- Tokyo list returns only `accountId + instanceIds[]`.
- Tokyo coordinate enumeration rejects malformed immediate child coordinates.
- Roma fails the whole Widgets response when a returned id cannot open exactly.
- Create upgrade gate derives from Roma-opened instance facts.
- Publish upgrade gate derives from Roma-opened instance facts.
- Locale settings iterates exact returned ids.

## 7. V1-V8 Audit Requirements

Every implementation slice must audit:

- V1 Silent substitution
- V2 Silent healing
- V3 Silent omission
- V4 Fail-open control
- V5 Corruption-as-absence
- V6 Partial-success masquerade
- V7 Masquerade/redress
- V8 Runtime test dependency

The most important audit questions for this PRD:

- Did Roma silently omit broken instances?
- Did Tokyo continue returning product meaning under a new name?
- Did Supabase enter the Widgets list path?
- Did an index JSON appear?
- Did account policy move from Roma to Tokyo?
- Did a fallback scan survive?
- Did a tier limit hide catalog widgets?
- Did a tier limit disable Create instance or Publish instead of producing an
  upgrade popup from the click?
- Did `widgets.types.max` survive in active policy code?

## 8. Acceptance Criteria

This PRD is complete only when:

1. Roma Widgets consumes `accountId + instanceIds[]` from Tokyo.
2. Roma Widgets no longer depends on an undocumented Tokyo R2 reconstruction
   path.
3. Tokyo does not return product meaning in the account instance list response.
4. Supabase/Michael is out of the Widgets inventory path.
5. `widgets.types.max` is replaced by `widgets.instances.max` in active policy
   code.
6. Assets boundary is documented in the same terms and not broken by the
   Widgets correction.
7. Current docs match runtime behavior.
8. Checks are green.
9. V1-V8 audit is green.
10. Full catalog visibility, clickable Create instance, clickable Publish, and
   upgrade-required command responses are verified.

## 9. Non-Goal

This PRD does not implement a broad new architecture. It does not solve future
pages/apps/composition work. It does not redesign all storage. It locks and
executes the account inventory boundary for Widgets and verifies the same law
against Assets.
