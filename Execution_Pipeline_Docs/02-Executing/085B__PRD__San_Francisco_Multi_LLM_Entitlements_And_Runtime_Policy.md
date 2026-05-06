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
type AiModelRef = {
  provider: string;
  model: string;
};

type AiModelOption = AiModelRef & {
  optionId: string;
  label: string;
};

type AiProviderModelPolicy = {
  defaultModel: string;
  allowed: string[];
};

type AgentRuntimePolicy = {
  agentId: string;
  enabled: boolean;
  defaultModel: AiModelRef;
  modelsByProvider: Record<string, AiProviderModelPolicy>;
  // Derived product UI list. This must be generated from modelsByProvider
  // and must not become separate enforcement truth.
  allowedModelOptions: AiModelOption[];
  allowModelPicker: boolean;
  selectedModel?: AiModelRef;
  maxTokensPerCall: number;
  maxTurnsPerThread: number;
  maxMonthlyTurns: number | null;
  maxCostUsd?: number;
  timeoutMs: number;
  // Reserved for a later tool-using agent. Do not build tool-permission
  // infrastructure in this PRD unless a live agent execution path needs it.
  tools?: string[];
  policyVersion: string;
};
```

`maxMonthlyTurns` is a ceiling, not a live counter.

Live monthly usage state changes with every request and must stay with the account/entitlement authority. It must not be embedded as "turns remaining" inside a signed per-request grant.

If the selected model is outside the policy, San Francisco rejects the request.

If the provider/model is missing from the policy, San Francisco rejects the request.

If cost/token/turn limits are exceeded, San Francisco rejects or returns a typed limit result.

The catalog keeps provider and model separate because enforcement, cost, credentials, and evals need that precision.

The signed runtime policy must preserve per-provider model policy. A flat model list is not enough because `gpt-5.5-mini` belongs to OpenAI, not DeepSeek, and each provider can have its own default.

The product UI does not expose that complexity. Tier 2 and Tier 3 users see one simple dropdown with combined model choices, for example:

- `GPT 5.5 Mini`
- `GPT 5.5 High`
- `Claude 4.6 Sonnet`

Those labels are disclosure labels from the catalog/policy. The dropdown must only include models the account is allowed to use for the current agent.

Execution truth and UI truth are related but not the same:

- `modelsByProvider` is the enforcement truth San Francisco verifies.
- `allowedModelOptions` is the derived one-dropdown UI list Roma/Bob renders.
- `selectedModel` must include both provider and model.

---

## 4. Approach

### 4.1 Delete The Legacy Access Mapping

Legacy access labels must not survive as product language or route behavior.

Replace them with direct runtime policy.

There should be no second AI access concept between account entitlements and the grant.

Keep the good shape of the current pure resolver: one function takes account tier, agent entry, and optional selected model, then returns the full signed runtime policy. The execution pass should improve and rename that resolver, not scatter model decisions into Roma routes or San Francisco executors.

Per-agent budget shape should also survive, but it must be keyed by real account policy tiers, not by `AiProfile` labels. Budgets are still a function of both:

- agent complexity
- account tier

What dies is the extra named layer `free_low | paid_standard | paid_premium | system_premium`.

### 4.2 Central Model Catalog And Runtime Policy Matrix

Define one central model catalog and one central runtime policy matrix.

Ownership decision:

- `packages/ck-contracts` owns the model catalog because it describes provider/model IDs, labels, and execution capabilities.
- `packages/ck-policy` owns the runtime policy matrix because it maps account tiers and agent IDs to allowed/default model options and limits.
- DevStudio reads those same sources. It must not create a separate AI admin truth.

The model catalog describes the models Clickeen knows how to use:

- provider
- model id
- product label
- status: active, deprecated, hidden
- cost class
- context window
- structured-output support
- notes needed for eval/ops

The runtime policy matrix maps:

- account entitlements
- agent ID

to:

- allowed model options
- default model
- model-picker permission
- token ceilings
- turn ceilings
- monthly turn ceiling
- cost ceiling
- timeout
- tool permissions

Customer entitlement truth remains outside San Francisco.

Account-specific overrides are out of scope for this PRD. The first execution must support tier + agent policy only. Enterprise/account overrides can be added later only if the product needs them and must not be pre-built here.

Live consumption is checked before grant issuance by the account/product owner and metered after execution. San Francisco enforces the signed ceiling for the request; it does not become the account usage ledger.

Monthly model updates must happen through the catalog/policy matrix, not through scattered route code or environment-variable defaults.

Normal update flow:

1. Add or deprecate models in the catalog.
2. Update allowed/default model options in the runtime policy matrix.
3. Run agent evals/smoke checks for affected agents.
4. Update DevStudio display from the same catalog/policy source.
5. Ship through the normal git -> Cloudflare path.

### 4.3 Model Switching

Model switching is a policy rollout.

In this PRD, model switching is a runbook and configuration discipline, not a new rollout platform.

Steps:

1. Update the central model catalog and runtime policy matrix.
2. Run golden examples for the affected agent.
3. Validate structured output.
4. Compare invalid-output rate, latency, cost, and quality.
5. Canary by deterministic account/request hash.
6. Promote by entitlement cohort.
7. Roll back by restoring the prior policy version.

No Roma route, Bob component, widget file, or Prague surface should need code changes for normal model switching.

Do not build a canary engine, promotion UI, account override service, or model rollout database in this PRD. The first pass is config-as-code plus verification.

### 4.4 Product Model Picker

Tier 2 and Tier 3 get a simple model picker for customer-facing AI where the product supports choice.

The picker is one dropdown. It does not expose separate provider and model controls.

Implementation rules:

- catalog keeps `provider` and `model` separate
- policy creates allowed dropdown options
- UI renders one option label per allowed model
- Roma validates the selected option before minting the grant
- San Francisco validates the selected provider/model from the signed runtime policy
- Free and Tier 1 stay locked to the product default unless product policy later enables choice
- user preference may be stored in account/user settings, but San Francisco does not own it

### 4.5 Model Failure Behavior

Hidden model fallback is disabled for customer-facing agents.

Plain meaning: if the selected model fails, the system must not secretly switch to another model.

Allowed:

- retry transient failures against the same selected provider/model
- return a typed chat error when that model is unavailable

Not allowed:

- silently crossing quality/cost classes
- silently changing provider/model outside the grant
- changing product truth to hide an AI failure

Customer-facing chat copy should be clear and simple, for example: `This model is unavailable. Try a different model.`

The UI may only let the user try models allowed by their account policy. If the user has no alternative allowed model, the UI shows the failure and does not offer unavailable models.

Internal workforce jobs may allow broader fallback only if explicitly declared in their internal runtime policy.

Execution classification must be explicit. Builder copilot is customer-facing and must be treated as customer-facing even if an old route currently calls it with `mode: 'ops'`. The execution pass must either set Builder copilot to `mode: 'editor'` or add an explicit runtime-policy field such as `customerFacing: true`. Hidden fallback must never depend on an ambiguous legacy mode value.

### 4.6 DevStudio Connection

DevStudio already has a Budgets/Entitlements page.

Current state:

- flags, caps, and budgets are editable from `packages/ck-policy/entitlements.matrix.json`
- `budget.copilot.turns` already lives there
- AI/LLM access is displayed, but it is read-only and wired to the legacy `AiProfile` layer

Execution of this PRD must connect DevStudio to the new source of truth:

- show the model catalog
- show allowed model options by tier and agent
- show the default option by tier and agent
- show whether the single model dropdown is enabled
- show Tier 2 and Tier 3 picker access for supported agents
- remove `AiProfile` wording from the page
- keep DevStudio as a view/editor over the same versioned config, not a separate admin truth
- do not add a live model-management database or admin-only AI truth in this pass

The existing budgets table remains the place to manage limits such as `budget.copilot.turns`, but budget display is not enough. Execution must verify that AI turn usage is actually consumed/enforced in the product path.

Current known gap: Roma can read `budget.copilot.turns` usage, but the product path must also reserve/consume a turn when a copilot request is accepted for execution. This must be fixed as part of execution. Otherwise DevStudio would display a SaaS budget that the product does not actually enforce.

Current known gap: Builder copilot has a hardcoded `devMultiplier = 5` in the execution layer. That is a hidden product limit multiplier outside account policy. It must be deleted or replaced by named runtime-policy limits.

Current known limitation: San Francisco's provider price table and per-grant budget cache are module-level Worker state. This is acceptable for pre-GA enforcement, but execution must leave comments or docs explaining that this is request-cost control, not durable billing truth. Do not build a dynamic pricing database in this PRD.

### 4.7 Language Policy Guard

This PRD does not add a new language-policy layer.

If runtime policy later needs language behavior, do not bury language detection inside an agent core file. Move it to a named utility or the widget/agent contract so San Francisco remains an AI executor and not a hidden locale-policy owner.

---

## 5. Deletion Targets

- Legacy AI access labels as product language.
- Route-local provider/model choice.
- Hidden model/provider fallback.
- Split provider/model picker UI.
- Temporary edit-budget multipliers.
- Hardcoded `devMultiplier` in Builder copilot.
- Any grant verifier behavior that accepts model/provider outside the signed policy.
- Any grant shape that carries live usage counters instead of policy ceilings.
- Any signed-grant or telemetry dependency on `AiProfile` / `aiProfile`.
- DevStudio AI access wired to `AiProfile`.
- Any docs that describe a second AI access layer.
- Any new account-override/model-rollout framework created before the tier + agent policy path is clean.

---

## 6. Blast Radius

Likely code areas:

- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/*`
- `sanfrancisco/src/grants.ts`
- `sanfrancisco/src/ai/chat.ts`
- `sanfrancisco/src/agents/*`
- `admin/src/main.ts`
- `admin/src/html/tools/entitlements.html`
- `admin/src/global.d.ts`
- Roma grant issuance / copilot caller code
- account policy/entitlement read paths if runtime policy is minted there
- Builder copilot execution limits in `sanfrancisco/src/agents/widgetCopilotCore.ts`
- San Francisco telemetry fields that currently index `aiProfile`
- inline language-detection helper code only if this PRD explicitly touches language behavior

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
- Runtime policy source split is decided: model catalog in `ck-contracts`, runtime policy matrix in `ck-policy`.
- Runtime policy is minted by the product/account boundary before San Francisco execution.
- Confirm `maxMonthlyTurns` is a ceiling and live usage state remains outside the grant.
- Per-provider model policy is decided as enforcement truth; one-dropdown model options are derived UI truth.
- Model-picker rule is decided: Tier 2 and Tier 3 get one combined LLM/model dropdown for supported customer-facing agents.
- Customer-facing fallback rule is decided: no hidden cross-model fallback; same-model retry only; then typed chat error.
- Builder copilot classification must be fixed: customer-facing editor execution cannot rely on legacy `mode: 'ops'`.
- Confirm DevStudio reads the same model catalog/runtime policy as production code.
- Confirm no account-specific override system, rollout engine, or live model-management database is built in this PRD.
- Decide policy versioning.

Execution is green only when:

- legacy access mapping is deleted or inert
- grants carry direct runtime policy
- grants do not carry live usage counters
- grants preserve per-provider model allowlists/defaults
- San Francisco rejects provider/model outside policy
- UI exposes one combined allowed-model dropdown, not split provider/model controls
- Builder copilot is classified as customer-facing and cannot use hidden cross-model fallback
- model failure shows a user-visible error instead of silent model switching
- DevStudio AI/LLM sections are wired to the new catalog/runtime policy, not `AiProfile`
- AI turn budgets are consumed/enforced, not only displayed
- Builder copilot `devMultiplier` is deleted or replaced by named runtime-policy limits
- no account override framework, canary engine, promotion UI, or model-management database is introduced
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
- tests for per-provider default/allowed model enforcement
- tests that customer-facing execution does not cross-switch to another model on model/provider failure
- tests or smoke coverage for AI turn consume/enforce behavior
- tests or smoke coverage that Builder copilot is customer-facing/editor-classified
- DevStudio smoke check for Tier 2/Tier 3 picker visibility from runtime policy
- `rg` residue checks for legacy access labels
- `rg` residue checks for `AiProfile`, `aiProfile`, `MODELS_BY_PROFILE`, `DEFAULT_PROVIDER_BY_PROFILE`, `devMultiplier`, split provider/model picker language, and hidden fallback copy
- git-based Cloudflare deploy after implementation
- smoke test: Builder copilot execution under expected runtime policy
