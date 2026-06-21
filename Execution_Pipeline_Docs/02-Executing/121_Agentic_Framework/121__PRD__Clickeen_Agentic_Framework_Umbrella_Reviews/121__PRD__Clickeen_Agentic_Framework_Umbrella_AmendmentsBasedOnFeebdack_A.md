# Amendments Based On Feedback A - 121 Clickeen Agentic Framework Umbrella

Source PRD: `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend the umbrella before it governs execution.

The thesis is correct and survives all three reviews:

- Clickeen does not have real agents today.
- The current Builder Copilot is masquerade behavior, not the target.
- Product Copilot is the first hard proof.
- San Francisco is useful runtime infrastructure today, not yet a full
  orchestrator/workforce platform.
- Product surfaces own product truth.
- Models/Ombra/provider strategy sit below agent contracts.

The amendment must make the umbrella less roadmap-like and more governing:
it should name what gets deleted/replaced, what child PRD owns each decision,
and what I recommend keeping out of P0 unless the Product Owner decides
otherwise.

## 2. Feedback Conflict Resolution

Resolved conflict: San Francisco callback channel.

PR_A initially framed the missing piece as an SF callback channel into product
surfaces. Its later revision and the other reviews converge on a better
decision: this is a loop-location question, not a callback-channel requirement.

Amendment:

- My recommendation is that Product Copilot V1 avoid an SF-to-Bob synchronous
  callback loop.
- Bob/client owns live in-memory draft tool execution and validation.
- San Francisco provides model inference, policy enforcement, model routing
  metadata, structured response handling, traces, and outcomes.
- Durable/server-side agents may later run server-side loops only when their
  tools are server-side and product-owned.

Resolved conflict: pre-GA cutover.

Pre-GA means Clickeen does not need compatibility with fake-agent behavior.

Amendment:

- Do not preserve the old regex/control-routing Copilot path as a legacy mode.
- Do not add a rollback plan that depends on keeping the fake brain alive.
- Require eval/test evidence for the hard cutover instead.

## 3. Recommended Amendments

1. Add a supersession ledger.

   I recommend that the umbrella say, decision by decision, what 121 keeps from, replaces,
   narrows, or supersedes in the 085 and 120 series. At minimum reconcile:

   - current San Francisco `/v1/execute`;
   - `/v1/outcome`;
   - telemetry/events;
   - grant verification;
   - current model routing;
   - current Copilot wire assumptions that encode fake-agent behavior.

2. Add a child-PRD authority table.

   My recommendation is that the umbrella not act as the implementation spec.
   It should map decisions:

   - 121A owns minimal shared agent contract rails.
   - 121B owns San Francisco execution/routing topology.
   - 121C owns Product Copilot behavior and turn contract.
   - 121D owns Translation workflow/system-agent behavior.
   - 121E/121F are guardrails only unless promoted later.
   - 121G owns trace/outcome/eval foundation.
   - 121H owns model/provider readiness guardrails.

3. State the interactive Product Copilot topology.

   Product Copilot V1:

   ```text
   Bob/Roma product surface -> San Francisco inference/policy/trace
   -> typed response/action -> Bob validation and reversible draft apply
   -> Roma save only through existing product path
   ```

   This must replace any implication that SF mutates product state or routes
   live Bob tools.

4. Promote evals to day one without creating a learning platform.

   The umbrella should require:

   ```text
   trace -> feedback -> evals -> gate -> reviewed improvement
   ```

   This is not autonomous learning. It is the acceptance gate for replacing the
   fake Copilot and for later improving prompts/tools/model routes.

5. Delete rejected options instead of preserving them as configurable futures.

   The umbrella should explicitly reject:

   - regex/control pre-routing;
   - old `turnClass` style pre-decisions;
   - Product Copilot as shared Copilot framework;
   - SF product mutation ownership;
   - child-agent routing in P0;
   - self-hosted model serving in P0;
   - global widget-network learning in P0.

6. Move north-star material out of the build path.

   Keep edge moat, global widget network, self-hosting, workforce OS, and large
   Ombra learning loops as strategic context or guardrails. I recommend they
   not read as numbered P0 implementation stages unless the Product Owner
   explicitly wants that sequence.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these to the umbrella's P0 execution path
unless the Product Owner explicitly decides they belong there:

- a San Francisco-to-Bob callback orchestration channel;
- multi-agent/child-agent routing as P0;
- workforce dashboard/platform machinery;
- self-hosted/Ombra serving work;
- global widget-network learning implementation;
- model-fitness taxonomies as build scope;
- a compatibility plan that keeps the fake Copilot brain alive.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat the umbrella as ready to
govern execution after it:

- names the current runtime spine being reused;
- names fake-agent behavior being deleted;
- delegates implementation decisions to child PRDs;
- makes day-one evals explicit;
- marks future-scope material as non-executing guardrail.
