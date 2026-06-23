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
| `POST` | `/l10n/translate` | Prague system-copy translation tooling only |

### `/healthz`

Response:

```json
{ "ok": true, "service": "sanfrancisco", "env": "dev", "ts": 0 }
```

### `/model/chat`

Request type: `ModelChatRequest` in `sanfrancisco/src/types.ts`.

```json
{
  "grant": "ckgrant.<payload>.<signature>",
  "agentId": "product.copilot",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.2
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
  "requestId": "uuid",
  "agentId": "product.copilot",
  "content": "...",
  "usage": {
    "provider": "openai",
    "model": "gpt-5.4-mini",
    "promptTokens": 0,
    "completionTokens": 0,
    "latencyMs": 0
  }
}
```

### `/outcome`

Request type: `OutcomeAttachRequest` in `sanfrancisco/src/types.ts`.

The caller sends the exact JSON body and signs:

```text
outcome.<bodyText>
```

The signature is sent as:

```text
x-clickeen-signature: <hmac>
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

## Grant Contract

Grant verification lives in `sanfrancisco/src/grants.ts`.

Format:

```text
ckgrant.<base64url(payloadJson)>.<base64url(hmacSha256("ckgrant.<payloadB64>", AI_GRANT_HMAC_SECRET))>
```

Required payload fields:

| Field | Requirement |
| --- | --- |
| `v` | `1` |
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
6. Reject if the provider key is missing.
7. Call the selected provider/model exactly.

There is no fallback. San Francisco never switches provider or model after a
failure.

## Bindings And Secrets

| Binding/env | Used by | Purpose |
| --- | --- | --- |
| `AI_GRANT_HMAC_SECRET` | `grants.ts`, `telemetry.ts` | verify grants and outcome signatures |
| `DEEPSEEK_API_KEY` | `providers/deepseek.ts` | DeepSeek provider calls |
| `DEEPSEEK_BASE_URL` | `providers/deepseek.ts` | optional DeepSeek base URL override |
| `OPENAI_API_KEY` | `providers/openai.ts` | OpenAI provider calls |
| `OPENAI_BASE_URL` | `providers/openai.ts` | optional OpenAI base URL override |
| `SF_EVENTS` | `index.ts` | non-blocking interaction event queue |
| `SF_D1` | `telemetry.ts` | event and outcome indexes |
| `SF_R2` | `index.ts`, `telemetry.ts` | sampled raw learning payloads |
| `SF_KV` | Worker env | San Francisco-owned KV binding |

## Telemetry Writes

For each `/model/chat` call, San Francisco builds an `InteractionEvent`.

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
| `400` | `BAD_REQUEST` | malformed JSON, invalid request shape, invalid budgets |
| `401` | `GRANT_INVALID` | bad grant format, bad signature, missing required grant fields |
| `401` | `GRANT_EXPIRED` | expired grant |
| `403` | `CAPABILITY_DENIED` | unknown agent, missing capability, agent/policy mismatch, provider/model not allowed |
| `500` | `PROVIDER_ERROR` | missing provider key, provider failure, outcome persistence failure |
| `410` | `BAD_REQUEST` | `/execute` called on San Francisco |

Provider/model failure is explicit. It is not silently retried through a
different model or provider.

## Current Callers

| Caller | Path | How it calls |
| --- | --- | --- |
| Product Copilot Worker | `agents/product-copilot/src/worker.ts` | service binding `SANFRANCISCO_AI_ENGINE` or `SANFRANCISCO_BASE_URL` to `/model/chat` |
| Translation Agent Worker | `agents/translation-agent/src/worker.ts` | service binding `SANFRANCISCO_AI_ENGINE` to `/model/chat` |
| Bob/Roma outcome attach | Bob `/api/ai/outcome` -> Roma `/api/account/instances/{instanceId}/copilot/outcome` | Roma signs and forwards to San Francisco `/outcome` |
| Prague system-copy tooling | `sanfrancisco/src/l10n-routes.ts` | `/l10n/translate` |

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
pnpm e2e:smoke:translation-agent-runtime
```

Use GitHub Actions run status as deploy evidence.

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
