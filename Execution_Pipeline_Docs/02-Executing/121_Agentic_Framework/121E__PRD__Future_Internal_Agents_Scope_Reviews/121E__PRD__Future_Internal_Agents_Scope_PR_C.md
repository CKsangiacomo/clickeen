# Peer Review C - 121E Future Internal Agents Scope

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121E__PRD__Future_Internal_Agents_Scope.md`
Verdict: Pass as future-scope guardrail; must not create implementation tickets by itself.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/architecture/CONTEXT.md`
- `documentation/ai/overview.md`
- `documentation/ai/infrastructure.md`
- `packages/ck-contracts/src/ai.ts`
- `sanfrancisco/src/index.ts`

Verified runtime truth:

- Current registry has two concrete AI surfaces: `cs.widget.copilot.v1` and
  `widget.instance.translator`.
- There is no generic internal-agent platform in runtime.
- There is no workforce dashboard, generic internal-agent memory layer, or
  internal-agent registry UI.
- Current San Francisco `/v1/execute` is wired to one executor:
  `cs.widget.copilot.v1`.

Second-pass correction: 121E is valid only as a scope fence. It must not be used
to add internal-agent platform machinery before Product Copilot and Translation
Agent prove concrete needs.

## 0b. Best-Practice Research Lens

Agent frameworks are moving fast, but the stable best practice is conservative:
add another agent only when different instructions, tools, authority, review
rules, or final-answer ownership make a separate worker simpler and safer than
one agent/workflow.

Best-practice alignment:

- 121E is valuable as a guardrail because it prevents Product Copilot from
  becoming the template for every future worker.
- It should define the admission test for future agents, not an implementation
  catalog.
- Internal agents should be born from concrete product workflows, not from a
  workforce-dashboard abstraction.

Required PRD tightening:

- Add an explicit "new internal agent admission gate": named owner, trigger,
  subject artifact, allowed tools, output schema, review/apply boundary, trace
  requirement, and why existing Product Copilot/Translation workflow cannot own
  it.
- State that no registry UI, generic memory layer, workforce dashboard, or
  agent-to-agent mesh is authorized by this PRD.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA makes 121E more useful as a deletion/prevention document than as a build
document. Clickeen can block wrong future-agent placeholders before they become
contracts.

Pre-GA amendment:

- Remove any internal-agent stubs, placeholder ids, fake workforce abstractions,
  or shared agent surfaces if they are not needed by Product Copilot or
  Translation Agent.
- Do not preserve future-agent hooks for compatibility. There is no GA API or UI
  depending on them.
- Keep only the admission gate for future PRDs: owner, trigger, subject,
  allowed tools, output, review/apply boundary, and trace.

The correct Pre-GA move is to keep the architecture clean by not creating
unneeded extension points. Future agents can be added when a real product
workflow proves the need.

## 1. Elegant Engineering And Scalability

The PRD does one useful thing: it prevents the architecture from assuming every
agent is Product Copilot.

That is scalable because future internal agents will be focused workers with
different triggers, inputs, outputs, tools, review boundaries, and product
owners. The PRD keeps the future shape explicit without naming a fake workforce
platform.

The strongest pattern is:

```text
owner
trigger
subject
input contract
output contract
allowed tools
review/apply boundary
cost/runtime policy
trace path
Product Copilot relationship if any
```

That is the right gate for future agent PRDs.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is compliant:

- it says future internal agents are not chatbots by default;
- it says Product Copilot is not the template for all agents;
- it keeps internal agents domain-specific;
- it keeps San Francisco on execution rails, not product truth ownership;
- it requires explicit Product Copilot relationship instead of implicit sharing.

The only tension is `Status: EXECUTING` on a future-scope guardrail. That can be
misread as "start building internal agent platform now." The acceptance criteria
mostly fixes this, but the review should keep it explicit.

## 3. Overarchitecture Or Unnecessary Complexity

Risk: the "future internal agent pattern" becomes a universal schema or
management platform before real agents exist.

Do not build now:

- internal-agent registry UI;
- workforce dashboard;
- agent catalog;
- generic memory layer;
- generic lifecycle engine;
- agent marketplace;
- generic review platform.

Blast radius if overbuilt:

- Product Copilot and Translation Agent get delayed by platform work.
- Future undefined agents distort the first real architecture.
- San Francisco becomes a generic workforce product before Clickeen has proven
  agent behavior.

## 3b. Academic / Meta-Work / Gold-Plating Risks

The main academic risk is taxonomy work: classifying future agents, personas,
roles, ownership models, and workflows instead of shipping one real focused
agent.

The PRD should remain a scope fence:

```text
do not block future internal agents
do not build them now
each future agent requires its own PRD
```

## 4. Why This Is Simple And Boring

The plan is simple because it says "leave room."

It does not try to predict all internal agents. It says the architecture must
not assume every agent is conversational, user-facing, widget-editing, immediate,
or memory-sharing.

That moves Clickeen toward intended architecture by keeping Product Copilot from
becoming the accidental template for everything.

## 5. Required Corrections Before Execution

Required:

- Add explicit language that 121E creates no implementation tickets by itself.
- Add explicit "not implied" list:
  - no internal-agent registry UI;
  - no workforce dashboard;
  - no agent catalog;
  - no generic memory layer;
  - no marketplace;
  - no generalized internal workflow platform.
- Tighten "same execution rails" to mean only shared invocation, routing, trace,
  policy, and version metadata, not shared product logic or shared memory.
- State that every future internal agent requires its own execution PRD.

## 6. V1-V8 Audit

- V1 Silent substitution: Pass. No future internal agent capability is claimed.
- V2 Silent healing: Pass. No state repair is proposed.
- V3 Silent omission: Watch. Must explicitly say no implementation is implied.
- V4 Fail-open control: Pass. Product authority remains required.
- V5 Corruption-as-absence: Pass. No stored state behavior is changed.
- V6 Partial-success masquerade: Pass. No product success is claimed.
- V7 Masquerade/redress: Watch. Avoid renaming "workforce platform" into
  future internal agent scope.
- V8 Runtime test dependency: Pass.
