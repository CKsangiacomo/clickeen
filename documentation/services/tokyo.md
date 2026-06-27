# Tokyo - R2 Storage And Static Deploy Contract

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo is the storage and static-serving plane. Tokyo is not an editor, account authority, page builder, translation authority, or AI runtime.

Tokyo has two forms:

- `tokyo/` repo folders: git-authored source/deploy artifacts.
- `tokyo-worker/`: Cloudflare Worker that reads, writes, and serves Tokyo R2.

## R2 Root Contract

Tokyo R2 has one runtime-managed account root plus git-authored deploy roots:

```text
accounts/   runtime-managed account storage
dieter/     git-authored shared design-system media
fonts/      git-authored global Clickeen font media
product/    git-authored product software and media
prague/     git-authored marketing/site/GTM content
```

Only `accounts/` is runtime-managed by product/account operations.

Git-authored deploy mapping:

```text
tokyo/product/widgets/**  -> product/widgets/**
tokyo/product/dieter/**   -> dieter/**
tokyo/product/fonts/**    -> fonts/**
tokyo/roma/**             -> product/roma/**
tokyo/prague/**           -> prague/**
```

`tokyo/product/themes/**` exists in the repo and is watched by the worker deploy
workflow, but the current R2 deploy sync script does not map it to an R2 root.
Do not claim theme artifacts are deployed until `scripts/tokyo-r2-deploy-sync.mjs`
maps that source.

Operator script:

```text
scripts/tokyo-r2-deploy-sync.mjs
```

## Account Runtime Shape

Account-owned payloads live under:

```text
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
      locales/
        {locale}/
          index.html
          styles.css
          runtime.js
      serve-state.json
      index.html
      styles.css
      runtime.js
  pages/
    {pageId}/
      source.json
      serve-state.json
      index.html
      styles.css
      runtime.js
```

Rules:

- `accountPublicId` is the compact public account storage coordinate.
- `instanceId` is the stable compact widget instance coordinate.
- Instance labels are not storage keys.
- Widget codes are metadata, not storage folders.
- Overlay files are durable translated values for an active account locale.
- Browser package files are public artifacts saved by Roma through Tokyo-worker.
- Locale package files are generated public artifacts derived from saved source
  plus one exact locale overlay.
- Tokyo-worker stores exact submitted bytes. It does not compile, translate, or infer product meaning.

## Public Serving

Production:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Cloud-dev:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Public serving reads `index.html`, `styles.css`, and `runtime.js` from the account instance folder only after `serve-state.json` says the instance is published and package fingerprint checks pass.
The public instance URL is slashless. Generated entry HTML references support
files by exact root-relative package paths so the browser does not depend on
trailing-slash URL interpretation:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

Explicit locale serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}
```

Locale serving reads stored bytes from
`accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/` only when
the instance is published and `index.html`, `styles.css`, and `runtime.js` all
carry matching locale package metadata. Public serving does not read overlay
files, call a materializer, ask Roma, or fall back to base content for a locale
URL.
Generated locale entry HTML references locale support files by exact
root-relative package paths:

```text
/{accountPublicId}/{instanceId}/locales/{locale}/styles.css
/{accountPublicId}/{instanceId}/locales/{locale}/runtime.js
```

Current account page public serving returns `404` until Roma writes real page packages.

## Static Read Paths

Friendly public paths map to canonical roots:

| Friendly path | Canonical R2 root |
| --- | --- |
| `/widgets/**` | `product/widgets/**` |
| `/dieter/**` | `dieter/**` |
| `/fonts/**` | `fonts/**` |
| `/i18n/**` | `product/roma/i18n/public/**` |
| `/assets/account/**` | account asset reads allowed by Tokyo-worker |
| `/prague/l10n/**` | Prague l10n static path |
| `/prague/assets/**` | Prague static assets |

Friendly paths are serving paths, not storage roots.

Account instance package files are stored bytes, not live views over
`product/widgets/**`. `/dieter/**`, `/fonts/**`, and account asset paths are
external delivery references served from their owning roots. Tokyo public
serving does not recompute widget source, Dieter state, font state, or asset
freshness on visitor requests.

## Forbidden Storage Roots

Do not create or deploy:

```text
widgets/
l10n/
public/
published/
```

Do not create account-instance trees outside:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

## Operator Commands

Dry-run deploy sync:

```bash
pnpm tokyo:r2:sync:check
```

Remote deploy sync:

```bash
pnpm cf:preflight
pnpm tokyo:r2:sync:remote
```

Remote R2 reads/writes must use the repo commands documented in:

```text
documentation/engineering/CloudflareOperations.md
```

## Hard Stops

Stop if a change would:

- write product deploy artifacts into `accounts/`
- write account runtime artifacts into `dieter/`, `fonts/`, `product/`, or `prague/`
- publish root `widgets/`, `l10n/`, `public/`, or `published/`
- use UUID account folders
- treat Prague page translations as account instance overlays
- treat Tokyo static paths as account or policy authority
