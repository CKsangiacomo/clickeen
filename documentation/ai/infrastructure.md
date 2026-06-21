STATUS: REFERENCE — MUST MATCH RUNTIME
This document is the operational spec for the San Francisco worker: bindings, deploy shape, endpoints, limits, and runbooks.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.
Last synced to repository runtime: June 20, 2026.

# San Francisco — Infrastructure & Operations

## 0) What this covers

This doc is meant to answer:
- What is deployed, where, and with which bindings?
- What endpoints exist and what do they do?
- Where does state live (KV / D1 / R2 / Queues)?
- What are the common failure modes and how do we debug them?

## 1) Deploy model (Cloudflare Worker)

- Code: `sanfrancisco/`
- Entrypoint shell: `sanfrancisco/src/index.ts`
- Product Copilot brain module: `agents/product-copilot/`
- Translation Agent brain module: `agents/translation-agent/`
- Extracted runtime modules:
  - `sanfrancisco/src/concurrency.ts`
  - `sanfrancisco/src/signatures.ts`
  - `sanfrancisco/src/telemetry.ts`
  - `sanfrancisco/src/l10n-routes.ts`
- Wrangler config: `sanfrancisco/wrangler.toml`
- Deploy: GitHub Actions `cloud-dev workers deploy`

Naming:
- Dev worker name defaults to `sanfrancisco-dev` in `sanfrancisco/wrangler.toml`
- Prod uses a separate worker name + bindings; dev D1/R2/KV/Queues are distinct from prod.

## 2) Bindings & environment variables

Bindings (Cloudflare primitives):
- `SF_KV`: KV namespace retained for San Francisco-owned state needs. Product
  Copilot `/v1/execute` no longer stores conversation/thread state in
  San Francisco KV.
- `SF_EVENTS`: Queue used for non-blocking ingestion of interaction events
- `SF_D1`: D1 database for queryable indexes
- `SF_R2`: R2 bucket for raw event payload storage

Worker vars/secrets:
- `ENVIRONMENT`: loose environment label used in logs and the `/healthz` response (`dev`, `prod`, etc)
- `AI_GRANT_HMAC_SECRET` (secret): shared HMAC secret for Clickeen grant verification, outcome signatures, and Prague string translation request signatures
- `DEEPSEEK_API_KEY` (secret, optional): required only when an execution reaches the model provider
- `DEEPSEEK_BASE_URL` (optional): defaults to `https://api.deepseek.com`
- `OPENAI_API_KEY` (secret, optional): required for Paid Standard/Premium tiers and L10n
- `OPENAI_BASE_URL` (optional): defaults to `https://api.openai.com`
- `OPENAI_MODEL`: required for Prague strings L10n; no runtime default is allowed

Provider/model policy:
- `@clickeen/ck-contracts` owns the model catalog.
- `@clickeen/ck-policy` owns the tier + agent runtime policy matrix.
- Roma and San Francisco internal services mint signed grants with direct `AgentRuntimePolicy`.
- San Francisco enforces the signed `modelsByProvider`, `defaultModel`,
  optional `selectedModel`, token ceiling, and timeout ceiling per execution.
  Product Copilot thread-turn state is owned outside San Francisco.
- Model picker availability is driven by signed policy plus explicit callable capability data; conformance reports and `proofRef` fields are release evidence only and are not runtime gates.
- **Prague strings L10n**: local/dev signed tooling route; OpenAI model comes only from required `OPENAI_MODEL`.
- **Account-widget Instance Translation Agent**: `widget.instance.translator`. The translation brain lives in `agents/translation-agent/`; San Francisco remains the grant/model-execution adapter for the existing diagnostic endpoint. Active product generation currently returns unavailable until San Francisco owns a real async generation endpoint, queue production, and operation state. Tokyo-worker owns only exact translated locale overlay storage.

## 3) HTTP endpoints

### `GET /healthz`
Purpose: liveness check and fast sanity during deploys.

Response:
```json
{ "ok": true, "service": "sanfrancisco", "env": "dev", "ts": 1730000000000 }
```

### `POST /v1/execute`
Purpose: execute a named agent under a Clickeen-signed grant.

Behavior (high level):
- Parse `{grant, agentId, input, trace?}`
- Verify grant signature + expiry (`AI_GRANT_HMAC_SECRET`)
- Assert capability `agent:${agentId}`
- Execute the agent/model call without storing Product Copilot session state
- Enqueue an `InteractionEvent` to `SF_EVENTS` (non-blocking)
- Return `{requestId, agentId, result, usage}`

### `POST /v1/outcome`
Purpose: attach post-execution outcomes (conversion + UX decisions) to an execution `requestId`.

Auth:
- Header `x-clickeen-signature` must be present.
- Signature: `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`

Storage:
- Persists to D1 table `copilot_outcomes_v1`.
- Outcome rows may include linkage fields: `outcomeId`, `surfaceId`, and
  `artifactId`. Linkage is not causality; attribution remains future governed
  work.

### `POST /v1/agents/instance-translation/runtime-status`
Purpose: fast readiness check for the account-widget translation model runtime.

Boundary:
- Roma calls this through the explicit `SANFRANCISCO_BASE_URL`.
- The request requires `Authorization: Bearer <AI grant>` with `agent:widget.instance.translator`.
- San Francisco verifies the selected/default provider is configured in the current worker environment.

### `POST /v1/agents/instance-translation/translate-saved-instance`
Purpose: run the account-widget Instance Translation Agent for direct diagnostics and legacy tests. It is not the active product generation path.

Boundary:
- Roma calls this through the explicit `SANFRANCISCO_BASE_URL`.
- The request requires `Authorization: Bearer <AI grant>` with `agent:widget.instance.translator`.
- Tokyo-worker is not a caller and does not queue San Francisco work.

Contract:
- Roma sends only `v`, `widgetType`, `sourceLanguage`, `targetLanguage`, and `items[]` with concrete `path`, `type`, and `value`.
- San Francisco does not receive widget config, wildcard path declarations, account ids, storage paths, live pointer state, publication state, previous values, or patch operations.
- San Francisco derives execution limits from the signed grant and may reduce provider availability only by env reality: providers not configured in the current environment are removed from the allowed set.
- San Francisco returns `{ v: 1, values }` with the exact same path set it received. Missing or extra paths fail visibly.

### `POST /v1/l10n/translate` (local + cloud-dev)
Purpose: translate Prague system-owned base content (prague-l10n pipeline).

Auth:
- Header `x-clickeen-signature` must be present.
- Signature: `base64url(hmacSha256("prague-l10n.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`
- Available only when `ENVIRONMENT` is `local` or `dev`

Provider:
- OpenAI (uses `OPENAI_API_KEY`, `OPENAI_MODEL`)

## 4) State + storage layout (shipped)

### KV

Product Copilot `/v1/execute` is stateless per model call and does not store
conversation/thread state in `SF_KV`.

### Queue (non-blocking ingestion)

`/v1/execute` sends an `InteractionEvent` to the `SF_EVENTS` queue.

Design intent:
- execution must not block on logging/indexing
- ingestion is best-effort; failures log to console and user flow continues

### R2 (bounded raw learning samples)

Queue consumer writes bounded raw JSON samples into R2 using a stable key pattern:
`learning/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`

This allows:
- bounded debug/eval storage for selected paid executions
- offline analysis without turning R2 into a full execution dump

### D1 (queryable indexes)

San Francisco D1 schema is owned by `sanfrancisco/migrations/`, not Worker boot code. Runtime writes:

- `copilot_events_v1`
  - one row per interaction (by `requestId`)
  - indexed by `day`, `envStage`, `surfaceId`, `agentId`, `widgetType`,
    `sessionId`, `intent`, `outcome`
- `copilot_outcomes_v1`
  - one row per `(requestId, event)`
  - stores optional `outcomeId`, `surfaceId`, and `artifactId` linkage fields
  - used for conversion + UX outcome attachment, not automatic causal claims

If D1 schema is missing or stale, migrations must be applied before deploy/runtime verification. Worker code does not create or alter telemetry tables at request time.

## 5) Limits and budgets

### Concurrency
San Francisco applies a per-isolate in-flight cap through `sanfrancisco/src/concurrency.ts` (`MAX_INFLIGHT_PER_ISOLATE`) to fail fast under load.

### Grant budgets
Agent executions are constrained by the grant:
- `budgets.maxTokens`
- `budgets.timeoutMs`

The owning backend surface is expected to cap these budgets server-side so the client can’t request arbitrarily large execution windows.

Canonical runtime budget source:
- `packages/ck-policy/src/ai-runtime.ts` (tier + agent runtime policy matrix)
- `roma/lib/ai/account-copilot.ts` (account-mode grant issuance, usage reservation, and clamp caps)


| Agent | free | tier1 | tier2 | tier3 |
|---|---|---|---|---|
| `cs.widget.copilot.v1` | `650 / 45s / 2` | `900 / 45s / 3` | `1400 / 60s / 3` | `1600 / 60s / 3` |
| `widget.instance.translator` | `900 / 20s / 1` | `1200 / 30s / 1` | `1800 / 45s / 1` | `2200 / 60s / 1` |

Model policy is canonical in `packages/ck-policy/src/ai-runtime.ts` and surfaced in DevStudio from the same source. Tier 2 and Tier 3 can expose a single combined model dropdown for supported customer-facing agents; the underlying signed policy still keeps provider and model separate for enforcement.

## 6) Common failure modes (runbook)

### “Cloudflare 502 HTML page shows up in chat”
Meaning: you’re hitting the wrong base URL (or an upstream is down) and receiving an HTML error document instead of JSON.

Actions:
- Verify the service base URL points to the correct host.
- `curl <sanfranciscoBaseUrl>/healthz` should return JSON with `"ok": true`.
- If you get HTML from `/healthz`, you’re not talking to San Francisco.

### “SanFrancisco not reachable”
Meaning: the caller cannot reach the explicitly configured San Francisco base URL.

Actions:
- Ensure the worker is deployed and the route is correct.
- Ensure `SANFRANCISCO_BASE_URL` is set where the caller runs. Current account
  Builder AI calls run through Roma server routes, not Bob.
- In local dev, set `SANFRANCISCO_BASE_URL=http://localhost:3002` explicitly if you are running San Francisco locally.

### “Missing AI_GRANT_HMAC_SECRET”
Meaning: the worker cannot verify grants or outcome signatures.

Actions:
- Set the secret in Cloudflare Worker settings (dev/prod separately).
- Ensure every live grant/outcome issuer has the same secret configured for its environment.

### “AI provider is unavailable.”
Meaning: execution reached a code path that requires model access, but the selected provider is not configured.

Actions:
- Set the required provider API key in the San Francisco environment.
- Note: many deterministic “clarify/explain/guard” paths work without provider keys.

## 7) Development

Useful checks:
- Use cloud-dev San Francisco for runtime evidence.
- Use `pnpm --filter @clickeen/sanfrancisco typecheck` for package-level checks.
- For Prague strings translation, `AI_GRANT_HMAC_SECRET`, `OPENAI_API_KEY`, and `OPENAI_MODEL` must be set locally.
