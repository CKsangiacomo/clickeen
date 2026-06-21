# Recommendations based on peer reviews — 121D (Translation Agent)

Source reviews: `_PR_A` (Approve w/ revisions), `_PR_B` (Accept; reconcile 103 first), `_PR_C` (Pass conceptually; blocked for execution).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Switch the cited authority from 103B/103J to 105E** (keep 103 as historical background only). Why: PR_C correctly flagged — 105E is the current execution authority and explicitly supersedes 103 where they conflict. The PRD currently cites the wrong parent.
2. **Resolve the 103 reconciliation as a bounded keep/replace/wrap decision, stated in this PRD; prefer adapter-over-rebuild unless a concrete product gap forces redesign.** Why: PR_B correctly flagged — slice 1 ("reconcile 103") is the real work, and until it's done nobody knows if 121D is building or re-housing.
3. **Narrow the v1 first slice:** saved account-widget instance, canonical id `widget.instance.translator`, the existing endpoint surface, one target locale per request, exact-path validation. Why: PR_C correctly flagged — starting from a generic "artifact" overbuilds (glossary, review platform, multi-locale orchestration).
4. **Call v1 synchronous — drop the "durable" label; add a queue/DO only if a real fanout job proves it's needed.** Why: the executor is already synchronous and works; "durable" with no queue/DO scoped is a V7 masquerade. Simplest-first.
5. **Make uncertainty operational and deterministic** — enumerate terminal failures (missing path, extra path, empty output, malformed rich text, placeholder/marker mismatch, provider failure, contract mismatch) instead of a vague "ask-for-review" field. Why: PR_C correctly flagged — reviewers ignore an always-empty subjective field.
6. **Use structured/constrained output with protected fields as typed slots + deterministic post-validation that fails the artifact if any protected token changed.** Why: PR_B correctly flagged — this makes the load-bearing requirement ("protected structure cannot be silently translated/dropped") mechanically enforceable instead of aspirational.
7. **Add a translation eval** (protected-token integrity + schema preservation as deterministic graders, LLM-judge for meaning, pass@1/pass^k, seeded from the D9 29-locale gate). Why: translation is the canonical cheap-to-evaluate case and an ideal flywheel candidate.

## My take on where the reviews split
- **103's status:** PR_B treats it as an executed system to reconcile against; PR_C treats it as superseded by 105E. I side with PR_C on authority (cite 105E) and with PR_B on the reconciliation method (keep/replace/wrap, adapter-first).
- **Workflow vs agent:** PR_B argues Translation is likely a structured-output workflow, not an agent loop — cheaper and more testable. PR_A/PR_C accept the "agent" label. I think PR_B is right on the implementation shape.

## Decisions that are yours (product/scope)
- **Workflow-vs-agent positioning:** I'd implement v1 as a structured-output workflow and keep "Translation Agent" as the product name. Your call on positioning.
- **Multi-locale fanout in v1:** I'd scope v1 to single-target and defer fanout (with explicit partial-failure/per-locale semantics later). Your call on v1 locale scope.
- **Review/artifact store:** I'd auto-apply with trace + uncertainty for v1 (overlays are regenerable), no human-review gate yet. Your call on review policy.
- **Re-enabling the disabled Roma→SF→Tokyo path (currently a hardcoded 503):** I'd build the target path (pre-GA). Your call on sequencing.

## Net
With 1–7, 121D becomes a concrete, mechanically-enforced artifact worker on the existing substrate, with the right parent (105E), honest sync-v1 framing, and a real eval. Scope (workflow naming, fanout, review, path re-enable sequencing) is yours.