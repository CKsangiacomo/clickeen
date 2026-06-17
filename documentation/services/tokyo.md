# System: Tokyo - Product Assets And Account Storage

STATUS: REFERENCE - MUST MATCH PRD 099 DEPLOY ROOTS, PRD 103 PRODUCT-OPERATION VOCABULARY, AND PRD 105 INSTANCE FOLDER TENETS

PRD 103 DB PIVOT NOTE: account instance product boundaries are now operation-shaped. `instance.json` and `instances/index.json` are not active product runtime contracts. Public generated artifacts are R2/CDN serving output, not authoring or publish state.

PRD 105 NOTE: active account instance runtime shape is `instance.config.json`, `instance.content.json`, `overlays/locales/{locale}.json`, `index.html`, `styles.css`, and `runtime.js`. Per-locale HTML/JS files and versioned script/style artifacts are not current default architecture.

Tokyo is the storage and static-serving plane. It is not an editor, account authority, or Prague-specific runtime.

## Product Model

Tokyo has three boring jobs:

- Serve git-authored product software/static resources from canonical R2 roots: `dieter/`, `fonts/`, `product/`, and `prague/`.
- Store account-owned data through Tokyo-worker: assets and widget instances.
- Serve stored public widget and page package artifacts through `clk.live` public read paths.

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

Only `accounts/` is runtime-managed by product/account operations. Roma, Tokyo-worker, public serving, and account lifecycle flows must not mutate `dieter/`, `fonts/`, `product/`, or `prague/` as customer state.

Git-authored deploy mapping:

```txt
tokyo/product/widgets/**  -> product/widgets/**
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

Account-owned payloads and public artifacts live under the account root:

```txt
accounts/{accountPublicId}/
  assets/
    {assetRef}
  instances/
    {instanceId}/
      instance.config.json
      instance.content.json
      overlays/
        locales/
          {locale}.json
      index.html
      styles.css
      runtime.js
```

Rules:

- `accountPublicId` is the compact public account storage ID from account truth.
- `instanceId` is the stable compact generated instance identity. Public embeds also carry `accountPublicId`.
- Instance names are labels only and must never be used as storage keys.
- Widget codes (`FAQ`, `CTD`, `LGS`, etc.) are codebook metadata used by overlay identity and contracts. They are not storage folders and are never required to locate an instance.
- Instance locale values are addressed by Tokyo operations using `{instanceId, locale}` and persist under `overlays/locales/{locale}.json`. Overlay paths are not product identity.
- Instance listing comes from Tokyo operations backed by the `instances` DB row, not `instances/index.json`.
- Browser package files `index.html`, `styles.css`, and `runtime.js` are public artifacts, not identity, ownership, saved config, or product publish truth. Roma materializes them during create/save/duplicate and submits them to Tokyo-worker with the saved source. Tokyo-worker stores the exact submitted bytes.
- Those files can exist for composition before public standalone serving. `clk.live` serving still requires Tokyo serve state to be `published` and account serving policy to allow the instance.
- `accounts/{accountPublicId}/website/serving-policy.json` is the named account-level standalone serving gate for lower-tier caps. It disables public delivery without deleting generated package files.
- Page package files, when present, live beside page source under `accounts/{accountPublicId}/pages/{pageId}/`.
- Page source is stored at `accounts/{accountPublicId}/pages/{pageId}/source.json`; Tokyo validates the page source contract before storage and derives account page list summaries from stored source files.
- Page serve state is stored as opaque bytes at `accounts/{accountPublicId}/pages/{pageId}/serve-state.json`.
- Prague page translations are not account-instance overlays.

## Public Static Serving

Public serving uses direct account-scoped static URLs:

```txt
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/pages/{pageId}
```

`clk.live` is the production public-serving host. Cloud-dev uses the same path shape on:

```txt
https://dev.clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

Cloud-dev must not bind the dev Tokyo-worker to `clk.live`.

Those routes map to generated `index.html`, `styles.css`, and `runtime.js` packages only after Tokyo serve state allows public delivery. Support files are served only when they are generated browser files on the public allowlist.

## Forbidden Concepts

- No account-instance tree outside `accounts/{accountPublicId}/instances/{instanceId}`.
- No public instance mirror tree.
- No separate admin-owned catalog lane, sample lane, or example storage lane.
- No hidden `listed` / `duplicable` / distribution flags inside customer instance data.
- No Prague-specific widget storage.
- No root `widgets/` tree for widget software; widget software is served from `product/widgets/`.
- No root `l10n/` tree for Prague localization; Prague page translations stay beside page JSON under `prague/pages/{widget}/{page}.translations/{locale}.json`.

Clickeen-owned references, when needed, live outside instance data. Example: Prague page JSON may point at a normal account-owned instance through `accountInstanceRef.accountPublicId` and `accountInstanceRef.instanceId`.

## Interfaces

Public static/read paths:

- `/widgets/**` -> canonical R2 `product/widgets/**`
- `/dieter/**`
- `/themes/**`
- `/fonts/**`
- `/i18n/**`
- `https://dev.clk.live/{accountPublicId}/{instanceId}` in cloud-dev
- `https://clk.live/{accountPublicId}/{instanceId}` in production
- `/assets/account/**`

Private account-control paths are owned by Tokyo-worker and reached from Roma through Cloudflare service bindings.
