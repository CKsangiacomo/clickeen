# Planning PRD - Workforce Agents Architecture Scaffolding

Status: PLANNING
Owner: Product + Architecture (San Francisco)
Priority: P2 / Deferred until 120B is green
Date: 2026-06-08
Stage: 01-Planning
Type: Sub-PRD from PRD 120
Blocked-by: PRD 120B, PRD 120A-2, and design-level decisions on 120 OQ6/OQ7
(outbound layer shape; external credential custody) recorded before this PRD enters
execution review.

Blocker meanings:

- 120B = Builder Copilot control-operator proof.
- 120A-2 = durable/service plane contract.

Execution amendment applied on 2026-06-18:

- 120C remains deferred and must not execute during the Builder Copilot Operator proof.
- The prior translation-queue premise is false for the current product.
  Do not add a queue, Tokyo-worker orchestration role, or workforce-agent scaffold to
  satisfy this planning text.
- When 120C is reopened, it must start from current runtime truth: Roma owns account/user
  product orchestration, Tokyo/Tokyo-worker are storage/R2, and San Francisco owns AI
  execution only.

Parent:

- `Execution_Pipeline_Docs/03-Executed/120/120__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`

Related:

- `documentation/ai/README.md`
- `documentation/ai/sanfrancisco.md`
- `documentation/ai/agents/Planned_Agents/gtm.md`
- `documentation/ai/agents/Planned_Agents/ux-writer.md`
- `agents/translation-agent/`
- `tokyo-worker/src/domains/account-translations/operations.ts`
- `packages/ck-contracts/src/ai.ts`

---

## 0. Purpose

This PRD defines the architecture scaffolding for Clickeen Workforce Agents and proves it
with one real reference agent.

It does not build the whole AI workforce. It prepares the pattern so future agents can
operate safely without each one inventing its own AI runtime, and it prevents platform
theory by requiring one low-risk reference agent to run through the scaffold.

Copilot-first correction: this PRD is intentionally deferred until Builder Copilot proves
the shipped AI system can operate the product editor. Workforce agents are strategically
important, but they are not the first proof. If 120B cannot make Copilot understand
visible Builder controls and change a button from blue to green in preview, 120C must not
consume execution focus.

Workforce agents are different from user Copilots. They are company-operating agents:
localization, GTM, UX writing, support, moderation, ops, and future internal roles.

---

## 1. Product Truth

Workforce agents are **Clickeen operators**, not interactive product widgets.

They may be:

- service-scoped
- account-scoped where required
- queue-driven
- cron-triggered
- durable
- multi-phase
- tool-using
- long-running
- autonomous with human review

They must still route all AI execution through San Francisco's shared plane.

---

## 2. Architecture Direction

The architecture follows PRD 120 Option C:

**San Francisco is the singular AI control/execution plane. Durable agents may have
isolated governed orchestrators, but all model calls, policy, grants, budgets, telemetry,
and learning route through San Francisco.**

This means:

- provider keys stay only in San Francisco
- durable agents do not call model providers directly
- durable agents do not mint their own grants
- durable agents do not implement separate budget logic
- durable agents do not invent separate telemetry/learning loops
- durable agents do not write product truth directly

Orchestration can be per-agent. The AI plane is not.

This direction remains correct, but it was not the immediate execution priority. 120C
execution was gated by:

- 120A1 has hardened model capability, picker eligibility, and typed provider errors.
- 120B has passed its Builder Copilot earth-test scenarios across shipped widgets.
- 120A-2 has defined the durable/service execution contract that 120C will consume.

---

## 3. Workforce Agent Classes

### 3.1 Already shipped or partially shipped

- Widget Instance Translator

This proves that system-agent work already exists, but the pattern is not yet formalized
as a reusable workforce-agent scaffold.

### 3.2 Future durable/service agents

- UX Writer
- GTM Agent
- Community Moderation
- Support workflows where async review is needed
- Ops monitoring/reporting agents

### 3.3 Future interactive/service agents

- Support Reply may be interactive but still workforce-owned.

Interactive support is not Builder Copilot. It should still use the SF plane and a
support-specific behavior contract.

---

## 4. Required Scaffolding

### 4.1 Governed orchestrator pattern

A workforce agent may have its own orchestrator worker when it needs isolation.

The orchestrator owns:

- trigger shape
- task decomposition
- queue/workflow state
- phase progression
- retries at the orchestration level
- artifact storage for review
- artifact state and audit history
- agent-specific prompts/playbooks
- product-specific apply/commit handoff, where applicable

The orchestrator does not own:

- provider keys
- model routing
- AI grants
- budget enforcement
- learning-event emission
- product truth
- provider credentials

### 4.2 San Francisco service-binding execution path

Durable orchestrators should call San Francisco through a private service-binding path
where possible.

That path must use the same shared execution core as interactive `/v1/execute`, but with
separate workload budgets and a service-scoped request contract.

### 4.3 Human-review artifact store

Autonomous workforce agents should produce reviewable artifacts before high-impact writes.

Examples:

- UX audit report
- proposed Prague copy
- GTM page/keyword recommendation
- moderation action proposal
- support response draft

These artifacts are not account widget truth and not San Francisco telemetry.

The reference agent's orchestrator owns the review artifact store, not San Francisco and
not Tokyo/Roma account-instance truth. Proposed default for execution: service-owned R2
for artifact bodies plus D1 for artifact index/state/audit.

Minimum artifact states:

- `drafted`
- `needs_review`
- `approved`
- `rejected`
- `applied`
- `superseded`

Minimum review fields:

- artifact id
- agent id
- phase/task class
- risk class
- summary/rationale
- diff or artifact preview reference
- model/capability/prompt/policy versions
- reviewer action and timestamp, where applicable
- outcome signal, where applicable

### 4.4 Risk and human gate

Risk must be explicit before autonomous work mutates anything high-impact.

Each workforce agent/action must declare `riskClass` in registry/policy. San Francisco
enforces risk/policy before AI execution or before returning an actionable result, but the
orchestrator/product boundary owns review state, artifacts, approval records, and commits.
This must not depend on legacy `widget_instance_overlays`, RLS, or `source = agent`
storage mechanics.

Risk dimensions used to derive or review `riskClass`:

- read-only vs write
- reversible vs irreversible
- internal vs customer-facing
- account truth vs service artifact
- public publishing impact
- user-content impact

The human gate is required when policy says the `riskClass` needs approval. San Francisco
must require the declared policy/approval signal; orchestrators must not be able to bypass
that requirement for high-risk actions.

### 4.5 External outbound layer direction

GTM and some future agents need external systems such as competitor pages, keyword APIs,
and Search Console.

External reach should be shared and intent-shaped, not per-agent bespoke clients.

Direction:

- one credential custodian
- intent-level tools
- structured tool outputs
- no external secrets passed through prompts
- browser handoff for OAuth/payment flows where needed
- concrete mechanism deferred until the first real agent requires it

This PRD does not build the outbound layer.

---

## 5. First Reference Agent

SUPERSEDED for current execution (2026-06-18): no reference agent is selected for
execution now. Builder Copilot Operator must go green first. The earlier D5 proposal
selected **Widget Instance Translator re-base** over UX Writer, but that proposal relied
on stale translation execution assumptions and must be re-reviewed before 120C executes.

Reason:

- it is a real product need, not a speculative GTM/UX Writer agent
- it must be re-grounded before execution because account translation generation is not
  currently queue-backed product orchestration
- the D9 regression gate (29-locale overlay fixture) bounds the risk better than any
  greenfield agent could
- it satisfies the product owner's "better, not worse" bar: the re-base IS the
  improvement path (policy-driven models, typed failures, learning events, durable
  budgets)

UX Writer is deferred until a real need exists. An earlier draft of this PRD
recommended UX Writer; building a speculative agent to validate a pattern that
production already runs was rejected by the product owner.

The reference implementation must be thin but real:

- one trigger
- one prompt/playbook version
- one or more SF-routed model calls
- one review artifact output
- no direct product-truth write
- one eval/quality gate for the produced artifact

---

## 6. In Scope

- Define the workforce-agent scaffold.
- Define governed orchestrator responsibilities.
- Define the San Francisco service-binding execution requirement.
- Define review artifact boundary.
- Define risk/human-gate direction.
- Define external outbound layer principles.
- Re-base the Widget Instance Translator through the scaffold as the reference agent
  (D5), under the D9 regression gate.

This scope begins only after the prerequisites above are green. Until then, this PRD stays
as architecture scaffolding, not active build work.

---

## 7. Out of Scope

- Builder Copilot. That is PRD 120B.
- Fixing user-facing Copilot UX.
- Building GTM.
- Building a full UX Writer product beyond the thin reference implementation.
- Building Support Reply.
- Building Community Moderation.
- Building a generic MCP server now.
- Moving product persistence into San Francisco.
- Allowing durable agents to call LLM providers directly.

---

## 8. Acceptance Criteria

This PRD is execution-ready only when 120B is green and the next execution spec can
answer:

- Which 120B Builder Copilot earth-test scenarios passed across shipped widgets?
- What is the service-binding request/response contract?
- How does a service-scoped agent get an AI grant or equivalent signed policy?
- Where do review artifacts live?
- How is risk declared?
- Where does human review happen?
- What artifact states and reviewer actions exist?
- Which product/orchestrator boundary owns apply/commit after approval?
- How are durable and interactive budgets separated?
- Which telemetry/learning fields are mandatory?
- What is the first reference workforce agent?
- What eval/quality gate proves the reference artifact is usable?

Execution of the scaffold is complete only when:

- one reference durable agent can call San Francisco without owning provider keys
- the reference agent writes review artifacts, not product truth
- all model calls pass through San Francisco's shared plane
- budget/telemetry/learning events are emitted through the plane
- `riskClass` is declared in registry/policy and enforced by San Francisco policy
- high-risk actions require a declared review path owned outside San Francisco
- the review artifact store has state, audit, and outcome fields
- the reference agent passes its eval/quality gate
- docs match the shipped scaffold

---

## 9. Planning Review

1. **Elegant engineering and scalability**
   Yes. Per-agent orchestration stays isolated while the AI plane remains singular.

2. **Compliance with architecture and tenets**
   Yes. No duplicate provider-key custody, no duplicate grant logic, and no agent-owned
   product persistence.

3. **Avoids over-architecture**
   Yes if execution builds one reference agent first and defers outbound tooling until GTM
   or another real agent needs it.

4. **Moves toward intended architecture**
   Yes. It prepares Clickeen for the AI workforce without blocking the immediate Builder
   Copilot rescue.
