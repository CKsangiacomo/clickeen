# San Francisco + Agents Uplevel Plan (Policy-Driven Intelligence)

Status: Superseded. Legacy strategy doc; remaining work is captured in `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.
Source of truth: `documentation/`.

**File:** SF_AGENTS_UPLEVEL_PLAN.md  
**Status:** Draft for implementation via Codex  
**Audience:** Engineering / Architecture  
**Scope:** San Francisco (AI runtime), Paris (grants + policy authority), Bob/Minibob (copilot surfaces), Localization pipelines

---

## 0) Executive Summary
You are standardizing the product around a clear rule:

- **There will be many Agents**, but **only two Copilots**:
  1. **SDR Copilot** (acquisition, Minibob/public)
  2. **CS Copilot** (in-product success/support, Bob/auth)

Everything else that uses AI is an **Agent** (task executor) — localization, copywriting, ops monitoring, diagnostics, marketing automations, etc.

To make this scale and stay maintainable, you will implement a single, shared platform capability:

> **Policy-driven intelligence routing**: provider/model selection, token budgets, tool permissions, and quality controls are determined by entitlements and task class, not by ad-hoc agent code.

This directly enables:
- Curated Prague content translation: **OpenAI only, high-context, high-quality** (not literal translation)
- User instance translation: tiered intelligence
  - Free: **DeepSeek + low tokens**
  - Paid: **OpenAI or Anthropic (user choice) + higher tokens**
- Copilot differentiation:
  - Free: “SDR-grade” intelligence (cheap + limited)
  - Paid: CS Copilot unlocks better models + tools + budgets

This document explains what changes in **San Francisco**, what changes in **Paris grants**, and how to refactor the existing “agent sprawl” into a scalable system.

---

## 1) Repo Reality (What’s shipped today)
This section anchors the plan in current code, so the refactor is not theoretical.

### 1.1 San Francisco (Cloudflare Worker)
**Entrypoint:** `sanfrancisco/src/index.ts`  
Shipped `POST /v1/execute` routing is currently a hard-coded switch:
- `sdr.copilot`
- `sdr.widget.copilot.v1`
- `editor.faq.answer.v1`
- `debug.grantProbe`

SF verifies Paris-issued grants with `verifyGrant()` and requires grant payload `v===1` and prefix `v1.<payload>.<sig>`:
- `sanfrancisco/src/grants.ts` validates: prefix `v1`, payload fields, `v===1`, `iss==='paris'`, etc.

SF logs executions via:
- `SF_EVENTS` queue → raw payloads in R2 and indexes in D1
- D1 schema includes columns for `provider`, `model`, `promptVersion`, `policyVersion`, etc.

### 1.2 Paris (Cloudflare Worker)
**Entrypoint:** `paris/src/index.ts`  
Paris issues AI grants at `POST /api/ai/grant` but currently:
- Uses a **hard-coded allowlist**: `new Set(['sdr.copilot','sdr.widget.copilot.v1','debug.grantProbe'])`
- Always issues grant subject as `anon` (dev snapshot)
- Caps budgets server-side (`MAX_TOKENS_CAP=1200`, `TIMEOUT_MS_CAP=25000`, `MAX_REQUESTS_CAP=3`)
- Grant expiry is very short (`exp = now + 60` seconds)
- Grant format: `v1.<payloadB64>.<sigB64>` signed via HMAC (`AI_GRANT_HMAC_SECRET`)

### 1.3 Bob (Editor app)
Bob calls Paris to mint a grant, then executes on SF. Example route:
- `bob/app/api/ai/sdr-copilot/route.ts` (Edge runtime)
- Uses `agentId = 'sdr.widget.copilot.v1'`
- Calls SF `/v1/execute` with a `trace.client` value that is currently set to `'minibob'` in that route (should be `'bob'` for in-product).

### 1.4 Localization (current split)
Two distinct translation implementations exist in SF today:

1) **Prague system strings translation**
- `sanfrancisco/src/agents/l10nPragueStrings.ts`
- Uses OpenAI `POST https://api.openai.com/v1/responses`
- Enforces JSON schema output and logs to R2
- Exposed via `POST /v1/l10n/translate` but **local-only** per infra docs (ENVIRONMENT=local + PARIS_DEV_JWT)

2) **Instance localization**
- `sanfrancisco/src/agents/l10nInstance.ts`
- Translates widget instance translatable paths based on Tokyo allowlist (`/widgets/{widgetType}/localization.json`)
- Today it always calls **DeepSeek** (`deepseekTranslate(...)`) regardless of job kind (`curated|user`)
- Writes overlay ops back to Paris (`PUT /api/instances/:publicId/locales/:locale`) and logs to R2

---

## 2) The Target Product Model (Lingo + Semantics)
### 2.1 Definitions (must be consistent across code, docs, and naming)
- **Copilot**: interactive, conversational UX surface with low-latency constraints and consistent chat affordances.
  - Only: **SDR Copilot** and **CS Copilot**
- **Agent**: named AI capability that executes a task (interactive or async), often with tools and structured outputs.
- **Job**: an operational unit of work processed asynchronously (queues). A job is often executed by an agent.

Important: “Copilot vs Agent” is a **product taxonomy**. In code, both are executed as `agentId` via SF (that’s fine). The critical change is: copilots share a unified substrate and are not “one agent per widget.”

### 2.2 Intelligence is entitlement-driven
“Smartness” is a feature. Therefore:
- Provider choice, model, token budgets, and tool permissions are **computed from entitlements + task type**
- SF enforces what Paris grants allow
- Agents do not override policy by “choosing a model” directly

---

## 3) Core Invariants (non-negotiable)
1) **Paris is the product authority**: entitlements, tier, policy, instance data, and grant issuance.
2) **San Francisco is the AI runtime**: provider keys, model execution, strict structured outputs, tool enforcement, and observability.
3) **No silent provider switching**: provider selection must be explicit; failures are explicit errors.
4) **Tool execution is policy-gated**: tools are allowlisted per task and per tier.
5) **Traceability**: every execution yields a reproducible trace + usage metadata (for billing, learning, debugging).

---

## 4) What This Means for San Francisco (SF)
SF must evolve from “agent router + some provider calls” into an **AI control plane runtime**.

### 4.1 Add a Model Router (centralized)
Create a central module (e.g., `sanfrancisco/src/ai/modelRouter.ts`) that takes:
- `agentId`
- `taskClass` (defined in registry)
- `grant.ai` policy capsule (see §6)
- `trace.client` (minibob vs bob vs ops)
- runtime availability (keys present, provider outages)

…and returns:
- `provider`: `deepseek | openai | anthropic`
- `model`: string (per provider)
- `budgets`: maxTokens/timeoutMs/maxRequests (bounded by grant)
- `client`: `minibob|bob|ops`
- optional: `pricingTier` / `aiProfile` (for logs)

**Rule:** All LLM calls in SF must go through a single function that uses the router.

### 4.2 Extract provider clients (remove duplication)
Today, multiple agents implement their own “OpenAI-compatible chat call” wrappers.
Refactor into shared clients.

Recommended folder:
- `sanfrancisco/src/providers/deepseek.ts` (chat completions)
- `sanfrancisco/src/providers/openai.ts` (responses API for strict JSON schema; optionally chat completions too)
- `sanfrancisco/src/providers/anthropic.ts` (messages API)

Shared wrapper:
- `sanfrancisco/src/ai/callLLM.ts`  
  Input: `{provider, model, messages, schema?, maxTokens, timeoutMs, temperature, ...}`  
  Output: `{contentText, structuredJson?, usage}`

### 4.3 Introduce “task classes” and make them first-class
Agents should not be selected purely by `agentId` alone. Each agent must declare a `taskClass`, e.g.:
- `copilot.sdr.chat`
- `copilot.cs.editor`
- `l10n.curated.instance`
- `l10n.user.instance`
- `l10n.prague.systemStrings`
- `support.triage`
- `ops.monitoring`

Task class is what drives:
- provider routing defaults
- budgets
- tool allowlists
- required context injection
- output validation behavior

### 4.4 Replace hard-coded agent routing with an Agent Registry map
Replace the nested ternary routing in `sanfrancisco/src/index.ts` with a registry map (see §5).

This eliminates drift and makes it trivial to add agents without touching the entrypoint logic.

### 4.5 Deprecate widget-specific “FAQ agent” behavior
You have `editor.faq.answer.v1` routed in SF today, which violates the long-term design goal (“no agents dedicated to FAQ widget”).

Action:
- Remove `editor.faq.answer.v1` as a first-class agentId (or keep only as a temporary alias).
- Fold any useful logic into CS Copilot as:
  - a tool (“generate answer”, “rewrite question”, “create section”)
  - or a schema-driven transformation capability powered by widget `agent.md` contracts

This prevents a future explosion of “agent per widget.”

### 4.6 Make localization “smart” by injecting context
Today, instance localization collects allowlisted entries and sends them as an array. That’s good, but to avoid literal translations you must:
- translate in *blocks* with context (section headings + neighboring strings)
- supply locale-specific tone instructions
- supply a glossary and “do not translate” rules
- preserve richtext tags exactly (already present)

Add to instance localization prompt:
- widgetType + conceptual domain (FAQ vs testimonials vs feed)
- style profile for locale (Italian should read natural, marketing-appropriate, not literal)
- allowlist entry type metadata (string vs richtext)

For curated instances specifically:
- add an optional “quality pass” (second model call) when budgets permit

---

## 5) Agent Registry (Single Source of Truth)
### 5.1 Registry format
Create a single registry file that both Paris and SF can use. Two options:
- **JSON config**: `config/ai/agent-registry.json`
- **TS module**: `packages/ai-registry/src/registry.ts` (preferred long-term)

Recommended schema (conceptual):

```ts
type AgentCategory = 'copilot' | 'agent';
type TaskClass =
  | 'copilot.sdr.chat'
  | 'copilot.cs.editor'
  | 'l10n.prague.systemStrings'
  | 'l10n.instance'
  | 'support.triage'
  | 'ops.monitor'
  | string;

type Provider = 'deepseek' | 'openai' | 'anthropic';

type AgentRegistryEntry = {
  agentId: string;              // wire ID used in SF /v1/execute
  category: AgentCategory;      // copilot vs agent
  taskClass: TaskClass;
  description: string;

  // Capability gates (Paris uses these to decide if it can issue a grant)
  requiredEntitlements?: string[];   // e.g. ['ai.cs.enabled']

  // Provider policy
  defaultProviders: Provider[];      // ordered preference list
  allowProviderChoice?: boolean;     // if paid users can pick OpenAI vs Anthropic

  // Default budgets by tier/profile
  budgetsByProfile: Record<string, { maxTokens: number; timeoutMs: number; maxRequests?: number }>;

  // Tool allowlist (future-proof)
  toolCaps?: string[];               // e.g. ['tool:readUrl', 'tool:searchDocs']
};
```

### 5.2 Registry entries (initial)
Start by declaring what exists today, but with your product taxonomy:

- `sdr.copilot`
  - category: `copilot`
  - taskClass: `copilot.sdr.chat`
  - provider default: deepseek
  - entitlements: none (always available)
- `sdr.widget.copilot.v1` (rename target: `cs.copilot.v1`)
  - category: `copilot`
  - taskClass: `copilot.cs.editor`
  - provider default: deepseek for free, better for paid
- `l10n.instance.v1` (currently executed via queue, not /v1/execute)
  - category: `agent`
  - taskClass: `l10n.instance`
- `l10n.prague.strings.v1`
  - category: `agent`
  - taskClass: `l10n.prague.systemStrings`
- `debug.grantProbe`
  - category: `agent`
  - taskClass: `ops.debug`

### 5.3 Agent ID aliasing (recommended for safe migration)
To rename `sdr.widget.copilot.v1` to `cs.copilot.v1` without breaking old callers:
- registry supports `aliases: string[]` or a separate alias map
- SF accepts either ID, but logs canonical ID
- Paris grants should mint caps for canonical IDs, but accept alias requests during migration window

---

## 6) AI Grants (Paris → SF) become “policy capsules”
Today, the grant carries:
- caps: [`agent:${agentId}`]
- budgets: maxTokens/timeoutMs/maxRequests
- mode: editor|ops
- trace

To implement tier-based intelligence, grants must additionally carry an **AI policy capsule** that SF can enforce without querying Paris.

### 6.1 Backward-compatible approach
SF currently requires grant payload `v===1` and prefix `v1`.
Therefore, keep `v: 1` and add optional fields (SF can validate them if present).

### 6.2 Extend grant shape (conceptual)
Add optional fields:

```ts
type AIGrantAiPolicy = {
  profile: 'free_low' | 'paid_standard' | 'paid_premium' | 'curated_premium' | 'byok';
  allowedProviders: Array<'deepseek' | 'openai' | 'anthropic'>;
  selectedProvider?: 'deepseek' | 'openai' | 'anthropic'; // user choice (if allowed)
  selectedModel?: string;          // optional, if you allow model override
  allowProviderChoice?: boolean;
  allowModelChoice?: boolean;

  // Optional quota/billing knobs
  tokenBudgetDay?: number;         // for translation quotas, etc.
  tokenBudgetMonth?: number;
};

type AIGrant = {
  v: 1;
  iss: 'paris';
  sub: { kind: 'anon'|'user'|'service'; ... };
  exp: number;
  caps: string[];
  budgets: { maxTokens: number; timeoutMs?: number; maxRequests?: number; maxCostUsd?: number; };
  mode: 'editor'|'ops';
  trace?: { sessionId?: string; instancePublicId?: string; envStage?: string; };
  ai?: AIGrantAiPolicy;
};
```

**Decision:** v1 uses `free_low`, `paid_standard`, `paid_premium`, `curated_premium` only. `byok` is deferred.

### 6.3 Tool caps in grants (future)
Eventually, grant caps should include more than `agent:*`:
- `tool:readUrl`
- `tool:searchDocs`
- `tool:refreshIntegration:instagram`
- etc.

This is how you enforce “free cannot run expensive tools” cleanly.

---

## 7) Entitlements & AI Policy Profiles
You will define **AI profiles** and map them to tiers and task classes.

### 7.1 The core rule matrix (high level)
#### Copilots
- **SDR Copilot**
  - default: DeepSeek
  - always available
- **CS Copilot**
  - free: DeepSeek + limited tokens + limited toolcaps
  - paid: OpenAI/Anthropic choice + higher tokens + richer toolcaps

#### Localization
- **Curated Prague instances (template library)**
  - OpenAI only
  - high-context, quality-first prompts
  - optional quality pass (second call) depending on budgets
- **User instance translation**
  - free: DeepSeek + tight budgets
  - paid: OpenAI/Anthropic choice + higher budgets
  - optional BYOK (user pays) to remove your token cost

### 7.2 Locked profiles (v1)
These values are intentionally conservative to control COGS early. Profile names are locked to avoid drift.

| Profile | Who | Providers | maxTokens | timeoutMs | Notes |
|---|---|---|---:|---:|---|
| `free_low` | Free users | deepseek | 220–400 | 15–20s | Minimal cost |
| `paid_standard` | Tier1/2 | deepseek + (openai or anthropic) | 600–1200 | 25–45s | Good quality |
| `paid_premium` | Tier3 | openai or anthropic | 1200–2500 | 45–60s | Best quality |
| `curated_premium` | Clickeen-owned curated | openai | 1500–3000 | 60s | Quality-first |
| `byok` | Customer-provided keys | openai/anthropic | “high” | 60s | Deferred (not in v1) |

### 7.3 Add entitlements keys (to `config/entitlements.matrix.json`)
Examples (names can be adjusted):
- `ai.sdr.enabled` (bool) — usually true for all
- `ai.cs.enabled` (bool) — false for free, true for paid
- `ai.providers.allowed` (enum list) — e.g. `[deepseek]` vs `[deepseek,openai,anthropic]`
- `ai.providerChoice.enabled` (bool) — allow paid users to pick openai vs anthropic
- `l10n.enabled` (bool) — already exists conceptually
- `l10n.tokens.day` (int) — per workspace token quota for user translation
- `l10n.providerChoice.enabled` (bool) — allow openai vs anthropic selection for translation
- `l10n.curated.provider` (enum) — forced `openai` for curated

Paris already uses tier to resolve policy (`workspaces.tier` is loaded). Extend that logic to compute the AI policy capsule.

---

## 8) Implementation Plan (Codex-ready)
This is the step-by-step sequence to implement without breaking everything.

### Phase A — Registry + plumbing cleanup (eliminate drift first)
**Goal:** One source of truth for agent IDs and budgets.

1) Create `config/ai/agent-registry.json` (or a TS package).
2) Update Paris `/api/ai/grant` to validate agentId via registry (remove `allowedAgentIds` Set).
3) Update SF `/v1/execute` routing to dispatch via registry map, not nested ternaries.
4) Add alias support for agentId renames (optional but recommended).

**Acceptance Criteria**
- Adding a new agent ID requires changing only the registry + implementing the handler.
- Paris and SF accept the same set of agent IDs.

### Phase B — Add AI policy capsule to grants
**Goal:** SF can enforce provider/model selection and budgets by tier/task without querying Paris.

1) Extend Paris grant payload to include `ai` policy capsule:
   - profile, allowed providers, provider choice, selected provider (if any)
2) Update SF grant verification to tolerate the new fields (keep `v===1`).
3) Update SF execution to pass the policy capsule to the model router.

**Acceptance Criteria**
- SF logs include policy profile (add to InteractionEvent if desired).
- Provider selection is deterministic for the same inputs.

### Phase C — Model Router + unified provider clients
**Goal:** All agents call one `callLLM()` entrypoint.

1) Implement `sanfrancisco/src/ai/modelRouter.ts` with explicit resolution rules.
2) Implement provider clients and unify usage parsing.
3) Replace direct provider calls in:
   - `sanfrancisco/src/agents/sdrCopilot.ts`
   - `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
   - `sanfrancisco/src/agents/l10nInstance.ts`
   - `sanfrancisco/src/agents/l10nPragueStrings.ts` (optional; already well-structured)

**Acceptance Criteria**
- No agent directly calls `fetch(...deepseek...)` or `fetch(...openai...)` except inside provider modules.
- All provider errors map to consistent typed errors.
- Usage metadata always returned.

### Phase D — Copilot productization (SDR vs CS)
**Goal:** enforce “two copilots” cleanly, not by duplicating code.

1) Decide on agent IDs:
   - Keep `sdr.copilot` (SDR Copilot)
   - Rename `sdr.widget.copilot.v1` → `cs.copilot.v1` (recommended) OR keep but treat as CS Copilot in registry
2) Update Bob to send `trace.client = 'bob'` (not minibob) and pass workspaceId.
3) Update Minibob/public to send `trace.client = 'minibob'`.

**Acceptance Criteria**
- SF learning logs can distinguish minibob vs bob traffic cleanly.
- CS Copilot entitlement gating is enforced via grants.

### Phase E — Localization: curated quality + tier-based user translation
**Goal:** curated translations are OpenAI/high-quality; user translations are tier-based and selectable.

1) Modify instance localization pipeline:
   - If job.kind == `curated` → force `ai.profile = curated_premium` and provider `openai`
   - If job.kind == `user` → derive `ai.profile` from workspace tier and allow provider choice if paid
2) Extend `L10nJob` to carry enough policy to avoid SF fetching workspace tier at runtime.
   - Recommended: Paris enqueues jobs with `ai` policy capsule already computed.
3) Update `sanfrancisco/src/agents/l10nInstance.ts`:
   - Use router + provider clients, not hard-coded DeepSeek
   - Improve prompts to include context (widgetType, richtext rules, tone)
   - Optional: add quality pass for curated (second call that checks fluency/consistency)

**Acceptance Criteria**
- Curated instance translation always uses OpenAI (or your “best provider”)
- User translation uses DeepSeek on free; OpenAI/Anthropic on paid if configured
- Translations preserve richtext tags and placeholders

### Phase F — Deprecate widget-specific agent IDs
**Goal:** stop the long-term maintenance hazard.

1) Remove `editor.faq.answer.v1` from SF execution route (or keep as internal alias behind CS Copilot tools).
2) If any UI still calls it, migrate UI to CS Copilot tool-based flow.
3) Add a “schema contract injection” pattern:
   - Use widget `tokyo/widgets/*/agent.md` content as authoritative constraints for CS Copilot.

**Acceptance Criteria**
- No “agent per widget” pattern remains in SF.
- Widget specialization comes from contracts/data, not new agent IDs.

---

## 9) Detailed Code Touchpoints (by repo path)
This section tells Codex exactly where to work.

### 9.1 San Francisco
**Files to modify / add**
- `sanfrancisco/src/index.ts`
  - replace hard-coded agent routing with registry dispatch
  - ensure `trace.client` is captured and logged
- `sanfrancisco/src/grants.ts`
  - keep `v===1` requirement, but allow optional `ai` field (no breaking)
- `sanfrancisco/src/types.ts`
  - extend `AIGrant` type with optional `ai?: ...`
  - (optional) extend `InteractionEvent` to record ai profile/provider selection explicitly
- Add:
  - `sanfrancisco/src/ai/modelRouter.ts`
  - `sanfrancisco/src/ai/callLLM.ts`
  - `sanfrancisco/src/providers/deepseek.ts`
  - `sanfrancisco/src/providers/openai.ts`
  - `sanfrancisco/src/providers/anthropic.ts`

**Agents to refactor**
- `sanfrancisco/src/agents/sdrCopilot.ts`
- `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
- `sanfrancisco/src/agents/l10nInstance.ts`
- `sanfrancisco/src/agents/l10nPragueStrings.ts` (optional — already strong)

### 9.2 Paris
**Files to modify / add**
- `paris/src/index.ts`
  - update `handleAiGrant`:
    - remove `allowedAgentIds` Set
    - validate agentId against registry
    - compute `ai` policy based on subject/workspace tier and agent taskClass
    - mint grant with `ai` policy capsule
    - optionally include correct `sub.kind` for workspace vs anon
- `config/ai/agent-registry.json` (new)

### 9.3 Bob / Minibob surfaces
**Files to modify**
- `bob/app/api/ai/sdr-copilot/route.ts`
  - set `trace.client` appropriately (`bob` for editor)
  - include `workspaceId` in grant request body (so Paris can compute tier/entitlements)
  - optionally include `selectedProvider` (if user picked OpenAI vs Anthropic)
- (UI) wherever CopilotPane provides payload
  - include workspaceId, instancePublicId, sessionId consistently
  - handle explicit “upgrade required” errors and show upsell

---

## 10) Observability & Billing (needed because “smartness is a product”)
Because tier-based intelligence is monetized, you must be able to measure and enforce it.

### 10.1 SF execution logs should include
- `ai.profile`
- `selectedProvider`
- `selectedModel`
- `usage.promptTokens`, `usage.completionTokens`, `usage.costUsd` (if computed)
- `taskClass`
- `trace.client`

SF already stores provider/model/latency in D1; add additional columns as needed:
- `aiProfile`
- `taskClass`
- `client` (minibob vs bob vs ops)

### 10.2 Quotas (translation tokens per day)
You will likely enforce quotas in Paris (policy authority), not SF, because quotas are a product entitlement.
Approach:
- Paris computes remaining quota and encodes a short “allowance” into grants/jobs (`tokenBudgetDayRemaining`).
- SF enforces the allowance (fails fast if the run would exceed the grant allowance).
- Paris logs usage and updates quota ledger asynchronously (later).

In the dev snapshot, you can start with “soft enforcement” (log-only) until billing ledger exists.

---

## 11) Security Considerations
1) **Provider keys remain only in SF** (or BYOK secrets are stored securely server-side and never returned to clients).
2) **Tool execution must be allowlisted** (SSRF / injection hardening). You already have SSRF guards in CS Copilot for single-page fetch; preserve and generalize as a tool.
3) **No client-specified budgets** beyond Paris caps. Paris already caps budgets; keep that invariant.

---

## 12) Rollout Strategy (safe + incremental)
1) Ship Registry + dispatch refactor (no behavior change)
2) Add `ai` policy capsule to grants (SF ignores if not present)
3) Turn on model router and migrate one agent at a time
4) Turn on tier rules for localization jobs first (clear ROI)
5) Turn on CS Copilot gating and paid provider choice

---

## 13) Codex Execution Notes (how to use this doc)
When you hand this plan to Codex, run it as a sequence of small PRs, not one massive change.

Recommended Codex prompt structure:
1) “Implement Phase A only; run typecheck; ensure endpoints still respond.”
2) “Implement Phase B; ensure old grants still verify; add tests.”
3) “Implement Phase C; refactor sdrCopilot first; then sdrWidgetCopilot; then l10nInstance.”
4) “Implement Phase E; add curated vs user logic + provider selection.”

---

## Appendix A — Quick “minimum viable registry” example (JSON)
```json
{
  "version": 1,
  "agents": [
    {
      "agentId": "sdr.copilot",
      "category": "copilot",
      "taskClass": "copilot.sdr.chat",
      "description": "SDR Copilot for Minibob/public chat",
      "defaultProviders": ["deepseek"],
      "allowProviderChoice": false,
      "budgetsByProfile": {
        "free_low": { "maxTokens": 280, "timeoutMs": 15000, "maxRequests": 1 },
        "paid_standard": { "maxTokens": 450, "timeoutMs": 20000, "maxRequests": 1 }
      }
    },
    {
      "agentId": "sdr.widget.copilot.v1",
      "category": "copilot",
      "taskClass": "copilot.cs.editor",
      "description": "CS Copilot for Bob editor (rename to cs.copilot.v1 later)",
      "defaultProviders": ["deepseek", "openai", "anthropic"],
      "allowProviderChoice": true,
      "requiredEntitlements": ["ai.cs.enabled"],
      "budgetsByProfile": {
        "free_low": { "maxTokens": 500, "timeoutMs": 20000, "maxRequests": 1 },
        "paid_standard": { "maxTokens": 900, "timeoutMs": 30000, "maxRequests": 2 },
        "paid_premium": { "maxTokens": 1600, "timeoutMs": 45000, "maxRequests": 2 }
      },
      "toolCaps": ["tool:readUrl"]
    },
    {
      "agentId": "l10n.instance.v1",
      "category": "agent",
      "taskClass": "l10n.instance",
      "description": "Localize widget instances by allowlist",
      "defaultProviders": ["deepseek", "openai", "anthropic"],
      "allowProviderChoice": true,
      "budgetsByProfile": {
        "free_low": { "maxTokens": 500, "timeoutMs": 20000, "maxRequests": 1 },
        "paid_standard": { "maxTokens": 1200, "timeoutMs": 30000, "maxRequests": 1 },
        "curated_premium": { "maxTokens": 2000, "timeoutMs": 60000, "maxRequests": 2 }
      }
    }
  ]
}
```

---

## Appendix B — What you should remove over time
- Hard-coded agent allowlists in Paris grant issuance
- Hard-coded agent routing in SF
- Widget-specific agent IDs (FAQ-only agents)
- Agent-local provider wrappers (duplicate DeepSeek/OpenAI code)
