# San Francisco

STATUS: CURRENT SYSTEM OPERATOR SPEC

San Francisco is Clickeen's governed model-execution Worker. It verifies signed
AI grants, resolves the exact provider/model route from the signed policy,
executes the provider call, emits interaction events, and stores outcome rows.

Code authority: `sanfrancisco/`

## Runtime Coordinates

| Concern | Current value |
| --- | --- |
| Worker name | `sanfrancisco-dev` |
| Worker entrypoint | `sanfrancisco/src/index.ts` |
| Wrangler config | `sanfrancisco/wrangler.toml` |
| Cloud-dev host | `https://sanfrancisco.dev.clickeen.com` |
| Deploy workflow | `.github/workflows/cloud-dev-workers.yml` |
| Deploy job | `cloud-dev workers deploy` |
| D1 database | `sanfrancisco_d1_dev` / `9ee059a3-538f-4b71-b2ea-f04b33e4897a` |
| R2 bucket | `sanfrancisco-logs-dev` |
| Queue | `sanfrancisco-events-dev` |
| KV namespace | `f1abe003b9a8434699175b0c1ccd2603` |

Every San Francisco HTTP response includes `x-request-id`. Requests without an
incoming `x-request-id` get a generated id. San Francisco logs one structured
`http.request` line per handled request with service, stage, request id,
boundary, path, status, duration, and reason detail.

## Authority Boundary

San Francisco owns:

- verifying AI grants signed with `AI_GRANT_HMAC_SECRET`;
- enforcing the agent id, capability, budget, and model policy inside the grant;
- checking provider credentials exist for the selected provider;
- calling DeepSeek or OpenAI;
- returning typed model execution responses/errors;
- enqueueing model-call interaction events to `SF_EVENTS`;
- indexing events and outcomes into `SF_D1`;
- writing sampled raw learning payloads to `SF_R2`.

San Francisco does not own:

- Product Copilot reasoning;
- Translation Agent reasoning;
- account identity, tier, locale, save, publish, or storage truth;
- model catalog maintenance;
- provider catalog probing during product requests;
- product data mutation;
- visitor runtime behavior.

## Endpoints

| Method | Path | Current behavior |
| --- | --- | --- |
| `GET`/`HEAD` | `/healthz` | returns Worker health |
| `POST` | `/model/chat` | executes one governed model call for a built agent home |
| `POST` | `/outcome` | stores a signed outcome attachment |
| `POST` | `/execute` | returns `410`; San Francisco does not execute agent brains |
| `POST` | `/l10n/translate` | Prague system-copy translation CLI tooling only |

### `/healthz`

Response:

```json
{ "ok": true, "service": "sanfrancisco", "env": "[environment]", "ts": "[timestamp ms]" }
```

### `/model/chat`

Request type: `ModelChatRequest` in `sanfrancisco/src/types.ts`.

```json
{
  "grant": "[signed grant]",
  "agentId": "product.copilot",
  "messages": [
    { "role": "system", "content": "[system message]" },
    { "role": "user", "content": "[user message]" }
  ],
  "temperature": "[temperature]"
}
```

`ModelChatRequest.trace` exists in the shared type, but current San Francisco
event trace is taken from the signed grant, not from the request body.

Request validation in `sanfrancisco/src/index.ts`:

- `grant` must be a string;
- `agentId` must be a string and resolve through `resolveAiAgent`;
- `messages` must contain 1 to 24 messages;
- message `role` must be `system`, `user`, or `assistant`;
- message `content` must be a non-empty string of at most `80_000` characters;
- `temperature`, when present, must be a finite number.

Response type: `ModelChatResponse` in `sanfrancisco/src/types.ts`.

```json
{
  "requestId": "[request id]",
  "agentId": "product.copilot",
  "content": "[model output]",
  "usage": {
    "provider": "[provider selected by signed grant]",
    "model": "[model returned by provider]",
    "promptTokens": "[prompt token count]",
    "completionTokens": "[completion token count]",
    "latencyMs": "[latency ms]"
  }
}
```

`usage.provider` and `usage.model` come from the executed provider path. The
operator doc does not hardcode a specific model in a generic response example.
Zero token counts are failure-telemetry values, not the normal successful
`/model/chat` example.

### `/outcome`

Request type: `OutcomeAttachRequest` in `sanfrancisco/src/types.ts`.

The caller sends the exact JSON body and signs:

```text
outcome.[body text]
```

The signature is sent as:

```text
x-clickeen-signature: [hmac signature]
```

Accepted outcome events:

- `edit_applied`
- `edit_rejected`
- `edit_undone`
- `clarification_needed`
- `invalid_output`

Required fields:

- `requestId`
- `sessionId`
- `event`
- `occurredAtMs`

Optional fields persisted to D1:

- `outcomeId`
- `surfaceId`
- `artifactId`
- `timeToDecisionMs`
- `accountIdHash`

Accepted but not persisted to D1:

- `metadata`

Response:

```json
{ "ok": true }
```

Missing `x-clickeen-signature` returns `401 CAPABILITY_DENIED`. Invalid
signature returns `403 CAPABILITY_DENIED`.

## Grant Contract

Grant verification lives in `sanfrancisco/src/grants.ts`.

Format:

```text
ckgrant.[base64url payload json].[base64url hmac signature]
```

Required payload fields validated by current runtime:

| Field | Requirement |
| --- | --- |
| `iss` | `roma` or `sanfrancisco` |
| `sub` | `{ kind: "user", userId, accountId }` or `{ kind: "service", serviceId }` |
| `exp` | epoch seconds greater than current time |
| `caps` | string array |
| `budgets.maxTokens` | positive number |
| `budgets.timeoutMs` | positive number |
| `mode` | `editor` or `ops` |
| `ai` | required for model execution |

Required `ai` policy fields:

- `agentId`
- `policyProfile`
- `enabled`
- `defaultModel`
- `modelsByProvider`
- `allowModelPicker`
- `maxTokensPerCall`
- `maxTurnsPerThread`
- `maxMonthlyTurns`
- `timeoutMs`
- `learningCapture.rawSamplePercent`
- `policyId`

For `/model/chat`, San Francisco also enforces:

- `grant.ai.agentId` must match the canonical `agentId` from
  `packages/ck-contracts/src/ai.ts`;
- `caps` must include `agent:<canonicalAgentId>`;
- selected provider/model must be allowed by `grant.ai.modelsByProvider`;
- if `selectedModel` exists, `allowModelPicker` must be true and the model must
  be allowed;
- provider credential must exist in Worker env.

## Model Routing

Model routing lives in:

- `sanfrancisco/src/ai/modelRouter.ts`
- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/providers/deepseek.ts`
- `sanfrancisco/src/providers/openai.ts`

Selection order:

1. Use `grant.ai.selectedModel.provider` when present.
2. Otherwise use `grant.ai.defaultModel.provider`.
3. For that provider, use `selectedModel.model` when present.
4. Otherwise use `grant.ai.modelsByProvider[provider].defaultModel`.
5. Reject if the provider or model is not allowed by the signed policy.
6. Reject if the selected provider key is missing.
7. Call the selected provider/model exactly.

There is no fallback. San Francisco never switches provider or model after a
failure.

The current runtime availability check verifies that the selected provider has
the required credential in Worker env. It does not probe provider catalogs or
make a live model-availability call during product requests.

`/model/chat` and `/l10n/translate` share the per-isolate inflight limit in
`sanfrancisco/src/concurrency.ts`: at most 8 concurrent executions. When the
limit is exceeded, San Francisco returns `429 BUDGET_EXCEEDED`.

## Bindings And Secrets

| Binding/env | Used by | Purpose |
| --- | --- | --- |
| `AI_GRANT_HMAC_SECRET` | `grants.ts`, `telemetry.ts` | verify grants and outcome signatures |
| `DEEPSEEK_API_KEY` | `providers/deepseek.ts` | DeepSeek provider calls |
| `DEEPSEEK_BASE_URL` | `providers/deepseek.ts` | optional DeepSeek base URL override |
| `OPENAI_API_KEY` | `providers/openai.ts` | OpenAI provider calls |
| `OPENAI_BASE_URL` | `providers/openai.ts` | optional OpenAI base URL override |
| `OPENAI_MODEL` | `prague-l10n-strings.ts` | required only by `/l10n/translate` |
| `SF_EVENTS` | `index.ts` | non-blocking interaction event queue |
| `SF_D1` | `telemetry.ts` | event and outcome indexes |
| `SF_R2` | `index.ts`, `telemetry.ts` | sampled raw learning payloads |
| `SF_KV` | Worker env | configured San Francisco KV namespace; no current primary product truth |

Provider keys are route-dependent. If a signed grant selects OpenAI, OpenAI
credentials must exist. If it selects DeepSeek, DeepSeek credentials must exist.
Missing selected-provider credentials fail explicitly; San Francisco does not
switch providers.

## Prague System-Copy Translation Endpoint

`POST /l10n/translate` exists for Prague system-copy translation tooling only.
It is not account-widget Translation Agent work.

Runtime gates:

- available only when `ENVIRONMENT` is `local` or `dev`;
- body signature header: `x-clickeen-signature`;
- signature message: `prague-l10n.[body text]`;
- signature secret: `AI_GRANT_HMAC_SECRET`;
- provider path: OpenAI public Responses API at `/v1/responses`;
- required env: `OPENAI_API_KEY`, `OPENAI_MODEL`, `SF_R2`;
- prompt id: `prague.strings.l10n@2026-05-06.1`;
- policy id: `l10n.ops`;
- max items: `250`;
- max input characters: `12_000`;
- max output tokens: `2_000`;
- timeout: `90_000ms`.

Request shape:

```json
{
  "surface": "prague",
  "kind": "system",
  "chunkKey": "[chunk key]",
  "blockKind": "[block kind]",
  "locale": "[locale]",
  "sourceRevision": "[source revision]",
  "baseUpdatedAt": "[base updated at ISO timestamp]",
  "allowlistId": "[numeric allowlist id]",
  "allowlistHash": "[allowlist hash]",
  "items": [
    { "path": "[field path]", "type": "string", "value": "[source value]" }
  ]
}
```

Response shape:

```json
{
  "locale": "[locale]",
  "items": [
    { "path": "[field path]", "value": "[translated value]" }
  ]
}
```

This endpoint writes request/response logs to:

```text
l10n/prague/[chunk key]/[locale]/[base updated at].[timestamp].json
```

under `SF_R2`. Empty `items` requests are logged as skipped and return an empty
items array.

`/l10n/translate` uses the OpenAI public Responses API URL directly. It does
not use `OPENAI_BASE_URL`.

## Telemetry Writes

For each `/model/chat` call that passes request shape, grant, agent, and
capability validation, San Francisco builds an `InteractionEvent`.

If `SF_EVENTS` exists, the event is sent to the queue with `ctx.waitUntil`.
Queue handling:

```text
InteractionEvent
-> indexCopilotEvent(SF_D1)
-> resolveLearningCaptureDecision
-> optional raw sample write to SF_R2
```

D1 indexing errors are logged and do not fail the model response. Outcome insert
errors return `500`.

## Failure Semantics

| Status | Code | Cause |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | malformed JSON or invalid request shape |
| `400` | `GRANT_INVALID` | invalid grant budgets |
| `401` | `GRANT_INVALID` | bad grant format, bad signature, missing required grant fields |
| `401` | `GRANT_EXPIRED` | expired grant |
| `401` | `CAPABILITY_DENIED` | missing `/outcome` or `/l10n/translate` body signature |
| `403` | `CAPABILITY_DENIED` | invalid `/outcome` or `/l10n/translate` body signature |
| `403` | `CAPABILITY_DENIED` | unknown agent, missing capability, agent/policy mismatch, provider/model not allowed |
| `403` | `PROVIDER_ERROR` | selected provider/model not configured in San Francisco routing |
| `429` | `BUDGET_EXCEEDED` | per-isolate concurrency limit or provider timeout |
| `502` | `PROVIDER_ERROR` | provider upstream failure, invalid provider JSON, empty provider output, incomplete usage, invalid Translation/Prague l10n model output |
| `500` | `PROVIDER_ERROR` | missing required secret/binding, outcome persistence failure, unhandled error |
| `410` | `BAD_REQUEST` | `/execute` called on San Francisco |

Provider/model failure is explicit. It is not silently retried through a
different model or provider.

## Current Callers

| Caller | Path | How it calls |
| --- | --- | --- |
| Product Copilot Worker | `agents/product-copilot/src/worker.ts` | service binding `SANFRANCISCO_AI_ENGINE` to `/model/chat` |
| Translation Agent Worker | `agents/translation-agent/src/worker.ts` | service binding `SANFRANCISCO_AI_ENGINE` to `/model/chat` |
| Bob/Roma outcome attach | Bob `/api/ai/outcome` -> Roma `/api/account/instances/[instance id]/copilot/outcome` | Roma signs and forwards to San Francisco `/outcome` |
| Prague system-copy tooling | `scripts/prague-l10n/translate.mjs` | signs and calls `/l10n/translate` |

## Deploy Path

Cloud-dev deploy path:

```bash
git push github main
gh run list --branch main --limit 10
```

Expected workflows after push:

- `cloud-dev workers deploy`
- `cloud-dev surface reachability`

San Francisco deploys from `sanfrancisco/wrangler.toml` through GitHub Actions.
Do not use Cloudflare dashboard worker Git deploy controls as the deploy
authority.

Direct package deploy command:

```bash
pnpm -C sanfrancisco run deploy
```

That package command first ensures queue `sanfrancisco-events-dev` exists, then
runs `wrangler deploy`. The GitHub workflow runs root `pnpm lint` and
`pnpm typecheck` before deploying changed Worker surfaces.

D1 migrations are not applied by `pnpm -C sanfrancisco run deploy`. Schema
deployment is a separate Cloudflare D1 operation and must be handled through the
approved Cloudflare operation path before relying on new D1 columns/tables.

## Verification

Local checks:

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
```

Health check after deploy:

```bash
curl -s https://sanfrancisco.dev.clickeen.com/healthz
```

Product-path checks that exercise San Francisco:

```bash
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm --filter @clickeen/translation-agent eval:translation-agent
pnpm e2e:smoke:copilot-runtime
pnpm e2e:smoke:translation-agent-runtime
```

Use GitHub Actions run status as deploy evidence.

## Operator Inspection

Use the Cloudflare operation path from
`documentation/engineering/CloudflareOperations.md` for live reads.

Useful runtime facts:

- `copilot_events` and `copilot_outcomes` live in D1
  `sanfrancisco_d1_dev`;
- raw Product Copilot samples live in `SF_R2` under
  `learning/[environment]/[agent id]/[yyyy-mm-dd]/[request id].json`;
- Prague l10n logs live in `SF_R2` under
  `l10n/prague/[chunk key]/[locale]/[base updated at].[timestamp].json`;
- `SF_EVENTS` missing or send failure does not fail `/model/chat`;
- D1 event insert failure is logged and does not fail `/model/chat`;
- outcome insert failure fails `/outcome`;
- `SF_KV` is bound but is not current product truth.

Debug sequence:

1. Capture `x-request-id` from the failed response.
2. Check San Francisco `http.request` logs for that request id.
3. For model failures, inspect the signed grant policy and selected provider.
4. For provider failures, verify the selected provider secret exists.
5. For learning/indexing questions, inspect D1 by request id.
6. For raw sample questions, inspect the R2 learning key by request id.

## Out Of Scope

San Francisco must not:

- execute Product Copilot or Translation Agent brains;
- mint Roma account grants for product requests;
- decide account tier, locale, active locale, or product permission;
- write account assets, instances, pages, or overlays;
- run provider catalog monitoring on product requests;
- read runtime model truth from `documentation/`;
- fallback to another model/provider when the signed route fails.

## Links

- AI map: `documentation/ai/README.md`
- Learning: `documentation/ai/learning.md`
- Product Copilot: `documentation/ai/agents/product-copilot.md`
- Translation Agent: `documentation/ai/agents/translation-agent.md`
