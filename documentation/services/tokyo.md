# Tokyo - R2 Storage And Static Deploy Contract

STATUS: CURRENT SYSTEM OPERATOR SPEC

Tokyo is the storage and static-serving plane. Tokyo is not an editor, account
authority, page builder, translation authority, or AI runtime.

Tokyo has two forms:

- `tokyo/`: git-authored product/static artifacts;
- `tokyo-worker/`: Cloudflare Worker controlling account R2 operations and
  public reads.

## R2 Root Contract

```text
accounts/   runtime-managed account storage
dieter/     git-authored shared SVG icon media
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
  pages/{pageId}/
    source.json
    serve-state.json
    overlays/locales/{locale}.json
    overlays.json
    index.html
    styles.css
    runtime.js
```

Rules:

- `accountPublicId` and `instanceId` are stable compact coordinates.
- Widget codes and display names are metadata, not folders.
- Overlay JSON is durable translated value truth.
- Each instance has one root browser artifact.
- Tokyo-worker stores exact submitted root bytes. It does not compile,
  translate, infer, or repair them.
- A locale never owns HTML, CSS, JavaScript, publication state, or another
  artifact root.
- An ordinary Page has one direct stored file set. First Save is unpublished;
  later Save preserves publication state. Publish requires all six root
  artifacts to parse through their storage contracts, but does not render-test,
  compile, or translate them.

## Public Serving

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
https://clk.live/{accountPublicId}/pages/{pageId}
https://clk.live/{accountPublicId}/pages/{pageId}/{locale}
```

Cloud-dev uses `https://dev.clk.live`.

Tokyo-worker serves a published instance only after the publication state and
all three exact package files pass their storage contract. Root HTML references:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

For `?locale=`, Tokyo-worker reads and validates the exact overlay against
saved instance content and replaces field-marked values in the root index
response. Completed Instance HTML revalidates through its exact public URL
cache key. `runtime.js` binds behavior and does not apply overlays. Missing
locale truth is `404`; corrupt locale truth is `500`; neither falls back to
base content.

For Pages, the stable URL redirects with `no-store` to one locale from the
saved set. The exact-locale URL is the HTML cache key. Tokyo-worker uses stored
base index values for the base locale and the matching root `overlays.json`
entry only for a non-base locale, then completes public Page coordinates. It
does not traverse child Instances or call a generator/model. Because the root
serving-overlay document is validated as a whole, one malformed locale entry
makes every Page route unavailable. Page CSS/runtime files are shared across
locales. Page Save while published, Publish, Unpublish, and Delete purge only
affected exact-locale and support-file URLs.

## Static Read Paths

| Friendly path | Canonical R2 root |
| --- | --- |
| `/widgets/**` | `product/widgets/**` |
| `/clickeen.js` | `product/clickeen.js` |
| `/dieter/icons/svg/**` | `dieter/icons/svg/**` |
| `/i18n/**` | `product/roma/i18n/public/**` |
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
`tokyo/product/clickeen/clickeen.js` syncs to `product/clickeen.js`; a change to
that source path triggers the same product-root sync.
Remote R2 operations must use the repo paths documented in
`documentation/engineering/CloudflareOperations.md`.

## Hard Stops

Stop if a change would:

- write git-authored product artifacts into `accounts/`;
- write account runtime artifacts into `dieter/`, `product/`, or `prague/`;
- introduce a second artifact root for one instance;
- use UUID account folders;
- treat Prague translations as account instance overlays;
- treat Tokyo storage/serving as account-policy authority;
- substitute base content for requested translated content.
