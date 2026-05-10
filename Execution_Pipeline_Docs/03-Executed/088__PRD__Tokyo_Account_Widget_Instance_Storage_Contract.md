# PRD 088: Tokyo Account Widget Instance Storage Contract

Status: EXECUTED  
Owner: Clickeen Architecture / Tokyo Worker  
Date: 2026-05-09
Executed: 2026-05-10

## 1. Purpose

Tokyo storage must become simple enough that a human, an AI agent, and the product runtime can all answer the same questions without hunting through old folders, copied public trees, pointer chains, semantic IDs, or stale product words.

This PRD replaces the current account-instance storage shape with a stricter account -> widget type -> instance contract.

The core rule:

```txt
Every account has one account folder.
Every account-owned object lives inside that account folder.
Inside the account folder, assets and widgets are the two primary owned domains.
Inside each widget type folder, each child instance folder is one instance of that widget type.
```

This PRD also fixes overlay naming:

```txt
Account widget instance derived artifacts are account instance overlays.
The only product-active account instance overlay type today is l10n.
Prague website page derived copy is Prague page translations.
```

Those names must not collapse into one generic "translations" bucket.

This PRD is a pre-GA hard cut. It must not preserve old `curated`, `template`, `starter`, `public projection as truth`, or `publicId as separate identity` concepts.

## 2. Current Problem

Current Tokyo R2 still carries several incompatible eras:

```txt
accounts/
l10n/
public/
widgets/
```

The folder names are not equally meaningful:

- `accounts/` is account-owned source data.
- `widgets/` is product widget software/static runtime.
- `l10n/` is static localization, while instance localization also lives elsewhere.
- `public/` is a copied public serving tree that currently behaves like a second source of truth.

The Prague embed failure exposed the issue in the smallest possible dataset:

```txt
1 account:
  00000000-0000-0000-0000-000000000100

3 widget types:
  faq
  countdown
  logoshowcase

Tokyo admin account currently has:
  wgt_curated_faq_*

Prague currently embeds:
  wgt_system_faq_*
```

The system preserved old IDs in Tokyo while Prague moved to new IDs. This should have been impossible in a clean storage model.

The deeper issue is not just the old IDs. The deeper issue is that the current model makes simple product truth difficult to inspect:

```txt
Which account owns this?
Which widget type is this?
Which instances exist for this widget?
Is this widget type active for the account?
Is this instance published?
Which config/text/overlays are current?
```

Those questions must be answerable from one obvious account-owned folder.

The current docs also use "overlay" too broadly in strategy language. That must not drive storage. Today, the only active account-instance overlay is `l10n`. Visual styling, geo, audience, campaign, and Prague page copy are not account-instance overlay folders in this PRD.

## 3. Product Decisions

### 3.0 Clickeen Uses Clickeen

Clickeen must use its own product.

Prague works like a regular Clickeen customer website: it embeds Clickeen-owned widget instances through the same public widget serving path every customer site uses.

There is no Prague-specific widget runtime, no Prague-specific instance storage, no Prague-specific translation lane, and no Prague-specific embed truth.

In current pre-GA reality:

```txt
Clickeen admin account owns instances.
Prague embeds those Clickeen-owned instances.
Venice serves those published instances.
Roma edits and manages those same instances.
```

Admin is not a separate architecture. Admin is a hyper-user of Clickeen:

- admin has broader permissions
- admin owns normal account data under its account folder
- admin-owned instances use the same widget/config/locale/overlay/publish contract as any other account-owned instance
- admin-owned assets use the same account asset contract as any other account-owned asset

The only product difference for selected admin-owned instances is that the platform may reference them from platform-owned places:

```txt
Roma may list selected admin-owned instances as duplicable examples
Prague may embed selected Clickeen-owned instances in page content
```

That is not metadata on the instance itself. It is not a new storage class and not a new runtime flow.

Normal account instances must not carry hidden global/system flags like `visibleInRoma`, `duplicable`, or `embeddableOnPrague`. Putting platform behavior flags inside every account instance would pollute the customer data model and create a dangerous path where a normal user-owned instance could accidentally become globally visible or duplicable.

System selection belongs in platform-owned reference data, for example:

```txt
product/catalog/roma-duplicable-instances.json
tokyo/prague/pages/** page content
```

Those references point to normal account-owned instances by `accountId`, `widgetType`, and `instanceId`. They do not change what the instance is.

This matters because the same model can later support a creator marketplace without inventing a new architecture. A creator would simply be another account that owns instances and chooses to make some of them available for other Clickeen users to duplicate and use. That is a long-tail conceptual opportunity only; this PRD must not build marketplace features now. The point is to avoid closing the architecture around admin as a one-off special case.

### 3.0A Account Instance Overlays vs Prague Page Translations

Account widget instances and Prague website pages both may have derived localized text, but they are not the same product object and must not share product naming.

For account widget instances, the product name is:

```txt
account instance overlays
```

The active overlay type today is:

```txt
overlays/l10n/
```

That means:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/...
```

For Prague website pages, the product name is:

```txt
Prague page translations
```

That means Prague page copy uses a separate website-copy path, for example:

```txt
site/prague/pages/{pageId}/translations/{locale}/...
```

Why they must stay separate:

- account instance overlays belong to one account-owned widget instance
- Prague page translations belong to Clickeen website page copy
- account instance overlays follow account locale policy and instance save/publish lifecycle
- Prague page translations follow Clickeen website content changes and Prague publication lifecycle
- account instance overlays are consumed by Builder/Venice for a widget instance
- Prague page translations are consumed by Prague pages

They may share the low-level safety rules: set-only ops, allowlisted paths, and base fingerprint checks. They must not share product names, storage roots, lifecycle, or ownership.

Do not create generic future overlay folders now. Future account-instance overlay folders beside `l10n` require a dedicated PRD that defines selector, allowlist, readiness, lifecycle, runtime composition, and policy ownership.

The Prague page path shown above is a naming/ownership target, not permission to bundle a broad Prague page translation migration into PRD 088. PRD 088 must only ensure Prague page translations are not treated, named, or stored as account-instance overlays. A separate Prague translation storage migration requires its own explicit execution scope.

### 3.1 Account Root Is The Ownership Boundary

Tokyo must store every account-owned object under one account folder:

```txt
accounts/{accountId}/
```

Admin is not special. Admin-owned instances live under the admin account folder like every other account's instances.

There must be no separate admin lane, curated lane, template lane, starter lane, or public source lane.

### 3.2 Account Folder Has Two Primary Owned Domains

Each account folder has:

```txt
accounts/{accountId}/
  assets/
  widgets/
```

`assets/` contains account-owned uploaded files.

`widgets/` contains account-owned state by widget type.

### 3.3 Widget Type Folder Owns Widget-Level Account State

Each widget type gets its own folder:

```txt
accounts/{accountId}/widgets/{widgetType}/
```

That folder has a required `widget.json` file:

```json
{
  "v": 1,
  "accountId": "00000000-0000-0000-0000-000000000100",
  "widgetType": "faq",
  "status": "active",
  "lockedReason": null,
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

`widget.json` answers account-level widget questions:

- Does this account have this widget type?
- Is this widget type active?
- Is this widget type locked because of plan downgrade or policy?
- Why is it locked?

This is required for SaaS downgrade handling.

Example:

```txt
Tier 3 account:
  faq active
  countdown active
  logoshowcase active
  ...more widget types...

Downgrades to Tier 1 with one allowed widget type:
  faq active
  countdown locked_over_plan
  logoshowcase locked_over_plan
```

The data remains owned by the account. The product blocks editing, creation, publishing, and serving according to explicit widget-folder state and account policy. Nothing is silently deleted.

### 3.4 Instance Folders Live Directly Under Widget Type

Inside a widget type folder, each child instance folder is an instance:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/
```

Do not add a redundant `instances/` folder:

```txt
BAD:
accounts/{accountId}/widgets/faq/instances/{instanceId}/

GOOD:
accounts/{accountId}/widgets/faq/{instanceId}/
```

Once the path is inside `widgets/faq/`, the children are FAQ instances by definition.

### 3.5 Instance IDs Are Stable Generated IDs

The instance folder name is the instance ID.

It must not be based on:

- widget name
- instance display name
- Prague/marketing name
- style name
- user-editable title

It must not use `wgt_`, because `wgt_` implies widget software/type and causes confusion between widget and instance.

Use an instance prefix:

```txt
ins_01HX7J9A2Q8N6V4M3ZP0K1R2S3
```

Example:

```txt
accounts/{accountId}/widgets/faq/ins_01HX7J9A2Q8N6V4M3ZP0K1R2S3/
```

Renaming the instance changes only `displayName`. It never moves the folder and never changes the embed ID.

### 3.6 One ID, Not `instanceId` Plus `publicId`

There must be one instance ID.

If an instance is published, that same ID is the public/embed ID.

Do not keep a separate `publicId` concept in the product contract.

The instance file uses:

```json
{
  "v": 1,
  "id": "ins_01HX7J9A2Q8N6V4M3ZP0K1R2S3",
  "accountId": "00000000-0000-0000-0000-000000000100",
  "widgetType": "faq",
  "displayName": "Hotel FAQ",
  "createdAt": "2026-05-09T00:00:00.000Z",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Not:

```json
{
  "instanceId": "inst_...",
  "publicId": "wgt_system_faq_lightblurs_generic"
}
```

The old split caused the current drift: product-facing IDs changed while Tokyo storage kept old IDs.

Publish state does not live on `instance.json`. It lives on `publish.json` plus the generated published lookup card. Platform references for Roma/Prague also do not live on `instance.json`; they live in platform-owned reference data. This keeps account-owned instance identity/display separate from public serving and platform selection state.

### 3.7 Public Route Names Must Be Real Words

`/e/{id}` and `/r/{id}` are not product language.

The public render route should use:

```txt
/widget/{instanceId}
```

Use singular `/widget/{instanceId}` because the customer-facing URL opens one embedded widget. The code should still call the ID `instanceId`; the URL word is product language, not storage topology.

The route can still internally call Tokyo/Venice APIs, but public and code-facing names must stop hiding meaning behind abbreviations. Do not add `/e` or `/r` aliases during this pre-GA hard cut.

### 3.8 No Full Copied `public/instances` Tree

Do not keep a second full copy of instance state under:

```txt
public/instances/{id}/config/
public/instances/{id}/l10n/
public/instances/{id}/meta/
```

That creates two truths and makes overlays impossible to reason about.

If public lookup needs a generated routing index, it must be tiny, generated, and rebuildable. It must not contain config, locale packs, overlays, or account-owned data.

The same rule applies to any future generated index: it can speed up reads, but it cannot become truth. If deleting and rebuilding the generated object from `accounts/{accountId}/...` is not possible, the object does not belong in this model.

Allowed shape:

```txt
published/widgets/{instanceId}.json
```

Example:

```json
{
  "v": 1,
  "id": "ins_01HX7J9A2Q8N6V4M3ZP0K1R2S3",
  "accountId": "00000000-0000-0000-0000-000000000100",
  "widgetType": "faq",
  "status": "published",
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

This file is not source truth. It is only a public route lookup card. It is deleted or rebuilt from account-owned source.

## 4. Target R2 Shape

Target account-owned source:

```txt
accounts/
  {accountId}/
    assets/
      {assetId}/
        asset.json
        file

    widgets/
      {widgetType}/
        widget.json

        {instanceId}/
          instance.json
          config.json
          overlays/
            l10n/
              {locale}/
                overlay.json
          publish.json
```

`overlays/l10n/{locale}/overlay.json` is the account-instance l10n artifact for that locale. It is derived from `config.json`, tied to the current base fingerprint, and contains only allowlisted set ops/status for that one instance and locale.

The base locale is not an overlay. The base locale is metadata on the account/instance base authoring contract. `l10n` overlays exist only for translated locales.

Target generated public lookup:

```txt
published/
  widgets/
    {instanceId}.json
```

Target product/static plane:

```txt
product/
  catalog/
    roma-duplicable-instances.json
  widgets/
  dieter/
  fonts/
  themes/

site/
  prague/
    pages/
      {pageId}/
        translations/
          {locale}/
  roma/
```

Stable public HTTP routes may still expose `/widgets/**`, `/dieter/**`, `/fonts/**`, etc., but R2 storage paths should not force product software to sit beside account data.

`product/catalog/roma-duplicable-instances.json` is platform-owned reference data. It may point to admin-owned instances that Roma should show as duplicable examples. It is not account instance truth, and it must not be copied into normal user instances.

## 5. Current-State Deletion Targets

These are deletion targets unless execution proves a specific surviving need:

```txt
accounts/{accountId}/instances/
public/instances/
wgt_curated_*
wgt_system_* instance IDs
publicId fields as separate identity from instance id
platform/system selection flags inside normal account `instance.json`
/e/{id} public route
/r/{id} route naming as public/product contract
full config/l10n/meta copies outside account folder
top-level account-instance l10n truth outside `accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/`
hash-only/pointer-only current truth as human inspection path
```

Important: immutable hashes may still be used internally for caching or integrity, but they must not be the only way to understand the current product state. The readable source files must be:

```txt
widget.json
instance.json
config.json
overlays/l10n/{locale}/overlay.json
publish.json
```

## 6. Required Runtime Semantics

### 6.1 Save

Saving an instance writes account-owned source only:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/instance.json
```

No public/published lookup file is written by save alone.

### 6.2 Publish

Publishing an instance:

1. validates the account owns the widget folder
2. validates the widget folder is active
3. validates the instance exists
4. writes:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/publish.json
published/widgets/{instanceId}.json
```

The generated `published/widgets/{instanceId}.json` contains only lookup/routing metadata.

### 6.3 Unpublish

Unpublishing an instance:

1. updates account-owned `publish.json`
2. deletes `published/widgets/{instanceId}.json`

### 6.4 Delete Instance

Deleting an instance removes:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/
published/widgets/{instanceId}.json
```

if it exists.

### 6.5 Delete Account

Deleting an account removes:

```txt
accounts/{accountId}/
```

and deletes all generated published lookup cards that point to that account.

Execution must provide an audit/rebuild command so this does not depend on human memory.

### 6.5A Account Instance L10n Overlay Sync

Translation/l10n work for a widget instance writes only under the owning instance:

```txt
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

Rules:

1. `l10n` is the only product-active account-instance overlay folder in this PRD.
2. One locale gets one locale folder under `overlays/l10n/`.
3. The base locale does not get a locale overlay folder.
4. The overlay file is derived state, not a second instance.
5. The overlay file must be tied to the active base fingerprint.
6. Stale overlays are not public truth.
7. Missing current overlays fail visibly at the owning boundary; consumers do not heal, backfill, or choose "best available".
8. Prague page translations never write here.

Minimum artifact shape:

```json
{
  "v": 1,
  "type": "l10n",
  "locale": "fr",
  "baseFingerprint": "sha256-...",
  "status": "ready",
  "ops": [
    { "op": "set", "path": "headline", "value": "..." }
  ],
  "updatedAt": "2026-05-09T00:00:00.000Z"
}
```

Allowed statuses:

```txt
queued
working
ready
failed
```

Do not add `geo`, `audience`, `campaign`, `visual`, or `experiment` folders as part of this PRD.

### 6.6 Downgrade

When account policy changes from many allowed widget types to fewer allowed widget types:

1. account data is retained
2. disallowed widget folders are marked locked in `widget.json`
3. upgrade restores access by changing widget-folder state, not by restoring deleted data

This is why `widget.json` exists at widget-type folder level.

Full product enforcement for locked widgets is intentionally not implemented by PRD 088. PRD 088 creates the storage authority; PRD 088B will define and execute the Roma/Builder/publish/public-serving behavior.

## 7. Execution Plan

### 7.0 Execution Guardrails

Slices 1, 2, and 3 are one atomic hard-cut unit:

```txt
contract/key builders
admin account data migration
public route cutover
```

They must not be deployed independently. Shipping new key builders while live data and public routes still depend on the old shape creates two product contracts and preserves the exact drift this PRD is deleting.

No product runtime compatibility layer is allowed for old keys. The migration script may read old keys and write new keys. Product runtime after the cut must only use the new contract.

The mechanical rename from `publicId` to `instanceId` may happen as an internal commit in the atomic execution unit, but it must not be deployed alone as a product state. The rename is a safety step to let TypeScript expose every callsite, not a transitional product architecture.

Slice 4 downgrade enforcement is intentionally split out of PRD 088. PRD 088 creates the storage state needed for downgrade (`widget.json`). A follow-up PRD 088B owns product enforcement across Roma, Builder, publish, and public serving.

### Slice 0: Inventory And Freeze

Produce a verified inventory from live R2 and code:

```txt
account ids
widget types per account
instance folders
current public IDs
Prague embed IDs
Venice route IDs
published/live objects
old curated/system IDs
```

Do not write data yet.

Exit criteria:

- exact before table is checked into the execution report
- every surviving admin-owned instance has a chosen final `ins_*` ID
- every delete target has an explicit object prefix
- migration script spec is written before code execution
- migration script dry-run output shape is defined

The migration script spec must define:

```txt
input:
  live R2 inventory
  explicit old-id -> new ins_* mapping
  old key prefixes to read
  old key prefixes to delete

output:
  planned writes
  planned deletes
  Prague JSON rewrites
  widget.json files to create
  instance.json files to create
  overlay files to create
  published lookup files to create

required behavior:
  dry-run mode
  idempotent re-run
  refusal on mismatched existing target data
  execution report with before/after object counts
```

### Slice 1: Contract Types And Key Builders

Update Tokyo/Tokyo-worker key builders and product contracts to the target shape.

Required changes:

- introduce `accounts/{accountId}/widgets/{widgetType}/{instanceId}/...`
- introduce `widget.json`
- introduce `instance.json`
- introduce `overlays/l10n/{locale}/overlay.json` for account-instance l10n artifacts
- keep Prague page translations outside account-instance overlays
- replace `publicId` naming in active product contracts with `id` or `instanceId`
- keep compatibility only inside the migration script if needed, not in product runtime
- keep platform selection outside `instance.json`
- introduce platform-owned Roma duplicable-instance catalog only if Roma still needs a list of admin-owned examples after the storage cut

Exit criteria:

- TypeScript compiles
- no new product route writes `accounts/{accountId}/instances/...`
- no new product route writes full `public/instances/...` copies
- no product route writes account-instance l10n outside `overlays/l10n/`
- no normal account `instance.json` contains platform/system selection flags

### Slice 2: Admin Account Data Migration

Pre-GA hard migration for the current admin account:

```txt
00000000-0000-0000-0000-000000000100
```

Move current admin data into:

```txt
accounts/{adminAccountId}/widgets/{widgetType}/{ins_*}/...
```

Delete old:

```txt
accounts/{adminAccountId}/instances/
public/instances/
top-level l10n truth for account instances
wgt_curated_*
wgt_system_*
```

Update Prague JSON to embed the new `ins_*` IDs.

This script is the only allowed reader of the old storage shape during execution. After the atomic cut, product runtime must not read or write old IDs, old account-instance folders, or old public projection folders.

Exit criteria:

- no R2 object under admin account uses `wgt_curated_*`
- no R2 object under admin account uses `wgt_system_*`
- Prague references only final `ins_*` IDs
- the three current widget types are visible under `accounts/{admin}/widgets/`
- current admin account instance l10n is under `overlays/l10n/{locale}/overlay.json`

### Slice 3: Publish And Venice Route Cutover

Replace the `/e` and `/r` contract with the explicit public route:

```txt
/widget/{instanceId}
```

Venice/Tokyo public serving must resolve:

```txt
published/widgets/{instanceId}.json
  -> accounts/{accountId}/widgets/{widgetType}/{instanceId}/...
```

Exit criteria:

- Prague embeds render through `/widget/{instanceId}`
- no Prague page depends on `/e/{id}`
- no runtime depends on `public/instances/{id}/config|l10n|meta`

### Slice 4: Moved To PRD 088B

PRD 088 creates the storage file required for downgrade handling:

```txt
active
locked_over_plan
```

Full enforcement is moved to PRD 088B because it touches a different product surface:

- Roma Widgets page reads widget-folder state
- Builder open blocks locked widget types clearly
- publish blocks locked widget types clearly
- public serving blocks locked widget types clearly unless a later billing PRD adds a grace state

PRD 088 exit criteria for downgrade scope:

- `widget.json` supports `active` and `locked_over_plan`
- migration creates valid `widget.json` files
- no data is deleted by the storage migration
- no runtime enforcement work is hidden inside PRD 088

### Slice 5: Cleanup Docs And Dead Names

Update:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/tokyo.md`
- Tokyo-worker docs
- Prague embed docs
- Venice docs

Delete or rewrite wording:

```txt
curated
starter
template
public projection as truth
publicId as separate id
```

Use:

```txt
account
widget type
instance
asset
locale
account instance overlay
l10n
Prague page translation
publish
published lookup
```

Exit criteria:

- docs match runtime names
- `rg "wgt_curated|publicId|starter|template|curated"` has only historical executed docs or explicit migration-report references
- Prague page translation docs do not call Prague website copy account instance overlays
- account instance l10n docs use `overlays/l10n/`

## 8. Verification Checklist

Before closing this PRD:

1. `pnpm typecheck`
2. `pnpm lint`
3. Tokyo-worker typecheck/build
4. Roma build
5. Venice build
6. Prague build
7. R2 inventory after migration
8. Prague FAQ page renders all embedded admin-owned instances
9. Roma Widgets page shows the same instances from the admin account widget folders
10. Publish/unpublish changes only account source plus tiny published lookup
11. `widget.json` supports `active` and `locked_over_plan`; full downgrade enforcement is tracked in PRD 088B
12. No surviving product runtime path writes or reads old `accounts/{accountId}/instances/{publicId}` as canonical truth
13. No surviving product runtime path writes or reads full `public/instances/{id}` copies as canonical truth
14. No surviving product runtime path writes account-instance l10n outside `accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/`
15. Prague page translations are not written under account instance overlays and do not share account-instance overlay naming
16. Slices 1, 2, and 3 are verified as one atomic deployed cut, not three independently deployed product states

## 9. Non-Goals

This PRD does not introduce:

- creator marketplace or special creator-account architecture beyond the normal account-folder contract
- vanity public URLs
- redirect/alias support for old IDs
- backward compatibility for `wgt_curated_*`
- a template/starter storage model
- a second public source of truth
- a generic storage framework
- future overlay folders beyond account-instance `l10n`
- Prague page translations as account instance overlays

## 10. Summary Of What Must Be Done

We must hard-cut Tokyo to this product model:

```txt
Account owns assets and widgets.
Widget type folder owns widget-level account state.
Instance folders live directly under widget type.
Account instance overlays live under each instance.
The only product-active account instance overlay type today is `overlays/l10n`.
Prague page translations are a separate website-copy path and must not share account-instance overlay naming.
Instance IDs are stable generated `ins_*` IDs.
The same instance ID is used for storage and public serving.
Display names are editable metadata, never storage identity.
Publishing writes a tiny generated lookup, not a copied public tree.
Widget folders carry downgrade lock state; enforcement follows in PRD 088B.
Old curated/system semantic IDs are deleted pre-GA.
```

This is the simplest durable shape for Clickeen because it makes the product inspectable:

```txt
account -> assets
account -> widgets -> widget type -> instance
```

Everything else is derived, rebuildable, or deleted.
