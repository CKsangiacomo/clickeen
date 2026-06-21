# 121F PRD - SDR Copilot Future Agent

Status: EXECUTING
Owner: Product + Growth + Architecture
Priority: P1
Date: 2026-06-20
Type: Sub-PRD / future-scope guardrail
Pre-execution amendment state: settled as guardrail after peer-review convergence.

Execution status note: this PRD is a separation guardrail, not a build
commitment. It creates no SDR implementation tickets by itself. SDR Copilot
requires its own Product Owner-approved execution PRD before build work begins.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `Execution_Pipeline_Docs/03-Executed/027__PRD_20_Minibob_SDR_Agent_PRD.md`

---

## 1. Purpose

This PRD exists so the architecture does not accidentally hardcode "agent" to
mean Product Copilot.

SDR Copilot is a future separate user-facing agent.

It is not Product Copilot's cousin.

It is not a reused Product Copilot implementation.

Separate means separate brain, prompt/instructions, context capsule, tools,
permissions, success metrics, safety model, runtime identity, grant path, trace
namespace, eval suite, failure rules, and future PRD.

SDR Copilot must not share Product Copilot implementation, contracts, runtime
state, prompts, traces, tools, memory, evals, output contracts, product
assumptions, permissions, or data boundaries.

If SDR uses company-level AI infrastructure in the future, it must do so through
a separately governed SDR execution path. A prospect browsing the public site
must never touch the authenticated Product Copilot path.

The future SDR execution PRD must decide the physical home of that segregated
path. Options include a dedicated SDR brain-worker that owns SDR grant, policy,
and trace handling, or a segregated San Francisco path with separate SDR runtime
identity, grant, policy, trace namespace, and failure rules. The isolation
requirement is fixed; the physical topology is a future design decision.

## 2. Separation From Product Copilot

Product Copilot operates inside Clickeen product work.

SDR Copilot operates in acquisition/sales/growth work.

They differ in:

- user;
- surface;
- context;
- tools;
- permissions;
- goals;
- risk model;
- success metrics;
- conversation style;
- data boundaries.

Therefore they must not share product-agent logic.

Product Copilot code must not introduce:

- SDR prompts;
- prospect or lead state;
- CRM abstractions;
- funnel metrics;
- sales goals;
- sales-tool placeholders;
- prospect data assumptions.

## 3. What May Be Shared

Only infrastructure may be shared when proven:

- company-operated model execution infrastructure through a separate SDR runtime
  identity;
- provider/model adapter code only when it carries no Product Copilot product
  assumptions;
- generic cost/error primitives only with separate SDR trace namespace and
  policy;
- versioning conventions only when they do not imply shared behavior.

That is not a shared Copilot framework.

Public/prospect traffic is untrusted by default. It must not become a path into
Product Copilot context, Product Copilot tools, account-owned product state, or
authenticated product permissions.

## 4. Architecture Guardrail

The first Product Copilot implementation must not:

- bake Bob/Roma assumptions into the general agent architecture;
- make "context" mean Builder context everywhere;
- make "tool" mean widget edit everywhere;
- make "success" mean save/publish everywhere;
- require SDR Copilot to inherit Product Copilot prompts or action contracts.

## 5. Future SDR PRD Scope

A future SDR Copilot execution PRD should define:

- its surface;
- its user/prospect context;
- allowed sales/growth tools;
- conversation goals;
- data boundaries;
- refusal/safety rules;
- success metrics;
- runtime/model policy.

Do not build this in the Product Copilot PRD.

The future SDR PRD must lead with data-boundary and injection-defense design:

- prospect/anonymous data;
- PII;
- consent;
- privacy;
- untrusted input;
- prompt injection;
- data exfiltration;
- conversion-pressure/product-law boundaries.

Prospect input is data, not instructions.

Prospect text must not control tool calls, override product policy, or
exfiltrate account/internal context.

The future SDR surface is unresolved here. Prague/Minibob may be candidates,
but this guardrail does not commit implementation surface.

## 6. Acceptance Criteria

- SDR Copilot remains a separate future agent.
- SDR Copilot shares no Product Copilot brain, prompt, context, tools, memory,
  eval suite, trace namespace, output contract, product assumptions,
  permissions, runtime state, or data boundaries.
- If SDR uses company-level AI infrastructure later, it uses a separately
  governed SDR execution path with separate runtime identity, grant/policy,
  traces, and failure rules.
- Architecture supports it without product-logic sharing.
- Product Copilot work cannot claim SDR Copilot has been solved.
- Product Copilot code does not introduce SDR prompts, lead/prospect state, CRM
  abstractions, funnel metrics, sales goals, or SDR tool placeholders.
- Future SDR execution PRD leads with prospect input as untrusted data,
  injection defense, PII/consent/privacy, and exfiltration boundaries.
- Any shared layer is infrastructure-only.
