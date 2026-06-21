# Amendments Based On Feedback A - 121A Agent Architecture

Source PRD: `121A__PRD__Agent_Architecture.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend heavily before execution.

The principles are right, but my recommendation is to narrow the PRD into a
thin, minimal contract rail ratified by Product Copilot rather than treating it
as a standalone agent framework spec.

Pre-GA makes this sharper: there is no reason to preserve old Copilot contract
shapes or to create dual old/new architecture paths.

## 2. Feedback Conflict Resolution

Resolved conflict: concretize, demote, or keep.

My recommendation is to keep 121A if it defines the minimum concrete rails
needed by 121C and 121D. If it cannot stay that thin, I recommend demoting or
folding it into the child PRDs.

Resolved conflict: agent loop versus Product Copilot V1 topology.

121A should define loop semantics as an architectural concept, but I recommend
that it not force Product Copilot V1 into an SF-hosted live product tool loop. For Product
Copilot, Bob/client owns live draft tool execution. For server-side workers,
future loops may run server-side when their tools are server-side.

## 3. Recommended Amendments

1. Add an extraction rule.

   Shared architecture is created only when a real agent/workflow needs it.
   My recommendation is that 121A not be treated as authorization for a
   universal agent framework.

2. Define the minimum day-one agent contract.

   Required fields:

   - canonical agent id;
   - owner/product surface;
   - invocation envelope;
   - context capsule reference/version;
   - allowed capability/tool manifest;
   - model-policy reference;
   - structured output schema;
   - trace id and trace fields;
   - product validation result;
   - explicit failure semantics.

3. Add first-class loop semantics without overcommitting topology.

   Define:

   - iteration model;
   - observation/tool-result handling;
   - stop condition;
   - max steps;
   - token/cost budget;
   - behavior at step/budget ceiling.

   Then state Product Copilot V1 may implement this as a bounded client-owned
   loop or a single SF reasoning turn with bounded validation retry, as decided
   by 121B/121C.

4. Reframe context as thin orientation plus just-in-time fetch seams.

   My recommendation is that context not become a fat dump. Amend the PRD to
   require:

   - small orientation capsule;
   - explicit unavailable markers;
   - context version/staleness marker;
   - optional product-owned context fetch tools/seams where needed;
   - visible failure on missing/stale/invalid context.

5. Treat current registry/policy as seed evidence only.

   Current ids and policy wiring matter:

   - `cs.widget.copilot.v1`;
   - `widget.instance.translator`.

   But they are not proof that the current Copilot is real. If current names or
   contract fields encode fake-agent behavior, the executing slice may replace
   them.

6. Add eval as an architecture rail.

   Trace records must feed evals from the first real agent. Do not create a
   second eval capture path later.

7. Make failure behavior explicit.

   Missing context, stale context, unavailable tools, unavailable providers,
   malformed model output, disallowed fallback, and product validation failure
   must fail visibly. No substitution, no silent repair, no success claim.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these to the 121A execution path unless the
Product Owner explicitly decides they belong there:

- universal agent framework;
- central tool registry;
- child-agent boundary in P0;
- generic outcome subsystem;
- self-hosted/hybrid model taxonomy;
- multi-agent handoff machinery;
- dual old/new Copilot contracts;
- compatibility shims preserving regex/control masquerade.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121A as ready to govern
execution if it is small enough that 121C can ratify it by using it. I recommend
removing or explicitly labeling any contract not exercised by Product Copilot or
Translation in the first slices.
