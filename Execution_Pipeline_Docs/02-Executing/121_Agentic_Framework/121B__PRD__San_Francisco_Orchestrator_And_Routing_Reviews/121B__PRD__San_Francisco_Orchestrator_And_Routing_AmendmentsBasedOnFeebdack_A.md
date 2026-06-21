# Amendments Based On Feedback A - 121B San Francisco Orchestrator And Routing

Source PRD: `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend before execution.

The direction is right: San Francisco should route known agent executions, not
regex raw user intent. But V1 must be a narrow runner/router/trace layer over
current deployed primitives, not a new platform.

## 2. Feedback Conflict Resolution

Resolved conflict: broad orchestrator versus narrow runtime.

Use current runtime truth as the base:

- `/v1/execute`;
- `/v1/outcome`;
- Roma-grant-derived authorization;
- current model routing;
- telemetry/event capture.

Replace request/response shapes only where they preserve fake-agent assumptions.
Do not replace working policy/routing/trace primitives wholesale.

Resolved conflict: San Francisco tool routing for Product Copilot.

For interactive Product Copilot V1:

- Bob executes and validates live in-memory draft actions.
- San Francisco routes model calls and records traces.
- San Francisco does not call back into Bob to execute product tools.

Server-side durable agents may use server-side tools later if explicitly scoped.

## 3. Recommended Amendments

1. Rewrite the Product Copilot example.

   Remove language implying "SF routes tool calls" for live Builder editing.
   Replace with:

   ```text
   Bob sends governed context/action surface to SF
   SF validates grant/policy, selects model, returns typed response/action
   Bob validates and applies reversible draft edits
   Roma persists only through existing account/product routes
   ```

2. Define day-one San Francisco responsibilities.

   V1 responsibilities:

   - envelope validation;
   - caller-to-agent authorization from existing Roma grant path;
   - static typed agent config;
   - model routing;
   - structured result validation;
   - trace emission;
   - outcome attachment path through existing `/v1/outcome`.

3. Use canonical runtime truth.

   Amend the PRD to state:

   - Product Copilot canonical runtime id is currently
     `cs.widget.copilot.v1`;
   - `widget.instance.translator` exists but currently executes through the
     instance-translation endpoint surface, not generic `/v1/execute`;
   - moving Translation into `/v1/execute` requires an explicit later decision.

4. Define sanctioned routing versus banned routing.

   Banned:

   - brittle pre-agent regex/control intent routing;
   - raw user text choosing global product agent;
   - old `turnClass`/`resolvedTarget` pre-decisions.

   Sanctioned:

   - product surface names the agent;
   - model may classify intent inside its reasoning turn;
   - policy may route model/provider by task class once capability/eval support
     exists.

5. Scope tool routing.

   Tool routing applies only when:

   - tool is server-side/durable, or
   - tool is a product-owned governed route with explicit authority.

   Product mutations never become San Francisco-owned.

6. Define fallback behavior.

   Fallback must be:

   - explicit;
   - policy-allowed;
   - trace-visible;
   - fail-closed when not allowed.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these to the 121B V1 path unless the
Product Owner explicitly decides they belong there:

- new San Francisco-owned ACL;
- dynamic registry service;
- durable workflow engine;
- tool marketplace;
- child-agent router;
- SF product-mutation channel;
- SF-to-Bob live callback loop;
- eval-backed model-fitness platform in V1;
- broad "orchestrator" language implying ownership of product semantics or
  client-side state.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121B as executable after the
Product Copilot topology is explicit and the V1 responsibilities are limited to
validation, policy, model routing, typed result handling, trace, and outcome
capture.
