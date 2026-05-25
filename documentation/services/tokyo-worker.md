# System: Tokyo-worker - PBX Routes And Instance Storage

STATUS: REFERENCE - MUST MATCH RUNTIME DURING PRD 103 PRE-GATE

PRD 103_00 NOTE: this doc now uses the product-operation vocabulary required before PRD 103 resumes. Tokyo-worker may keep storage objects only as private implementation behind approved product operations. Final resume still requires the manual product smoke and Product + Architecture signoff recorded in `Execution_Pipeline_Docs/02-Executing/103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md`.

Tokyo-worker is the Tokyo object PBX for account-owned assets, account widget instances, translated locale value storage, public artifact bytes, and friendly asset serving.

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

- `catalog.json` carries catalog label, description, category, and display order.
- `spec.json` carries defaults and editor contract truth.
- `editable-fields.json` carries the editable/translatable field contract where the widget has one.
- Widget `seo-geo.ts` files and catalog SEO/GEO capability flags were deleted in PRD 103_01.3c.2. SEO/GEO can return only through a later named static publish/SEO operation.

Tokyo-worker resolves widget definitions through the `listWidgetDefinitions` and `getWidgetDefinition` domain operations. Those operations read approved widget source files directly. There is no generated widget manifest or generated SEO/GEO registry in the product path. `scripts/validate-widget-source.mjs` is a non-mutating source guard.

## Responsibilities

1. Account assets: route and mutate account-owned asset objects under `accounts/{accountPublicId}/assets/`.
2. Account instances: route product open, save, list, create, rename, delete, publish, and unpublish operations for `accountPublicId + instanceId`.
3. Account-instance translated locale values: store/read exact locale values on the owning instance content fields by `instanceId + locale`.
4. Public artifact materialization: publish renders static browser files under the owning instance folder before the instance becomes public.
5. Friendly asset routes: serve public asset URLs from canonical R2 roots without creating route-shaped storage roots.

## Account Storage

```txt
accounts/{accountPublicId}/
  assets/
    {assetRef}
  instances/
    {instanceId}/
      instance.config.json       # non-text config, identity/display/locale metadata
      instance.content.json      # base user-visible text fields, translated locale values, and per-field translation status
      index.html
      styles.v{n}.css
      styles.css
      script.v{n}.js
      script.js
      {locale}.html
      script.v{n}.{locale}.js
      script.{locale}.js
```

Rules:

- `accounts/{accountPublicId}` is the account ownership and storage boundary. The private account UUID remains only where relational systems require it; it must not be an R2 product folder name.
- Account instances live directly under `instances/{instanceId}/`. There is no account `widgets/` storage lane, no `widgets/{widgetCode}` grouping folder, and no account-level `widget.json` authority.
- Widget software lives only under `product/widgets/{widgetType}/`. `widgetType` and `widgetCode` may appear as metadata/codebook identity; they are never R2 locators for account instances.
- `{instanceId}` is a stable generated 10-character uppercase base36 ID. It is not derived from widget type, display name, UUID, timestamp, or any old `ins_*` string.
- `instance.config.json` carries non-text config plus instance identity/display, widget type/code, base locale, target locales, and timestamps.
- `instance.content.json` carries base user-visible text values in the same editable paths Bob exposes, current translated locale values for those fields, plus `ok`/`changed` translation pickup status. This is the translation input and translation preview source. Every value is a string; rich text is sanitized HTML string content, not an object.
- `instance.json` is not written or read by active product runtime code.
- Saved source does not carry `sourceVersion` or generic generation lanes. Translation and publish work use product operation state, content field status, and queue/job boundaries.
- Legacy `overlays/{overlayId}.json` objects may exist until data cleanup, but no translation product operation reads or writes them as current locale value truth.
- Publish materializes `index.html`, versioned CSS/JS support files, stable support aliases, and `{locale}.html` entry files from saved instance source plus translated locale values.
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
```

The cloud-dev public serving URL uses the same path shape on the cloud-dev host:

```txt
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Cloud-dev must not bind the dev Tokyo-worker to `clk.live`; that hostname is reserved for production public serving.

Serving maps that URL to generated files in the instance folder and reads the requested public artifact directly from R2. It must not check DB publish status on visitor traffic, compute HTML from config, heal, infer, backfill, search account indexes, or fall back to old runtime projections.

Public availability is the materialized public artifact output:

- the environment public-serving URL serves only if the generated `index.html` artifact exists.
- if a requested generated file is missing, that request returns 404.
- publish/unpublish and tier-serving operations add or remove materialized public artifacts according to product state and policy.
- Support files only serve from the same instance folder when their filename is on the generated-browser-file allowlist.
- `instance.json`, `config.json`, `publish.json`, `embed.json`, `translations.json`, `overlays/`, `published/`, source maps, hidden files, directories, and unknown files return 404 even if the object physically exists.

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

The only queue binding Tokyo-worker currently owns in this area is the `INSTANCE_TRANSLATION_JOBS` producer. Generate translations resolves account instance content, editable field contracts, field-level locale status, and policy, then sends locale translation jobs for San Francisco to consume. Each explicit Generate click creates a fresh current generation and supersedes any prior active generation; late San Francisco completions are ignored unless their job id still matches Tokyo's current generation. Tokyo reads the current generation document as detailed job truth; the Supabase registry status is only the coarse product control projection and must not promote terminal or idle generation state back into an active poll. Active generations that do not receive San Francisco completion/failure callbacks expire to failed instead of leaving Bob in an endless polling loop. It does not scan overlay files before queueing. Tokyo-worker does not use a queue to delete account instances or to mirror public artifacts.

## Delete, Publish, And Unpublish

- Publish/republish materializes public artifacts from the approved saved instance source and translated locale values, then sets the instance publish status to `published`.
- Unpublish sets the instance publish status to `unpublished` and leaves account-owned saved source plus generated files intact. Public serving rejects them while unpublished.
- If artifact materialization fails, publish fails clearly and does not mark the instance as published.
- Delete removes the account-owned instance subtree.
- Neither operation writes or deletes root `published/widgets` because that registry does not exist in the PRD 099 product model.
