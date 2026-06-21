# Peer Review B - 121B San Francisco Orchestrator And Routing

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`, 121A, the 121
umbrella, and current San Francisco reality (HMAC grant verification, provider
routing, runtime policy, usage/telemetry — a model-execution gateway, not an
orchestrator).

## Verdict

Accept with edits, and re-sequence. 121B correctly frames "routing" as
orchestrating a *known* agent execution rather than regexing raw user text —
that is the right and necessary correction. But the document lists eight
orchestrator responsibilities (Section 3) as a single growth step, and several
of them (child-agent routing, tool routing, fallback) have no caller until 121C
and 121D ship. The honest version of this PRD builds **two** things first —
envelope validation and model routing — and treats the rest as reserved seams.
Section 7's execution slices already say this; Section 3's responsibility list
contradicts the slices by presenting everything as co-equal. Resolve that.

## 1. Elegant Engineering And Scalability

- **The orchestration pipeline (Section 1) is the right mental model.**
  `invoking surface -> agent id -> context contract -> runtime policy -> model
  route -> tool route -> child-agent route -> result -> trace`. Crucially every
  arrow is a known, named hop — there is no "infer intent" box. That is what
  makes it scale: adding an agent is registering an id, not extending a
  dispatcher.
- **Section 3's "must not" list is the load-bearing half.** San Francisco must
  not own product truth, mutate artifacts, invent context, or decide raw text
  belongs to Product vs SDR Copilot. This keeps the gateway from metastasizing
  into a god-service. Keep this list prominent; it is more important than the
  "should" list.
- **Building from the gateway that exists, not greenfield (Section 2),** is the
  correct posture. Grant verification, provider routing, policy, and telemetry
  are real and reused. Good — no rewrite of working transport.

## 2. Compliance To Architecture And Tenets

- **Product law: compliant.** Section 3 explicitly fences San Francisco out of
  product mutation and truth ownership; the Product Copilot example (Section 5)
  routes the draft edit back to Bob for validation/apply. Correct.
- **"Agent identity vs model provider" from 121A: honored.** Model routing
  (Section 4.2) is placed *below* the agent contract. Consistent.
- **Pre-GA / no-legacy-inertia tenet: compliant.** The PRD does not try to
  preserve the current single-call shape as the orchestrator; it grows it
  deliberately. Good.
- **Omission to fix:** the PRD says San Francisco validates "that the caller is
  allowed to invoke that agent" (Section 4.1) but never says *where that
  allow-list lives or who signs it*. Today authority rides in the Roma-issued
  grant. State explicitly that **caller→agent authorization derives from the
  existing grant**, not a new San Francisco-owned ACL — otherwise San Francisco
  starts owning a permission model, which violates the truth-ownership fence it
  just drew.

## 3. Over-Architecture / Unnecessary Complexity

This is the main finding, and it is a sequencing problem, not a wrong-idea
problem.

- **Section 3 lists tool-call routing, child-agent invocation routing, and
  fallback behavior as orchestrator responsibilities** with the same weight as
  envelope validation and model routing. But:
  - Tool routing (4.3) has exactly one consumer until 121C defines a tool, and
    that first "tool" is Bob applying a validated draft edit — which Bob already
    owns. Routing it *through* San Francisco on day one adds a hop with no
    payoff.
  - Child-agent routing (4.4) is gated by the umbrella and 121A to "after two
    real agents exist." Section 7 slice 8 agrees. Section 3 should not list it
    as a current responsibility.
  - Fallback behavior is real but is a model-routing detail (one provider fails
    → try the next), not a separate orchestrator surface.
- **The "agent registry and version lookup" (Section 3, 7.1)** risks becoming a
  database/service before there are two agents to register. On day one a
  registry is a typed map of two entries. Specify it as a **static typed config,
  not a runtime service**, until agent count justifies more.

Net: the orchestrator that 121C actually needs is *envelope-in, validate,
load agent runtime, route model, record trace, return*. Tool routing,
child-agent routing, and a real registry are reserved seams. Make Section 3 say
that explicitly so nobody builds the child-agent router with no child agent.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **Good: the two worked examples (Sections 5, 6) are concrete and grounded.**
  They show real flows (Bob message → capsule+grant → validate → reason → Bob
  applies edit) rather than abstract diagrams. This is the right level.
- **Pre-work risk: defining tool routing and child-agent routing interfaces
  (slices 4 and 8) before their callers exist.** Slice 7 already says "prove
  with Translation Agent," and slice 8 says child-agent routing only after two
  agents — so the slices are correct. The fix is to make Section 3 inherit the
  slices' discipline rather than presenting all eight responsibilities as the
  definition of "orchestrator."
- **No academic jargon. No invented abstractions. The register is right.**

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

The *target* is correct and boring: San Francisco routes known agent
executions, model routing is provider-independent, product surfaces keep
authority. Section 8 acceptance criteria are clean and testable.

The PRD is *less* boring than it should be because Section 3 front-loads
surfaces that only get callers two PRDs later. The simplest true version:
San Francisco's first orchestrator increment is **envelope validation +
agent-runtime load + model routing + trace**, reusing today's grant/provider/
policy/telemetry. Everything else (tool routing through SF, child-agent
routing, dynamic registry, fallback-as-its-own-surface) is a labeled seam built
when 121C/121D demand it.

That re-sequencing turns 121B from "grow into a big orchestrator" into "add the
one thin orchestration layer the first agent needs" — which is the on-tenet
move.

## Required Edits Before Build

1. **Re-rank Section 3** into day-one responsibilities (envelope validation,
   model routing, trace) vs reserved seams (tool routing, child-agent routing,
   fallback-as-surface). Align it with Section 7's slices.
2. State that **caller→agent authorization derives from the existing Roma
   grant**, not a new San Francisco-owned ACL.
3. Specify the **agent registry as static typed config** on day one, promoted to
   a service only when agent count justifies it.
4. Reclassify **fallback** as a model-routing behavior, not a standalone
   orchestrator responsibility.
5. Keep the "must not" fence (Section 3) prominent — it is the most valuable
   part of the document.

---

## Addendum - Best-Practice / State-Of-The-Art Lens

Sourcing caveat: applied from the agentic-engineering canon current to ~Jan 2026
(see umbrella addendum). Live web pull was unavailable this session.

### The routing nuance 121B over-corrects on

121B's framing — "routing means orchestrating a known agent execution, not
regexing raw user language" — is correct *as a reaction to the regex brain*, but
it throws out a legitimate pattern. In the canon, **routing is a named workflow
pattern**: an LLM (or cheap classifier) directs an input to the right
specialized path. The series treats all routing as the enemy because the old
implementation was brittle regex. Distinguish three things the PRD currently
blurs:

- **Brittle pre-agent regex intent-matching** — correctly killed.
- **LLM intent classification *inside* the agent's reasoning** — a recommended
  pattern; this is how Product Copilot decides answer/ask/suggest/apply/tool.
- **Model/difficulty routing (cascade)** — route a step to a cheap model first,
  escalate to frontier on low confidence or high stakes. This is best practice
  for cost and is exactly what 121H wants. Section 4.2 gestures at it ("task
  class, eval-backed model fitness") but does not name the cascade pattern.

Recommendation: rename the anti-pattern precisely ("no brittle pre-agent regex
intent routing") and explicitly *bless* LLM classification and model cascades as
sanctioned patterns. Otherwise a literal reader avoids a cheap-model
pre-classifier that the architecture should want.

### Orchestrator scope against the canon

- **B1 — The orchestrator's first real job is running the agent loop, not
  routing tables.** Per the canon, San Francisco's day-one increment is: validate
  envelope → load agent runtime → **run the model-tool-observe loop with stopping
  conditions and budget** → record trace → return. The eight responsibilities in
  Section 3 omit the loop, which is the actual orchestration primitive. Add it;
  it subsumes "fallback behavior" (a loop/escalation policy) and makes the
  registry/tool-routing/child-routing surfaces clearly secondary.

- **B2 — Orchestrator-worker is the pattern Section 4.4 is reaching for, and the
  canon says price it honestly.** Child-agent routing = the orchestrator-worker
  multi-agent pattern, which costs ~15× tokens and fragments context. The
  deferral (slice 8) is well-supported, but frame it as "multi-agent is expensive
  and context-fragmenting; defer until a task genuinely needs parallel
  specialist work," not merely "after two agents exist."

- **B3 — Keep San Francisco a stateless reducer over context.** *12-factor
  agents* argues the orchestrator should be a stateless function over an explicit
  context window, with state owned outside. This matches the series' "product
  surfaces own truth" — make it explicit that San Francisco holds no per-session
  agent memory; conversation/thread state is passed in by the product surface
  each turn. This prevents the orchestrator from quietly becoming a stateful
  brain.

Net: my main finding stands (re-sequence Section 3 to envelope + model routing +
trace first). The canon adds one item to the day-one list I under-weighted —
**the agent loop itself** — and reframes child-agent routing as the expensive
multi-agent pattern it is.
