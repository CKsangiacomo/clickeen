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
- Overlay JSON is durable translated value truth.
- Each instance has one base browser artifact.
- Tokyo-worker stores exact submitted base bytes. It does not compile,
  translate, infer, or repair them.
- A locale never owns HTML, CSS, JavaScript, publication state, or another
  artifact root.

## Public Serving

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

Cloud-dev uses `https://dev.clk.live`.

Tokyo-worker serves a published instance only after base package fingerprint
checks pass. Base HTML references:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

For `?locale=`, Tokyo-worker reads and validates the exact overlay against
saved instance content, injects it into the base index response, and uses
`no-store`. The base runtime resolves the overlay before widget modules start.
Missing locale truth is `404`; corrupt locale truth is `500`; neither falls
back to base content.

## Static Read Paths

| Friendly path | Canonical R2 root |
| --- | --- |
| `/widgets/**` | `product/widgets/**` |
| `/dieter/icons/svg/**` | `dieter/icons/svg/**` |
| `/fonts/special/**` | `fonts/special/**` |
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
- substitute base content for requested translated content.
