# SDR Copilot

STATUS: PLANNED - NOT BUILT

SDR Copilot is future agent scope. This planned-agent doc absorbs the former
future-scope guardrail. It creates no SDR implementation tickets by itself; SDR
Copilot requires its own Product Owner-approved execution PRD before build work
begins.

It is not Product Copilot and it is not a current runtime authority. It will
need its own agent home, data boundary, model policy, output contract, and evals
before it can move into built agents.

Future SDR work must stay separate from Builder Product Copilot because sales
prospecting data, account content, and customer Builder draft data are different
authorities.

## Purpose

This planned agent exists so the architecture does not accidentally hardcode
"agent" to mean Product Copilot.

SDR Copilot is a future separate user-facing agent.

It is not Product Copilot's cousin.

It is not a reused Product Copilot implementation.

Separate means separate brain, prompt/instructions, context capsule, tools,
permissions, success metrics, safety model, runtime identity, grant path, trace
namespace, eval suite, failure rules, and future execution PRD.

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

## Separation From Product Copilot

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

## What May Be Shared

Only infrastructure may be shared when proven:

- company-operated model execution infrastructure through a separate SDR runtime
  identity;
- provider/model adapter code only when it carries no Product Copilot product
  assumptions;
- generic cost/error primitives only with separate SDR trace namespace and
  policy;
- naming conventions only when they do not imply shared behavior.

That is not a shared Copilot framework.

Public/prospect traffic is untrusted by default. It must not become a path into
Product Copilot context, Product Copilot tools, account-owned product state, or
authenticated product permissions.

## Architecture Guardrail

The Product Copilot implementation must not:

- bake Bob/Roma assumptions into the general agent architecture;
- make "context" mean Builder context everywhere;
- make "tool" mean widget edit everywhere;
- make "success" mean save/publish everywhere;
- require SDR Copilot to inherit Product Copilot prompts or action contracts.

## Future SDR PRD Scope

A future SDR Copilot execution PRD should define:

- its surface;
- its user/prospect context;
- allowed sales/growth tools;
- conversation goals;
- data boundaries;
- refusal/safety rules;
- success metrics;
- runtime/model policy.

Do not build this in Product Copilot work.

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

## Acceptance Criteria

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
