# Peer Review C - 121B San Francisco Orchestrator And Routing

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
Verdict: Pass directionally, but V1 must be the smallest extension of current San Francisco execution, not a new platform.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/ai/sanfrancisco.md`
- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/ai/modelRouter.ts`
- `sanfrancisco/src/telemetry.ts`
- `sanfrancisco/src/l10n-account-routes.ts`
- `packages/ck-contracts/src/ai.ts`

Verified runtime truth:

- `/v1/execute` already validates `{ grant, agentId, input }`, verifies the
  grant, resolves the canonical agent id, enforces `agent:${canonicalId}`, runs
  a registered executor, and enqueues an `InteractionEvent`.
- `AGENT_EXECUTORS` currently contains only `cs.widget.copilot.v1`.
- `widget.instance.translator` is a registry agent, but its execution surface is
  `endpoint`; it runs through `/v1/agents/instance-translation/*`, not the
  generic `/v1/execute` path.
- `/v1/outcome` already exists and persists signed outcome attachments to D1.
- Model routing already resolves selected/default provider and model from the
  signed grant and fails with `CAPABILITY_DENIED` on missing/disallowed policy.

Second-pass correction: 121B's V1 must be described as a constrained extension
of this deployed runtime. It must not imply San Francisco needs a new generic
orchestrator before Product Copilot can execute. Any move of Translation Agent
from endpoint surface to `/v1/execute` requires its own explicit decision.

## 0b. Best-Practice Research Lens

Modern agent orchestration guidance does not say "build a planner platform
first." It says choose the smallest orchestration shape that matches the task:
deterministic workflows for known tasks, agent loops for open-ended decisions,
handoffs only when a different worker must own the next step.

Best-practice alignment:

- San Francisco should orchestrate known agent executions, not classify raw user
  text into global product routes.
- Product-owned code should still enforce product safety, persistence, and side
  effects; the LLM reasons inside an allowed run boundary.
- Tracing should record model calls, tool calls, guardrails, approvals, and
  outcomes as separate spans/events rather than burying them in chat text.

Required PRD tightening:

- Define V1 as an extension of existing `/v1/execute`, grant verification,
  model routing, and `/v1/outcome`; do not introduce a second orchestrator path.
- Add explicit run-step semantics for Product Copilot: input guardrail, model
  reasoning, optional tool call, output schema validation, product validation,
  response/action return, trace/outcome attachment.
- Defer agents-as-tools and handoffs until a later PRD proves why another agent
  needs a different instruction set, tool set, or final-answer owner.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA means San Francisco does not need to preserve the current `/v1/execute`
shape if that shape forces the old Copilot contract to survive. Existing
execution primitives are useful only when they serve the new architecture.

Pre-GA amendment:

- Reuse grant verification, model policy, telemetry, and outcome plumbing where
  they remain correct.
- Replace the request/response contract if it bakes in Bob's pre-routed
  `turnClass`, `resolvedTarget`, scoped-control worldview, or edit-only output
  assumption.
- Do not build a compatibility router that accepts both old fake-agent turns and
  new real-agent turns unless there is a proven short migration need inside the
  same execution slice.

This makes the orchestrator work simpler: San Francisco can become a real agent
runner by cutting over the Product Copilot route, not by preserving the
masquerade as a legacy mode.

## 1. Elegant Engineering And Scalability

The strongest decision is that routing is defined as orchestration of a known
agent execution, not regex classification of raw user text.

That is the correct scalable architecture:

```text
invoking surface names agent
-> San Francisco validates invocation
-> runtime policy applies
-> model/provider route is selected
-> allowed tools route through product-owned boundaries
-> governed result returns
-> trace/outcome metadata records
```

This keeps product surfaces responsible for product truth while allowing San
Francisco to become the AI execution/orchestration plane.

The routing taxonomy is also right:

- agent invocation routing;
- model routing;
- tool routing;
- child-agent routing later;
- outcome routing.

Those are different concerns and should not be collapsed into one "router."

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD complies with the important laws:

- San Francisco does not own product truth.
- San Francisco does not mutate product artifacts directly.
- San Francisco does not invent missing product context.
- Product surfaces name the agent; raw text does not pick Product Copilot versus
  SDR Copilot.
- Tool calls require explicit manifests and validation.

The PRD is also aligned with the anti-masquerade tenet: it calls current San
Francisco transport/constraint infrastructure, not an agent brain.

Required compliance correction:

- Anchor the V1 implementation to current San Francisco reality: existing
  `/v1/execute`, `/v1/outcome`, telemetry/events, grant verification, and model
  routing. Do not imply a greenfield orchestrator if current deployed spine can
  be extended narrowly.

## 3. Overarchitecture Or Unnecessary Complexity

The risk is the word "orchestrator."

If interpreted expansively, it can trigger:

- durable workflow orchestration;
- central agent registry UI;
- central tool marketplace;
- planner framework;
- child-agent routing engine;
- eval-backed model fitness platform;
- generic fallback tree.

None of that is needed to prove Product Copilot.

Blast radius if overbuilt:

- Product Copilot is blocked by platform buildout.
- San Francisco starts owning product semantics.
- Tool routing drifts into product mutation authority.
- Teams debate orchestration abstractions instead of proving one agent turn.

## 3b. Academic / Meta-Work / Gold-Plating Risks

The "Execution Slices" section has the right nouns, but the first version must
be smaller:

```text
known agent id
minimal invocation envelope
current grant/policy check
provider route metadata
one structured output path
one trace/outcome hook
no child-agent routing
no durable orchestration
```

Child-agent routing should remain future until Product Copilot and Translation
Agent both exist as real agents.

Model fallback must also be explicit and fail closed where policy, privacy, or
quality cannot be satisfied. Silent downgrade to a cheaper/weaker model would be
a product-law violation for high-risk user-facing answers.

## 4. Why This Is Simple And Boring

The boring architecture is good:

1. Bob/Roma or another owning surface invokes a known agent.
2. San Francisco validates the request and policy.
3. San Francisco runs the known agent runtime.
4. San Francisco routes model calls and allowed tool calls.
5. Product-owned code validates side effects.
6. San Francisco records trace metadata.

This moves San Francisco from model gateway toward orchestrator without making
it product truth owner.

## 5. Required Corrections Before Execution

Required:

- State V1 extends current `/v1/execute` and `/v1/outcome`; it does not replace
  them wholesale.
- Replace placeholder ids with canonical ids where known:
  - `cs.widget.copilot.v1`;
  - `widget.instance.translator`.
- State `widget.instance.translator` is currently endpoint-surface, not a
  generic `/v1/execute` executor.
- Mark child-agent routing as future-only until two real agents prove the need.
- State that tool calls route through product-owned routes/tools; San Francisco
  does not execute product mutations itself.
- State fallback is explicit, policy-allowed, visible in trace, and fail-closed
  when not allowed.

Recommended:

- Add a V1 "not included" list:
  - no durable workflow engine;
  - no agent registry UI;
  - no tool marketplace;
  - no child-agent loops;
  - no eval-backed router beyond current policy metadata.

## 6. V1-V8 Audit

- V1 Silent substitution: Watch. Missing product context must fail closed, not
  be invented by San Francisco.
- V2 Silent healing: Pass. No product state repair is proposed.
- V3 Silent omission: Watch. Existing `/v1/execute` and `/v1/outcome` must be
  reconciled.
- V4 Fail-open control: Watch. Fallback behavior must be explicit and
  fail-closed unless policy allows it.
- V5 Corruption-as-absence: Pass with watch. Corrupt context/tool payloads must
  not be treated as absence.
- V6 Partial-success masquerade: Watch. Tool and child-agent failures need
  structured partial-failure semantics before implementation.
- V7 Masquerade/redress: Pass. Raw-text regex routing is rejected.
- V8 Runtime test dependency: Pass. No runtime flow depends on tests/probes.
