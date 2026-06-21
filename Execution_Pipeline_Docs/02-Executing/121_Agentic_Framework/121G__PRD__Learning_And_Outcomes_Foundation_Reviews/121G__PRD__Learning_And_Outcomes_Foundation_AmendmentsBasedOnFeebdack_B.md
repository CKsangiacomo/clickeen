# Recommendations based on peer reviews — 121G (Learning And Outcomes Foundation)

Source reviews: `_PR_A` (Approve w/ minor revisions; Rev.B = full flywheel), `_PR_B` (Accept; minimal seam, eval day-one), `_PR_C` (Pass; runtime-correct, vocabulary split).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Promote eval from "future promotion gate" to "day-one consumer of the trace"** — a small per-agent eval harness (scoped in 121C) + LLM-as-judge for open-ended Copilot quality + reference checks for bounded tasks. Why: all three reviews converge here; the OpenAI agent-improvement-loop cookbook is a shipped reference for traces→feedback→evals→gate→handoff. "Capture now, learn later" should be "capture now, **eval now**."
2. **Reuse the shipped capture path** (`/v1/execute`→`SF_EVENTS`, `/v1/outcome`→`copilot_outcomes_v1`, R2 samples, `rawSamplePercent`) — do not reinvent. Why: PR_A/PR_B/PR_C all agree the plumbing exists.
3. **Reduce the day-one obligation to its minimum:** one nullable `outcome` field on the existing 121A trace, populated only where the surface already observes it. Why: PR_B/PR_C — don't manufacture events or build speculative instrumentation.
4. **Specify day-one trace retention/privacy/redaction + the sampling knob** as part of the foundation. Why: PR_A — the trace already holds user content; §5's privacy rules only cover future global learning.
5. **Adopt PR_C's vocabulary split** — trace / outcome / eval-candidate / training-candidate / released-behavior-change. Why: stops misrepresenting observability as autonomous learning; pre-GA is the moment to fix the naming.
6. **Add an explicit "no attribution engine now" rule, with corrupt-trace = invalid status (not absence).** Why: PR_C (V5). This also resolves the tension with PR_A's "specify attribution linkage": **specify the linkage field now, but forbid causal claims until a governed future proof.**
7. **State the relationship to executed 085A** (supersedes / narrows / extends) in one line. Why: PR_B — otherwise two learning-foundation PRDs coexist with unclear governance.

## My take on where the reviews split
The real split is **day-one size**: PR_A's Revision B wants 121G to *become* the full improvement flywheel; PR_B/PR_C want a thin seam with eval as the only day-one addition. **I side with PR_B/PR_C** — adopt day-one evals (uncontested) but keep the corpus/rollup/attribution/learning-loop work explicitly deferred, to preserve 121G's stated restraint.

## Decisions that are yours (product/scope)
- **How far to take the flywheel day-one (minimal seam vs full improvement engine):** I'd take the minimal-seam + day-one-eval posture. Your call on investment.
- **Whether/when to build the corpus, rollups, and widget-network learning loop:** that's the strategic north star — yours.
- **`Status: EXECUTING` scope:** I'd scope it to "trace capture + eval hooks." Your call.

## Net
With 1–7, 121G stays the strongest PRD — honest (reuses shipped plumbing), minimal day-one (nullable outcome + eval), correctly named (vocabulary split), and disciplined (no attribution engine, no silent mutation). The flywheel depth and learning-loop investment are yours.