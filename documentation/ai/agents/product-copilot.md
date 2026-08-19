# Product Copilot

STATUS: CURRENT SYSTEM OPERATOR SPEC

Product Copilot is the current Builder agent home for Bob draft operations and
Builder help.

Code authority:

- `agents/product-copilot/`
- `bob/components/CopilotPane.tsx`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/copilot/model-history.ts`
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
| Model executor | San Francisco `/model/turn` (stream mode) |
| Worker service binding | `SANFRANCISCO_AI_ENGINE -> sanfrancisco-dev` |

## Authority Matrix

| Authority | Owns |
| --- | --- |
| Bob | open Builder draft, visible controls, draft signature, browser-memory apply/undo |
| Roma | current account/session/tier, instance route authority, model selection validation, AI grant minting, usage reservation |
| Product Copilot Worker | Product Copilot reasoning, model prompts, native `apply_widget_ops` tool definition, tool-call and step-boundary enforcement, San Francisco event relay |
| San Francisco | grant/model enforcement, provider call, and returned usage metadata |
| Tokyo-worker | saved account instance storage when the user saves through Roma |

Product Copilot does not save, publish, mutate Tokyo, mint grants, own provider
keys, or decide account permissions.

## Entrypoint Flow

```text
Bob CopilotPane
-> Bob hosted session dispatch command: run-copilot
-> Roma POST /api/account/instances/[instance id]/copilot (SSE relay)
-> Roma loads current instance and validates account/instance authority
-> Roma validates CopilotTurnRequest via shared parseCopilotTurnRequest
-> Roma validates optional selectedModel
-> Roma mints AI grant and reserves copilot usage (initial turn only)
-> Roma calls Product Copilot Worker POST /turn and pipes the SSE stream through
-> Product Copilot calls San Francisco POST /model/turn (stream mode)
-> San Francisco streams text_delta / tool_call / model_step_finished / model_step_error
-> Product Copilot relays as ProductCopilotTurnEvent (agent_turn_started, text_delta, tool_call, model_step_finished, agent_turn_finished, agent_turn_error, agent_turn_stopped)
-> Bob executes apply_widget_ops only after model_step_finished, then sends a continuation with priorModelStepId
```

Bob's Copilot turn is dispatched through the hosted `run-copilot` command. In
hosted Roma mode it is not a Bob HTTP route. Bob delegates it to the parent Roma
host through a `postMessage` command:

| Bob command | Roma route |
| --- | --- |
| `run-copilot` | `POST /api/account/instances/[instance id]/copilot` |

The hosted Copilot command timeout is `120_000ms`. Copilot event frames are
delivered to Bob through `host:copilot-event` messages keyed by `requestId`.

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
- selected model must be Product Copilot managed;
- the grant is minted before usage reservation, so missing signing configuration
  cannot consume a turn;
- monthly Copilot turn usage is reserved before the worker call, initial turns
  only (continuations pass `skipTurnReservation`);
- grant TTL is 10 minutes;
- grant budgets come from the runtime policy matrix;
- Roma fails closed if `USAGE_KV` is unavailable or contains a malformed
  counter.

The route reads the exact account-scoped saved-instance fact to authorize the
browser-supplied route before grant issuance. It does not reload saved source or
cross-check the accepted turn against a second copy of the instance. Roma owns
browser-request admission and route authorization once; Product Copilot then
trusts the exact Roma-issued request and grant.

Roma env/bindings involved in the Copilot path:

| Roma env/binding | Required | Used for |
| --- | --- | --- |
| `PRODUCT_COPILOT_BASE_URL` | yes | Roma HTTP call to Product Copilot `/turn` |
| `ROMA_AI_GRANT_PRIVATE_KEY_PEM` | yes | Roma-only RS256 grant minting |
| `USAGE_KV` | yes | monthly Copilot turn reservation |

## Worker HTTP Contract

Health:

```text
GET /healthz
HEAD /healthz
```

Turn (the native tool agent streaming endpoint):

```text
POST /turn
```

The deprecated non-streaming endpoint is closed:

```text
POST /execute -> 410
```

`/turn` returns `content-type: text/event-stream` and never returns a single JSON
body. Roma pipes the stream through to Bob transparently.

Worker request is a `CopilotTurnRequest` (see Input Envelope below). The
six-kind JSON `ProductCopilotResponse` protocol is deleted; the agent emits
normal assistant text streams plus native `apply_widget_ops` tool calls.

Required headers on Roma -> Product Copilot:

```text
content-type: application/json
accept: text/event-stream
x-request-id: [current request id when available]
```

Required headers on Product Copilot -> San Francisco:

```text
content-type: application/json
x-request-id: [request id]
```

Worker response is an SSE stream of `ProductCopilotTurnEvent` frames. Each frame
is one `event: [type]\ndata: [json]\n\n` block. The exact event union is
`ProductCopilotTurnEvent` in `packages/ck-contracts/src/ai.ts`:

| Event type | Carries | `modelStepId` |
| --- | --- | --- |
| `agent_turn_started` | turn opened by the agent | absent |
| `text_delta` | incremental assistant text | required |
| `tool_call` | one `apply_widget_ops` invocation (`toolCallId`, `toolName`, `input`) | required |
| `model_step_finished` | step terminal (`finishReason`, requested/reported model, token usage, latency) | required |
| `agent_turn_finished` | turn completed (only on a `stop` finish) | absent |
| `agent_turn_error` | turn failed visibly (`code`, `reasonKey`, `message`, optional `requestId`) | absent |
| `agent_turn_stopped` | turn cancelled by caller Stop | absent |

`agent_turn_started` is emitted only on the initial request, never on
continuations. Every step-level event (`text_delta`, `tool_call`,
`model_step_finished`) carries the `modelStepId` minted by San Francisco;
Product Copilot trusts that San-Francisco-produced coordinate and does not
recheck its presence against a second event schema.

Tool calls execute only after `model_step_finished`. Product Copilot rejects
more than one tool call in a single step as a visible `agent_turn_error`; Bob
sees the first `tool_call` followed by the error and does not execute. On a
`tool-calls` finish reason the stream closes cleanly at the step boundary; Bob
executes the tool and opens a continuation. On a `stop` finish reason
`agent_turn_finished` follows.

SSE framing is transport serialization. Product Copilot decodes it with one
streaming `TextDecoder` and consumes San Francisco's exact event union; it does
not semantically revalidate event names, payload types, or `modelStepId` values.

The Product Copilot SSE parser performs only transport work: streaming decode,
CRLF normalization, frame extraction, and JSON decode. Malformed JSON fails
visibly as a transport failure. It does not compare the SSE event name with the
payload type or re-prove San Francisco's `modelStepId` and event schema.
Product Copilot separately enforces the governed one-tool-call model-step
boundary, including finish/tool-count consistency and a visible failure when a
stream ends without a terminal or valid continuation boundary. It transports
the model's `apply_widget_ops` request; Bob accepts or rejects that external edit
request against the exact compiled controls and current draft.

Provider usage is not invented by Product Copilot. `model_step_finished`
forwards the San Francisco reported model and token counts verbatim.

## Input Envelope

Input type: `CopilotTurnRequest` in
`packages/ck-contracts/src/ai.ts`. The request is one of two disjoint kinds:

- `initial`: opens a new user turn. Carries `userMessage`.
- `continuation`: resumes after a tool step. Carries `priorModelStepId`,
  `toolCallId`, `toolName` (exactly `apply_widget_ops`), and `toolResult`.

Both kinds carry `version`, `sessionId`, `userTurnId`, optional `selectedModel`,
`conversationHistory`, and `currentDraftContext`. Required `currentDraftContext`
fields:

- `instanceId`
- `widgetType`
- `displayName`
- `activeLocale`
- `draftSignature`
- `controls`
- `availableActions`
- `unavailableCapabilities`

Optional context field:

- `currentDraftContext.selectedControlPath`

Roma accepts the browser-originated turn request once through
`parseCopilotTurnRequest` in `@clickeen/ck-contracts/ai`, binds it to the
authorized route instance, and sends one exact Clickeen request with its signed
grant. Product Copilot trusts that Roma-produced request; it does not parse the
same semantic contract again. The deploy-built control capsule is exact system
truth and is not treated as a possibly malformed optional edit context.

Product Copilot consumes the shared accepted `CopilotTurnRequest` union directly
and does not call the browser-ingress parser again. Bob projects visible
controls from the exact compiled artifact and current draft; when no controls
are currently visible, `availableActions` truthfully contains no `draft_edit`
action rather than inventing edit availability.

Current input limits:

- conversation history: at most `COPILOT_MAX_HISTORY_ENTRIES` (8) entries;
- conversation message text: at most `COPILOT_MAX_HISTORY_TEXT_CHARS` (2,000)
  characters per entry.

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

Roma owns the authorized Widget/session coordinate and sends its exact capsule.
Product Copilot uses that capsule directly. A genuine Roma operation failure
ends before agent invocation; the agent does not invent a degraded substitute
for a Clickeen-produced control surface.

## Tool Agent And Draft Ops

The agent emits normal assistant text (streamed as `text_delta`) and may invoke
one native tool, `apply_widget_ops`, to edit the draft. The six-kind JSON
`ProductCopilotResponse` output union is deleted; there are no
`answer`/`clarification`/`suggestion`/`draft_edit`/`refusal`/`error` result
kinds on the wire. Clarifications, suggestions, and refusals are plain assistant
text.

Tool definition authority: `APPLY_WIDGET_OPS_TOOL` in
`agents/product-copilot/src/index.ts`. Its input is one ordered `ops` array
applied atomically. Allowed op types:

- `set`
- `insert`
- `remove`
- `move`

Each op targets a `path` from the provided editable controls. Product Copilot
enforces at most one `apply_widget_ops` call per model step; more than one model
call is rejected as a visible `agent_turn_error`. It transports that external
tool request to Bob after `model_step_finished`. Product Copilot does not apply
or accept the edit operations itself.

## Bob Apply And Persistence Boundary

Bob buffers a `tool_call` event and applies its `apply_widget_ops` batch only
after the matching `model_step_finished` arrives (same `modelStepId`). Apply
requires:

- the current draft signature still matches the request signature;
- inverse undo ops can be built;
- `session.applyOps(ops)` succeeds.

The draft-signature comparison is Bob's real concurrency coordinate: a human
may have changed Bob's browser-memory draft while the turn was running. Bob is
also the first edit-operation acceptance boundary: it accepts the external
tool request against the exact compiled controls and current draft, including
the authored collection minimum/maximum, then applies the accepted batch
atomically. This is not a second Product Copilot allowlist; Product Copilot
only owns the model-step/tool-call envelope.

On success Bob opens a continuation with `priorModelStepId`, sending the tool
result back so the agent can finish or request another step. Undo ops accumulate
across the steps of one turn so a single Undo can reverse the whole applied
batch. Bob's model history (`bob/lib/copilot/model-history.ts`) is the structured
turn log sent on each request and is separate from the visible text-only chat
bubbles.

Bob gives each unresolved visible assistant message the passive status
`Working`. A text-only successful terminal event removes that status without
inventing an edit result. Bob changes the exact narration to `Applied` only
after `session.applyOps` succeeds. A request, stream, or apply failure becomes
`Not applied`; Stop marks only unresolved work `Stopped` and preserves any
already-applied edit and Undo. Those four words are Bob presentation state:
they are not Product Copilot events, model-history fields, outcome messages,
learning records, or persisted truth, and streamed assistant text remains exact.

Apply is browser-memory only. User save remains a Roma account operation.
Publish remains Roma-owned. Tokyo persistence is not touched by Product Copilot.
Bob does not send apply or Undo activity to a separate outcome or learning route.
Apply and Undo remain local editor operations.

## Error Contract

| Surface | Status/result | Cause |
| --- | --- | --- |
| Roma route | `422` | invalid turn request or selected model |
| Roma route | `403` | account/tier/model/usage denial |
| Roma route | `503` | usage reservation dependency unavailable |
| Roma route | `502` | Product Copilot fetch failure or route catch failure |
| Product Copilot Worker | `410` | deprecated `POST /execute` |
| Product Copilot Worker | `400 BAD_REQUEST` | malformed JSON transport body |
| Product Copilot Worker | `404 BAD_REQUEST` | unknown worker path |
| Product Copilot Worker | upstream status | San Francisco non-OK response is propagated |
| Product Copilot Worker | `500 PROVIDER_ERROR` | missing San Francisco config or unexpected failure |
| Product Copilot stream | `agent_turn_error` event | multiple model tool calls, finish/tool-count inconsistency, missing terminal/continuation boundary, malformed SSE JSON transport, or `model_step_error` |
| Bob | `Not applied` plus assistant error, no apply | request/stream failure, stale draft signature, failed undo construction, or failed local apply |

Product Copilot trusts Roma's accepted request and San Francisco's typed event
payloads. Bob remains the first edit-operation acceptance boundary for the
external model's tool request.

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
pnpm --filter @clickeen/product-copilot test:turn-contract
pnpm --filter @clickeen/product-copilot test:full-loop
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
`packages/ck-contracts/**`, `packages/ck-policy/**`, or the
workflow file.

## Operator Debug Sequence

1. Capture the Bob/Roma request id from UI logs or `host:copilot-event` frames.
2. If Bob shows no turn activity, verify hosted mode delegated the `run-copilot`
   command to Roma rather than hitting the Bob-local `/api/ai/widget-copilot`
   guard route (`409`).
3. If Roma returns `422`, inspect the `parseCopilotTurnRequest` issues and the
   instance/widget context validation.
4. If Roma returns `403`, inspect tier/model/usage policy.
5. If Roma returns `503`, inspect `USAGE_KV` availability and the exact account
   counter value.
6. If the stream emits `agent_turn_error`, inspect the event `code`/`reasonKey`:
   `PROVIDER_ERROR` points at San Francisco health, grant policy, and selected
   provider secret; `BUDGET_EXCEEDED` points at the signed timeout or step/token
   ceiling; other codes point at protocol enforcement (multiple tool calls,
   missing `modelStepId`, malformed SSE).
7. If a tool batch is visible but not applied, inspect Bob draft signature,
   inverse undo construction, `model_step_finished` correlation, and
   `session.applyOps`.
