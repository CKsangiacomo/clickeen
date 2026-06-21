# Peer Review A — 121H (Ombra Model Strategy And Self-Hosted Readiness)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121H__PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`
Date: 2026-06-20
Verdict: **APPROVE WITH REVISIONS (as a readiness guardrail).** The provider-independence principle is right and well-aligned with best practice — "models are execution dependencies, agents are product workers, Ombra not hardcoded to one provider," plus the §6 honesty that self-hosting is not free (serving/capacity/latency/drift/fallback/security) and should be decided by task fitness, not ideology. That balance is better than the umbrella's. Three gaps: it **enumerates 7 provider classes and a 9-factor router when 2 providers are wired**, **doesn't name the capability-registry gaps that block task-class routing**, and **references "eval-backed routing" before any eval exists**. Trim the pre-work and name the real dependencies.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 0. Code surfaces (grounding, verified earlier this session)

| Surface | Verified reality | 121H claim |
|---|---|---|
| Providers — `grants.ts` `AI_PROVIDER_SET` | Hardcoded `{deepseek, openai}`; Anthropic/Gemini/Groq/Workers-AI **absent from code** | §3 enumerates 7 provider classes as if a fleet |
| Capability registry — `ck-contracts/ai.ts` `AI_MODEL_CAPABILITIES` | `tokenParam` + `supportsTemperature` only; `reasoningEffort` typed but **unpopulated**; **no structured-output/tool-call capability** | §5 "route by task class / quality evals" — **can't be expressed today** |
| Routing — `sanfrancisco/src/ai/modelRouter.ts` | Pure grant-policy lookup; no task-class/failover/capability routing | §5 9-factor router — **richer than shipped** |
| Adding a provider | Requires `AiProvider` union change + registry update + new adapter + dispatch branch — **not a config flip** | §7 "add provider classes without rewriting agents" — true for agents, but adding a provider is a typed contract change |

---

## 1. Elegant engineering and scalability — GOOD INTENT

"Models are execution dependencies; Ombra provider-independent; add providers without rewriting agents" is the right scalable posture and matches the research's provider-agnostic + "cheapest model that passes evals" principle. §4's split (self-hosted/Clickeen-hosted for bounded/classification/structured tasks; hosted frontier for conversation/planning/long-context/high-taste) maps directly onto the research's Haiku-for-easy / Sonnet-for-hard routing. §7's per-agent route (Product Copilot vs Translation can differ without changing product contracts) is already true in the shipped policy matrix.

## 2. Compliance to architecture and tenets — STRONG

- §2 "models are execution dependencies; Ombra not hardcoded to one provider/model family/hosting model" — correct, tenet-aligned.
- §6 "do not pretend self-hosting is free because the server is cheap" + "do not reject self-hosting because frontier companies exist; decide by task fitness" — the realistic, non-ideological treatment the umbrella's §3.4 lacked. This is the best paragraph in the 121 series on self-hosting.
- §6's 12-item operational list (serving runtime, capacity, latency, monitoring, fallback, release testing, evals, security, cost model, upgrade path) is exactly the right "when you build it, include these" checklist.

## 3. Overarchitecture / unnecessary complexity — MODERATE (PRE-WORK)

- **§3 enumerates 7 provider classes** (frontier, low-cost, specialized, self-hosted, hybrid, judge, fallback) when 2 are wired. Enumerating the option space is defensible for a *readiness* guardrail, but it reads as a fleet plan.
- **§5 specifies a 9-factor router** (agent id, task class, context size, privacy, cost, latency, quality evals, fallback, provider availability, self-hosted capacity). The research frames routing as a **simple classifier → cheaper/stronger model**. A 9-factor router before a 3rd provider or any eval exists is pre-work. **Trim to policy-lookup + simple task-class split; defer the rest.**

## 3b. Academic abstraction / pre-work / gold-plating — MODERATE

The 9-factor router (§5), 7 provider classes (§3), and 12-item self-hosting ops list (§6) all design a system that doesn't exist yet. §6 is acceptable as a deferred checklist; §3/§5 are gold-plating the routing plane. §1's "does not require self-hosted inference on day one" is the right intent — the doc should lean harder into "preserve optionality" and less into "specify the multi-factor router."

## 4. Simple, boring, toward goals — GOOD, IF TRIMMED

The boring, correct version: keep the shipped policy-driven provider-agnostic pattern; close the capability-registry gaps so task-class routing is *possible*; defer self-hosting and the elaborate router until a real task forces it. 121H as written over-specifies the routing relative to that boring path.

---

## Omissions & blast radius

### A. Two-provider reality not stated honestly.
§3 lists 7 classes; code has 2. §7 "add provider classes without rewriting agents" is true for *agents* but adding a provider is a typed contract change (`AiProvider` union + registry + adapter + dispatch), not a config flip. **Fix:** state the real cost of adding a provider so the "provider-independent" claim isn't read as "add providers freely."

### B. Capability-registry gaps block the routing vision (unnamed dependency).
§5 "route by task class / quality evals" requires the model capability registry to declare structured-output/tool-call/`reasoningEffort` support. Verified: `reasoningEffort` is unpopulated and there are no structured-output/tool-call capability fields. **Blast radius:** task-class routing can't be implemented until the capability registry is extended — 121H doesn't name this. **Fix:** make "extend the capability registry (structured-output, tool-call, reasoningEffort)" a named prerequisite.

### C. "Eval-backed routing" referenced before evals exist.
§5 "quality evals" + §7 "model routing is eval-backed and task-based" — but no eval suite exists (per 121C/121G). Same gate-with-no-gate issue as 121G. **Fix:** defer "eval-backed routing" until 121G/121C evals exist; until then routing is policy + simple task-class.

### D. Prompt caching / cost primitives unmentioned.
The research lists prompt caching as a core cost lever. 121H's cost mentions (§5 "cost," §6 "cost model") don't name caching or the cascade/routing-to-cheaper-model pattern as concrete cost tools. Minor, but for a "model strategy" PRD, caching is a notable omission.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V4 Fail-open | Routing "fallback behavior" (§5) could mask a provider failure as a silent model swap | Open — define fallback as declared/recorded, not silent (umbrella Revision A.1) |
| V7 Masquerade | "Provider-independent / multi-class" presented as capability when 2 providers are wired and adding one is a contract change | Open — Omissions-A |
| V3 Silent omission | "Eval-backed routing" with no eval | Open — Omissions-C |

---

## Required revisions

1. **Trim §5** to policy-lookup + simple task-class routing; defer the 9-factor router. (§3/§3b)
2. **State the real cost of adding a provider** (typed contract change + adapter), so "provider-independent" isn't misread. (Omissions-A)
3. **Name the capability-registry extension** (structured-output, tool-call, `reasoningEffort`) as the prerequisite for task-class routing. (Omissions-B)
4. **Defer "eval-backed routing"** until 121G/121C evals exist. (Omissions-C)
5. **Define routing fallback as declared and recorded**, never a silent model swap. (V4)
6. **Scope `Status: EXECUTING`** to "keep routing provider-agnostic + close capability-registry gaps"; keep self-hosting and the multi-factor router explicitly deferred.

Principle is right and the §6 operational honesty is excellent; the fix is trimming pre-work and naming the real dependencies (capability registry, evals) that the routing vision rests on.

---

# Revision B — Pre-GA + eval-flywheel lens

Pre-GA freedom + OpenAI cookbook. Full lens in the umbrella's Revision B.

## What changes for 121H

**Pre-GA: the 2-provider reality is a non-issue — add providers as real tasks require.** No legacy lock-in to manage; "provider-independent" just means "don't hardcode the contract," which the shipped policy-driven router already satisfies. So §3's 7-class enumeration and §7's "add classes freely" can be cut to: "policy-driven routing; add a provider when a task needs it (typed contract + adapter)."

**The flywheel validates per-task model selection as the norm.** The OpenAI cookbook assigns different models per role (agent, analysis, eval-generation, judge, HALO-optimization) — exactly the "cheapest model that passes evals" principle in practice. So §5's 9-factor router should collapse to **per-task policy + a simple classifier→model mapping**, with the eval gate deciding fitness. "Eval-backed routing" (Omission-C) stops being aspirational once the eval flywheel (121G) exists — route by measured task fitness, per the cookbook's pattern.

## Revised bottom line
- Trim §3/§5 to policy-driven + per-task model selection (cookbook pattern); defer self-hosting.
- Capability-registry extension (structured-output/tool-call/`reasoningEffort`) still the unnamed prerequisite for task-class routing — name it.
- Route by eval-backed task fitness once 121G's flywheel exists; until then, policy + simple classifier.
- §6 operational honesty remains the best paragraph in the series — keep it.
