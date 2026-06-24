# Planning PRD - Future Internal Agents Scope

Status: PLANNED - NOT BUILT
Owner: Product + Architecture
Priority: P1
Date: 2026-06-20
Type: Planning PRD / future-scope guardrail

Planning status note: this PRD is a guardrail, not a build commitment. It
creates no implementation tickets by itself. Future internal agents require
their own Product Owner-approved execution PRD.

Origin: extracted from the 121 series after the 121-through-121D execution
closure. It remains visible planning, not active execution.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121D__PRD__Translation_Agent.md`
- `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121PRD_Umbrella_to_121D_completeness.md`
- `Execution_Pipeline_Docs/01-Planning/AI_Planned_Agents/seo-geo-aeo.md`

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

The SEO/GEO/AEO Agent belongs in this future-internal-agent scope. It is not
part of 121D execution. Translation Agent generates the locale overlays;
clk.live widget runtime / Pages later serve those overlays as crawlable locale
surfaces; the SEO/GEO/AEO Agent is the future async worker that measures and
improves those surfaces.

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

## 6. Future SEO/GEO/AEO Agent

The SEO/GEO/AEO Agent is a future focused internal agent in the closed
translation-overlay growth loop:

```text
Translation Agent generates overlays
-> clk.live widget runtime / Pages serve crawlable locale surfaces
-> SEO/GEO/AEO Agent measures and improves performance
-> improvements feed back into future Translation Agent overlay generation
```

Definitions:

- SEO: search-engine discoverability and ranking in each locale.
- GEO: geographic/local-market intent inside a language or region.
- AEO: answer-engine optimization for AI answer engines and search answer
  experiences.

Why it belongs in future internal-agent planning:

- it is an internal worker, not a user-facing copilot;
- it is cron/scheduled/server-side work, never visitor-path work;
- it measures published surfaces and proposes improvements;
- it depends on 121D output quality and future clk.live / Pages crawlable
  serving;
- it has its own trigger, subject, input contract, output contract, review/apply
  boundary, and trace path;
- it improves Translation Agent work but does not replace Translation Agent.

The future agent's likely responsibilities:

- track locale-page ranking and indexing status by market;
- identify weak titles, headings, labels, snippets, FAQ answers, and thin fields;
- detect local-market phrasing gaps, including regional differences inside a
  language;
- detect answer-engine citation opportunities and answerability gaps;
- propose overlay improvements or Translation Agent guidance updates;
- feed measured improvements into Translation Agent evals, prompts, and future
  generation policy;
- produce traceable recommendations that can be reviewed, evaluated, and applied
  through product-owned routes.

Hard boundaries:

- no live visitor or crawler request may trigger the SEO/GEO/AEO Agent;
- no silent mutation of live overlays;
- no direct product-state writes outside product-owned review/apply routes;
- no broad agent mesh or generic tool platform implied by this future agent;
- no claim that 121D is incomplete merely because this future agent is not built.

Admission gate for a future execution PRD:

- name the published surface authority: clk.live runtime, Pages, or both;
- name the metrics/source authorities for ranking, indexing, answer visibility,
  and crawler evidence;
- define how recommendations flow back into Translation Agent without bypassing
  eval/review/apply;
- define failure behavior when external search/answer data is unavailable;
- prove that normal product serving stays off the AI request path;
- prove that customer-visible content is not silently rewritten by a cron job.

## 7. Acceptance Criteria

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
- The SEO/GEO/AEO Agent is admitted as a future internal agent shape: cron,
  async, measured, governed, and outside the visitor path.
- The SEO/GEO/AEO Agent is not a blocker for 121D Translation Agent execution.
- No internal-agent registry UI, workforce dashboard, catalog, generic memory,
  marketplace, workflow platform, mesh, or placeholder stubs are implied.
