# Overlay Architecture

STATUS: CURRENT SYSTEM OPERATOR SPEC

Translation overlays are Babel locale value files for account-owned artifacts.
For the Babel protocol contract, see [BabelProtocol.md](./BabelProtocol.md).

## Product Rule

The Translation Agent writes localized values for the account's active non-base
locales. Tokyo-worker stores the exact files in R2. Bob and Roma read the exact
files that exist for the account instance.

Public `clk.live` serves published package bytes from Tokyo-worker. It does not
read locale overlay files or interpret a requested locale into translated
output. Explicit locale URLs serve generated locale package bytes already
stored beside the source and overlay.

There is no separate lifecycle layer, fallback locale, compatibility wrapper,
readiness field, or status file.

## Storage

Account-instance locale overlay files live under the owning account instance:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Generated locale package artifacts live beside the instance source:

```text
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/index.html
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/runtime.js
```

The file body is only the translated value map:

```json
{
  "values": {
    "[field path]": "[translated value]"
  }
}
```

The account, instance, and locale coordinates come from the storage path and the
operation being executed. They are not repeated inside the file body.

## Field Authority

Product widget software declares translatable fields in:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Saved account instance content provides the current write/read authority:

```text
accounts/{accountPublicId}/instances/{instanceId}/instance.content.json
source.content.fields
```

Roma generation and Tokyo-worker write/read/list validation use the saved field
map for that instance. Missing paths and unexpected paths fail.

Repeatable declaration paths are extraction instructions. Runtime overlay files
use concrete paths such as:

```text
sections.0.faqs.0.question
```

## Runtime Rule

The runtime applies one locale value map to the base widget configuration:

```text
resolveTranslatedValues(baseConfig, translatedValues)
```

The resolver applies the exact translated value map to the exact base config. It
does not accept precedence stacks, status fields, freshness metadata, fallback
values, or producer-specific shapes.

## Current Operations

| Operation | Route | Role/boundary | Owner |
| --- | --- | --- | --- |
| List instance overlays | `GET /api/account/instances/{instanceId}/translations` | `viewer` | Roma product route |
| Read one overlay | `GET /api/account/instances/{instanceId}/translations/{locale}` | `viewer` | Roma product route |
| Generate active non-base locale overlays | `POST /api/account/instances/{instanceId}/translations/generate` | `editor` | Roma + Translation Agent |
| Save active locales | `PUT /api/account/locales` | `admin` | Roma account settings route |
| List stored overlays | `GET /__internal/instances/{instanceId}/translations` | `viewer` | Tokyo-worker internal route |
| Read exact overlay | `GET /__internal/instances/{instanceId}/translations/{locale}` | `viewer` | Tokyo-worker internal route |
| Write exact overlay | `PUT /__internal/instances/{instanceId}/translations/{locale}` | Translation Agent grant | Tokyo-worker internal route |
| Delete exact overlay | `DELETE /__internal/instances/{instanceId}/translations/{locale}` | `admin` | Tokyo-worker internal route |
| Write generated locale package | `PUT /__internal/instances/{instanceId}/locales/{locale}/package` | Roma account capsule | Tokyo-worker internal route |
| Delete generated locale package | `DELETE /__internal/instances/{instanceId}/locales/{locale}/package` | Roma account capsule | Tokyo-worker internal route |

Write boundary:

- Roma resolves account active locales and mints the Translation Agent grant.
- Translation Agent generates translated values and writes with `x-ck-ai-grant`.
- Tokyo-worker verifies the grant and writes only the exact locale overlay
  allowed by the operation.
- After overlay generation succeeds, Roma reads the exact overlay through
  Tokyo-worker, materializes generated locale package bytes, and writes those
  bytes back through Tokyo-worker with the Roma account capsule.

## Active Locale Changes

Active locales are the locales the user wants their account widgets and pages
displayed in. Available locales come from the account tier. Active locales are
the user's account setting.

When active locales shrink:

```text
Roma saves activeLocales first
-> Roma asks Tokyo-worker to delete overlay files for removed locales
-> Tokyo-worker deletes exact files
-> Roma asks Tokyo-worker to delete generated locale package files for removed locales
```

When active locales expand:

```text
Roma saves activeLocales first
-> Roma asks Translation Agent to generate overlays for added locales
-> Translation Agent writes exact files through Tokyo-worker
-> Roma materializes generated locale package files for the same added locales
```

Tokyo-worker does not infer why a locale was added or removed. It stores,
reads, and deletes exact files.

If overlay follow-up fails after the settings write, Roma reports
`overlayUpdate.ok: false`. The account active locale setting remains the saved
account setting; the failed overlay operation is explicit follow-up failure.

## Failure Semantics

| Case | Result |
| --- | --- |
| Missing overlay | read returns `404` |
| Invalid overlay document | read/list/write validation fails |
| Missing or unexpected overlay keys | validation fails |
| No active non-base locales | generation returns `accepted: false` |
| Invalid Translation Agent grant | write fails |
| Tokyo write rejection | generation fails for that locale |
| Locale package write rejection | generation response includes completed/skipped/failed package coordinates and full success is not claimed |
| Source save locale package failure | source/base package remains saved; source-save response includes `sourceSaved: true`, `ok: false`, and exact `localeCascade` failure coordinates |
| Failure after earlier locale writes | prior files remain; full success must not be claimed |

## Command-Owned Cascade

Cascade is owned by the command that changed source truth:

```text
source command changes truth -> same command names affected artifact coordinates
```

For current account widget instances, Roma source save writes the source and base
package first. If active non-base locales exist, the same save command then
regenerates those locale overlays through Translation Agent and materializes
their stored locale packages. The synchronous cost surface is one instance times
active non-base locales, bounded by the active locale entitlement. If follow-up
fails, the response names completed, skipped, and failed coordinates. The system
does not create a dependency graph, watcher, queue, readiness marker, status
file, visitor-time resolver, or fallback base package to pretend stale locale
artifacts are current.

## Verification

| Concern | Verification |
| --- | --- |
| Account active locale setting | `GET /api/account/locales` |
| Product-visible overlays | Roma translations routes or Bob Translations panel |
| Stored overlay bytes | R2 evidence at `accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json` after `pnpm cf:preflight` |
| Generated locale package bytes | R2 evidence at `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/` after `pnpm cf:preflight` |
| Missing removed locale | exact overlay file is absent |
| Added locale generation | exact overlay file exists with complete `{ "values": ... }` map |
| Public runtime | base URL serves base stored package bytes; explicit locale URL serves matching stored locale package bytes or `404 Locale not available` |

Verification must not create marker files, readiness fields, lifecycle ledgers,
fallback locale behavior, or repair jobs. The overlay file is the product
artifact.
