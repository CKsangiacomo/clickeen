STATUS: REFERENCE — MUST MATCH RUNTIME
This document is the operational spec for the San Francisco worker: bindings, deploy shape, endpoints, limits, and runbooks.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

# San Francisco — Infrastructure & Operations

## 0) What this covers

This doc is meant to answer:
- What is deployed, where, and with which bindings?
- What endpoints exist and what do they do?
- Where does state live (KV / D1 / R2 / Queues)?
- What are the common failure modes and how do we debug them?

## 1) Deploy model (Cloudflare Worker)

- Code: `sanfrancisco/`
- Entrypoint: `sanfrancisco/src/index.ts`
- Wrangler config: `sanfrancisco/wrangler.toml`
- Deploy: Cloudflare “Workers → Deploy from Git” (root directory: `sanfrancisco`)

Naming:
- Dev worker name defaults to `sanfrancisco-dev` in `sanfrancisco/wrangler.toml`
- Prod uses a separate worker name + bindings; dev D1/R2/KV/Queues are distinct from prod.

## 2) Bindings & environment variables

Bindings (Cloudflare primitives):
- `SF_KV`: KV namespace used for short-lived session state (examples below)
- `SF_EVENTS`: Queue used for non-blocking ingestion of interaction events
- `SF_D1`: D1 database for queryable indexes
- `SF_R2`: R2 bucket for raw event payload storage

Worker vars/secrets:
- `ENVIRONMENT`: loose environment label used in logs and the `/healthz` response (`dev`, `prod`, etc)
- `AI_GRANT_HMAC_SECRET` (secret): shared HMAC secret with Paris (grant verification + outcome signatures)
- `DEEPSEEK_API_KEY` (secret, optional): required only when an execution reaches the model provider
- `DEEPSEEK_BASE_URL` (optional): defaults to `https://api.deepseek.com`
- `DEEPSEEK_MODEL` (optional): defaults to `deepseek-chat`
- `OPENAI_API_KEY` (secret, optional): required for Paid Standard/Premium tiers and L10n
- `OPENAI_MODEL` (optional): defaults to `gpt-5.2`
- `ANTHROPIC_API_KEY` (secret, optional): required for Paid Standard/Premium tiers
- `GROQ_API_KEY` (secret, optional): required for Llama models
- `NOVA_API_KEY` (secret, optional): required for direct Amazon Nova API access
- `NOVA_BASE_URL` (optional): defaults to `https://api.nova.amazon.com/v1`
- `NOVA_MODEL` (optional): defaults to `nova-2-lite-v1`
- `AMAZON_BEDROCK_ACCESS_KEY_ID` / `AMAZON_BEDROCK_SECRET_ACCESS_KEY` / `AMAZON_BEDROCK_REGION` (secret/var, optional): Bedrock fallback path for Amazon provider

Provider split (Tiered Execution):
- **Free / Minibob**: `deepseek-chat` default (agent-scoped alternatives may include Nova Lite)
- **Paid Standard**: mixed provider access (OpenAI/Anthropic/DeepSeek/Groq/Nova) with policy + agent constraints
- **Paid Premium**: higher-capability defaults (OpenAI `gpt-4o`) with policy + agent constraints
- **Curated/Internal**: OpenAI curated set (`gpt-5.2` default)
- **Prague strings L10n**: OpenAI via policy router

## 3) HTTP endpoints

### `GET /healthz`
Purpose: liveness check and fast sanity during deploys.

Response:
```json
{ "ok": true, "service": "sanfrancisco", "env": "dev", "ts": 1730000000000 }
```

### `POST /v1/execute`
Purpose: execute a named agent under a Paris-issued grant.

Behavior (high level):
- Parse `{grant, agentId, input, trace?}`
- Verify grant signature + expiry (`AI_GRANT_HMAC_SECRET`)
- Assert capability `agent:${agentId}`
- Execute the agent
- Enqueue an `InteractionEvent` to `SF_EVENTS` (non-blocking)
- Return `{requestId, agentId, result, usage}`

### `POST /v1/outcome`
Purpose: attach post-execution outcomes (conversion + UX decisions) to an execution `requestId`.

Auth:
- Header `x-paris-signature` must be present.
- Signature: `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`

Storage:
- Persists to D1 table `copilot_outcomes_v1`.

### `POST /v1/l10n/translate` (local + cloud-dev)
Purpose: translate Prague system-owned base content (prague-l10n pipeline).

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`
- Available only when `ENVIRONMENT` is `local` or `dev`

Provider:
- OpenAI (uses `OPENAI_API_KEY`, `OPENAI_MODEL`)

## 4) State + storage layout (shipped)

### KV (hot session state)

KV is used for “chat thread” / short-lived session state (24h TTL).

Example keys (current code):
- `sdrw:session:${sessionId}` (SDR widget copilot session)

### Queue (non-blocking ingestion)

`/v1/execute` sends an `InteractionEvent` to the `SF_EVENTS` queue.

Design intent:
- execution must not block on logging/indexing
- ingestion is best-effort; failures log to console and user flow continues

### R2 (raw events)

Queue consumer writes the raw JSON payload into R2 using a stable key pattern:
`logs/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`

This allows:
- cheap long-term storage
- offline analysis without inflating D1

### D1 (queryable indexes)

San Francisco creates/extends schema on demand (best-effort) and writes:

- `copilot_events_v1`
  - one row per interaction (by `requestId`)
  - indexed by `day`, `envStage`, `agentId`, `widgetType`, `sessionId`, `intent`, `outcome`
- `copilot_outcomes_v1`
  - one row per `(requestId, event)`
  - used for conversion + UX outcome attribution

Note: schema creation is not meant to be a “migration system”; it’s a pragmatic dev-stage bootstrap. If D1 schema needs to be hardened, add explicit migrations and stop doing best-effort `ALTER TABLE` in hot path.

## 5) Limits and budgets

### Concurrency
San Francisco applies a per-isolate in-flight cap in `sanfrancisco/src/index.ts` (`MAX_INFLIGHT_PER_ISOLATE`) to fail fast under load.

### Grant budgets
Agent executions are constrained by the grant:
- `budgets.maxTokens`
- `budgets.timeoutMs` (default 20s if omitted)
- `budgets.maxRequests` (optional, for session windows)

Paris is expected to cap these budgets server-side so the client can’t request arbitrarily large execution windows.

## 6) Common failure modes (runbook)

### “Cloudflare 502 HTML page shows up in chat”
Meaning: you’re hitting the wrong base URL (or an upstream is down) and receiving an HTML error document instead of JSON.

Actions:
- Verify the service base URL points to the correct host.
- `curl <sanfranciscoBaseUrl>/healthz` should return JSON with `"ok": true`.
- If you get HTML from `/healthz`, you’re not talking to San Francisco.

### “SanFrancisco not reachable”
Meaning: Bob can’t probe `/healthz` on any configured/fallback SF base URL.

Actions:
- Ensure the worker is deployed and the route is correct.
- Ensure `SANFRANCISCO_BASE_URL` is set where the caller runs (Bob/Paris).
- In local dev, `bash scripts/dev-up.sh` runs SF on `http://localhost:3002` **when** `AI_GRANT_HMAC_SECRET` is set.

### “Missing AI_GRANT_HMAC_SECRET”
Meaning: the worker cannot verify grants or outcome signatures.

Actions:
- Set the secret in Cloudflare Worker settings (dev/prod separately).
- Ensure Paris has the same secret (they must match).

### “Missing DEEPSEEK_API_KEY”
Meaning: the execution reached a code path that requires model access.

Actions:
- Set `DEEPSEEK_API_KEY` in the San Francisco environment.
- Note: many deterministic “clarify/explain/guard” paths work without provider keys.

## 7) Local development

SanFrancisco only:
- `pnpm dev:sanfrancisco`
- or `pnpm --filter @clickeen/sanfrancisco dev`

Full stack (recommended):
- `bash scripts/dev-up.sh`
  - starts Tokyo (4000), Tokyo Worker (8791), Paris (3001), Venice (3003), Bob (3000), DevStudio (5173), Prague (4321), Pitch (8790) and SanFrancisco (3002 if enabled)

Useful checks:
- `curl http://localhost:3002/healthz`
- `curl http://localhost:3001/api/healthz`
- For Prague strings translation, `PARIS_DEV_JWT` + `OPENAI_API_KEY` must be set locally.
