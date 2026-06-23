# Peer Review C - 121H Ombra Model Strategy And Self-Hosted Readiness

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`
Verdict: Pass as model-strategy guardrail; must not become self-hosted/model-router implementation now.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/ai/sanfrancisco.md`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`
- `sanfrancisco/src/ai/modelRouter.ts`
- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/l10n-account-routes.ts`

Verified runtime truth:

- Current model/provider policy already lives in `ck-contracts` and `ck-policy`.
- San Francisco's `resolveModelSelection` chooses provider/model from the signed
  grant, enforces allowed models, and rejects missing/disallowed policy.
- Provider configuration failures are explicit `PROVIDER_ERROR` responses.
- The current provider classes are concrete (`deepseek`, `openai`); self-hosted
  is not a current provider class in runtime.
- Translation runtime already checks provider configuration through the signed
  policy before reporting ready.

Second-pass correction: 121H must be an architecture-readiness guardrail over
the existing policy/router path. It should not create a parallel model router,
self-hosted provider abstraction, benchmark program, or hybrid-chain runtime
before a current agent PRD proves the need.

## 0b. Best-Practice Research Lens

Current agent-framework practice supports provider flexibility, but not provider
drama in the first agent slice. OpenAI and Google ADK both treat model choice as
an execution dependency below the agent contract. OWASP risk material adds the
important correction: fallbacks and model switches must not silently weaken
policy, leak data, or increase agency.

Best-practice alignment:

- Agents should be model-independent at the contract level. Product Copilot is
  Product Copilot whether the runtime uses OpenAI, DeepSeek, or a future Ombra
  route.
- Self-hosted models are plausible for bounded closed-system tasks, especially
  async or focused tasks, but they must be introduced through evals and explicit
  routing policy.
- Hosted frontier models remain the likely default for broad conversational
  Product Copilot reasoning until Clickeen proves a narrower model can do the
  job.

Required PRD tightening:

- Treat self-hosted/Ombra as a future provider class behind the existing
  grant/policy/model-router shape, not a second routing architecture.
- Require explicit fail-closed behavior for provider outage, missing policy, or
  disallowed model; no silent downgrade to weaker models.
- Defer benchmarks to concrete Clickeen tasks after 121C/121D define exact
  inputs, outputs, and success criteria.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA means Clickeen can change provider names, policy shape, and model routing
contracts before they become public commitments. It should use that freedom to
make Ombra/model strategy clean, not to build more model infrastructure early.

Pre-GA amendment:

- If the current provider/model policy shape cannot support stable agent
  contracts, replace it in the agent execution slice instead of carrying legacy
  adapter debt.
- Do not preserve provider-specific assumptions in agent contracts.
- Do not build self-hosted compatibility surfaces now. Keep the contract clean
  enough that a future self-hosted provider can fit behind it.
- Keep fail-closed behavior even pre-GA; no compatibility fallback should make
  an agent weaker or less governed.

The no-back-compat advantage is contractual clarity: agents depend on Clickeen
capabilities and model policy, not on any current external provider shape.

## 1. Elegant Engineering And Scalability

The PRD makes the right core decision:

```text
agents are product workers
models are execution dependencies
Ombra is provider-independent
```

That is scalable because Product Copilot, Translation Agent, SDR Copilot, and
future agents can keep stable product contracts while San Francisco/Ombra changes
model providers over time.

The self-hosted framing is also correct. Clickeen is not trying to build a
general frontier model. A Clickeen-hosted model is only interesting if it becomes
excellent at Clickeen-shaped tasks inside the closed, AI-legible system.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is compliant:

- no provider is hardcoded as product architecture;
- self-hosted is not day-one dependency;
- hosted frontier models remain valid for broad Product Copilot reasoning;
- focused/self-hosted routes remain possible for bounded tasks;
- model routes sit below agent contracts.

This supports the Clickeen law that product agents are stable workers and model
selection is runtime strategy, not product identity.

Additional product-law guardrail needed:

- Published widget visitor runtime must never call Ombra/live model routes.
  This belongs here even if the umbrella already states it.

## 3. Overarchitecture Or Unnecessary Complexity

The broad provider-class list can trigger premature infrastructure:

- hybrid chains;
- judge/classifier/summarizer lanes;
- fallback trees;
- self-hosted capacity planning;
- benchmark suites;
- tuning pipelines;
- model serving stack;
- provider marketplace.

The day-one requirement should be much smaller:

```text
provider-independent adapter boundary
model route metadata
policy-visible selection
explicit fail-closed fallback behavior
no agent hardcodes provider
```

## 3b. Academic / Meta-Work / Gold-Plating Risks

"Model strategy", "quality evals", and "self-hosted readiness" can easily turn
into research work before product proof.

Avoid:

- broad benchmark programs;
- synthetic eval suite sprawl;
- self-hosted proofs unrelated to current Clickeen tasks;
- model-comparison dashboards;
- speculative hybrid chains;
- optimizing for cost before Product Copilot quality is real.

Evals should be lightweight acceptance evidence for actual Clickeen tasks, not
a general model research program.

## 4. Why This Is Simple And Boring

The boring version is exactly what Clickeen needs:

1. Agents do not know provider details.
2. San Francisco/Ombra selects a provider by policy and task class.
3. Routing decisions are recorded.
4. Fallback is explicit and safe.
5. Self-hosted remains pluggable later.

That keeps Clickeen from rewriting agents when model strategy changes.

## 5. Required Corrections Before Execution

Required:

- State explicitly: no self-hosted runtime, model serving stack, tuning
  pipeline, benchmark suite, or hybrid-chain implementation in this PRD.
- Define minimum day-one requirement as provider-independent route metadata plus
  a narrow adapter boundary.
- Move hybrid chains, judge/classifier/summarizer models, and self-hosted
  capacity to future criteria unless a current agent PRD proves the need.
- Add hard guardrail that published widget visitor runtime never calls Ombra or
  live model routes.
- Clarify fallback behavior:
  - explicit;
  - policy-allowed;
  - trace-visible;
  - fail-closed when quality/privacy/policy cannot be satisfied;
  - no silent downgrade to cheaper/weaker models for high-risk user-facing
    answers.

## 6. V1-V8 Audit

- V1 Silent substitution: Watch. Provider fallback must not silently substitute
  a lower-quality model.
- V2 Silent healing: Pass. No product state repair is proposed.
- V3 Silent omission: Watch. Published widget runtime guardrail should be local
  to this PRD too.
- V4 Fail-open control: Watch. Fallback must fail closed unless explicitly
  policy-allowed.
- V5 Corruption-as-absence: Pass. No stored product state behavior is changed.
- V6 Partial-success masquerade: Watch. Model route failure cannot claim full
  agent success.
- V7 Masquerade/redress: Pass. Self-hosted is not presented as day-one AI magic.
- V8 Runtime test dependency: Pass.
