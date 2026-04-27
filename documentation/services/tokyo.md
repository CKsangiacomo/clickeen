# System: Tokyo - Product Static Resources, Account Storage, And Public Projections

STATUS: PRD 79 TARGET MODEL
Runtime code is being migrated to this model by PRD 79. Current residue is listed in `Execution_Pipeline_Docs/02-Executing/079A__Audit__Tokyo_Account_First_Taxonomy_Deletion_Map.md`.

## Identity

- Tier: Supporting
- Purpose: product static resource hosting, account-owned asset/instance storage through Tokyo-worker, and public CDN projections
- Runtime: Cloudflare R2 plus Tokyo Worker

## Product Model

Tokyo must keep three planes separate:

- **Product source/static plane**: widget software, Dieter output, fonts, themes, Roma UI catalogs, Prague page/assets source.
- **Account truth plane**: account-owned assets, saved instance documents, instance l10n, render state, usage/index data.
- **Public projection plane**: cacheable public reads for embeds, assets, and localization. Public projections are generated from account truth and never own account state.

The ownership boundary is always the account. A widget is software. An instance is the saved account-owned widget data.

Forbidden architecture/storage concepts:

- separate admin storage lanes
- separate starter/preset storage classes
- repo-owned instance l10n
- owner-specific translation flow

Admin starter content is normal account-owned instance data under the admin account with listed/duplicable metadata.

## Repo Taxonomy

The Git repo `tokyo/` contains product source and authored static resources only:

```txt
tokyo/
  product/
    widgets/
    dieter/
    fonts/
    themes/
  roma/
    i18n/
  prague/
    pages/
    i18n/
    l10n/
    assets/
  accounts/
    README.md
```

Rules:

- Widget source belongs under `tokyo/product/widgets/{widgetType}/`.
- Widget folders contain widget software and contracts only. Prague page source belongs under `tokyo/prague/pages/{widgetType}/`.
- Roma product/account UI catalogs belong under `tokyo/roma/i18n/**`.
- Prague website copy, l10n source, and website assets belong under `tokyo/prague/**`.
- `accounts/` in Git is documentation/fixture-only. Real account data lives in Tokyo-worker storage.
- Public HTTP routes like `/widgets/**`, `/dieter/**`, `/fonts/**`, `/themes/**`, and `/i18n/**` may remain stable serving URLs, but they must not imply old repo source paths.

## Account-First Storage

Runtime/account data must be keyed by account first:

```txt
accounts/
  <accountId>/
    assets/
    instances/
      <publicId>/
        saved/
        l10n/
        render/
    indexes/
```

Rules:

- `publicId` alone is not an ownership boundary.
- Saved config, l10n, render state, translation status, and overlay ops belong under the owning account's instance.
- Assets belong under the owning account.
- Account export/delete/usage can be answered from `accounts/<accountId>`.
- Product reads must not fall back to old root-level instance keys after the migration gate.

## Public Projections

Public embeds need fast paths, but those paths are projections:

```txt
public/
  assets/
    v/
  instances/
    <publicId>/
      live.json
      config/
      l10n/
      meta/
```

Rules:

- Venice and public embeds read projections only.
- Publishing writes account truth first, then projection.
- Unpublishing/deleting removes or invalidates projections.
- Projection helper names must say `publicProjection` so source truth and serving output are not confused.

## Interfaces

Tokyo serves:

- Widget software and contracts for Bob/Roma/Venice/Prague.
- Dieter bundles and manifest.
- Roma UI localization catalogs.
- Prague website/static resources.
- Immutable public asset reads.
- Public embed render/config/l10n projections.

Tokyo-worker owns private account-control routes through Cloudflare service bindings:

- account asset upload/list/resolve/delete
- saved instance open/save/delete
- render config/live/meta writes
- l10n base/overlay/pack/live writes
- account usage/integrity/index reads

Browser product traffic must go through Roma same-origin routes. Public Tokyo HTTP is not the account save/control boundary.

## Canonical URLs

- **Local**: `http://localhost:4000` (local Tokyo dev server + local Tokyo-worker path)
- **Cloud-dev**: `https://tokyo.dev.clickeen.com`
- **UAT / Limited GA / GA**: `https://tokyo.clickeen.com`

## Security Rules

- Private account-control routes require Roma's service binding plus Roma-minted account authz capsule.
- Public projection routes are read-only.
- `TOKYO_DEV_JWT` is local/internal only and must never be used from a browser.
- Tokyo-worker must not rediscover account truth from end-user JWTs on product control paths; Roma carries the verified account context.

## Links

- Back: `../architecture/CONTEXT.md`
- Tokyo Worker: `documentation/services/tokyo-worker.md`
- Localization contract: `documentation/capabilities/localization.md`
- PRD 79: `Execution_Pipeline_Docs/02-Executing/079__PRD__Tokyo_Account_First_Storage_And_Surface_Taxonomy.md`
