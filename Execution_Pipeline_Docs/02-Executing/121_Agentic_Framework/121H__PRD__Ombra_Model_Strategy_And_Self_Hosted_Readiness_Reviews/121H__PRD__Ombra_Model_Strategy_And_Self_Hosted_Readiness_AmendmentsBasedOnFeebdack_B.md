# Recommendations based on peer reviews — 121H (Ombra Model Strategy & Self-Hosted Readiness)

Source reviews: `_PR_A` (Approve w/ revisions), `_PR_B` (Accept as-is, one sentence), `_PR_C` (Pass; must not become self-hosted/router build now).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Trim §5 to policy-driven + per-task model selection, expressed as a cascade** (cheaper model first, escalate to frontier on low-confidence / high-stakes). Why: all three reviews align here; the OpenAI cookbook assigns a model per role (agent/analysis/judge/eval-gen), and the cascade is the single biggest cost lever.
2. **Reframe §3 so day-one = only the already-wired hosted providers; the other six classes are explicitly config-slots / future options, not adapters to build now.** Why: all three — §3 currently reads like a build list.
3. **Name extending the capability registry (structured-output, tool-call, `reasoningEffort` population) as the prerequisite that makes task-class routing possible.** Why: PR_A (and PR_B via H-add-4) — today the registry can't declare those capabilities, so routing-by-capability can't be implemented.
4. **Define fallback as explicit, policy-allowed, trace-visible, fail-closed — no silent downgrade to weaker/cheaper models, especially for high-risk user-facing answers; a model-route failure must not masquerade as full agent success.** Why: PR_C (V6) — silent downgrade violates product law.
5. **Add the widget-visitor-runtime guardrail locally:** published widget visitor runtime never calls Ombra / live model routes. Why: PR_C — even if the umbrella states it, repeat it where it's enforceable.
6. **Default routing rule = "frontier until an eval proves parity" for a task class** (cheaper/local route enabled only after an eval shows parity, with auto-fallback). Why: PR_B — the concrete gating rule behind "eval-backed routing."

## My take on where the reviews split
PR_B says "accept as-is" with one sentence; PR_A/PR_C want concrete revisions. I side with PR_A/PR_C on substance (trim the router, name the registry gap, fail-closed fallback) while keeping PR_B's point that §2's law and §6's operational honesty are correct and should stay.

## Decisions that are yours (product/scope)
- **Self-hosting / hybrid / tuning timing:** I'd keep deferred (an option, not a day-one dependency). Whether/when to pursue self-hosted inference is a strategic call — yours.
- **Eval-backed routing timing:** I'd defer "eval-backed" until 121G's evals exist (use the "frontier-until-proven" default meanwhile). Your call.
- **Prompt caching as a named cost primitive:** I'd add it. Your call.
- **§6's self-hosting operational checklist (serving/capacity/latency/drift/security):** I'd keep it as the "when you build it, include these" reference. Your call on visibility.

## Net
With 1–6, 121H keeps its correct law (provider-independence, task-fitness split, operational honesty) and becomes concrete: per-task cascade routing, capability-registry gap named, fail-closed fallback, widget-runtime guardrail. Self-hosting and eval-backed routing timing are yours.