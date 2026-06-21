# Amendments Based On Feedback A - 121C Product Copilot Real Agent

Source PRD: `121C__PRD__Product_Copilot_Real_Agent.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend before execution.

This is the keystone PRD. The product direction is correct: kill the regex brain
and build a real conversational Product Copilot. But execution requires a
concrete turn contract, eval gate, and hard pre-GA cutover away from masquerade
behavior.

## 2. Feedback Conflict Resolution

Resolved conflict: agent loop versus SF-to-Bob product tool loop.

My recommendation is that Product Copilot V1 avoid an SF-to-Bob live tool
callback loop. The first implementation should be:

- a real model reasoning turn over product context and allowed actions;
- typed response/action output;
- Bob-side validation and reversible draft apply;
- at most a bounded schema/validation retry, not an open product tool loop.

Resolved conflict: rollback versus hard replacement.

Pre-GA removes the need to preserve the fake Copilot path. Replace the old brain
cleanly and prove the replacement with evals/tests. Do not keep hidden regex
fallback.

## 3. Recommended Amendments

1. Define the canonical Product Copilot contract.

   The amendment must decide whether `cs.widget.copilot.v1` remains the id or is
   replaced. In either case, I recommend that the new contract not preserve old
   `turnClass`, `resolvedTarget`, scoped-control, or edit-only assumptions.

2. Replace the old invocation envelope.

   Required fields:

   - account/session authority from Roma;
   - widget type;
   - instance id;
   - Bob draft/context version;
   - selected UI control only when explicitly selected by the user;
   - available actions;
   - unavailable capabilities;
   - context capsule version/staleness hash;
   - trace/request id.

3. Define the context capsule.

   The capsule must include:

   - small orientation facts;
   - explicit unavailable markers;
   - token/byte budget;
   - raw versus summarized fields;
   - staleness marker;
   - optional just-in-time fetch seams where 121A/121B allow them.

   Missing/stale/invalid context must produce visible ask/refuse/error behavior,
   not invented defaults.

4. Define the output union.

   Required output variants:

   - `answer`;
   - `clarification`;
   - `suggestion`;
   - `draft_edit`;
   - `refusal`;
   - `error`.

5. Define the draft-action contract.

   Draft actions must be schema-valid by construction and Bob-validated before
   apply. My recommendation is to keep Bob's op validator because it is a safety
   boundary.

   Remove:

   - local semantic regex/control matching before agent reasoning;
   - Bob-inferred user intent;
   - Bob-selected scoped controls unless user explicitly selected the control.

6. Fence V1 capabilities.

   V1 does not include:

   - child-agent calls;
   - analytics tools;
   - Translation Agent calls;
   - QA agents;
   - generic memory;
   - doc retrieval system;
   - generalized tool registry.

7. Add day-one evals.

   Required eval harness:

   - representative Builder turns from known failures and earth-test prompts;
   - expected decision type;
   - deterministic draft-op validation;
   - LLM-judge rubrics for tone, grounding, and helpfulness;
   - transcript review;
   - pass@1 and pass^k tracking;
   - regression gate for every harness/prompt/tool/output-contract change.

8. Define visible failure behavior.

   Must be terminal or visible:

   - rejected op;
   - stale capsule;
   - missing required context;
   - oversized context;
   - unavailable provider;
   - malformed model output;
   - Bob validation failure after bounded retry.

9. Clarify consent and persistence.

   Immediate draft apply is allowed only as reversible in-memory Bob state with
   visible undo. Persistence remains Roma save path, never model authority.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these to the 121C V1 path unless the
Product Owner explicitly decides they belong there:

- legacy regex fallback;
- compatibility mode for `controlContract.ts`;
- child-agent routing;
- SDR concepts;
- analytics/translation/QA tools;
- generic tool registry;
- generic memory;
- SF-to-Bob live product callbacks;
- feature-flag rollback that preserves fake-agent behavior as the safety plan.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121C as executable after the
PRD names the new envelope, output union, draft-action contract, validation
failures, eval gate, and recommended removal of pre-model semantic routing.
