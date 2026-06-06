# System: Tokyo-worker - PBX Routes And Instance Storage

STATUS: REFERENCE - MUST MATCH PRD 105 INSTANCE FOLDER TENETS AND RUNTIME

PRD 103_00 NOTE: this doc now uses the product-operation vocabulary required before PRD 103 resumes. Tokyo-worker may keep storage objects only as private implementation behind approved product operations. Final resume still requires the manual product smoke and Product + Architecture signoff recorded in `Execution_Pipeline_Docs/02-Executing/103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md`.

PRD 105 NOTE: active account instance shape is `instance.config.json`, `instance.content.json`, `overlays/locales/{locale}.json`, `index.html`, `styles.css`, and `runtime.js`. Tokyo-worker must not preserve operation-controller JSON in instance folders, per-locale HTML/JS files, versioned script/style artifacts, or translated-locale inventory folders as current architecture.

Tokyo-worker is the Tokyo object PBX for account-owned assets, account widget instances, translated locale value storage, submitted public package bytes, submitted page package bytes, and friendly asset serving.

It is not an account authority, product-policy owner, or orchestrator. Roma and system account operations decide account/product policy, publication eligibility, cap enforcement, downgrade consequences, and correctness of published state. Roma carries verified account context to Tokyo-worker through private service bindings. Tokyo-worker validates the named boundary, routes the operation to the exact storage object, and returns the result.

Allowed Tokyo-worker PBX validations are narrow:

- service auth and account authz capsule presence/validity
- account capsule to path coordinate match
- HTTP method, route, and ID shape
- widget codebook and widget type existence
- object schema and submitted public package contract shape
- R2 object existence or absence at the requested canonical key
- bounded technical request limits needed to protect the worker/R2 interface

Tokyo-worker must not own billing, tier, publication, l10n version, upload-size, storage-cap, compliance, or account lifecycle policy. If those checks are product policy, they belong to Roma/system account operations before Tokyo-worker is asked to write or remove bytes. Tokyo-worker may enforce technical request bounds only when they are transport safety limits, not product entitlements.

## Widget Definitions And Contracts

Active widget definition truth is widget-owned under `tokyo/product/widgets/{widgetType}/` in git and deployed to R2 under `product/widgets/{widgetType}/`:

- `spec.json` carries defaults and editor contract truth.
- `editable-fields.json` carries the editable/translatable field contract where the widget has one.
- Widget `catalog.json` and `seo-geo.ts` files are deleted source. SEO/GEO can return only through a later named static publish/SEO operation.

Tokyo-worker resolves widget definitions through the `listWidgetDefinitions` and `getWidgetDefinition` domain operations. Those operations read approved widget source files directly. There is no generated widget manifest or generated SEO/GEO registry in the product path.

## Responsibilities

1. Account assets: route and mutate account-owned asset objects under `accounts/{accountPublicId}/assets/`.
2. Account instances: route product open, save, list, create, rename, delete, publish, and unpublish operations for `accountPublicId + instanceId`.
3. Account-instance translated locale values: store/read exact locale overlay value maps by `instanceId + locale`.
4. Public package storage: save stores submitted widget and page package files under the owning account folders; publish verifies those files before the instance or page becomes public.
5. Friendly asset routes: serve public asset URLs from canonical R2 roots without creating route-shaped storage roots.

## Account Storage

```txt
accounts/{accountPublicId}/
  assets/
    {assetRef}
  instances/
    {instanceId}/
      instance.config.json       # non-text config, identity/display/locale metadata
      instance.content.json      # base user-visible text fields
      overlays/
        locales/
          {locale}.json          # durable translated value map for one target locale
      index.html
      styles.css
      runtime.js
```

Rules:

- `accounts/{accountPublicId}` is the account ownership and storage boundary. The private account UUID remains only where relational systems require it; it must not be an R2 product folder name.
- Account instances live directly under `instances/{instanceId}/`. There is no account `widgets/` storage lane, no `widgets/{widgetCode}` grouping folder, and no account-level `widget.json` authority.
- Widget software lives only under `product/widgets/{widgetType}/`. `widgetType` and `widgetCode` may appear as metadata/codebook identity; they are never R2 locators for account instances.
- `{instanceId}` is a stable generated 10-character uppercase base36 ID. It is not derived from widget type, display name, UUID, timestamp, or any old `ins_*` string.
- `instance.config.json` carries non-text config plus instance identity/display, widget type/code, base locale, target locales, and timestamps.
- `instance.content.json` carries base user-visible text values in the same editable paths Bob exposes. It is the translation input source. Durable translated values live in `overlays/locales/{locale}.json`. Every value is a string; rich text is sanitized HTML string content, not an object.
- `instance.json` is not written or read by active product runtime code.
- Saved source does not carry `sourceVersion` or generic generation lanes. Translation and publish work use product operation state, base content markers, locale overlays, and queue/job boundaries.
- `overlays/locales/{locale}.json` is the only approved instance-folder translated value file shape. Legacy `overlays/{overlayId}.json` objects may exist until data cleanup, but no translation product operation reads or writes them as current locale value truth.
- Save stores the submitted `index.html`, `styles.css`, and `runtime.js` public package. Tokyo-worker stamps/verifies package coherence; it does not rebuild those files from saved source, translated overlays, or widget source files.
- `instances/index.json` is not product truth and is not read by active product runtime code.

## Public Serving

Tokyo-worker does not maintain a runtime widget renderer, a copied public instance tree, or a root published registry. Published mini-sites are resolved by the explicit public coordinate:

```txt
accountPublicId + instanceId
```

The static mini-site lives under:

```txt
accounts/{accountPublicId}/instances/{instanceId}/
```

The production public serving URL after PRD 100 is:

```txt
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/pages/{pageId}
```

The cloud-dev public serving URL uses the same path shape on the cloud-dev host:

```txt
https://dev.clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

Cloud-dev must not bind the dev Tokyo-worker to `clk.live`; that hostname is reserved for production public serving.

Serving maps those URLs to generated files and reads the requested public artifact directly from R2 only after Tokyo serve state says the instance or page is published. It must not compute HTML from config, heal, infer, backfill, search account indexes, or fall back to old runtime projections.

Generated package files and public availability are separate:

- the environment public-serving URL serves only if Tokyo serve state is `published`, the generated artifact exists, and account serving policy allows standalone delivery.
- generated `index.html`, `styles.css`, and `runtime.js` can exist for Roma page composition while the standalone widget URL remains unpublished.
- lower-tier serving caps write `accounts/{accountPublicId}/website/serving-policy.json`; they do not delete generated package files because Roma page composition may still use those files.
- generated page packages live beside page source under `accounts/{accountPublicId}/pages/{pageId}/`.
- page source is stored as opaque bytes at `accounts/{accountPublicId}/pages/{pageId}/source.json`.
- page serve state is stored as opaque bytes at `accounts/{accountPublicId}/pages/{pageId}/serve-state.json`.
- if a requested generated file is missing, that request returns 404.
- instance save writes the package files that standalone serving and Roma page composition both consume. Page save stores the Roma-submitted page package files. Publish/unpublish changes serve state, verifies package readiness before public delivery, and purges cache.
- Support files only serve from the generated-browser-file allowlist: `styles.css` and `runtime.js`.
- Private source and state files are not public artifacts. `instance.config.json`, `instance.content.json`, `instance.json`, `config.json`, `publish.json`, `embed.json`, `translations.json`, `overlays/`, `published/`, source maps, hidden files, directories, and unknown files return 404 even if the object physically exists.

The following are not surviving public product contracts:

- root published widget registries
- public render JSON routes for account or instance runtime projections
- root `published/`
- root `widgets/` as a storage folder

## Private Roma Product-Control Routes

- `GET /__internal/widgets/definitions`
- `GET /__internal/accounts/{accountPublicId}/instances`
- `POST /__internal/instances`
- `GET /__internal/instances/{instanceId}`
- `PUT /__internal/instances/{instanceId}`
- `DELETE /__internal/instances/{instanceId}`
- `POST /__internal/instances/{instanceId}/rename`
- `POST /__internal/instances/{instanceId}/duplicate`
- `POST /__internal/instances/{instanceId}/publish`
- `POST /__internal/instances/{instanceId}/unpublish`
- `GET /__internal/instances/{instanceId}/translations`
- `POST /__internal/instances/{instanceId}/translations/generate`
- `GET /__internal/instances/{instanceId}/translations/{locale}`
- `PUT /__internal/instances/{instanceId}/translations/{locale}`
- `PUT /__internal/instances/{instanceId}/translations/{locale}/complete`

These routes require Roma internal service auth plus a valid Roma account authz capsule. The account coordinate from the capsule must match the storage path Tokyo-worker reads or writes. Local `TOKYO_DEV_JWT` is only for explicit internal tooling and never a product browser path.

Internal route names must use product-operation vocabulary. The old `renders/widgets/*.json` route family is no longer a product-control surface.

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

Tokyo-worker does not consume the old render snapshot/mirror queue.

The only queue binding Tokyo-worker currently owns in this area is the `INSTANCE_TRANSLATION_JOBS` producer. Generate translations resolves account instance content, editable field contracts, locale overlays, current base markers, and policy, then sends locale translation jobs for San Francisco to consume. Tokyo owns idempotency, marker checks, timeout/liveness, and terminal locale state through Supabase-backed operation state. No generation job document belongs in the instance folder. San Francisco completions are applied only when markers still match, then durable translated values are written to `overlays/locales/{locale}.json`. Active generations that do not receive San Francisco completion/failure callbacks expire to failed instead of leaving Bob in an endless polling loop. Tokyo-worker does not use a queue to delete account instances or to mirror public artifacts.

## Delete, Publish, And Unpublish

- Publish/republish verifies the stored public package files, then sets the instance publish status to `published`.
- Unpublish sets the instance publish status to `unpublished` and leaves account-owned saved source plus generated files intact. Public serving rejects them while unpublished.
- Tier-cap serving policy may also reject standalone public serving while leaving generated files intact for Roma page composition.
- If package readiness fails, publish fails clearly and does not mark the instance as published.
- Delete removes the account-owned instance subtree.
- Neither operation writes or deletes root `published/widgets` because that registry does not exist in the PRD 099 product model.
