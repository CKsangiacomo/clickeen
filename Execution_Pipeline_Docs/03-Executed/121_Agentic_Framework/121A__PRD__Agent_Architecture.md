# 121A PRD - Agent Architecture

Status: EXECUTED
Owner: Product + Architecture
Priority: P0
Date: 2026-06-20
Executed: 2026-06-23
Type: Sub-PRD / architecture
Execution state: closed by 121-through-121D runtime completeness.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`

---

## 1. Purpose

This PRD defines the architecture rails for real Clickeen agents.

Clickeen serves content. Content has source authority:

- human-generated content remains under human intent;
- AI-generated content can be operated by agents under approved product rules;
- integration-sourced content is used by agents but not rewritten unless an
  explicit authorized integration write path exists.

Agents also operate the structured Clickeen system around that content:
widgets, pages, reports, analytics, support tickets, locale overlays, runtime
packages, account assets, routes, and storage folders.

It does not define Product Copilot behavior.

It does not define SDR Copilot behavior.

It does not define Translation Agent behavior.

Those are separate agents with separate PRDs.

This PRD defines the common execution architecture that lets different agents
exist without forcing them into a fake shared product framework.

This PRD is not authorization to build a universal agent framework.

This PRD defines the minimum contract shape that every real Clickeen agent must
expose. On day one, most fields may be simple fields, pointers, documented
defaults, or small local manifests. They are not separate subsystems unless a
real agent proves they need to become one.

## 2. Core Correction

An agent is not a regex router.

An agent is not a model call.

An agent is not a grant.

An agent is not a validator.

An agent is a named Clickeen worker that operates a structured product artifact
through named authorities.

Each real agent has:

- a product/workflow purpose;
- an owner;
- an agent home where the brain code lives;
- an invocation boundary;
- a loop owner;
- a context contract;
- an allowed product capability surface;
- a reasoning step;
- an output contract;
- validation boundaries;
- runtime policy;
- trace and outcome records;
- versioning.

The architecture must support very different agents:

- Product Copilot: broad user-facing product agent in Bob/Roma.
- Translation Agent: focused internal artifact agent.
- SDR Copilot: separate future sales/acquisition agent.
- Future internal agents: focused workers with explicit scope.

These agents do not share product logic. They may share only execution
infrastructure where the commonality is real and boring.

Shared architecture is extracted only when a real agent or workflow needs it.
It is broadened only when a second real agent proves the same need is actually
common.

## 3. Non-Goals

- Do not build a universal agent personality.
- Do not build a shared Copilot framework.
- Do not route raw user text with hardcoded regex.
- Do not make Product Copilot and SDR Copilot share context, tools,
  permissions, success metrics, or conversation behavior.
- Do not treat grants, model routing, metering, or validation as intelligence.
- Do not move product truth into San Francisco.
- Do not scatter agent brain logic across Bob components, Roma routes, Tokyo
  storage code, or generic San Francisco infrastructure.
- Do not preserve old fake-agent contract shapes through compatibility shims
  when the executing slice can replace them in place.

## 4. Minimum Real-Agent Contract

Every real Clickeen agent exposes this contract shape:

```text
canonical agent id
agent home
owner / invoking product or workflow surface
loop owner
invocation envelope
context capsule reference, version, and source coordinate
instructions/profile reference
allowed product capability manifest
model-policy reference
structured output schema
validation boundary
trace/eval record
explicit failure behavior
```

This is a contract shape, not a build-13-systems mandate.

Day-one examples:

- `loop owner` can declare a single-pass default with bounded retry only when
  explicitly allowed.
- `model-policy reference` can point at existing San Francisco grant/policy.
- `instructions/profile reference` can be one versioned prompt/instruction file.
- `allowed product capability manifest` can be a local product-surface manifest,
  not a central registry.
- `trace/eval record` can start as one minimal trace shape consumed by the first
  Product Copilot eval harness.

The agent-specific PRDs define:

```text
purpose
user or workflow
domain context
allowed actions
success metrics
UX or review surface
risk model
```

### 4.1 Agent Home

`agent home` is required and is distinct from `owner / invoking surface`.

`owner / invoking surface` answers who calls the agent.

`agent home` answers where the brain code lives.

`loop owner` answers where the reasoning/observation loop runs for that agent.

Examples:

```text
Product Copilot
  invoking surface: Bob/Roma Builder flow
  agent home: isolated Product Copilot Cloudflare worker/module
  loop owner: Bob for live draft iteration; agent home for reasoning contract

Translation Agent
  invoking surface: Roma/background translation workflow
  agent home: isolated Translation Agent Cloudflare worker/module
  loop owner: Translation Agent home, because its task is server-side
```

The agent home rule prevents fake compliance where the contract exists on paper
but brain logic is smeared across product files.

### 4.2 Deferred Shared Rails

These are valid future capabilities, but they are not day-one shared
architecture unless the Product Owner decides otherwise:

- child-agent invocation boundary;
- multi-agent handoff machinery;
- shared product capability manifests;
- generic outcome subsystem;
- self-hosted/hybrid model taxonomy as implementation;
- compatibility shims for old fake-agent contracts.

They may appear in future PRDs or later slices when a real product/workflow need
proves them necessary.

## 5. Invocation

An agent is invoked by a product/workflow surface that already knows why that
agent is relevant.

Examples:

- Bob invokes Product Copilot because the user is in Builder Copilot.
- Roma or a background workflow invokes Translation Agent because a translation
  job is requested for a product artifact.
- A future Prague/SDR surface invokes SDR Copilot because the user is in a sales
  or acquisition workflow.

Raw user text does not choose the global agent.

The product surface chooses the agent. The agent then reasons over the turn or
task inside its own world.

The invocation boundary must name every authority involved.

For Product Copilot, invocation crosses the Bob UI/editor surface and Roma
account/grant/route authority. Bob alone is not the full invocation boundary.

For server-side agents, the invoking workflow must name the account/product
route that requested the work and the durable artifact being acted on.

## 6. Context

Context is not generic.

Each agent owns a context contract.

The architecture must allow context to be:

- product-surface-provided;
- bounded;
- typed enough to be useful;
- explicit about unavailable or forbidden information;
- versioned;
- auditable.

Product Copilot context is not SDR context.

Translation Agent context is not Product Copilot context.

Context should be thin orientation first, not a fat dump.

Each agent context contract must state:

- what the agent is operating on;
- what information is available;
- what information is unavailable or forbidden;
- context version;
- context version/source coordinate;
- whether product-owned context fetch tools are available;
- visible failure behavior for missing, stale, malformed, or forbidden context.

## 7. Product Capabilities And Actions

Product capabilities are explicit operations exposed to an agent by an owning
product surface.

Product capabilities are not discovered by regex.

Product capabilities must declare:

- name;
- purpose;
- input schema;
- output schema;
- owning product/service boundary;
- validation behavior;
- side-effect level;
- review requirement;
- error contract.

The agent can reason about product capabilities. Product-owned surfaces execute
their own side effects.

Capability manifests begin as product-surface manifests. A central registry is
not required for the first real agent.

Capability responses must be designed for the model as well as the machine:
concise, high-signal, and explicit enough for the agent to recover from expected
errors without silently substituting or claiming success.

## 8. Models

Models are execution dependencies below the agent contract.

The architecture must support:

- hosted frontier models;
- cheaper hosted models;
- Clickeen-hosted/self-hosted models;
- hybrid routing;
- explicit unavailable-model failure;
- specialized classifier/judge/summarizer models.

No agent may hardcode one provider as product architecture.

Current registry/policy wiring is seed evidence, not a compatibility contract.

Known current ids include:

- `product.copilot`;
- `widget.instance.translator`.

If current ids, names, or output shapes encode the old fake-agent worldview,
the executing slice may replace them in place instead of creating dual old/new
contracts.

## 9. Trace And Versioning

Every agent execution must be traceable by:

- agent id;
- agent version;
- invoking surface;
- context version;
- tool/capability versions;
- model/provider route;
- cost/usage;
- validation result;
- final output type;
- user/workflow outcome when known.

Trace exists for observability, debugging, evals, cost, and future learning.

Trace does not become product truth.

Trace and eval are part of the same architecture rail.

The first real Product Copilot slice must produce trace records that can feed
the first eval harness. The planning PRD for agent learning and outcomes may
later broaden shared learning and outcomes infrastructure, but 121C must not
create a second incompatible capture path.

Failure behavior must be trace-visible. Missing context, stale context,
unavailable product capabilities, unavailable providers, malformed model output,
and product validation failure must fail visibly. They must not be silently
repaired, substituted, or reported as success.

## 9.1 Loop Semantics

Every agent must declare loop semantics.

The declaration must cover:

- iteration model;
- observation/tool-result handling;
- stop condition;
- max-step ceiling;
- token/cost budget;
- behavior at step or budget ceiling.

For simple agents, the loop may be a documented single-pass default.

For Product Copilot, the live draft loop is owned by Bob because Bob owns
browser-memory draft state, undo, and validation. The Product Copilot brain home
owns the reasoning contract and returns typed answers/actions for Bob to
validate and apply in memory.

For server-side agents, the loop may run in the agent home when the tools and
artifacts are server-side and product-owned.

## 10. Acceptance Criteria

- The architecture distinguishes agent identity from model provider.
- The architecture distinguishes agent behavior from shared execution
  infrastructure.
- Every real agent declares an agent home, invoking surface, and loop owner.
- Agent home is distinct from owner/invoking surface.
- The real-agent contract is a shape of fields/pointers/defaults before it is a
  set of subsystems.
- Raw user text is not globally regex-routed before agent reasoning.
- Product Copilot, SDR Copilot, Translation Agent, and future internal agents
  can have separate PRDs without sharing product logic.
- Product-state changes remain owned and validated by product surfaces.
- San Francisco can execute AI model/policy/provider infrastructure without
  owning product truth.
- Missing, stale, malformed, or forbidden context fails visibly.
- Tool/provider/model/output/validation failures are trace-visible and do not
  become success claims.
- Product Copilot ratifies this architecture by using the minimum contract in
  the first real-agent implementation.
