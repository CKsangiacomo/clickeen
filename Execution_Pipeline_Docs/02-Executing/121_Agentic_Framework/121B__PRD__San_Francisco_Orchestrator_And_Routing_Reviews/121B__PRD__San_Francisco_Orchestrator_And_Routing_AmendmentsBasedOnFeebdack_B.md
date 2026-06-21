# Recommendations based on peer reviews — 121B (SF Orchestrator & Routing)

Source reviews: `_PR_A` (Approve w/ revisions), `_PR_B` (Accept, re-sequence), `_PR_C` (Pass; v1 = smallest extension).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Fix the §5 Product Copilot example: drop "SF routes tool calls" for the interactive case; state the loop runs in Bob and SF routes model calls + emits trace.** Why: 121C copies this example, and as written it implies SF drives tools whose execution lives in Bob's browser — which is impossible. This is the one blocking accuracy fix.
2. **State the bimodal loop rule: SF may run the loop for durable/server-side agents (Translation — server-side tools); interactive loops run in Bob.** Why: this resolves the real disagreement — PR_B wants SF to run the loop; my PR_A says the loop is in Bob. Both are right for different agent classes; the tools' location decides the loop's location.
3. **Caller→agent authorization must derive from the existing Roma grant, not a new SF-owned ACL.** Why: PR_B correctly flagged this — otherwise SF starts owning a permission model, which breaches the "SF doesn't own product truth" fence.
4. **Fallback must be loud, policy-allowed, trace-visible, and fail-closed — never a silent downgrade to a cheaper/weaker model.** Why: a silent model swap on a high-risk user-facing answer violates product law (and OWASP guidance).
5. **Anchor V1 to the deployed primitives** (`/v1/execute`, `/v1/outcome`, grant verification, model routing); state Translator is currently endpoint-surface and moving it is a separate decision. Why: PR_C correctly flagged — don't greenfield an orchestrator; extend what runs.
6. **Bless LLM intent classification *inside* the agent and model cascades; ban only brittle *pre-agent* regex routing.** Why: PR_B correctly flagged the over-correction — legitimate in-agent routing is not the regex sin we're killing.

## My take on where the reviews split
The "who runs the loop" tension (PR_B vs PR_A) is the only structural one, and recommendation 2 resolves it. PR_C's "smallest extension" and PR_B's "re-rank day-one vs seams" both push the same direction: SF's day-one output is **model routing + governed traces**, not tool/child-agent execution.

## Decisions that are yours (product/scope)
- **Six-factor model router (§4.2):** I'd trim to policy-lookup + simple task-class split. How rich routing should be is yours.
- **Tool-routing and child-agent routing as SF responsibilities:** I'd scope them to durable agents and defer child-agents until a second agent exists. Your call on workforce/orchestration scope.
- **Registry as static config vs service:** I'd keep it static (two entries) for now. Your call.

## Net
121B becomes a precise, smallest-extension orchestrator: one topology, model-routing + trace as the day-one outputs, fallback fail-closed, V1 anchored to the deployed spine. Scope richness (router, child-agents, registry-as-service) is yours to dial.