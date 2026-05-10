# System: Tokyo - Product Assets And Account Storage

STATUS: REFERENCE - MUST MATCH PRD 88 RUNTIME

Tokyo is the storage and static-serving plane. It is not an editor, account authority, or Prague-specific runtime.

## Product Model

Tokyo has three boring jobs:

- Serve product software/static resources: widgets, Dieter assets, fonts, themes, Roma i18n, and Prague website content.
- Store account-owned data through Tokyo-worker: assets and widget instances.
- Serve published widget bytes to Venice through public read paths.

The ownership boundary is always the account. Admin is just the Clickeen account with broader permissions; admin-owned instances are stored exactly like customer-owned instances.

## Runtime Account Shape

Real account data lives in R2:

```txt
accounts/{accountId}/
  assets/{assetId}/
    manifest.json
    blob/{filename}
  widgets/{widgetType}/
    widget.json
    index.json
    {instanceId}/
      instance.json
      config.json
      published/config.json
      overlays/l10n/{locale}/overlay.json
      publish.json
```

Rules:

- `instanceId` is the stable generated instance identity. It is also the public embed ID.
- Instance names are labels only and must never be used as storage keys.
- Widget type folders (`faq`, `countdown`, `logoshowcase`, etc.) own widget-level account state, including downgrade lock state.
- Instance l10n is an account-instance overlay under `overlays/l10n`.
- Prague page translations are not account-instance overlays.

## Published Lookup

Public serving uses a tiny lookup, not a copied public instance tree:

```txt
published/widgets/{instanceId}.json
```

That lookup points Venice/Tokyo-worker to the owning account, widget type, and published account bytes.

## Forbidden Concepts

- No `accounts/{accountId}/instances`.
- No `public/instances`.
- No separate admin, curated, template, or example storage lane.
- No hidden `listed` / `duplicable` / distribution flags inside customer instance data.
- No Prague-specific widget storage.

Platform-owned references, when needed, live outside instance data. Example: Prague page JSON may point at a normal account-owned instance through `accountInstanceRef.instanceId`.

## Interfaces

Public static/read paths:

- `/widgets/**`
- `/dieter/**`
- `/themes/**`
- `/fonts/**`
- `/i18n/**`
- `/renders/widgets/**`
- `/l10n/widgets/**`
- `/assets/account/**`

Private account-control paths are owned by Tokyo-worker and reached from Roma through Cloudflare service bindings.
