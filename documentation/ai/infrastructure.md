STATUS: REFERENCE — MUST MATCH RUNTIME
This document is the operational spec for the San Francisco worker: bindings, deploy shape, endpoints, limits, and runbooks.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.
Last synced to repository runtime: February 26, 2026.

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
- `PARIS_DEV_JWT` (secret): internal bearer token for San Francisco internal endpoints (`/v1/l10n*`, `/v1/personalization/*`) and Paris writeback calls
- `PARIS_BASE_URL` (var): required for onboarding persistence path (San Francisco -> Paris workspace profile write)
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
- **Free / Minibob**: profile default `deepseek-chat`; Minibob public grant mint currently defaults request selection to `amazon -> nova-2-lite-v1`
- **Paid Standard**: mixed provider access (OpenAI/Anthropic/DeepSeek/Groq/Nova) with policy + agent constraints
- **Paid Premium**: higher-capability defaults (OpenAI `gpt-5.2`) with policy + agent constraints
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

### `POST /v1/personalization/preview`
Purpose: enqueue acquisition preview personalization job.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`

### `GET /v1/personalization/preview/:jobId`
Purpose: poll preview personalization job status.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`

### `POST /v1/personalization/onboarding`
Purpose: enqueue workspace onboarding personalization job.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`

### `GET /v1/personalization/onboarding/:jobId`
Purpose: poll onboarding personalization job status.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`

### `POST /v1/l10n/plan`
Purpose: generate localization plan snapshot for a widget instance or config payload.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`

### `POST /v1/l10n` (local only)
Purpose: queue instance localization jobs.

Auth:
- `Authorization: Bearer ${PARIS_DEV_JWT}`
- Available only when `ENVIRONMENT` is `local`

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
- `copilot:sdr:session:${sessionId}` (SDR widget copilot session)
- `copilot:cs:session:${sessionId}` (CS widget copilot session)

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

Canonical runtime budget source:
- `tooling/ck-policy/src/ai.ts` (`budgetsByProfile` per agent)
- `paris/src/domains/ai/index.ts` (grant clamp caps + Minibob mint overrides)

Budget matrix (`maxTokens / timeoutMs / maxRequests`):

| Agent | free_low | paid_standard | paid_premium | curated_premium |
|---|---|---|---|---|
| `sdr.widget.copilot.v1` | `650 / 45s / 2` | `900 / 45s / 3` | `1400 / 60s / 3` | `1600 / 60s / 3` |
| `cs.widget.copilot.v1` | `650 / 45s / 2` | `900 / 45s / 3` | `1400 / 60s / 3` | `1600 / 60s / 3` |
| `sdr.copilot` | `280 / 15s / 1` | `600 / 25s / 2` | `900 / 35s / 2` | `1200 / 45s / 2` |
| `l10n.instance.v1` | `900 / 20s / 1` | `1200 / 30s / 1` | `1800 / 45s / 1` | `2200 / 60s / 1` |
| `l10n.prague.strings.v1` | `1500 / 60s / 1` | `1500 / 60s / 1` | `2000 / 60s / 1` | `2200 / 60s / 1` |
| `agent.personalization.preview.v1` | `400 / 25s / 1` | `500 / 30s / 1` | `650 / 30s / 1` | `800 / 30s / 1` |
| `agent.personalization.onboarding.v1` | `900 / 30s / 2` | `1200 / 45s / 2` | `1800 / 60s / 3` | `2200 / 60s / 3` |

Minibob public mint override (Paris endpoint `/api/ai/minibob/grant`):
- `local` stage: `650 / 45s / 2`
- non-local stages (including cloud-dev): `420 / 12s / 2`

### Profile -> model policy (canonical)

`free_low`:
- `deepseek`: default `deepseek-chat` (allowed: `deepseek-chat`)
- `amazon`: default `nova-2-lite-v1` (allowed: `nova-2-lite-v1`)

`paid_standard`:
- `openai`: default `gpt-5-mini` (allowed: `gpt-5-mini`, `gpt-4o-mini`)
- `deepseek`: default `deepseek-chat` (allowed: `deepseek-chat`, `deepseek-reasoner`)
- `anthropic`: default `claude-3-5-sonnet-20240620` (allowed: same)
- `groq`: default `llama-3.3-70b-versatile` (allowed: same)
- `amazon`: default `amazon.nova-pro-v1:0` (allowed: `amazon.nova-lite-v1:0`, `amazon.nova-pro-v1:0`)

`paid_premium`:
- `openai`: default `gpt-5.2` (allowed: `gpt-5-mini`, `gpt-5`, `gpt-5.2`, `gpt-4o`)
- `deepseek`: default `deepseek-reasoner` (allowed: `deepseek-chat`, `deepseek-reasoner`)
- `anthropic`: default `claude-3-5-sonnet-20240620` (allowed: same)
- `groq`: default `llama-3.3-70b-versatile` (allowed: same)
- `amazon`: default `amazon.nova-pro-v1:0` (allowed: `amazon.nova-micro-v1:0`, `amazon.nova-lite-v1:0`, `amazon.nova-pro-v1:0`)

`curated_premium`:
- `openai`: default `gpt-5.2` (allowed: `gpt-5-mini`, `gpt-5`, `gpt-5.2`, `gpt-4o`)

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
  - starts Tokyo (4000), Tokyo Worker (8791), Paris (3001), Venice (3003), Bob (3000), Roma (3004), DevStudio (5173), Prague (4321), Pitch (8790) and SanFrancisco (3002 if enabled)

Useful checks:
- `curl http://localhost:3002/healthz`
- `curl http://localhost:3001/api/healthz`
- For Prague strings translation, `PARIS_DEV_JWT` + `OPENAI_API_KEY` must be set locally.
