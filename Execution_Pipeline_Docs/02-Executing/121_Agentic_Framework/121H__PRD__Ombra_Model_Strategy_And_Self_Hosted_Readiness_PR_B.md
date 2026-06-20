# Peer Review B - 121H Ombra Model Strategy And Self-Hosted Readiness

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`, 121A,
121B, the 121 umbrella, and current San Francisco reality (provider/model
routing and runtime policy already exist; no self-hosted inference exists).

## Verdict

Accept as-is. 121H is a readiness guardrail with exactly the right discipline:
keep agents provider-independent so adding a provider class later is not a
rewrite, and explicitly **do not make self-hosting a day-one dependency**. It
makes one real engineering commitment (the model adapter boundary stays below
the agent contract — which 121A and 121B already require) and otherwise reserves
options without building them. For an AI-first company this is the correct way to
hold the self-hosting question open without letting it become a distraction.

## 1. Elegant Engineering And Scalability

- **The core law (Section 2: "agents are product workers, models are execution
  dependencies") is the right invariant** and it is the same one 121A states. It
  is what makes provider independence cheap: routing changes never touch agent
  contracts. Repeating it here, at the model-strategy altitude, is appropriate.
- **The task-fitness routing split (Sections 4–5) is concrete and correct.**
  Local/Clickeen-hosted candidates = classification, tool selection, structured
  extraction, bounded translation, summaries, eval/judge passes; frontier =
  broad conversation, ambiguous intent, long context, high-taste copy, high-risk
  answers. This is the real tradeoff, stated without provider ideology. It
  scales because it routes by *measured fitness*, not preference.
- **"Routing decisions must be observable and versioned" (Section 5)** is the
  cheap thing that makes the whole strategy debuggable later. Good.

## 2. Compliance To Architecture And Tenets

- **Compliant.** Provider-independence is consistent with 121A/121B; routing
  lives in San Francisco/Ombra under policy; product contracts do not change
  with the route (Acceptance criterion 5). This is the umbrella's OQ7 leaning
  faithfully captured.
- **Honest about cost (Section 6):** "Do not pretend self-hosting is free because
  the server is cheap" and the full operational list (serving runtime, capacity,
  latency, monitoring, fallback, release testing, evals, security, upgrade path).
  This is the most important paragraph in the document — it is what stops
  self-hosting from being adopted on a napkin cost argument. Keep it loud.

## 3. Over-Architecture / Unnecessary Complexity

- **None built, by design.** The PRD reserves provider classes (Section 3) and
  requires that any self-hosted execution gets its own PRD with the full ops
  checklist. That gate is the correct complexity firewall.
- **The only watch-item is in 121B's implementation:** the routing interface
  needs to support these classes as *config*, not require all of them to exist.
  121H should add one sentence: **the day-one router needs only the providers
  already wired (hosted); the other classes are config slots, not
  implementations.** Otherwise a reader could infer that "Ombra should be able to
  route to" seven provider classes means building seven adapters now.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **The self-hosting narrative (Section 4) correctly avoids the two opposite
  fantasies:** it is not "build a frontier model" and not "reject self-hosting
  because frontier companies exist." It decides by Clickeen task fitness. That is
  the non-academic, non-ideological framing the umbrella asked for.
- **Pre-work risk is low and well-contained:** the operational checklist is
  explicitly assigned to a *future* execution PRD, not to this one. 121H does not
  authorize building inference infrastructure, and says so.
- **No invented jargon.** "Provider classes," "task fitness," "routing
  requirements" are plain and concrete.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

Yes. It is a boring readiness document that protects one expensive future
option (self-hosted/Clickeen-tuned inference) from being either prematurely built
or prematurely killed. It moves toward the target by guaranteeing the agent
architecture never has to be rewritten to add a provider class, while refusing to
spend a single day-zero hour on GPUs. For an AI-first company that may eventually
have a proprietary closed-system learning loop, keeping this option open at near-
zero present cost is exactly right.

## Suggested Edit (Optional)

1. Add one sentence binding this to 121B: the day-one router implements only the
   already-wired hosted providers; the additional provider classes are config
   slots, not adapters to build now. This prevents the Section 3 list from being
   read as a build list.

---

## Addendum - Best-Practice / State-Of-The-Art Lens

Sourcing caveat: applied from the agentic-engineering canon current to ~Jan 2026
(see umbrella addendum). Live web pull was unavailable this session. Model
strategy is the fastest-moving area of all — re-verify provider/price specifics
against current sources before any commitment.

The lens strongly affirms 121H's posture (provider independence, self-hosting as
a future option decided by task fitness, honest ops costs). Refinements:

- **H-add-1 — Name the pattern: model cascade.** The task-fitness split
  (Sections 4–5) is the **cascade / model-routing** pattern from the canon:
  cheap/small model first, escalate to frontier on low confidence or high stakes.
  Naming it makes 121B's router concrete (a confidence threshold + escalation
  step) rather than an abstract "route by fitness." It is also the single biggest
  cost lever in the whole system.

- **H-add-2 — Routing decisions must be eval-gated, and the canon agrees the
  default should be "frontier until proven."** Section 5 says routing is
  "eval-backed"; sharpen to: a cheaper/local route is only enabled for a task
  class *after* an eval shows parity on that class, and it auto-falls-back to
  frontier on low confidence. This prevents quality regressions from creeping in
  via cost optimization — the most common failure mode of model routing.

- **H-add-3 — Self-hosting's real near-term value is the bounded, high-volume,
  private task classes** (classification, tool selection, structured extraction,
  the cheap leg of a cascade), exactly as Section 4 says. The canon adds: these
  are also where small open models have closed the gap most, so the option is
  *more* live than it was a year ago — but the ops checklist (Section 6) is real
  and the "don't pretend the cheap server is free" warning is correct. No change
  needed; the framing is right.

- **H-add-4 — Structured-output reliability is provider-dependent.** Different
  providers/models support constrained decoding differently. Since the series
  relies on structured output for the apply action (121C) and protected-field
  translation (121D), add structured-output capability to the routing
  requirements (Section 5), so a route is never chosen that can't honor the
  agent's output contract.

Net: 121H is the most best-practice-aligned PRD in the series. The lens just
names the patterns it already implies (cascade, eval-gated routing,
structured-output capability as a routing constraint) so 121B can implement them
concretely.
