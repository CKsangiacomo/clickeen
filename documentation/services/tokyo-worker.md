# System: Tokyo-worker - Account Widget Storage And Published Bytes

STATUS: REFERENCE - MUST MATCH PRD 098

Tokyo-worker owns account-owned assets, account widget instances, overlay object storage, publish/unpublish materialization, and public read assembly for Venice.

It is not an account authority and it is not an orchestrator. Roma carries verified account context to Tokyo-worker through private service bindings. Tokyo-worker behaves like a PBX: validate the call, route the operation to the exact storage object, return the result.

## Widget Catalog And Contracts

Active widget catalog truth is widget-owned under `tokyo/product/widgets/{widgetType}/`:

- `catalog.json` carries catalog label, description, category, display order, and capabilities.
- `spec.json` carries defaults and editor contract truth.
- `seo-geo.ts` exists only for widgets whose `catalog.json` declares `capabilities.seoGeo: true`.

`scripts/build-widget-catalog.mjs` generates `tokyo/product/widgets/manifest.json` and `tokyo-worker/src/generated/widget-seo-geo-registry.ts` from those widget folders. The generated manifest includes the widget code from `@clickeen/ck-contracts`; adding a widget requires one shared widget-codebook entry and must not require editing Tokyo-worker source.

## Responsibilities

1. Account assets: upload, list, usage, resolve, delete.
2. Account widget instances: open, save, rename, delete, publish, unpublish.
3. Account-instance overlays: store/read exact `overlays/{overlayId}.json` objects as PRD 098 lands.
4. Published lookup: maintain `published/widgets/{instanceId}.json`.
5. Public reads: serve `/renders/widgets/**`, `/assets/**`, and `/fonts/**`.

## Account Storage

```txt
accounts/{accountPublicId}/
  assets/{assetId}/
    manifest.json
    blob/{filename}
  widgets/
    index.json
    {widgetCode}/
      widget.json
      {instanceId}/
        instance.json
        config.json
        publish.json
        overlays/{overlayId}.json
        selected-overlays/{language}/{experiment}/{personalization}.json
        published/config.json
        seo/meta/live/{locale}.json
        seo/meta/{locale}/{metaFp}.json
```

Rules:

- `accounts/{accountPublicId}` is the ownership boundary for PRD 098 product/storage identity. The private account UUID remains only where older account APIs require relational joins.
- `widgets/{widgetCode}` groups every instance of that widget for that account; widget codes come from `@clickeen/ck-contracts`.
- `widget.json` carries account-level widget state, including active/locked status for plan downgrade handling.
- `{instanceId}` is a stable generated 10-character uppercase base36 ID. It is not derived from widget type, display name, UUID, timestamp, or any old `ins_*` string.
- `instance.json` stores identity and display metadata.
- `config.json` stores the saved authoring config.
- `publish.json` stores the account instance serve-state and published fingerprint/policy.
- `overlays/{overlayId}.json` stores one exact overlay value object: `{ "v": 1, "values": {} }`. The ID is the only overlay identity.
- `selected-overlays/{language}/{experiment}/{personalization}.json` stores `{ "v": 1, "overlayId": "..." }`.
- `publish.json` projects selected overlay IDs under `overlays.languages` at publish/sync time.
- `widgets/index.json`, `published/config.json`, and `seo/meta/**` are generated artifacts. They are read models or serving bytes; they are not source truth for identity, ownership, saved config, or publish state.
- `seo/meta/**` is intentionally kept as the generated per-instance SEO serving namespace.
- `POST /__internal/renders/widgets/index/rebuild.json` rebuilds the generated account inventory from source instance documents. Product reads do not rebuild this index; if it is missing or invalid, Tokyo fails the read and the operator repair boundary must be called explicitly.

## Public Serving

Tokyo-worker does not maintain a second copied public instance tree.

Published instances are discoverable through:

```txt
published/widgets/{instanceId}.json
```

That lookup contains:

```json
{
  "v": 1,
  "id": "A1B2C3D4E5",
  "accountPublicId": "A1B2C3D4",
  "widgetCode": "FAQ",
  "status": "published",
  "updatedAt": "2026-05-10T00:00:00.000Z"
}
```

Public reads use the lookup, then read the published account bytes.

Public read routes:

- `GET /renders/widgets/{instanceId}/live/r.json`
- `GET /renders/widgets/{instanceId}/config.json`
- `GET /renders/widgets/{instanceId}/overlays/{overlayId}.json`
- `GET /renders/widgets/{instanceId}/meta/live/{locale}.json`
- `GET /renders/widgets/{instanceId}/meta/{locale}/{metaFp}.json`

If the lookup or required published bytes are missing, the route returns unavailable. It does not heal, infer, or fall back.

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

These routes require Roma internal service auth plus a valid Roma account authz capsule. Local `TOKYO_DEV_JWT` is only for explicit internal tooling and never a product browser path.

## Queue Jobs

Queue jobs are DB-free and operate from Tokyo account storage:

- write config bytes
- sync published bytes
- delete account instance subtree

Queue jobs must not read Supabase to rediscover state. Tokyo-worker has no language generation queue and no San Francisco binding.

## Delete And Unpublish

- Unpublish removes published lookup/servable bytes and leaves account-owned saved state intact.
- Delete removes the account-owned instance subtree and the published lookup/servable bytes.
