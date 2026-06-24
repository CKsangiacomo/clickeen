# 121C PRD - Product Copilot Real Agent

Status: EXECUTED
Owner: Product + Bob + Roma + San Francisco
Priority: P0
Date: 2026-06-20
Executed: 2026-06-23
Type: Sub-PRD / first agent proof
Execution state: closed by 121-through-121D runtime completeness.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `documentation/services/bob.md`
- `documentation/services/roma.md`

---

## 1. Purpose

Build Product Copilot as the first real Clickeen agent.

This replaces the current regex/control-matcher masquerade.

Product Copilot is the hard agent because it is broad, conversational, and
inside live product work.

The current Product Copilot is a real conversational agent contract, not a
universal tool loop. It uses single-pass capsule reasoning with a typed output.
Bob owns the browser-memory Builder artifact and consumes Product Copilot's
structured result.

## 2. Product Reality

Product Copilot lives in the Product Copilot Cloudflare Worker agent home.

Bob/Roma invoke it from the Builder product surface. Bob owns the in-browser
draft artifact. Roma owns current account, tier, routes, and save. San
Francisco executes governed model calls only.

It helps a user work inside Clickeen:

- talk normally;
- ask product questions;
- ask for design/copy/content guidance;
- ask for widget edits;
- ask what something means;
- ask for suggestions;
- ask for account/page/widget workflow help;
- eventually ask about analytics or other internal agent outputs.

Product Copilot should guide the user back into useful Clickeen work, but it
must not collapse into a dumb edit-only bot.

## 3. Non-Goals

- Do not preserve `controlContract.ts` as the brain.
- Do not use regex as semantic routing.
- Do not require the user to name visible Builder controls before the agent can
  reason.
- Do not define SDR Copilot here.
- Do not define Translation Agent here.
- Do not directly mutate saved account/product state from the model.
- Do not preserve `turnClass`, `resolvedTarget`, `resolved_edit`,
  `multi_op_plan`, regex-scoped controls, or edit-only wire assumptions as the
  new brain contract.
- Do not create an SF-to-Bob live product callback loop.
- Do not move Product Copilot brain logic into Bob/Roma route code.

## 4. Conversation First

The user writes something.

The first step is not routing.

The first step is Product Copilot reasoning over:

- user message;
- current Bob session;
- current widget instance/draft;
- selected element/control where available;
- product docs/context where available;
- allowed capabilities;
- account/session constraints.

Only after reasoning does the agent decide:

- answer;
- ask a clarification;
- suggest;
- apply a draft edit;
- call an explicitly allowed product capability;
- refuse.

The output union is:

```text
answer | clarification | suggestion | draft_edit | refusal | error
```

This output union proves Product Copilot is not an edit-only bot.

## 5. Context Capsule

Product Copilot needs a Bob/Roma context capsule.

It should include only what the agent needs, such as:

- current widget type and instance id;
- current draft state summary;
- editable schema/control map;
- selected element/control if available;
- current page/session/account context where relevant;
- save/publish boundary;
- available actions/tools;
- unavailable capabilities;
- version metadata.

The capsule must be explicit, bounded, and versioned.

The capsule must also declare:

- token/byte budget;
- raw versus summarized fields;
- unavailable markers;
- staleness/version marker;
- selected control only when the user actually selected it;
- available actions;
- unavailable capabilities;
- trace/request id.

The capsule contains only the user's own widget/session/account facts needed for
the turn. It must not include unrelated account data, cross-account data,
hidden product data, SDR/prospect data, or future internal-agent records unless
a later PRD explicitly authorizes that context.

Missing, stale, invalid, oversized, or forbidden context must produce a visible
clarification, refusal, or error. It must not be silently substituted.

## 6. Capabilities

Initial Product Copilot capabilities should include:

- conversational answer;
- product guidance;
- edit suggestion;
- validated draft edit;
- clarification question;
- undo-aware response;
- refusal/error response.

Later capabilities may include:

- analytics product capability call;
- translation agent call;
- QA/recommendation agent call;
- account/page workflow capabilities.

Later does not mean build now.

Current Product Copilot does not include:

- child-agent calls;
- analytics product capabilities;
- Translation Agent calls;
- QA/recommendation agent calls;
- generic memory;
- generic document retrieval system;
- generalized tool machinery.

## 7. Product Actions

Product Copilot may propose actions.

Bob/Roma validate and execute actions.

For draft widget edits:

- Bob owns in-memory session state;
- Bob validates edit operations;
- Bob applies reversible edits;
- user owns Save;
- Roma owns persistence/account authority.

The model never bypasses this.

### 7.1 Draft-Action Contract

Product Copilot must define a new draft-action contract.

It must not inherit the legacy `resolved_edit | multi_op_plan` shape or any
pre-model semantic routing fields.

Draft actions must be schema-valid by construction and Bob-validated before
apply. Bob's op validator remains the product safety boundary; it is not the
agent brain.

### 7.2 Bounded Validation Retry

The Product Copilot brain self-validates draft actions against the context
capsule.

If structural validation fails, the brain may perform one bounded retry using
the validation error as feedback.

Bob is the terminal authoritative validator against the live working copy.

If Bob rejects, the user sees clarification, refusal, or error. There is no
second retry loop between Bob and the brain.

## 8. San Francisco Role

San Francisco executes model calls for the Product Copilot brain under the
121B model-execution contract:

- verify grant;
- apply runtime policy;
- execute exact model/provider calls;
- record trace/cost/errors;
- return model content plus usage/error metadata to the Product Copilot home.

San Francisco does not own Bob state or Roma account truth.

San Francisco does not own Product Copilot session/thread state.

Product Copilot conversation/session state lives in the Product Copilot agent
home or the Bob/Roma path defined by the execution slice, not San Francisco KV.

## 8.1 Day-One Eval Harness

Product Copilot requires an eval harness before replacing the current shipped
path.

The harness must include:

- representative Builder turns from known failures and earth-test prompts;
- expected output variant;
- deterministic draft-op validation;
- LLM-judge rubrics for tone, grounding, helpfulness, and whether the agent
  understood the requested product work;
- transcript review;
- pass@1 and pass^k tracking;
- regression gate for every prompt, harness, tool, output-contract, or model
  route change.

Trace records must feed this harness rather than creating a second capture path.

## 8.2 Visible Failure Taxonomy

These failures are terminal or visible:

- rejected op;
- stale capsule;
- missing required context;
- oversized context;
- unavailable provider;
- malformed model output;
- product validation failure;
- Bob validation failure after the one bounded brain retry.

They must surface as `clarification`, `refusal`, or `error`, never success.

## 9. Acceptance Criteria

- Product Copilot can converse normally.
- Product Copilot can understand open-ended product intent without regex
  control matching.
- Product Copilot can decide answer/ask/suggest/apply/refuse.
- Draft edits are validated by Bob before application.
- Saved product data changes still go through existing product routes.
- Current hardcoded control matcher is removed from the agent-brain path.
- The old pre-model routing envelope is removed from the brain path, including
  `turnClass`, `resolvedTarget`, scoped-control regex assumptions,
  `resolved_edit`, and `multi_op_plan`.
- Product Copilot uses the output union:
  `answer | clarification | suggestion | draft_edit | refusal | error`.
- Product Copilot uses single-pass capsule reasoning with at most one
  bounded brain self-validation retry.
- Bob remains the terminal live-state validator for draft edits.
- The context capsule is bounded, privacy-scoped, versioned, and explicit about
  unavailable data.
- Product Copilot session/thread state does not live in San Francisco KV.
- Product Copilot ships with an eval harness and visible failure taxonomy.
- Traces record agent version, context version, model route, actions, and
  validation outcomes.
