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
| Roma Translation Agent binding helper | `roma/lib/translation-agent-control.ts` |
| Bob user panel | `bob/components/TranslationsPanel.tsx` |
| Translation Agent Worker | `agents/translation-agent/src/worker.ts` |
| Translation Agent planning/safety | `agents/translation-agent/src/index.ts` |
| Tokyo internal translation route | `tokyo-worker/src/routes/internal-translation-routes.ts` |
| Tokyo overlay value storage | `tokyo-worker/src/domains/account-translations/values.ts` |
| Tokyo overlay document helpers | `tokyo-worker/src/domains/account-translations/overlays.ts` |
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
    "deleted": [{ "instanceId": "[instance id]", "locale": "[removed locale]" }],
    "generated": [{ "instanceId": "[instance id]", "locales": ["[added locale]"] }],
    "skipped": [
      {
        "instanceId": "[instance id]",
        "locales": ["[added locale]"],
        "reasonKey": "[reason key]",
        "detail": "[detail]"
      }
    ]
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
    "deleted": [],
    "generated": [],
    "skipped": [],
    "error": {
      "kind": "UPSTREAM_UNAVAILABLE",
      "reasonKey": "[reason key]",
      "detail": "[detail]"
    }
  }
}
```

When active locales shrink, Roma saves the account setting first and then asks
Tokyo-worker to delete exact overlay files for removed locales. When active
locales expand, Roma saves the account setting first and then asks the
Translation Agent to generate overlays for added locales.

If overlay follow-up fails after the settings write, Roma reports
`overlayUpdate.ok: false`. The saved account locale setting remains the account
truth; the failed overlay operation is explicit follow-up failure.

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
| Agent execution | `POST /translate-instance` | Translation Agent Worker |
| List stored overlays | `GET /__internal/instances/{instanceId}/translations` | `viewer` internal |
| Read/write/delete overlay | `GET/PUT/DELETE /__internal/instances/{instanceId}/translations/{locale}` | viewer / grant / admin |

Write boundary:

- Roma mints the Translation Agent grant.
- Translation Agent verifies the grant.
- Translation Agent calls San Francisco for governed model execution.
- Translation Agent writes through Tokyo-worker with `x-ck-ai-grant`.
- Tokyo-worker verifies the grant and accepts only locales carried by the grant.

Bob's current Translations panel displays request state and final generated
active-locale counts. It does not receive a per-locale streaming progress event
from the Translation Agent in current code.

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
```

Public serving reads generated package files such as:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
```

Locale overlays are private translated value source for account operations.
They are not visitor files.

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
| Translation Agent runtime | `pnpm e2e:smoke:translation-agent-runtime` |
| Public static serving | `https://dev.clk.live/{accountPublicId}/{instanceId}` |
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
