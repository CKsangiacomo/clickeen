# PRD 128C — Product Copilot Native-Tool Agent

Status: **EXECUTING — IMPLEMENTATION COMPLETE; OLD PROTOCOL DELETED; 12 STREAM TESTS PASS**

Depends on: 128A, 128B

Implementation unit: 128C and 128D are inseparable; neither releases before
128B–128E and 128F are complete

## 1. Purpose

Replace Product Copilot's one-shot six-kind JSON protocol with an agent-owned
reasoning loop that produces normal text and native typed Builder tool calls.

This PRD changes Product Copilot's brain contract. PRD 128D changes the Bob/Roma
interaction that executes tools and returns observations.

## 2. Current Failure

Current Product Copilot asks the model to serialize all intent into one custom
response kind. Its agent home parses that JSON, validates any `draft_edit`, and
may issue a second model call to repair malformed output.

This has three direct limitations:

- language and action are forced through one artificial response shape;
- the model cannot observe whether Bob actually applied an operation;
- a parser/retry protocol is doing work that native model tools should do.

Product Copilot's current quality is inadequate. Passing the old protocol tests
is not sufficient evidence for the rebuilt product.

## 3. Target Agent Home

Product Copilot owns:

- versioned Builder instructions;
- context construction from the exact open Builder input;
- available Builder tool definitions;
- ordered model messages supplied by Bob/Roma;
- reasoning-turn construction;
- interpretation of San Francisco model events;
- explicit finish and step-ceiling behavior;
- Product Copilot-specific evals.

It does not own:

- Bob draft state or tool execution;
- Roma account/instance authorization;
- provider credentials or provider routing;
- Save or publish;
- Tokyo writes;
- durable conversation storage.

## 4. Product Copilot Output

Product Copilot produces product-facing events derived from the
128A model-turn contract:

- explicit turn start carrying Bob's `userTurnId` as relayed by Roma;
- natural model-authored text deltas;
- complete Builder tool request;
- model-step finish metadata;
- explicit agent-turn completion only after no action remains outstanding;
- explicit turn error or stopped terminal event.

Answers, suggestions, clarification questions, and refusals are normal text.
There is no `kind` discriminator for ordinary conversation.

A model request to change the draft is a typed tool call. A transport or model
failure is an error, not conversational JSON.

## 5. Initial Builder Tool Surface

The tool surface must reuse Bob's existing structured draft-operation authority
and current compiled control truth. It must not invent Widget-specific tools or
move Widget semantics into Product Copilot.

Expose one tool:

```text
apply_widget_ops({ ops: WidgetOp[] })
```

`WidgetOp` is the existing Bob `set | insert | remove | move` contract. A batch
lets the model request a coherent multi-field edit in one observation cycle;
Bob validates and applies it through the existing ordered, atomic `applyOps`
path. Product Copilot does not create four parallel copies of Bob's operation
schemas.

Every tool argument schema must derive from existing operation/control
contracts and include only information Bob needs. Do not send the entire Widget
draft back as a tool argument.

The model sees concise tool descriptions and exact relevant control context. It
does not receive tools for Save, publish, account settings, model selection,
Tokyo writes, arbitrary JavaScript, DOM execution, or network fetch.

## 6. Context Contract

Product Copilot receives only the exact open Builder context already authorized
by Roma/Bob, adapted for the new tool loop:

- account/instance trace coordinates required for authorization and diagnosis;
- Widget type and relevant instance/draft context;
- current operable control catalog and exact current values;
- Product Copilot transcript for the open Bob session;
- exact tool results from prior steps in the same user turn;
- current model choice already authorized by Roma policy.

Missing required context fails visibly. Product Copilot does not invent empty
controls, another Widget, another account, or saved state.

## 7. Reasoning And Step Semantics

For each model step, Product Copilot streams natural model-authored text and may
emit at most one complete `apply_widget_ops` call. Tool protocol is not rendered
to the user.

Multiple tool calls in one model step are rejected before any operation is
applied. The one call may carry an ordered batch, which Bob applies atomically.
No tool runs in parallel. A new model step occurs only when the next decision
depends on the observation.

After Bob executes a requested tool, Product Copilot receives the exact result
as a tool-result message on a continuation request. It may then:

- request another tool;
- explain what happened;
- ask a clarification question;
- finish explicitly.

The conversation may naturally describe intended work, but it must not claim
that a change succeeded before Bob returns the exact successful tool result.
After the observation, the continuation may summarize what actually happened.
A deterministic failure case must prove that rejected or failed work is never
described as completed.

Enforce this through Product Copilot's instructions, observation sequence, and
product-task verification. Do not add a semantic text classifier, prose
validator, or UI-authored replacement narration.

The loop obeys the current tier-specific signed turn, token, and timeout policy
from DevStudio's existing AI runtime matrix. A ceiling ends visibly as
incomplete rather than pretending the requested outcome was finished.

## 8. Removal

Delete in the same branch:

- six-kind response types and parser;
- JSON-response prompt instructions;
- `draft_edit` envelope construction;
- malformed-response structural retry;
- response-kind-specific UI assumptions superseded by text/tool events;
- `agents/product-copilot/evals/real-eval.ts` direct OpenAI/DeepSeek calls and
  six-kind response scoring;
- evals that merely prove the obsolete envelope;
- dead compatibility code and documentation.

Retain WidgetOps and control validation where they remain Bob's native draft
contract. Native model tools do not erase structured product operations; they
place them at the correct action boundary.

## 9. Engineering Product-Task Verification

Replace the obsolete synthetic-only protocol score with engineering cases
against real current compiled Widget controls. Each case records exact starting
draft truth, expected changed paths/values/order, forbidden extra paths, and
whether clarification or refusal is expected. Coverage includes:

- grounded answer with no tool;
- one exact value edit;
- one coherent multi-field edit in one ordered batch;
- repeated-item insert, remove, and move on real current widget structures;
- an edit whose next step genuinely depends on the prior Bob observation;
- ambiguity requiring clarification before action;
- Save/publish/account/provider action refusal;
- Bob rejection with no success claim;
- cancellation before any tool and after one applied batch.

Deterministic checks own exact draft state, changed paths, no-extra-path truth,
tool contract, and Bob application. An LLM judge may score only language
quality; it may never decide whether product state was correctly applied.
Representative real-model tasks run through the authorized Product
Copilot→San Francisco path rather than direct provider credentials in the eval
harness. Retry-until-one-passes does not prove deterministic product truth. At
least one reversible task runs in the real live Bob surface before completion.

The current synthetic Riviera four-control eval is useful historical evidence
but is not sufficient: it can report a strong score while Product Copilot is
not useful across real widget controls.

These cases are engineering verification, not a product-quality authority. The
human product owner determines whether Product Copilot is useful by using it in
the real Builder.

## 10. Product Copilot Evaluation

Replace protocol-centric acceptance with task-centric cases covering:

- grounded answer without a tool;
- useful clarification when the requested target is ambiguous;
- one exact single-value `apply_widget_ops` request;
- ordered multi-step edit requiring observation between actions;
- item insert/remove/move through supported Widget structures;
- exact response to a Bob tool rejection;
- refusal of Save/publish/account/provider actions outside its tools;
- no success claim after a failed tool;
- concise completion after observed success;
- step-ceiling and cancellation behavior;
- operation across both current provider routes when those routes claim the
  required tool capability.

Quality must be judged on useful Builder outcomes, not similarity to the old
Copilot response.

## 11. Acceptance Criteria

- Product Copilot contains no custom six-kind response envelope.
- Product Copilot contains no malformed-JSON repair retry.
- Normal conversational output streams as text.
- Draft changes are native typed tool calls.
- The one tool is a direct projection of Bob's existing ordered WidgetOps.
- One tool batch can handle a coherent multi-field edit without one model round
  per field.
- Product Copilot can accept an exact tool result and continue reasoning.
- A failed/rejected tool remains visible and is never counted as applied.
- No provider-specific code exists in the agent home.
- No Save, publish, Tokyo, arbitrary code, or browser-network tool exists.
- No durable conversation or new agent framework is introduced.
- Product-task checks prove exact allowed operations, resulting draft truth,
  no extra paths, rejection behavior, and observation-before-success.
- Real-model evaluation runs through Product Copilot and San Francisco rather
  than direct provider calls from the agent home.

## Execution Record

### 128C Implementation (2026-08-13)

**Files rewritten:**
- `agents/product-copilot/src/index.ts` — streaming tool agent brain (six-kind protocol deleted)
- `agents/product-copilot/src/worker.ts` — POST /turn SSE endpoint

**Files deleted:**
- `agents/product-copilot/evals/product-copilot.json` (old six-kind fixtures)
- `agents/product-copilot/evals/run-product-copilot-eval.ts` (old contract runner)
- `agents/product-copilot/evals/real-eval.ts` (direct OpenAI calls)

**Files created:**
- `agents/product-copilot/tests/run-turn-contract.ts` — 12 stream contract tests
- `agents/product-copilot/tests/run-full-loop.ts` — 5 full-loop integration tests
- `packages/ck-contracts` additions: ProductCopilotTurnEvent, CopilotTurnRequest, parseCopilotTurnRequest
- `bob/lib/copilot/model-history.ts` — structured model history (11 tests)

**Verification:**
- Tool calls execute only after model_step_finished
- agent_turn_started only on initial
- Multiple tool calls rejected before Bob sees actionable call
- Hardened SSE parser (one TextDecoder, CRLF-safe, visible failures)
- Tool result duplication bug found and fixed (full-loop test)
