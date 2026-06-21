# Amendments Based On Feedback A - 121H Ombra Model Strategy And Self-Hosted Readiness

Source PRD: `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend as readiness guardrail.

Provider independence is right. Self-hosting remains a serious future option.
My recommendation is that 121H remain a readiness guardrail rather than becoming
a model-serving/router implementation PRD.

## 2. Feedback Conflict Resolution

Resolved conflict: preserve optionality versus trim router taxonomy.

Keep optionality, but narrow day-one scope. Additional provider classes are
future slots, not adapters to build now. The PRD should describe the contract
shape needed to add providers later, not enumerate a full routing platform.

## 3. Recommended Amendments

1. Define day-one scope.

   Day one is:

   - provider-independent route metadata;
   - existing grant/policy router shape;
   - narrow adapter boundary;
   - observable/versioned route decisions;
   - explicit fail-closed behavior.

2. Clarify what adding a provider means.

   Adding a provider is not config-only. It requires:

   - typed contract support;
   - registry/policy entry;
   - adapter implementation;
   - dispatch integration;
   - provider configuration and failure behavior;
   - trace-visible route metadata.

3. Name capability-registry dependencies.

   Task-class routing depends on capability metadata for:

   - structured output support;
   - tool-call support;
   - reasoning-effort/capability settings;
   - latency/cost limits where relevant;
   - privacy/data boundary compatibility.

4. Gate cheaper/local/self-hosted routes with evals.

   Frontier/hosted models remain default for broad or high-risk Product Copilot
   reasoning until cheaper/local/self-hosted routes pass concrete Clickeen task
   evals.

5. Define fallback behavior.

   Fallback must be:

   - policy-allowed;
   - trace-visible;
   - quality/privacy/policy safe;
   - fail-closed otherwise;
   - never a silent downgrade for high-risk user-facing answers.

6. Add published-widget runtime guardrail.

   Published widget visitor runtime must never call Ombra or live model routes.
   Widget network learning, if any, is async/future/governed.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these under 121H unless the Product Owner
explicitly decides they belong there:

- self-hosted runtime;
- serving stack;
- tuning pipeline;
- hybrid-chain runtime;
- broad benchmark program;
- provider marketplace;
- fallback trees;
- model-comparison dashboards;
- cost-optimization routes that bypass quality, privacy, policy, or structured
  output guarantees.

## 5. Recommended Human Decision Gate

My recommendation is that the Product Owner treat 121H as executable as
model/provider contract guardrail and readiness documentation. I recommend that
any self-hosted/Ombra serving implementation get its own PRD after concrete
agent task evals prove the need, unless the Product Owner chooses a different
sequence.
