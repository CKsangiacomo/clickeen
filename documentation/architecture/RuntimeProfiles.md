# Runtime Profiles

Last updated: 2026-08-16

## Canonical Runtime Surfaces

| Surface | Runtime truth |
| --- | --- |
| Bob preview | deploy-built Widget software plus one in-memory draft; never an account instance's stored public package |
| Published instance | one stored base package whose `index.html` contains complete semantic base content, plus complete `styles.css` and mandatory `runtime.js` |
| Localized saved instance | the same base package plus one exact stored overlay, expressed as semantic localized response HTML before JavaScript |

## Package Generation Authority

One saved instance is one complete logical state containing shared
Header/Stage/Pod/capability values plus the Widget's Core values. Bob edits that
state in browser memory and previews it from the deploy-built Widget software.
Builder open and Workspace preview do not read or execute stored public package
files. Create writes the first editable source and Save
updates that source. Only explicit allowed Publish invokes Roma's one
Widget-neutral `@clickeen/ck-runtime-materializer`; it is the sole generator of
the served `index.html`, `styles.css`, and `runtime.js`. Tokyo-worker only
physically writes and serves those exact bytes.

```text
Widget/shared source + exact saved instance state + allowed Publish
-> Roma materializer
-> public package bytes
-> Tokyo-worker R2 write
-> Edge delivery
```

## Local Runtime Rule

Local app commands are isolated debugging only. Cloud-dev Pages and Worker
surfaces are deployment truth.

## Tokyo-worker Runtime Boundary

Tokyo-worker owns public instance delivery:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}?locale={locale}
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

The locale query does not identify another artifact. It selects one exact
overlay for the base package. Tokyo-worker resolves the public route and
publication gate, trusts the Tokyo-owned package and Translation-Agent overlay,
and applies the exact overlay into the semantic HTML response. It does not
revalidate package fingerprints, overlay shape, or saved-field equality.

## Storage Runtime

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  index.html
  styles.css
  runtime.js
  serve-state.json
  overlays/locales/{locale}.json
```

The two source files are one logical instance: config carries exact
non-translatable state and content carries exact base-locale customer text.
Roma recomposes them for Bob and Publish materialization. They are not alternate
packages, and Tokyo-worker does not derive the public files from them.

The base index contains complete semantic base content and stable exact
localization coordinates. Tokyo-worker applies base or translated values to the
HTML response before delivery. Package support URLs never vary by locale.
Mandatory `runtime.js` owns Widget and shared visitor behavior; it is not the
initial-content renderer, materializer, localizer, host, validator, or serving engine.

## Failure Rule

- unpublished instance: `404`;
- missing requested overlay: `404 Locale not available`;
- exact requested overlay cannot be read or applied: `500 Locale data invalid`;
- no requested non-base locale may render base content.

## Local All-Widget Implementation State

All five current Widget paths now use this profile locally:

- Builder open carries saved source and compiled Widget software, not a public
  package or package fingerprint;
- Workspace renders Bob's current draft without executing stored
  `runtime.js`;
- explicit Publish alone generates the three package files;
- public serving reads publication truth and the exact stored object; and
- every public index response authors switcher options from the exact base
  locale and stored overlay coordinates; and
- a selected non-base locale is expressed with Cloudflare `HTMLRewriter` over
  exact stable-identity `data-ck-content-path`/`data-ck-content-mode` slots,
  with `data-ck-content-attribute` when the authored target is an HTML
  attribute, and sets `<html lang>` before JavaScript.

The public route coordinate, locale syntax, and publication state remain real
external/product gates. The implementation does not use them to revalidate
Roma's package or Translation Agent's overlay. Cloud-dev deployment and live
verification completed for product commit `e2ac3589`; owner QA remains pending.

## Verification

- Git state: local `main`, tracking branch, and GitHub `main`.
- Worker state: GitHub Actions deploy for the exact SHA.
- Base runtime: base and locale response HTML contains semantic content before
  JavaScript and references identical support URLs.
- Overlay behavior: changing one overlay changes that locale response HTML and
  the exact switcher option set authored into every index response; one
  exact instance URL-prefix purge covers every package path and query variant.
- R2: exactly one base artifact set and overlay JSON; no locale-derived runtime
  objects.
