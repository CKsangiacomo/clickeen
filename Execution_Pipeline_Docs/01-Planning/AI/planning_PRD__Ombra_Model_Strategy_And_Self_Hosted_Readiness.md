# Planning PRD — Ombra Model Strategy And Self-Hosted Readiness

Status: PLANNED — SELF-HOSTED INFERENCE NOT BUILT

Owner: Product + Architecture + AI Runtime

Last updated: August 2026

Related:

- `Execution_Pipeline_Docs/02-Executing/128__Clickeen_Agent_Runtime_Foundation/`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121A__PRD__Agent_Architecture.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `documentation/ai/ombra.md`
- `documentation/ai/sanfrancisco.md`

## 1. Purpose

Ombra defines Clickeen's long-term model ownership strategy and the boundary
through which hosted, self-hosted, fine-tuned, and eventually Clickeen-trained
models can execute agent work.

Ombra is not currently a Worker, endpoint, model, provider, or agent. PRD 128
builds a model-independent agent execution boundary; it does not deploy Ombra
or self-hosted inference.

## 2. Core Law

Agents are product workers. Models are replaceable execution dependencies.
Clickeen is AI-native because agents operate its structured product substrate
through named authorities; it is not AI-native merely because a hosted or
self-hosted model can be called from an existing SaaS workflow.

The three roles are separate:

```text
Agent home
  owns domain reasoning, instructions, context, tools, and loop

San Francisco
  owns grants, model policy, provider credentials, budgets, exact route
  execution, usage, and explicit errors

AI SDK
  is a replaceable TypeScript library bundled inside San Francisco for provider
  calls, streams, native tools/results, finish reasons, and usage
```

The AI SDK is not Vercel hosting and does not create a network dependency on
Vercel. It must not become Clickeen policy, an agent brain, a tool authority, or
a model registry.

Agent homes contain no provider credentials or provider-specific request code.
San Francisco executes the exact provider/model allowed by signed policy or
fails explicitly. It never silently substitutes another route.

## 3. Current State

Clickeen currently has exactly two runtime agents:

- Product Copilot;
- Translation Agent.

Current governed model providers are OpenAI and DeepSeek. San Francisco uses
handwritten provider adapters today. PRD 128 replaces those adapters with an AI
SDK-backed model-turn boundary and moves both current agents onto it.

Product Copilot's current one-shot JSON protocol is not part of the future
Ombra contract. A future model receives messages and typed tool definitions and
returns normal text or native tool calls.

## 4. Why This Boundary Supports Self-Hosted Ombra

The future path is:

```text
Product Copilot or Translation Agent
-> San Francisco governed model turn
-> explicit Ombra provider/model selection
-> AI SDK-compatible provider adapter
-> Clickeen-controlled inference endpoint
```

Moving one task class to Ombra should require:

- an explicit San Francisco provider adapter or compatible provider factory;
- a Clickeen-controlled inference endpoint or service binding;
- provider/model identity in the existing model capability and policy
  authorities;
- required credentials or binding configuration;
- capability truth such as text, structured output, streaming, and tool-call
  support;
- timeout, token, usage, finish-reason, and error mapping;
- agent-specific evaluations;
- exact-SHA deployment and runtime verification.

It must not require rewriting Product Copilot, Translation Agent, Bob, Roma, or
their product tools.

Provider onboarding is therefore not merely "config + eval." The agent-facing
contract stays stable, but every execution dependency still requires an
explicit adapter, capability, policy, operations, and verification decision.

## 5. Capability Truth

Models are not interchangeable simply because they speak an OpenAI-compatible
HTTP shape. Before a model can serve an agent, its declared and evaluated
capabilities must match that agent's needs.

Examples:

- Product Copilot requires reliable tool calling for its Builder tools and may
  require streaming for its user experience.
- Translation Agent requires exact structured translated values and protected
  rich-text fidelity.

If the exact selected model cannot perform the required capability, execution
fails visibly. San Francisco does not switch providers or degrade the operation
while claiming success.

## 6. Model Progression

Progression is by task class and evidence, not by calendar or universal route.

### Phase 1 — Governed hosted providers

- OpenAI and DeepSeek remain the two current providers.
- PRD 128 establishes the shared AI SDK-backed execution seam.
- Goal: prove the real-agent product and obtain reliable task-specific evals.

### Phase 2 — Self-hosted inference

- Connect one Clickeen-controlled open-weight model for one proven task class.
- Compare quality, latency, throughput, availability, and cost with the hosted
  baseline.
- Do not build a broad provider marketplace or self-hosting control plane.

### Phase 3 — Clickeen fine-tuning

- Fine-tune a suitable open-weight base only after a lawful, useful,
  representative training dataset exists.
- Evaluate against the real task class before routing production work.

### Phase 4 — Clickeen-trained intelligence

- At sufficient scale, use Clickeen's structured product and outcome knowledge
  to train models that outperform generic providers on bounded Clickeen tasks.
- Continue using external frontier models where they remain better.

No phase automatically replaces every prior provider.

## 7. Strategic Data Flywheel

Clickeen's structured substrate can eventually create differentiated model
knowledge:

```text
structured product artifacts
+ explicit agent tool operations and results
+ lawful human outcome signals
+ future privacy-approved aggregate performance truth
-> task-specific training data
-> models better at Clickeen operations
```

The strategic opportunity is real, but the training dataset does not exist
merely because an agent executed a tool. Grant accounting, model usage, and
runtime traces are not automatically training consent or training truth.

## 8. Training And Privacy Gates

PRD 128 does not build training capture.

Before any customer content, user correction, or visitor behavior is stored for
training, a separate approved PRD must define:

- the exact signal and why it is useful;
- content source authority;
- customer terms and consent/opt-out;
- PII handling;
- aggregation and minimization;
- storage owner and coordinate;
- retention and deletion;
- access control;
- dataset versioning;
- training/evaluation separation.

Visitor data is never captured for model training merely because a public
Widget is served. Public Widget runtime never calls models.

## 9. Cost And Operations

Self-hosted inference is not automatically cheaper or more private. Each task
class needs an explicit comparison covering:

- model quality;
- GPU/inference cost;
- utilization and capacity headroom;
- latency and concurrency;
- deployment, monitoring, and incident ownership;
- data location and provider terms;
- upgrade and rollback path.

Free tiers are temporary commercial properties, not architecture. Pricing,
limits, residency, and terms must be freshly verified before use.

## 10. Product Copilot Alignment

PRD 128 rebuilds Product Copilot around native model tools:

```text
model requests typed Builder tool
-> Bob executes against browser-memory draft
-> exact result returns as observation
-> model continues or completes
```

That contract is the Ombra-ready boundary. An Ombra model capable of the same
messages and tool semantics can later replace a hosted model without changing
Bob tools or Roma Save authority.

Rendered visual context is a separate Product Copilot capability. A native
browser CLI cannot be assumed to run in a Cloudflare Worker. No browser-vision
runtime is authorized by this model-strategy PRD.

## 11. Routing And Provider Onboarding

Routing remains explicit, policy-driven, and agent/task-specific.

To enable a provider/model route:

1. Define the exact provider adapter in San Francisco.
2. Define model identity and capabilities in the current contract authority.
3. Configure its credential or binding through the existing deploy authority.
4. Add it to the explicit signed runtime policy for the applicable agent/tier.
5. Map usage, finish, timeout, and provider errors without invented values.
6. Pass the owning agent's evaluations.
7. Deploy and verify the exact route live.

There is no runtime provider discovery, provider marketplace, or fallback
chain. Evals gate whether a known route is suitable; they do not replace the
explicit provider contract.

## 12. PRD 128 Boundary

PRD 128 is authorized to:

- install the AI SDK inside San Francisco;
- hard-cut OpenAI and DeepSeek execution to that seam;
- support model messages, streaming, native tools and tool results;
- rebuild Product Copilot as a real text/tool/observation agent;
- move Translation Agent onto the same governed execution foundation;
- prove that future Ombra insertion would not rewrite agent or product logic.

PRD 128 is not authorized to:

- deploy an Ombra model or inference service;
- add new providers beyond OpenAI and DeepSeek;
- add visual browser infrastructure;
- capture training data;
- create a model/provider registry or marketplace;
- create agent-to-agent infrastructure;
- change public Widget runtime.

## 13. Acceptance Criteria For Future Ombra Execution

Before self-hosted Ombra handles production work:

- one concrete task class proves the need;
- the selected model passes that agent's real evals;
- the model supports the required message/tool/structured-output capabilities;
- San Francisco is the only provider execution boundary;
- no agent home or product surface contains provider-specific code;
- exact provider/model unavailability fails visibly;
- operations, cost, privacy, capacity, and rollback are explicit;
- no customer or visitor data is used for training without the separate privacy
  and dataset authority.

The strategic end state is owned intelligence without sacrificing Clickeen's
named authorities or making agents dependent on one provider or one SDK.
