# Peer Review C - 121G Learning And Outcomes Foundation

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121G__PRD__Learning_And_Outcomes_Foundation.md`
Verdict: Pass as trace/outcome foundation; must not become a learning platform yet.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/ai/sanfrancisco.md`
- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/telemetry.ts`
- `roma/app/api/account/instances/[instanceId]/copilot/outcome/route.ts`
- `roma/lib/ai/account-copilot.ts`

Verified runtime truth:

- `/v1/execute` already enqueues `InteractionEvent` records to `SF_EVENTS`.
- The queue consumer indexes selected fields into D1 and writes bounded raw
  learning samples to R2 for eligible paid executions.
- `/v1/outcome` already exists and persists signed outcome attachments to
  `copilot_outcomes_v1`.
- Roma forwards Copilot outcome events only for paid profiles; invalid outcome
  payloads and forward failures return HTTP 200 to avoid blocking user flow.
- Current outcome/event plumbing is observability and sample capture, not a
  governed autonomous learning system.

Second-pass correction: 121G should not say "no outcome system exists." It
should say the missing piece is a governed learning/eval foundation that can use
existing event/outcome plumbing without fabricating causality or mutating
production behavior.

## 0b. Best-Practice Research Lens

Modern agent systems treat traces and outcomes as operational truth, not magic
learning. OpenAI tracing guidance separates model calls, tool calls, handoffs,
guardrails, and custom events. OWASP guidance warns against sensitive-data
leakage, overreliance, excessive agency, and insecure tool/plugin design. That
means 121G must stay boring and auditable.

Best-practice alignment:

- Record traces to debug and evaluate agent behavior; do not call traces
  "learning" by themselves.
- Capture outcomes only through product-owned surfaces and explicit events.
- Treat published-widget usage as async evidence for future eval/research, not
  live inference and not automatic agent improvement.
- Keep raw samples minimized, policy-gated, and retention-aware.

Required PRD tightening:

- Split vocabulary into trace, outcome, eval candidate, training candidate, and
  released behavior change.
- State that no prompt, model, tool, route, or self-hosted policy may mutate
  automatically from captured traces/outcomes.
- Add privacy/security gates for raw sample capture, including no silent capture
  expansion beyond current policy.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA allows the learning/outcome vocabulary and schema to be corrected before
bad names become permanent. That matters because "learning" language can
misrepresent simple observability as autonomous improvement.

Pre-GA amendment:

- Rename or replace misleading telemetry concepts if they imply agent learning
  where only traces/samples/outcomes exist.
- Do not preserve raw-sample or outcome fields for compatibility if they encode
  wrong causality or fake confidence.
- Prefer a clean trace/outcome schema over migration shims, while still keeping
  privacy, retention, and explicit policy gates.

The lack of back compat does not authorize automatic learning. It authorizes
cleaner foundations before GA: trace first, outcome second, eval later, released
behavior changes only through reviewed product/engineering flow.

## 1. Elegant Engineering And Scalability

This is one of the stronger PRDs in the series.

It makes the crucial distinction:

```text
execution is not learning
valid output is not useful output
published later is not proof of agent causality
```

That is best-in-class for an AI-first product because it avoids fake learning.
Clickeen can capture useful evidence from day one without pretending it has
autonomous improvement.

The scalable shape is:

- append-only execution trace;
- product-surface-owned outcomes;
- explicit absence when outcome is unknown;
- future evals and promotion;
- no silent self-mutation.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is strongly compliant:

- product surfaces own product outcomes;
- missing outcomes are not fabricated;
- published widget traffic is not live Ombra inference;
- widget-network learning is async/governed future scope;
- prompts, routes, tools, and models cannot silently change from raw signals.

This respects the closed-system advantage while keeping privacy, retention,
consent, and product law in front of learning ambition.

Runtime truth correction:

- Current San Francisco already has some outcome/event plumbing. This PRD should
  describe the missing piece as a governed learning/eval foundation, not claim
  that no outcome plumbing exists anywhere.

## 3. Overarchitecture Or Unnecessary Complexity

The risk is turning "learning foundation" into:

- analytics platform;
- eval framework;
- attribution engine;
- training corpus pipeline;
- widget-network rollup system;
- autonomous model/prompt improvement.

Day one should be smaller:

```text
append-only trace
surface-owned optional outcome
no causal attribution
no prompt/model/tool mutation
reviewed release flow only
```

## 3b. Academic / Meta-Work / Gold-Plating Risks

High-risk gold-plating areas:

- outcome ontology;
- causal attribution models;
- generalized agent performance scoring;
- training-data governance system;
- global widget-network analytics before consent/retention decisions;
- eval suites before enough real agent behavior exists.

The PRD should keep learning as future-consumable evidence, not model
improvement machinery.

## 4. Why This Is Simple And Boring

The simple version is exactly right:

1. Record what happened.
2. Record who owned the product surface.
3. Record known outcomes only when the surface knows them.
4. Preserve unknown as unknown.
5. Improve prompts/models/tools only through reviewed releases later.

That is boring and strong because it gives future Ombra learning clean evidence
without corrupting product behavior today.

## 5. Required Corrections Before Execution

Required:

- Define day-one trace storage as append-only and non-authoritative.
- Make outcome recording optional and surface-owned.
- State absence remains absence; do not infer missing outcomes.
- Add explicit "no attribution engine now" rule.
- State that later publish/conversion/undo cannot be causally assigned to an
  agent unless a future governed system proves that link.
- Clarify privacy/consent/retention are blockers for widget-network learning,
  not implementation details to fill in later.
- State traces cannot change prompts, routes, tools, or model policy except
  through reviewed release flow.

## 6. V1-V8 Audit

- V1 Silent substitution: Pass with watch. Missing outcomes must stay missing.
- V2 Silent healing: Pass. No production behavior is auto-repaired.
- V3 Silent omission: Watch. Existing outcome/event plumbing should be
  reconciled.
- V4 Fail-open control: Pass. Learning cannot bypass review.
- V5 Corruption-as-absence: Watch. Corrupt traces/outcomes need invalid status,
  not absence.
- V6 Partial-success masquerade: Pass. Execution success is not learning success.
- V7 Masquerade/redress: Pass. It rejects fake autonomous learning.
- V8 Runtime test dependency: Pass.
