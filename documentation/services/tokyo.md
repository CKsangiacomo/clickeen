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
