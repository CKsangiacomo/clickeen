# Recommendations based on peer reviews — 121C (Product Copilot Real Agent)

Source reviews: `_PR_A` (Revise; cutover dropped under pre-GA), `_PR_B` (Accept, pending two interfaces), `_PR_C` (Pass on direction, not execution-ready).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Define the v1 output union concretely: `answer | clarification | suggestion | draft_edit | refusal | error`.** Why: PR_C correctly flagged — an undefined output set can't be built or tested. This union is also the one test that separates a real agent from an edit bot.
2. **Define a NEW draft-action contract that Bob validates; do NOT inherit `resolved_edit | multi_op_plan`.** Why: PR_B and PR_C both flagged this as the load-bearing undefined interface — silently inheriting the legacy shape is the default failure mode.
3. **Specify the context capsule with a token/byte budget, summarized-vs-raw fields, and explicit "unavailable" markers.** Why: PR_B correctly flagged — without a budget the capsule balloons into full raw state (and PR_A's privacy/staleness concerns ride on this).
4. **Remove the FULL pre-model routing shape, not just `controlContract.ts`: the `turnClass` field, `resolvedTarget`, regex-scoped controls, and edit-only output expectations.** Why: PR_C correctly flagged — the whole envelope encodes the old brain; killing only the filename leaves the masquerade in the wire.
5. **Preserve Bob's op validator explicitly — it is the safety boundary.** Why: PR_B correctly flagged the risk of over-deletion — a literal reader could rip out the validator with the regex.
6. **Ship v1 as single-pass capsule reasoning (one step → one decision), with loop semantics owned by 121A and the loop running in Bob.** Why: resolves the A-vs-B/C loop argument — simplest viable shape, fits the free-tier budget, and the loop model still exists to grow.
7. **Add a day-one eval harness** (seeded from 120B earth-test prompts; op-validation graders + LLM-as-judge rubrics for tone/grounding/did-it-edit-the-right-control; pass@1/pass^k; gate on it). Why: all three reviews agree — this is the one non-negotiable when replacing a shipped feature.
8. **Define a validation-failure taxonomy** (rejected op, stale capsule, missing context, oversized, provider unavailable, malformed output) that surfaces as ask/refuse/error, never success. Why: PR_C correctly flagged — without it, failures get claimed as success (V3/V6).

## My take on where the reviews split
- **Loop shape:** PR_A says single-pass v1; PR_B/PR_C want a real loop with max-steps. Recommendation 6 satisfies both — single-pass v1, loop semantics in the architecture.
- **Tool surface in v1:** I land with PR_C — exactly one tool surface in v1 (validated draft-edit); other tools/child-agents disabled. PR_B's structured-decoding retry is a reliability layer on top, not a broader tool surface.

## Decisions that are yours (product/scope)
- **Child-agent calls in v1 (e.g., Product Copilot → Translation):** I'd disable (stub "not available yet"). Whether the first Copilot needs to reach internal agents day-one is a product call.
- **Cutover/rollback:** I'd hard-cut (pre-GA, eval-gated). Your risk tolerance.
- **Capsule richness (bounded payload vs JIT-fetch tools):** I'd ship a bounded capsule v1 and design the JIT-fetch seam for later. Your call on v1 capsule scope.
- **Structured/constrained decoding + bounded retry investment:** I'd add it. Your call on reliability spend.

## Net
With recommendations 1–8, 121C becomes concrete and safely executable: one output union, one new draft-action contract, one tool surface (validated draft-edit), single-pass v1 loop in Bob, a real eval gate, and a full failure taxonomy. The masquerade is removed end-to-end (brain, wire envelope, output expectations). Scope calls (child-agents, cutover, capsule richness) are yours.