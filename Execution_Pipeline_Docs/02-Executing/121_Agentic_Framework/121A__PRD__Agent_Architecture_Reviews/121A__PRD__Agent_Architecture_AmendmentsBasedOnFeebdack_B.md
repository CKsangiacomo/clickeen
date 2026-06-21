# Recommendations based on peer reviews — 121A (Agent Architecture)

Source reviews: `_PR_A` (Revise/delete), `_PR_B` (Accept with edits), `_PR_C` (Pass, needs contract precision).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Ship four minimal typed contracts for Product Copilot: invocation envelope, context capsule (versioned + freshness), tool manifest, trace record.** Why: a `Status: EXECUTING` architecture PRD with zero typed shapes can't be implemented — every downstream PRD invents its own and drifts. Earn the status with real types.
2. **Implement those contracts by evolving the existing registry entries (`cs.widget.copilot.v1`, `widget.instance.translator`) and replacing the masquerade names (`turnClass`, `resolved_edit|multi_op_plan`, `editor_ops_only`-as-worldview) in place.** Why: pre-GA = no dual-track; PR_C is right that the existing registry is the seed, and PR_A is right that the fake-agent shapes must go. Reconcile both by replacing, not paralleling.
3. **Add the agent loop as a first-class rail: iteration model, observation handling, stop conditions, max-step ceiling, per-invocation budget.** Why: PR_B correctly flagged this — it's the *defining* agent mechanic, and both PR_A and PR_C omitted it. Without it "real agent" is undefined and 121C could ship another single-shot call labeled "agent."
4. **Define explicit failure behavior: missing/stale context, rejected tool route, unusable model output → fail-closed, trace-visible, policy-allowed fallback.** Why: PR_C correctly flagged it — a clean envelope that fails open is the dangerous failure mode.
5. **Clarify the invocation boundary crosses Bob UI *and* Roma (account/grant/route authority).** Why: PR_C correctly flagged that PR_A's Bob-vs-SF framing missed the Roma axis.
6. **Add eval as a first-class rail (trace→eval→improvement).** Why: so 121C/121G don't build a second capture path.

## My take on where the reviews split
- **Severity:** PR_A said revise-or-delete; PR_B/PR_C said salvageable. I now land in the middle: **salvageable if and only if it ships the typed contracts + loop + failure semantics above**; otherwise it remains a concept list.
- **Concretize-new (PR_A) vs evolve-existing (PR_C):** not actually in conflict under pre-GA — see recommendation 2.

## Decisions that are yours (product/scope)
- **"Child-agent invocation boundary" in the core rails:** I'd remove it (multi-agent is ~15× tokens per the research and not justified by any current task). Whether/when to build the workforce is yours.
- **Whether 121A deserves a standalone file vs folding into 121B/121C:** I'd keep it standalone but tight. Your call on doc structure.
- **§8's model classes (self-hosted/hybrid/classifier/judge):** I'd trim to the two wired providers + the provider-agnostic pattern. Whether to keep the option space visible for strategy is yours.

## Net
With recommendations 1–6, 121A stops being a concept list and becomes the minimal, typed, failure-aware contract set the first agent is built on — with the agent loop and eval as rails. The scope items above are where I hand back to you.