# System: Tokyo-worker - PBX Routes And Published Projection Bytes

STATUS: REFERENCE - MUST MATCH PRD 099

Tokyo-worker is the Tokyo object PBX for account-owned assets, account widget instances, overlay object storage, published projection bytes, and friendly asset serving.

It is not an account authority, product-policy owner, or orchestrator. Roma and system account operations decide account/product policy, publication eligibility, cap enforcement, downgrade consequences, and correctness of published state. Roma carries verified account context to Tokyo-worker through private service bindings. Tokyo-worker validates the named boundary, routes the operation to the exact storage object, and returns the result.

Allowed Tokyo-worker PBX validations are narrow:

- service auth and account authz capsule presence/validity
- account capsule to path coordinate match
- HTTP method, route, and ID shape
- widget codebook and widget type existence
- object schema and published projection contract shape
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
4. Published projection bytes: write/read derived public-serving bytes under the owning instance's `published/` subtree.
5. Friendly asset routes: serve public asset URLs from canonical R2 roots without creating route-shaped storage roots.

## Account Storage

```txt
accounts/{accountPublicId}/
  assets/{assetId}/
    manifest.json
    blob/{filename}
  instances/
    index.json
    {instanceId}/
      instance.json
      config.json
      publish.json
      overlays/{overlayId}.json
      selected-overlays/{languageCode}/{experiment}/{personalization}.json
      published/
        live/r.json
        config.json
        overlays/{overlayId}.json
        seo/meta/live/{locale}.json
        seo/meta/{locale}/{metaFp}.json
```

Rules:

- `accounts/{accountPublicId}` is the account ownership and storage boundary. The private account UUID remains only where relational systems require it; it must not be an R2 product folder name.
- Account instances live directly under `instances/{instanceId}/`. There is no account `widgets/` storage lane, no `widgets/{widgetCode}` grouping folder, and no account-level `widget.json` authority.
- Widget software lives only under `product/widgets/{widgetType}/`. `widgetType` and `widgetCode` may appear in `instance.json` and overlay IDs as metadata/codebook identity; they are never R2 locators for account instances.
- `{instanceId}` is a stable generated 10-character uppercase base36 ID. It is not derived from widget type, display name, UUID, timestamp, or any old `ins_*` string.
- `instance.json` stores identity and display metadata.
- `config.json` stores the saved authoring config.
- `publish.json` stores Tokyo-owned instance serve-state and published projection metadata. It is not a billing, tier, compliance, cap, or lifecycle policy document.
- `overlays/{overlayId}.json` stores one exact overlay value object: `{ "v": 1, "values": {} }`. The ID is the only overlay identity.
- `selected-overlays/{languageCode}/{experiment}/{personalization}.json` stores `{ "v": 1, "overlayId": "..." }`.
- `publish.json` projects selected overlay IDs under `overlays.languages` at publish/sync time.
- `instances/index.json`, `published/config.json`, `published/live/r.json`, `published/overlays/**`, and `published/seo/meta/**` are generated artifacts. They are read models or serving bytes; they are not source truth for identity, ownership, saved config, or publish state.
- `published/seo/meta/**` is intentionally kept as the generated per-instance SEO serving namespace inside the account instance published projection.
- `POST /__internal/renders/widgets/index/rebuild.json` rebuilds the generated account inventory from source instance documents. Product reads do not rebuild this index; if it is missing or invalid, Tokyo fails the read and the operator repair boundary must be called explicitly.

## Public Serving

Tokyo-worker does not maintain a second copied public instance tree or a root published registry. Published instances are resolved by the explicit public coordinate:

```txt
accountPublicId + instanceId
```

The published projection lives only under:

```txt
accounts/{accountPublicId}/instances/{instanceId}/published/
```

Public read routes:

- `GET /renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json`
- `GET /renders/accounts/{accountPublicId}/instances/{instanceId}/config.json`
- `GET /renders/accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json`
- `GET /renders/accounts/{accountPublicId}/instances/{instanceId}/meta/live/{locale}.json`
- `GET /renders/accounts/{accountPublicId}/instances/{instanceId}/meta/{locale}/{metaFp}.json`

These routes map directly to the corresponding object under the account instance `published/` subtree. Requests missing either `accountPublicId` or `instanceId` fail at the route boundary. If required published bytes are missing, the route returns unavailable. It does not heal, infer, backfill, search account indexes, read authoring bytes, or fall back to root `published/widgets`.

The following are not surviving public product contracts:

- `published/widgets/{instanceId}.json`
- `GET /renders/widgets/{instanceId}/...`
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

Friendly routes must not create root `widgets/`, `themes/`, `public/`, `published/`, or `l10n/` storage folders. If retained Prague localization is served through a friendly route, the canonical storage home is `prague/l10n/...`, never root `l10n/...`.

## Queue Jobs

Queue jobs are DB-free and operate from Tokyo account storage:

- write config bytes
- sync published bytes
- delete account instance subtree

Queue jobs must not read Supabase to rediscover state. Tokyo-worker has no language generation queue and no San Francisco binding.

## Delete And Unpublish

- Unpublish removes the account instance `published/` projection bytes and leaves account-owned saved state intact.
- Delete removes the account-owned instance subtree, including any generated `published/` projection bytes.
- Neither operation writes or deletes root `published/widgets` because that registry does not exist in the PRD 099 product model.
