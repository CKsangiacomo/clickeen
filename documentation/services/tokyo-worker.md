# Tokyo-worker - R2 Boundary

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo-worker is the Tokyo R2/storage/CDN boundary for account runtime data,
account assets, saved widget instance files, translated locale values,
generated public packages, and public artifact serving.

Tokyo-worker stores and serves bytes. Roma owns account product decisions.

Tokyo-worker is one shared storage and public-serving service used by every
Widget through the same coordinate and artifact contract. It never learns a
Widget's Core semantics. Private service-binding operations from a named
Clickeen authority are trusted system commands; Tokyo-worker performs the exact
R2 operation without adding a second schema, result filter, package validator,
fingerprint comparison, or repair path.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/engineering/CloudflareOperations.md`

## Product Role

Tokyo-worker receives an already-authorized storage operation from Roma and
uses Roma's authoritative account coordinate to add, delete, read, list, or
serve the exact R2 objects for that operation. The private binding establishes
the Clickeen caller; Tokyo-worker does not re-prove Roma's product decision or
compare duplicate copies of the same system coordinate.

Tokyo-worker owns:

- account asset R2 operations
- account widget instance R2 operations
- translated locale value R2 operations
- public package file serving
- global Clickeen font file serving
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

Account-uploaded custom fonts use this same account asset authority. The global
Clickeen font set does not: it is served from `fonts/special/**` and is
available to every account.

Tokyo-worker supports the asset operations Roma calls:

- upload accepted bytes
- list account asset inventory
- resolve account asset references
- delete one exact account asset reference
- return storage usage facts from the same account asset authority

Upload bytes remain non-Clickeen input until the owning upload boundary accepts
their filename/path, MIME, size, and executable-content safety. Those checks are
real ingress protection. Roma owns account status, entitlement, and quota
policy; Tokyo-worker does not repeat that product-policy decision after Roma
authorizes the upload.

Current implementation mismatch: Tokyo-worker still duplicates portions of
Roma's account-status and storage/upload-limit enforcement. Keep byte/path
safety at the storage ingress, but remove repeated Roma product-policy checks.

## Account Widget Instances

Saved account widget instances live at:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/
    locales/
      {locale}.json                  only when that translation exists
  serve-state.json
  index.html
  styles.css
  runtime.js
```

The source files are one logical saved Widget instance. They are not separate
drafts or competing schemas:

- `instance.config.json` carries non-translatable shared Header, Stage, Pod,
  Core-size, appearance, typography, chrome, and Widget Core values together
  with Widget identity, display name, base locale, and timestamps;
- `instance.content.json` carries base-locale customer-visible Header and Core
  text values;
- `serve-state.json` carries the instance's publication state used by the
  public access boundary.

Account instances do not have a generic metadata field. Account active locales
are Roma account settings, not instance config.

`overlays/locales/{locale}.json` carries durable translated values for one
account active locale.

Translation Agent writes translated locale values through Tokyo-worker with the
Roma-issued Translation Agent grant. Signature and capability verification are
the authorization boundary for that privileged write. Once authorized,
Tokyo-worker trusts the Translation Agent's accepted overlay and stores it
without revalidating its semantic field contract against another Clickeen file.
Roma account settings deletes removed active locale overlay files through
Tokyo-worker with the Roma account capsule. Tokyo does not decide active
locales, tier, translation meaning, or model policy.

Complete `index.html`, complete `styles.css`, and mandatory `runtime.js` are
the browser package generated only by Roma's Widget-neutral materializer on
explicit allowed Publish. The package contract is
static-first:

```text
index.html  complete base-locale semantic Widget structure and content
styles.css  complete shared and Core presentation
runtime.js  mandatory Widget and shared visitor behavior
```

Tokyo-worker is the physical R2 writer. It writes canonical source documents
from Roma's exact semantic config/content payloads, stores Roma's exact package
bytes, and returns its own real R2 result. It never authors, compiles, renders,
rebuilds, restores, fingerprints, compares, or semantically validates Widget
HTML/CSS/JavaScript.
A missing object is an actual storage failure; it is not repaired or replaced.

Local implementation: source and package fingerprints, commit-marker
readiness, and legacy marked/unmarked compatibility rules are removed. Tokyo
stores exact source documents or exact Roma package bytes. Translation
operations likewise store/read/list the exact owner-produced overlays without
projecting them through saved content. Package writes continue to require all
three files, including mandatory `runtime.js`.

Save changes source only and performs no public purge. Publish/Republish stores
the exact package, changes publication truth, and then purges the instance's
one Cloudflare cache tag. Unpublish changes publication truth and then purges
that tag. Exact overlay writes/deletes purge the same tag after the overlay
mutation when the instance is published. The tag covers HTML, CSS, JavaScript,
locale queries, and tracking-query variants without enumerating URLs.

Delete removes the instance subtree and then purges the same tag. A retry after
truth was removed but purge failed still purges the tag and returns an
idempotent successful result with `existed: false`. Save never depends on a
public purge. No release URL, version, or second cache identity is created.

Workers Caching is enabled in `tokyo-worker/wrangler.toml`. Every cacheable 200
package response carries the deterministic account-instance `Cache-Tag` and
does not carry a per-request request id that could be replayed from cache.
Missing/locale-error responses are `no-store`.

For the final Publish capacity transition, Tokyo-worker receives Roma's exact
`instances.published.max` decision with the materialized package and routes the
final command to one Tokyo-owned Cloudflare Durable Object per account. The
deterministic account coordinate always reaches that account's same
single-threaded `AccountPublicationCoordinator`. The coordinator marks the
command active before its first await, then reads one key from its own Durable
Object storage before any R2 operation. That read activates Cloudflare's
shutdown/replacement fencing: an old in-flight coordinator is terminated rather
than allowed to finish beside its replacement. The coordinator then reads the
exact per-instance publication states, permits Republish without consuming
another slot, and otherwise compares the current published count with the
passed limit before writing package or published state. Only the first allowed
Publish writes those bytes.
An interleaved contender while the command is active gets HTTP 409
`PUBLISH_IN_PROGRESS` and writes no package, publication state, or cache
mutation; after the winner commits, a later attempt gets the existing HTTP 402
capacity denial.

The Durable Object writes no persistent storage and holds no policy, count,
package, or publication truth. Its lifecycle-fence read does not create a
record. Per-instance `serve-state.json` remains the sole
publication truth; Tokyo creates no publication or capacity registry. There is
no lease, timeout reclaim, polling, queue, or automatic retry. Coordination
covers only the capacity-critical count/package/state command. It ends after
the published state commits and before Tokyo purges the instance cache tag.
Unpublish and Delete do not use the coordinator. A concurrent Unpublish or
Delete can cause only a conservative temporary Publish denial, not excess
capacity.

The stable public coordinate is:

```text
accountPublicId + instanceId
```

## Public Serving

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Serving reads the one base widget artifact from the account folder after
`accounts/{accountPublicId}/instances/{instanceId}/serve-state.json` is
published. Host/path parsing and publication are public-ingress and access
boundaries. The generated package behind that boundary is trusted Clickeen
truth; public serving does not revalidate its Widget meaning or compare it with
another internal artifact.

Public support files are:

- `styles.css`
- `runtime.js`

Generated `index.html` references support files by exact root-relative package
paths, not `./` relative paths. The slashless public URL is the user-facing
coordinate, and browser resolution must not depend on a trailing slash:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

Private source and state files remain private account storage.

Explicit public locale selection uses:

```text
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

Cloud-dev uses the same query under `https://dev.clk.live`. Stored
`index.html` already contains complete base-locale semantic content. For every
index response, Tokyo-worker authors the exact base locale and stored overlay
coordinates into the public switcher's options. For an explicit non-base
locale, Tokyo-worker reads the exact trusted overlay and
applies its values to the declared semantic HTML content slots at the Edge
before returning the response through the existing public cache policy. The
locale query is part of the request cache coordinate. The selected-locale
response contains complete HTML before `runtime.js` executes and references the
same stored package support files. No locale-derived HTML/CSS/JavaScript object
is stored.

A missing requested overlay returns `404 Locale not available`; it never falls
back to base content. If the actual R2 read or JSON decode cannot complete, the
operation fails explicitly rather than treating corruption as absence. Tokyo
does not run a second saved-field-equality or overlay-shape validator on every
visitor request.

Local implementation: the public index route trusts every current Widget's
exact stored base HTML and requested overlay. Cloudflare `HTMLRewriter`
replaces exact stable-identity `data-ck-content-path` slots, respects their
exact text/HTML mode, writes the exact authored HTML attribute when
`data-ck-content-attribute` is present, and sets `<html lang>` before the
response. No package fingerprint, browser locale context, client localization,
overlay schema validator, or saved-field equality check runs in public
serving. Missing overlay truth is `404`; an R2 or JSON read failure is `500`;
neither falls back to base. These local changes have not been deployed or
verified in cloud-dev.

## Private Roma Routes

Roma reaches Tokyo-worker through private Cloudflare service bindings for
storage commands. The request carries the Roma account authz capsule
and the account public id.

`/__internal/**` is not a public Tokyo route. Internal storage commands and
asset-control calls must arrive through Cloudflare service bindings. Public
CORS does not advertise the internal-service header.

The binding and applicable signed authority proof establish the caller's
authorization. After that boundary, Tokyo-worker trusts the exact Roma or agent
command and does not semantically revalidate its Clickeen-produced payload.

Storage command routes cover:

- widget definition reads
- account instance list/open/create/save/rename/delete
- publish and unpublish
- translated locale reads and writes
- account asset list/upload/resolve/delete

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
| `/__internal/instances/{instanceId}/publish` | `POST` | store Roma's exact three-file package, publish, and purge the instance cache tag |
| `/__internal/instances/{instanceId}/unpublish` | `POST` | change publication truth and purge the instance cache tag; retain source/package |
| `/__internal/instances/{instanceId}/translations` | `GET` | list saved translated locale value files |
| `/__internal/instances/{instanceId}/translations/{locale}` | `GET`, `PUT`, `DELETE` | read/write/delete one translated value file |
| `/__internal/accounts/{accountPublicId}/widget-defaults` | `GET`, `POST`, `PUT` | read/create/write account widget defaults |
| `/__internal/assets/upload` | `POST` | upload account asset bytes |
| `/__internal/assets/account/{accountPublicId}` | `GET` | list account asset metadata |
| `/__internal/assets/account/{accountPublicId}/usage` | `GET` | account asset usage facts |
| `/__internal/assets/account/{accountPublicId}/resolve` | `POST` | resolve account asset references |
| `/__internal/assets/account/{accountPublicId}/asset/{assetRef}` | `DELETE` | delete exact account asset |

The account widget-defaults document stores `common` and
`widgets.{widgetType}.core`. Roma owns that complete document; Tokyo-worker
trusts and stores it without a second shape validator. The removed `shell` key
has no alias or compatibility behavior, and Tokyo-worker never repairs a
document on read.

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

That product folder includes the widget's canonical source and its adjacent
English `labels/en.json` build input. The file is
git-authored product software, not account data or a visitor-time locale
overlay. Tokyo-worker does not resolve its labels at runtime.

Canonical unique Widget software is its structured contract plus mandatory
Core HTML/CSS/JavaScript. Shared Stage, Pod, Header, Bob,
Roma, materialization, localization, asset, and serving capabilities remain
Widget-neutral system services. Tokyo-worker neither knows whether a package
came from FAQ nor branches on Widget identity; it stores the exact package Roma
produced.

Account instances store references and user data. Widget software remains in
the system product tree.

Global Clickeen font files are authored in git and deployed separately to:

```text
fonts/special/{filename}
```

The public friendly route is `/fonts/special/{filename}`. These files are not
owned by the `CLICKEEN` account.

## Translated Locale Values

Tokyo-worker stores translated locale values as exact overlay artifacts under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Tokyo-worker lists, reads, writes, and deletes those overlay files for Roma and
approved internal callers. It does not own translation generation, AI runtime
policy, active-locale authority, or completion/failure state.

Public localized serving reads this exact trusted overlay state after the
external request passes publication access. It does not validate it against
another Clickeen artifact, write, regenerate, heal, call Roma, or call a model
on visitor requests.

Roma calls the Translation Agent Worker for account-widget translation
generation. Translation Agent calls San Francisco `/model/turn` in structured
mode and writes overlays back through Tokyo-worker. Tokyo-worker does not
provide a generation route.

## Trust Hard Stops

- Do not add Widget-name branches or Widget-specific semantics to Tokyo-worker.
- Do not revalidate, filter, normalize, fingerprint, compare, or repair a
  package, source document, overlay, defaults document, or command produced by
  another Clickeen authority.
- Do not repeat Roma account product policy inside the storage service.
- Do not require client JavaScript to create initial public content; base and
  selected-locale HTML responses are semantic before `runtime.js` executes.
- Do not weaken private-binding, signed-grant, public host/path, publication, or
  upload-byte safety boundaries. Those are real authorization or external-input
  boundaries, not internal semantic validation.

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
  tokyo.dev.clickeen.com/fonts/*
  tokyo.dev.clickeen.com/prague/l10n/*
  tokyo.dev.clickeen.com/prague/assets/*
  tokyo.dev.clickeen.com/assets/account/*
R2 binding: TOKYO_R2
```

Worker env and bindings:

| Name | Required | Purpose |
| --- | --- | --- |
| `TOKYO_R2` | yes | R2 bucket binding for static and account storage. |
| `ACCOUNT_PUBLICATION_COORDINATOR` | yes | Durable Object namespace whose deterministic per-account object serializes the final first-Publish capacity transition. It stores no policy, count, package, or publication truth. |
| `BERLIN_BASE_URL` | yes unless `BERLIN_JWKS_URL` is set | Berlin session/JWKS authority for private request verification. Missing both Berlin URL settings fails verification; Tokyo-worker does not select a cloud-dev default. |
| `TOKYO_PUBLIC_BASE_URL` | yes | Public Tokyo static/resource origin. |
| `PUBLIC_SERVING_BASE_URL` | yes | Public `clk.live`/`dev.clk.live` serving origin. |
| `BERLIN_JWKS_URL` | no | Explicit JWKS URL override. When present, it is used instead of deriving JWKS from `BERLIN_BASE_URL`. |
| `ROMA_AI_GRANT_PUBLIC_KEY_PEM` | yes for Translation Agent writes | Public key that verifies Roma-issued overlay-write grants. |
| `CLOUDFLARE_ZONE_ID` | yes for published public-byte mutations | Cloudflare zone for public cache refresh. |
| `CLOUDFLARE_CACHE_PURGE_TOKEN` | yes for published public-byte mutations | Least-privilege Cloudflare API token allowed to purge the public zone. |

Current `tokyo-worker/wrangler.toml` binds `TOKYO_R2`, binds
`ACCOUNT_PUBLICATION_COORDINATOR` to the exported
`AccountPublicationCoordinator` Durable Object class, declares its SQLite-class
migration, and configures `BERLIN_BASE_URL`, `TOKYO_PUBLIC_BASE_URL`,
`PUBLIC_SERVING_BASE_URL`, and the cloud-dev `clk.live`
`CLOUDFLARE_ZONE_ID`. The Cloudflare purge API token is
deployed as the `CLOUDFLARE_CACHE_PURGE_TOKEN` Worker secret by the `cloud-dev
workers deploy` workflow and is not stored in `wrangler.toml`. It is separate
from the CI `CLOUDFLARE_API_TOKEN` used to deploy Workers.
