# AI Planning

STATUS: PLANNING — NOT CURRENT RUNTIME TRUTH

This folder holds Clickeen's future AI strategy, research, and planned agents.
Current runtime truth lives in `documentation/ai/`.

## Operating Context

Clickeen is pre-GA and AI-native: it is built by AI under one human product
owner/architect and structured for agents to operate from first principles. It
is not a conventional SaaS product whose human-only workflows later receive an
AI chat or automation layer. Future AI work therefore uses clean contract cuts.
It must not preserve an obsolete agent protocol through aliases, dual
execution, compatibility layers, feature flags, or fallback paths merely
because that protocol exists today.

Clickeen currently has exactly two runtime agents:

- Product Copilot;
- Translation Agent.

Translation Agent performs its bounded saved-instance localization job well and
must not regress. Product Copilot is structurally connected to Bob, Roma, and
San Francisco, but its current one-shot behavior and product quality are not the
target architecture and are not a quality baseline to preserve.

## What Makes A Real Clickeen Agent

A real agent is a named product worker with:

- an agent home that owns its instructions, reasoning, context, tools, and loop;
- an invoking product or workflow surface;
- typed product capabilities executed by the authority that owns the truth;
- observations returned from those executions;
- explicit completion and failure behavior;
- governed model execution through San Francisco.

An agent is not merely a chat surface, recommendation generator, or model call
inside a hardcoded workflow. It owns a concrete operational job and can act on
the structured product substrate through the authority that owns the truth.

The common operating cycle is:

```text
agent context and messages
-> governed model turn
-> normal text or typed tool call
-> owning product authority executes the tool
-> exact result returns as an observation
-> next model turn or explicit completion
```

Structured artifacts remain fundamental. Tool inputs, tool results, grants,
Widget operations, translation values, and saved artifacts are structured.
That does not mean an entire agent turn should be encoded as one custom JSON
answer. Conversation remains model conversation; actions cross exact typed tool
boundaries.

## Three Separate Authorities

```text
Agent home
  owns reasoning, instructions, context, tools, and loop

San Francisco
  owns grants, model policy, provider credentials, budgets, and governed model
  execution

Vercel AI SDK
  is a bundled TypeScript library used inside San Francisco for provider calls,
  streaming, native tool calls/results, finish reasons, and usage
```

The AI SDK is not Vercel hosting, a new service, a product authority, or the
agent brain. Clickeen must remain able to replace that internal library without
changing agent or product contracts.

## Current Execution Program

The real-agent runtime foundation and the rebuild of the two current agents are
owned by:

```text
Execution_Pipeline_Docs/02-Executing/
  128__Clickeen_Agent_Runtime_Foundation/
```

PRD 128 is the pre-GA hard cut from the current one-shot/custom-response model
to governed model turns, native tools, observable tool results, and explicit
completion. It does not deploy a self-hosted model, build browser vision, or
capture training data.

PRD 128 uses product truth that already exists. Tier-specific model, token,
timeout, and thread limits remain in the current AI runtime policy exposed in
DevStudio. Product usefulness remains the human product owner's judgment in
the live product. Engineering tests prove exact tool behavior, state changes,
failure truth, and regression safety; they do not replace that judgment with a
new approval ceremony or scoring authority.

## Folder Contents

### Model strategy

- `planning_PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`
  - model-provider independence;
  - the future self-hosted Ombra insertion boundary;
  - model ownership and future fine-tuning strategy;
  - privacy and evidence gates before training-data use.

### Product Copilot direction

- `planning_PRD__Product_Copilot_Rebuild.md`
  - why the current one-shot custom JSON protocol is not a real agent loop;
  - Product Copilot's target text/tool/observation interaction;
  - Bob browser-memory tool execution and Roma Save authority;
  - future capabilities that remain outside PRD 128.

### Research

- `Research/LLM_Provider_Landscape_June2026.md` — historical June 2026
  provider research; pricing and availability require fresh verification before
  any provider decision.
- `Research/Context_Compaction_Service_Plan_June2026.md` — speculative plan;
  it is not authorization to add compaction machinery.
- `Research/Headroom_Context_Compression_Eval_June2026.md` — historical
  evaluation; measure a concrete current need before acting.

### Agent Pipeline

- `Agent_Pipeline/` contains future agent proposals. Nothing there is a runtime
  agent or authority until an execution PRD builds it.

## Explicitly Not Implied By PRD 128

- no browser-vision or `agent-browser` integration;
- no training-data capture or visitor-data collection;
- no self-hosted Ombra runtime;
- no fine-tuning pipeline;
- no agent-to-agent or multi-agent framework;
- no generic tool marketplace or universal agent personality;
- no new conversation database, queue, Durable Object, or WebSocket authority;
- no server-side active-turn record or transactional Copilot coordinator;
- no extra runtime agents.

Those require separate evidence and explicit product-owner authorization.
