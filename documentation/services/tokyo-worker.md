# Tokyo-worker - R2 Boundary

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo-worker is the Tokyo R2/storage/CDN boundary for account runtime data,
account assets, saved widget instance files, translated locale values, page
files, generated public packages, and public artifact serving.

Tokyo-worker stores and serves bytes. Roma owns account product decisions.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/engineering/CloudflareOperations.md`

## Product Role

Tokyo-worker receives an already-authorized storage operation from Roma, proves
that the operation addresses the account path named by the Roma account context,
then adds, deletes, reads, lists, or serves the exact R2 objects for that
operation.

Tokyo-worker owns:

- account asset R2 operations
- account widget instance R2 operations
- translated locale value R2 operations
- page source and page package R2 operations
- public package file serving
- `clk.live` and `dev.clk.live` static artifact serving
- `GET /healthz`

Roma owns:

- current account
- tier and entitlement decisions
- upload and storage policy
- publish/unpublish eligibility
- downgrade and suspension consequences
- account lifecycle correctness

## Account Storage

Account storage is rooted at:

```text
accounts/{accountPublicId}/
```

The active cloud-dev admin account uses the normal account public id:

```text
accounts/CLICKEEN/
```

## Account Assets

Account assets live at:

```text
accounts/{accountPublicId}/assets/{filename}
```

SVG logos are regular account assets when uploaded by an account. Admin SVG logos
live at:

```text
accounts/CLICKEEN/assets/{filename}
```

Tokyo-worker supports the asset operations Roma calls:

- upload accepted bytes
- list account asset inventory
- resolve account asset references
- delete one exact account asset reference
- return storage usage facts from the same account asset authority

## Account Widget Instances

Saved account widget instances live at:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/
    locales/
      {locale}.json
  index.html
  styles.css
  runtime.js
```

`instance.config.json` carries non-text config, widget identity, display
metadata, base locale, and timestamps. Account active locales are Roma account
settings, not instance config.

`instance.content.json` carries base user-visible text values.

`overlays/locales/{locale}.json` carries durable translated values for one
account active locale.

Translation Agent writes translated locale values through Tokyo-worker with the
Roma-issued Translation Agent grant. Tokyo-worker verifies that the grant names
the same account, instance, and locale before storing the value map. Tokyo-worker
validates the overlay value keys against the saved `instance.content.json` field
map, not against a freshly derived widget contract. Roma account settings deletes
removed active locale overlay files through Tokyo-worker with the Roma account
capsule. Tokyo does not decide active locales, tier, translation meaning, or
model policy.

`index.html`, `styles.css`, and `runtime.js` are the generated browser package
saved with the instance.

Newly saved generated package files carry R2 metadata matching the saved source
package fingerprint. Package reads, publish, and public serving require source
and package agreement. Existing unmarked source and unmarked package files remain
readable until the instance is saved again; any marked/unmarked mix fails closed.
Tokyo-worker does not rebuild or restore package bytes.

The stable public coordinate is:

```text
accountPublicId + instanceId
```

## Pages

Account pages are stacks of saved widget instances. Page source lives at:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
```

Generated page package files live beside the page source under:

```text
accounts/{accountPublicId}/pages/{pageId}/
```

Roma owns page product decisions, page source validation, page source save
stamps, list summaries, and placement rules. Tokyo-worker stores page source,
any submitted page package files, and serve state under the account path Roma
names. Current account page publish is unavailable until Roma writes page
packages. Tokyo-worker rejects save/delete operations against published page
source until Roma unpublishes the page.

## Public Serving

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Serving reads generated widget package files from the account folder after
`accounts/{accountPublicId}/instances/{instanceId}/serve-state.json` is
published. Account page public serving is
unavailable until Roma writes page packages. Tokyo-worker does not generate page
package files. Public serving serves the stored package bytes as written; it
does not interpret a query locale to invent translated output when the stored
package contains only base content.

Public support files are:

- `styles.css`
- `runtime.js`

Private source and state files remain private account storage.

Public page-serving URL shape is parsed by Tokyo-worker, but current page
public serving returns `404` until Roma writes real page packages.

## Private Roma Routes

Roma reaches Tokyo-worker through private Cloudflare service bindings for
storage commands. The request carries the Roma account authz capsule
and the account public id.

`/__internal/**` is not a public Tokyo route. Internal storage commands and
asset-control calls must arrive through Cloudflare service bindings. Public
CORS does not advertise the internal-service header.

Storage command routes cover:

- widget definition reads
- account instance list/open/create/save/rename/delete
- publish and unpublish
- translated locale reads and writes
- account asset list/upload/resolve/delete
- page source/package/serve-state operations

Current internal route families:

| Route | Methods | Purpose |
| --- | --- | --- |
| `/__internal/widgets/definitions` | `GET` | list/read widget definition summaries |
| `/__internal/accounts/{accountPublicId}/instances` | `GET` | list account instances |
| `/__internal/accounts/{accountPublicId}/instances/facts` | `GET` | account instance facts used by Roma |
| `/__internal/instances` | `POST` | create saved account instance |
| `/__internal/instances/{instanceId}` | `GET`, `PUT`, `DELETE` | open/save/delete one account instance |
| `/__internal/instances/{instanceId}/rename` | `POST` | rename one account instance |
| `/__internal/instances/{instanceId}/{publish|unpublish}` | `POST` | update widget serve state |
| `/__internal/instances/{instanceId}/package` | `GET` | read generated package metadata/files where supported |
| `/__internal/instances/{instanceId}/translations` | `GET` | list saved translated locale value files |
| `/__internal/instances/{instanceId}/translations/{locale}` | `GET`, `PUT`, `DELETE` | read/write/delete one translated value file |
| `/__internal/accounts/{accountPublicId}/pages` | `GET` | list account pages |
| `/__internal/pages` | `POST` | create account page source |
| `/__internal/pages/{pageId}` | `GET`, `PUT`, `DELETE` | read/save/delete account page source |
| `/__internal/pages/{pageId}/{publish|unpublish}` | `POST` | update page serve state |
| `/__internal/accounts/{accountPublicId}/widget-defaults` | `GET`, `POST`, `PUT` | read/create/write account widget defaults |
| `/__internal/assets/upload` | `POST` | upload account asset bytes |
| `/__internal/assets/account/{accountPublicId}` | `GET` | list account asset metadata |
| `/__internal/assets/account/{accountPublicId}/usage` | `GET` | account asset usage facts |
| `/__internal/assets/account/{accountPublicId}/resolve` | `POST` | resolve account asset references |
| `/__internal/assets/account/{accountPublicId}/asset/{assetRef}` | `DELETE` | delete exact account asset |

Health route:

```text
GET /healthz -> { "up": true }
```

## Widget Software

Widget software is system software. It is authored in git under:

```text
tokyo/product/widgets/{widgetType}/
```

It is deployed to R2 under:

```text
product/widgets/{widgetType}/
```

Account instances store references and user data. Widget software remains in
the system product tree.

## Translated Locale Values

Tokyo-worker stores translated locale values as exact overlay artifacts under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Tokyo-worker lists, reads, writes, and deletes those overlay files for Roma and
approved internal callers. It does not own translation generation, AI runtime
policy, active-locale authority, or completion/failure state.

Roma calls the Translation Agent Worker for account-widget translation
generation. Translation Agent calls San Francisco `/model/chat` and writes
overlays back through Tokyo-worker. Tokyo-worker does not provide a generation
route.

## DevOps

Tokyo-worker deploys through the GitHub Actions Cloudflare Workers workflow for
cloud-dev workers. Tokyo product roots in R2 sync through the same workflow.

Before any manual Tokyo/R2 operation, run:

```bash
pnpm cf:preflight
```

Cloudflare/R2 evidence comes from the repo commands documented in
`documentation/engineering/CloudflareOperations.md`.

Cloud-dev Worker config:

```text
worker: tokyo-assets-dev
routes:
  dev.clk.live/*
  tokyo.dev.clickeen.com/healthz
  tokyo.dev.clickeen.com/widgets/*
  tokyo.dev.clickeen.com/dieter/*
  tokyo.dev.clickeen.com/i18n/*
  tokyo.dev.clickeen.com/prague/l10n/*
  tokyo.dev.clickeen.com/prague/assets/*
  tokyo.dev.clickeen.com/assets/account/*
  tokyo.dev.clickeen.com/fonts/*
R2 binding: TOKYO_R2
```

Worker env and bindings:

| Name | Required | Purpose |
| --- | --- | --- |
| `TOKYO_R2` | yes | R2 bucket binding for static and account storage. |
| `BERLIN_BASE_URL` | yes | Berlin session/JWKS authority for private request verification. |
| `TOKYO_PUBLIC_BASE_URL` | yes | Public Tokyo static/resource origin. |
| `PUBLIC_SERVING_BASE_URL` | yes | Public `clk.live`/`dev.clk.live` serving origin. |
| `BERLIN_JWKS_URL` | no | Explicit JWKS URL when not derived from Berlin base URL. |
| `AI_GRANT_HMAC_SECRET` | no | HMAC secret for AI grant verification where grant path uses it. |
| `CLOUDFLARE_ZONE_ID` | no | Cloudflare purge support when purge is enabled. |
| `CLOUDFLARE_API_TOKEN` | no | Cloudflare purge support when purge is enabled. |

Current `tokyo-worker/wrangler.toml` binds `TOKYO_R2` and configures
`BERLIN_BASE_URL`, `TOKYO_PUBLIC_BASE_URL`, and `PUBLIC_SERVING_BASE_URL` for
cloud-dev.
