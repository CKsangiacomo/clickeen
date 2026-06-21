# Amendments Based On Feedback A - 121G Learning And Outcomes Foundation

Source PRD: `121G__PRD__Learning_And_Outcomes_Foundation.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend before execution.

121G is one of the strongest PRDs, but it must split day-one evals from future
learning. Execution success is not learning success, and traces are not
autonomous improvement.

## 2. Feedback Conflict Resolution

Resolved conflict: eval now versus learning later.

The amendment should create two tiers:

- Tier 1 day one: append-only traces, optional surface-owned outcomes, and small
  eval harnesses for 121C/121D acceptance and regression.
- Tier 2 future: corpus, global widget-network learning, tuned models, rollups,
  and any autonomous improvement path.

## 3. Recommended Amendments

1. Define vocabulary.

   Distinguish:

   - trace;
   - outcome;
   - eval candidate;
   - training candidate;
   - released behavior change.

2. State day-one capture.

   Day one is:

   - append-only execution trace;
   - optional surface-owned outcome;
   - existing outcome/event plumbing where available;
   - no product mutation from traces.

3. Reconcile current runtime/history.

   Amend the PRD to name existing `/v1/outcome`, `copilot_outcomes_v1`, current
   telemetry/event paths, and relationship to executed 085A. State whether 121G
   supersedes, narrows, or extends the prior decision.

4. Make absence and corruption explicit.

   - Missing outcomes remain missing.
   - Corrupt traces/outcomes are invalid, not absent.
   - No outcome may be inferred from later publish, undo, conversion, or absence
     unless a future governed attribution system proves the link.

5. Add day-one eval consumer.

   Trace records must feed small eval harnesses for:

   - Product Copilot decision/action quality;
   - Translation protected-structure/path/meaning quality.

   This is not a learning platform. It is the gate for PRD acceptance and future
   prompt/tool/model changes.

6. Define promotion path.

   Only this path may change behavior:

   ```text
   trace/outcome -> eval/review -> release -> rollback
   ```

   No prompt, model, route, tool, or policy may mutate automatically from
   captured traces/outcomes.

7. Add privacy/retention gates.

   Day-one raw samples require:

   - privacy classification;
   - redaction rule;
   - retention window;
   - sampling policy;
   - consent/eligibility policy.

   These are day-one blockers for raw capture, not future cleanup.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these under 121G unless the Product Owner
explicitly decides they belong there:

- general analytics platform;
- attribution engine;
- training corpus pipeline;
- global widget-network rollups;
- autonomous learning;
- auto prompt/model/tool mutation;
- speculative instrumentation;
- broad eval suite sprawl;
- new product events solely to manufacture outcomes.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121G as ready for execution
when it is framed as trace/outcome/eval foundation. I recommend treating
learning, training, and global widget-network improvement as separate governed
PRDs unless the Product Owner chooses to combine them.
