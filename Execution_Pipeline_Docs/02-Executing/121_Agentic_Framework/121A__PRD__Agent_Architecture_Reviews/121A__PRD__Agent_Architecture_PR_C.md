# Peer Review C - 121A Agent Architecture

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121A__PRD__Agent_Architecture.md`
Verdict: Pass as architecture rail PRD, with contract precision needed before implementation.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/architecture/CONTEXT.md`
- `documentation/ai/sanfrancisco.md`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`
- `sanfrancisco/src/index.ts`
- `roma/lib/ai/account-copilot.ts`

Verified runtime truth:

- `packages/ck-contracts/src/ai.ts` already defines an AI registry with
  `cs.widget.copilot.v1` and `widget.instance.translator`.
- `cs.widget.copilot.v1` is category `copilot`, boundary `editor_ops_only`,
  execution surface `execute`.
- `widget.instance.translator` is category `system_agent`, boundary
  `account_widget_translated_values`, execution surface `endpoint`.
- Current policy already resolves runtime model/budget policy by agent id.
- Therefore 121A should not invent a new generic agent identity system before
  using the current registry shape as evidence.

Second-pass correction: keep 121A as architecture rails, but require a delta
against the existing registry/policy runtime rather than a greenfield registry.
Do not generalize the translator into `/v1/execute` until a PRD explicitly
changes its execution surface.

## 0b. Best-Practice Research Lens

Current agent-framework guidance from Anthropic, OpenAI Agents SDK, Google ADK,
LangChain HITL, and OWASP LLM risk material pushes 121A in one clear direction:
define the minimum reusable agent contract, not a framework empire.

Best-practice alignment:

- A real agent is not a regex router. It is an LLM-centered worker configured
  with instructions, tools, state policy, guardrails, structured outputs, and
  tracing.
- Shared architecture should describe invocation, model routing, tool schemas,
  guardrails, traces, and output contracts. It should not share Product Copilot
  behavior with Translation Agent or SDR Copilot.
- Frameworks are useful only when they expose the reasoning loop, tool calls,
  approvals, and traces. They are harmful if they hide prompts, tool contracts,
  or product validation.

Required PRD tightening:

- Add a concrete "Clickeen agent definition" minimum: canonical id,
  owner/surface, instructions profile, model-policy reference, tool manifest,
  input schema, output schema, guardrails, state/session policy, trace fields,
  and human/product review boundary.
- State that child-agent and multi-agent handoff support is a future capability,
  not V1 architecture work.
- Treat the current registry as the seed shape to evolve, not as proof that the
  current Copilot is a real agent.

## 0c. Pre-GA / No Back-Compat Lens

Because Clickeen is pre-GA, 121A should not over-respect the current agent
registry or envelope names. They are evidence of runtime plumbing, not a
compatibility contract.

Pre-GA amendment:

- If `cs.widget.copilot.v1`, `editor_ops_only`, `turnClass`, or similar names
  encode the old fake-agent worldview, replace them in the real-agent slice
  instead of adapting around them.
- Do not create dual contracts for "old Copilot" and "new Copilot." That would
  preserve the bad architecture and increase V7 masquerade risk.
- Define the clean Clickeen agent contract once, then update runtime/docs to it
  in the executing slice.

The constraint is not backward compatibility. The constraint is product law:
agent identity, input schema, tool boundary, output schema, validation, and trace
must be explicit and owned by the correct surface.

## 1. Elegant Engineering And Scalability

The PRD makes the right architectural move: it separates agent architecture from
agent behavior.

That matters because Product Copilot, Translation Agent, SDR Copilot, and future
internal agents are different workers. They cannot share product logic, context,
tools, permissions, or success metrics. The PRD keeps the shared layer where it
belongs:

```text
identity
invocation envelope
context contract
tool boundary
model/provider boundary
trace/cost/version records
policy/validation gates
```

That is scalable because it lets Clickeen add agents without rebuilding model
plumbing each time, while still forcing each agent to own its own product/workflow
truth.

The strongest line is the invocation rule:

> Raw user text does not choose the global agent.

That prevents the same old regex-router failure from returning under a new name.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD complies with Clickeen product law:

- agents do not become product truth owners;
- San Francisco can orchestrate without owning product state;
- product surfaces provide context and execute/validate side effects;
- Product Copilot and SDR Copilot remain separate;
- Translation Agent remains an artifact agent, not a Copilot.

It also follows the tenet against idealized framework drift. The PRD does not
define a universal personality, universal memory, universal task schema, or
shared Copilot implementation.

## 3. Overarchitecture Or Unnecessary Complexity

The main risk is that the list of shared architecture nouns can become a platform
build before Product Copilot exists.

Risky nouns:

- child-agent invocation boundary;
- outcome hooks;
- capability/tool contract;
- trace/cost/error/version records;
- policy and validation gates.

These are valid rails, but they should not all become day-one code.

Blast radius if overbuilt:

- San Francisco becomes a generic agent platform before one real agent works.
- Product Copilot execution stalls behind framework scaffolding.
- Translation Agent is forced through abstractions it does not need yet.

Required guardrail:

```text
Define the contract shape now.
Implement only the Product Copilot path and the minimum Translation Agent path
needed to prove the shape.
```

## 3b. Academic / Meta-Work / Gold-Plating Risks

The phrase "context contract" is correct, but still abstract.

Before execution, this PRD needs sharper failure behavior:

- What happens if required context is missing?
- What happens if the invoking surface sends stale context?
- What happens if a tool manifest exists but the product route rejects the call?
- What is agent output when a model/provider returns unusable content?

Without these, teams may build a clean-looking envelope but still fail open or
silently substitute missing truth.

The PRD should also avoid turning "reasoning step" into a magic box. It should
say the agent brain may use LLM calls, deterministic checks, tools, and product
context, but the architecture must trace the resulting decision path enough for
debugging and evals.

## 4. Why This Is Simple And Boring

The simple model is:

```text
product/workflow surface invokes a named agent
-> agent receives explicit context and allowed capabilities
-> model/provider is selected below the agent contract
-> tools/actions are validated by their owning product surface
-> trace records what happened
```

That moves Clickeen toward the intended architecture without pretending all
agents are the same product.

It is boring because it uses normal software boundaries: identity, contracts,
validation, versioning, traces. The intelligence belongs in the agent brain, not
in regex or scattered UI helpers.

## 5. Required Corrections Before Execution

Required:

- Add explicit failure behavior for missing/stale/invalid context.
- Add explicit failure behavior for unavailable tools/providers.
- Mark child-agent invocation as future, not required for first implementation.
- Use canonical agent ids where current runtime already names them:
  - `cs.widget.copilot.v1`;
  - `widget.instance.translator`.
- Clarify that Product Copilot invocation crosses Bob UI and Roma
  account/grant/route authority; Bob alone is not the full invocation boundary.
- State model fallback must be explicit, policy-allowed, trace-visible, and
  fail-closed when not allowed.
- Define the minimum day-one architecture slice:
  - agent id;
  - invocation envelope;
  - context capsule reference/version;
  - allowed capability manifest;
  - model route metadata;
  - trace id;
  - product validation result.

Recommended:

- Add a short "implementation order" section:
  1. Product Copilot minimum path.
  2. Translation Agent minimum path.
  3. Extract only proven common infrastructure.

## 6. V1-V8 Audit

- V1 Silent substitution: Watch. Missing context failure behavior must be
  explicit.
- V2 Silent healing: Pass. No invalid state repair is proposed.
- V3 Silent omission: Watch. Tool/provider/context failure paths need to be
  called out.
- V4 Fail-open control: Watch. Product validation is required, but missing
  dependency behavior is not yet specific.
- V5 Corruption-as-absence: Pass with watch. The PRD does not say corrupt
  context becomes absent.
- V6 Partial-success masquerade: Pass with watch. Execution outcomes need clear
  partial-failure semantics in child PRDs.
- V7 Masquerade/redress: Pass. Regex-as-agent is explicitly rejected.
- V8 Runtime test dependency: Pass. No runtime work depends on probes/tests.
