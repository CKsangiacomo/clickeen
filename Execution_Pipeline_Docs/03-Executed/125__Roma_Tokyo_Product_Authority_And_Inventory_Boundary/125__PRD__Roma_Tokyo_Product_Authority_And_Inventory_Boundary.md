# PRD 125: Roma/Tokyo Product Authority And Inventory Boundary

Status: Executed
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

Pre-GA execution law:

```text
PRD 125 is a clean pre-GA cut.
SubPRDs are execution slices, not staged production releases.
The old and new contracts must not coexist in cloud-dev or production after
deploy.
Do not build compatibility bridges, dual reads, aliases, shadow payloads, or
temporary old/new modes.
If one slice depends on another, execute them in the same implementation branch
before deploy.
If the branch cannot remove the old contract completely, the branch does not
deploy.
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

The shared authority rule is exact: Roma owns account policy and product
response; Tokyo owns storage facts and byte operations. Tokyo returns asset
storage records and storage bytes because those are storage facts. Tokyo must
not decide account policy or UI action availability.

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
Roma -> Tokyo /__internal/instances/{instanceId}/list-facts
```

For `/api/account/widgets`, the exact open must use the list-facts route only.
That route reads only exact stored facts needed by the Widgets list. It is not
an account inventory route and not a product-summary list.

Required list-facts response shape:

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

Tokyo returns the stored `instance.config.json` `displayName` as `string` or
`null`. Tokyo must not derive a fallback label from widget type, widget
metadata, instance id, or any other source. Roma applies the Widgets UI fallback
label when rendering product rows.

Tokyo list-facts implementation may read only:

```text
accounts/{accountId}/instances/{instanceId}/instance.config.json
accounts/{accountId}/instances/{instanceId}/serve-state.json
```

Package, content, overlay, locale package, and public runtime bytes are not part
of the Widgets list route.

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
- whether a duplicate click executes or returns an upgrade popup response;
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
- if a malformed immediate child coordinate exists under the account instance
  root, Tokyo returns HTTP 422 and must not omit that coordinate and continue;
- returns sorted ids only;
- does not require `instance.config.json` to exist before returning an id;
- does not read config, content, serve-state, package files, or overlays while
  building the account list.

Malformed coordinate failure contract:

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

Tokyo must not normalize, repair, skip, or continue after that coordinate.

Tokyo does not:

- build Widgets UI rows;
- decide product action meaning;
- decide account tier policy;
- decide create/publish limits;
- infer display name for the Widgets list response;
- derive fallback display names in `list-facts`;
- return publish counts for policy decisions;
- repair missing objects;
- omit corrupt objects.

Tokyo `GET /__internal/instances/{instanceId}/list-facts` does not:

- enumerate account instances;
- decide product action meaning;
- decide account tier policy;
- return generated package bytes;
- return content values;
- return overlays;
- return locale package facts.

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
- click-time create, duplicate, and publish upgrade responses
- delete and rename availability when those actions are permission or state
  dependent
- duplicate click-time upgrade response where duplicate is shown

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
  compatibility paths.
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
- duplicate controls are always rendered and clickable wherever the Widgets
  surface shows duplicate;
- publish controls are always rendered and clickable from an instance surface;
- `widgets.instances.max` is an action-time upgrade gate, not a
  catalog visibility gate, not an already-saved instance open gate, and not a
  use gate for saved widgets;
- `instances.published.max` is an action-time publish upgrade gate, not an
  instance visibility gate;
- duplicate is a create-like action and uses the same `widgets.instances.max`
  upgrade gate as Create instance;
- Roma opens returned `instanceIds` because they are the account's actual saved
  instance coordinates, not because Tokyo approved product eligibility;
- Roma uses two account inventory helpers:
  `listAccountWidgetInstanceIds` and `loadAccountWidgetInstanceFacts`;
- `listAccountWidgetInstanceIds` calls Tokyo
  `GET /__internal/accounts/{accountId}/instances` and returns exact sorted
  `instanceIds[]` only;
- `loadAccountWidgetInstanceFacts` calls `listAccountWidgetInstanceIds`, then
  opens each id through Tokyo
  `GET /__internal/instances/{instanceId}/list-facts`;
- `loadAccountWidgetInstanceFacts` uses bounded concurrency, maximum 8 list-fact
  requests at a time;
- Widgets list and publish gate use `loadAccountWidgetInstanceFacts`;
- Create and Duplicate gates use `listAccountWidgetInstanceIds.length`; they
  must not open instance config or serve-state just to enforce
  `widgets.instances.max`;
- locale fan-out iterates `listAccountWidgetInstanceIds`; it must not open
  config or serve-state just to discover coordinates;
- base-locale lock derives `locked = true` from
  `listAccountWidgetInstanceIds.length > 0`; it must not open Widgets list
  facts;
- for the Widgets list, the helper returns only instance identity, widget type,
  display label, updated timestamp, and publish state;
- Roma must not read content, overlays, generated packages, locale packages, or
  public package bytes for the Widgets list;
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
- duplicate-click upgrade response before Tokyo writes
- publish-click upgrade response before Tokyo writes
- product error wording

Roma policy source:

- Roma resolves account policy from the Berlin-issued account/authz snapshot
  through `@clickeen/ck-policy`.
- Michael/Supabase provides account relational facts. It does not become the
  entitlement matrix, Widgets inventory, or Widgets policy executor.

Tokyo stores and returns:

- exact storage coordinates;
- exact instance source/package artifacts by id;
- exact asset records and bytes;
- exact storage write/delete results.

Code execution must not invent a saved-instance product policy. This PRD
replaces the current incorrect `widgets.types.max` concept with
`widgets.instances.max`. `widgets.instances.max` is the create-click upgrade
gate for how many saved widget instances the account can create through
create-like actions. It does not hide catalog widgets, hide saved instances,
block opening already-saved instances, block using already-saved instances, or
disable controls. The account's published instance entitlement is the
publish-click upgrade gate. Those two gates are separate and both belong to
Roma.

## 4A. Roma Widgets Product Payload, Upgrade, And Copy Contract

The Roma Widgets surface renders:

```text
full widget catalog
saved account instances
clickable Create instance controls
clickable Duplicate controls where duplicate is shown
clickable Publish controls
```

The product model is not "disabled button with reason." The product model is:
user expresses intent, then Roma either executes or returns HTTP 402 with
`{ "ok": false, "kind": "UPGRADE_REQUIRED", "upgrade": ... }`.

Role and state UX rule:

```text
Monetization gates are clickable upgrade popups.
Role/state denials are explicit permission or state UX.
Plan-limit conditions must never be represented as disabled buttons, tooltips,
titles, inline raw errors, or list-payload availability booleans.
```

Create click contract:

```text
User clicks Create instance
Roma counts current account widget instances from the coordinate list length
Roma resolves widgets.instances.max from the Berlin-issued account/authz
snapshot through @clickeen/ck-policy

If within entitlement:
  Roma mints the instance id
  Roma submits the exact create command to Tokyo

If entitlement is reached:
  Roma returns HTTP 402 with { "ok": false, "kind": "UPGRADE_REQUIRED", "upgrade": ... }
  Roma does not call Tokyo
  UI opens the upgrade popup
```

Duplicate click contract:

```text
User clicks Duplicate
Roma counts current account widget instances from the coordinate list length
Roma resolves widgets.instances.max from the Berlin-issued account/authz
snapshot through @clickeen/ck-policy

If within entitlement:
  Roma mints the new instance id
  Roma submits the exact duplicate/create command to Tokyo

If entitlement is reached:
  Roma returns HTTP 402 with { "ok": false, "kind": "UPGRADE_REQUIRED", "upgrade": ... }
  Roma does not call Tokyo
  UI opens the upgrade popup
```

Publish click contract:

```text
User clicks Publish
Roma counts currently published account instances from Roma-opened exact
publish/list facts derived from the coordinate list
Roma resolves instances.published.max from the Berlin-issued account/authz
snapshot through @clickeen/ck-policy

If within entitlement:
  Roma submits the exact publish command to Tokyo

If entitlement is reached:
  Roma returns HTTP 402 with { "ok": false, "kind": "UPGRADE_REQUIRED", "upgrade": ... }
  Roma does not call Tokyo
  UI opens the upgrade popup
```

The UI may show loading while the click is being handled. It must not remove the
catalog item, hide the action, or convert an upgrade opportunity into a dead
disabled control.

Upgrade responses are command responses, not list payload state.

Required HTTP response for create over entitlement:

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

Required HTTP response for duplicate over entitlement:

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
    "action": "duplicate_instance",
    "current": 3,
    "limit": 3
  }
}
```

Required HTTP response for publish over entitlement:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

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

The user-facing upgrade copy must be shown in the upgrade popup opened from the
click. It must not be delivered as an account notice, disabled-button title,
tooltip, raw reason key, inline technical error, generic permission denial, or
any other non-popup substitute.

The upgrade popup must render the primary copy, current/limit context, and an
upgrade CTA from the HTTP 402 `UPGRADE_REQUIRED` payload.

Forbidden Widgets list payload fields:

```text
canCreate
createDisabledReason
disabledReasonKey for Create instance
disabledReasonKey for Duplicate
disabledReasonKey for Publish
boolean Create instance availability
boolean Duplicate availability
boolean Publish availability
```

Required `GET /api/account/widgets` response shape after PRD 125:

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

Roma must not return both `catalog` and `systemWidgets` during migration.
PRD 125 updates the client normalizer, cache, and UI to consume `catalog` plus
`instances` only, with no compatibility fallback to `systemWidgets`, `canCreate`,
`actions`, or monetization `disabledReasonKey` payloads.

Role/state action rendering:

```text
Create instance is rendered from catalog rows.
Duplicate is rendered from instance rows where the surface offers Duplicate.
Publish is rendered from instance rows with status = unpublished.
Unpublish is rendered from instance rows with status = published.
Rename and Delete are rendered from the current account role and instance row.
```

The list response must not return action booleans for monetization. The client
derives non-monetization role/state rendering from the current account role and
the instance row state, then command routes enforce the same role/state boundary.

`GET /api/account/widgets` must not decide monetization availability for Create
instance, Duplicate, or Publish. Upgrade is determined only when the user clicks
the action. Permission or state controls may still be unavailable where the user
cannot perform the operation, but tier monetization controls are different:
Create instance, Duplicate, and Publish remain clickable and resolve through
HTTP 402 `UPGRADE_REQUIRED` when over entitlement.

Client upgrade handling contract:

```text
Create, Duplicate, and Publish action handlers must inspect HTTP 402 JSON before
generic same-origin error parsing.

If response body is:
{ "ok": false, "kind": "UPGRADE_REQUIRED", "upgrade": { ... } }

Then the Widgets surface opens the upgrade popup with that payload.
The body must not be wrapped under `error`.
The client must not collapse it into HTTP_402, reasonKey, toast-only copy, or a
disabled control.
```

Primary Widgets user copy:

| State | Primary copy |
| --- | --- |
| Inventory/open failure | We couldn't load your widgets. No widgets were changed. Try again. |
| Corrupt saved widget | One saved widget needs attention before this list can load. No widgets were changed. |
| Create upgrade gate | Upgrade to create more widgets. |
| Duplicate upgrade gate | Upgrade to create more widgets. |
| Publish upgrade gate | Upgrade to publish more widgets. |
| Upstream unavailable | Widgets are unavailable right now. Please try again. |
| Permission denial | You do not have permission to change widgets in this account. |

No user-visible copy may say:

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
Maximum widget instances the account can create through create-like actions.
This key is enforced when Create instance or Duplicate would add another saved
widget instance.
```

`widgets.instances.max` does not mean:

```text
Maximum widget types.
Catalog visibility.
Catalog filtering.
Disabled Create instance button.
Disabled Duplicate button.
Blocked opening of already-saved widget instances.
Blocked use of already-saved widget instances.
Tokyo storage permission.
```

PRD 125 locks finite `widgets.instances.max` tier values for execution:

```json
{
  "free": 3,
  "tier1": 10,
  "tier2": 25,
  "tier3": 100,
  "tier4": 250
}
```

No `widgets.instances.max` tier value may be `null` after PRD 125 execution.

PRD 125 also locks finite `instances.published.max` tier values for execution:

```json
{
  "free": 1,
  "tier1": 1,
  "tier2": 5,
  "tier3": 25,
  "tier4": 100
}
```

No `instances.published.max` tier value may be `null` after PRD 125 execution.
For every tier, `widgets.instances.max` must be greater than or equal to
`instances.published.max`.

Execution requirements:

- replace `widgets.types.max` with `widgets.instances.max` in
  `packages/ck-policy/src/registry.ts`;
- replace `widgets.types.max` with `widgets.instances.max` in
  `packages/ck-policy/entitlements.matrix.json`;
- update Roma create route policy reads to use `widgets.instances.max`;
- update Roma duplicate route to enforce `widgets.instances.max` before Tokyo
  writes;
- update Roma publish route to return exact HTTP 402 `UPGRADE_REQUIRED` for
  `instances.published.max`;
- update Roma Widgets route policy reads to use `widgets.instances.max`;
- update Roma client Create, Duplicate, and Publish handlers to inspect
  unwrapped HTTP 402 `UPGRADE_REQUIRED` bodies before generic error handling;
- update `instances.published.max` tier values so every tier is finite;
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
- policy arithmetic proof that every `widgets.instances.max` value is finite,
  every `instances.published.max` value is finite, and
  `widgets.instances.max >= instances.published.max` for every tier
- V1-V8 risk list

Compliance:

This prevents old PRDs or agent memory from becoming hidden authority. It also
prevents coding outside the locked route contract.

### Slice 2: Widgets Inventory Boundary

Move Roma Widgets away from Tokyo product-list reconstruction.

Required behavior:

- Roma returns the full widget catalog independent of account tier.
- Roma returns saved account instance rows derived from exact list-facts opens.
- Roma uses coordinate-list ids directly for count, existence, and locale
  fan-out paths that do not need row fields.
- Roma owns product interpretation and account policy.
- Tokyo returns `accountId + instanceIds[]` only.
- Missing/corrupt inventory truth fails visibly.
- No fallback to Supabase.
- No new R2 index JSON.
- No silent omission of broken instances.

Compliance:

This removes Tokyo as product brain without replacing it with an inferred
authority.

### Slice 3: Widget Create/Duplicate/Publish Upgrade Gates

Update create, duplicate, and publish enforcement so Roma uses the cheapest
truth required for each gate.

Required behavior:

- `widgets.instances.max` is enforced by Roma at Create instance click
  time.
- `widgets.instances.max` is enforced by Roma at Duplicate click time.
- `instances.published.max` is enforced by Roma at Publish click time.
- create and duplicate upgrade gates use the coordinate list length.
- publish upgrade gate uses Roma-opened exact publish/list facts derived from
  the coordinate list.
- create remains clickable from the full catalog.
- duplicate remains clickable wherever the Widgets surface shows it.
- publish remains clickable from the instance surface.
- when create exceeds entitlement, Roma returns HTTP 402 `UPGRADE_REQUIRED` and
  does not call Tokyo.
- when duplicate exceeds entitlement, Roma returns HTTP 402 `UPGRADE_REQUIRED`
  and does not call Tokyo.
- when publish exceeds entitlement, Roma returns HTTP 402 `UPGRADE_REQUIRED`
  and does not call Tokyo.
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
- create, duplicate, and publish over entitlement return upgrade responses
  before Tokyo is called;
- duplicate is a create-like action and uses the same `widgets.instances.max`
  gate as Create instance;
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

Do not delete this route. It remains the account coordinate-list route.

Remove the facts route below in the same pre-GA cut once the implementation
branch verifies Roma base-locale lock and every other caller uses the coordinate
list plus exact list-facts opens:

```text
GET /__internal/accounts/{accountId}/instances/facts
```

Compliance:

No broken build. No preserved product-summary route. No shadow product path.

### Slice 7: Documentation Update

Update current docs after runtime behavior is green:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`: Widgets list flow, Create/Duplicate/Publish
  clickable HTTP 402 `UPGRADE_REQUIRED`, no monetization booleans
- `documentation/services/tokyo-worker.md`: account instance list returns only
  `accountId + instanceIds[]`, add `/__internal/instances/{instanceId}/list-facts`,
  and state `/instances/facts` is removed in the same pre-GA cut
- `documentation/services/michael.md`: `public.instances` remains
  registry/status only and is not Widgets inventory authority
- `documentation/capabilities/multitenancy.md` because PRD 125 replaces
  `widgets.types.max` with `widgets.instances.max`, locks finite tier values,
  and changes Widgets monetization UX to click-time HTTP 402 `UPGRADE_REQUIRED`
- `documentation/capabilities/localization.md` because locale fan-out cost
  derives from coordinate count, not opened row facts
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
- Duplicate controls remain visible and clickable wherever the Widgets surface
  shows duplicate.
- Publish controls remain visible and clickable from the instance surface.
- Create over entitlement returns HTTP 402 `UPGRADE_REQUIRED` and does not call
  Tokyo.
- Duplicate over entitlement returns HTTP 402 `UPGRADE_REQUIRED` and does not
  call Tokyo.
- Publish over entitlement returns HTTP 402 `UPGRADE_REQUIRED` and does not call
  Tokyo.
- Create, Duplicate, and Publish upgrade-required responses use HTTP 402 and
  the exact `UPGRADE_REQUIRED` body shape from this PRD.
- Every `widgets.instances.max` tier value is finite.
- Every `instances.published.max` tier value is finite.
- For every tier, `widgets.instances.max >= instances.published.max`.
- `GET /api/account/widgets` does not return `canCreate`,
  `createDisabledReason`, `disabledReasonKey` for Create instance,
  `disabledReasonKey` for Duplicate, `disabledReasonKey` for Publish, boolean
  Create instance availability, boolean Duplicate availability, or boolean
  Publish availability.
- Locale settings fan-out iterates the exact returned ids.
- Base-locale lock derives instance existence from the coordinate list.
- `widgets.instances.max` is not implemented as widget-type gating.
- `widgets.instances.max` is not implemented as catalog hiding.
- `widgets.instances.max` is not implemented as a disabled button.
- `widgets.types.max` is gone from active policy code after execution.
- Rename/delete/publish/unpublish do not produce split truth.
- Assets still list/upload/resolve/delete through the current account lane.
- Tokyo no longer returns Widgets product summaries from the account list route.
- User copy for inventory corruption, upgrade-required create,
  upgrade-required duplicate, upgrade-required publish, and upstream unavailable
  states does not render raw storage route, JSON, `reasonKey`, or
  implementation detail as primary user copy.

Focused tests or route-level checks must prove:

- Tokyo list returns only `accountId + instanceIds[]`.
- Tokyo coordinate enumeration fails visibly on malformed immediate child
  coordinates and does not omit them.
- Roma fails the whole Widgets response when a returned id cannot open exactly.
- Create upgrade gate derives from coordinate list length.
- Duplicate upgrade gate derives from coordinate list length.
- Publish upgrade gate derives from Roma-opened exact publish/list facts from
  the coordinate list.
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
- Did a tier limit disable Duplicate instead of producing an upgrade popup from
  the click?
- Did `widgets.types.max` survive in active policy code?
- Did any `widgets.instances.max` tier value remain `null`?
- Did any `instances.published.max` tier value remain `null`?
- Did any tier allow more published instances than created widget instances?
- Did Roma open overlays/packages/runtime bytes just to render the Widgets list?

## 8. Acceptance Criteria

This PRD is complete only when:

1. Roma Widgets consumes `accountId + instanceIds[]` from Tokyo.
2. Roma Widgets no longer depends on an undocumented Tokyo R2 reconstruction
   path.
3. Tokyo does not return product meaning in the account instance list response.
4. Supabase/Michael is out of the Widgets inventory path.
5. `widgets.types.max` is replaced by `widgets.instances.max` in active policy
   code.
6. `widgets.instances.max` and `instances.published.max` are finite for every
   tier, and `widgets.instances.max >= instances.published.max` for every tier.
7. Assets boundary is documented in the same terms and not broken by the
   Widgets correction.
8. Current docs match runtime behavior.
9. Checks are green.
10. V1-V8 audit is green.
11. Full catalog visibility, clickable Create instance, clickable Duplicate,
   clickable Publish, and upgrade-required command responses are verified.

## 9. Non-Goal

This PRD does not implement a broad new architecture. It does not solve future
pages/apps/composition work. It does not redesign all storage. It locks and
executes the account inventory boundary for Widgets and verifies the same law
against Assets.
