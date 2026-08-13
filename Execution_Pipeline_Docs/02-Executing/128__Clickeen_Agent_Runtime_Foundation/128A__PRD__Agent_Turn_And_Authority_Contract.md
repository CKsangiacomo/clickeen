# PRD 128A — Agent Turn And Authority Contract

Status: **EXECUTING — CONTRACT DEFINED; IMPLEMENTATION NOT STARTED**

Depends on: PRD 128 parent

## 1. Purpose

Define Clickeen's model-turn, tool-call, observation, completion, and authority
contract before installing the AI SDK or changing either current agent.

This PRD defines one shared model-execution language for the two agents that
exist. It does not define a universal product-agent framework.

## 2. Core Contract

### Exact terms

- **User turn** — one user submission in Product Copilot, from submission until
  explicit completion, visible failure, or Stop. One user turn consumes one
  `copilot.turns.monthly.max` unit.
- **Model step** — one exact provider request and response inside a user turn.
- **Tool round** — one model step that ends with one complete tool call,
  followed by Bob's exact tool result and a continuation model step.
- **Translation chunk call** — one governed model request for one existing
  Translation Agent chunk. It is not a Product Copilot user turn or tool round.

The current AI runtime matrix exposed in DevStudio remains the tier-policy
authority. Product Copilot keeps the existing tier-specific 8/16/30/50
`maxTurnsPerThread` values, per-call token budgets, and per-call timeouts. In
the rebuilt loop, a model step is one turn within Bob's open Copilot thread;
tool-result continuations use that same thread budget. One submitted user
message still consumes one `copilot.turns.monthly.max` unit; internal
tool-result continuations do not consume additional monthly units.

Translation Agent keeps its current value of one because each translation
chunk is one governed model call. Its existing total-item, total-character,
locale, per-call token, and per-call timeout limits continue to bound the full
translation operation. No second policy matrix, Product-Copilot-only limit
fields, or universal agent-step policy is introduced.

### Governed model turn

```text
agentId
+ signed Roma grant
+ ordered model messages
+ optional exact tool definitions
+ optional exact structured-output definition
+ execution mode
+ trace coordinate
-> San Francisco
-> exact allowed provider/model
-> ordered model events or exact structured result
```

The one San Francisco endpoint is:

```text
POST /model/turn
```

It accepts version `1` of the Clickeen-owned request contract in either
`stream` or `structured` mode. `/model/chat` is deleted when both callers move.

### Interactive tool cycle

```text
model text or tool call
-> agent home returns product-facing event
-> owning product surface executes the tool
-> exact result or exact error
-> agent home adds the observation to the next model turn
-> model continues or finishes
```

## 3. Contract Types

The implementation must define Clickeen-owned types rather than exposing AI SDK
types as product contracts.

Required request concepts:

- `version: 1`;
- `agentId` — one of the two registered current agent ids;
- `grant` — exact Roma-signed grant;
- `messages` — ordered system/user/assistant/tool history needed for this turn;
- `tools` — optional named JSON-schema tool definitions supplied by the agent
  home;
- `toolChoice` — optional exact choice only when the agent contract requires it;
- `output` — text/tool mode or exact structured-output schema;
- `temperature` — only when supported and allowed;
- `trace` — request and caller coordinates already supported by the product;
- `mode: stream | structured`.

San Francisco model-step events are exactly:

- `text_delta` — ordered model-authored text;
- `tool_call` — one complete call with provider `toolCallId`, name, and exact
  arguments;
- `model_step_finished` — provider finish reason, signed `requestedProvider`,
  signed `requestedModel`, exact provider-reported `reportedModel`,
  prompt/completion usage, and latency;
- `structured_result` — exact schema output for structured mode;
- `model_step_error` — one explicit contract, policy, budget, provider,
  malformed-output, interruption, or cancellation failure.

Every event has `{ version: 1, modelStepId, type, data }`. Stream mode uses
`text/event-stream`; the SSE event name equals `type` and `data` is that one
JSON event. A successful stream has exactly one terminal
`model_step_finished`; a failed/interrupted/canceled stream has exactly one
terminal `model_step_error` when transport still permits it. Structured mode
returns one JSON `structured_result` plus the same model-step finish metadata,
or one `model_step_error`.

`model_step_error.data` is exactly:

```text
{
  code,
  reasonKey,
  message,
  provider?,
  upstreamStatus?,
  issues?,
  requestId
}
```

Known product callers resolve `reasonKey` to user copy. `message`, provider
metadata, and issues remain exact agent/operational truth and are not blindly
rendered to users.

Product Copilot additionally owns the product-facing turn events
`agent_turn_started`, `agent_turn_finished`, `agent_turn_error`, and
`agent_turn_stopped`. San Francisco never emits those events. A provider finish
reason of `tool-calls` ends only the current model step; it can never masquerade
as successful completion of the user's turn.

The signed policy determines `requestedProvider` and `requestedModel`.
`reportedModel` is provider truth only. Provider identity is never inferred
from a model-name string. If the SDK substitutes its configured/requested id
because the upstream response omitted a model id, San Francisco must not
present that value as reported truth. A missing or mismatched upstream model id
fails the model step unless implementation proves an equally exact
provider-owned metadata source.

The wire contract must not invent zero token usage, a requested model id, an
empty successful response, or an alternate provider when upstream truth is
missing.

## 4. Message Ownership

Agent homes build the model messages.

San Francisco may validate transport shape and enforce budgets, but it does not:

- author agent instructions;
- add product context;
- rewrite conversation meaning;
- choose an agent tool;
- remove tool results;
- create fallback messages.

Product Copilot messages are built from the open Bob session and its agent-home
instructions. Translation Agent messages are built from its saved-instance
translation operation.

Bob owns Product Copilot's bounded `conversationHistory` for the open browser
session. It contains the exact ordered user, assistant-text, assistant-tool-call,
and tool-result entries needed to reconstruct a model step. Bob supplies it on
the initial request and every continuation. Product Copilot validates it and
builds `messages` from it; neither Roma nor San Francisco stores or reconstructs
the conversation. Malformed, oversized, missing, duplicated, or out-of-order
history fails visibly.

## 5. Tool Ownership

Tool definitions belong to the agent home and name the product capability the
agent may request.

PRD 128 exposes one Product Copilot tool:

```text
apply_widget_ops({ ops: WidgetOp[] })
```

`WidgetOp` is a direct typed projection of Bob's existing `set`, `insert`,
`remove`, and `move` union. Product Copilot owns only the stable model-facing
tool name, description, and concise explanation of those existing operations.
Bob's current WidgetOp contract and compiled control truth remain the executable
schema and terminal validator. There is no duplicated agent-specific operation
model.

The result is exactly one of:

```text
{ ok: true, changedPaths: string[], postApplySignature: string }
{ ok: false, errors: [{ opIndex, path?, message }] }
```

The success result is emitted only after the whole ordered batch passes current
Bob operation and document validation and is applied. The failure result names
the rejected operation(s) and applies none of the batch.

The tool definition identifies:

- stable name;
- purpose expressed to the model;
- exact input schema;
- exact result schema;
- executing authority;
- side-effect boundary;
- explicit error shape.

San Francisco transports the definition and model call. It supplies no SDK
`execute` function and never executes the product tool.

For Product Copilot, Bob executes Builder draft tools. For Translation Agent,
PRD 128 does not add browser tools; its structured translation output remains
inside the Translation Agent's server-side operation.

## 6. Product Copilot Loop Semantics

Product Copilot owns reasoning. Bob owns the browser-memory state being
observed and changed.

One user turn may contain multiple governed model calls separated by explicit
Bob tool execution:

```text
model call 1 -> tool request
Bob tool execution -> tool result
model call 2 -> another tool request or completion
```

The first implementation keeps conversation and draft state out of the server:

- Bob retains the open-session transcript and tool results;
- Bob creates a `userTurnId` for browser-session event correlation; Roma
  reserves one monthly Copilot unit on the initial request;
- the initial request and each continuation carry Bob's exact bounded
  `conversationHistory`;
- each continuation also carries the same `sessionId`, Bob-issued `userTurnId`,
  selected model, prior `modelStepId`, exact provider `toolCallId`, tool name,
  exact tool result or error, and current draft context;
- Roma revalidates the selected model against current account/tier policy on
  every request; no server-side pin record is created;
- Bob accepts continuations only for its exact active browser request and sends
  them sequentially; when that request is stopped or replaced, Bob sends no
  further continuation and ignores later events from it;
- Product Copilot rebuilds the model turn from the explicit input;
- no server-side conversation store is created.

A provider model step may produce ordered text deltas and at most one complete
`apply_widget_ops` call. Multiple tool calls fail before Bob applies any
operation. Product Copilot streams natural model-authored conversation; native
tool-call protocol remains internal. Text must not state that an action
succeeded before Bob returns the exact successful tool result. After a tool
call, Product Copilot receives that observation and may then explain the exact
result in its next step. The one valid tool call may contain an ordered
non-empty WidgetOp batch; Bob validates and applies that batch atomically
through its existing `applyOps` authority. A subsequent model step is required
only when the next decision depends on Bob's observation. Reaching the signed
tier step, per-call token, or per-call timeout ceiling is a visible incomplete
turn, not success.

This is an agent instruction and product-behavior contract, not authorization
to add a semantic text classifier, prose validator, or hidden narration
filter. Product verification proves that the agent follows it; Bob continues
to treat only an exact tool result as action truth.

## 7. Translation Agent Loop Semantics

Translation Agent remains a bounded server-side operation:

- exact saved instance and locale input;
- one or more governed model turns only as its existing per-locale operation
  requires;
- exact structured translated values;
- exact Tokyo overlay write;
- ordered per-locale results.

It does not inherit Product Copilot's browser transcript, streaming UI, tools,
or step count.

## 8. Usage, Retry, Timeout, And Budget Law

- One submitted Product Copilot user message consumes exactly one existing
  monthly Copilot turn. Tool-result continuations do not consume additional
  monthly turns; they are authorized model steps inside that already reserved
  turn.
- Roma's existing usage authority owns the monthly reservation. Bob's active
  Copilot pane owns the active browser request and sequential continuations.
  San Francisco reports exact usage for every model step. PRD 128 does not
  invent a second billing, metering, or active-turn persistence system and does
  not claim a nonexistent post-call usage finalizer.
- Translation chunk calls are not charged as Product Copilot turns. Each call
  remains subject to the exact Translation Agent grant policy and current
  chunk/total bounds.
- SDK retry defaults must be disabled unless a later explicit requirement
  authorizes a retry.
- AI SDK tool-call repair, JSON-extraction repair middleware, simulated
  streaming, automatic tool execution, and automatic multi-step `stopWhen`
  loops are forbidden.
- No model/provider route substitutes for a failed exact route.
- Every model call uses the token and timeout budget from the verified grant.
- The existing signed tier turn value bounds model steps in Bob's open Copilot
  thread; the signed per-call timeout bounds every model step.
- Abort/cancellation must propagate through Product Copilot, Roma, San
  Francisco, and the provider request where the runtime supports it.
- Cancellation is not completion and does not imply rollback of already
  executed Bob draft tools; Bob's existing Undo remains the user operation.

## 9. Size Bounds

The contract must fail visibly rather than truncate required context, tools,
arguments, results, or schemas.

- Product Copilot preserves its current limit of eight **prior completed chat
  messages**, 2,000 characters per prior completed chat message, and 120,000
  characters of serialized Builder context. Required entries from the active
  user turn—current user message, assistant tool calls, and matching tool
  results—are separate and may not be removed by that prior-chat limit.
- PRD 128 exposes one Product Copilot tool; its JSON schema is at most 64 KiB.
- One tool-call argument payload and one tool-result payload are each at most
  64 KiB serialized.
- One structured-output schema is at most 64 KiB serialized.
- Translation Agent preserves its current 80-item/4,000-character chunk and
  800-item/60,000-character operation ceilings.

Implementation must derive coherent ordered-message and total serialized UTF-8
request-byte bounds from the existing tier step policy and the selected model's
actual capacity. Those engineering bounds must fit the complete required
transcript for that tier plus the allowed context, tool schema, tool arguments,
and tool results. They may not truncate required history. If a request exceeds
the exact supported bound, it fails visibly.

Any tighter provider-specific ceiling is explicit model capability truth. It
does not silently remove messages, tools, fields, or locales.

## 10. Structured Output Law

Structured output is valid when the agent's domain result is inherently
structured. Translation Agent translated values are one example.

Structured output is not the universal conversation protocol. Product Copilot
must not wrap every answer, clarification, refusal, and edit into a replacement
JSON envelope.

## 11. Failure Semantics

Required visible failures include:

- invalid/expired grant;
- agent/grant mismatch;
- unsupported exact model capability;
- missing exact provider credential;
- timeout or budget ceiling;
- malformed tool arguments;
- unknown tool name;
- Bob tool rejection;
- malformed structured output;
- provider response missing required model/usage truth;
- stream interruption before a complete finish event;
- missing, malformed, duplicated, replayed, out-of-order, or oversized
  conversation history;
- continuation that does not belong to Bob's exact active request, is
  duplicated/out of order within that request, or exceeds tier policy;
- more than one tool call in a Product Copilot model step;
- any success claim emitted before Bob's exact successful tool observation;
- oversized required request, message, context, tool, result, or schema.

A tool failure returns an exact tool error observation. Product Copilot may
reason about that error, but neither the agent nor the UI may report the tool as
applied.

## 12. Hard-Cut Requirements

- one Clickeen-owned model-turn contract;
- no AI SDK types leaking into Bob/Roma product contracts;
- no six-kind Product Copilot response alias;
- no `/model/chat` compatibility caller after release;
- no hidden SDK retry;
- no fallback provider/model;
- no server-side active-turn storage or coordination authority.

## 13. Acceptance Criteria

- Types cover ordered messages, text streaming, native tool calls/results,
  structured output, finish, usage, cancellation, and errors.
- The authority that builds messages and tools is unambiguous.
- San Francisco owns execution but no agent loop or product tool.
- Product Copilot can continue from an exact Bob tool result without durable
  conversation or draft state.
- Translation Agent can use structured output without adopting Product
  Copilot's interaction shape.
- One Product Copilot submission reserves one product turn; continuations are
  bounded, ordered steps inside it.
- Budgets apply to every model call, and San Francisco does not own an automatic
  SDK loop.
- A model-step finish and an agent-turn completion are distinct.
- The one `apply_widget_ops` tool projects Bob's existing operation contract and
  applies one ordered batch atomically.
- Incomplete, interrupted, or failed work cannot appear as success.
- A tool-calling step cannot render a pre-observation completion claim.
- The contract contains no compatibility or invented fallback behavior.

## 14. Established Product Decisions

Implementation starts from these existing product decisions rather than
creating new approval gates:

1. DevStudio's current per-agent, per-tier AI runtime matrix remains the model,
   token, timeout, and turn-policy authority. Product Copilot preserves the
   existing 8/16/30/50 tier values; Translation Agent preserves one governed
   model call per chunk.
2. The human product owner judges Product Copilot's usefulness by using it in
   the real Builder. Engineering tests prove exact tool/state/failure behavior;
   no automated score becomes product authority.
3. Translation Agent's working product behavior is the regression baseline.
   PRD 128 changes its model-execution seam, not its language product.
4. Bob owns the active browser request, transcript, and draft. PRD 128 creates
   no Supabase/KV/D1/R2 active-turn record, migration, expiry job, or server
   coordinator.
5. Manual and Copilot are mutually exclusive ToolDrawer modes. Manual controls
   are not active while the Copilot pane owns an active request, so there is no
   concurrent manual/Copilot merge policy.
6. Request/message bounds are engineering consequences of the existing tier
   policy and selected model capacity. Required truth is never truncated; an
   unsupported request fails visibly.
7. Copilot streams natural conversation. While active, Send becomes Stop.
   Tool calls remain internal, Bob executes them against browser-memory truth,
   and Copilot may claim success only after receiving Bob's exact success
   observation.

## Execution Record

No implementation has started. Record the implemented version-1 types, checks,
and evidence here after execution.
