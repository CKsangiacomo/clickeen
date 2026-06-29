# Localization Capability

STATUS: CURRENT SYSTEM OPERATOR SPEC

Localization is the account capability that turns saved source text into Babel
locale overlays through the Translation Agent.

Core contract:

```text
source artifact + locale value overlay = localized artifact
```

Babel owns the translated-locale value protocol. Overlay Architecture owns the
account-instance overlay storage and operation rules. This page explains how the
capability is operated.

References:

- `documentation/architecture/BabelProtocol.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/ai/agents/translation-agent.md`
- `documentation/ai/sanfrancisco.md`

## Code Authority

| Concern | File |
| --- | --- |
| Account locale settings route | `roma/app/api/account/locales/route.ts` |
| Account locale entitlement helper | `roma/lib/account-locale-entitlements.ts` |
| Account locale state loader | `roma/lib/account-locales-state.ts` |
| Account active-locale storage helper | `roma/lib/account-active-locales-storage.ts` |
| Account base-locale lock helper | `roma/lib/account-base-locale-lock.ts` |
| Roma translation routes | `roma/app/api/account/instances/[instanceId]/translations/**` |
| Roma translation helpers | `roma/lib/account-instance-translations.ts` |
| Roma locale package materialization | `roma/lib/account-instance-locale-package.ts` |
| Roma Translation Agent binding helper | `roma/lib/translation-agent-control.ts` |
| Bob user panel | `bob/components/TranslationsPanel.tsx` |
| Translation Agent Worker | `agents/translation-agent/src/worker.ts` |
| Translation Agent planning/safety | `agents/translation-agent/src/index.ts` |
| Tokyo internal translation route | `tokyo-worker/src/routes/internal-translation-routes.ts` |
| Tokyo overlay value storage | `tokyo-worker/src/domains/account-translations/values.ts` |
| Tokyo overlay document helpers | `tokyo-worker/src/domains/account-translations/overlays.ts` |
| Tokyo generated locale package storage | `tokyo-worker/src/domains/account-instances/package-files.ts` |
| Locale registry/helpers | `packages/l10n/` |

## Authority Chain

| Concern | Authority |
| --- | --- |
| Current account and active locale settings | Roma |
| Available locale cap | account tier through `l10n.locales.max` |
| Source text field map | saved account instance content |
| Translation reasoning | Translation Agent Worker |
| Model execution | San Francisco `/model/chat` |
| Overlay storage | Tokyo-worker over Tokyo R2 |
| Generated locale package storage | Tokyo-worker over Tokyo R2 |
| Builder display/action | Bob Translations panel |
| Public static serving | Tokyo-worker generated package serving |

The available locale catalog comes from `@clickeen/l10n` and
`packages/l10n/locales.json`. Account policy caps how many translated locales
the account may activate. Active locales are the locales the user selected in
account settings. The base locale is not generated as an overlay.

## Locale Policy

The current locale entitlement key is:

```text
l10n.locales.max
```

The base locale is implied and not counted against this limit. Roma rejects
active translated locales above the account plan limit before saving account
locale settings.

Account locale settings are read and written through:

| Operation | Route | Role |
| --- | --- | --- |
| Read account locale settings | `GET /api/account/locales` | `viewer` |
| Save account locale settings | `PUT /api/account/locales` | `admin` |

Read response:

```json
{
  "accountId": "[account id]",
  "activeLocales": ["[active locale]"],
  "localePolicy": {
    "baseLocale": "[base locale]",
    "ip": {
      "countryToLocale": {
        "[country code]": "[locale]"
      }
    }
  },
  "baseLocaleLocked": true
}
```

Save response:

```json
{
  "accountId": "[account id]",
  "activeLocales": ["[active locale]"],
  "localePolicy": {
    "baseLocale": "[base locale]",
    "ip": {
      "countryToLocale": {
        "[country code]": "[locale]"
      }
    }
  },
  "overlayUpdate": {
    "ok": true,
    "instancesChecked": 0,
    "cost": {
      "instances": 0,
      "changedLocales": 0,
      "coordinates": 0,
      "configuredActiveLocaleCap": 3,
      "hostCommandTimeoutMs": 120000
    },
    "deleted": [{ "instanceId": "[instance id]", "locale": "[removed locale]" }],
    "generated": [{ "instanceId": "[instance id]", "locales": ["[added locale]"] }],
    "skipped": [
      {
        "instanceId": "[instance id]",
        "locales": ["[added locale]"],
        "reasonKey": "[reason key]",
        "detail": "[detail]"
      }
    ],
    "localePackages": {
      "deleted": [{ "accountId": "[account public id]", "instanceId": "[instance id]", "locale": "[removed locale]" }],
      "generated": [
        {
          "accountId": "[account public id]",
          "instanceId": "[instance id]",
          "locale": "[added locale]",
          "publicPackageFingerprint": "sha256:[fingerprint]"
        }
      ],
      "skipped": []
    }
  }
}
```

If overlay follow-up fails after the setting is saved, the same response uses
`overlayUpdate.ok: false` and includes the explicit failure:

```json
{
  "overlayUpdate": {
    "ok": false,
    "instancesChecked": 1,
    "cost": {
      "instances": 1,
      "changedLocales": 1,
      "coordinates": 1,
      "configuredActiveLocaleCap": 3,
      "hostCommandTimeoutMs": 120000
    },
    "deleted": [],
    "generated": [],
    "skipped": [],
    "localePackages": {
      "deleted": [],
      "generated": [],
      "skipped": []
    },
    "error": {
      "kind": "UPSTREAM_UNAVAILABLE",
      "reasonKey": "[reason key]",
      "detail": "[detail]"
    }
  }
}
```

When active locales shrink, Roma saves the account setting first and then asks
Tokyo-worker to delete exact overlay files and generated locale package files
for removed locales. When active locales expand, Roma saves the account setting
first, asks the Translation Agent to generate overlays for added locales one
locale at a time, then materializes generated locale package bytes for those
same locales. Per-locale execution prevents a batch failure from being assigned
to an inferred locale.

If overlay follow-up fails after the settings write, Roma reports
`overlayUpdate.ok: false`. The saved account locale setting remains the account
truth; the failed overlay operation is explicit follow-up failure.
Generated locale package failures use the same explicit follow-up channel and
include completed, skipped, and failed locale coordinates. `overlayUpdate.cost`
records the synchronous coordinate surface as saved instance id count times
changed non-base locale count; it is command evidence, not a status ledger.
Roma gets that count from Tokyo-worker's account instance coordinate list. It
does not open list-facts rows and does not call a separate account instance
facts route for locale fan-out or base-locale lock.

## Runtime Dependencies

| Surface | Required binding/secret/env | Purpose |
| --- | --- | --- |
| Roma | `TRANSLATION_AGENT` service binding | calls Translation Agent `/translate-instance` |
| Roma | `TOKYO_PRODUCT_CONTROL` service binding | reads source and lists/reads/deletes overlays |
| Roma | `AI_GRANT_HMAC_SECRET` | mints Translation Agent grant |
| Roma | `SUPABASE_SERVICE_ROLE_KEY` | saves account locale settings |
| Translation Agent | `AI_GRANT_HMAC_SECRET` | verifies Roma grant |
| Translation Agent | `SANFRANCISCO_AI_ENGINE` service binding | calls San Francisco `/model/chat` |
| Translation Agent | `TOKYO_PRODUCT_CONTROL` service binding | writes overlay value files |
| Tokyo-worker | `AI_GRANT_HMAC_SECRET` | verifies `x-ck-ai-grant` on Translation Agent writes |

## Source Text

Widget software declares translatable fields in:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Saved account instance content provides the current source field map:

```text
accounts/{accountPublicId}/instances/{instanceId}/instance.content.json
source.content.fields
```

Repeatable field declarations expand before translation work. Producers receive
exact field paths such as:

```text
sections.0.faqs.0.question
sections.0.faqs.0.answer
```

No producer receives wildcard, glob, template, storage path, or sidecar paths.

## Operator Recipes

### Generate Translations For One Saved Instance

1. Confirm the user is in Roma current account context.
2. Confirm the instance exists under the current account.
3. Call:

```text
POST /api/account/instances/{instanceId}/translations/generate
```

4. Roma loads current active locales, excludes the base locale, and calls the
   Translation Agent only when non-base active locales remain.
5. Success means every requested active locale was translated and written by
   Tokyo-worker.
6. If the response has `accepted: false`, there was no non-base active locale
   to generate.

### Refresh Locale Packages For Existing Translations

1. Confirm the user is in Roma current account context.
2. Confirm the instance exists under the current account.
3. Call:

```text
POST /api/account/instances/{instanceId}/translations/packages
```

Optional body for an explicit coordinate subset:

```json
{
  "locales": ["es", "fr"]
}
```

4. Roma reads current active non-base locales, saved source, and existing
   translation overlays.
5. If `locales` is present, every requested locale must already be an active
   non-base locale for the account.
6. Roma materializes locale package bytes and writes them through Tokyo-worker.
7. This operation does not call the Translation Agent and does not generate,
   regenerate, or rewrite translated text.

### Inspect Stored Translation Values

1. List summaries:

```text
GET /api/account/instances/{instanceId}/translations
```

2. Read one overlay:

```text
GET /api/account/instances/{instanceId}/translations/{locale}
```

3. For raw storage evidence, use R2 after `pnpm cf:preflight` and inspect:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Command path:

```bash
pnpm cf:preflight
pnpm cf:r2:get accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

### Change Account Active Locales

1. User saves active locales in Roma Settings:

```text
PUT /api/account/locales
```

2. Roma writes account settings first.
3. Removed active locales delete exact overlay files through Tokyo-worker.
4. Added active locales generate overlays through the Translation Agent for
   saved account instances.
5. A follow-up failure returns `overlayUpdate.ok: false`; the account locale
   setting remains saved and is the account truth.

## Translation Generation

User flow:

```text
Bob Translations panel
-> Roma account translation route
-> Translation Agent Worker /translate-instance
-> San Francisco /model/chat
-> Tokyo-worker internal overlay write
-> accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Generation routes:

| Operation | Route | Role/boundary |
| --- | --- | --- |
| List instance translations | `GET /api/account/instances/{instanceId}/translations` | `viewer` |
| Read one translation | `GET /api/account/instances/{instanceId}/translations/{locale}` | `viewer` |
| Generate active non-base translations | `POST /api/account/instances/{instanceId}/translations/generate` | `editor` |
| Refresh generated packages from existing translations | `POST /api/account/instances/{instanceId}/translations/packages` | `editor` |
| Agent execution | `POST /translate-instance` | Translation Agent Worker |
| List stored overlays | `GET /__internal/instances/{instanceId}/translations` | `viewer` internal |
| Read/write/delete overlay | `GET/PUT/DELETE /__internal/instances/{instanceId}/translations/{locale}` | viewer / grant / admin |

Write boundary:

- Roma mints the Translation Agent grant.
- Translation Agent verifies the grant.
- Translation Agent calls San Francisco for governed model execution.
- Translation Agent writes through Tokyo-worker with `x-ck-ai-grant`.
- Tokyo-worker verifies the grant and accepts only locales carried by the grant.

Bob's current Translations panel displays request state, transient Roma
Agent Activity rows authored by Translation Agent while it writes overlays. The
rows are live narration from the agent to the user. They are not stored status,
polling, a package/materializer lifecycle, or Roma/Bob-authored summaries.
Bob can preview a selected generated locale in the widget preview, but it does
not expose user translation overrides, a field-level overlay editor, or a
read-only overlay value dump. Overlay values remain generated artifacts owned by
Translation Agent and Tokyo-worker authority.

## Overlay Contract

The durable overlay body is:

```json
{
  "values": {
    "[field path]": "[translated value]"
  }
}
```

The account, instance, and locale coordinates come from the operation/path. They
are not repeated inside the file body.

Tokyo-worker validates overlay values against the saved instance text field set
on write, read, and list. Missing paths and unexpected paths fail.

## Failure Semantics

| Case | Result |
| --- | --- |
| Base locale requested for generation | not generated as overlay |
| No active non-base locales | generation returns `accepted: false` |
| Invalid Translation Agent grant | write fails |
| Missing or unexpected overlay keys | validation fails |
| Missing overlay | read returns `404` |
| Failure after earlier locale writes | prior files remain; full success must not be claimed |
| Source save with stale translations | source/base save remains save truth; translation update is an explicit Translations panel operation |
| Account locale follow-up failure | settings save remains; response reports `overlayUpdate.ok: false` |
| Translation Agent binding missing | Roma returns explicit upstream failure |
| San Francisco/model failure | Translation Agent/Roma return explicit failure; no full success |
| Tokyo write rejection | Translation Agent/Roma return explicit failure; no full success |

## Public Serving Boundary

Current public widget serving is generated static artifact delivery. Public
visitor requests do not read locale overlay files and do not compose
translations at request time.

Public coordinates:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}
```

Public serving reads generated package files such as:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/index.html
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/runtime.js
```

Locale overlays are private translated value source for account operations.
They are not visitor files. Explicit locale public URLs serve generated locale
package bytes only after Tokyo-worker verifies the instance is published and all
three locale package files carry matching coordinate, source timestamp, package
fingerprint, and materializer contract metadata. Missing, stale, malformed, or
mismatched locale packages return `404 Locale not available` with `no-store`
cache headers. Public serving does not fall back to base content for locale
URLs.

Saved source changes do not generate or regenerate translations. Roma source
save persists the source and base package, then returns source-save truth.
Translation update remains an explicit operation from Bob's Translations panel
through Roma's translation route and the Translation Agent. After accepted
overlay generation, the translation route materializes matching locale package
bytes for the generated locales and reports exact `localePackages` coordinates
if package write or public cache refresh fails. Bob may surface
stale-translation attention only from exact stale-translation evidence; it must
not infer that state from runtime package probes, active locale count alone, or
hidden UI-authored status. No background job, status ledger, public runtime
repair, or base-content fallback completes translation work later.

Locale package refresh from existing overlays is separate from translation
generation. It rematerializes package bytes when saved source, widget runtime
software, or runtime materializer behavior changes. It preserves translated
overlay values and reports package/cache failures as locale package failures,
not as translation generation failures. The optional `locales` body narrows the
same synchronous operation to named active locales; it does not create a queue,
status ledger, background job, or retry subsystem.

## Prague Boundary

Prague page translations are page-owned content beside Prague page JSON. They
are separate from account instance Babel overlays.

Current Prague translation file shape:

```text
tokyo/prague/pages/{widget}/{page}.translations/{locale}.json
```

Prague embeds account widgets only through public published artifact URLs.

Operator caveat: current Cloudflare worker deploy does not automatically sync
`tokyo/prague/**` changes by default. See
`documentation/engineering/CloudflarePagesCloudDevChecklist.md` before relying
on Prague translation file changes in cloud-dev.

## Verification

| Concern | Verification |
| --- | --- |
| Account locale settings | `GET /api/account/locales` |
| Product-visible translations | Roma translation routes or Bob Translations panel |
| Stored overlay bytes | `pnpm cf:preflight` then `pnpm cf:r2:get accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json` |
| Generated locale package bytes | `pnpm cf:preflight` then R2 evidence at `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/index.html`, `styles.css`, and `runtime.js` |
| Translation Agent runtime | `pnpm e2e:smoke:translation-agent-runtime` |
| Public static serving | `https://dev.clk.live/{accountPublicId}/{instanceId}` and explicit `/locales/{locale}` URL |
| Worker deploy evidence | GitHub Actions `cloud-dev workers deploy` |

## Not Current Product Truth

- Public request-time translation composition.
- Fallback locale serving as if the requested locale existed.
- Translation lifecycle metadata inside overlay bodies.
- Selected-locale or selected-overlay pointers as product truth.
- Widget `localization.json`.
- `textPack`.
- `L10nOp`.
- Root `published/`, root `public/`, or root `l10n/` lookup folders as
  localization authority.
