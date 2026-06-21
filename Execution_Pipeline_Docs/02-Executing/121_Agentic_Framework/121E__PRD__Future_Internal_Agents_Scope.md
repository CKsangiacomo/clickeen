# 121E PRD - Future Internal Agents Scope

Status: EXECUTING
Owner: Product + Architecture
Priority: P1
Date: 2026-06-20
Type: Sub-PRD / future-scope guardrail
Pre-execution amendment state: settled as guardrail after peer-review convergence.

Execution status note: this PRD is a guardrail, not a build commitment. It
creates no implementation tickets by itself. Future internal agents require
their own Product Owner-approved execution PRD.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `121D__PRD__Translation_Agent.md`

---

## 1. Purpose

This PRD exists to prevent the first architecture from blocking future internal
agents.

It is not a build-now list.

It is not a generic workforce platform.

It does not commit Clickeen to a set of named internal agents.

121D Translation Agent is the first proof-of-pattern: a focused internal worker
can be structured-output, single-purpose, non-conversational, in its own agent
home, with explicit grant, validation, trace, and product-owned apply.

## 2. Future Internal Agent Pattern

Future internal agents are focused workers.

Each future internal agent must have:

- owner;
- trigger;
- subject;
- input contract;
- output contract;
- allowed tools;
- review/apply boundary;
- cost/runtime policy;
- trace path;
- relationship to Product Copilot if any.
- why existing agents/workflows cannot own the job.

Many internal workers will be structured-output workflows, not agent loops.
They should not import Product Copilot loop machinery unless the Product Owner
decides the workflow needs it.

## 3. What This PRD Protects

The architecture must not assume:

- every agent is conversational;
- every agent is Product Copilot;
- every agent has a user-facing chat UI;
- every agent edits widgets;
- every agent can act immediately;
- every agent shares one memory/context shape.

This PRD also does not imply:

- internal-agent registry UI;
- workforce dashboard;
- agent catalog;
- generic memory layer;
- marketplace;
- generic lifecycle/workflow platform;
- agent-to-agent mesh;
- placeholder ids or stubs for unproven agents.

## 4. Relationship To Product Copilot

Product Copilot may eventually call, summarize, or expose work from internal
agents.

That is not automatic.

It requires explicit permission, context handoff, result contract, and user
presentation rules.

## 5. Relationship To San Francisco

San Francisco should eventually orchestrate internal agents through the same
execution rails.

For this PRD, shared rails means only:

- invocation conventions;
- model routing/policy conventions;
- version metadata;
- trace conventions.

Shared rails does not mean shared memory, shared product logic, shared domain
context, shared tools, or shared review/apply systems.

But internal agents keep their own domain contracts.

## 6. Acceptance Criteria

- This PRD creates future-scope guardrails, not implementation commitments.
- This PRD creates no implementation tickets by itself.
- Architecture PRDs leave room for focused non-conversational agents.
- 121D Translation Agent is cited as the first proof that non-Copilot internal
  workers may be structured-output workflows rather than agent loops.
- Future internal-agent PRDs must pass the admission gate, including why an
  existing agent/workflow cannot own the job.
- Product Copilot is not treated as the template for all agents.
- San Francisco orchestration can support future internal agents without making
  them product-truth owners.
- No internal-agent registry UI, workforce dashboard, catalog, generic memory,
  marketplace, workflow platform, mesh, or placeholder stubs are implied.
