# Runtime Profiles

Last updated: 2026-08-18

## Canonical Runtime Surfaces

| Surface | Runtime truth |
| --- | --- |
| Bob preview | deploy-built Widget software plus one in-memory draft; never an account instance's stored public package |
| Published instance | one atomic serve-state whose logical `indexHtml` contains complete semantic base content, plus complete `stylesCss` and mandatory `runtimeJs` |
| Localized saved instance | the same base package plus one exact stored overlay, expressed as semantic localized response HTML before JavaScript |

## Package Generation Authority

One saved instance is one complete logical state containing shared
Header/Stage/Pod/capability values plus the Widget's Core values. Bob edits that
state in browser memory and previews it from the deploy-built Widget software.
Builder open and Workspace preview do not read or execute stored public package
files. New composes an unsaved draft without storage. First Save creates
editable source and later Save updates it. Only explicit allowed Publish invokes Roma's one
Widget-neutral `@clickeen/ck-runtime-materializer`; it is the sole generator of
the served `index.html`, `styles.css`, and `runtime.js`. Tokyo-worker stores
those exact logical members inside one atomic published `serve-state.json` and
serves them at the three public paths.

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
  instance.source.json
  serve-state.json
  overlays/locales/{locale}.json
```

`instance.source.json` atomically contains source metadata, exact config, and
exact base-locale content. First Save writes the initial unpublished
`serve-state.json` first and the source record last; only the exact source key
makes an instance visible. Save/Rename each replace source in one PUT.
Existing-instance Delete commits by deleting that source/visibility key. After
the Delete response exists, Tokyo schedules residual prefix cleanup through
`waitUntil`; any absent, failed, partial, or pending cleanup is product-inert,
and remaining bytes are unreachable and outside the account asset quota.

When published, `serve-state.json` atomically contains `status`, `publishedAt`,
and exact `publicPackage` members `indexHtml`, `stylesCss`, and `runtimeJs`.
There are no separate package objects or package/status split commit. The
public paths remain `/index.html`, `/styles.css`, and `/runtime.js`.

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
- explicit Publish alone generates the three logical package members;
- public serving reads publication truth and the exact stored object; and
- every public index response authors switcher options from the exact base
  locale and stored overlay coordinates; and
- a selected non-base locale is expressed with Cloudflare `HTMLRewriter` over
  exact stable-identity `data-ck-content-path`/`data-ck-content-mode` slots,
  with `data-ck-content-attribute` when the authored target is an HTML
  attribute, and sets `<html lang>` before JavaScript.

The public route coordinate, locale syntax, and publication state remain real
external/product gates. The implementation does not use them to revalidate
Roma's package or Translation Agent's overlay. The package/locale baseline was
deployed and live-verified at product commit `e2ac3589`. The corrected
New/first-Save/Roma-publication and product-inert cache-eviction flow is local
and uncommitted; cloud-dev deployment, live surface verification, and owner QA
remain pending.

## Verification

- Git state: local `main`, tracking branch, and GitHub `main`.
- Worker state: GitHub Actions deploy for the exact SHA.
- Base runtime: base and locale response HTML contains semantic content before
  JavaScript and references identical support URLs.
- Overlay behavior: changing one overlay changes that locale response HTML and
  the exact switcher option set authored into every index response; after the
  mutation Tokyo's default Worker entrypoint schedules the exact tagged
  eviction through `waitUntil`, and bounded `must-revalidate` freshness remains
  correct regardless of eviction outcome. Live purge success is not a product
  verification requirement.
- R2: exactly one atomic source record, one atomic serve-state, and exact
  overlay JSON; no separate package or locale-derived runtime objects.

The atomic source and published serve-state shapes are a pre-GA cutover. After
deployment, all legacy cloud-dev saved instances require an explicit source
cutover or recreation; any that should remain public then require explicit
Publish/Republish. There is no compatibility reader or migration-on-read. No
remote work or live verification was performed in this documentation pass.
