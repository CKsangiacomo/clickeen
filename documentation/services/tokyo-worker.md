# System: Tokyo-worker - PBX Routes And Instance Storage

STATUS: REFERENCE - MUST MATCH PRD 100

Tokyo-worker is the Tokyo object PBX for account-owned assets, account widget instances, overlay object storage, generated embed mini-site bytes, and friendly asset serving.

It is not an account authority, product-policy owner, or orchestrator. Roma and system account operations decide account/product policy, publication eligibility, cap enforcement, downgrade consequences, and correctness of published state. Roma carries verified account context to Tokyo-worker through private service bindings. Tokyo-worker validates the named boundary, routes the operation to the exact storage object, and returns the result.

Allowed Tokyo-worker PBX validations are narrow:

- service auth and account authz capsule presence/validity
- account capsule to path coordinate match
- HTTP method, route, and ID shape
- widget codebook and widget type existence
- object schema and generated embed file contract shape
- R2 object existence or absence at the requested canonical key
- bounded technical request limits needed to protect the worker/R2 interface

Tokyo-worker must not own billing, tier, publication, l10n version, upload-size, storage-cap, compliance, or account lifecycle policy. If those checks are product policy, they belong to Roma/system account operations before Tokyo-worker is asked to write or remove bytes. Tokyo-worker may enforce technical request bounds only when they are transport safety limits, not product entitlements.

## Widget Catalog And Contracts

Active widget catalog truth is widget-owned under `tokyo/product/widgets/{widgetType}/` in git and deployed to R2 under `product/widgets/{widgetType}/`:

- `catalog.json` carries catalog label, description, category, display order, and capabilities.
- `spec.json` carries defaults and editor contract truth.
- `seo-geo.ts` exists only for widgets whose `catalog.json` declares `capabilities.seoGeo: true`.

`scripts/build-widget-catalog.mjs` generates `tokyo/product/widgets/manifest.json` and `tokyo-worker/src/generated/widget-seo-geo-registry.ts` from those widget folders. The generated manifest includes the widget code from `@clickeen/ck-contracts`; adding a widget requires one shared widget-codebook entry and must not require editing Tokyo-worker source.

## Responsibilities

1. Account assets: route and mutate account-owned asset objects under `accounts/{accountPublicId}/assets/`.
2. Account instances: route open, save, rename, delete, publish, and unpublish byte operations under `accounts/{accountPublicId}/instances/{instanceId}/`.
3. Account-instance overlays: store/read exact `overlays/{overlayId}.json` objects under the owning instance.
4. Generated embed mini-site bytes: write/read static browser files under the owning instance folder.
5. Friendly asset routes: serve public asset URLs from canonical R2 roots without creating route-shaped storage roots.

## Account Storage

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

- `accounts/{accountPublicId}` is the account ownership and storage boundary. The private account UUID remains only where relational systems require it; it must not be an R2 product folder name.
- Account instances live directly under `instances/{instanceId}/`. There is no account `widgets/` storage lane, no `widgets/{widgetCode}` grouping folder, and no account-level `widget.json` authority.
- Widget software lives only under `product/widgets/{widgetType}/`. `widgetType` and `widgetCode` may appear in `instance.json` and overlay IDs as metadata/codebook identity; they are never R2 locators for account instances.
- `{instanceId}` is a stable generated 10-character uppercase base36 ID. It is not derived from widget type, display name, UUID, timestamp, or any old `ins_*` string.
- `instance.json` is the one top-level source JSON for identity, display metadata, saved authoring config, source version, generation status, and Roma-visible publish status.
- New saves must not create sibling `config.json`, `publish.json`, `embed.json`, or `translations.json`.
- `overlays/{overlayId}.json` stores one exact overlay value object: `{ "v": 1, "values": {} }`. The ID is the only overlay identity. Locale translations are overlays, not a second translations document.
- `index.html`, `styles.css`, and `script.js` are generated static browser files written from `instance.json` plus overlays by the embed agent flow.
- `instances/index.json` is a generated product inventory. It is a read model, not source truth for identity, ownership, saved config, generation status, or public serving.
- `POST /__internal/renders/widgets/index/rebuild.json` rebuilds the generated account inventory from source instance documents. Product reads do not rebuild this index; if it is missing or invalid, Tokyo fails the read and the operator repair boundary must be called explicitly.

## Public Serving

Tokyo-worker does not maintain a runtime widget renderer, a copied public instance tree, or a root published registry. Published mini-sites are resolved by the explicit public coordinate:

```txt
accountPublicId + instanceId
```

The static mini-site lives under:

```txt
accounts/{accountPublicId}/instances/{instanceId}/
```

The canonical public serving URL after PRD 100 is:

```txt
https://clk.live/{accountPublicId}/{instanceId}
```

Serving maps that URL to generated files in the instance folder. It must not read `instance.json`, compute HTML from config, heal, infer, backfill, search account indexes, or fall back to old runtime projections.

Public availability is physical file presence:

- `accounts/{accountPublicId}/instances/{instanceId}/index.html` exists: `https://clk.live/{accountPublicId}/{instanceId}` may serve.
- `index.html` is missing: the public URL returns 404.
- Support files only serve from the same instance folder when their filename is on the generated-browser-file allowlist.
- `instance.json`, `config.json`, `publish.json`, `embed.json`, `translations.json`, `overlays/`, `published/`, source maps, hidden files, directories, and unknown files return 404 even if the object physically exists.

The following are not surviving public product contracts:

- root published widget registries
- public render JSON routes for account or instance runtime projections
- root `published/`
- root `widgets/` as a storage folder

## Private Roma Product-Control Routes

- `GET /__internal/renders/widgets/{instanceId}/saved.json`
- `GET /__internal/renders/widgets/catalog.json`
- `PUT /__internal/renders/widgets/{instanceId}/saved.json`
- `DELETE /__internal/renders/widgets/{instanceId}/saved.json`
- `POST /__internal/renders/widgets/serve-state.json`
- `POST /__internal/renders/widgets/index/rebuild.json`
- `POST /__internal/renders/widgets/index/rebuild.json` is an explicit operator repair route. Product reads and writes must not call it as a fallback.
- `POST /__internal/overlays/languages/write.json`
- `POST /__internal/overlays/languages/selected.json`
- `GET /__internal/overlays/{overlayId}.json`

These routes require Roma internal service auth plus a valid Roma account authz capsule. The account coordinate from the capsule must match the storage path Tokyo-worker reads or writes. Local `TOKYO_DEV_JWT` is only for explicit internal tooling and never a product browser path.

Internal route names may keep `widgets` as route vocabulary during cutover for Bob/Roma compatibility, but storage must remain `accounts/{accountPublicId}/instances/{instanceId}/...`. Route vocabulary is not storage topology.

## Friendly Asset Routes

Friendly public asset routes are URL conveniences. They must always map to canonical PRD 099 R2 roots:

| Friendly route | Canonical R2 root |
| --- | --- |
| `/widgets/{widgetType}/...` | `product/widgets/{widgetType}/...` |
| `/dieter/...` | `dieter/...` |
| `/fonts/...` | `fonts/...` |
| `/themes/...` | canonical Dieter/theme asset root, not root `themes/` |
| Prague-friendly paths | `prague/...` |

Friendly routes must not create root `widgets/`, `themes/`, `public/`, `published/`, or `l10n/` storage folders. Prague page translations live beside their page JSON under `prague/pages/{widget}/{page}.translations/{locale}.json`.

## Queue Jobs

Queue jobs are DB-free and operate from Tokyo account storage:

- write config bytes
- sync published bytes
- delete account instance subtree

Queue jobs must not read Supabase to rediscover state. Tokyo-worker has no language generation queue and no San Francisco binding.

## Delete, Publish, And Unpublish

- Publish/republish restores `index.html.off` to `index.html` when needed, or confirms an existing `index.html`.
- Unpublish renames `index.html` to `index.html.off` and leaves account-owned saved state plus support files intact.
- If neither `index.html` nor `index.html.off` exists, publish fails clearly because the generated embed files are not ready.
- Delete removes the account-owned instance subtree.
- Neither operation writes or deletes root `published/widgets` because that registry does not exist in the PRD 099 product model.
