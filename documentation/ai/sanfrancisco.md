# San Francisco

STATUS: REFERENCE - MUST MATCH RUNTIME

San Francisco is Clickeen's governed model-execution engine. It is part of the
AI plane, not a product service and not an agent home.

## Role

San Francisco owns:

- provider keys;
- signed AI grant verification;
- `AgentRuntimePolicy` enforcement from the signed grant;
- provider/model request execution;
- typed provider errors;
- model-call trace emission;
- outcome ingestion for agent runs.

San Francisco does not own:

- Product Copilot reasoning;
- Translation Agent reasoning;
- account, tier, or locale decisions;
- saved product data;
- overlay files;
- model catalog maintenance;
- provider catalog monitoring;
- DevOps Agent jobs.

## Runtime Endpoints

```text
GET  /healthz
POST /v1/model/chat
POST /v1/outcome
POST /v1/execute        -> 410, deprecated
POST /v1/l10n/translate -> Prague system-copy tooling only
```

`/v1/model/chat` executes one governed model call for an agent home. The caller
passes a signed grant, `agentId`, messages, and trace data. San Francisco checks
the grant and policy, calls the requested provider/model route, and returns
model content plus usage metadata.

It does not run Product Copilot or Translation Agent logic.

## Model Execution

San Francisco executes the model route contained in the signed runtime policy.
It does not validate model freshness against files in `documentation/`.
Documentation is not runtime input.

The current runtime check is intentionally narrow:

```text
signed grant valid
-> agent id and capability valid
-> requested model route is in the signed policy
-> provider key exists
-> provider call succeeds or returns an explicit error
```

There is no silent fallback. If the configured provider/model route is
unavailable, San Francisco returns an explicit typed error instead of switching
models or providers.

Model catalog monitoring, provider-change detection, conformance runs, and
model-file updates belong to the future DevOps Agent, not to the normal
San Francisco request path.

## Agent Homes

Live agent homes:

- `agents/product-copilot/`
- `agents/translation-agent/`

Agent homes call San Francisco only when they need governed model output.

Product Copilot operates the Builder draft artifact. Translation Agent operates
saved instance content and locale overlay files. San Francisco is the model
execution boundary behind those agents.

## State

San Francisco state is AI-plane telemetry and learning support:

- R2 raw bounded samples;
- D1 event/outcome indexes;
- Queue-based non-blocking event ingestion;
- KV for San Francisco-owned runtime needs.

Product Copilot conversation state does not live in San Francisco. Account
instance source, locale overlays, assets, pages, and public artifacts do not
live in San Francisco.

## Deployment

Runtime path:

```text
sanfrancisco/
sanfrancisco/wrangler.toml
GitHub Actions cloud-dev workers deploy
```

Cloud-dev host:

```text
https://sanfrancisco.dev.clickeen.com
```

Health contract:

```json
{ "ok": true, "service": "sanfrancisco", "env": "<stage>", "ts": 0 }
```

## Links

- AI map: `documentation/ai/README.md`
- Learning loop: `documentation/ai/learning.md`
- Product Copilot: `documentation/ai/agents/product-copilot.md`
- Translation Agent: `documentation/ai/agents/translation-agent.md`
