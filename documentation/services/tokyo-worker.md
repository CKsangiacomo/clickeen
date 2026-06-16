# Tokyo-worker - R2 Boundary

Tokyo-worker is the Tokyo R2 boundary for account runtime data, account assets,
saved widget instances, translated locale values, page source, generated public
packages, and public artifact serving.

Tokyo-worker stores and serves bytes. Roma owns account product decisions.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/architecture/CloudflareOperations.md`

## Product Role

Tokyo-worker receives an already-authorized product operation from Roma, proves
that the operation addresses the account path named by the Roma account context,
then reads or writes the exact R2 objects for that operation.

Tokyo-worker owns:

- account asset R2 operations
- account widget instance R2 operations
- translated locale value R2 operations
- page source and page package R2 operations
- public package readiness checks
- `clk.live` and `dev.clk.live` static artifact serving

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
metadata, locale metadata, and timestamps.

`instance.content.json` carries base user-visible text values.

`overlays/locales/{locale}.json` carries durable translated values for one
target locale.

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

Roma owns page product operations. Tokyo-worker stores the source, package, and
serve state under the account path Roma names.

## Public Serving

Production public serving uses:

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/pages/{pageId}
```

Cloud-dev public serving uses:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

Serving reads generated package files from the account folder after the serve
state for that instance or page is published.

Public support files are:

- `styles.css`
- `runtime.js`

Private source and state files remain private account storage.

## Private Roma Routes

Roma reaches Tokyo-worker through private Cloudflare service bindings for
product-control operations. The request carries the Roma account authz capsule
and the account public id.

Product-control routes cover:

- widget definition reads
- account instance list/open/create/save/rename/delete
- publish and unpublish
- translated locale reads and writes
- translation generation handoff
- account asset list/upload/resolve/delete
- page source/package/serve-state operations

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

## Translation Jobs

Tokyo-worker owns the account-instance translation job producer. Generate
translations reads the saved base content, editable-field contract, locale
overlays, current markers, and account policy supplied through Roma, then
produces jobs for San Francisco.

San Francisco completion writes durable translated values back through the
Tokyo account-instance locale boundary.

## DevOps

Tokyo-worker deploys through the GitHub Actions Cloudflare Workers workflow for
cloud-dev workers. Tokyo product roots in R2 sync through the same workflow.

Before any manual Tokyo/R2 operation, run:

```bash
pnpm cf:preflight
```

Cloudflare/R2 evidence comes from the repo commands documented in
`documentation/architecture/CloudflareOperations.md`.
