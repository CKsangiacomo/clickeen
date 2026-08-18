# Tokyo - R2 Storage And Static Deploy Contract

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo is the storage and static-serving plane. Tokyo is not an editor, account
authority, page builder, translation authority, or AI runtime.

Tokyo is one Widget-neutral shared service. A Widget uses Tokyo through the
same artifact and account-coordinate contract as every other Widget. Tokyo
stores and serves exact Clickeen-produced truth; it does not inspect Core
semantics or add downstream schema validation, fingerprint comparison,
normalization, filtering, or repair.

Tokyo has two forms:

- `tokyo/`: git-authored product/static artifacts;
- `tokyo-worker/`: Cloudflare Worker controlling account R2 operations and
  public reads.

## R2 Root Contract

```text
accounts/   runtime-managed account storage
dieter/     git-authored shared SVG icon media
fonts/      git-authored global Clickeen fonts
product/    git-authored product software and media
prague/     git-authored marketing/site/GTM content
```

Only `accounts/` is product-runtime-managed.

## Account Runtime Shape

```text
accounts/{accountPublicId}/
  assets/{assetRef}
  instances/{instanceId}/
    instance.config.json
    instance.content.json
    overlays/locales/{locale}.json
    serve-state.json
    index.html
    styles.css
    runtime.js
```

Rules:

- `accountPublicId` and `instanceId` are stable compact coordinates.
- Widget codes and display names are metadata, not folders.
- `instance.config.json` and `instance.content.json` are the physical source
  split for one complete logical instance. The former carries non-translatable
  shared Header/Stage/Pod/capability and Core values; the latter carries
  base-locale customer-visible Header/Core text. Bob and Roma operate on their
  recomposed complete state.
- Overlay JSON is durable translated value truth.
- `serve-state.json` is publication truth for the public access boundary.
- Each instance has one base browser artifact whose `index.html` contains
  complete base-locale semantic content and whose `styles.css` contains complete
  presentation.
- Roma's Widget-neutral materializer is the sole generator of complete
  `index.html`, complete `styles.css`, and mandatory `runtime.js` on explicit
  allowed Publish. Tokyo-worker is
  only their physical R2 writer and public server; it does not compile,
  translate, infer, validate, fingerprint, or repair them.
- `runtime.js` owns Widget and shared visitor behavior; it does not create the
  first meaningful page, materialize, localize, host, or serve the instance.
- A locale never owns HTML, CSS, JavaScript, publication state, or another
  artifact root.

## Public Serving

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

Cloud-dev uses `https://dev.clk.live`.

Public host/path parsing and publication state are external-routing and access
boundaries. Private service bindings, signed grants, and upload-byte safety are
also real security/ingress boundaries. The closed-system trust law begins after
those boundaries accept the operation; it does not remove them.

Tokyo-worker serves a published instance after the external request resolves to
that exact published coordinate. Base HTML references:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

For every index response, Tokyo-worker lists the exact stored overlay
coordinates and authors the base locale plus those coordinates as the public
switcher's options. For `?locale=`, it reads the exact trusted overlay and
applies it to the declared semantic HTML content slots at the Edge, then returns
complete selected-locale HTML through the existing public cache policy. The
locale query is part of the request cache coordinate. Stylesheet and
interaction-runtime URLs remain identical, and no locale-derived package is
stored. Missing locale truth is `404` and never falls back to base content. An actual R2 read or
JSON-decode failure remains explicit; Tokyo does not revalidate the stored
overlay against another Clickeen artifact on every request. Because the option
set appears in every index response, Publish, unpublish, Delete, and overlay
mutation purge the instance's one exact Cloudflare URL prefix after the owning
truth mutation. The prefix is the configured public-serving host plus the
exact account/instance path and covers every package path and locale/query
variant.

Current cloud-dev implementation: public serving trusts every current Widget's Roma
package and exact overlay, then uses Cloudflare `HTMLRewriter` over materialized
stable-identity `data-ck-content-path` slots and sets `<html lang>` before
JavaScript. An authored `data-ck-content-attribute` names the exact HTML
attribute target; otherwise Tokyo replaces inner content. It does not compare
a package/source fingerprint, inject browser locale context, or revalidate
overlay meaning. The deployment and live cloud-dev serving checks pass; owner
QA remains pending.

## Static Read Paths

| Friendly path | Canonical R2 root |
| --- | --- |
| `/widgets/**` | `product/widgets/**` |
| `/dieter/icons/svg/**` | `dieter/icons/svg/**` |
| `/fonts/special/**` | `fonts/special/**` |
| `/assets/account/**` | account asset reads allowed by Tokyo-worker |
| `/prague/l10n/**` | Prague l10n static path |
| `/prague/assets/**` | Prague static assets |

Friendly paths are routes, not storage roots.

## Operator Commands

```bash
pnpm tokyo:r2:sync:check
pnpm cf:preflight
```

Product-root deployment runs through GitHub Actions `cloud-dev workers deploy`.
Remote R2 operations must use the repo paths documented in
`documentation/engineering/CloudflareOperations.md`.

## Hard Stops

Stop if a change would:

- write git-authored product artifacts into `accounts/`;
- write account runtime artifacts into `dieter/`, `fonts/`, `product/`, or `prague/`;
- introduce a second artifact root for one instance;
- use UUID account folders;
- treat Prague translations as account instance overlays;
- treat Tokyo storage/serving as account-policy authority;
- add Widget-specific semantics or a Widget-name branch;
- revalidate, fingerprint, filter, normalize, compare, or repair artifacts
  produced by another Clickeen authority;
- defer initial base or selected-locale content to client JavaScript;
- substitute base content for requested translated content.
