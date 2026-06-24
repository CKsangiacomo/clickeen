# 121B PRD - San Francisco AI Engine And Routing Boundary

Status: EXECUTED
Owner: Architecture + AI Runtime
Priority: P0
Date: 2026-06-20
Executed: 2026-06-23
Type: Sub-PRD / runtime architecture
Execution state: closed by 121-through-121D runtime completeness.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`
- `Execution_Pipeline_Docs/03-Executed/120/120__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

---

## 1. Purpose

This PRD defines San Francisco as the AI engine and model-routing boundary for
real Clickeen agents.

San Francisco is not the Product Copilot brain.

San Francisco is not Bob.

San Francisco is not product truth.

San Francisco is a stateless execution boundary for known agent model calls:

- verify grant;
- apply runtime policy;
- execute the exact allowed model/provider route;
- emit trace/outcome metadata;
- return to the caller.

Routing here means executing the model/provider route already authorized by the
grant. It does not mean regexing raw user language, choosing which product
agent should answer, deciding product intent before the agent reasons, or
falling back to a substitute model.

Known agent execution follows this shape:

```text
invoking surface
-> agent id
-> context contract
-> grant in the execution contract
-> runtime policy
-> exact model/provider execution
-> model content plus usage/error metadata
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

The 121 series extends this deployed spine only where agents need governed
model execution. It must not greenfield a broad agent platform.

Current deployed primitives include:

- `/model/chat`;
- deprecated `/execute` returning visible failure in San Francisco;
- `/outcome`;
- grant verification;
- model/provider execution;
- runtime policy checks;
- telemetry/event capture.

## 3. San Francisco Responsibilities

San Francisco is responsible for:

- model-call request validation;
- grant verification;
- runtime policy application from the verified grant;
- exact model/provider execution;
- OpenAI and DeepSeek provider execution;
- trace/cost/error recording;
- `/outcome` attachment path;
- explicit failure when the exact authorized model/provider path is unavailable.

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
- owning Translation Agent overlay writes.
- routing tools or child agents.
- falling back to substitute models, providers, locales, or artifacts.

San Francisco is stateless per model execution call.

It verifies the grant, resolves policy, executes the exact model call, emits
trace, and returns model content plus usage/error metadata to the agent home.

It does not own per-session or per-thread state.

Any Product Copilot conversation/session state currently held in San Francisco
KV must move to the Product Copilot agent home or to the Bob/Roma-owned
conversation path defined by 121C.

## 3.1 Current Provider Boundary

Current supported provider keys are:

- OpenAI;
- DeepSeek.

That is sufficient for the current product.

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
- Roma invokes `translation-agent` for account translation work.
- Future SDR surface invokes `sdr-copilot`.

The invoking product surface owns caller-to-agent authority before the model
call. San Francisco verifies the signed grant and model policy for the model
execution request.

This is caller-to-agent authorization, not intent routing.

Raw user text never chooses the global product agent.

### 4.2 Exact Model Execution

San Francisco receives an exact model/provider route in the governed model-call
request.

San Francisco verifies:

- the grant signature and expiry;
- the agent capability;
- the requested provider/model is allowed by the grant policy;
- the provider key and model route are available.

Then it executes that exact route or fails explicitly.

Route selection belongs before the San Francisco execution request. San
Francisco must not substitute a different provider/model after receiving the
exact execution contract.

Current model execution is limited to configured OpenAI and DeepSeek routes.

Additional providers remain extension-safe options, not current execution
requirements.

### 4.3 Product Capability Routing

Agents may ask to use product capabilities.

Product capability calls are owned by agent homes and product surfaces, not San
Francisco. If a future agent needs a server-side capability, that capability is
exposed through its owning product route and a separate PRD. Product mutations
never become San Francisco-owned.

For interactive Product Copilot, Bob applies live browser-memory draft actions.
San Francisco does not call back into Bob to execute product tools.

### 4.4 Child-Agent Routing

San Francisco does not route child agents in the 121 execution scope.

Future agent-to-agent calls require their own PRD and must name the parent
agent, child agent, product purpose, context handoff, result contract, and loop
limits. They are not implied by the San Francisco model-execution boundary.

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
-> San Francisco executes exact configured OpenAI/DeepSeek model call
-> San Francisco emits trace and returns model content plus usage/error metadata
-> Product Copilot returns typed response/action to Bob
-> Bob applies reversible draft edits in browser memory
-> Roma persists only through existing account/product routes
-> outcome attaches through the governed outcome path
```

There is no pre-agent regex route that decides the user's meaning.

There is no San Francisco-to-Bob live callback channel.

Product Copilot session/thread state does not live in San Francisco.

## 6. Translation Agent Example

```text
Roma account translation route reads active locales
-> Roma calls Translation Agent Worker with saved instance coordinate and grant
-> Translation Agent Worker calls San Francisco for model execution
-> San Francisco verifies grant and executes exact model/provider route
-> Translation Agent reasons over translatable content and protected structure
-> Translation Agent writes locale overlays through Tokyo-worker
-> runtime consumes the saved overlay folder
```

`widget.instance.translator` is moved by 121D into its own Translation Agent
Worker home. It must not move into generic San Francisco `/execute`.

## 7. Execution Slices

1. Define the San Francisco model execution contract.
2. Define invocation envelope and grant-in-contract validation.
3. Define static typed agent config for current execution.
4. Define OpenAI and DeepSeek provider adapter/config shape.
5. Define structured result validation.
6. Define trace record and `/outcome` attachment.
7. Move Product Copilot session/thread state out of San Francisco KV.
8. Prove with Product Copilot.
9. Prove with Translation Agent or another focused server-side agent when
   explicitly selected.
10. Leave agent-to-agent calls out of scope until a separate PRD names the real
    product use case.

## 8. Acceptance Criteria

- San Francisco routes known agent executions, not raw product meaning.
- Model routing is provider-independent.
- Current execution supports OpenAI and DeepSeek provider keys only, while keeping provider
  addition extension-safe through San Francisco config/adapter/policy/tests.
- Product capability routing is outside San Francisco.
- Product surfaces retain product authority.
- San Francisco is stateless per model execution call.
- Product Copilot session/thread state does not remain in San Francisco KV.
- The execution contract carries the Roma/account grant to San Francisco for
  verification and policy resolution.
- Routing is model/provider routing, not intent routing.
- Product Copilot live draft loop remains in Bob.
- There is no San Francisco-to-Bob live product mutation channel.
- Exact route unavailability fails explicitly. There is no silent substitute
  model, provider, locale, artifact, or product path.
- Traces distinguish gateway plumbing from agent reasoning.
- The architecture can support Product Copilot and Translation Agent without
  forcing shared product logic.
