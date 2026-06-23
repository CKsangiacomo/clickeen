# PRD 120A - San Francisco AI Plane Role and Contract

Status: TECHNICAL AI-PLANE SLICE COMPLETE - PRODUCT AGENT WORK OUT OF SCOPE
Owner: Product + Architecture (San Francisco)
Priority: P0 for 120A1; P1 for 120A-2
Date: 2026-06-08
Stage: 03-Executed/120
Type: Sub-PRD from PRD 120

Parent:

- `Execution_Pipeline_Docs/03-Executed/120/120__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

Related:

- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`
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

Copilot-first correction: the first execution slice of this PRD is a release gate for
Builder Copilot model/provider safety, not a blocker for Bob's compiled-control Operator
work. 120A1 is successful only when Builder can no longer select or call unsupported model
shapes and raw provider payloads no longer leak into Copilot. Anything durable,
service-scoped, autonomous, or workforce-agent specific belongs to 120A-2/120C and must not
delay the 120B control-operator proof.

Two different AI classes consume that plane:

1. **User Copilots** - interactive product assistants, such as Builder Copilot.
2. **Clickeen Workforce Agents** - service-scoped agents that help operate the company,
   such as translators, UX Writer, GTM, support, and moderation.

They are not the same product and do not run the same way. The shared part is the plane:
provider custody, grant verification, model routing, budgets, telemetry, learning events,
typed errors, eval signals, and risk/policy enforcement.

Execution sequencing:

- **120A1** is the urgent Builder Copilot hardening slice: model capability metadata,
  provider conformance, typed provider errors, and picker eligibility.
- **120A-2** is the durable/service-plane slice: service-binding execution,
  service-scoped policy/grants, durable budget separation, and workforce-agent telemetry.

Execution order: 120B1/120B-2 may start immediately. 120A1 runs in parallel and must be
green before release. 120A-2 and 120C remain deferred until the shipped Builder Copilot is
green.

Execution amendment applied on 2026-06-18:

- 120A1 execution is narrowed to the live San Francisco provider-call defect and
  product-safe typed-error boundary needed for Builder Copilot Operator.
- Capability metadata and provider-call proof are deploy/build evidence for callable
  model shapes. They must not become runtime rituals that normal product work depends on.
- Routing, failover, escalation, conversion mode, durable budgets, and workforce-agent
  telemetry remain future work unless the Operator slice proves they are required.
- No 120A work may move product truth into San Francisco or give Tokyo/Tokyo-worker an AI
  orchestration role. Roma mints account/user grants; Bob owns the open working copy;
  San Francisco executes AI calls only.

Closeout amendment applied on 2026-06-19:

- 120A is complete only as the technical AI-plane support slice for the Builder
  Operator: capability/provider request safety, model picker eligibility, typed
  provider errors, and the scoped San Francisco execution boundary.
- 120A did not deliver a product Copilot, Builder Agent, Guide, Advice, account/tier
  help, or workforce-agent runtime.
- The real Builder product-agent rebuild shipped as
  `Execution_Pipeline_Docs/02-Executing/121_Agentic_Framework/121C__PRD__Product_Copilot_Real_Agent.md`.

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
is 120B. This PRD makes the plane safe and callable enough that 120B can focus on the
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

The registry must be backed by deploy/build provider-call proof. That proof calls each
declared picker-eligible model with its declared parameters and fails before release when
provider behavior no longer matches the declared capability. This is release evidence, not
a runtime dependency for normal Builder work. A declared capability that has never passed
that proof is unverified and must not be picker-eligible.

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

This does not implement the learning loop. It ensures the substrate exists and keeps 120F
from requiring a schema migration just to ask which model/prompt/policy combination works.

### 3.6 Eval and observability gates

Every agent surface must have explicit eval or smoke scenarios before it ships:

- 120A1: provider conformance and typed-error mapping tests
- 120B: Builder Copilot contract/op/e2e scenarios for shipped widgets
- 120C: reference workforce-agent quality and review-artifact scenarios

No customer-facing or autonomous workforce action ships only because it can run. It ships
when it passes the scenarios that prove it produces valid, reviewable, reversible, and
product-boundary-safe output.

---

## 4. In Scope

- Define San Francisco's role as the single AI plane.
- For 120A1, add or design model capability metadata needed by Builder Copilot.
- For 120A1, add provider-call proof for picker-eligible Copilot models as deploy/build
  evidence.
- For 120A1, remove hardcoded model string heuristics from provider request
  construction.
- For 120A1, define product-safe error envelopes and prevent raw provider JSON from
  reaching Builder.
- For 120A1, make model picker eligibility depend on policy plus known callable provider
  shape. The picker must not offer a model San Francisco cannot call.
- DEFERRED beyond 120A1: route classes, declared failover, escalation, conversion mode,
  and durable-agent routing. Do not execute those as part of the Operator proof unless a
  concrete Operator requirement exposes them.
- For 120A-2, define the shared execution core contract used by Copilots and workforce
  agents.
- For 120A-2, separate interactive and durable workload budget concepts.
- For 120A-2, define required eval/observability metadata for durable/service agents.
- Update canonical San Francisco docs when execution ships.

---

## 5. Out of Scope

- Refactoring Builder Copilot behavior. That is PRD 120B.
- Building GTM, UX Writer, support, or moderation agents. That is future execution off
  PRD 120C and later agent PRDs.
- Building durable/service-scoped workforce infrastructure before 120B proves the shipped
  Builder Copilot can operate visible controls.
- Building external outbound tools or MCP-style integrations.
- Building the closed-loop learning/policy self-improvement system. That is a deferred
  PRD 120-series direction.
- Changing account/product persistence authority.
- Letting San Francisco write product truth directly.
- Owning human-review artifacts, approval state, or commit/publish actions.

---

## 6. Acceptance Criteria

120A1 is execution-ready only when the next execution spec can answer:

- What is the exact model capability schema?
- Where does that schema live?
- How is capability distinct from policy in `ai-runtime.matrix.json`?
- How is each callable provider/model shape proven before deploy?
- How does the OpenAI provider construct requests without string-prefix heuristics?
- How are provider errors mapped to product-safe errors?
- What makes a model picker-eligible for Builder Copilot?
- What eval/smoke scenarios prove the Copilot model-call contract cannot silently drift?
- Which docs must be updated when code ships?

120A1 execution is complete only when (criteria are lineup-agnostic per PR-2/D1 —
the gpt-5.2 incident is the motivating example, never the definition of done):

- no model is callable by Builder Copilot unless San Francisco has an explicit provider
  call shape for it.
- no provider request parameter is derived from model-id string matching.
- an unverified model is not picker-eligible.
- raw provider payloads never reach product surfaces (negative fixture proves it).
- model picker options cannot select a model shape San Francisco cannot call.
- routing (PR-13/D8): turn-class routing, single-step escalation, and declared
  recorded failover are enforced by the plane; pinned user picks are never silently
  overridden.

Authoritative execution contract: `120A1__EXEC__AI_Plane_Capability_Conformance_Routing.md`.

120A-2 is execution-ready only after 120B is green and can answer:

- Which execution paths call the shared plane core?
- Which concurrency/budget rules apply to interactive vs durable calls?
- What service-binding request/response shape supports durable orchestrators?
- Which eval/smoke scenarios prove durable plane behavior cannot silently drift?

120A-2 execution is complete only when:

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
   Yes. This keeps the shared AI plane real without confusing user Copilots and company
   workforce agents.
