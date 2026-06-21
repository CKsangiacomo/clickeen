# 121G PRD - Learning And Outcomes Foundation

Status: EXECUTING
Owner: Product + Architecture + AI Runtime
Priority: P1
Date: 2026-06-20
Type: Sub-PRD / future-scope guardrail
Pre-execution amendment state: settled as trace/outcome/eval foundation after peer-review convergence.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `Execution_Pipeline_Docs/03-Executed/085A__PRD__San_Francisco_Learning_And_Outcome_Loop.md`

---

## 1. Purpose

This PRD defines the first learning/outcome foundation.

It does not build autonomous learning on day one.

It makes sure agent architecture captures the evidence needed to improve later.

Day one is capture and eval, not autonomous learning.

## 2. Core Law

Execution is not learning.

A successful model call does not mean the answer was good.

A valid edit operation does not mean the edit helped the user.

A published widget does not prove which agent choice caused the outcome.

Learning requires governed outcomes, evals, review, promotion, and rollback.

Vocabulary:

- trace: append-only record of an agent/model execution;
- outcome: surface-owned result signal when the owning surface can observe it;
- eval candidate: trace/outcome sample eligible for acceptance or regression
  evaluation;
- training candidate: governed sample eligible for future model or prompt
  training work;
- released behavior change: a reviewed prompt, model, route, tool, or policy
  change that shipped with rollback.

## 3. Day-One Foundation

Each agent execution should be able to record:

- agent id;
- agent version;
- invoking surface;
- context version;
- model/provider route;
- prompt/playbook version where applicable;
- tool calls;
- validation results;
- cost/usage/error metadata;
- output type;
- user/workflow outcome when the owning surface can know it.

Day-one capture is:

- append-only execution trace;
- nullable surface-owned outcome field;
- trace-to-outcome linkage field;
- existing outcome/event plumbing where available;
- no product mutation from traces.

The trace-to-outcome linkage field should include:

- trace id;
- outcome id when available;
- surface id;
- artifact id where allowed;
- timestamp.

Linkage is not causality.

No causal claim may be made from a later save, publish, undo, conversion, or
absence until a future governed attribution system proves the link.

## 4. Product Outcomes

Product surfaces own product outcomes.

Examples of possible outcomes:

- answer accepted;
- user asked follow-up;
- edit applied;
- edit undone;
- suggestion ignored;
- draft saved;
- artifact reviewed;
- artifact rejected;
- publish happened later.

These are not all available in every surface.

Do not invent missing outcomes.

Missing outcomes remain missing.

Corrupt traces or outcomes are invalid, not absent.

Product surfaces may attach outcomes only when they own and observe the outcome.

## 5. Global Widget-Network Learning

Clickeen's long-term advantage may come from deployed widgets and their usage
signals.

That is future scope and must be async/governed:

- edge runtime stays AI-independent;
- visitor request path does not call live LLMs;
- logs/rollups/queues/cron/sampling may feed future learning;
- consent, privacy, retention, and product law decide what can be used.

Published widget traffic must never make the visitor request path call live
models. Any widget-network learning is async, sampled, governed, and future
scoped.

## 6. No Silent Self-Mutation

Learning signals must not silently rewrite production prompts, models, tools, or
agent behavior.

Promotion requires:

- evals;
- review;
- release;
- rollback.

The only behavior-change path is:

```text
trace/outcome -> eval/review -> release -> rollback
```

No prompt, model, route, tool, or policy may mutate automatically from captured
traces or outcomes.

## 6.1 Day-One Eval Consumer

Trace records must feed small eval harnesses for:

- Product Copilot decision/action quality;
- Product Copilot tone, grounding, helpfulness, and product usefulness;
- Translation protected-structure/path/meaning quality.

This is not a learning platform. It is the acceptance and regression gate for
agent prompts, tools, output contracts, model routes, and policy changes.

## 6.2 Privacy, Retention, And Raw Sample Gates

Raw trace or sample capture may include user content.

Before raw capture expands beyond the minimum required for acceptance and
regression evals, the Product Owner/legal policy must decide:

- retention window;
- sampling rate;
- PII/content classification;
- redaction rules;
- consent/eligibility policy;
- account eligibility;
- raw sample access controls.

Engineering must not invent these values.

## 7. Acceptance Criteria

- Agent architecture records enough execution data for future evals.
- Day-one foundation distinguishes trace, outcome, eval candidate, training
  candidate, and released behavior change.
- Trace records include a trace-to-outcome linkage field, but linkage is not
  causality.
- Product surfaces own product outcomes.
- Missing outcomes are not fabricated.
- Corrupt traces/outcomes are invalid, not treated as absence.
- Published widget traffic is not confused with live Ombra inference.
- Day-one traces feed Product Copilot and Translation eval harnesses.
- Raw capture privacy, retention, sampling, consent, eligibility, and access
  rules are Product Owner/legal decisions.
- No autonomous production mutation exists without explicit future PRD approval.
