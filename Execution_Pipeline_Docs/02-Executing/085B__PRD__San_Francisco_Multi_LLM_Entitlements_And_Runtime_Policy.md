# PRD 085B - San Francisco Multi-LLM Entitlements And Runtime Policy

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines how Clickeen supports multiple LLMs without creating a second fake AI access system.

The clean chain is:

`account entitlements -> AgentRuntimePolicy -> signed grant -> San Francisco enforcement`

---

## 1. Product Goal

Clickeen needs to control:

- which agents an account can use
- which models/providers each agent may use
- whether a user can choose a model
- token limits
- turn limits
- cost limits
- timeouts
- tool permissions

This must come from real account entitlements and runtime policy, not route-local provider decisions or legacy access labels.

---

## 2. Surviving Product Owner

Account/product policy owns:

- what the customer bought
- AI limits and upsells
- account-level budget availability
- whether a specific account may use a specific agent capability

San Francisco owns:

- verifying the signed grant
- enforcing the runtime policy inside the grant
- executing the selected provider/model
- metering usage
- rejecting anything outside the envelope

San Francisco does not own:

- account plan truth
- billing product decisions
- upsell copy
- hidden access buckets

---

## 3. Runtime Boundary

The grant is the runtime boundary.

Every customer-facing AI execution must carry one signed `AgentRuntimePolicy`.

The policy must include:

```ts
type AgentRuntimePolicy = {
  agentId: string;
  enabled: boolean;
  defaultModel: string;
  allowedModels: string[];
  allowedProviders: string[];
  allowModelPicker: boolean;
  selectedModel?: string;
  maxTokensPerCall: number;
  maxTurnsPerThread: number;
  monthlyTurns: number | null;
  maxCostUsd?: number;
  timeoutMs: number;
  tools?: string[];
  policyVersion: string;
};
```

If the selected model is outside the policy, San Francisco rejects the request.

If the provider/model is missing from the policy, San Francisco rejects the request.

If cost/token/turn limits are exceeded, San Francisco rejects or returns a typed limit result.

---

## 4. Approach

### 4.1 Delete The Legacy Access Mapping

Legacy access labels must not survive as product language or route behavior.

Replace them with direct runtime policy.

There should be no second AI access concept between account entitlements and the grant.

### 4.2 Central Runtime Policy Matrix

Define one central policy matrix that maps:

- account entitlements
- agent ID
- optional account overrides

to:

- allowed models
- allowed providers
- default model
- model-picker permission
- token ceilings
- turn ceilings
- cost ceiling
- timeout
- tool permissions

The matrix may live in contracts/config, but customer entitlement truth remains outside San Francisco.

### 4.3 Model Switching

Model switching is a policy rollout.

Steps:

1. Update central policy matrix.
2. Run golden examples for the affected agent.
3. Validate structured output.
4. Compare invalid-output rate, latency, cost, and quality.
5. Canary by deterministic account/request hash.
6. Promote by entitlement cohort.
7. Roll back by restoring the prior policy version.

No Roma route, Bob component, widget file, or Prague surface should need code changes for normal model switching.

### 4.4 Fallback

Fallback is disabled by default for customer-facing agents.

Allowed:

- retry transient failures inside the same grant-allowed provider/model envelope
- explicit fallback inside the grant when product policy allows it

Not allowed:

- silently crossing quality/cost classes
- silently changing provider/model outside the grant
- changing product truth to hide an AI failure

Internal workforce jobs may allow broader fallback if explicitly declared in their internal runtime policy.

---

## 5. Deletion Targets

- Legacy AI access labels as product language.
- Route-local provider/model choice.
- Hidden provider fallback.
- Temporary edit-budget multipliers.
- Any grant verifier behavior that accepts model/provider outside the signed policy.
- Any docs that describe a second AI access layer.

---

## 6. Blast Radius

Likely code areas:

- `packages/ck-contracts/src/ai.ts`
- `sanfrancisco/src/grants.ts`
- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/agents/*`
- Roma grant issuance / copilot caller code
- account policy/entitlement read paths if runtime policy is minted there

Potential caller checks:

- Roma Builder copilot
- account-widget localization generation
- internal San Francisco jobs

No widget instance storage, Tokyo asset storage, or localization overlay storage should change.

---

## 7. Why This Is World-Class SaaS

Best-practice SaaS separates:

- commercial entitlement truth
- request-level permission
- execution enforcement
- usage metering

This lets the business sell different AI capabilities without scattering model/provider logic across the app.

It also makes vendor changes safe: eval, canary, promote, rollback.

---

## 8. Why This Is Right For Clickeen

Clickeen is built to be AI-native and global. The model market will change constantly.

This design lets Clickeen:

- use the best model for each agent
- control cost per account
- expose model choice only when the product allows it
- avoid fake AI access systems
- switch providers without touching product surfaces

San Francisco remains the executor, not the billing brain.

---

## 9. Execution Readiness Checklist

Before execution:

- Decide canonical `AgentRuntimePolicy`.
- Decide where runtime policy is minted.
- Decide model-picker rules.
- Decide fallback rules per agent.
- Decide policy versioning.

Execution is green only when:

- legacy access mapping is deleted or inert
- grants carry direct runtime policy
- San Francisco rejects provider/model outside policy
- temporary multipliers are deleted or moved into named policy
- tests prove rejection behavior
- docs describe entitlements + runtime policy only

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- Roma caller checks if grant shape changes
- tests for allowed provider/model
- tests for rejected provider/model
- tests for selected model without picker permission
- `rg` residue checks for legacy access labels
- git-based Cloudflare deploy after implementation
- smoke test: Builder copilot execution under expected runtime policy
