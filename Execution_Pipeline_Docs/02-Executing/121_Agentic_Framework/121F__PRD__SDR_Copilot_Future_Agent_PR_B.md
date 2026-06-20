# Peer Review B - 121F SDR Copilot Future Agent

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121F__PRD__SDR_Copilot_Future_Agent.md`, 121A, 121B, the 121 umbrella,
and the executed `027 Minibob SDR Agent PRD` it references.

## Verdict

Accept as-is. 121F is a separation guardrail: it exists so the first Product
Copilot build cannot quietly become "the agent" and force a future
sales/acquisition agent to inherit Builder assumptions. This is the highest-value
guardrail in the series because the failure it prevents — baking Bob/Roma
assumptions into the "general" agent architecture — is the single most common way
agent frameworks calcify. It builds nothing and commits nothing. Correct.

## 1. Elegant Engineering And Scalability

- **Section 4 ("Architecture Guardrail") is the engineering content and it is
  precise:** the first Product Copilot must not make "context" mean Builder
  context everywhere, "tool" mean widget edit everywhere, or "success" mean
  save/publish everywhere. These are the exact three places where a first agent's
  vocabulary leaks into the shared layer and traps the second agent. Naming them
  concretely (not "keep it general") is what makes this guardrail enforceable.
- **It scales the architecture by preventing premature generalization** from the
  Product Copilot's specifics — which is the same discipline 121A asks for,
  applied at the point of maximum temptation.

## 2. Compliance To Architecture And Tenets

- **Fully compliant.** Section 3 limits sharing to infrastructure only
  (execution envelope, provider adapters, trace, policy gates, tool-call
  transport, versioning) and explicitly states "that is not a shared Copilot
  framework." This is the umbrella's customer-facing-agent separation
  (085C/085D lineage) restated as a forward constraint.
- **"Two user-facing Copilots with different permissions/budget/metrics" from
  the umbrella: enforced here.** SDR Copilot must not inherit Product Copilot's
  account permissions — the document makes the data-boundary separation explicit
  (Section 2). Good.

## 3. Over-Architecture / Unnecessary Complexity

- **None.** The document is a constraint, not a construction. It correctly defers
  the actual SDR scope (Section 5) to "a future SDR Copilot execution PRD" and
  says "do not build this in the Product Copilot PRD." That is the right line.
- **The one thing to watch is in 121C, not here:** this guardrail is only real if
  121C's reviewer (and builder) actually checks that the Product Copilot's
  context/tool/success vocabulary is not promoted into 121A's shared layer. 121F
  should add a single forward-reference: **121C acceptance must include "no
  Builder-specific term leaked into the shared agent contract."** Make the
  guardrail testable at the point it can be violated.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **No theory, no jargon, no pre-work.** It does not design SDR Copilot — it
  fences it. The Section 5 scope list is a placeholder for a future PRD, not a
  design, which is the correct treatment of future work.
- **Appropriate length.** A separation guardrail should be one page; this is.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

Yes. It is a boring, cheap insurance policy against the most expensive
architectural mistake available to this series (over-fitting the shared layer to
the first agent). It moves toward the target by protecting the target's
two-Copilot shape. Ship as-is.

## Suggested Edit (Optional)

1. Add a forward-reference making the guardrail testable in 121C: Product
   Copilot acceptance should assert no Builder-specific vocabulary
   ("widget edit," "save/publish," "Builder context") appears in the shared
   agent contract that a future SDR Copilot would inherit.

---

## Addendum - Best-Practice / State-Of-The-Art Lens

Sourcing caveat: applied from the agentic-engineering canon current to ~Jan 2026
(see umbrella addendum). Live web pull was unavailable this session.

The lens strongly affirms 121F — separating two user-facing agents instead of
forcing a shared "Copilot framework" is exactly the canon's "small, focused
agents; don't build a framework" guidance, applied at the right seam. Two
additions:

- **F-add-1 — SDR Copilot's distinctness is mostly *context and tools*, which is
  the canon's real unit of agent identity.** *12-factor agents* frames an agent
  as a prompt + a context window + a tool set + a loop. Section 2's difference
  list (user, surface, context, tools, permissions, goals) is precisely that.
  Reinforce: what is shared is the *execution substrate* (loop runner, model
  adapters, trace); what is never shared is the prompt/context/tool triple. That
  is the correct, modern line — sharper than "infrastructure vs Copilot
  framework."

- **F-add-2 — SDR Copilot's risk model is different and the canon cares.** A
  public/funnel agent talking to prospects needs prompt-injection and
  data-exfiltration guardrails that an authenticated in-product Copilot does not.
  Section 5 lists "refusal/safety rules" — good; flag that untrusted-input
  hardening (treat prospect input as data, not instructions) is a first-class
  requirement for the future SDR PRD, not an afterthought.

No change to verdict: ship as-is.
