# Product Copilot

STATUS: CURRENT SYSTEM OPERATOR SPEC

Product Copilot is the current Builder agent home for Bob draft operations and
Builder help.

Code authority:

- `agents/product-copilot/`
- `bob/components/CopilotPane.tsx`
- `bob/lib/session/sessionTransport.ts`
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `roma/lib/ai/account-copilot.ts`

## Runtime Coordinates

| Concern | Current value |
| --- | --- |
| Agent id | `product.copilot` |
| Worker name | `product-copilot-dev` |
| Worker entrypoint | `agents/product-copilot/src/worker.ts` |
| Brain contract | `agents/product-copilot/src/index.ts` |
| Wrangler config | `agents/product-copilot/wrangler.toml` |
| Product caller | Roma account Builder route |
| Model executor | San Francisco `/model/chat` |

## Authority Matrix

| Authority | Owns |
| --- | --- |
| Bob | open Builder draft, visible controls, draft signature, browser-memory apply/undo |
| Roma | current account/session/tier, instance route authority, model selection validation, AI grant minting, usage reservation |
| Product Copilot Worker | Product Copilot reasoning, model prompts, output parsing, `draft_edit` structural validation, one bounded structural retry |
| San Francisco | grant/model enforcement, provider call, usage metadata, telemetry |
| Tokyo-worker | saved account instance storage when the user saves through Roma |

Product Copilot does not save, publish, mutate Tokyo, mint grants, own provider
keys, or decide account permissions.

## Entrypoint Flow

```text
Bob CopilotPane
-> session.apiFetch('/api/ai/widget-copilot')
-> Bob hosted session dispatch command: run-copilot
-> Roma POST /api/account/instances/[instanceId]/copilot
-> Roma loads current instance and validates account/instance authority
-> Roma validates optional selectedModel
-> Roma mints AI grant and reserves copilot usage
-> Roma calls Product Copilot Worker POST /execute
-> Product Copilot calls San Francisco POST /model/chat
-> Product Copilot returns ProductCopilotResponse
-> Bob applies draft_edit in browser memory only, if valid and draft signature still matches
```

## Roma Grant And Model Policy

Roma mints the Product Copilot grant in `roma/lib/ai/account-copilot.ts`.

Grant facts:

- issuer: `roma`;
- subject: current authenticated user/account;
- cap: `agent:product.copilot`;
- mode: `editor`;
- trace surface: `roma.builder`;
- model policy: resolved from `packages/ck-policy/ai-runtime.matrix.json`;
- optional selected model: accepted only if managed by
  `isProductCopilotManagedModel`.

Product Copilot passes the grant to San Francisco. San Francisco enforces the
canonical agent id, capability, budget, and model policy.

## Worker HTTP Contract

Health:

```text
GET /healthz
HEAD /healthz
```

Execute:

```text
POST /execute
```

Worker request:

```json
{
  "grant": "ckgrant.<payload>.<signature>",
  "agentId": "product.copilot",
  "input": {
    "instanceId": "QD1G068MX7",
    "sessionId": "browser-session-id",
    "userMessage": "Change the button text",
    "context": {
      "instanceId": "QD1G068MX7",
      "widgetType": "faq",
      "displayName": "FAQ",
      "activeLocale": "en",
      "draftSignature": "signature",
      "controls": [],
      "availableActions": ["draft_edit"],
      "unavailableCapabilities": [
        "saved-product-mutation",
        "publish",
        "translation-generation",
        "analytics-lookup",
        "child-agent-call"
      ],
      "traceRequestId": "uuid",
      "selectedControlPath": "optional.path"
    },
    "conversationHistory": [
      { "role": "user", "text": "previous turn" },
      { "role": "assistant", "text": "previous answer" }
    ]
  },
  "trace": {
    "client": "roma",
    "requestId": "uuid"
  }
}
```

Worker response:

```json
{
  "requestId": "uuid",
  "agentId": "product.copilot",
  "result": {
    "kind": "answer",
    "message": "..."
  },
  "usage": {
    "provider": "openai",
    "model": "gpt-5.4-mini",
    "promptTokens": 0,
    "completionTokens": 0,
    "latencyMs": 0
  }
}
```

## Input Envelope

Input type: `ProductCopilotRequestEnvelope` in
`packages/ck-contracts/src/ai.ts`.

Required route-level fields:

- `instanceId`
- `sessionId`
- `userMessage`
- `context`

Required context fields:

- `instanceId`
- `widgetType`
- `displayName`
- `activeLocale`
- `draftSignature`
- `controls`
- `availableActions`
- `unavailableCapabilities`
- `traceRequestId`

Optional fields:

- `context.selectedControlPath`
- `conversationHistory`
- Roma request `selectedModel`

Roma validates the envelope before calling Product Copilot. Product Copilot
also validates its input shape through `executeProductCopilot`.

## Context Capsule Rules

The context capsule includes only current Builder-turn facts:

- current instance id;
- widget type/display name;
- active locale;
- draft signature;
- visible editable controls and values;
- available draft actions;
- unavailable capabilities;
- bounded conversation history.

The capsule must not include hidden controls, unrelated account data, cross
account data, widget package source, saved-product mutation authority, or other
product domains.

If required widget/session context is invalid, the turn fails. If edit controls
are unavailable or invalid, `draft_edit` is unavailable for that turn; the agent
may still return another valid output kind.

## Output Union And Draft Ops

Output type: `ProductCopilotResponse` in `packages/ck-contracts/src/ai.ts`.

Allowed `kind` values:

- `answer`
- `clarification`
- `suggestion`
- `draft_edit`
- `refusal`
- `error`

Allowed draft ops:

- `set`
- `insert`
- `remove`
- `move`

Product Copilot validates returned draft ops structurally before returning them
to Roma/Bob. It does not apply them.

## Bob Apply And Persistence Boundary

Bob applies `draft_edit` only when:

- the current draft signature still matches the request signature;
- inverse undo ops can be built;
- `session.applyOps(ops)` succeeds.

Apply is browser-memory only. User save remains a Roma account operation. Publish
remains Roma-owned. Tokyo persistence is not touched by Product Copilot.

Bob reports outcomes through `/api/ai/outcome`, which routes through Roma to San
Francisco `/outcome`.

## Error Contract

| Surface | Status/result | Cause |
| --- | --- | --- |
| Roma route | `422` | invalid envelope or selected model |
| Roma route | `403` | account/tier/model/usage denial |
| Product Copilot Worker | `400 BAD_REQUEST` | invalid worker request or invalid Product Copilot input |
| Product Copilot Worker | `404 BAD_REQUEST` | unknown worker path |
| Product Copilot Worker | `500 PROVIDER_ERROR` | missing San Francisco config or unexpected failure |
| Product Copilot result | `kind: "error"` | brain could not produce valid output after bounded structural retry |
| Bob | assistant message, no apply | stale draft signature, invalid ops, failed undo construction, failed apply |

## Runtime Config And Deploy

`agents/product-copilot/wrangler.toml`:

- `ENVIRONMENT = "dev"`
- `SANFRANCISCO_BASE_URL = "https://sanfrancisco.dev.clickeen.com"`
- service binding `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev`

Product Copilot uses the service binding when present and falls back to
`SANFRANCISCO_BASE_URL` otherwise.

Deploy evidence comes from the GitHub Actions `cloud-dev workers deploy`
workflow after pushing `main`.

## Verification

Local checks:

```bash
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
```

Runtime health:

```bash
curl -s https://product-copilot-dev.clickeen.workers.dev/healthz
```

Deploy state:

```bash
gh run list --branch main --limit 10
```
