# Translation Agent

STATUS: CURRENT SYSTEM OPERATOR SPEC

Translation Agent is the current account-widget translation agent home. It
translates saved account instance content into locale overlay files.

Code authority:

- `agents/translation-agent/`
- `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`
- `roma/app/api/account/instances/[instanceId]/translations/route.ts`
- `roma/app/api/account/instances/[instanceId]/translations/[locale]/route.ts`
- `roma/app/api/account/locales/route.ts`
- `roma/lib/account-instance-translations.ts`
- `roma/lib/translation-agent-control.ts`
- `bob/components/TranslationsPanel.tsx`
- `tokyo-worker/src/routes/internal-product-route-utils.ts`
- `tokyo-worker/src/routes/internal-translation-routes.ts`

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
| Locale concurrency | up to 6 locales concurrently per request |

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
POST /api/account/instances/[instance id]/translations/generate
```

Roma loads current account locale state, excludes the base locale, enforces tier
locale entitlement, loads the saved instance source from Tokyo-worker, builds
translation items from saved `source.content.fields`, mints the Translation
Agent grant, and calls the Translation Agent service binding.

Locale removal is not Translation Agent work. Roma/Tokyo delete exact overlay
files for removed active locales.

Bob uses hosted Builder commands for translation operations. These commands have
a `120_000ms` timeout. Translation Agent owns Agent Activity for this operation:
while it translates and writes overlays, it may emit transient narration such as
`Writing French` and `French written`. Roma transports this stream to Bob. Bob
renders it temporarily.

| Bob operation | Hosted command | Roma route |
| --- | --- | --- |
| list translations | `list-translations` | `GET /api/account/instances/[instance id]/translations` |
| read one translation | `read-translation` | `GET /api/account/instances/[instance id]/translations/[active locale]` |
| generate translations | `generate-translations` | `POST /api/account/instances/[instance id]/translations/generate` |

Bob's current Translations panel shows the Generate translations operation and
transient Translation Agent Activity while the agent operates. It does not show
generated-count summaries, queue state, package/cache state, or user translation
overrides. Activity rows are not stored status and do not come from polling.

## Roma Public Translation API

| Method | Path | Role | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/account/instances/[instance id]/translations` | viewer | lists stored locale overlay summaries from Tokyo-worker |
| `GET` | `/api/account/instances/[instance id]/translations/[active locale]` | viewer | reads one locale overlay value map from Tokyo-worker |
| `POST` | `/api/account/instances/[instance id]/translations/generate` | editor | generates overlays for current active locales excluding base locale |

The browser-facing generation response is Roma-shaped, not the raw Worker
response:

```json
{
  "ok": true,
  "translation": {
    "ok": true,
    "accepted": true,
    "baseLocale": "[base locale]",
    "activeLocales": ["[active locale]"],
    "skippedLocales": []
  }
}
```

When there are no active locales to generate after excluding the base locale,
Roma returns `accepted: false` and does not call the Translation Agent.

## Roma Request Construction

Roma builds items from the saved instance source:

```text
source.content.fields[path].value
```

Item shape sent to Translation Agent:

```json
{
  "path": "[field path]",
  "type": "string",
  "value": "[source value]",
  "label": "[identity key]",
  "role": "[field pattern]"
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
  "grant": "[signed grant]",
  "agentId": "widget.instance.translator",
  "accountPublicId": "[account public id]",
  "instanceId": "[instance id]",
  "widgetType": "[widget type]",
  "baseLocale": "[base locale]",
  "activeLocales": ["[active locale]"],
  "items": [
    {
      "path": "[field path]",
      "type": "string",
      "value": "[source value]",
      "label": "[identity key]",
      "role": "[field pattern]",
      "promptType": "string"
    }
  ],
  "trace": {
    "requestId": "[request id]",
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
  "requestId": "[request id]",
  "agentId": "widget.instance.translator",
  "translation": {
    "ok": true,
    "baseLocale": "[base locale]",
    "activeLocales": ["[active locale]"],
    "results": [
      { "locale": "[active locale]", "ok": true, "count": "[translated item count]" }
    ]
  }
}
```

Locale execution is bounded concurrency: up to 6 locales run concurrently, and
the worker awaits the locale workers with `Promise.all`. Current code does not
catch per-locale exceptions into `{ ok: false }` result rows. An exception aborts
the request and returns the thrown error payload. Overlay files written before
the failure are not rolled back.

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
- protects placeholder parity, richtext tag parity, and anchor href parity;
- instructs the model to preserve URLs, emails, brand names, and structured
  tokens in normal strings;
- parses structured model output;
- restores protected tokens;
- validates that every requested path has exactly one translated value;
- rejects unexpected output paths;
- rejects missing requested paths.

Model calls go through San Francisco `/model/chat` using the same Roma grant.

Current item limits in `agents/translation-agent/src/index.ts`:

- max batch items: `80`;
- max batch input characters: `4_000`;
- max total items: `800`;
- max total input characters: `60_000`.

## Tokyo Overlay Write Contract

Translation Agent writes one overlay file per locale through Tokyo-worker:

```text
PUT /__internal/instances/[instance id]/translations/[active locale]
```

Headers:

```text
x-account-id: [account public id]
x-ck-internal-service: translation-agent
x-ck-ai-grant: [signed grant]
x-request-id: [request id]
```

Body:

```json
{ "values": { "[field path]": "[translated value]" } }
```

Expected Tokyo response:

```json
{ "ok": true, "locale": "[active locale]" }
```

## Storage And Verification

Overlay file path:

```text
accounts/[account public id]/instances/[instance id]/overlays/locales/[active locale].json
```

Tokyo-worker stores the file. Translation Agent does not store files directly in
R2.

## Active Locale Settings Reconcile

Account locale settings use:

```text
PUT /api/account/locales
```

Roma owns this operation, not Translation Agent.

Product language is active locales. The current Supabase column used by Roma
for this value is still named `selected_target_locales`; that is a storage
column name only, not a product concept and not agent language.

Behavior:

- requires current account role `admin`;
- validates `activeLocales` and `localePolicy`;
- enforces tier locale entitlement;
- checks base-locale lock before allowing a base-locale change;
- computes added/removed active locales against current account state;
- patches account locale settings in Supabase as the account truth;
- for removed locales, deletes exact instance overlay files through Tokyo-worker;
- for added locales, calls Translation Agent generation for each saved instance;
- returns `overlayUpdate` with `ok`, checked/deleted/generated/skipped summary,
  and an explicit error when overlay follow-up does not fully complete.

Account active locales are the saved account decision. Overlay follow-up does
not veto that decision. If overlay follow-up fails after the settings write,
Roma returns the saved settings with `overlayUpdate.ok: false`; Bob/runtime
surfaces must not claim overlay work fully completed from that response.

This is an operator fact, not a desired future abstraction.

## End-To-End Runtime Secrets And Bindings

| Surface | Secret/binding/env | Required | Used for |
| --- | --- | --- | --- |
| Roma | `TRANSLATION_AGENT -> translation-agent-dev` | yes | service-binding call to `/translate-instance` |
| Roma | `TOKYO_PRODUCT_CONTROL -> tokyo-assets-dev` | yes | listing/reading/deleting translations and source instance loads |
| Roma | `AI_GRANT_HMAC_SECRET` | yes | minting Translation Agent grant |
| Roma | `SUPABASE_SERVICE_ROLE_KEY` | yes for locale settings write | account locale settings patch |
| Translation Agent | `AI_GRANT_HMAC_SECRET` | yes | verifying Roma grant before model/write work |
| Translation Agent | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` | yes | model execution |
| Translation Agent | `TOKYO_PRODUCT_CONTROL -> tokyo-assets-dev` | yes | overlay writes |
| Tokyo-worker | `AI_GRANT_HMAC_SECRET` | yes for Translation Agent writes | verifies `x-ck-ai-grant` before accepting overlay writes |

## Failure Semantics

| Failure | Current behavior |
| --- | --- |
| invalid worker request | `400 BAD_REQUEST` |
| invalid or expired grant | `401 GRANT_INVALID` or `401 GRANT_EXPIRED` |
| grant/request mismatch | `403 CAPABILITY_DENIED` |
| missing `AI_GRANT_HMAC_SECRET` | `500 PROVIDER_ERROR` from Translation Agent |
| missing `SANFRANCISCO_AI_ENGINE` | `500 PROVIDER_ERROR` |
| San Francisco provider/model failure | forwarded explicit error |
| malformed model output | explicit Translation Agent error |
| missing requested path | `502 PROVIDER_ERROR` |
| unexpected translated path | `502 PROVIDER_ERROR` |
| missing `TOKYO_PRODUCT_CONTROL` | `500 PROVIDER_ERROR` |
| Tokyo-worker missing write grant secret | `503` with `tokyo.translation.writeGrantSecretMissing` |
| Tokyo write rejection | worker forwards explicit error; Roma may remap non-400/401/403/422 Translation Agent failures to `502 UPSTREAM_UNAVAILABLE` |
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

Direct package deploy:

```bash
pnpm -C agents/translation-agent run deploy
```

Normal cloud-dev deploy evidence comes from the GitHub Actions
`cloud-dev workers deploy` workflow after changes to
`agents/translation-agent/**`, `packages/ck-contracts/**`,
`packages/ck-policy/**`, `packages/l10n/**`, `scripts/infra/**`, or the workflow
file. The workflow also syncs `AI_GRANT_HMAC_SECRET` to `translation-agent-dev`
and to `tokyo-assets-dev` when required.

## Operator Debug Sequence

1. Confirm Roma can load current account locale state.
2. Confirm active locales exclude the base locale and pass tier entitlement.
3. Confirm the saved instance has translatable `source.content.fields`.
4. If generation returns `accepted: false`, there were no active non-base
   locales to generate.
5. If Translation Agent returns `401` or `403`, inspect the Roma grant trace:
   `accountPublicId`, `instanceId`, and `activeLocales`.
6. If model execution fails, inspect San Francisco health, grant model policy,
   and selected provider secret.
7. If Tokyo write fails, inspect `TOKYO_PRODUCT_CONTROL`, `x-account-id`,
   `x-ck-internal-service`, `x-ck-ai-grant`, and Tokyo-worker
   `AI_GRANT_HMAC_SECRET`.
8. If Bob shows only a generic failure, inspect the Roma response body and then
   the Translation Agent/San Francisco/Tokyo request id chain.
