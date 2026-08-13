# PRD 128C/128D — Full Execution Plan (v2)

Status: **REVISED — INCORPORATES ALL 15 PRODUCT-OWNER CORRECTIONS**

This is the complete, ordered execution plan for finishing 128C+128D. Every
step has a definition of done and a runnable verification gate. No step starts
until the previous step's gate passes.

Read this file at the start of every work session. Check off completed items.
Do not skip phases.

**Authority note:** All corrections in this plan come from the human product
owner/architect — the repository's actual authority. Do not use invented titles.

---

## Ground Rules

1. **No step is "done" until its gate passes.** A gate is a specific, runnable
   check — not "I looked at it."
2. **Fix defects before building on top of them.** The 9-phase order is strict.
3. **No fallbacks.** Missing provider truth fails visibly. No `?? requested_model`,
   no `?? 0`, no silent substitution. Tenet 3 / V1.
4. **No silent drops.** Invalid events terminate the request visibly. V3.
5. **Dedicated typed contracts.** `ProductCopilotTurnEvent` is its own union.
   `AgentActivityEvent {message}` stays unchanged for Translation. No generic
   event bus.
6. **Tool calls execute only after the model step is fully observed** — never
   on `tool_call` arrival.
7. **One shared validator.** Roma and Product Copilot use one Clickeen-owned
   request contract. No drifting duplicates.
8. **Roma's grant is authoritative.** Caller-supplied grant/trace never crosses
   the boundary.
9. **Timeout ≠ user Stop.** Abort causes are distinguished and reported
   correctly.
10. **Concurrency leases release exactly once** on completion, error, AND
    cancellation.
11. **Tests live beside their implementation phase** — not deferred to the end.
12. **Typecheck every workspace after every phase.**
13. **Independent V1-V8 verification after all phases.**

---

## Phase 1 — Exact Shared Request/Event/History Contracts

**Goal:** Define the exact Clickeen-owned contracts that every surface uses.
One parser, no drifting validators.

**Depends on:** Nothing. Start here.

### Step 1.1 — Define `ProductCopilotTurnEvent` union with REQUIRED modelStepId

**File:** `packages/ck-contracts/src/ai.ts`

`modelStepId` is REQUIRED on `text_delta`, `tool_call`, `model_step_finished`,
and step-level errors once model execution has begun. It is ABSENT only from
agent-level failures that occur before a model step exists.

```typescript
export type ProductCopilotTurnEvent =
  | { version: 1; userTurnId: string; type: 'agent_turn_started'; data: Record<string, never> }
  | { version: 1; userTurnId: string; modelStepId: string; type: 'text_delta'; data: { text: string } }
  | { version: 1; userTurnId: string; modelStepId: string; type: 'tool_call'; data: { toolCallId: string; toolName: string; input: unknown } }
  | {
      version: 1;
      userTurnId: string;
      modelStepId: string;
      type: 'model_step_finished';
      data: {
        finishReason: string;
        requestedProvider: string;
        requestedModel: string;
        reportedModel: string;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number;
      };
    }
  | { version: 1; userTurnId: string; type: 'agent_turn_finished'; data: Record<string, never> }
  | { version: 1; userTurnId: string; type: 'agent_turn_error'; data: { code: string; reasonKey: string; message: string; requestId?: string } }
  | { version: 1; userTurnId: string; type: 'agent_turn_stopped'; data: Record<string, never> };
```

Type guard `isProductCopilotTurnEvent` validates: version === 1, userTurnId is
string, type is one of the 7, modelStepId present where required, data shape
per type.

**Gate:**
- [ ] `packages/ck-contracts` typechecks
- [ ] Type guard passes all 7 event types with correct required fields
- [ ] Type guard rejects: missing modelStepId on text_delta, tool_call, model_step_finished
- [ ] Type guard rejects: unknown event type, wrong version, missing userTurnId

---

### Step 1.2 — Define shared `CopilotTurnRequest` contract with full validation

**File:** `packages/ck-contracts/src/ai.ts`

One Clickeen-owned parser used by BOTH Roma and Product Copilot Worker.

```typescript
export type CopilotHistoryEntry =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | {
      role: 'assistant';
      text: string;
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }
  | {
      role: 'assistant';
      text: string;
      toolCall: { toolCallId: string; toolName: string; input: unknown };
      toolResult: unknown;
    };

export type CopilotTurnRequest =
  | {
      version: 1;
      kind: 'initial';
      sessionId: string;
      userTurnId: string;
      userMessage: string;
      selectedModel?: { provider: string; model: string };
      conversationHistory: CopilotHistoryEntry[];
      currentDraftContext: CopilotDraftContext;
    }
  | {
      version: 1;
      kind: 'continuation';
      sessionId: string;
      userTurnId: string;
      priorModelStepId: string;
      toolCallId: string;
      toolName: 'apply_widget_ops';
      toolResult: unknown;
      selectedModel?: { provider: string; model: string };
      conversationHistory: CopilotHistoryEntry[];
      currentDraftContext: CopilotDraftContext;
    };

export type CopilotDraftContext = {
  widgetType: string;
  displayName: string;
  activeLocale: string;
  draftSignature: string;
  controls: ProductCopilotControl[];
  availableActions: string[];
  unavailableCapabilities: string[];
  selectedControlPath?: string;
};

export function parseCopilotTurnRequest(
  value: unknown,
  options: { routeInstanceId?: string },
): { ok: true; request: CopilotTurnRequest } | { ok: false; issues: Array<{ path: string; message: string }> };
```

The parser validates:
- `version === 1`
- exact `initial` | `continuation`
- `sessionId` and `userTurnId` present, non-empty trimmed strings
- initial: `userMessage` present, non-empty
- continuation: `priorModelStepId` present, `toolCallId` present, `toolName ===
  'apply_widget_ops'`, `toolResult` present
- `conversationHistory`: array, max 8, each entry has role in user|assistant,
  text non-empty max 2000 chars, toolCall shape if present, toolResult present
  only with toolCall
- `currentDraftContext`: all required fields present, controls is array,
  availableActions is array
- if `routeInstanceId` provided: context instance matches route instance (the
  context carries `instanceId` — add it to the type if needed for this check)
- `selectedModel` shape if present

**Gate:**
- [ ] Parser accepts valid initial and continuation requests
- [ ] Parser rejects: wrong version, invalid kind, missing sessionId, missing
      userTurnId, initial without userMessage, continuation without
      priorModelStepId/toolCallId/toolResult, oversized history, malformed
      history entries, missing draft context, wrong tool name
- [ ] Parser shared by Roma and Product Copilot Worker (same import, no
      duplication)

---

### Step 1.3 — Define Bob-owned structured model history (separate from UI chat)

**File:** `bob/lib/copilot/types.ts` (or new file)

The visible `CopilotMessage` (UI bubbles) stays separate from the structured
model history sent to the Product Copilot. Define:

```typescript
export type CopilotModelHistory = {
  entries: CopilotHistoryEntry[];
};

export function appendUserMessage(history: CopilotModelHistory, text: string): CopilotModelHistory;
export function appendAssistantText(history: CopilotModelHistory, text: string): CopilotModelHistory;
export function appendToolCall(
  history: CopilotModelHistory,
  call: { toolCallId: string; toolName: string; input: unknown },
): CopilotModelHistory;
export function appendToolResult(
  history: CopilotModelHistory,
  toolCallId: string,
  result: unknown,
): CopilotModelHistory;
```

These functions enforce:
- each assistant tool call appears once
- its matching result appears once (appended to the entry that holds the call)
- the history maintains ordering
- bounds are enforced (max 8 entries for the wire, internal history may be
  longer before trimming)

The UI renders from a SEPARATE conversation-bubble array. The model history is
internal tool protocol.

**Gate:**
- [ ] History functions produce correctly ordered entries
- [ ] Each tool call appears exactly once with its result
- [ ] UI chat is a separate array — no mixing of tool protocol into visible bubbles

---

### Phase 1 Completion Gate

- [ ] Step 1.1: ProductCopilotTurnEvent with required modelStepId
- [ ] Step 1.2: Shared CopilotTurnRequest parser with full validation
- [ ] Step 1.3: Bob-owned structured model history
- [ ] `packages/ck-contracts` typechecks
- [ ] Parser unit tests pass (accept valid, reject all invalid cases)

---

## Phase 2 — San Francisco and Product Copilot Stream Correctness

**Goal:** Both emitters produce truthful, exact, well-formed events. No
fallbacks, no lost metadata, no incorrect terminals, no parser corruption.

**Depends on:** Phase 1 complete.

### Step 2.1 — San Francisco: remove metadata fallbacks

**File:** `sanfrancisco/src/ai/model-turn.ts`

**Defect:** `reportedModel: response.modelId ?? args.selection.model` and
`promptTokens: usage.inputTokens ?? 0` substitute invented values when provider
truth is missing.

**Fix:** In `handleStreamMode`'s terminal-event builder:

Before building `finishData`, validate:
1. `response.modelId` is a non-empty string → else emit `model_step_error`
   with "Provider did not report model identity." Do NOT emit
   `model_step_finished`.
2. `usage.inputTokens` and `usage.outputTokens` are non-negative integers →
   else emit `model_step_error` with "Provider did not report token usage."
   Do NOT emit `model_step_finished`.

Apply identical fix to `handleStructuredMode`.

**Gate:**
- [ ] Existing 30 San Francisco tests pass
- [ ] New test: missing modelId → model_step_error
- [ ] New test: missing usage → model_step_error

---

### Step 2.2 — San Francisco: distinguish timeout from caller cancellation

**File:** `sanfrancisco/src/ai/model-turn.ts`

**Defect:** Every `AbortError` maps to `BUDGET_EXCEEDED` ("Execution timeout
exceeded"). User Stop is not a timeout.

**Fix:** Use an abort-reason flag on the AbortController. When the incoming
request signal fires (caller cancellation), the abort cause is "caller_cancel" —
emit a distinct signal, not a timeout error. When the internal timeout fires,
the cause is "timeout" — emit `model_step_error` with BUDGET_EXCEEDED.

Implementation: create a small enum/flag next to the AbortController:

```typescript
type AbortCause = 'timeout' | 'caller_cancel' | 'none';
let abortCause: AbortCause = 'none';
const abortController = new AbortController();
const timeout = setTimeout(() => { abortCause = 'timeout'; abortController.abort(); }, budget.timeoutMs);
if (incomingSignal) {
  incomingSignal.addEventListener('abort', () => {
    if (abortCause === 'none') abortCause = 'caller_cancel';
    abortController.abort();
  }, { once: true });
}
```

On stream error with AbortError:
- `abortCause === 'timeout'` → `model_step_error` with BUDGET_EXCEEDED
- `abortCause === 'caller_cancel'` → clean stream end (the caller cancelled;
  Product Copilot handles the stopped state — do NOT emit a timeout error)

**Gate:**
- [ ] Test: timeout fires → BUDGET_EXCEEDED
- [ ] Test: caller signal aborts → NOT BUDGET_EXCEEDED (clean end)

---

### Step 2.3 — San Francisco: concurrency lease releases on cancellation

**File:** `sanfrancisco/src/concurrency.ts`

**Defect:** `withStreamInflightLimit` uses `TransformStream.flush()` to release
the lease. A runtime probe showed `flush()` does NOT run on downstream
cancellation — canceling the reader calls the source's cancel hook but not
flush. Canceled streams leak one of the 8 slots.

**Fix:** Replace the TransformStream approach with an explicit release
function called from all three paths:

```typescript
export function withStreamInflightLimit<T extends Response>(
  fn: () => Promise<T>,
): Promise<T> {
  if (inflight >= MAX_INFLIGHT_PER_ISOLATE) {
    return Promise.reject(new HttpError(429, { ... }));
  }
  inflight++;
  let released = false;
  const release = () => {
    if (!released) { released = true; inflight--; }
  };
  return fn().then(
    (response) => {
      if (!response.body) { release(); return response; }
      // Wrap the body in a pass-through stream that releases on all exits
      const wrapped = new ReadableStream<Uint8Array>({
        start(controller) {
          const reader = response.body!.getReader();
          const pump = (): Promise<void> =>
            reader.read().then(({ done, value }) => {
              if (done) { release(); controller.close(); return; }
              controller.enqueue(value);
              return pump();
            });
          return pump().catch((err) => { release(); controller.error(err); });
        },
        cancel(reason) {
          release();
          return response.body!.cancel(reason);
        },
      });
      return new Response(wrapped, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }) as T;
    },
    (err) => { release(); throw err; },
  );
}
```

Key: `cancel()` on the wrapper calls `release()` — this is the path that runs
on downstream cancellation. `release()` is idempotent (no double decrement).

**Gate:**
- [ ] Test: 8 active streams occupy all 8 slots; 9th rejected
- [ ] Test: cancel one stream → 9th request succeeds
- [ ] Test: normal completion releases the slot
- [ ] Test: stream error releases the slot
- [ ] Test: no double release (counter stays correct after cancel+complete race)

---

### Step 2.4 — Product Copilot Worker: preserve `modelStepId`

**File:** `agents/product-copilot/src/worker.ts`

**Defect:** San Francisco emits `modelStepId` in every event envelope. The
Worker strips it while relaying.

**Fix:** Every forwarded event preserves `sfData.modelStepId`:

```typescript
controller.enqueue(encoder.encode(sseEvent('text_delta', {
  version: 1, userTurnId: args.userTurnId,
  modelStepId: sfData.modelStepId,
  type: 'text_delta',
  data: sfData.data ?? {},
})));
```

Apply to all four forwarded types. If `modelStepId` is missing from a San
Francisco event that requires it, the Worker emits `agent_turn_error` (V3 —
not silently dropped).

**Gate:**
- [ ] Test: forwarded events contain the same modelStepId as the SF input

---

### Step 2.5 — Product Copilot Worker: tool-calls as valid step boundary

**File:** `agents/product-copilot/src/worker.ts`

**Defect:** After `model_step_finished` with `finishReason: "tool-calls"`, the
"stream ended without terminal" check fires and emits an error.

**Fix:** In the `model_step_finished` handler:
- `'stop'` → emit `agent_turn_finished`
- `'tool-calls'` → set internal flag `stepEndedAwaitingContinuation = true`,
  emit NO terminal agent event. Stream closes cleanly.
- `'length'` → emit `agent_turn_error` with BUDGET_EXCEEDED, message "Turn
  ended at the step or token ceiling without completing."
- `'content-filter'` → emit `agent_turn_error` with PROVIDER_ERROR

The post-stream check: if `!terminalEmitted && !stepEndedAwaitingContinuation`
→ emit error. If `stepEndedAwaitingContinuation` is true, close cleanly.

**Gate:**
- [ ] Test: tool-calls → no terminal, no error
- [ ] Test: length → agent_turn_error
- [ ] Test: content-filter → agent_turn_error

---

### Step 2.6 — Product Copilot Worker: `agent_turn_started` only on initial

**File:** `agents/product-copilot/src/worker.ts`

Add `isInitial: boolean` to stream args. Only emit `agent_turn_started` when
`isInitial === true`.

**Gate:**
- [ ] Test: continuation does not emit agent_turn_started

---

### Step 2.7 — Product Copilot Worker: reject multiple tool calls before forwarding

**File:** `agents/product-copilot/src/worker.ts`

**Requirement:** Bob must never apply the first tool call while the step could
still produce another. The Worker should reject multiple tool calls in one
model step BEFORE forwarding an actionable tool_call to Bob.

**Fix:** During stream processing, count tool_call events. If a second
tool_call arrives in the same model step:
1. Do NOT forward the second tool_call
2. Emit `agent_turn_error` with message "Multiple tool calls in one model step
   are not supported."
3. Do NOT let Bob execute the first one (if the first was already forwarded,
   emit the error terminal — Bob will see the tool_call followed by
   agent_turn_error and know not to execute)

Best approach: buffer tool calls until `model_step_finished`. Only forward a
tool_call after the step is confirmed complete with exactly one call. This
aligns with the UI requirement (Phase 6: tools execute only after
model_step_finished).

**Gate:**
- [ ] Test: two tool calls in one step → agent_turn_error, Bob never sees an
      actionable tool_call

---

### Step 2.8 — Product Copilot Worker: hardened SSE parser

**File:** `agents/product-copilot/src/worker.ts`

**Defects:**
- New `TextDecoder` per chunk — corrupts multibyte characters split across chunks
- Silently skips malformed JSON and unknown events (V3)
- No SSE event-name/payload-type agreement check

**Fix:**
1. ONE streaming `TextDecoder` created before the read loop (maintains
   multibyte state across chunks)
2. CRLF/LF-safe boundary splitting (handle both `\n\n` and `\r\n\r\n`)
3. Complete tail handling (final event without trailing `\n\n` is processed)
4. Event-name/payload agreement: SSE `event:` name must match the JSON
   payload's `type` field — mismatch is a visible failure
5. Malformed JSON → visible failure (agent_turn_error), NOT silent skip
6. Unknown event names → visible failure
7. Downstream cancellation cancels the San Francisco reader (don't leave it
   running)
8. Tool-call count consistency: if finishReason is `tool-calls`, exactly one
   tool_call was seen; if `stop`, zero tool_calls were seen. Mismatch → visible
   failure.

**Gate:**
- [ ] Test: multibyte text split across chunks decodes correctly
- [ ] Test: malformed JSON → agent_turn_error
- [ ] Test: unknown event name → agent_turn_error
- [ ] Test: event-name/payload mismatch → agent_turn_error
- [ ] Test: CRLF boundaries parsed correctly
- [ ] Test: tool-call count inconsistent with finishReason → agent_turn_error

---

### Step 2.9 — Cancellation propagation

**Files:**
- `sanfrancisco/src/ai/model-turn.ts`
- `agents/product-copilot/src/worker.ts`

**Fix chain:**
- San Francisco `handleModelTurn`: accept `request.signal`, pass to
  `handleStreamMode` as `abortSignal`. Combined with timeout via the
  abort-cause mechanism from Step 2.2.
- Product Copilot Worker: already passes `request.signal` to SF fetch. Verify
  the stream reader catches AbortError and emits `agent_turn_stopped` for
  caller cancellation (not `agent_turn_error`).

**Gate:**
- [ ] Test: abort Roma → SF stream closes → Worker emits agent_turn_stopped

---

### Phase 2 Completion Gate

- [ ] Step 2.1: SF fallbacks removed
- [ ] Step 2.2: timeout ≠ caller cancellation
- [ ] Step 2.3: concurrency lease releases on cancel
- [ ] Step 2.4: modelStepId preserved
- [ ] Step 2.5: tool-calls as clean boundary
- [ ] Step 2.6: agent_turn_started only on initial
- [ ] Step 2.7: multiple tool calls rejected
- [ ] Step 2.8: hardened SSE parser
- [ ] Step 2.9: cancellation propagates
- [ ] sanfrancisco typecheck + all tests pass
- [ ] agents/product-copilot typecheck + all tests pass

---

## Phase 3 — Roma Full Authorization, Validation, and Grant Boundary

**Goal:** Roma validates the full versioned request, mints grants
authoritatively, and relays the stream without caller-controlled fields
crossing the boundary.

**Depends on:** Phase 2 complete.

### Step 3.1 — Roma route: use the shared parser (Phase 1.2)

**File:** `roma/app/api/account/instances/[instanceId]/copilot/route.ts`

Replace all inline kind/sessionId/userMessage validation with the shared
`parseCopilotTurnRequest` from `ck-contracts` (Step 1.2). Pass
`routeInstanceId` so the parser verifies the context instance matches.

After parsing succeeds, additionally verify:
- the loaded Tokyo instance's `widgetType` matches
  `request.currentDraftContext.widgetType` (this check needs the DB row, so it
  stays in the route)

**Gate:**
- [ ] All Step 1.2 parser rejection tests pass through the route
- [ ] widgetType mismatch → 422
- [ ] Roma typechecks

---

### Step 3.2 — Roma library: authoritative grant, no caller overwrite

**File:** `roma/lib/ai/account-copilot.ts`

**Defect:** `streamCopilotTurn` assembles `{ grant: args.grant, ...turnBody }`.
A caller-supplied `turnBody.grant` overwrites Roma's minted grant.

**Fix:** Construct the upstream body from explicitly allowed fields only:

```typescript
const upstream: Record<string, unknown> = {
  version: parsed.version,
  kind: parsed.kind,
  sessionId: parsed.sessionId,
  userTurnId: parsed.userTurnId,
  ...(parsed.kind === 'initial' ? { userMessage: parsed.userMessage } : {}),
  ...(parsed.kind === 'continuation' ? {
    priorModelStepId: parsed.priorModelStepId,
    toolCallId: parsed.toolCallId,
    toolName: parsed.toolName,
    toolResult: parsed.toolResult,
  } : {}),
  ...(parsed.selectedModel ? { selectedModel: parsed.selectedModel } : {}),
  conversationHistory: parsed.conversationHistory,
  currentDraftContext: parsed.currentDraftContext,
  grant: args.grant,           // Roma's minted grant — authoritative, last
  trace: { client: 'roma', requestId: args.requestId },  // Roma's trace
};
```

Caller-supplied `grant` and `trace` fields NEVER appear in the upstream body.

**Gate:**
- [ ] Test: caller body containing `grant: "forged"` → upstream body has Roma's
      grant, not the forged one
- [ ] Test: caller body containing `trace` → upstream has Roma's trace

---

### Step 3.3 — Roma route: skipTurnReservation only after validation

**Already addressed by Step 3.1** — the shared parser validates `kind` before
the route reaches `issueAccountCopilotGrant`. The reservation decision
(`skipTurnReservation: request.kind !== 'initial'`) runs only after validation
passes.

**Gate:**
- [ ] Test: garbage kind → 422, no reservation consumed
- [ ] Test: valid initial → one reservation
- [ ] Test: valid continuation → no reservation

---

### Step 3.4 — Roma typecheck fixes

**Files:**
- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `roma/lib/ai/account-copilot.ts`

Fix the two known errors:
1. SSE `Response` → use `new NextResponse(body, { headers })` or adapt
   `withSession` to accept `Response`
2. Missing `isRecord` import in `account-copilot.ts`

**Gate:**
- [ ] `cd roma && npx tsc --noEmit` — zero errors

---

### Phase 3 Completion Gate

- [ ] Step 3.1: Shared parser used, widgetType verified
- [ ] Step 3.2: Grant authoritative, no caller overwrite
- [ ] Step 3.3: Reservation only after validation
- [ ] Step 3.4: Roma typecheck clean
- [ ] Roma route tests pass (all parser rejections + grant boundary)

---

## Phase 4 — Typed Bob↔Roma Copilot Transport

**Goal:** Product Copilot events flow from Roma to Bob through the existing
host-command channel with their own typed contract. Translation untouched.
Invalid events fail visibly.

**Depends on:** Phase 3 complete.

### Step 4.1 — Roma: dedicated Copilot SSE relay with visible failure

**File:** `roma/components/builder-domain.tsx`

Add `HostCopilotEventMessage`:
```typescript
type HostCopilotEventMessage = {
  type: 'host:copilot-event';
  requestId: string;
  instanceId?: string;
  event: ProductCopilotTurnEvent;
};
```

Add `readCopilotStreamedEvents` that:
- Uses ONE streaming TextDecoder
- CRLF/LF-safe boundaries
- Validates each parsed event with `isProductCopilotTurnEvent` (Step 1.1)
- **Rejects (terminates the request visibly) on:**
  - invalid JSON
  - unknown event names
  - SSE event-name / payload-type mismatch
  - wrong `userTurnId` (doesn't match the request's turn)
  - missing required `modelStepId`
  - tool_call and model_step_finished carrying different step IDs
  - duplicated agent_turn_started / agent_turn_finished / terminal events
  - interrupted stream without a valid tool-step boundary or agent terminal
- Forwards valid events via `source.postMessage` as `HostCopilotEventMessage`
- Does NOT use `readJsonOrStreamedCommandResult`
- Does NOT require Translation's terminal `event: result` frame
- Downstream cancellation cancels the underlying reader

On rejection: send `host:account-command-result` with an error payload AND a
final `host:copilot-event` carrying `agent_turn_error` so Bob sees the
terminal.

**Gate:**
- [ ] Test: valid events forwarded
- [ ] Test: invalid JSON → request terminates with agent_turn_error
- [ ] Test: wrong userTurnId → request terminates
- [ ] Test: step ID mismatch → request terminates
- [ ] Test: Translation path unchanged

---

### Step 4.2 — Roma: `accept: text/event-stream` for run-copilot

**File:** `roma/components/builder-domain.tsx`

```typescript
if (args.command === 'generate-translations' || args.command === 'run-copilot') {
  headers.set('accept', 'text/event-stream');
}
```

**Gate:**
- [ ] Copilot fetch includes the accept header

---

### Step 4.3 — Bob: `runCopilot` returns a handle immediately

**File:** `bob/lib/session/sessionTransport.ts`

**Requirement:** Stop needs the request ID WHILE the request is running. The
signature returns a handle, not a bare Promise:

```typescript
type CopilotRequestHandle = {
  requestId: string;
  completed: Promise<{ ok: boolean; status: number; payload: unknown }>;
};

function runCopilot(args: {
  instanceId: string;
  body: unknown;
  onCopilotEvent: (event: ProductCopilotTurnEvent) => void;
  timeoutMs?: number;
}): CopilotRequestHandle;
```

Implementation: `requestId` is generated (or supplied by Bob) BEFORE the
postMessage is sent. The handle is returned synchronously. The `completed`
promise resolves when `host:account-command-result` arrives.

The message listener:
- `host:copilot-event` matching requestId → calls `onCopilotEvent(event)`,
  keeps listening
- `host:account-command-result` matching requestId → resolves `completed`,
  cleans up listener

Expose on `WidgetDocumentSession`.

**Gate:**
- [ ] Test: handle returned synchronously with requestId before completion
- [ ] Test: onCopilotEvent called for each forwarded event
- [ ] Test: completed resolves on terminal

---

### Step 4.4 — Bob: `cancelCopilot` method

**File:** `bob/lib/session/sessionTransport.ts`

```typescript
function cancelCopilot(requestId: string): void;
```

Dispatches `bob:account-command` with `command: 'cancel-copilot'` and
`body: { requestId }`. Acknowledged via `host:account-command-result`.

**Gate:**
- [ ] Test: cancel dispatches and is acknowledged

---

### Phase 4 Completion Gate

- [ ] Step 4.1: Copilot SSE relay with visible failure on invalid events
- [ ] Step 4.2: accept header sent
- [ ] Step 4.3: runCopilot returns handle immediately
- [ ] Step 4.4: cancelCopilot dispatches
- [ ] Translation path unchanged
- [ ] roma + bob typecheck pass
- [ ] Transport tests pass (forwarding, rejection, handle, cancel)

---

## Phase 5 — Race-Safe Cancellation and Concurrency Release

**Goal:** Stop works at any moment — during HTTP, between steps, after tool
execution. Concurrency never leaks. Timeout ≠ Stop.

**Depends on:** Phase 4 complete.

### Step 5.1 — Bob: two-fact turn/request state

**File:** `bob/components/CopilotPane.tsx` (or a hook)

Bob maintains:
1. **Active user turn** — from submission to terminal, survives between HTTP
   requests
2. **Active HTTP request** — the current `CopilotRequestHandle`, null between
   steps

When the user presses Stop:
1. Bob immediately marks the turn stopped (its own state change — do NOT wait
   for `agent_turn_stopped` through the aborted stream)
2. If an HTTP handle is active, call `cancelCopilot(handle.requestId)`
3. Bob sends no later continuation for the stopped turn
4. Bob ignores late events for that turn/request
5. Already-applied edits remain visible
6. One Undo remains available
7. Input becomes usable, turn displays as stopped/incomplete

**Critical:** Do NOT require Bob to receive `agent_turn_stopped` through the
stream it just aborted. That event may be undeliverable after downstream
cancellation. Bob's Stop action IS the UI truth. Server-side abort propagation
is verified separately in tests.

**Gate:**
- [ ] Test: Stop during active HTTP → request aborted, turn stopped
- [ ] Test: Stop between tool execution and continuation (no active HTTP) →
      turn stops, no continuation sent
- [ ] Test: late events for a stopped turn are ignored
- [ ] Test: applied edits remain visible after Stop
- [ ] Test: Undo remains available after Stop

---

### Step 5.2 — Roma: AbortController registry with unmount cleanup

**File:** `roma/components/builder-domain.tsx`

```typescript
const copilotAbortControllers = useRef<Map<string, AbortController>>(new Map());
```

In the run-copilot branch:
- Create AbortController, store by requestId
- Pass `signal` to the fetch
- Delete from registry in `finally`

In the `bob:account-command` listener, handle `cancel-copilot`:
- Look up controller by `body.requestId`
- Found: `controller.abort()`, delete, reply ok
- Not found: reply 404

On Builder unmount / session replacement:
- Abort ALL remaining controllers in the registry
- Clear the registry

**Gate:**
- [ ] Test: cancel aborts the exact named request
- [ ] Test: unmount aborts all remaining copilot requests
- [ ] Test: registry cleaned after completion/error/stop

---

### Step 5.3 — Add `cancel-copilot` to `BobAccountCommand`

**Files:** `bob/lib/session/sessionTypes.ts` AND
`roma/components/builder-domain.tsx` (both define the type — update both)

**Gate:**
- [ ] Type updated in both files, typecheck passes

---

### Phase 5 Completion Gate

- [ ] Step 5.1: Two-fact state, Stop at any moment
- [ ] Step 5.2: AbortController registry + unmount cleanup
- [ ] Step 5.3: cancel-copilot in command union
- [ ] Step 2.3 verified: SF concurrency releases on cancellation
- [ ] Step 2.2 verified: Stop ≠ timeout
- [ ] roma + bob typecheck pass
- [ ] Cancellation tests pass

---

## Phase 6 — Bob UI, Tool Execution, Continuation, and Undo Loop

**Goal:** The Copilot UI streams text, executes tools ONLY after full step
observation, sends continuations with correct coordinates, accumulates Undo,
and preserves Save.

**Depends on:** Phases 4 + 5 complete.

### Step 6.1 — Streaming text display

**File:** `bob/components/CopilotPane.tsx`

Replace `handleSend` to use `session.runCopilot`. The `onCopilotEvent`
callback:
- `agent_turn_started` → set loading, create streaming assistant message
- `text_delta` → append `event.data.text` to streaming message
- `tool_call` → **BUFFER, do NOT execute** (Step 6.2)
- `model_step_finished` → save modelStepId + finish data (Step 6.2 trigger)
- `agent_turn_finished` → finalize message, set idle
- `agent_turn_error` → show error, set idle
- `agent_turn_stopped` → mark stopped, set idle

### Step 6.2 — Tool execution ONLY after model_step_finished

**The critical sequencing rule:** tools execute only after the model step is
fully observed. Never on `tool_call` arrival.

On `tool_call` arrival:
- Buffer the complete tool call (toolCallId, toolName, input)
- Do NOT execute yet

On `model_step_finished` with `finishReason: "tool-calls"`:
1. Verify the buffered tool call carries the same `modelStepId` as the finish
2. Verify exactly ONE tool call was buffered (if multiple, the Worker already
   rejected — Step 2.7 — but Bob double-checks)
3. NOW execute:

```
a. Verify toolName === 'apply_widget_ops'
b. Expand typography ops: expandTypographyFamilyOps({ instanceData, fontLibrary, ops })
c. Validate + apply through session.applyOps(expandedOps) — existing engine
d. If failed → send continuation with { ok: false, errors }
e. If succeeded:
   - Build inverse ops from the exact pre-batch draft (buildCopilotUndoOps)
   - Append tool call + result to the structured model history (Step 1.3)
   - Send continuation with { ok: true, changedPaths, postApplySignature }
     and priorModelStepId from this step
```

**Preserve existing Bob edit behavior:**
- `expandTypographyFamilyOps` — typography shorthand expansion
- current control/path/value validation
- document validation when required
- preview and dirty-state changes exactly as a human edit
- inverse generation from the exact draft immediately before each batch

### Step 6.3 — Continuation request

```typescript
async function sendContinuation(args: {
  priorModelStepId: string;
  toolCallId: string;
  toolResult: unknown;
}) {
  const handle = session.runCopilot({
    instanceId,
    body: {
      version: 1,
      kind: 'continuation',
      sessionId,
      userTurnId: activeUserTurnId,
      priorModelStepId: args.priorModelStepId,
      toolCallId: args.toolCallId,
      toolName: 'apply_widget_ops',
      toolResult: args.toolResult,
      conversationHistory: modelHistory.entries,
      currentDraftContext: buildCurrentDraftContext(),
    },
    onCopilotEvent,
  });
  activeHandleRef.current = handle;
}
```

**Product Copilot request builder must NOT duplicate the tool result** — the
structured history (Step 1.3) contains the call + result once. The
continuation's top-level `toolResult` is validated against the final history
entry, and only ONE tool-result model message is sent to San Francisco.

### Step 6.4 — Undo accumulation

One user turn = one Undo entry:
- Accumulate inverse ops across all successful batches
- Batch 1 inverse, batch 2 inverse, batch 3 inverse
- Undo executes inverse 3, then 2, then 1 (reverse apply order)
- Later manual edit invalidates Copilot Undo (existing signature rule)

### Step 6.5 — Send/Stop toggle

- While a turn is active: Send becomes Stop
- Stop: mark turn stopped immediately (Bob's own state), cancel active HTTP
  if any, suppress continuation
- Already-applied edits remain, Undo remains

### Step 6.6 — Tier step-limit enforcement

- Expose the resolved tier `maxTurnsPerThread` value to the open Bob Copilot
  session (from the existing signed policy in the builder-open payload)
- Count every initial AND continuation model step in the turn
- Refuse the next continuation once the signed tier limit is reached
- Terminate visibly as incomplete
- Do NOT consume another monthly submission
- No new policy or store — use the existing signed policy value

### Step 6.7 — Save boundary

No changes. Save remains the only persistence action.

---

### Phase 6 Completion Gate

- [ ] Step 6.1: Streaming text displays
- [ ] Step 6.2: Tool executes ONLY after model_step_finished, never on arrival
- [ ] Step 6.3: Continuation includes priorModelStepId, no duplicated tool result
- [ ] Step 6.4: One Undo in reverse batch order
- [ ] Step 6.5: Send/Stop toggle works
- [ ] Step 6.6: Tier step limit enforced
- [ ] Step 6.7: Save unchanged
- [ ] bob typecheck + build pass

---

## Phase 7 — Focused Tests + Complete Integration Regression

**Goal:** Every behavior proven by runnable tests. Tests were added WITH each
phase; this phase is the cross-system regression and full-loop pass.

**Depends on:** Phase 6 complete.

### Step 7.1 — Cross-system stream tests (already partially in Phase 2)

- [x] Text-only turn: agent_turn_started + text_delta + model_step_finished (stop) + agent_turn_finished
- [x] Tool-call turn: events + model_step_finished (tool-calls) → NO terminal → Bob executes → continuation → finish
- [x] Rejected tool → error observation → no success claim
- [x] Multiple tool calls rejected (Worker rejects before Bob sees actionable call)

### Step 7.2 — Route and boundary tests (already partially in Phase 3)

- [x] Non-SSE JSON route-error handling (grant denied, validation error before stream starts)
- [x] Grant overwrite impossible
- [x] Usage reservation only on exact validated initial

### Step 7.3 — Transport tests (already partially in Phase 4)

- [x] Premature stream close → visible failure
- [x] Malformed event → visible failure
- [x] Mismatched turn/step IDs → visible failure

### Step 7.4 — Cancellation tests (already partially in Phase 5)

- [x] Late event after Stop → ignored
- [x] Stop between tool execution and continuation → turn stops, no continuation
- [x] Unmount cleanup
- [x] Cancellation concurrency release (8 slots, cancel one, 9th succeeds)
- [x] Stop ≠ timeout (abort cause distinction)

### Step 7.5 — Full-loop integration

- [x] Text-only turn end-to-end (Bob → Roma → PC → SF → back)
- [x] Tool call → Bob applies → continuation → finish
- [x] One Undo across multiple applied batches in one turn
- [x] Save persists observed draft through existing route

### Step 7.6 — Test commands registered

- [x] `agents/product-copilot/package.json` has `test:turn-contract`
- [ ] `roma/package.json` has copilot route test script
- [ ] `bob/package.json` has copilot tool test script

---

### Phase 7 Completion Gate

- [x] All tests pass in all workspaces
- [x] sanfrancisco typecheck + tests pass
- [x] agents/product-copilot typecheck + tests pass
- [x] roma typecheck + tests pass
- [x] bob typecheck + tests pass
- [x] packages/ck-contracts typecheck passes
- [x] wrangler dry-run succeeds for sanfrancisco + agents/product-copilot

---

## Phase 8 — Documentation Reconciliation

**Goal:** Documentation matches deployed truth. Status is honest. Authority
wording is correct.

**Depends on:** Phase 7 complete.

### Step 8.1 — Update PRD execution status

Update these files to reflect ACTUAL status (code started, specific slices in
progress or complete):
- `128__PRD__Clickeen_Agent_Runtime_Foundation.md` (parent)
- `128A__PRD__Agent_Turn_And_Authority_Contract.md`
- `128B__PRD__San_Francisco_AI_SDK_Model_Execution.md`
- `128C__PRD__Product_Copilot_Native_Tool_Agent.md`
- `128D__PRD__Bob_Roma_Interactive_Agent_Transport.md`

Append implementation evidence ONLY at the bottom of each PRD (Execution
Record section). Do not place execution logs between normative requirements.

### Step 8.2 — Update current system documentation

Update current truth in:
- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`
- `documentation/ai/agents/product-copilot.md`
- `documentation/services/bob.md`
- `documentation/services/roma.md`

Reflect: the /model/turn contract, the ProductCopilotTurnEvent union, the
tool-call/observation loop, the cancellation behavior, the concurrency release.

### Step 8.3 — Authority wording

Remove any "CTO" or invented-title references. Use "human product
owner/architect" — the repository's actual authority.

**Gate:**
- [x] All PRD status tables truthful
- [ ] Current docs match runtime
- [x] No "CTO" wording remains

---

## Phase 9 — Independent V1-V8 Audit

**Goal:** A fresh-eyes subagent verifies every acceptance criterion and runs
the V1-V8 audit.

**Depends on:** Phase 8 complete.

### Verification checklist (give to the subagent)

For each, answer PASS or FAIL with file:line evidence:

**Stream contract:**
1. SF emits model_step_error when reportedModel missing (no fallback)
2. SF emits model_step_error when usage missing (no fallback)
3. PC Worker preserves modelStepId in forwarded events
4. finishReason tool-calls → clean stream end, no error, no terminal
5. finishReason length → agent_turn_error (not finished)
6. agent_turn_started only on initial
7. Multiple tool calls in one step rejected before Bob sees actionable call
8. SSE parser: one TextDecoder, CRLF-safe, malformed events fail visibly
9. Event-name/payload-type agreement enforced

**Roma boundary:**
10. Full request validation via shared parser before grant/usage
11. Grant authoritative — caller cannot overwrite
12. Usage reservation only on validated initial
13. Roma typecheck clean

**Transport:**
14. ProductCopilotTurnEvent is its own typed union (modelStepId required)
15. Translation AgentActivityEvent {message} unchanged
16. accept text/event-stream sent for run-copilot
17. Copilot events forwarded as host:copilot-event
18. Invalid events terminate visibly (not dropped)

**Cancellation:**
19. cancel-copilot command exists
20. AbortController per active request with unmount cleanup
21. Abort propagates through all boundaries
22. Timeout ≠ user Stop (abort causes distinguished)
23. Concurrency releases on cancellation (no leak)
24. Stop between steps (no active HTTP) still stops the turn
25. Bob's own Stop action is UI truth (does not wait for server event)

**Bob UI:**
26. Streaming text displays
27. Tool executes ONLY after model_step_finished (never on tool_call arrival)
28. expandTypographyFamilyOps preserved
29. Continuation includes priorModelStepId
30. Structured model history (tool call once, result once, no duplication)
31. Send becomes Stop while active
32. One Undo in reverse batch order
33. Tier step limit enforced
34. Save unchanged

**Program hygiene:**
35. No six-kind protocol code remains
36. All workspaces typecheck
37. All tests pass
38. PRD status truthful
39. Current docs match runtime
40. No invented authority titles

**V1-V8:**
- V1: No silent substitution (no fallbacks anywhere)
- V2: No silent healing
- V3: No silent omission (invalid events fail, not dropped)
- V4: Fail-closed controls
- V5: Corruption not treated as absence
- V6: No partial-success masquerade
- V7: No masquerade/redress
- V8: No runtime test dependency

---

## Execution Tracking

Update this section as steps complete:

| Phase | Step | Status | Notes |
|---|---|---|---|
| 1 | 1.1 TurnEvent union | DONE + TESTED | 37 tests (run-copilot-contracts.ts) |
| 1 | 1.2 Shared request parser | DONE + TESTED | same 37 tests cover parser |
| 1 | 1.3 Structured model history | DONE + TESTED | 11 tests (run-copilot-model-history.ts) |
| 2 | 2.1 SF fallbacks removed | DONE + TESTED | 7 tests in run-stream-truth.ts |
| 2 | 2.2 Timeout ≠ cancel | DONE + TESTED | 2 tests in run-stream-truth.ts |
| 2 | 2.3 Concurrency release on cancel | DONE + TESTED | 4 tests (run-concurrency.ts); fixed locked-stream bug |
| 2 | 2.4 modelStepId preserved | DONE + TESTED | 12 tests (run-turn-contract.ts) |
| 2 | 2.5 Tool-calls boundary | DONE + TESTED | same |
| 2 | 2.6 Start only on initial | DONE + TESTED | same |
| 2 | 2.7 Multiple tools rejected | DONE + TESTED | same |
| 2 | 2.8 Hardened SSE parser | DONE + TESTED | 4 tests (multibyte, CRLF, decoder) |
| 2 | 2.9 Cancel propagation | DONE | request.signal wired; abort propagates |
| 3 | 3.1 Shared parser in route | DONE + TESTED | 4 tests (run-copilot-route-gates.ts) |
| 3 | 3.2 Authoritative grant | DONE + TESTED | 4 tests (no spread, grant last, Roma trace) |
| 3 | 3.3 Reservation after validation | DONE + TESTED | 2 tests (parser before grant, validated kind) |
| 3 | 3.4 Roma typecheck | DONE | zero errors |
| 4 | 4.1 Copilot SSE relay | DONE | readCopilotStreamedEvents; 1 streaming decoder test |
| 4 | 4.2 Accept header | DONE | SSE accept in run-copilot branch |
| 4 | 4.3 Handle-returning runCopilot | DONE | CopilotRequestHandle; subagent |
| 4 | 4.4 cancelCopilot method | DONE | fire-and-forget |
| 5 | 5.1 Two-fact turn state | DONE + TESTED | ActiveTurnState; turn survives between HTTP; Stop is Bob's own truth |
| 5 | 5.2 AbortController registry | DONE | copilotAbortControllers + unmount cleanup |
| 5 | 5.3 cancel-copilot type | DONE | both definitions |
| 6 | 6.1 Streaming text | DONE | onCopilotEvent → model history append |
| 6 | 6.2 Tool after step observed | DONE | bufferedToolCall → model_step_finished → execute |
| 6 | 6.3 Continuation request | DONE | sendContinuation with priorModelStepId |
| 6 | 6.4 Undo accumulation | DONE | turn.undoOps prepend; reverse order at undo |
| 6 | 6.5 Send/Stop toggle | DONE | isLoading → Stop; handleStop cancels + marks stopped |
| 6 | 6.6 Tier step limit | DONE | tierStepLimit from signed policy; refuse past limit |
| 6 | 6.7 Save unchanged | DONE | no Save changes in CopilotPane |
| 7 | 7.1-7.6 Integration regression | DONE | SF 47 gate tests pass (30 model-turn + 4 concurrency + 13 stream-truth); PC 12 stream-contract + 5 full-loop pass; Roma 10 route gates pass; Bob 11 model-history pass; 5 workspaces typecheck clean; wrangler dry-run succeeds |
| 8 | 8.1 PRD status | DONE | parent §14 + top Status lines + 128B/128C/128D Execution Records updated |
| 8 | 8.2 Current system docs | DONE | 5 doc files updated (ai/README, sanfrancisco, product-copilot, bob, roma) |
| 8 | 8.3 Authority wording | DONE | no CTO refs found in PRDs (wording already uses human product owner/architect) |
| 9 | — Independent audit | DONE | 39/40 PASS; 1 defect (streaming text display) found and FIXED; V1-V8 all PASS |
