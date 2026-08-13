# PRD 128D — Bob And Roma Interactive Agent Transport

Status: **EXECUTING — IMPLEMENTATION COMPLETE; TRANSPORT + CANCELLATION BUILT; TYPECHECK CLEAN**

Depends on: 128A, 128B, 128C

Implementation unit: 128C and 128D are inseparable; neither releases before
128B–128E and 128F are complete

## 1. Purpose

Complete Product Copilot's action/observation loop through the current product
authorities:

```text
Product Copilot tool call
-> Roma transports authorized event
-> Bob executes against browser-memory draft
-> exact tool result returns through Roma
-> Product Copilot continues reasoning
```

This is product transport and browser draft execution. It is not a new agent
platform or server-side session system.

## 2. Bob Ownership

Bob continues to own:

- the open Builder session;
- current browser-memory draft;
- current compiled control catalog;
- draft-operation application;
- linked operations already required by current controls;
- preview;
- dirty state;
- undo;
- Product Copilot messages and tool-result history for that open session.

Bob executes only a Product Copilot tool whose name and arguments map to an
available current draft operation. Bob returns exact applied/rejected truth.

Product Copilot cannot directly mutate React state, DOM, preview iframe,
network, storage, or Save routes.

## 3. Roma Ownership

Roma continues to own:

- authenticated current user/account;
- exact current instance route;
- Product Copilot entitlement/usage policy;
- selected model validation;
- grant minting;
- calls to the Product Copilot Worker;
- explicit user Save route.

Roma does not store the Bob draft or Product Copilot transcript. It transports
the current explicit turn/continuation and enforces its existing authority on
every request.

## 4. Request Sequence

The route accepts one exact versioned union:

```text
initial {
  version: 1,
  kind: "initial",
  sessionId,
  userTurnId,
  userMessage,
  selectedModel?,
  conversationHistory,
  currentDraftContext
}

continuation {
  version: 1,
  kind: "continuation",
  sessionId,
  userTurnId,
  selectedModel?,
  priorModelStepId,
  toolCallId,
  toolName: "apply_widget_ops",
  toolResult,
  conversationHistory,
  currentDraftContext
}
```

`currentDraftContext` carries the same exact Builder/control truth already
authorized today. Bob keeps the selected model for the active Copilot thread
and sends it on every request; Roma revalidates that exact model against the
current account/tier policy every time.
`conversationHistory` is Bob's exact bounded ordered user/assistant/tool history
for the open session. It includes the current assistant tool-call entry and its
matching tool result before a continuation. Product Copilot validates and uses
it to reconstruct model messages. Roma transports it but does not persist or
author it. Missing, malformed, oversized, duplicated, or out-of-order entries
fail visibly.

On `initial`, `conversationHistory` contains the bounded session history before
the separately supplied `userMessage`. On `continuation`, it contains that
original user message plus every ordered assistant text/tool-call entry and the
matching exact tool result through the current round.

Bob creates `userTurnId` when the user submits. It is a browser-session
correlation coordinate carried through the event sequence, not server-side
authority or persisted state.

Both variants use the existing account-instance route:

```text
POST /api/account/instances/{instanceId}/copilot
```

Stop is not a third Product Copilot route request. Add one `cancel-copilot`
command to the existing Bob-to-Roma host-command channel for the active host
request id. Roma owns that in-page request's AbortController and aborts it; Bob
sends no later continuation for it and ignores any later event carrying the
stopped request id.

### Initial user request

```text
Bob sends user message + current transcript/context
-> Roma revalidates current account/instance/model authority
-> Roma reserves one monthly product turn and mints the current tier-specific
   policy for Bob's supplied userTurnId
-> Product Copilot emits `agent_turn_started { userTurnId }` through Roma as the
   first Bob-facing event
-> Product Copilot calls San Francisco
-> streamed Product Copilot events return through Roma to Bob
```

### Tool request

```text
Bob receives one complete tool request
-> verifies the tool exists in the current Product Copilot tool surface
-> validates the ordered WidgetOp batch against current exact control truth
-> applies the whole batch atomically through existing Bob editing authority
-> produces exact success or error result
```

### Continuation

```text
Bob appends the exact tool call and result to its open-session transcript
-> Bob sends explicit continuation through the same Roma current-instance route
-> Roma reauthorizes the current account, instance, Bob-supplied selected model,
   and signed tier policy without reserving another monthly turn
-> Product Copilot continues the next governed model turn
```

No hidden server loop calls back into the browser. No WebSocket, Durable Object,
queue, or conversation database is required for this flow.

## 5. Stream Contract

The existing account-instance Copilot route returns `text/event-stream`. PRD
128 does not authorize a different transport.

The complete Bob-facing event union is:

- `agent_turn_started` — first event; carries `userTurnId`;
- `text_delta` — ordered natural model-authored text;
- `tool_call` — one complete typed call;
- `model_step_finished` — exact step finish/usage metadata;
- `agent_turn_finished` — the only successful user-turn terminal event;
- `agent_turn_error` — failed/incomplete terminal event;
- `agent_turn_stopped` — user-stopped terminal event.

Every event uses `{ version: 1, userTurnId, type, data }`. There is exactly one
`agent_turn_started` and exactly one terminal `agent_turn_finished |
agent_turn_error | agent_turn_stopped` per accepted request sequence. A tool
call or `model_step_finished` never closes the user turn.

Bob must handle ordered:

- text deltas;
- complete tool call;
- model-step finish/usage;
- explicit agent-turn finish;
- explicit error;
- cancellation.

Roma may wrap/relay Clickeen events but must not reinterpret Product Copilot
text, tool arguments, tool results, finish, or errors.

The UI must never display a partial tool-call argument stream as an actionable
tool. Execution begins only after the complete typed call arrives. A
`tool-calls` model finish leaves the user turn active; only Product Copilot's
explicit `agent_turn_finished` closes it successfully.

Tool protocol remains internal. Product Copilot may speak naturally about what
it intends to do, but it may report a change as completed only in a continuation
after Bob's exact successful tool result has been observed.

That language rule belongs to Product Copilot instructions and verification.
Bob does not add a semantic classifier, prose validator, or substitute status
narration around model text.

## 6. Draft Tool Execution

Reuse Bob's existing operation application and validation. Do not create a
parallel Product Copilot draft engine.

Required properties:

- execute against current draft truth, not the context snapshot sent before the
  model turn;
- reject a path/control/value no longer valid in the current draft;
- apply ordered operations through existing Bob state updates;
- preserve linked operation behavior owned by current Bob controls;
- update preview and dirty state exactly as a human edit would;
- collect inverse operations for every successfully applied batch in the user
  turn and expose one existing Copilot Undo entry, composed in reverse apply
  order;
- return concise exact success data sufficient for the model to continue;
- return exact errors without filtering them into partial success.

Manual and Copilot are mutually exclusive ToolDrawer modes. While the Copilot
mode owns an active request, Manual controls are not active; there is no
simultaneous manual/Copilot edit or merge policy. Tool execution still validates
against the current exact draft truth rather than an earlier prompt snapshot.

One submitted user request is one Copilot edit batch from the user's point of
view even when it contains several observed tool rounds. Already applied
batches stay visible after later failure or Stop and remain covered by the one
Undo entry. There is no silent rollback. After leaving Copilot and returning to
Manual, a later manual edit invalidates Copilot Undo through Bob's existing
post-apply signature rule.

## 7. User Experience

The Product Copilot pane must support:

- immediate visible pending control state and streamed model-authored
  conversation while a turn is active;
- streamed normal text;
- the normal Send action becomes one visible `Stop` action while active;
- an understandable in-progress action state without fake Agent Activity rows;
- faithful user-language tool rejection/failure plus request id where useful;
- completed action summary only after Bob reports success;
- cancellation;
- existing Undo for applied Copilot changes;
- explicit Save as the only persistence action.

Do not expose provider protocol, raw JSON, model tool-call ids, or internal
transport vocabulary to the user.

Stop sends the new `cancel-copilot` command through the existing Bob→Roma host
command channel, keyed by the active host request id. Roma owns the in-page
`AbortController` for that stream fetch and propagates the abort signal through
Product Copilot, San Francisco, and the provider. Bob immediately marks that
host request stopped, sends no later continuation for it, and ignores later
events from it. Leaving the Copilot mode while a request is active performs the
same cleanup. No Product Copilot cancel route variant, persisted active-turn
record, second HTTP route, durable coordinator, or cross-isolate registry is
created. Already applied edits remain visible and undoable. The input becomes
usable again and the turn displays as stopped/incomplete, never success.
Already received model-authored text remains visible; Bob does not invent a
replacement answer.

Static Stop/Undo/error copy belongs to Bob's existing Chrome/copy authority.
Raw reason keys, internal JSON, and raw provider errors never become UI copy;
exact errors still return to Product Copilot and operational logs.

Do not invent an approval modal for every draft tool. Product Copilot already
operates the reversible browser-memory draft. Save remains the human persistence
boundary.

## 8. Usage And Turn Accounting

One submitted Product Copilot message consumes exactly one
`copilot.turns.monthly.max` unit. Roma reserves it on the `initial` request.
Continuations are not new customer turns; they carry the Bob-issued
`userTurnId` and Bob sends them sequentially for its exact active request within
the current tier-specific signed turn/token/timeout policy.

San Francisco returns exact model usage for each step for operational truth.
PRD 128 does not claim a post-call usage finalizer that does not currently
exist, and it does not add a second metering system. If a continuation would
exceed step/time/token policy, it is rejected and the user turn ends visibly
incomplete.

## 9. Cancellation And Failure

- Stop/canceling the active Copilot turn stops further model requests.
- Propagate abort through the active Roma/Worker/San Francisco request where
  supported.
- Already applied Bob draft tools remain applied and undoable; cancellation does
  not silently roll them back.
- A disconnected/interrupted stream without terminal truth is incomplete.
- A tool error can be returned as an observation only if the user did not
  cancel and budget remains; otherwise the turn stops visibly.
- Save and other Bob editing remain usable after a Copilot failure.
- Bob does not send replayed, duplicated, or out-of-order continuations and
  ignores events for a stopped/replaced host request; Roma still reauthorizes
  account, instance, model, and tier policy on each continuation.

## 10. Focused Verification

Automated and browser tests must cover:

- streamed answer without tool;
- complete tool call execution;
- ordered multi-op batch applies atomically or not at all;
- multiple tool calls in one model step rejected before application;
- natural text may accompany a tool-capable step, but rejected/failed work is
  never presented as completed before a successful observation;
- tool result followed by another model call;
- malformed, missing, duplicated, and out-of-order conversation history;
- no pre-observation success text from a tool-calling step reaches the user;
- multi-step ordered change;
- stale current-draft rejection;
- unknown/invalid tool rejection;
- preview/dirty state update;
- Undo after one and multiple Copilot actions;
- one Undo covers all applied batches in one user turn in reverse order;
- exclusive Manual/Copilot mode behavior and the existing later-manual-edit
  Undo invalidation rule;
- explicit Save persists the observed draft through the existing Roma route;
- no persistence before Save;
- cancel before tool execution;
- cancel after an applied tool;
- `cancel-copilot` aborts only the exact active host request and Bob ignores
  later events/continuations from it;
- Stop restores input, keeps partial text and applied edits, and renders
  incomplete rather than success;
- interrupted stream;
- tier-policy denial on continuation;
- ordinary Manual editing remains functional after leaving Copilot; the two
  modes are not exercised as simultaneous editors.

## 11. Acceptance Criteria

- Bob owns the transcript and tool execution for the open session.
- Roma owns account authorization, grants, usage, and Save.
- Product Copilot receives exact Bob tool results as observations.
- The interaction creates no durable conversation, draft, or active-turn store.
- Draft operations reuse Bob's current edit engine.
- Preview, dirty state, undo, and Save behave as before.
- Tool failure/interruption/cancellation cannot masquerade as completion.
- No old six-kind response consumer remains.
- 128C and 128D are one implementation unit inside the complete PRD 128 hard
  cut.

## Execution Record

### 128D Implementation (2026-08-13)

**Roma files:**
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts` — rewritten for SSE relay
- `roma/lib/ai/account-copilot.ts` — streamCopilotTurn + authoritative grant
- `roma/components/builder-domain.tsx` — readCopilotStreamedEvents + AbortController registry
- `roma/tests/run-copilot-route-gates.ts` — 10 gate tests

**Bob files:**
- `bob/lib/session/sessionTransport.ts` — runCopilot (handle-returning) + cancelCopilot
- `bob/lib/session/sessionTypes.ts` — cancel-copilot command
- `bob/components/CopilotPane.tsx` — rebuilt: streaming events, tool-after-step, undo accumulation, Send/Stop
- `bob/tests/run-copilot-model-history.ts` — 11 model history tests

**Verification:**
- Shared parser used by Roma and PC Worker (no drifting validators)
- Grant authoritative (caller cannot overwrite)
- AbortController registry with unmount cleanup
- Two-fact turn state (Bob's Stop is UI truth)
- Tier step limit enforced
- Translation AgentActivityEvent {message} unchanged
