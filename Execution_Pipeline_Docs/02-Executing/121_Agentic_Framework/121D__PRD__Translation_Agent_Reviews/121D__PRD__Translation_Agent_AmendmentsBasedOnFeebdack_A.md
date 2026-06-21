# Amendments Based On Feedback A - 121D Translation Agent

Source PRD: `121D__PRD__Translation_Agent.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend before execution.

The shape is right, but V1 must be narrower and more honest. Translation is best
treated as a governed translation workflow/system agent, not a broad autonomous
agent loop.

## 2. Feedback Conflict Resolution

Resolved conflict: adapter versus pre-GA clean replacement.

Keep or wrap working translation core where it matches current authority.
Replace conflicting 103-era contracts, disabled stubs, or misleading durable
claims. Pre-GA allows clean correction, but does not require rebuilding working
core for aesthetic consistency.

Resolved conflict: agent or workflow.

V1 should be a structured-output workflow/system agent:

```text
saved text graph -> governed translation call -> exact path validation
-> product-owned overlay apply
```

No generic artifact-agent framework or open-ended planning loop is required.

## 3. Recommended Amendments

1. Replace active authority with 105E.

   103-series docs may be historical keep/replace/wrap input only. Where 103
   conflicts with 105E/current saved-instance endpoint truth, 105E wins.

2. Define V1 scope.

   V1 is:

   - canonical id `widget.instance.translator`;
   - saved account-widget instance only;
   - one target locale per request;
   - exact current saved text graph;
   - exact field/path set;
   - protected structure preserved;
   - product/Tokyo-owned overlay apply.

3. Remove unsupported durability claims.

   Pick sync artifact/workflow for V1 unless queue/DO/runtime durability is
   explicitly built. Do not call it durable if it is not durable.

4. Decide the review/apply boundary.

   V1 should use product-owned apply with trace plus deterministic warnings.
   Do not imply a review store, human review platform, or subjective quality
   workflow unless built.

5. Define invocation fields.

   Required fields:

   - account coordinate;
   - instance id;
   - widget type;
   - base locale;
   - target locale;
   - saved base content marker;
   - editable-fields contract hash;
   - field identity/path/type/role/label;
   - base text;
   - policy;
   - request id.

6. Define output and terminal failures.

   Output must be exactly requested translated fields plus same marker,
   telemetry, and terminal complete/fail status.

   Terminal failures:

   - missing path;
   - extra path;
   - empty provider output;
   - malformed rich text;
   - placeholder/tag/anchor mismatch;
   - stale marker;
   - contract mismatch;
   - provider failure.

7. Add structured-output reliability.

   Protected fields/tokens/URLs/placeholders must be typed slots and validated
   deterministically. Prompt instruction alone is not enough.

8. Add day-one translation evals.

   Required evals:

   - protected-token integrity;
   - exact schema/path preservation;
   - malformed rich text rejection;
   - placeholder/tag/anchor mismatch;
   - locale spot checks;
   - meaning/tone judge;
   - seed from D9/29-locale evidence where applicable.

9. Defer Product Copilot invocation.

   Product Copilot-triggered translation requires explicit future child-agent or
   tool permission. It is not part of V1.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these to the 121D V1 path unless the
Product Owner explicitly decides they belong there:

- generic artifact-agent framework;
- glossary platform;
- broad brand-voice review system;
- multi-locale orchestration;
- Copilot-triggered translation;
- human-review platform;
- open-ended agent-loop machinery;
- relaxed validation for legacy compatibility.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121D as executable after it
names 105E as current authority, narrows V1 to saved-instance single-locale
workflow, removes unsupported durability language, and defines exact
validation/eval behavior.
