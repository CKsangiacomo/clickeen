# Recommendations based on peer reviews — 121 Umbrella

Source reviews: `_PR_A` (Architecture), `_PR_B` (Staff Engineering), `_PR_C` (Codex).
**These are my engineering recommendations with reasoning — not decisions. You are the product owner; what gets built, cut, sequenced, or deferred is your call. Nothing here is marked "out of scope" by me.**

## What I recommend (and why)

1. **Commit one loop-location for the interactive Product Copilot: the agent loop runs in Bob (client); San Francisco is the inference + policy + trace provider per step.** Why: the apply/read tools live in Bob's browser — SF literally cannot execute them, so a real tool-using loop cannot run in SF. Anthropic and OpenAI both define an agent as "LLM using tools in a loop," and the loop runs where its tools execute. This is an engineering fact, not a preference. (My PR_A pushed this; PR_B/PR_C were less committal — I'm holding the line.)
2. **Define agent-loop semantics (max-steps, stop conditions, per-turn token/cost budget) in the architecture, but ship Product Copilot v1 as single-pass capsule reasoning.** Why: single-pass is the simplest viable shape and the only one that fits the shipped free-tier budget (650 maxTokens / 8 turns). The loop *model* should exist so it can grow; v1 uses its simplest mode.
3. **Make eval the day-one spine, and own it in 121C — not 121G.** Why: replacing a shipped path with no regression gate means flying blind. All three reviews (and both Anthropic and OpenAI) treat evals as built *with* the agent, fed by traces. Seed ~20–50 tasks from the 120B earth-test prompts; capability + regression; deterministic + LLM-judge graders; pass@1/pass^k.
4. **Correct the envelope description (§7): the thing to kill is the regex-derived input `turnClass` (the matcher's pre-decision serialized into the request), not a "response envelope" that doesn't exist.** Why: an implementer could "delete the envelope" and leave the actual smell in place. Accuracy matters here.
5. **Add a supersession note vs 085/120 — keep/replace per decision, citing current runtime authority.** Why: without it the series re-litigates settled architecture (PR_B's strongest point).

## My take on where the reviews split
The one real disagreement is **loop-location / SF's role**. PR_B leans "SF orchestrates and runs the loop"; PR_C treats SF as where the brain grows. My position: SF can run a loop **only for durable/server-side agents** (Translation — tools are server-side). For the interactive copilot the loop is in Bob. That bimodal rule satisfies everyone and matches what 120 already decided.

## Decisions that are yours (product/scope)
- **North-star §3.4/§3.5 (learning moat, self-hosting, edge/log planes):** I'd lean toward relocating this to `WhyClickeen.md` — it pulls focus from the P0 and the research says "simplest solution possible." But whether and when to pursue the learning-moat vision is yours.
- **121E/F/G/H marked `Status: EXECUTING`:** I'd lean demote (they read as guardrails/foundations, not build commitments). Doc status and build scope are your call.
- **Rejected OQ options (e.g. OQ7 option-5 routing taxonomy):** I'd mark them deleted, not preserved as toggles. Your call.
- **Cutover/rollback for the live regex Copilot:** I'd hard-cut it (pre-GA, eval-gated). Your risk tolerance decides.

## Net
If you take the five recommendations, the umbrella becomes shorter and decisive: one topology, one loop model, evals in 121C, supersession explicit. The scope calls above are where I stop and hand back to you.