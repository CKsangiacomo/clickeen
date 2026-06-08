# PRD 108A - San Francisco AI Plane Role and Contract

Status: PLANNING
Owner: Product + Architecture (San Francisco)
Priority: P0 for 108A-1; P1 for 108A-2
Date: 2026-06-08
Stage: 01-Planning
Type: Sub-PRD from PRD 108

Parent:
- `Execution_Pipeline_Docs/01-Planning/108__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

Related:
- `documentation/ai/overview.md`
- `documentation/ai/infrastructure.md`
- `documentation/services/sanfrancisco.md`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/ai-runtime.matrix.json`
- `sanfrancisco/src/ai/modelRouter.ts`
- `sanfrancisco/src/providers/openai.ts`
- `sanfrancisco/src/concurrency.ts`

---

## 0. Purpose

This PRD defines the overall role of San Francisco.

San Francisco is not a chatbot service and not an agent-specific worker. San Francisco is
the **single AI control and execution plane** for Clickeen.

Copilot-first correction: the first execution slice of this PRD exists to unblock Builder
Copilot, not to build the whole future workforce platform. 108A-1 is successful only when
Builder can no longer select or call unsupported model shapes and raw provider payloads no
longer leak into Copilot. Anything durable, service-scoped, autonomous, or workforce-agent
specific belongs to 108A-2/108C and must not delay the 108B control-operator proof.

Two different AI classes consume that plane:

1. **User Copilots** - interactive product assistants, such as Builder Copilot.
2. **Clickeen Workforce Agents** - service-scoped agents that help operate the company,
   such as translators, UX Writer, GTM, support, and moderation.

They are not the same product and do not run the same way. The shared part is the plane:
provider custody, grant verification, model routing, budgets, telemetry, learning events,
typed errors, eval signals, and risk/policy enforcement.

Execution sequencing:

- **108A-1** is the urgent Builder Copilot hardening slice: model capability metadata,
  provider conformance, typed provider errors, and picker eligibility.
- **108A-2** is the durable/service-plane slice: service-binding execution,
  service-scoped policy/grants, durable budget separation, and workforce-agent telemetry.

The sequence is mandatory: 108A-1 -> 108B -> 108A-2 -> 108C.

---

## 1. Product Truth

### 1.1 San Francisco owns the AI plane

San Francisco owns:

- provider keys
- AI grant verification
- capability and boundary enforcement
- model/provider routing
- model capability validation
- token, timeout, and concurrency budgets
- typed provider error normalization
- usage metadata
- learning-event emission
- eval/observability metadata
- risk/policy enforcement for AI execution

### 1.2 San Francisco does not own product truth

San Francisco does not own:

- account auth truth
- product entitlements
- instance source
- page source
- publish state
- billing truth
- account persistence
- widget definitions
- user edit state
- human-review artifact state
- product commit or publish actions

Those remain with Berlin, Roma, Tokyo/Tokyo-worker, and Bob according to the existing
product boundaries.

### 1.3 San Francisco is shared, but runtime shapes differ

The plane is shared. The execution shape is not.

User Copilots:

- interactive
- synchronous
- account/user-scoped
- latency-bound
- one user turn at a time
- return structured product edits or typed explanations

Workforce Agents:

- service-scoped or account-scoped depending on agent
- often durable or queue-driven
- may run minutes or hours
- may fan out work
- may use external tools
- return typed artifacts, translations, proposals, reports, or reviewed actions

The architecture must never blur those two classes.

---

## 2. Current Failure This PRD Must Prevent

Builder Copilot currently exposes a raw upstream OpenAI error to the user because
San Francisco hardcodes an unsupported `reasoning_effort` value for a selected model.

Observed failure:

```text
Unsupported value: 'reasoning_effort' does not support 'minimal' with this model.
Supported values are: 'none', 'low', 'medium', 'high', and 'xhigh'.
```

This is a plane failure, not a widget failure.

The failing policy path selects `gpt-5.2`, and the provider adapter currently infers call
shape from string-prefix heuristics. The plane allowed a model to be selected without
knowing the model's call contract, then leaked the provider's raw JSON into Builder. A
correct San Francisco plane rejects, hides, or normalizes that before the user sees it.

This PRD does **not** by itself make Copilot smart enough to edit Builder controls. That
is 108B. This PRD makes the plane safe and callable enough that 108B can focus on the
real editor problem: resolving user intent to visible Builder controls and returning valid
ops.

---

## 3. Required Plane Contract

### 3.1 Model capability registry

San Francisco needs model capability metadata, not only model labels.

The capability registry answers: **can San Francisco call this provider/model correctly?**
The existing `packages/ck-policy/ai-runtime.matrix.json` answers: **is this
agent/tier/account policy allowed to use this model?** Those are separate atoms and must
not be merged. Policy may reference a capability profile, but policy must not define
provider-call mechanics.

Each allowed model must declare:

- provider
- model id
- UI label
- endpoint family used by San Francisco
- supported token parameter (`max_tokens`, `max_completion_tokens`, etc.)
- supported reasoning effort values
- default reasoning effort, if any
- temperature support
- structured output support
- JSON schema support
- streaming support, if used
- provider retryability rules
- whether the model is allowed for user-facing picker
- whether the model is allowed for durable/internal agents
- capability profile version
- latest conformance status

San Francisco must construct provider requests from this registry, not from string-prefix
heuristics such as `model.startsWith('gpt-5')`.

The registry must be self-verifying. A provider-conformance check must call each declared
model with its declared parameters and fail loudly when provider behavior no longer
matches the declared capability. A declared capability that has never passed conformance is
unverified and must not be picker-eligible.

Minimum conformance coverage:

- token parameter name
- supported reasoning effort values
- default reasoning effort
- temperature support
- structured output / JSON schema support for any model used with those features

### 3.2 Typed error mapping

Provider errors must be normalized before reaching product surfaces.

San Francisco may log provider details internally, but product clients receive typed
Clickeen errors such as:

- `AI_MODEL_UNSUPPORTED_PARAMETER`
- `AI_MODEL_UNAVAILABLE`
- `AI_PROVIDER_RATE_LIMITED`
- `AI_PROVIDER_TIMEOUT`
- `AI_PROVIDER_EMPTY_RESPONSE`
- `AI_GRANT_INVALID`
- `AI_BUDGET_EXCEEDED`

Builder must never render raw provider JSON.

### 3.3 Shared execution core

Both interactive and service-binding execution paths must call the same internal plane
core for:

- grant validation
- agent resolution
- policy resolution
- model selection
- capability validation
- budget enforcement
- provider call
- typed result envelope
- telemetry/learning event

No agent or orchestrator may reimplement provider calls, model routing, or grant logic.

### 3.4 Separate workload budgets

Interactive Copilot calls and durable workforce-agent calls must not share one simple
in-isolate concurrency ceiling.

Required direction:

- interactive `/v1/execute` remains latency-sensitive and tightly capped
- durable/service-binding execution gets a separate budget surface
- durable orchestrators should queue or workflow-gate long-running work before calling SF
- a saturated durable run must not 429 a real user's Builder Copilot turn

### 3.5 Learning event as first-class plane output

Every execution must produce enough metadata for observability, evals, and future
learning:

- agent id
- phase/task class
- selected model
- provider
- model capability profile version
- prompt/playbook version
- policy version
- usage
- latency
- typed outcome
- typed provider failure, if any

The outcome/learning record must be queryable by:

```text
(agent_id, phase, model, capability_profile_version, prompt_version, policy_version)
```

This does not implement the learning loop. It ensures the substrate exists and keeps 108F
from requiring a schema migration just to ask which model/prompt/policy combination works.

### 3.6 Eval and observability gates

Every agent surface must have explicit eval or smoke scenarios before it ships:

- 108A-1: provider conformance and typed-error mapping tests
- 108B: Builder Copilot contract/op/e2e scenarios for shipped widgets
- 108C: reference workforce-agent quality and review-artifact scenarios

No customer-facing or autonomous workforce action ships only because it can run. It ships
when it passes the scenarios that prove it produces valid, reviewable, reversible, and
product-boundary-safe output.

---

## 4. In Scope

- Define San Francisco's role as the single AI plane.
- For 108A-1, add or design model capability metadata needed by Builder Copilot.
- For 108A-1, add provider-conformance checks for picker-eligible Copilot models.
- For 108A-1, remove hardcoded model string heuristics from provider request
  construction.
- For 108A-1, define product-safe error envelopes and prevent raw provider JSON from
  reaching Builder.
- For 108A-1, make model picker eligibility depend on provider conformance and policy.
- For 108A-2, define the shared execution core contract used by Copilots and workforce
  agents.
- For 108A-2, separate interactive and durable workload budget concepts.
- For 108A-2, define required eval/observability metadata for durable/service agents.
- Update canonical San Francisco docs when execution ships.

---

## 5. Out of Scope

- Refactoring Builder Copilot behavior. That is PRD 108B.
- Building GTM, UX Writer, support, or moderation agents. That is future execution off
  PRD 108C and later agent PRDs.
- Building durable/service-scoped workforce infrastructure before 108B proves the shipped
  Builder Copilot can operate visible controls.
- Building external outbound tools or MCP-style integrations.
- Building the closed-loop learning/policy self-improvement system. That is PRD 108F.
- Changing account/product persistence authority.
- Letting San Francisco write product truth directly.
- Owning human-review artifacts, approval state, or commit/publish actions.

---

## 6. Acceptance Criteria

108A-1 is execution-ready only when the next execution spec can answer:

- What is the exact model capability schema?
- Where does that schema live?
- How is capability distinct from policy in `ai-runtime.matrix.json`?
- How does each capability profile get conformance-tested?
- How does the OpenAI provider construct requests without string-prefix heuristics?
- How are provider errors mapped to product-safe errors?
- What makes a model picker-eligible for Builder Copilot?
- What eval/smoke scenarios prove the Copilot model-call contract cannot silently drift?
- Which docs must be updated when code ships?

108A-1 execution is complete only when:

- `gpt-5.2` is never called with unsupported reasoning values.
- a model capability declaration cannot merge without a passing conformance check.
- an unverified model is not picker-eligible.
- raw provider JSON no longer appears in Builder Copilot UI.
- model picker options cannot select a model shape San Francisco cannot call.

108A-2 is execution-ready only after 108B is green and can answer:

- Which execution paths call the shared plane core?
- Which concurrency/budget rules apply to interactive vs durable calls?
- What service-binding request/response shape supports durable orchestrators?
- Which eval/smoke scenarios prove durable plane behavior cannot silently drift?

108A-2 execution is complete only when:

- outcome records include `agent_id`, phase, model, capability profile version, prompt
  version, and policy version.
- San Francisco docs match the shipped plane contract.

---

## 7. Planning Review

1. **Elegant engineering and scalability**
   Yes. One plane contract prevents every agent from inventing model handling.

2. **Compliance with architecture and tenets**
   Yes. Product truth stays outside San Francisco; AI execution stays inside it.

3. **Avoids over-architecture**
   Yes if execution focuses on the current provider/model surfaces and does not build a
   speculative framework beyond the model capability registry and shared execution core.

4. **Moves toward intended architecture**
   Yes. This makes the "AI Workforce OS" claim technically real without confusing user
   Copilots and company workforce agents.
