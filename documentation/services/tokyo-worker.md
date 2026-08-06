# Tokyo-worker - R2 Boundary

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo-worker is the Tokyo R2/storage/CDN boundary for account runtime data,
account assets, saved widget instance files, translated locale values, direct
Page files, generated public files, and public artifact serving.

Tokyo-worker stores and serves bytes. Roma owns account product commands and
tier enforcement. Account management owns storage retention and deletion
lifecycle.

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
- Page source, generated-file, serving-overlay, and publication-state R2 operations
- published Instance and Page file serving
- shared `/clickeen.js` installer serving from the Tokyo product root
- `clk.live` and `dev.clk.live` static artifact serving
- `GET /healthz`

Roma owns:

- current account
- tier and entitlement decisions
- upload and storage policy
- publish/unpublish eligibility

Account management owns:

- storage retention after tier changes or suspension
- the 30-day downgraded-asset overage decision
- whole-account deletion lifecycle

Tokyo-worker does not decide which tier an account has, whether grace expired,
or whether an account should be deleted. It performs the exact authorized byte
operation and fails when required identity, ordering, or size metadata is
missing or malformed.

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

Accepted product law adds one account-management operation: after a downgrade
leaves asset usage above `storage.bytes.max` for 30 days, account management
directs Tokyo-worker to remove assets by descending `updatedAt`, with ascending
`assetRef` as the deterministic tie-break, stopping as soon as stored asset
bytes fit the allowance. Tokyo-worker validates the complete inventory,
allowance, ordering fields, and size math before the first deletion. A mid-set
failure is explicit partial failure that identifies completed deletions and
remaining overage; it is never full success. This operation must not touch Instances, Pages,
templates, overlays, or generated files. It is not implemented in the current
runtime; this document does not invent a second storage owner or make Roma page
loads a cleanup dependency.

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

`instance.config.json` carries non-text config, widget identity, display name,
base locale, and timestamps. Account
instances do not have a generic metadata field. Account active locales are Roma
account settings, not instance config.

`instance.content.json` carries base user-visible text values.

`overlays/locales/{locale}.json` carries durable translated values for one
account active locale.

Translation Agent writes translated locale values through Tokyo-worker with the
Roma-issued Translation Agent grant. Tokyo-worker verifies that the grant names
the same account, instance, and locale before storing the value map. Tokyo-worker
validates the overlay value keys against the saved `instance.content.json` field
map, not against a freshly derived widget contract. Roma account settings
deletes removed active locale overlay files through Tokyo-worker with the Roma
account capsule. Tokyo does not decide active
locales, tier, translation meaning, or model policy.

`index.html`, `styles.css`, and `runtime.js` are the exact browser package Bob
generated and submitted through Roma. Tokyo-worker requires all three exact
files with valid package content-type metadata. It does not rebuild, restore,
infer, or repair package bytes.

On source save, Tokyo-worker writes the exact submitted package, then
`instance.content.json`, then `instance.config.json`.

The stable public coordinate is:

```text
accountPublicId + instanceId
```

## Pages

Account pages are stacks of saved widget instances. Their direct root is:

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  overlays/
    locales/
      {locale}.json
  overlays.json
  index.html
  styles.css
  runtime.js
```

Roma owns current-account access, Page policy, and authenticated Save, Publish,
Unpublish, and Delete commands. Tokyo-worker validates and stores the exact
submitted source, browser-generated files, root serving overlays, and
`{ "published": boolean }` serving state. Before Save, Tokyo-worker verifies
that every referenced Instance and optional social-image asset exist under the
same account.

Page source is an ordered document of saved Instance references. It does not
duplicate child Instance source. First Save creates an unpublished Page; later
Save preserves its current publication state. Publish requires an ordinary
Page with at least one placement whose six direct-root artifacts exist and
parse through their storage contracts; it does not render-test the HTML.
Publish changes publication only. Unpublish retains the Page. Delete rejects a
published Page and never deletes referenced Instances or account assets.

## Public Serving

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Instance serving reads the one root widget artifact from the account folder
after `accounts/{accountPublicId}/instances/{instanceId}/serve-state.json` is
published.

Public support files are:

- `styles.css`
- `runtime.js`

Generated `index.html` references its support files through public-coordinate
placeholders:

```text
/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/styles.css
/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/runtime.js
```

Before serving base or translated Instance HTML, Tokyo-worker completes the Web
Code Generator's `__CK_PUBLIC_ACCOUNT_ID__` and `__CK_PUBLIC_INSTANCE_ID__`
literals from the validated public route. The Free attribution product link is
always the literal `https://clickeen.com/`; locale, country, and market do not
select another product link. If any
`__CK_PUBLIC_*__` literal remains after completion, the HTML fails closed with
`500 Public HTML invalid`; incomplete HTML is never served or cached. Completed
base and translated HTML responses revalidate through their exact URL cache
keys. Save, translation writes/deletes, Publish, Unpublish, and Delete purge
the affected base/locale and support-file URLs.

Private source and state files remain private account storage.

Explicit public locale selection uses:

```text
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

Cloud-dev uses the same query under `https://dev.clk.live`. Tokyo-worker reads
and validates the exact overlay against saved content, replaces exact
field-marked text/attributes and `<html lang>` in the stored root index,
completes public placeholders, and returns complete cacheable HTML.
`runtime.js` is not involved in overlay application. Missing overlays return `404 Locale not
available`; corrupt overlays return `500 Locale data invalid`; neither falls
back to base content.

Published Page serving uses:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://clk.live/{accountPublicId}/pages/{pageId}/{locale}
https://clk.live/{accountPublicId}/pages/{pageId}/styles.css
https://clk.live/{accountPublicId}/pages/{pageId}/runtime.js
```

The stable Page URL selects only from `source.json.baseLocale` plus the exact
top-level locale keys in root `overlays.json`, then redirects with `no-store`.
The exact-locale URL is the HTML cache key. On a cache miss Tokyo-worker reads
the direct Page root, requires `serve-state.json.published`, applies only the
matching Page and placement values for a non-base locale, and uses the base
values already stored in `index.html` for the base locale. It fills canonical,
alternate-locale, social, and `WebPage` public coordinates for both and returns
HTML. It never traverses child Instance URLs or calls Roma, a model, or a
generator. Root `overlays.json` is validated before route selection; one
malformed entry therefore makes stable, support-file, base, and locale Page
requests return `500 Page unavailable`. With a valid root, missing locale truth
is `404` and selected HTML completion failure is `500 Page locale data invalid`;
neither silently falls back. Page CSS and runtime JavaScript are the same direct
files for every locale.

Exact-locale Page HTML uses
`public, max-age=0, s-maxage=300, must-revalidate`. Page support files use
`public, max-age=60, s-maxage=300, stale-while-revalidate=86400`. Stable
redirects and all public failure responses are `no-store`. Public routes never
return `source.json`, `serve-state.json`, authoring overlays, or root
`overlays.json`.

Page Save while published purges the union of previous/current saved locale
URLs plus its support files. Publish, Unpublish, and Delete purge the Page's
saved exact-locale and support-file URLs. Purge configuration or API failure is
an operation failure, not success with stale cache risk.

The product-neutral iframe-free installer is served at:

```text
https://clk.live/clickeen.js
```

It reads a published Instance or Page URL from `data-clickeen`, mounts the
already-completed public product in open Shadow DOM, resolves only generated
relative support references, and does not generate, translate, or publish.

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
- Page source/files/serving-overlay operations and publication transitions

Account instance inventory is split by authority:

- `/__internal/accounts/{accountPublicId}/instances` returns only
  `{ ok, accountId, instanceIds }`;
- `/__internal/instances/{instanceId}/list-facts` returns exact stored row facts
  for one instance: account id, instance id, widget type, stored display name
  string or `null`, updated timestamp, and publish status;
- Tokyo-worker does not return product availability, tier decisions, published
  totals, fallback display labels, or account inventory rows from the account
  list route.

Current internal route families:

| Route | Methods | Purpose |
| --- | --- | --- |
| `/__internal/widgets/definitions` | `GET` | list/read widget definition summaries |
| `/__internal/accounts/{accountPublicId}/instances` | `GET` | list account instance ids only |
| `/__internal/instances` | `POST` | create saved account instance |
| `/__internal/instances/{instanceId}/list-facts` | `GET` | exact minimal account instance row facts |
| `/__internal/instances/{instanceId}` | `GET`, `PUT`, `DELETE` | open/save/delete one account instance |
| `/__internal/instances/{instanceId}/rename` | `POST` | rename one account instance |
| `/__internal/instances/{instanceId}/{publish|unpublish}` | `POST` | update widget serve state |
| `/__internal/instances/{instanceId}/package` | `GET` | read generated package metadata/files where supported |
| `/__internal/instances/{instanceId}/translations` | `GET` | list saved translated locale value files |
| `/__internal/instances/{instanceId}/translations/{locale}` | `GET`, `PUT`, `DELETE` | read/write/delete one translated value file |
| `/__internal/accounts/{accountPublicId}/pages` | `GET` | list account pages |
| `/__internal/pages` | `POST` | create an unpublished Page from exact source/files/root serving overlays |
| `/__internal/pages/{pageId}` | `GET`, `PUT`, `DELETE` | read/save the complete direct Page root or delete an unpublished Page |
| `/__internal/pages/{pageId}/{publish|unpublish}` | `POST` | change Page publication state without generation or translation |
| `/__internal/translations/{instance|page}/{targetId}/{locale}` | `PUT` | Translation Agent write bound to the exact granted target and locale |
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

Public localized serving reads this exact overlay state after publication and
root artifact checks. It does not write, regenerate, heal, call Roma, or call a
model on visitor requests.

Roma calls the Translation Agent Worker for saved Instance or Page translation
generation. Translation Agent calls San Francisco `/model/chat` and writes
overlays back through the one target-bound Tokyo-worker route. Tokyo-worker
does not provide a generation route.

## DevOps

Tokyo-worker deploys through the GitHub Actions Cloudflare Workers workflow for
cloud-dev workers. Tokyo product roots in R2 sync through the same workflow.
`tokyo/product/clickeen/clickeen.js` maps to `product/clickeen.js`; its source
path is part of the workflow change detector, so installer-only changes run the
product-root sync.

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
R2 binding: TOKYO_R2
```

Worker env and bindings:

| Name | Required | Purpose |
| --- | --- | --- |
| `TOKYO_R2` | yes | R2 bucket binding for static and account storage. |
| `BERLIN_BASE_URL` | yes unless `BERLIN_JWKS_URL` is set | Berlin session/JWKS authority for private request verification. Missing both Berlin URL settings fails verification; Tokyo-worker does not select a cloud-dev default. |
| `TOKYO_PUBLIC_BASE_URL` | yes | Public Tokyo static/resource origin. |
| `PUBLIC_SERVING_BASE_URL` | yes | Public `clk.live`/`dev.clk.live` serving origin. |
| `BERLIN_JWKS_URL` | no | Explicit JWKS URL override. When present, it is used instead of deriving JWKS from `BERLIN_BASE_URL`. |
| `ROMA_AI_GRANT_PUBLIC_KEY_PEM` | yes for Translation Agent writes | Public key that verifies Roma-issued overlay-write grants. |
| `CLOUDFLARE_ZONE_ID` | yes for published public-byte mutations | Cloudflare zone for public cache refresh. |
| `CLOUDFLARE_CACHE_PURGE_TOKEN` | yes for published public-byte mutations | Least-privilege Cloudflare API token allowed to purge the public zone. |

Current `tokyo-worker/wrangler.toml` binds `TOKYO_R2` and configures
`BERLIN_BASE_URL`, `TOKYO_PUBLIC_BASE_URL`, `PUBLIC_SERVING_BASE_URL`, and the
cloud-dev `clk.live` `CLOUDFLARE_ZONE_ID`. The Cloudflare purge API token is
deployed as the `CLOUDFLARE_CACHE_PURGE_TOKEN` Worker secret by the `cloud-dev
workers deploy` workflow and is not stored in `wrangler.toml`. It is separate
from the CI `CLOUDFLARE_API_TOKEN` used to deploy Workers.
