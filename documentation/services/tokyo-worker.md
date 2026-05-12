# System: Tokyo-worker - Account Widget Storage And Published Bytes

STATUS: REFERENCE - MUST MATCH PRD 88 RUNTIME

Tokyo-worker owns account-owned assets, account widget instances, l10n overlay artifacts, publish/unpublish materialization, and public read assembly for Venice.

It is not an account authority. Roma carries verified account context to Tokyo-worker through private service bindings.

## Responsibilities

1. Account assets: upload, list, usage, resolve, delete.
2. Account widget instances: open, save, rename, delete, publish, unpublish.
3. Account-instance l10n: store/read `overlays/l10n/{locale}/overlay.json`.
4. Published lookup: maintain `published/widgets/{instanceId}.json`.
5. Public reads: serve `/renders/widgets/**`, `/l10n/widgets/**`, `/assets/**`, and `/fonts/**`.

## Account Storage

```txt
accounts/{accountId}/
  assets/{assetId}/
    manifest.json
    blob/{filename}
  widgets/
    index.json
    {widgetType}/
      widget.json
      {instanceId}/
        instance.json
        config.json
        publish.json
        overlays/l10n/{locale}/overlay.json
        published/config.json
        l10n/base/{fingerprint}.snapshot.json
        seo/meta/live/{locale}.json
        seo/meta/{locale}/{metaFp}.json
```

Rules:

- `accounts/{accountId}` is the ownership boundary.
- `widgets/{widgetType}` groups every instance of that widget type for that account.
- `widget.json` carries account-level widget state, including active/locked status for plan downgrade handling.
- `{instanceId}` is stable and generated. It is not derived from widget type or display name.
- `instance.json` stores identity and display metadata.
- `config.json` stores the saved authoring config.
- `publish.json` stores the account instance serve-state and published fingerprint/policy.
- `overlays/l10n/{locale}/overlay.json` stores the current l10n overlay for that locale.
- `widgets/index.json`, `published/config.json`, `l10n/base/{fingerprint}.snapshot.json`, and `seo/meta/**` are generated artifacts. They are read models or serving bytes; they are not source truth for identity, ownership, saved config, or publish state.
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
  "id": "ins_...",
  "accountId": "00000000-0000-0000-0000-000000000100",
  "widgetType": "faq",
  "status": "published",
  "updatedAt": "2026-05-10T00:00:00.000Z"
}
```

Public reads use the lookup, then read the published account bytes.

Public read routes:

- `GET /renders/widgets/{instanceId}/live/r.json`
- `GET /renders/widgets/{instanceId}/config.json`
- `GET /renders/widgets/{instanceId}/meta/live/{locale}.json`
- `GET /renders/widgets/{instanceId}/meta/{locale}/{metaFp}.json`
- `GET /l10n/widgets/{instanceId}/index.json`
- `GET /l10n/widgets/{instanceId}/{locale}/overlay.json`

If the lookup or required published bytes are missing, the route returns unavailable. It does not heal, infer, or fall back.

## Private Roma Product-Control Routes

- `GET /__internal/renders/widgets/{instanceId}/saved.json`
- `PUT /__internal/renders/widgets/{instanceId}/saved.json`
- `PATCH /__internal/renders/widgets/{instanceId}/saved.json`
- `DELETE /__internal/renders/widgets/{instanceId}/saved.json`
- `POST /__internal/renders/widgets/{instanceId}/sync`
- `POST /__internal/renders/widgets/serve-state.json`
- `POST /__internal/renders/widgets/index/rebuild.json`
- `GET /__internal/account/widgets/{instanceId}/translations`

These routes require Roma internal service auth plus a valid Roma account authz capsule. Local `TOKYO_DEV_JWT` is only for explicit internal tooling and never a product browser path.

## Queue Jobs

Queue jobs are DB-free and operate from Tokyo account storage:

- write config bytes
- write l10n overlay/text bytes
- sync published bytes
- delete account instance subtree

Queue jobs must not read Supabase to rediscover state.

## Delete And Unpublish

- Unpublish removes published lookup/servable bytes and leaves account-owned saved state intact.
- Delete removes the account-owned instance subtree and the published lookup/servable bytes.
