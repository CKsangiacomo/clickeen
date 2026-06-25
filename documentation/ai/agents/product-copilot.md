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
- `roma/app/api/account/instances/[instanceId]/copilot/outcome/route.ts`

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
| Worker service binding | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` |

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
-> Roma POST /api/account/instances/[instance id]/copilot
-> Roma loads current instance and validates account/instance authority
-> Roma validates optional selectedModel
-> Roma mints AI grant and reserves copilot usage
-> Roma calls Product Copilot Worker POST /execute
-> Product Copilot calls San Francisco POST /model/chat
-> Product Copilot returns ProductCopilotResponse
-> Bob applies draft_edit in browser memory only, if valid and draft signature still matches
```

Bob's `/api/ai/widget-copilot` and `/api/ai/outcome` are synthetic session APIs
inside the hosted Builder transport. In hosted Roma mode they are not Bob HTTP
routes. Bob delegates them to the parent Roma host through `postMessage`
commands:

| Bob synthetic path | Hosted command | Roma route |
| --- | --- | --- |
| `/api/ai/widget-copilot` | `run-copilot` | `POST /api/account/instances/[instance id]/copilot` |
| `/api/ai/outcome` | `attach-ai-outcome` | `POST /api/account/instances/[instance id]/copilot/outcome` |

The hosted command timeout for both Copilot turns and outcome attach is
`120_000ms`.

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

Roma route/operator requirements:

- route requires current account role `editor`;
- route `instanceId` must match envelope `instanceId` and
  `context.instanceId`;
- Roma loads the saved Tokyo instance before grant issuance;
- `context.widgetType` must match the saved instance widget type;
- selected model must be Product Copilot managed;
- monthly Copilot turn usage is reserved before the worker call;
- grant TTL is 10 minutes;
- grant budgets come from the runtime policy matrix;
- `USAGE_KV` is used for monthly turn reservation when present.

Roma env/bindings involved in the Copilot path:

| Roma env/binding | Required | Used for |
| --- | --- | --- |
| `PRODUCT_COPILOT_BASE_URL` | yes | Roma HTTP call to Product Copilot `/execute` |
| `SANFRANCISCO_BASE_URL` | yes for outcome forwarding | Roma HTTP call to San Francisco `/outcome` |
| `AI_GRANT_HMAC_SECRET` | yes | grant minting and outcome signing |
| `USAGE_KV` | yes for usage enforcement | monthly Copilot turn reservation |

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
  "grant": "[signed grant]",
  "agentId": "product.copilot",
  "input": {
    "instanceId": "[instance id]",
    "sessionId": "[browser session id]",
    "userMessage": "[user message]",
    "context": {
      "instanceId": "[instance id]",
      "widgetType": "[widget type]",
      "displayName": "[widget display name]",
      "activeLocale": "[active locale]",
      "draftSignature": "[draft signature]",
      "controls": [],
      "availableActions": ["draft_edit"],
      "unavailableCapabilities": [
        "saved-product-mutation",
        "publish",
        "translation-generation",
        "analytics-lookup",
        "child-agent-call"
      ],
      "traceRequestId": "[request id]",
      "selectedControlPath": "[selected control path]"
    },
    "conversationHistory": [
      { "role": "user", "text": "[previous user turn]" },
      { "role": "assistant", "text": "[previous assistant turn]" }
    ]
  },
  "trace": {
    "client": "roma",
    "requestId": "[request id]"
  }
}
```

`agentId` may be omitted in the Worker request. If present, it must be exactly
`product.copilot`.

Required headers on Roma -> Product Copilot:

```text
content-type: application/json
x-request-id: [current request id when available]
```

Required headers on Product Copilot -> San Francisco:

```text
content-type: application/json
x-request-id: [request id]
```

Worker response shape:

```json
{
  "requestId": "[request id]",
  "agentId": "product.copilot",
  "result": {
    "kind": "answer",
    "message": "[assistant message]"
  },
  "usage": {
    "provider": "[provider selected by signed grant]",
    "model": "[model returned by provider]",
    "promptTokens": "[prompt token count]",
    "completionTokens": "[completion token count]",
    "latencyMs": "[latency ms]"
  }
}
```

`usage` is not invented by Product Copilot. The worker passes through the
successful San Francisco provider usage. A successful response must not be
documented with zero token counts unless the upstream provider actually returns
zero, and provider/model values must be read from the signed grant/provider
result, not hardcoded in this operator doc.

Roma's browser-facing response is not the raw Worker response. Roma strips
Worker `usage` and returns the agent result with request metadata for Bob:

```json
{
  "kind": "answer",
  "message": "[assistant message]",
  "meta": {
    "requestId": "[request id]"
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
- `availableActions`
- `unavailableCapabilities`
- `traceRequestId`

Optional route/runtime fields:

- `context.selectedControlPath`
- `conversationHistory`
- Roma request `selectedModel`

Roma validates the envelope before calling Product Copilot. Product Copilot also
validates its input shape through `executeProductCopilot`.

The shared TypeScript contract requires `context.controls`. Current Roma route
and Product Copilot runtime still tolerate missing, empty, or invalid controls;
that degrades the edit context and may make `draft_edit` unavailable, but a
conversational answer/clarification/refusal can still be a valid turn.

Current input limits:

- conversation history: at most 8 messages;
- conversation message text: at most 2,000 characters per message;
- edit context prompt: at most 120,000 characters.

## Context Capsule Rules

The context capsule includes only current Builder-turn facts:

- current instance id;
- widget type/display name;
- active locale field from the current Bob context. Current Bob code populates
  this from `chrome.meta.baseLocale`; it is not the account active-locale list.
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

Current outcome behavior:

- Bob emits outcome attachments for `edit_applied` and `edit_undone`;
- stale draft signature, invalid undo construction, failed apply, non-edit
  responses, and request errors do not currently attach outcome events;
- Roma outcome route requires only current account role `viewer`;
- invalid/skipped/forward-failed outcomes return HTTP `200` to Bob with
  `{ ok: false }` or a skipped payload;
- free learning profiles are skipped and are not forwarded to San Francisco;
- paid profiles are signed by Roma and forwarded to San Francisco `/outcome`.

Outcome forwarding headers:

```text
content-type: application/json
x-clickeen-signature: hmacSha256("outcome.[body text]", AI_GRANT_HMAC_SECRET)
```

HTTP `200` from Roma's outcome route is not proof that San Francisco persisted
the outcome. Inspect San Francisco D1 when outcome persistence matters.

## Error Contract

| Surface | Status/result | Cause |
| --- | --- | --- |
| Roma route | `422` | invalid envelope or selected model |
| Roma route | `403` | account/tier/model/usage denial |
| Roma route | `503` | usage reservation dependency unavailable |
| Roma route | `502` | Product Copilot fetch failure or route catch failure |
| Product Copilot Worker | `400 BAD_REQUEST` | invalid worker request or invalid Product Copilot input |
| Product Copilot Worker | `404 BAD_REQUEST` | unknown worker path |
| Product Copilot Worker | upstream status | San Francisco non-OK response is propagated |
| Product Copilot Worker | `502 PROVIDER_ERROR` | invalid San Francisco model response |
| Product Copilot Worker | `500 PROVIDER_ERROR` | missing San Francisco config or unexpected failure |
| Product Copilot result | `kind: "error"` | brain could not produce valid output after bounded structural retry |
| Bob | assistant message, no apply | stale draft signature, invalid ops, failed undo construction, failed apply |

## Runtime Config And Deploy

`agents/product-copilot/wrangler.toml`:

- `ENVIRONMENT = "dev"`
- service binding `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev`

Product Copilot uses only the `SANFRANCISCO_AI_ENGINE` service binding for model
execution. If the binding is missing, the Worker returns an explicit
`500 PROVIDER_ERROR`.

Deploy evidence comes from the GitHub Actions `cloud-dev workers deploy`
workflow after pushing `main`.

## Verification

Local checks:

```bash
pnpm --filter @clickeen/product-copilot typecheck
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
pnpm e2e:smoke:copilot-runtime
```

Runtime health:

```bash
curl -s https://product-copilot-dev.clickeen.workers.dev/healthz
```

Deploy state:

```bash
gh run list --branch main --limit 10
```

Direct package deploy:

```bash
pnpm -C agents/product-copilot run deploy
```

Normal cloud-dev deploy evidence comes from the GitHub Actions
`cloud-dev workers deploy` workflow after changes to `agents/product-copilot/**`,
`packages/ck-contracts/**`, `packages/ck-policy/**`, `scripts/infra/**`, or the
workflow file.

## Operator Debug Sequence

1. Capture the Bob/Roma request id from UI logs or response metadata.
2. If Bob cannot reach `/api/ai/widget-copilot`, verify hosted mode delegated the
   `run-copilot` command to Roma and did not hit a raw Bob HTTP route.
3. If Roma returns `422`, inspect envelope instance/widget/context validation.
4. If Roma returns `403`, inspect tier/model/usage policy.
5. If Roma returns `503`, inspect `USAGE_KV` and account usage reservation.
6. If Product Copilot returns provider/model error, inspect San Francisco health,
   grant policy, and selected provider secret.
7. If an edit response is visible but not applied, inspect Bob draft signature,
   inverse undo construction, and `session.applyOps`.
8. If outcome evidence is missing, remember only applied/undone edits attach
   outcomes today and Roma may return HTTP `200` even when forwarding failed.
