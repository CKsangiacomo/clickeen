# 121B PRD - San Francisco AI Engine And Routing Boundary

Status: EXECUTING
Owner: Architecture + AI Runtime
Priority: P0
Date: 2026-06-20
Type: Sub-PRD / runtime architecture
Pre-execution amendment state: settled for first execution slice after peer-review convergence.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `documentation/ai/infrastructure.md`
- `documentation/services/sanfrancisco.md`
- `Execution_Pipeline_Docs/03-Executed/120/120__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

---

## 1. Purpose

This PRD defines San Francisco as the AI engine and model-routing boundary for
real Clickeen agents.

San Francisco V1 is not the Product Copilot brain.

San Francisco V1 is not Bob.

San Francisco V1 is not product truth.

San Francisco V1 is a stateless execution boundary for known agent model calls:

- verify grant;
- apply runtime policy;
- route/execute an allowed model provider;
- validate structured result shape;
- emit trace/outcome metadata;
- return to the caller.

Routing here means model/provider routing under policy. It does not mean
regexing raw user language, choosing which product agent should answer, or
deciding product intent before the agent reasons.

Known agent execution follows this shape:

```text
invoking surface
-> agent id
-> context contract
-> grant in the execution contract
-> runtime policy
-> model/provider route
-> structured model result
-> governed result
-> trace/outcome record
```

The product surface chooses the agent.

The agent brain reasons about intent, clarification, action selection, and
conversation behavior.

San Francisco routes model calls.

## 2. Current Truth

San Francisco currently has useful execution utility:

- grant verification;
- provider/model execution;
- runtime policy checks;
- usage/error metadata;
- telemetry.

That is not yet orchestration.

It is transport and constraint infrastructure.

V1 should extend this deployed spine. It should not greenfield a broad agent
platform before the first real agent proves the contract.

Current deployed primitives include:

- `/v1/execute`;
- `/v1/outcome`;
- grant verification;
- model/provider execution;
- runtime policy checks;
- telemetry/event capture.

## 3. San Francisco V1 Responsibilities

San Francisco V1 is responsible for:

- invocation envelope validation;
- caller-to-agent authorization from the existing Roma/account grant path;
- static typed agent config used by runtime policy;
- runtime policy application from the verified grant;
- model/provider routing;
- OpenAI and DeepSeek provider execution;
- structured result validation;
- trace/cost/error recording;
- `/v1/outcome` attachment path;
- fallback behavior where allowed.

San Francisco must not become responsible for:

- owning product truth;
- directly mutating product artifacts;
- inventing missing product context;
- deciding that raw text belongs to Product Copilot versus SDR Copilot;
- bypassing Bob/Roma/Tokyo/Berlin authority.
- storing Product Copilot session/thread state;
- running the live Builder draft loop;
- calling back into Bob to execute browser-memory tools;
- owning product mutations.

San Francisco is stateless per model execution call.

It verifies the grant, resolves policy, routes/executes the model call,
validates the structured result, emits trace, and returns.

It does not own per-session or per-thread state.

Any Product Copilot conversation/session state currently held in San Francisco
KV must move to the Product Copilot agent home or to the Bob/Roma-owned
conversation path defined by 121C.

## 3.1 V1 Provider Boundary

V1 supported provider keys are:

- OpenAI;
- DeepSeek.

That is sufficient for V1.

Provider independence means agents do not hardcode providers. It does not mean
Clickeen must support many providers on day one.

The provider boundary must be extension-safe:

```text
agent brain
-> San Francisco model execution contract
-> policy resolves allowed provider/model
-> provider adapter executes
-> structured result returns
```

Adding a later provider, including Anthropic, Gemini, Ombra/self-hosted, or
another provider, must be a San Francisco config/adapter/policy/test change. It
must not require rewriting Product Copilot, Translation Agent, or any other
agent brain.

## 3.2 Grant In The Execution Contract

The grant path is explicit:

```text
Roma mints or derives account grant
-> invoking surface / agent home carries grant in execution contract
-> San Francisco verifies grant
-> San Francisco resolves runtime policy from verified grant
-> San Francisco executes allowed model route
```

San Francisco does not invent a separate product ACL.

## 4. Routing Types

### 4.1 Agent Invocation Routing

The invoking product/workflow surface names the agent.

Examples:

- Bob invokes `product-copilot`.
- Roma/background workflow invokes `translation-agent`.
- Future SDR surface invokes `sdr-copilot`.

San Francisco validates that the caller is allowed to invoke that agent.

This is caller-to-agent authorization, not intent routing.

Raw user text never chooses the global product agent.

### 4.2 Model Routing

San Francisco chooses the model/provider for an execution step based on:

- agent policy;
- task class;
- context size;
- privacy/cost/latency constraints;
- eval-backed model fitness;
- fallback policy.

Model routing is below the agent contract.

V1 model routing is limited to configured OpenAI and DeepSeek routes.

Additional providers remain extension-safe options, not V1 requirements.

### 4.3 Tool Routing

Agents may ask to call tools.

Tool routing applies only when the tool is server-side/durable or exposed
through an explicit product-owned governed route.

San Francisco routes the tool call only if:

- the tool is in the agent's allowed manifest;
- the caller has authority;
- the input schema validates;
- the tool owner accepts the call;
- side-effect/review policy allows it.

Product mutations never become San Francisco-owned.

For interactive Product Copilot V1, Bob validates and applies live
browser-memory draft actions. San Francisco does not call back into Bob to
execute product tools.

### 4.4 Child-Agent Routing

Some agents may call another agent.

This must be explicit, not implicit.

Child-agent routing is a future capability unless the Product Owner decides
otherwise. It is not required for the first Product Copilot execution slice.

Child-agent calls require:

- parent agent permission;
- child agent permission;
- bounded context handoff;
- trace linkage;
- result contract;
- loop/depth limits.

### 4.5 Outcome Routing

San Francisco records execution outcome metadata.

Product surfaces record product outcomes where they own the truth.

Learning systems consume governed traces/outcomes later; they do not silently
rewrite production behavior.

## 5. Product Copilot Example

```text
Bob user writes message
-> Bob/Roma invoke Product Copilot with context capsule and grant
-> Product Copilot brain receives the governed execution contract
-> Product Copilot brain calls San Francisco for model execution
-> San Francisco verifies grant and policy
-> San Francisco routes configured OpenAI/DeepSeek model call
-> San Francisco validates structured result and emits trace
-> typed response/action returns to Product Copilot/Bob
-> Bob validates and applies reversible draft edits in browser memory
-> Roma persists only through existing account/product routes
-> outcome attaches through the governed outcome path
```

There is no pre-agent regex route that decides the user's meaning.

There is no San Francisco-to-Bob live callback channel.

Product Copilot session/thread state does not live in San Francisco.

## 6. Translation Agent Example

```text
Roma or workflow requests translation job
-> Translation Agent home receives artifact context and grant
-> Translation Agent home calls San Francisco for model execution
-> San Francisco validates translation-agent invocation
-> agent receives artifact context and locale target
-> agent reasons over translatable content and protected structure
-> model route executes under policy
-> output returns as reviewable translated artifact
-> product workflow accepts/rejects/applies through product routes
```

`widget.instance.translator` currently executes through the instance-translation
endpoint surface. Moving Translation Agent into generic `/v1/execute` requires
an explicit later decision.

## 7. Execution Slices

1. Define the San Francisco model execution contract.
2. Define invocation envelope and grant-in-contract validation.
3. Define static typed agent config for V1.
4. Define OpenAI and DeepSeek provider adapter/config shape.
5. Define structured result validation.
6. Define trace record and `/v1/outcome` attachment.
7. Move Product Copilot session/thread state out of San Francisco KV.
8. Prove with Product Copilot.
9. Prove with Translation Agent or another focused server-side agent when
   explicitly selected.
10. Add child-agent routing only after two real agents exist and the Product
    Owner decides it belongs in scope.

## 8. Acceptance Criteria

- San Francisco routes known agent executions, not raw product meaning.
- Model routing is provider-independent.
- V1 supports OpenAI and DeepSeek provider keys only, while keeping provider
  addition extension-safe through San Francisco config/adapter/policy/tests.
- Tool routing requires explicit manifests and validation.
- Product surfaces retain product authority.
- San Francisco is stateless per model execution call.
- Product Copilot session/thread state does not remain in San Francisco KV.
- The execution contract carries the Roma/account grant to San Francisco for
  verification and policy resolution.
- Routing is model/provider routing, not intent routing.
- Product Copilot live draft loop remains in Bob.
- There is no San Francisco-to-Bob live product mutation channel.
- Fallback is explicit, policy-allowed, trace-visible, and fail-closed when not
  allowed.
- Traces distinguish gateway plumbing from agent reasoning.
- The architecture can support Product Copilot and Translation Agent without
  forcing shared product logic.
