# PRD 099 - Tokyo R2 Product Storage Architecture Refactor

Status: Executing  
Owner: Product + Architecture  
Date: 2026-05-15

## Purpose

PRD 098 fixed overlay identity and the first language-overlay application. It did not finish the physical Tokyo/R2 storage architecture.

PRD 099 makes Tokyo R2 boring and product-true:

- widgets are product software
- accounts own instances and assets
- Dieter and fonts are shared static resources
- Prague owns marketing/site/GTM content
- R2 root folders must match those product facts

The current live R2 bucket still carries old AI-made storage residue and deploy-history leakage. That must be hard-cut before the rest of the system can stay understandable.

## Peer Review Disposition

Staff-engineer review agrees with the diagnosis and target architecture: the five-root model is the boring correct answer and the PRD deletes more than it adds.

The review also identifies execution blockers this PRD now resolves:

- product widget software must be R2-backed under `product/widgets/`, with repo/static deploy treated as source/sync input rather than a separate storage truth
- root `published/` cannot be deleted until public runtime stops depending on an instance-only global lookup
- PRD 099 must explicitly supersede PRD 098's physical `accounts/{accountPublicId}/widgets/{widgetCode}/{instanceId}/` storage path while preserving PRD 098 overlay identity
- account assets must use `accountPublicId` storage paths, not private UUID account folders
- retained Prague localization must live under `prague/`, not root `l10n/`
- migration work must stay one-time operator tooling, not become a framework

## Execution Slice Map

PRD 099 is too wide to execute as one code change. It executes through eight slices with explicit boundaries:

| Slice | Scope | Primary Risk |
| --- | --- | --- |
| `099A` | Evidence lock and R2 inventory | mutating/deleting before every live object is classified |
| `099B` | Git deploy roots and product asset serving | confusing deploy-managed roots with runtime account state |
| `099C` | Account runtime storage contract | preserving `accounts/{uuid}/widgets/**`, `wgt_*`, or `ins_*` as live product truth |
| `099D` | Tokyo-worker PBX route/key refactor | turning Tokyo-worker into product policy or keeping stale path readers |
| `099E` | Venice public PBX and published projection route contract | Venice evaluating policy or depending on root `published/` |
| `099F` | Roma/Bob/Admin management-plane convergence | product paths inventing a separate storage lane |
| `099G` | Admin account recreation and data cutover | mechanically moving invalid old IDs/overlays into the new model |
| `099H` | Migration deletion, CI guards, rollback, and closure | leaving migration tooling or old roots alive |

Execution order is mostly sequential:

```text
099A -> 099B -> 099C -> 099E-contract -> 099D/099E/099F -> 099G -> 099H
```

`099D`, `099E`, and `099F` may be developed in parallel after `099C` names the final account runtime keys and `099E` locks the public route contract. They must not merge until their shared route and storage contracts agree.

`099H` deletion must not start until `099D`, `099E`, `099F`, and `099G` are green in live/dev verification.

Each slice must preserve the parent truths:

- only `accounts/` is runtime-managed account storage
- `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy artifacts synced to R2
- Tokyo-worker is a PBX, not product/account policy
- Venice is a PBX, not product/account policy
- Roma/system account operations own publish, unpublish, delete, downgrade, caps, tiers, and correctness of published state

## TPM Review Enhancements Applied

Independent TPM/staff-engineer review tightened PRD 099 before execution:

- evidence lock and deploy-root work are separate slices
- the public route contract is no longer deferred
- account asset UUID-to-`accountPublicId` migration is a contract-level blast radius
- Tokyo-worker PBX allowed validations are explicitly named
- publication caps, l10n version caps, upload caps, and storage caps are management-plane policy unless explicitly reclassified as technical safety limits
- Prague `accountInstanceRef` must carry `accountPublicId + instanceId`
- admin account recreation is its own data cutover slice
- stale-root deletion requires dry-run output, object-level restore manifest, and rollback rehearsal on local/dev R2
- CI guards must scan active code/current docs with scoped exclusions for historical PRD text

## Immutable Directional Tenets

The Tokyo R2 root is not a URL map and not a generic deployment dump. It is the product storage model: one runtime-managed account root plus git-authored roots deployed to R2.

Every root folder exists because it names a durable ownership, operating, or deploy boundary. No folder may exist at root because it is convenient for a route, a temporary migration, or a previous AI-generated abstraction.

The canonical root is:

```text
tokyo-assets-dev/
  accounts/
  dieter/
  fonts/
  product/
  prague/
```

Product software is in R2 because Tokyo is the asset storage/CDN plane. Git remains the authored source. Cloudflare Pages/static output may be a build/deploy input, but it must not be a second storage authority for the same product assets.

### Runtime-Managed Roots Versus Git-Authored Roots

Only `accounts/` is runtime-managed account storage.

In the repo `tokyo/` source tree, every non-account root is authored in git and deployed/synced to R2 from git:

```text
dieter/
fonts/
product/
prague/
```

Those roots may be served from R2, but they are not account-managed runtime state. Roma, Tokyo-worker, Venice, and account operations must not mutate them as part of user/account lifecycle.

The split is absolute:

- `accounts/` is managed by product/account operations at runtime
- `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy artifacts synced to R2

This keeps software, design infrastructure, global assets, and marketing content separate from customer-owned state.

### `accounts/` Is The SaaS Data Plane

All accounts live under `accounts/`.

Everything owned by an account lives under that account:

```text
accounts/{accountPublicId}/...
```

This includes:

- widget instances
- uploaded assets
- account-specific fonts
- account-scoped generated/render material
- anything else whose lifecycle, storage usage, export, deletion, suspension, audit, or repair belongs to that account

This boundary is core to Clickeen as a SaaS product. At scale, Clickeen may have millions of accounts. Account operations must remain boring:

- create an account
- delete an account
- suspend an account
- export an account
- inspect an account
- repair an account
- calculate account storage usage
- enforce tier limits
- clean up all account-owned data

Those operations only stay reliable if account-owned data is not scattered across root folders such as `public/`, `published/`, `l10n/`, or `widgets/`.

Tier policy also depends on this boundary. A free account may have small storage and feature limits; higher tiers may have more storage and capabilities. The exact free-vs-paid account creation and conversion model is a separate product decision, but the storage invariant is already fixed: account-owned bytes live under the account boundary so usage and policy can be measured and enforced cleanly.

Accounts own instances. Accounts do not own widget software.

`accountPublicId` is the account storage identity:

```text
^[0-9A-Z]{8}$
```

It is an 8-character uppercase base36 ID minted once by account creation/backfill. It is not derived from the private relational UUID. The Clickeen/admin account reserves:

```text
00000001
```

Customer accounts use normal random 8-character uppercase base36 IDs. No account tier, country, status, lifecycle, or billing meaning is encoded in the ID.

### `dieter/` Is Shared Design-System Infrastructure

`dieter/` contains the tokenized design system referenced across Clickeen.

Dieter is not account-owned data. It is not Prague marketing content. It is not the logged-in product app itself. It is shared platform design infrastructure and therefore has its own root.

Expected Dieter categories include built tokens, component assets, icons, and design-system runtime files. Global additional font files do not live here; they live under root `fonts/`. Account-uploaded fonts do not live here; they live under the owning account.

### `fonts/` Is The Global Clickeen Font CDN

`fonts/` contains global additional fonts Clickeen provides to users in addition to Google Fonts.

These fonts are shared CDN resources. They are not account uploads and they are not product app code.

Google Fonts are external provider fonts and are not copied into R2. Global Clickeen-provided fonts live in root `fonts/`. Account-uploaded fonts live under the account. Any font manifest must describe those sources; it must not invent another font storage root.

If a specific account uploads its own custom fonts, those fonts are account-owned assets and must live under that account, for example:

```text
accounts/{accountPublicId}/assets/fonts/
```

Global Clickeen fonts stay in root `fonts/`. Account-specific fonts stay inside `accounts/{accountPublicId}/`.

### `product/` Is The Logged-In Product Plane

`product/` contains everything for the Clickeen product experience: Roma, Bob-facing assets, product UI resources, product runtime software, product manifests, and widget software.

Widgets are software and live here:

```text
product/widgets/
```

An account can have an instance of a widget, but it does not own the widget software. Therefore widgets must not live under account folders.

### `prague/` Is Marketing, Website, And GTM

`prague/` contains everything for marketing, GTM, the website, Prague blocks, Prague assets, and Prague copy/localization if retained.

Prague may reference product concepts and may showcase widgets. Prague does not own account runtime truth and does not own account-widget instances.

### Scaling Rule

The permanent rule is:

```text
storage follows ownership;
routes decide access;
tiers enforce policy;
URLs do not define architecture.
```

This is what prevents R2 from becoming a pile of serving states. Folders like `public/`, `published/`, `l10n/`, and root `widgets/` are not ownership boundaries. They are symptoms of URL shape, publication state, localization implementation, or old deploy habits leaking into product storage.

PRD 099 exists to remove those leaks.

### Management Plane And PBX Plane

Roma and account/system operations are the management plane. They decide and mutate product/account state:

- create accounts
- save instances
- publish instances
- unpublish instances
- delete instances
- enforce tier/cap rules
- downgrade or suspend accounts
- remove published projections when an account no longer qualifies for them

Tokyo-worker is a PBX. It routes, reads, writes, and serves Tokyo objects at the correct paths. It must not become a product-policy engine.

Venice is also a PBX. Venice serves public published projections when they exist and returns a miss, such as 404, when they do not. Venice must not decide whether an account is paid, whether an instance is compliant, whether a tier allows publication, whether something should be unpublished, or whether an account has exceeded caps.

For example: if a user stops paying or is downgraded, Roma/system account operations make affected instances unpublished or remove their published projections. Venice does not inspect billing, tier, compliance, or publication policy. Venice only observes that the projection exists or does not exist.

This prevents duplicate policy engines and split-brain states where Roma believes an instance is unpublished while Venice keeps its own stale eligibility logic alive.

## Product Execution Truth

PRD 099 must be executed from product truth, not from current file topology, active callers, route aliases, or historical R2 objects.

PRD 099 supersedes PRD 098's physical account-widget storage path. PRD 098 remains authoritative for overlay identity and overlay body shape; PRD 099 is authoritative for where those objects live in R2.

The real authoring path is:

```text
account opens one instance of one widget in Roma
Bob edits that one instance
Roma saves that instance to Tokyo/Tokyo-worker
```

Builder is the only real authoring surface. Minibob, demo, funnel, local showcase, and migration/helper surfaces are not accounts, users, editor identities, policy profiles, save-capable product modes, or storage authorities.

Editing always happens on one widget instance in one active locale at a time. Translation is async follow-up work after save. Preview reflects the same instance Bob is editing; preview is not a second widget truth and must not create a second storage path.

This means PRD 099 must name the surviving authority for every concern before implementation:

- widget software authority: `product/widgets/`
- account-owned instance authority: `accounts/{accountPublicId}/instances/{instanceId}/`
- account-owned asset authority: `accounts/{accountPublicId}/assets/`
- account-owned overlay authority: `accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json`
- account-owned published projection authority: `accounts/{accountPublicId}/instances/{instanceId}/published/`
- global Clickeen font authority: `fonts/`
- tokenized design-system authority: `dieter/`
- marketing/site/GTM authority: `prague/`

Anything that exists only to preserve a fake product mode, placeholder, old scaffold, duplicate truth, stale R2 shape, or AI-invented taxonomy is a deletion target by default. Do not clean around it. Delete it, isolate it as one-time migration tooling, or stop and mark the blocker.

Invalid state must fail at the named boundary. PRD 099 must not add fallback readers, silent path healing, compatibility bridges, or route-derived storage paths that make the old model look alive.

## Current Evidence

Live `tokyo-assets-dev` currently has these root prefixes:

```text
accounts/
fonts/
l10n/
public/
published/
widgets/
```

Only `accounts/` and `fonts/` are currently recognizable as root-level concepts we keep, but even their contents need cleanup.

The current root is incomplete evidence, not authority. Execution must re-inventory live R2 before deleting anything and fail if undocumented roots appear.

Current bad root folders:

```text
l10n/
public/
published/
widgets/
```

Current `widgets/` in R2 is not widget software. It contains old sidecars:

```text
widgets/faq/localization.json
widgets/logoshowcase/localization.json
```

The three real WIP widgets currently live in the repo/static Tokyo source:

```text
tokyo/product/widgets/faq/
tokyo/product/widgets/countdown/
tokyo/product/widgets/logoshowcase/
```

They are currently served by Tokyo static deploy routes such as:

```text
https://tokyo.dev.clickeen.com/widgets/faq/spec.json
https://tokyo.dev.clickeen.com/widgets/countdown/spec.json
https://tokyo.dev.clickeen.com/widgets/logoshowcase/spec.json
```

That means the product is already using widget software from the repo/static deploy plane, while live R2 also contains unrelated stale `widgets/` objects. PRD 099 must remove that split-brain.

PRD 099 resolves this by making R2 `product/widgets/` the product widget asset serving authority. Git remains the authored source. Deployment syncs the authored product files into R2; friendly routes serve from R2.

## Target R2 Root

The only allowed root folders are:

```text
tokyo-assets-dev/
  accounts/
  dieter/
  fonts/
  product/
  prague/
```

No other root folder may be created without a later PRD.

## Root Folder Meaning

### `accounts/`

Account-owned runtime data.

Accounts own:

- instances
- uploaded assets
- account-scoped generated/render material

Accounts do not own widgets.

Target:

```text
accounts/
  {accountPublicId}/
    assets/
    instances/
```

`accountPublicId` is the account storage identity. Private UUID account IDs may remain relational/database implementation details, but they must not be R2 product folder names.

Target account instance subtree:

```text
accounts/{accountPublicId}/instances/
  index.json
  {instanceId}/
    instance.json
    config.json
    publish.json
    overlays/
      {overlayId}.json
    selected-overlays/
      {languageCode}/{experiment}/{personalization}.json
    published/
      live/
        r.json
      config.json
      overlays/
        {overlayId}.json
      seo/
        meta/
          live/{locale}.json
          {locale}/{metaFp}.json
```

`index.json` is a generated account read model for product navigation. It is not identity authority and is rebuildable from instance documents.

### `dieter/`

Design system assets.

Dieter is shared infrastructure, not product-app content and not Prague marketing content.

### `fonts/`

Global shared font files.

Fonts remain root-level by product decision.

### `product/`

Logged-in product/Roma-side assets and product runtime software.

Widgets live here:

```text
product/
  widgets/
    faq/
    countdown/
    logoshowcase/
    shared/
    manifest.json
```

`shared/` supports widgets. It is not a fourth widget.

The source repo path may stay `tokyo/product/widgets/`, but the deployed R2 path must also be `product/widgets/`. Public `/widgets/{widgetType}/...` is only a friendly route.

### `prague/`

Marketing/site/GTM content:

- Prague page JSON
- Prague marketing assets
- Prague site copy/localization if kept

Prague must not own account-widget runtime truth.

If Prague localization is retained, its R2 home is:

```text
prague/l10n/
```

Root `l10n/` is deleted.

## Widget Rule

There are currently three real widgets:

```text
faq
countdown
logoshowcase
```

They are software. Their only R2 home is:

```text
product/widgets/{widgetType}/
```

Required deployed widget software includes each widget's runtime/contract files, widget-owned assets, `shared/`, and `manifest.json`. R2 root `widgets/` is never a widget software source.

Wrong:

```text
widgets/{widgetType}/
accounts/{accountPublicId}/widgets/
```

An account instance may reference a widget by `widgetType` and/or `widgetCode`, but that does not make the widget an account-owned folder.

## Instance Rule

Every account has instances, not widgets.

Target:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

An instance is one configured copy of a widget owned by one account.

An instance ID is the current compact uppercase base36 instance identity minted by Tokyo-worker. `wgt_*` and `ins_*` are old folder/name artifacts only; they must not become current storage identity.

The instance document carries which widget software it uses:

```json
{
  "instanceId": "...",
  "widgetType": "faq",
  "widgetCode": "FAQ"
}
```

Admin is not special. Admin-owned instances live exactly like customer-owned instances:

```text
accounts/00000001/instances/{instanceId}/
```

Current live R2 has old admin-ish instance shapes:

```text
accounts/00000000-0000-0000-0000-000000000100/instances/wgt_main_faq/
accounts/00000000-0000-0000-0000-000000000100/instances/wgt_curated_faq_photo_hospitality_westcoast/
accounts/00000000-0000-0000-0000-000000000100/widgets/faq/ins_...
```

Those are not the final model. They may be source material for recreating admin instances, but they are not preserved as product paths.

## Overlay Storage Rule

PRD 098 overlay identity remains intact.

Overlay objects live under the owning account and instance:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
```

The overlay body remains the PRD 098 exact value map. The storage path is only the account ownership prefix plus the overlay identity. No root `overlays/`, root `l10n/`, or account-level collapsed overlay folder may be introduced.

Selected overlay pointers live under the same instance:

```text
accounts/{accountPublicId}/instances/{instanceId}/selected-overlays/{languageCode}/{experiment}/{personalization}.json
```

## Published Projection Rule

Publish is account-owned instance state plus derived public-serving material. It does not create a root registry.

Published projection material lives under:

```text
accounts/{accountPublicId}/instances/{instanceId}/published/
```

The published projection contract exposes only derived public-serving material:

```text
published/live/r.json
published/config.json
published/overlays/{overlayId}.json
published/seo/meta/live/{locale}.json
published/seo/meta/{locale}/{metaFp}.json
```

Venice must not read `instance.json`, authoring `config.json`, private `overlays/{overlayId}.json`, selected-overlay pointers, account policy documents, or any billing/account state. If a public runtime needs a value, Tokyo/Roma must project it into the published projection first.

The public runtime must carry enough routing coordinate to resolve the account-scoped projection without a root `published/` lookup. The required coordinate is:

```text
accountPublicId + instanceId
```

The PRD 099 public route contract is:

```text
Venice public page:
/widget/{accountPublicId}/{instanceId}

Tokyo published projection routes:
/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/config.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/live/{locale}.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/{locale}/{metaFp}.json
```

The old instance-only public route family is not a surviving active product contract:

```text
/widget/{instanceId}
/renders/widgets/{instanceId}/...
```

Route vocabulary may still contain `/widgets/{widgetType}/...` for product widget software assets and Roma UI navigation. It must not be used for account-owned instance render routes.

## Hard Deletes

The following root concepts do not survive:

```text
public/
published/
l10n/
widgets/
```

### `public/`

`public/` is a web-deploy folder concept, not R2 product storage.

Public serving is a route/runtime decision. It must not create a second storage home for instances.

### `published/`

`published/` as a root folder is not product ownership.

Publish is instance state/materialized runtime data for an account-owned instance. It must not become a second global instance registry.

Current `published/widgets/{instanceId}.json` is deleted. It is not replaced by another root lookup folder.

### `l10n/`

Root `l10n/` is old localization storage. PRD 098 deleted old l10n/text-pack/fingerprint/readiness concepts from account-widget truth.

If Prague keeps marketing localization, it belongs under `prague/` and must be clearly separate from account-widget runtime truth.

Current `l10n/prague/**` sync targets must move to `prague/l10n/**` or be deleted if no longer needed.

### `widgets/`

Root `widgets/` is wrong in R2.

Widget software belongs under:

```text
product/widgets/
```

The public URL may still be:

```text
/widgets/{widgetType}/...
```

but the storage home must be:

```text
product/widgets/{widgetType}/...
```

Routes are allowed to be friendly. Storage must be truthful.

## Product Asset Serving Decision

PRD 099 chooses R2-backed product asset serving.

Git remains the authored source for product assets. Deployment syncs product assets into R2 under the target tree. Tokyo/Tokyo-worker may serve friendly public URLs from those R2 objects, but runtime product/account operations manage only `accounts/`.

The non-account roots are deploy-managed, not account-managed:

```text
dieter/
fonts/
product/
prague/
```

They stay in git and autodeploy/sync to R2 from git. R2 is their serving/CDN home, not their authoring or runtime-management authority.

Required mapping:

```text
tokyo/product/widgets/**  -> product/widgets/**
tokyo/product/assets/**   -> product/assets/**
tokyo/product/themes/**   -> product/themes/**
tokyo/product/dieter/**   -> dieter/**
tokyo/product/fonts/**    -> fonts/**
tokyo/roma/**             -> product/roma/**
tokyo/prague/**           -> prague/**
```

Friendly URLs may remain:

```text
/widgets/{widgetType}/...
/dieter/...
/fonts/...
/themes/...
/i18n/...
/prague/...
```

but those URLs must not imply root storage folders other than the canonical five roots.

Cloudflare Pages/static deploy may remain a build/deploy mechanism only if it does not become a second product asset authority. It must not serve stale widget software while R2 serves different widget software.

## Non-Negotiables

- No root folder outside `accounts/`, `dieter/`, `fonts/`, `product/`, and `prague/`.
- Widgets are software and live only under `product/widgets/`.
- Accounts own instances and assets only.
- No `accounts/{accountPublicId}/widgets/` path.
- No root `widgets/`.
- No root `public/`.
- No root `published/`.
- No root `l10n/`.
- No UUID account folder names in R2 product storage.
- No `ins_*` instance IDs as product storage identity.
- No `wgt_*` folder names as product storage identity.
- Public URL shape must not dictate R2 folder shape.
- Only `accounts/` is runtime-managed in R2 by product/account operations.
- `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy artifacts synced to R2, not account-managed runtime state.
- Git/static deploy and R2 must not both pretend to be Tokyo storage truth for the same concern.
- Active callers are not proof that an old path or concept belongs in the product.
- Minibob, demo, funnel, local showcase, and migration/helper surfaces must not define account storage truth.
- Preview, translation, publication, or routing state must not create a second instance truth.
- No fallback readers, silent path healing, or compatibility bridges for the old R2 shapes on active product paths.
- PRD 098 overlay IDs survive; PRD 098 physical account-widget storage path does not.
- Public runtime must not depend on root `published/widgets/{instanceId}.json`.
- Public runtime must not use instance-only `/widget/{instanceId}` or `/renders/widgets/{instanceId}/...` as the surviving contract.
- Prague `accountInstanceRef` must include `accountPublicId + instanceId` unless a later PRD creates an explicit non-root product-owned alias authority.
- Public runtime must not read raw private authoring state; it reads the published projection contract.
- Venice must remain a PBX: it serves existing published projections or returns a miss; it does not evaluate billing, tier, compliance, caps, or publish eligibility.
- Tokyo-worker must remain a PBX: it routes/stores/serves Tokyo objects; it does not become the product-policy authority.
- Account assets must use `accounts/{accountPublicId}/assets/`, not UUID account folders.
- Account asset public/serve URLs must carry `accountPublicId` when they need an account coordinate. Private UUIDs remain relational/Berlin/Michael only.
- Prague localization, if retained, must use `prague/l10n/`, not root `l10n/prague/`.

## Required Architecture Decisions

The product asset serving decision is now made:

```text
R2 is the serving authority for product widget software and the other canonical Tokyo asset roots.
```

The public route decision is also made:

```text
Venice page: /widget/{accountPublicId}/{instanceId}
Tokyo projection: /renders/accounts/{accountPublicId}/instances/{instanceId}/...
```

No PRD 099 slice may proceed by depending on an instance-only public route or on root `published/`.

## Service Impact

### Tokyo source tree

Repo paths can remain:

```text
tokyo/product/widgets/
tokyo/product/dieter/
tokyo/product/fonts/
tokyo/product/themes/
tokyo/prague/
tokyo/roma/
```

But deploy/sync/runtime code must map them to the PRD 099 R2 root deliberately, not by accidental URL aliases.

### Tokyo-worker

Tokyo-worker is a Tokyo PBX, not the product management plane.

Tokyo-worker must:

- stop reading/writing root `published/`
- stop reading/writing account `widgets/`
- stop depending on root `widgets/`
- write account instance state under `accounts/{accountPublicId}/instances/{instanceId}/`
- serve product widgets from R2 `product/widgets/` through friendly routes
- serve Dieter from R2 `dieter/`
- serve global fonts from R2 `fonts/`
- serve retained Prague content from R2 `prague/`
- serve friendly public paths without creating fake root storage folders
- remove root `l10n/` serving once Prague content moves to `prague/`

Tokyo-worker allowed PBX validations:

- authentication and service boundary checks
- `accountPublicId` capsule/path match
- method/path/ID shape validation
- widget/overlay codebook validation
- JSON schema and object-shape validation
- R2 existence/missing-object handling
- bounded technical request limits that are not product tier/cap policy

Tokyo-worker must not decide product policy such as whether an account tier allows publication, whether an instance should remain published, whether upload/storage caps allow another mutation, or whether an account should be downgraded/suspended. Roma/system account operations make those decisions and mutate account state accordingly. Current Tokyo-worker policy checks for publication caps, l10n versions, upload size, or storage caps are PRD 099 execution targets unless a later slice explicitly reclassifies them as technical safety checks rather than product policy.

### Roma

Roma is the product/account management plane.

Roma must treat `/widgets` as the product UI surface for managing account instances. It must not imply account-owned widget folders.

Roma instance APIs should read/write account instances, not account widgets.

Roma must carry `accountPublicId` through account instance and asset calls. Private UUID account IDs may remain Michael/Berlin relational implementation details only.

Roma/system account operations own publish, unpublish, delete, downgrade, suspension, tier/cap enforcement, and correctness of published state. If an account loses publication rights, Roma/system operations remove or disable the published projection; serving layers do not recalculate the policy.

Roma must also own account asset management decisions. R2 asset keys use `accountPublicId`; private UUID account IDs may still be used for Berlin/Michael auth, billing, and relational account APIs.

### Bob

Bob loads widget software from product widget assets and opens/saves account instances.

Bob must not treat the widget URL shape as R2 storage shape.

Bob may continue to request friendly URLs such as `/widgets/{widgetType}/spec.json`; those URLs must resolve to R2 `product/widgets/{widgetType}/spec.json`.

Bob-produced embed/public references must carry `accountPublicId + instanceId` once PRD 099E lands. Bob must not emit instance-only public URLs as the surviving contract.

### Venice

Venice is a public PBX, not a product management plane.

Venice serves the published projection that Tokyo produces from account-owned instance state.

The published projection storage location is account-scoped:

```text
accounts/{accountPublicId}/instances/{instanceId}/published/
```

Venice accesses that projection through Tokyo's published-projection contract. Venice must not read raw private authoring state.

Venice must not read root `published/`, root `public/`, or root `l10n/`.

Venice public runtime must receive or derive `accountPublicId + instanceId` without a root lookup folder.

Venice must not check billing, account tier, publication eligibility, compliance, caps, downgrade state, or user correctness. If the published projection exists and is reachable through the contract, Venice serves it. If it is missing or disabled, Venice returns a miss such as 404. The responsibility for making published projections correct belongs to Roma/system account operations.

### Prague

Prague content lives under `prague/`.

Prague may reference widget software under `product/widgets/`, but it does not own widgets and does not own account-widget runtime overlays.

Prague may embed account-owned example instances only through explicit account-instance references. Example/admin instances are normal instances under account `00000001`.

Prague `accountInstanceRef` must include both `accountPublicId` and `instanceId` after PRD 099. For admin examples, that means `accountPublicId: "00000001"`. Prague must not depend on a hidden instance-only lookup.

Prague sync must publish retained Prague localization/content to `prague/`, not root `l10n/`.

### DevStudio/Admin

DevStudio may inspect and repair data, but it must use the same product model:

- widgets from `product/widgets/`
- account instances from `accounts/{accountPublicId}/instances/`

No separate admin widget lane.

### Scripts and CI

Scripts must stop syncing partial old roots.

Scripts that sync `dieter/`, `fonts/`, `product/`, and `prague/` are deploy tooling from git to R2. Scripts that touch `accounts/` are account/runtime migration or operator tooling. These must remain separate.

Required new/updated scripts:

- R2 inventory audit
- product asset sync to R2 for `product/`, `dieter/`, `fonts/`, and `prague/`
- account instance migration/recreation
- stale root cleanup with dry-run and confirmation output
- guard scan for banned R2 roots and path builders

These scripts are operator tooling. They must stay small and purpose-built. Do not build a generic migration framework, storage router, or long-lived compatibility system.

## Migration Direction

PRD 099 is pre-GA. We prefer hard cuts over compatibility bridges.

Current live R2 should be treated as source material, not something to preserve mechanically.

Required migration/recreation:

1. Create/verify root folders by writing real objects only under:
   - `accounts/`
   - `dieter/`
   - `fonts/`
   - `product/`
   - `prague/`
2. Place or verify real widget software under:
   - `product/widgets/faq/`
   - `product/widgets/countdown/`
   - `product/widgets/logoshowcase/`
3. Recreate admin account instances under:
   - `accounts/00000001/instances/{instanceId}/`
4. Move or recreate account assets under:
   - `accounts/{accountPublicId}/assets/`
5. Move or delete retained Prague localization/content:
   - move kept content to `prague/l10n/`
   - delete obsolete root `l10n/**`
6. Replace public serving lookups:
   - remove root `published/widgets/{instanceId}.json`
   - require `accountPublicId + instanceId` for published projection reads
   - use `/widget/{accountPublicId}/{instanceId}` for Venice public pages
   - use `/renders/accounts/{accountPublicId}/instances/{instanceId}/...` for Tokyo published projection routes
7. Delete stale roots after verification:
   - `public/`
   - `published/`
   - `l10n/`
   - `widgets/`
8. Delete stale account paths:
   - `accounts/{uuid}/widgets/**`
   - `accounts/{uuid}/instances/wgt_*`

No dual reader should ship as a product path. If a temporary operator script needs to read old paths to recreate data, it must live as migration tooling only and be deleted or archived after execution.

Old overlay objects must not be mechanically moved if their `overlayId` encodes a different account or instance segment. They must be regenerated or recreated so parsed `overlayId.accountPublicId` and `overlayId.instanceId` match the target account instance.

Before stale-root deletion, operator tooling must export a manifest of exact old keys, counts, byte totals, and restore source. A rollback rehearsal against local/dev R2 is required before deleting remote stale roots.

## Verification Gates

R2 inventory must show only:

```text
accounts/
dieter/
fonts/
product/
prague/
```

Required live checks:

```text
/widgets/faq/spec.json
/widgets/countdown/spec.json
/widgets/logoshowcase/spec.json
```

must serve the real widget software from R2 `product/widgets/`, not from stale static deploy output or root R2 `widgets/`.

Deploy verification must prove that `dieter/`, `fonts/`, `product/`, and `prague/` are synced from git/deploy output into R2. Runtime verification must prove that account/product operations only mutate `accounts/`.

Roma must:

- list admin instances from `accounts/00000001/instances/`
- open one admin instance in Builder
- save it
- preserve widget identity as instance metadata, not folder ownership

Bob must:

- load widget software from product widgets
- edit one account instance
- save through Roma/Tokyo-worker

Venice must:

- serve a published account instance without root `published/`, root `public/`, or root `l10n/`
- resolve the published projection from `accountPublicId + instanceId`
- use `/widget/{accountPublicId}/{instanceId}` and `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`
- read only the published projection contract, not raw authoring state
- return a miss when a projection is missing/disabled instead of evaluating account policy itself

Prague must:

- load retained Prague content from `prague/`
- not depend on root `l10n/prague/`
- reference admin/example instances as normal account instances under `00000001`
- include `accountPublicId + instanceId` in account instance references

Required scans:

```bash
rg -n "public/instances|published/widgets|/l10n/widgets|l10n/base|accounts/.*/widgets|wgt_|ins_" tokyo-worker roma bob venice prague admin scripts documentation
rg -n "l10n/prague|accounts/[0-9a-f-]{36}|published/widgets|accounts/.*/widgets" tokyo-worker roma bob venice prague admin scripts documentation
rg -n "product/widgets|accounts/.*/instances|accounts/.*/assets|prague/l10n" tokyo-worker roma bob venice prague admin scripts documentation
```

The first scan must have no active product-path matches. Historical PRD text is allowed only if clearly historical.

CI must include a PRD99 architecture guard before execution is complete. It must scan active code path builders and current docs, not only PRD text.

## Stop Conditions

Stop immediately if implementation requires:

- account-owned widget software
- a root `widgets/` R2 folder
- a root `published/` R2 folder
- a root `public/` R2 folder
- preserving `accounts/{uuid}/widgets/**`
- preserving `wgt_*` or `ins_*` as current product identity
- routing public runtime through stale R2 sidecars
- treating Cloudflare URL aliases as storage architecture
- using active callers to justify preserving fake product modes or duplicate truth
- adding fallback readers or silent recovery for old R2 paths
- making preview, translation, publication, demo, or showcase flows into storage authorities
- keeping product widgets served from static deploy while R2 also claims product widget storage authority
- keeping root `published/` because public URLs only carry `instanceId`
- keeping instance-only `/widget/{instanceId}` or `/renders/widgets/{instanceId}/...` as the active public contract
- letting Venice read raw account authoring state instead of published projections
- letting Venice decide billing, tier, compliance, caps, or publish eligibility
- letting Tokyo-worker become the authority for product/account policy
- leaving publication caps, l10n version caps, upload-size caps, or storage caps as Tokyo-worker-owned product policy
- letting account runtime operations mutate git-authored deploy roots outside `accounts/`
- moving old overlay objects whose IDs encode the wrong account/instance into the new account instance
- deleting stale roots before rollback has been rehearsed on local/dev R2
- keeping UUID account folders for account-owned assets
- keeping root `l10n/prague/` for Prague content

## Definition Of Done

- R2 root is exactly `accounts/`, `dieter/`, `fonts/`, `product/`, `prague/`.
- The three WIP widgets are served from R2 `product/widgets/`.
- Root `widgets/` is gone.
- Root `public/` is gone.
- Root `published/` is gone.
- Root `l10n/` is gone, except any explicitly retained Prague marketing-localization content under `prague/`.
- Only `accounts/` is runtime-managed account storage in R2.
- `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy artifacts synced to R2.
- Admin instances live under `accounts/00000001/instances/{instanceId}/`.
- Account assets live under `accounts/{accountPublicId}/assets/`.
- PRD 098 overlay IDs remain valid, and overlay objects live under `accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json`.
- Public runtime reads published projections through `accountPublicId + instanceId`, without root `published/`.
- The surviving public routes are `/widget/{accountPublicId}/{instanceId}` and `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`.
- Tokyo-worker remains a PBX and does not own product/account policy.
- Venice remains a PBX: it reads published projections only, not raw authoring state, and it does not evaluate billing, tier, compliance, caps, or publish eligibility.
- Prague retained localization/content lives under `prague/`, not root `l10n/`.
- The active authoring path is still exactly Roma opens one account instance, Bob edits it, and Roma/Tokyo-worker saves it.
- No demo, funnel, preview, translation, local showcase, or migration/helper surface has become a storage authority.
- Operator migration scripts are deleted or archived after use; no migration framework or dual reader survives.
- PRD99 CI guard scans are active.
- Docs, code, CI, and live R2 agree.
- No service needs to remember old R2 shapes to serve the product.
