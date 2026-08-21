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

Local implementation matches that boundary. Roma owns account status and the
product-policy decision. Tokyo-worker consumes Roma's exact authorized limits
and executes them against the actual received bytes and current storage
operation, while retaining byte/path/MIME/executable-content safety at storage
ingress. It does not repeat Roma's account-status decision.

## Account Widget Instances

Saved account widget instances live at:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.source.json
  overlays/
    locales/
      {locale}.json                  only when that translation exists
  serve-state.json
```

`instance.source.json` is one atomic saved Widget instance. It contains exact
identity/display/base-locale/timestamp metadata, exact shared/Core config, and
exact base-locale content. First Save writes the initial unpublished
`serve-state.json` first and writes `instance.source.json` last. Account
inventory recognizes only exact `instance.source.json` keys, so a failed create
cannot expose a partial instance. Save and Rename each replace the whole source
record in one R2 PUT.

`serve-state.json` is one atomic serving artifact. Its published form contains
`status`, `publishedAt`, and Roma's exact logical `publicPackage`
`{ indexHtml, stylesCss, runtimeJs }`. Its unpublished form carries no public
package. The public `index.html`, `styles.css`, and `runtime.js` paths are
logical views of those members, not separate R2 objects. Publication therefore
has no package/status split commit.

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

Tokyo-worker is the physical R2 writer. It writes Roma's exact semantic source
payload as one atomic `instance.source.json`, stores Roma's exact package inside
one atomic published `serve-state.json`, and returns its own real R2 result. It
never authors, compiles, renders, rebuilds, restores, fingerprints, compares,
or semantically validates Widget HTML/CSS/JavaScript.
A missing object is an actual storage failure; it is not repaired or replaced.

Local implementation: source and package fingerprints, commit-marker
readiness, and legacy marked/unmarked compatibility rules are removed. Tokyo
stores one exact source document or one exact serve-state artifact. Translation
operations likewise store/read/list the exact owner-produced overlays without
projecting them through saved content. Publish input continues to require all
three logical members, including mandatory `runtimeJs`.

Save changes source only and schedules no public eviction.
Publish/Republish changes package/publication truth inside the account
coordinator and returns that exact product result to Tokyo's default Worker
entrypoint. After successful Publish/Republish, Unpublish, Delete, or exact
overlay PUT/DELETE, the route schedules
`ctx.cache.purge({ tags: [accountInstanceCacheTag] })` through the bound
`ctx.waitUntil` without awaiting or inspecting the purge. Every cacheable
response for the exact account/instance carries that deterministic tag, so one
Worker-owned eviction covers base HTML, support-file paths, locale queries, and
tracking-query variants without enumerating URLs.

Eviction is structurally outside every product result. Missing cache context,
a synchronous purge throw, rejected promise, `success:false`, a `waitUntil`
throw, or an indefinitely pending purge cannot change the owning mutation's
status or payload. No Roma response, UI state, user copy, retry command,
rollback, queue, polling path, or alternate lifecycle represents cache state.
Generated package responses use
`public, max-age=60, s-maxage=300, must-revalidate`; the five-minute shared-cache
window is the bounded freshness backstop. No release URL, version, or second
cache identity is created.

Workers Caching is enabled in `tokyo-worker/wrangler.toml`. Every cacheable 200
package response carries the deterministic account-instance `Cache-Tag` and
does not carry a per-request request id that could be replayed from cache.
Missing/locale-error responses are `no-store`. The tag is the exact invalidation
identity consumed by the owning default entrypoint's `ctx.cache.purge()` call.

Prior cloud-dev evidence showed zone-API invalidation does not own Workers
Cache. The deployed source instead schedules the owning default entrypoint's
tag eviction through `waitUntil`, but live HIT/MISS or purge success is not a
product acceptance gate. Agent-executed base/package/selected-locale serving
proof passes without inspecting cache outcome.

Every existing-instance Save, Rename, Publish/Republish, Unpublish, and Delete
routes through one Tokyo-owned Cloudflare Durable Object per account. The
deterministic account coordinate always reaches that account's same
single-threaded `AccountPublicationCoordinator`. First Save and Duplicate
create new coordinates and do not enter this existing-instance critical
section.

The coordinator marks the command active before its first await, then reads one
key from its own Durable Object storage before any R2 operation. That read
activates Cloudflare's shutdown/replacement fencing: an old in-flight
coordinator is terminated rather than allowed to finish beside its replacement.
An interleaved command receives HTTP 409
`coreui.errors.instance.commandInProgress` and writes nothing.

For Publish, Roma passes its exact `instances.published.max`, materialized
package, and `sourceUpdatedAt`. Inside the coordinator Tokyo re-reads the exact
source. If its `updatedAt` differs, Publish returns HTTP 409
`coreui.errors.instance.sourceChanged` before package/publication mutation.
Otherwise it permits Republish without another slot or compares current
published count with Roma's passed limit before one atomic serve-state write.
After a winning first Publish commits, a later over-capacity attempt receives
the existing HTTP 402 denial.

Tokyo is the single timestamp writer. Save and Rename each write `updatedAt`
strictly later than the previous `updatedAt` and any `publishedAt`.
Publish/Republish writes `publishedAt` strictly later than both the exact
`sourceUpdatedAt` it commits and the prior `publishedAt`. Consumers compare
those exact facts; no UI or downstream validator repairs timestamp ambiguity.

Existing-instance Delete commits by deleting the exact
`instance.source.json` source/visibility anchor inside the coordinator. A
failed R2 delete fails the command and leaves the saved instance visible. Once
the successful coordinated response exists, the route schedules residual
instance-prefix cleanup through bound `waitUntil`, then schedules the separate
product-inert cache eviction. Residual cleanup absence, synchronous throw,
rejection, partial completion, or indefinitely pending work cannot alter the
Delete response. Source-less serve-state and overlay objects are unreachable,
and account asset usage enumerates only direct objects under the account asset
prefix, so those residual bytes do not affect `storage.bytes.max`.

The Durable Object writes no persistent storage and holds no policy, count,
package, or publication truth. Its lifecycle-fence read does not create a
record. The returned value is intentionally unused and the reserved key is
intentionally never written: performing the storage access is what activates
Cloudflare's shutdown/replacement fencing for the in-flight command.
Per-instance `instance.source.json` and `serve-state.json` remain the sole
source and publication/package truths; Tokyo creates no publication or capacity
registry. There is no lease, timeout reclaim, polling, queue, or automatic
retry. Coordination ends before Tokyo's route schedules Delete's product-inert
residual cleanup and the default entrypoint schedules cache eviction through
the exact account-instance tag.

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

Serving reads the requested logical package member from
`accounts/{accountPublicId}/instances/{instanceId}/serve-state.json` after that
atomic artifact is published. Host/path parsing and publication are public-ingress and access
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

Cloud-dev uses the same query under `https://dev.clk.live`. The stored logical
`indexHtml` already contains complete base-locale semantic content. For every
index response, Tokyo-worker authors the exact base locale and stored overlay
coordinates into the public switcher's options. For an explicit non-base
locale, Tokyo-worker reads the exact trusted overlay and
applies its values to the declared semantic HTML content slots at the Edge
before returning the response through the existing public cache policy. The
locale query is part of the request cache coordinate. The selected-locale
response contains complete HTML before `runtime.js` executes and references the
same logical package support paths. No locale-derived HTML/CSS/JavaScript object
is stored.

A missing requested overlay returns `404 Locale not available`; it never falls
back to base content. If the actual R2 read or JSON decode cannot complete, the
operation fails explicitly rather than treating corruption as absence. Tokyo
does not run a second saved-field-equality or overlay-shape validator on every
visitor request.

Current cloud-dev implementation: the public index route trusts every current Widget's
exact stored logical base HTML and requested overlay. Cloudflare `HTMLRewriter`
replaces exact stable-identity `data-ck-content-path` slots, respects their
exact text/HTML mode, writes the exact authored HTML attribute when
`data-ck-content-attribute` is present, and sets `<html lang>` before the
response. No package fingerprint, browser locale context, client localization,
overlay schema validator, or saved-field equality check runs in public
serving. Missing overlay truth is `404`; an R2 or JSON read failure is `500`;
neither falls back to base. The Worker/R2 deployment and agent-executed live
serving checks pass in cloud-dev.

Closure verification on 2026-08-20 found that Tokyo's exact lookup is correct
but the then-published FAQ package encoded repeated identity `=` characters as
Mustache entity text, so repeated selected-locale values did not match while
scalar values did. The correction is in the shared materializer producer:
emit the canonical literal coordinate. Tokyo gains no decoder, alias,
compatibility key, fallback, or repair path. Commit `72e75000` deployed that
producer; Roma Republished only `VUWUJ7OQ0Y`; source and 28 overlay hashes were
unchanged; and unique base/French public requests proved literal repeated
coordinates plus translated scalar, repeated question, and repeated answer
content before JavaScript.

The pre-GA atomic source/published-serve-state cutover is complete for all four
legacy saved cloud-dev instances under `CLICKEEN`; the two public instances
were Republished through Roma. No compatibility reader or migration-on-read
exists, and retained split legacy objects are unreachable.

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
For account-asset Resolve and Delete, Roma's browser-facing routes have already
admitted the direct single-filename asset-reference list or path coordinate.
Tokyo-worker decodes the private request transport and uses those exact
accepted coordinates directly; neither its route handler nor the storage
lookup/delete helper repeats the syntax or uniqueness decision.

Storage command routes cover:

- widget definition reads
- account instance list/open/create/save/rename/delete
- publish and unpublish
- translated locale reads and writes
- account asset list/upload/resolve/delete

Account instance inventory is split by authority:

- `/__internal/accounts/{accountPublicId}/instances` returns only
  `{ ok, accountId, instanceIds }`;
- its storage enumeration recognizes only exact
  `instances/{instanceId}/instance.source.json` keys; serve-state or overlay
  objects without that source commit record are not visible instances;
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
| `/__internal/instances` | `POST` | create a saved instance by writing unpublished serve-state first and the atomic source/visibility record last |
| `/__internal/instances/{instanceId}/list-facts` | `GET` | exact minimal account instance row facts |
| `/__internal/instances/{instanceId}` | `GET`, `PUT`, `DELETE` | open one atomic source; coordinate an existing Save that replaces it once; or coordinate Delete by removing the exact source/visibility anchor, return that result, then schedule product-inert residual prefix cleanup and Cache-Tag eviction |
| `/__internal/instances/{instanceId}/rename` | `POST` | rename one account instance |
| `/__internal/instances/{instanceId}/publish` | `POST` | coordinate the exact source revision/capacity decision, atomically store Roma's logical package with published state, return the transition, then schedule product-inert Cache-Tag eviction |
| `/__internal/instances/{instanceId}/unpublish` | `POST` | coordinate and atomically replace serve-state with unpublished truth while retaining source, return the transition, then schedule product-inert Cache-Tag eviction |
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
| `ACCOUNT_PUBLICATION_COORDINATOR` | yes | Durable Object namespace whose deterministic per-account object serializes existing-instance Save, Rename, Publish/Republish, Unpublish, and Delete. It stores no source, policy, count, package, or publication truth. |
| `BERLIN_BASE_URL` | yes unless `BERLIN_JWKS_URL` is set | Berlin session/JWKS authority for private request verification. Missing both Berlin URL settings fails verification; Tokyo-worker does not select a cloud-dev default. |
| `TOKYO_PUBLIC_BASE_URL` | yes | Public Tokyo static/resource origin. |
| `BERLIN_JWKS_URL` | no | Explicit JWKS URL override. When present, it is used instead of deriving JWKS from `BERLIN_BASE_URL`. |
| `ROMA_AI_GRANT_PUBLIC_KEY_PEM` | yes for Translation Agent writes | Public key that verifies Roma-issued overlay-write grants. |

Current `tokyo-worker/wrangler.toml` binds `TOKYO_R2`, binds
`ACCOUNT_PUBLICATION_COORDINATOR` to the exported
`AccountPublicationCoordinator` Durable Object class, declares its SQLite-class
migration, enables Workers Caching, and configures `BERLIN_BASE_URL` plus
`TOKYO_PUBLIC_BASE_URL`. Public-cache invalidation uses the owning default
entrypoint's `ctx.cache.purge()` capability and therefore has no public-serving
base URL, zone ID, or purge-token runtime dependency. The CI
`CLOUDFLARE_API_TOKEN` remains only the Worker deployment credential.
