# Planning PRD - Ombra Model Strategy And Self-Hosted Readiness

Status: PLANNED - NOT BUILT
Owner: Product + Architecture + AI Runtime
Priority: P1
Date: 2026-06-20
Type: Planning PRD / future-scope guardrail

Origin: extracted from the 121 series after the 121-through-121D execution
closure. It remains visible planning, not active execution.

Related:

- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121A__PRD__Agent_Architecture.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`

---

## 1. Purpose

This PRD makes Ombra model strategy explicit.

It does not require self-hosted inference on day one.

It makes sure the architecture will not require a rewrite when Clickeen adds
self-hosted, Clickeen-hosted, or hybrid inference later.

Day one is provider-independent execution over the already wired providers. It
is not a self-hosted runtime, provider marketplace, or broad router build.

## 2. Core Law

Agents are product workers.

Models are execution dependencies.

Content source authority still applies. Model strategy must not give an agent
permission to rewrite human-generated or integration-sourced truth beyond the
authority granted by the product surface or integration write path.

Ombra must not be hardcoded to one provider, one model family, or one hosting
model.

Provider independence means agents do not hardcode providers. It does not mean
Clickeen must support many providers on day one.

## 3. Provider Classes

Day-one wired providers are:

- OpenAI;
- DeepSeek.

Future provider classes may include:

- hosted frontier models;
- lower-cost hosted models;
- specialized hosted models;
- Clickeen-hosted/self-hosted models;
- hybrid chains;
- judge/classifier/summarizer models.

These are future options/config slots, not adapters to build now.

## 4. Self-Hosted Readiness

Self-hosted does not mean Clickeen is building OpenAI or Gemini.

The strategic reason to consider self-hosted or Clickeen-hosted models is that
Clickeen is a closed, AI-legible system.

A Clickeen-hosted model can be valuable if it becomes excellent at
Clickeen-shaped tasks:

- classification;
- tool selection;
- structured extraction;
- bounded translation;
- summaries;
- repetitive copy transforms;
- eval/judge passes;
- product artifact reasoning where quality is proven.

Hosted frontier models may remain better for:

- broad conversation;
- ambiguous intent;
- long context;
- deep correctness;
- high-taste copy;
- complex planning;
- high-risk user-facing answers.

Default rule: use frontier/hosted models until evals prove a cheaper,
specialized, local, or self-hosted route is good enough for a specific
Clickeen task class.

## 5. Routing Requirements

Model routing must consider:

- agent id;
- task class;
- context size;
- privacy;
- cost;
- latency;
- quality evals;
- provider availability;
- self-hosted capacity.

Routing decisions must be observable and versioned.

Current routing is policy-driven over OpenAI and DeepSeek.

No 121 execution path may silently fall back to a substitute model, provider,
locale, artifact, or product path. If the exact authorized route is unavailable,
the operation fails explicitly.

Task-class routing requires a model capability registry before it can be
trusted.

The capability registry must be able to express:

- model id;
- provider;
- structured output support;
- tool-call support;
- reasoning-effort support/settings;
- context window;
- latency class;
- cost class;
- privacy/data boundary compatibility;
- prompt caching support;
- task-class eligibility;
- eval status.

Adding a provider is not config-only. It requires:

- typed contract support;
- registry/policy entry;
- adapter implementation;
- dispatch integration;
- provider configuration and failure behavior;
- trace-visible route metadata;
- tests/evals for the route.

Adding a provider must not require rewriting Product Copilot, Translation Agent,
or future agent brains.

Prompt caching is a model/provider cost primitive. It may reduce cost and
latency for repeated system prompts, schemas, rubrics, and stable context. It
must remain below the agent contract and must not change agent behavior.

Exact-route unavailability fails explicitly. No current 121 execution path may
substitute a different model, provider, locale, artifact, or product path. Any
future route-selection strategy must be defined before the exact execution
contract is sent, and it must not masquerade as fallback.

## 6. Operational Reality

Any self-hosted execution PRD must include:

- model selection;
- serving runtime;
- capacity;
- latency;
- monitoring;
- exact-route failure handling;
- release testing;
- evals;
- security;
- cost model;
- upgrade path.

Do not pretend self-hosting is free because the server is cheap.

Do not reject self-hosting because frontier-model companies exist.

Decide by Clickeen task fitness.

Published widget visitor runtime must never call Ombra or live model routes.
Widget network learning, if any, is async, governed, sampled, and future scoped.

## 7. Acceptance Criteria

- Agent architecture remains provider-independent.
- Day-one provider reality is OpenAI and DeepSeek.
- San Francisco/Ombra can add new provider classes without rewriting agents.
- Self-hosted is preserved as a serious future option, not a day-one dependency.
- Model routing is policy-driven on day one and becomes eval-backed/task-based
  only after the capability registry and task evals exist.
- Capability registry gaps are explicit and include structured output,
  tool-call support, reasoning effort, latency/cost, privacy compatibility,
  prompt caching, task eligibility, and eval status.
- Cheaper/local/self-hosted routes are disabled for a task class until evals
  prove task fitness.
- Exact route unavailability fails explicitly. No 121 execution path silently
  substitutes a model, provider, locale, artifact, or product path.
- Prompt caching is recognized as a cost primitive below the agent contract.
- Published widget visitor runtime does not call live model routes.
- Product Copilot and Translation Agent can use different model routes without
  changing their product contracts.
