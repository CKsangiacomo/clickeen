# Peer Review B - 121D Translation Agent

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121D__PRD__Translation_Agent.md`, 121A, 121B, the 121 umbrella, and the
already-executed 103 translation batch (103B Instance Translation Agent
Contract, 103J Generic Widget Translation System) that 121D references.

## Verdict

Accept with one structural concern that must be resolved first: **121D overlaps
an already-executed system (the 103 batch) and the PRD knows it** — slice 1 is
literally "reconcile existing 103 translation contracts with real agent
architecture." That reconciliation is the actual work, and until it is done it
is impossible to tell whether 121D is *building* a Translation Agent or
*re-housing* one that already exists under the new envelope. Resolve the
relationship to 103 before treating 121D as net-new build.

The agent design itself is correct and is the right second proof — a focused,
non-conversational artifact agent that demonstrates the architecture supports
something that is not a Copilot.

## 1. Elegant Engineering And Scalability

- **"Translation is not a Copilot" (Section 1) is the right reason for this PRD
  to exist.** Its job in the series is to prove 121A's claim that very different
  agents share infrastructure without sharing product logic. Picking a
  bounded artifact-in/artifact-out worker as the second agent is the correct
  contrast to the broad conversational first agent. Good design instinct.
- **The protected-structure list (Section 2: variables, placeholders, URLs,
  product tokens, schema structure, field ownership) is the real engineering
  content** and it is correct — this is exactly where naive "translate the JSON"
  implementations corrupt widgets. Making the agent preserve protected tokens is
  the load-bearing requirement.
- **Reviewable artifact out, product workflow owns apply (Section 5):** correct
  and consistent with product law. The agent never mutates saved state; a
  product-owned route accepts/applies. Scales the same way as Product Copilot.

## 2. Compliance To Architecture And Tenets

- **Product law: compliant.** Output is a reviewable artifact; durable mutation
  goes through product routes only after review/acceptance (Sections 5, 6).
- **121A compliance: compliant.** Distinct context contract ("Translation Agent
  context is artifact-specific... not Product Copilot context," Section 4),
  distinct invocation, shared execution rails only. This is the PRD that
  validates 121A's separation claim, and it does.
- **The compliance question that must be answered: does 103 already satisfy
  this?** The 103 batch shipped an "Instance Translation Agent Contract" and a
  "Generic Widget Translation System." If those already define invocation,
  translatable/protected field maps, and output shape, then 121D's Sections 3–5
  are partly re-specifying executed contracts. The PRD must state, concretely,
  **what in 103 survives, what is replaced, and what is genuinely new under the
  121 envelope** — otherwise this violates the pre-GA tenet in the other
  direction: re-writing a working system for envelope conformity rather than
  product need.

## 3. Over-Architecture / Unnecessary Complexity

- **Risk: rebuilding 103 to fit the new envelope when a thin adapter would do.**
  If 103's translation logic works, the on-tenet move is to wrap its invocation
  in the 121 envelope and keep the translation core — not redesign the field-map
  and output contracts from scratch. 121D should explicitly prefer **adapter
  over rebuild** and justify any rebuild by a concrete product gap in 103, not
  by "it should match the new shape."
- **Multi-locale fan-out (Section 3: "target locale(s)") is a quiet complexity
  multiplier.** One artifact → N locales is a batch/cost/partial-failure problem
  (what if 3 of 8 locales fail?). Either scope v1 to single-target and defer
  fan-out, or specify partial-failure and per-locale review semantics. Do not
  leave "(s)" to be discovered at build time.
- **Otherwise appropriately scoped.** No registry, no planner, no premature
  child-agent linkage. The "Product Copilot later" invocation (Section 3) is
  correctly deferred, not built.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **Slice 1 ("reconcile existing 103 contracts") is necessary work, but it is
  also the PRD's biggest pre-work risk:** reconciliation can expand into a full
  re-architecture of a shipped system. Bound it: reconciliation should produce a
  one-page **keep / replace / wrap** decision against 103, not a redesign.
- **No academic abstraction. The brand-voice / CTA-intent / glossary
  requirements are concrete product concerns, not theory.** Right register.
- **One genuinely useful specification gap, not gold-plating:** the agent "must
  know when to ask for review or flag uncertainty" (Section 2) — good — but the
  uncertainty/warning mechanism (Section 5 lists "warnings, uncertainty flags")
  needs a concrete trigger definition, or it becomes a field that is always
  empty. Define what produces a flag (untranslatable token collision, ambiguous
  source, low-confidence locale) so review has signal.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

As an *agent design* it is simple and boring in the right way: bounded input,
protected structure, reviewable output, product owns apply. It moves the series
toward its goal by proving the rails carry a non-Copilot worker.

Whether the *build* is simple depends entirely on the 103 reconciliation. If
121D becomes "wrap the working 103 translation core in the 121 envelope and add
uncertainty flags," it is boring and correct. If it becomes "redesign
translation to match the new architecture," it is unnecessary churn on a shipped
system and violates pre-GA discipline in reverse. The PRD must commit to the
former unless a real product gap in 103 forces the latter.

## Required Edits Before Build

1. **Produce the 103 keep/replace/wrap decision first** (slice 1 output) and put
   its conclusion in this PRD. State what of 103B/103J survives.
2. **Prefer adapter over rebuild** — justify any redesign of 103 contracts by a
   concrete product gap, not envelope conformity.
3. **Resolve multi-locale fan-out:** scope v1 to single-target or specify
   partial-failure + per-locale review semantics.
4. **Define uncertainty/warning triggers** so review flags carry real signal.
