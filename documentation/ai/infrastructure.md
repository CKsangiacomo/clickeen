STATUS: REFERENCE — MUST MATCH RUNTIME
This document is the operational spec for the San Francisco worker: bindings, deploy shape, endpoints, limits, and runbooks.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.
Last synced to repository runtime: April 30, 2026.

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
- Extracted runtime modules:
  - `sanfrancisco/src/concurrency.ts`
  - `sanfrancisco/src/signatures.ts`
  - `sanfrancisco/src/telemetry.ts`
  - `sanfrancisco/src/l10n-routes.ts`
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
- `AI_GRANT_HMAC_SECRET` (secret): shared HMAC secret for Clickeen grant verification, outcome signatures, and Prague string translation request signatures
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

Provider/model policy:
- `@clickeen/ck-contracts` owns the model catalog.
- `@clickeen/ck-policy` owns the tier + agent runtime policy matrix.
- Roma and San Francisco internal services mint signed grants with direct `AgentRuntimePolicy`.
- San Francisco enforces the signed `modelsByProvider`, `defaultModel`, optional `selectedModel`, and request ceilings.
- **Prague strings L10n**: `website.prague.copy.translator`, OpenAI via the Prague tooling route.
- **Account-widget instance l10n**: `widget.instance.translator`. Tokyo-worker calls San Francisco through the private `generateAccountWidgetL10nOps` WorkerEntrypoint method with Roma-derived `policyProfile`; San Francisco resolves the runtime policy from `@clickeen/ck-policy` and then intersects it with env-configured providers.

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
- Execute the agent
- Enqueue an `InteractionEvent` to `SF_EVENTS` (non-blocking)
- Return `{requestId, agentId, result, usage}`

### `POST /v1/outcome`
Purpose: attach post-execution outcomes (conversion + UX decisions) to an execution `requestId`.

Auth:
- Header `x-clickeen-signature` must be present.
- Signature: `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`

Storage:
- Persists to D1 table `copilot_outcomes_v1`.

### Private WorkerEntrypoint `generateAccountWidgetL10nOps`
Purpose: generate account-widget locale ops for Tokyo-worker explicit instance-sync flows.

Boundary:
- Tokyo-worker calls this through the private `SANFRANCISCO_L10N` Cloudflare service binding.
- There is no public account-widget l10n generation HTTP route.
- This path does not use `SANFRANCISCO_BASE_URL` or a bearer-token fallback.

Contract:
- Tokyo-worker sends only approved current text items (`path`, `type`, `value`), existing locale ops, changed paths, removed paths, target locales, widget type, base locale, and the account `policyProfile`.
- San Francisco does not receive widget config, localization allowlists, account ids, storage paths, live pointer state, or publication state.
- San Francisco derives the `widget.instance.translator` runtime policy from `policyProfile` and may reduce that provider set only by env reality: providers not configured in the current environment are removed from the allowed set.
- Incremental generation translates only changed current item paths when possible and preserves existing ops for unchanged current paths.

### `POST /v1/l10n/translate` (local + cloud-dev)
Purpose: translate Prague system-owned base content (prague-l10n pipeline).

Auth:
- Header `x-clickeen-signature` must be present.
- Signature: `base64url(hmacSha256("prague-l10n.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`
- Available only when `ENVIRONMENT` is `local` or `dev`

Provider:
- OpenAI (uses `OPENAI_API_KEY`, `OPENAI_MODEL`)

## 4) State + storage layout (shipped)

### KV (hot session state)

KV is used for “chat thread” / short-lived session state (24h TTL).

Example keys (current code):
- `copilot:cs:session:${sessionId}` (CS widget copilot session)

### Queue (non-blocking ingestion)

`/v1/execute` sends an `InteractionEvent` to the `SF_EVENTS` queue.

Design intent:
- execution must not block on logging/indexing
- ingestion is best-effort; failures log to console and user flow continues

### R2 (bounded raw learning samples)

Queue consumer writes bounded raw JSON samples into R2 using a stable key pattern:
`learning/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`

This allows:
- bounded debug/eval storage for selected paid executions and serious paid failures
- offline analysis without turning R2 into a full execution dump

### D1 (queryable indexes)

San Francisco D1 schema is owned by `sanfrancisco/migrations/`, not Worker boot code. Runtime writes:

- `copilot_events_v1`
  - one row per interaction (by `requestId`)
  - indexed by `day`, `envStage`, `agentId`, `widgetType`, `sessionId`, `intent`, `outcome`
- `copilot_outcomes_v1`
  - one row per `(requestId, event)`
  - used for conversion + UX outcome attribution

If D1 schema is missing or stale, migrations must be applied before deploy/runtime verification. Worker code does not create or alter telemetry tables at request time.

## 5) Limits and budgets

### Concurrency
San Francisco applies a per-isolate in-flight cap through `sanfrancisco/src/concurrency.ts` (`MAX_INFLIGHT_PER_ISOLATE`) to fail fast under load.

### Grant budgets
Agent executions are constrained by the grant:
- `budgets.maxTokens`
- `budgets.timeoutMs` (default 20s if omitted)
- `budgets.maxRequests` (optional, for session windows)

The owning backend surface is expected to cap these budgets server-side so the client can’t request arbitrarily large execution windows.

Canonical runtime budget source:
- `packages/ck-policy/src/ai-runtime.ts` (tier + agent runtime policy matrix)
- `roma/lib/ai/account-copilot.ts` (account-mode grant issuance, usage reservation, and clamp caps)

Runtime policy matrix (`maxTokens / timeoutMs / maxRequests`):

| Agent | free | tier1 | tier2 | tier3 |
|---|---|---|---|---|
| `cs.widget.copilot.v1` | `650 / 45s / 2` | `900 / 45s / 3` | `1400 / 60s / 3` | `1600 / 60s / 3` |
| `widget.instance.translator` | `900 / 20s / 1` | `1200 / 30s / 1` | `1800 / 45s / 1` | `2200 / 60s / 1` |
| `website.prague.copy.translator` | `2200 / 60s / 1` | `2200 / 60s / 1` | `2200 / 60s / 1` | `2200 / 60s / 1` |

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
- Ensure `SANFRANCISCO_BASE_URL` is set where the caller runs (Bob, and any Roma server route that calls SF directly).
- In local dev, set `SANFRANCISCO_BASE_URL=http://localhost:3002` explicitly if you are running San Francisco locally.

### “Missing AI_GRANT_HMAC_SECRET”
Meaning: the worker cannot verify grants or outcome signatures.

Actions:
- Set the secret in Cloudflare Worker settings (dev/prod separately).
- Ensure every live grant/outcome issuer has the same secret configured for its environment.

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
  - starts Tokyo (4000), Tokyo Worker (8791), Berlin (3005), Venice (3003), Bob (3000), DevStudio (5173), Prague (4321) and SanFrancisco (3002 if enabled)

Useful checks:
- `curl http://localhost:3002/healthz`
- `curl http://localhost:3001/api/healthz`
- For Prague strings translation, `AI_GRANT_HMAC_SECRET` + `OPENAI_API_KEY` must be set locally.
