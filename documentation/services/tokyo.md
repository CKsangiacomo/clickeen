# System: Tokyo - Product Assets And Account Storage

STATUS: REFERENCE - MUST MATCH PRD 099 DEPLOY ROOTS AND PRD 098 OVERLAY IDENTITY

PRD 103_02 NOTE: this document still describes the current physical storage tree. It is not current product-boundary authority for account instances, translated locale values, publish state, or public artifact readiness until PRD 103_02 closes. Treat `instance.json`, `instances/index.json`, `overlays/{overlayId}.json`, `index.html`, `styles.css`, and `script.js` below as audit evidence and implementation candidates, not approved Roma/Bob/San Francisco contracts.

Tokyo is the storage and static-serving plane. It is not an editor, account authority, or Prague-specific runtime.

## Product Model

Tokyo has three boring jobs:

- Serve git-authored product software/static resources from canonical R2 roots: `dieter/`, `fonts/`, `product/`, and `prague/`.
- Store account-owned data through Tokyo-worker: assets and widget instances.
- Serve published widget bytes to Venice through public read paths.

The ownership boundary is always the account. Admin is just the Clickeen account with broader permissions; admin-owned instances are stored exactly like customer-owned instances.

## R2 Root Contract

Tokyo R2 has one runtime-managed account root plus git-authored deploy roots:

```txt
accounts/   runtime-managed account storage
dieter/     git-authored shared design-system media
fonts/      git-authored global Clickeen font media
product/    git-authored product software and product media
prague/     git-authored marketing/site/GTM content
```

Only `accounts/` is runtime-managed by product/account operations. Roma, Tokyo-worker, Venice, and account lifecycle flows must not mutate `dieter/`, `fonts/`, `product/`, or `prague/` as customer state.

Git-authored deploy mapping:

```txt
tokyo/product/widgets/**  -> product/widgets/**
tokyo/product/media/**   -> product/media/**
tokyo/product/themes/**   -> product/themes/**
tokyo/product/dieter/**   -> dieter/**
tokyo/product/fonts/**    -> fonts/**
tokyo/roma/**             -> product/roma/**
tokyo/prague/**           -> prague/**
```

`product/widgets/` is widget software. Accounts own widget instances under `accounts/{accountPublicId}/instances/**`; accounts do not own or mutate widget software.

Tokyo Pages/static output and friendly static routes are source/deploy and serving convenience only. They must not become a second authority for widget software, Dieter media, fonts, product media, or Prague content. For example, `/widgets/{widgetType}/spec.json` is a friendly serving path for the canonical R2 object `product/widgets/{widgetType}/spec.json`, not a root `widgets/` storage truth.

Deploy tooling must not publish git-authored media to root `widgets/`, root `l10n/`, root `public/`, or root `published/`. Published projection keys are account-owned runtime/public serving state under the owning instance, not a deploy-root pattern.

## Runtime Account Shape

Real account data lives in R2:

```txt
accounts/{accountPublicId}/
  assets/
    {assetRef}
  instances/
    index.json
    {instanceId}/
      instance.json
      index.html
      styles.css
      script.js
      overlays/{overlayId}.json
```

Rules:

- `accountPublicId` is the compact public account storage ID from account truth.
- `instanceId` is the stable compact generated instance identity. Public embeds also carry `accountPublicId`.
- Instance names are labels only and must never be used as storage keys.
- Widget codes (`FAQ`, `CTD`, `LGS`, etc.) are codebook metadata used by overlay identity and contracts. They are not storage folders and are never required to locate an instance.
- Instance locale values are overlay objects under `overlays/{overlayId}.json`.
- `instances/index.json` is a generated account read model. Generated public browser files such as `index.html`, locale HTML files, CSS, and JS are rebuilt by the coding-agent flow and must not be treated as identity, ownership, saved config, or publish truth.
- Prague page translations are not account-instance overlays.

## Public Static Serving

Public serving uses direct account-scoped static URLs:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

That route maps to `accounts/{accountPublicId}/instances/{instanceId}/index.html`. Support files are served only when they are generated browser files on the public allowlist.

## Forbidden Concepts

- No account-instance tree outside `accounts/{accountPublicId}/instances/{instanceId}`.
- No public instance mirror tree.
- No separate admin-owned catalog lane, sample lane, or example storage lane.
- No hidden `listed` / `duplicable` / distribution flags inside customer instance data.
- No Prague-specific widget storage.
- No root `widgets/` tree for widget software; widget software is served from `product/widgets/`.
- No root `l10n/` tree for Prague localization; Prague page translations stay beside page JSON under `prague/pages/{widget}/{page}.translations/{locale}.json`.

Platform-owned references, when needed, live outside instance data. Example: Prague page JSON may point at a normal account-owned instance through `accountInstanceRef.accountPublicId` and `accountInstanceRef.instanceId`.

## Interfaces

Public static/read paths:

- `/widgets/**` -> canonical R2 `product/widgets/**`
- `/dieter/**`
- `/themes/**`
- `/fonts/**`
- `/i18n/**`
- `https://clk.live/{accountPublicId}/{instanceId}`
- `/assets/account/**`

Private account-control paths are owned by Tokyo-worker and reached from Roma through Cloudflare service bindings.
