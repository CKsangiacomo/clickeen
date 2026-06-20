# Peer Review B - 121G Learning And Outcomes Foundation

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121G__PRD__Learning_And_Outcomes_Foundation.md`, 121A, 121B, the 121
umbrella, and the executed `085A San Francisco Learning And Outcome Loop` it
references.

## Verdict

Accept with one sharpening. 121G makes exactly one correct and important
decision — **"execution is not learning"** — and turns it into a day-one data-
capture requirement without committing to build autonomous learning. That is the
right posture: reserve the seam, forbid the magic, build nothing speculative. The
sharpening needed is to make the *day-one* obligation unambiguous and minimal,
because a "record everything for future learning" list is exactly where a team
either over-builds a telemetry pipeline now or fabricates outcomes that the
product surface cannot actually observe.

## 1. Elegant Engineering And Scalability

- **Section 2 ("Execution is not learning") is the load-bearing idea** and it is
  correct: a successful model call is not a good answer, a valid edit is not a
  helpful edit, a published widget does not attribute the outcome to an agent
  choice. Every team building agents gets this wrong by treating execution
  success as quality signal. Writing it as law up front is high-leverage.
- **Section 6 ("No Silent Self-Mutation") is the right scalability guarantee:**
  promotion requires evals + review + release + rollback. This prevents the
  worst failure mode of a learning system — production behavior drifting from raw
  signals with no gate. Boring and essential.
- **Separating edge runtime from learning (Section 5)** restates the umbrella's
  two-planes thesis correctly: visitor path stays AI-independent; learning is
  async/governed off logs and rollups. This is what keeps learning scale
  decoupled from widget traffic scale.

## 2. Compliance To Architecture And Tenets

- **Compliant.** Product surfaces own product outcomes (Section 4); missing
  outcomes are not fabricated; consent/privacy/retention/product-law gate what
  can be used (Section 5). This directly honors the umbrella's OQ8 governance
  requirements and the "don't confuse observable traffic with permission to
  learn" anti-goal.
- **The relationship to executed 085A must be stated.** 085A was the "Learning
  And Outcome Loop" PRD. 121G should say in one line whether it **supersedes,
  narrows, or extends** 085A — otherwise there are two learning-foundation PRDs
  and it is unclear which governs. (Same reconciliation discipline 121D needs
  with 103.)

## 3. Over-Architecture / Unnecessary Complexity

- **The day-one trace list (Section 3) is the place this can over-build.** Eleven
  recorded fields "should be able to record" is fine as a *capability*, but the
  PRD must distinguish **what must be captured on day one** (agent id, version,
  model route, validation result, output type — i.e., the trace 121A already
  requires) from **what is captured only when the owning surface can observe it**
  (user/workflow outcome). Otherwise a builder stands up an outcome-ingestion
  pipeline before any agent can emit outcomes.
- **Outcome capture must be opportunistic, not a subsystem.** Section 4's outcome
  examples (accepted / followed-up / applied / undone / ignored / saved /
  reviewed / rejected / published-later) are correct, but they are *product
  surface events that already exist or don't*. 121G should say: record the ones
  the surface already emits; do not build new instrumentation to manufacture
  them. "Do not invent missing outcomes" (Section 4) says this for fabrication;
  extend it to forbid *building* speculative instrumentation too.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **The biggest pre-work risk in the entire 121 series lives in the
  *temptation* behind this PRD** — "learning" invites building corpora,
  eval harnesses, and rollup jobs before a single agent has shipped. 121G mostly
  resists this (Section 1: "does not build autonomous learning on day one"), and
  that resistance is its main virtue. Keep it ruthless.
- **The correct day-one deliverable is almost nothing:** one nullable `outcome`
  field on the trace record 121A already defines, populated only where the
  surface already knows the answer. That is the entire build. Everything else in
  121G is a *future-PRD reservation*, and the document should say so explicitly
  so no eval/corpus/rollup work starts under this PRD's authority.
- **No academic jargon. The "core law" framing is concrete, not theoretical.**

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

Yes — provided it is read as "add one outcome field and forbid silent mutation,"
not "stand up the learning system." Its job is to make sure the day-one trace
captures enough that a *future* governed learning loop is possible, without
building that loop or fabricating signals. That is precisely on-tenet for the
hardest long-term problem: reserve the seam, gate the promotion, build nothing
speculative.

It earns full acceptance once it states the minimal day-one obligation and its
relationship to 085A.

## Required Edits Before Build

1. **State the relationship to executed 085A** — supersedes / narrows / extends.
2. **Reduce the day-one obligation to its minimum:** one nullable `outcome`
   field on the existing 121A trace, populated only where the surface already
   observes it. Mark everything else as future-PRD reservation.
3. **Forbid building speculative instrumentation,** not just fabricating
   outcomes — record what surfaces already emit; do not manufacture events.
4. Confirm no eval/corpus/rollup work is authorized under 121G.
