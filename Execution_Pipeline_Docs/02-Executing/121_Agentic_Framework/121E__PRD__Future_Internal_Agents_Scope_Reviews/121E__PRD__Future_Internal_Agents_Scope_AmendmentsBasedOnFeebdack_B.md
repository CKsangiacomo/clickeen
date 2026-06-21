# Recommendations based on peer reviews — 121E (Future Internal Agents Scope)

Source reviews: `_PR_A` (Approve as direction; demote/fold), `_PR_B` (Accept as-is, one trim), `_PR_C` (Pass as scope fence; no implementation tickets).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Keep §3's anti-overfitting list verbatim — it is the whole value of the doc** (don't assume every agent is conversational / a Copilot / chat-UI / widget-editing / immediate / shared-context).
2. **Tighten "same execution rails" to mean shared invocation/routing/trace/policy/version metadata only — explicitly NOT shared product logic, shared memory, or shared context shape.** Why: prevents the guardrail from quietly implying a shared brain.
3. **Add an admission gate for any future internal agent:** owner, trigger, subject, input/output, allowed tools, review/apply boundary, trace, cost/runtime policy — **plus a justification for why Product Copilot / Translation cannot own the job.** Why: PR_C correctly flagged this concrete filter; it stops speculative agents.
4. **Add an explicit "not implied" list:** no registry UI, workforce dashboard, agent catalog, generic memory layer, marketplace, or generic workflow platform. Why: PR_C — makes the fence enforceable.
5. **Add: don't assume every internal worker needs an agent loop — many will be single-call/prompt-chain workflows on the shared envelope.** Why: PR_B (E1) — avoids importing loop machinery where a workflow suffices.
6. **Forbid 121E from ever accreting a named-agent roster.** Why: PR_B — one sentence that keeps the doc from becoming a workforce catalog.

## My take on where the reviews split
Content is unanimous. The only split is **disposition**: PR_A would fold into 121A (pre-GA, less sprawl); PR_B/PR_C would keep it as a standalone thin guardrail. That's a doc-structure preference, not a content dispute.

## Decisions that are yours (product/scope)
- **Standalone file vs fold into 121A:** I'd fold (pre-GA, reduces process sprawl), but PR_B/PR_C prefer standalone. Your call on doc structure.
- **`Status: EXECUTING`:** I wouldn't mark a non-build guardrail as executing. Your call on status/scope.
- **The registry extension (durability/trigger/review fields) that would give §3 actual teeth:** I'd note it as the enforcement mechanism. Whether/when to extend the registry is yours.

## Net
Recommendations 1–6 make the guardrail concrete and enforceable without expanding scope. Whether it lives as its own file or a section in 121A is your call.