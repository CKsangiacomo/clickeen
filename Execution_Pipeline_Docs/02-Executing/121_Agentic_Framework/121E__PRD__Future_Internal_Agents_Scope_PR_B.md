# Peer Review B - 121E Future Internal Agents Scope

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121E__PRD__Future_Internal_Agents_Scope.md`, 121A, 121B, the 121
umbrella.

## Verdict

Accept as-is, with one trim. 121E is a guardrail document whose entire job is to
*prevent* future over-fitting — it stops the first architecture from assuming
every agent is a conversational Copilot. That is a legitimate and cheap thing to
write down. It commits nothing, builds nothing, and names no agents (correctly).
The only risk is that a guardrail PRD can itself become pre-work if it grows
beyond a one-page constraint. Keep it at exactly its current weight.

## 1. Elegant Engineering And Scalability

- **Section 3 ("What This PRD Protects") is the whole value:** the architecture
  must not assume every agent is conversational, has a chat UI, edits widgets,
  acts immediately, or shares one memory shape. This is the correct set of
  assumptions to forbid, and forbidding them now costs nothing while saving a
  later rework when the first non-Copilot agent (Translation, 121D) doesn't fit
  a Copilot-shaped mold.
- **It scales by subtraction, not addition** — it adds no surface, it removes a
  failure mode. That is the most efficient kind of guardrail.

## 2. Compliance To Architecture And Tenets

- **Fully compliant and self-aware.** Section 1 explicitly states it is "not a
  build-now list," "not a generic workforce platform," and "does not commit
  Clickeen to a set of named internal agents." This is the anti-fake-framework
  tenet (umbrella OQ10) applied to itself.
- **The internal-agent pattern (Section 2: owner, trigger, subject, input/output
  contract, allowed tools, review boundary, cost policy, trace) matches 121A's
  agent definition.** Consistent — it is the same contract slots, which is
  exactly right.

## 3. Over-Architecture / Unnecessary Complexity

- **None present, and that is the point.** The document's reason to exist is to
  block over-architecture in others.
- **The one watch-item:** do not let 121E accrete a roster of "candidate
  internal agents." The moment it lists named agents with sketched contracts, it
  becomes the speculative workforce catalog the umbrella explicitly rejects
  ("named only when a real product/workflow need is ready for its own PRD").
  Currently it does not do this. Keep it that way.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **No theory, no jargon, no pre-work.** It is a list of assumptions to avoid.
  Appropriately boring.
- **Mild redundancy with 121A** (the internal-agent pattern in Section 2 largely
  restates 121A Section 2). This is acceptable for a guardrail — restating the
  contract in the "future agents" context is a feature, not duplication — but if
  anything is trimmed, trim Section 2 to a pointer at 121A rather than a
  re-listing.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

Yes. It is the simplest possible artifact: a short list of things the first
architecture must not assume, so that focused non-conversational workers remain
buildable later without a rewrite. It moves toward the target by keeping the
target's optionality open. No edits required to ship it; the trims are
housekeeping.

## Suggested Edits (Optional)

1. Reduce Section 2 to a pointer at 121A's agent definition to avoid drift if
   the contract slots change.
2. Add one sentence forbidding 121E from ever accumulating a named-agent roster
   — its protection is structural, not a catalog.

---

## Addendum - Best-Practice / State-Of-The-Art Lens

Sourcing caveat: applied from the agentic-engineering canon current to ~Jan 2026
(see umbrella addendum). Live web pull was unavailable this session.

The lens affirms 121E. Two refinements:

- **E1 — Most "internal agents" will be workflows, and the guardrail should say
  so.** The canon's bias is workflows over agents for bounded, repeatable jobs.
  Section 3 already forbids assuming every agent is conversational; extend it to
  forbid assuming every internal worker needs an agent *loop* at all. Many will
  be single-call or prompt-chain workflows riding the same envelope. This keeps
  future builders from over-building agent machinery for cron-shaped jobs.

- **E2 — The shared rail that actually matters is the loop + trace + eval seam,
  not a "memory/context shape."** Section 3 worries about a shared memory shape
  (correctly). The canon says the real reusable infrastructure is the
  execution/trace/eval substrate; memory should stay agent-specific or absent.
  Affirms the PRD's instinct.

No change to the verdict: ship it as a thin structural guardrail.
