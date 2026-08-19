# San Francisco

STATUS: CURRENT SYSTEM OPERATOR SPEC

San Francisco is Clickeen's governed model-execution Worker. It verifies signed
AI grants, enforces the exact model policy carried by the grant, calls the
selected provider, and returns typed model output and provider usage. It also
hosts the separately signed Prague system-copy translation endpoint.

Code authority: `sanfrancisco/`

## Runtime Coordinates

| Concern | Current value |
| --- | --- |
| Worker | `sanfrancisco-dev` |
| Entrypoint | `sanfrancisco/src/index.ts` |
| Wrangler config | `sanfrancisco/wrangler.toml` |
| Cloud-dev host | `https://sanfrancisco.dev.clickeen.com` |
| Deploy workflow | `.github/workflows/cloud-dev-workers.yml` |
| R2 bucket | `sanfrancisco-logs-dev` |

Every response includes `x-request-id`. San Francisco emits one structured
`http.request` log for each handled request.

## Authority Boundary

San Francisco owns grant verification, agent/capability/budget/model-policy
enforcement, provider credential checks, provider execution, typed responses,
and Prague translation logs. It does not own agent reasoning, account or locale
truth, product mutations, provider fallback, or a learning/outcome event plane.

After signed-grant authorization, San Francisco trusts the exact model request
produced by the registered Clickeen agent home. It does not reinterpret the
agent's messages, tools, mode, or product context through a second semantic
contract. San Francisco does own acceptance of the external provider response
before returning one typed Clickeen result.

`POST /model/turn` now follows that boundary directly: it extracts and verifies
the signed grant, then consumes the registered agent home's typed request
without a second request-shape proof. Grant/capability/budget enforcement,
provider credential checks, concurrency and timeout enforcement, and
provider-output acceptance remain owned here.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| `GET`/`HEAD` | `/healthz` | Worker health |
| `POST` | `/model/turn` | Governed streaming or structured model step for a registered agent home |
| `POST` | `/execute` | `410`; agent brains execute in their agent homes |
| `POST` | `/l10n/translate` | Prague system-copy translation tooling only |

### `/model/turn`

Request and response authority: `ModelTurnRequest`, `ModelTurnStreamRequest`,
`ModelTurnStructuredRequest`, and `ModelTurnStructuredResponse` in
`sanfrancisco/src/ai/model-turn-types.ts`.

`/model/turn` executes one governed model step in `stream` or `structured` mode.
A model step is one provider call that may emit text deltas and at most one tool
call. Multi-step agent loops live in the agent home, not here. Each request
carries a signed grant, registered `agentId`, one to 24 messages (system/user/
assistant/tool), an optional finite temperature, optional tool definitions, and
a `mode`. San Francisco mints one `modelStepId` per request and returns it on
every event so callers can correlate steps across continuations.

Internal execution uses the AI SDK (`ai`, `@ai-sdk/openai`,
`@ai-sdk/deepseek`). The AI SDK is internal plumbing only; the wire contract is
the Clickeen-owned `model-turn-types.ts`. San Francisco never exposes AI SDK
types on the wire.

Stream mode returns `content-type: text/event-stream` with these SSE events:

| Event | Carries |
| --- | --- |
| `text_delta` | incremental assistant text |
| `tool_call` | one tool invocation (`toolCallId`, `toolName`, `input`) |
| `model_step_finished` | terminal success (`finishReason`, requested/reported model, token usage, latency) |
| `model_step_error` | terminal failure (`code`, `reasonKey`, `message`) |

Every event carries `version`, `modelStepId`, and the event `type`. A stream
ends with exactly one terminal event. Caller cancellation (downstream abort)
ends the stream cleanly without a timeout error.

Structured mode returns one JSON `ModelTurnStructuredResponse` carrying either a
successful `output` object plus `finish`, or an `error` object.

Provider truth is required, not invented. If the provider does not report a
model identity (`response.modelId`) or integer token usage (`inputTokens`,
`outputTokens`), the step fails visibly as `model_step_error` /
`PROVIDER_ERROR`. There is no fallback model, provider, or zeroed usage.

Timeout and caller cancellation are distinguished abort causes. A signed
per-call timeout exceeding is a budget failure (`BUDGET_EXCEEDED`). Caller
cancellation (agent-home Stop) is a clean end: stream mode closes the stream
without a terminal error event, and structured mode returns
`CALLER_CANCELLED`. San Francisco never reports a user Stop as a timeout.

## Grant Contract

Verification authority: `sanfrancisco/src/grants.ts`.

```text
ckgrant.[base64url payload json].[base64url RS256 signature]
```

Roma is the only grant signer. San Francisco holds only
`ROMA_AI_GRANT_PUBLIC_KEY_PEM` and accepts only issuer `roma`. The runtime
validates issuer, subject, expiry, capabilities, budgets, mode, and
the complete AI policy. The AI policy includes agent and policy ids, tier,
enabled state, default and allowed models, picker selection, per-call token and
timeout budgets, and thread/monthly turn ceilings.

For `/model/turn`, the grant agent must match the canonical
registered agent; the capability must include `agent:<canonicalAgentId>`;
selected/default model and provider must be allowed; and the selected provider
credential must exist.

## Model Routing

Routing authority:

- `sanfrancisco/src/ai/modelRouter.ts`
- `sanfrancisco/src/ai/modelAvailability.ts`
- `sanfrancisco/src/ai/model-turn.ts`

The selected model wins when present; otherwise the signed default is used.
San Francisco calls that exact allowed provider/model. Missing credentials or a
provider failure fail explicitly. There is no provider or model fallback.

`/model/turn` (structured) and `/l10n/translate` share the
per-isolate inflight limit in `sanfrancisco/src/concurrency.ts` (eight
concurrent executions). `/model/turn` stream mode uses the streaming-aware
variant that holds the lease until the stream body completes, errors, or is
cancelled by the downstream consumer, then releases exactly once. The release is
idempotent and runs on normal completion, stream error, and downstream
cancellation.

## Bindings And Secrets

| Binding/env | Purpose |
| --- | --- |
| `ROMA_AI_GRANT_PUBLIC_KEY_PEM` | Verify Roma-issued AI grants |
| `PRAGUE_L10N_HMAC_SECRET` | Verify Prague localization request signatures |
| `DEEPSEEK_API_KEY` | DeepSeek calls when selected by signed policy |
| `DEEPSEEK_BASE_URL` | Optional DeepSeek URL override |
| `OPENAI_API_KEY` | OpenAI calls and Prague translation |
| `OPENAI_BASE_URL` | Optional OpenAI URL override for governed model calls |
| `OPENAI_MODEL` | Prague translation model |
| `SF_R2` | Prague translation request/response logs |

## Prague System-Copy Translation

`POST /l10n/translate` is for `scripts/prague-l10n/translate.mjs`, not account
widget translation. It is limited to local/dev, verifies the signature of
`prague-l10n.[body text]`, and calls the OpenAI public Responses API directly.
It requires `OPENAI_API_KEY`, `OPENAI_MODEL`, and `SF_R2`.

Requests are bounded to 250 items and 12,000 source characters. Logs are stored
at:

```text
l10n/prague/[chunk key]/[locale]/[base updated at].[timestamp].json
```

Empty item lists are logged as skipped and return an empty result.

## Failure Semantics

Invalid or expired grants fail with `401`; denied capabilities, policies,
signatures, or routes with `403`; concurrency/timeouts with `429`; provider
failures with `502`; unhandled configuration/runtime errors with `500`; and
`/execute` with `410`. After grant verification, San Francisco trusts the
authorized agent home's structured request semantics. A failed selected route
is never silently retried through another provider or model.

## Callers

| Caller | Path |
| --- | --- |
| Product Copilot Worker | `SANFRANCISCO_AI_ENGINE` service binding to `/model/turn` |
| Translation Agent Worker | `SANFRANCISCO_AI_ENGINE` service binding to `/model/turn` structured mode |
| Prague translation script | signed HTTP request to `/l10n/translate` |

## Deploy And Verification

San Francisco deploys through GitHub Actions `cloud-dev workers deploy` from
`sanfrancisco/wrangler.toml`. The direct package command is
`pnpm -C sanfrancisco run deploy`.

```bash
pnpm --filter @clickeen/sanfrancisco typecheck
curl -s https://sanfrancisco.dev.clickeen.com/healthz
pnpm e2e:smoke:copilot-runtime
pnpm e2e:smoke:translation-agent-runtime
```

Use GitHub Actions run status as deploy evidence and the relevant agent/product
smoke as product-path evidence. For a failure, start with `x-request-id`, inspect
San Francisco `http.request` logs, then inspect the signed policy and exact
selected-provider configuration.

## Out Of Scope

San Francisco must not execute agent brains, mint Roma account grants, decide
account/product truth, write account artifacts, probe provider catalogs during
product requests, persist model-call/outcome learning records, or fall back to
another provider/model.

## Links

- AI map: `documentation/ai/README.md`
- Product Copilot: `documentation/ai/agents/product-copilot.md`
- Translation Agent: `documentation/ai/agents/translation-agent.md`
