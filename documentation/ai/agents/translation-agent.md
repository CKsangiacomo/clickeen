# Translation Agent

STATUS: CURRENT SYSTEM OPERATOR SPEC

Translation Agent is the current account-widget translation agent home. It
translates saved account instance content into locale overlay files.

Code authority:

- `agents/translation-agent/`
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`
- `roma/lib/account-instance-translations.ts`
- `roma/lib/translation-agent-control.ts`
- `tokyo-worker/src/routes/internal-product-route-utils.ts`

## Runtime Coordinates

| Concern | Current value |
| --- | --- |
| Agent id | `widget.instance.translator` |
| Worker name | `translation-agent-dev` |
| Worker entrypoint | `agents/translation-agent/src/worker.ts` |
| Translation logic | `agents/translation-agent/src/index.ts` |
| Wrangler config | `agents/translation-agent/wrangler.toml` |
| Public worker URL | none; `workers_dev = false` |
| Inbound caller | Roma `TRANSLATION_AGENT` service binding |
| Model executor | San Francisco `SANFRANCISCO_AI_ENGINE` service binding |
| Write target | Tokyo-worker `TOKYO_PRODUCT_CONTROL` service binding |

## Ownership

| Authority | Owns |
| --- | --- |
| Roma | current account, tier, active locales, saved instance route, grant issuance |
| Translation Agent | translation planning, protected-token handling, model prompts, exact overlay value production |
| San Francisco | signed model execution and usage metadata |
| Tokyo-worker | account instance overlay file storage in R2 |
| Bob | user-facing Translations panel and request/result display |

Translation Agent does not own account permission, tier permission, active locale
selection, deletion, visitor runtime, or saved instance source truth.

## Product Triggers

Current generation route:

```text
POST /api/account/instances/{instanceId}/translations/generate
```

Roma loads current account locale state, excludes the base locale, enforces tier
locale entitlement, loads the saved instance source from Tokyo-worker, builds
translation items from saved `source.content.fields`, mints the Translation
Agent grant, and calls the Translation Agent service binding.

Locale removal is not Translation Agent work. Roma/Tokyo delete exact overlay
files for removed active locales.

## Roma Request Construction

Roma builds items from the saved instance source:

```text
source.content.fields[path].value
```

Item shape sent to Translation Agent:

```json
{
  "path": "content.title",
  "type": "string",
  "value": "Book a demo",
  "label": "optional identityKey",
  "role": "optional fieldPattern"
}
```

Rich text is detected from HTML-like values and sent as `type: "richtext"`.
The saved instance field map is authority. Translation Agent must not rederive
the field list from current widget source code during overlay writes.

## Worker HTTP Contract

Health:

```text
GET /healthz
HEAD /healthz
```

Translate:

```text
POST /translate-instance
```

Request:

```json
{
  "grant": "ckgrant.<payload>.<signature>",
  "agentId": "widget.instance.translator",
  "accountPublicId": "CLICKEEN",
  "instanceId": "QD1G068MX7",
  "widgetType": "faq",
  "baseLocale": "en",
  "activeLocales": ["fr", "de"],
  "items": [
    {
      "path": "content.title",
      "type": "string",
      "value": "Book a demo",
      "label": "title",
      "role": "headline",
      "promptType": "string"
    }
  ],
  "trace": {
    "requestId": "uuid",
    "client": "roma"
  }
}
```

Required fields:

- `grant`
- `accountPublicId`
- `instanceId`
- `activeLocales`
- `items`

Optional fields:

- `agentId`
- `widgetType`
- `baseLocale`
- `trace.requestId`
- `trace.client`

Response:

```json
{
  "requestId": "uuid",
  "agentId": "widget.instance.translator",
  "translation": {
    "ok": true,
    "baseLocale": "en",
    "activeLocales": ["fr", "de"],
    "results": [
      { "locale": "fr", "ok": true, "count": 12 },
      { "locale": "de", "ok": true, "count": 12 }
    ]
  }
}
```

If the worker returns a response with failed locale results, status is `424`.
Current locale execution uses `Promise.all`; an exception aborts the request and
returns an error payload. Overlay files written before the failure are not rolled
back.

## Grant And Write Authorization

Translation Agent verifies the Roma-issued grant before model execution or Tokyo
writes.

Required grant facts:

- `iss = "roma"`;
- `caps` includes `agent:widget.instance.translator`;
- `ai.agentId = "widget.instance.translator"`;
- `trace.accountPublicId` equals request `accountPublicId`;
- `trace.instanceId` equals request `instanceId`;
- `trace.activeLocales` is the same set as request `activeLocales`;
- `exp` is greater than current time.

Tokyo-worker verifies the same grant on each write using the `x-ck-ai-grant`
header and accepts only:

- the same account id;
- the same instance id;
- a locale included in `trace.activeLocales`.

## Translation Planning And Safety

Translation Agent:

- chunks model entries before model calls;
- protects placeholders, URLs, emails, tags, and structured tokens;
- parses structured model output;
- restores protected tokens;
- validates that every requested path has exactly one translated value;
- rejects unexpected output paths;
- rejects missing requested paths.

Model calls go through San Francisco `/model/chat` using the same Roma grant.

## Tokyo Overlay Write Contract

Translation Agent writes one locale at a time through Tokyo-worker:

```text
PUT /__internal/instances/{instanceId}/translations/{locale}
```

Headers:

```text
x-account-id: {accountPublicId}
x-ck-internal-service: translation-agent
x-ck-ai-grant: {grant}
```

Body:

```json
{ "values": { "content.title": "Réserver une démo" } }
```

Expected Tokyo response:

```json
{ "ok": true, "locale": "fr" }
```

## Storage And Verification

Overlay file path:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Tokyo-worker stores the file. Translation Agent does not store files directly in
R2.

## Failure Semantics

| Failure | Current behavior |
| --- | --- |
| invalid worker request | `400 BAD_REQUEST` |
| invalid or expired grant | `401 GRANT_INVALID` or `401 GRANT_EXPIRED` |
| grant/request mismatch | `403 CAPABILITY_DENIED` |
| missing `SANFRANCISCO_AI_ENGINE` | `500 PROVIDER_ERROR` |
| San Francisco provider/model failure | forwarded explicit error |
| malformed model output | explicit Translation Agent error |
| missing requested path | `502 PROVIDER_ERROR` |
| unexpected translated path | `502 PROVIDER_ERROR` |
| missing `TOKYO_PRODUCT_CONTROL` | `500 PROVIDER_ERROR` |
| Tokyo write rejection | forwarded explicit error |
| failure after prior locale writes | request fails; prior written overlay files remain |

No full-success response may be returned unless every requested active locale has
a successful overlay write.

## Runtime Config And Deploy

`agents/translation-agent/wrangler.toml`:

- `name = "translation-agent-dev"`
- `workers_dev = false`
- `ENVIRONMENT = "dev"`
- service binding `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev`
- service binding `TOKYO_PRODUCT_CONTROL -> tokyo-assets-dev`

Required secret/env:

- `AI_GRANT_HMAC_SECRET`

Deploy evidence comes from the GitHub Actions `cloud-dev workers deploy`
workflow after pushing `main`.

## Evals And Runtime Smoke

Local checks:

```bash
pnpm --filter @clickeen/translation-agent typecheck
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

Runtime smoke:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

The runtime smoke exercises Roma, Translation Agent, San Francisco, Tokyo-worker,
and Bob's Translations panel against cloud-dev.
