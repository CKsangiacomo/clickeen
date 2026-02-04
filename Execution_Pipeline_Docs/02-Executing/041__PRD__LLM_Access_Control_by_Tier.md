# PRD 41 — LLM Access Control by Tier

**Status:** EXECUTING  
**Date:** 2026-02-02  
**Executing:** 2026-02-03  
**Owner:** Product + Engineering  
**Type:** System enhancement (internal cost optimization + minor UX addition)  
**User-facing change:** Settings dropdown for AI provider/model selection (Tier1+ only)

---

## 0) Summary

Control which LLM providers and models users can access based on workspace tier. This is primarily a **cost optimization** mechanism with a small product benefit (paid users get model choice).

**Product impact:** Minimal — adds a "Copilot settings" dropdown for Tier1+ users.
**System impact:** Significant — enforces model access server-side to control unit economics.

---

## 1) Why we're doing this

### Problem
Currently, any tier can theoretically access any LLM (Claude Opus, o1, etc.) through Copilot. This creates two risks:
1. **Cost explosion**: Free users using $15/1M token models destroys margins
2. **No differentiation**: Paid tiers don't get better AI quality (only more turns via budgets)

### Solution
Tier-gate LLM access via server-side enforcement:
- Free tier → cheap models only (Amazon Nova, DeepSeek)
- Tier1 → mid-tier models + provider choice
- Tier2+ → premium models (GPT-4o, Claude Sonnet/Opus, o1)

**This is mostly a backend change.** The only user-facing addition is a settings dropdown.

---

## 2) How it works (system design)

### Architecture overview
```
Workspace tier (free/tier1/tier2/tier3)
    ↓
ck-policy resolves AiProfile (free_low | paid_standard | paid_premium)
    ↓
Paris issues AI grant with allowed providers + models
    ↓
San Francisco executor enforces grant (rejects unauthorized models)
    ↓
User gets response from tier-appropriate model
```

### Key principle
**Server-side enforcement only.** Clients never choose models directly — they request a grant from Paris, and San Francisco validates the grant before executing.

---

## 3) Implementation

### 3.1 Policy layer (ck-policy)

**File:** `tooling/ck-policy/src/ai.ts`

**Add AI profile configs:**
```typescript
interface AiProfileConfig {
  providers: {
    [provider: string]: {
      enabled: boolean;
      models: string[];        // Which models this tier can use
      defaultModel: string;    // Default if user doesn't choose
      displayName: string;     // UI label
    };
  };
  defaultProvider: string;
  perRequestLimits: {
    maxTokens: number;
    timeoutMs: number;
    maxRequests: number;
  };
}

const PROFILE_CONFIGS: Record<AiProfile, AiProfileConfig> = {
  free_low: {
    providers: {
      amazon: {
        enabled: true,
        models: ['nova-micro', 'nova-lite'],
        defaultModel: 'nova-lite',
        displayName: 'Amazon Nova',
      },
      deepseek: {
        enabled: true,
        models: ['deepseek-chat'],
        defaultModel: 'deepseek-chat',
        displayName: 'DeepSeek',
      },
    },
    defaultProvider: 'amazon',
    perRequestLimits: { maxTokens: 650, timeoutMs: 45000, maxRequests: 2 },
  },

  paid_standard: {
    providers: {
      amazon: {
        enabled: true,
        models: ['nova-lite', 'nova-pro'],
        defaultModel: 'nova-pro',
        displayName: 'Amazon Nova',
      },
      deepseek: {
        enabled: true,
        models: ['deepseek-chat', 'deepseek-reasoner'],
        defaultModel: 'deepseek-chat',
        displayName: 'DeepSeek',
      },
      llama: {
        enabled: true,
        models: ['llama-3.3-70b-versatile'],
        defaultModel: 'llama-3.3-70b-versatile',
        displayName: 'Llama 3.3 (Groq)',
        apiProvider: 'groq', // Use Groq for fast inference
      },
      openai: {
        enabled: true,
        models: ['gpt-4o-mini', 'gpt-4o'],
        defaultModel: 'gpt-4o-mini',
        displayName: 'OpenAI',
      },
      anthropic: {
        enabled: true,
        models: ['claude-3-5-haiku-20241022'],
        defaultModel: 'claude-3-5-haiku-20241022',
        displayName: 'Claude',
      },
    },
    defaultProvider: 'amazon',
    perRequestLimits: { maxTokens: 900, timeoutMs: 45000, maxRequests: 3 },
  },

  paid_premium: {
    providers: {
      amazon: {
        enabled: true,
        models: ['nova-lite', 'nova-pro', 'nova-premier'],
        defaultModel: 'nova-pro',
        displayName: 'Amazon Nova',
      },
      deepseek: {
        enabled: true,
        models: ['deepseek-chat', 'deepseek-reasoner'],
        defaultModel: 'deepseek-reasoner',
        displayName: 'DeepSeek',
      },
      llama: {
        enabled: true,
        models: ['llama-3.3-70b-versatile'],
        defaultModel: 'llama-3.3-70b-versatile',
        displayName: 'Llama 3.3 (Groq)',
        apiProvider: 'groq',
      },
      openai: {
        enabled: true,
        models: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'o1', 'o1-pro', 'o3-mini', 'o3'],
        defaultModel: 'gpt-4o',
        displayName: 'OpenAI',
      },
      anthropic: {
        enabled: true,
        models: [
          'claude-3-5-haiku-20241022',
          'claude-3-5-sonnet-20241022',
          'claude-opus-4-20250514',
        ],
        defaultModel: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude',
      },
    },
    defaultProvider: 'openai',
    perRequestLimits: { maxTokens: 1400, timeoutMs: 60000, maxRequests: 3 },
  },
};

// Export for Paris to use when issuing grants
export function getAiProfileConfig(profile: AiProfile): AiProfileConfig {
  return PROFILE_CONFIGS[profile];
}
```

### 3.2 Grant issuance (Paris)

**File:** `paris/src/domains/ai/index.ts`

**Extend POST /api/ai/grant:**
```typescript
// When Bob requests AI grant, include tier-specific AI config
async function issueAiGrant(req: Request): Promise<AiGrant> {
  const { workspaceId, publicId, agent } = req.body;

  // Resolve workspace tier → policy → AI profile
  const workspace = await getWorkspace(workspaceId);
  const policy = resolvePolicy(workspace.tier);
  const aiProfile = getAiProfileForPolicy(policy);
  const aiConfig = getAiProfileConfig(aiProfile);

  // Allow user to select provider/model (if in grant request)
  const selectedProvider = req.body.selectedProvider;
  const selectedModel = req.body.selectedModel;

  // Validate selection against tier permissions
  if (selectedProvider && !aiConfig.providers[selectedProvider]?.enabled) {
    throw new Error(`Provider ${selectedProvider} not allowed for tier ${workspace.tier}`);
  }

  if (selectedModel) {
    const providerConfig = aiConfig.providers[selectedProvider];
    if (!providerConfig?.models.includes(selectedModel)) {
      throw new Error(`Model ${selectedModel} not allowed for provider ${selectedProvider}`);
    }
  }

  // Build grant
  const grant: AiGrant = {
    workspaceId,
    publicId,
    agent,
    ai: {
      profile: aiProfile,
      providers: aiConfig.providers,
      defaultProvider: aiConfig.defaultProvider,
      defaultModel: aiConfig.providers[aiConfig.defaultProvider].defaultModel,
      perRequestLimits: aiConfig.perRequestLimits,
      selectedProvider: selectedProvider ?? undefined,
      selectedModel: selectedModel ?? undefined,
    },
  };

  // Sign grant (HMAC to prevent tampering)
  grant.signature = signGrant(grant);

  return grant;
}
```

### 3.3 Enforcement (San Francisco)

**Files:** `sanfrancisco/src/grants.ts`, `sanfrancisco/src/ai/modelRouter.ts`, `sanfrancisco/src/ai/chat.ts`

**Validate grants before execution:**
```typescript
async function executeAiRequest(grant: AiGrant, request: AiRequest) {
  // 1. Verify signature (prevent client tampering)
  if (!verifyGrantSignature(grant)) {
    throw new ForbiddenError('Invalid AI grant signature');
  }

  // 2. Determine provider (from grant, never from client request)
  const provider = grant.ai.selectedProvider ?? grant.ai.defaultProvider;
  const providerConfig = grant.ai.providers[provider];

  if (!providerConfig?.enabled) {
    throw new ForbiddenError(`Provider ${provider} not enabled for this tier`);
  }

  // 3. Determine model (from grant, never from client request)
  const model = grant.ai.selectedModel ?? providerConfig.defaultModel;

  if (!providerConfig.models.includes(model)) {
    throw new ForbiddenError(`Model ${model} not allowed for provider ${provider}`);
  }

  // 4. Enforce limits
  const maxTokens = Math.min(
    request.maxTokens ?? Infinity,
    grant.ai.perRequestLimits.maxTokens
  );

  // 5. Route to appropriate SDK based on provider
  const apiProvider = providerConfig.apiProvider || provider; // Groq uses different SDK than Llama

  if (apiProvider === 'groq') {
    // Use Groq SDK for Llama 3.3 (fast inference)
    return await executeWithGroq({
      model,
      maxTokens,
      timeout: grant.ai.perRequestLimits.timeoutMs,
      messages: request.messages,
    });
  } else {
    // Use standard provider SDKs (OpenAI, Anthropic, etc.)
    return await callLLM({
      provider,
      model,
      maxTokens,
      timeout: grant.ai.perRequestLimits.timeoutMs,
      messages: request.messages,
    });
  }
}

// Groq-specific execution (for Llama 3.3)
async function executeWithGroq(params: {
  model: string;
  maxTokens: number;
  timeout: number;
  messages: Message[];
}) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: params.model, // 'llama-3.3-70b-versatile'
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: 0.7,
  });

  return {
    content: response.choices[0].message.content,
    usage: {
      total_tokens: response.usage.total_tokens,
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
    },
  };
}
```

**Security note:** San Francisco NEVER trusts client input for provider/model. It only reads from the signed grant issued by Paris.

**Provider adapters (Cloudflare Workers):**
- Existing adapters call provider HTTP APIs via `fetch` in `sanfrancisco/src/providers/*` (no Node SDKs required).
- New providers (Amazon/Groq) require a new adapter file + env vars (keys), plus wiring in the shared router.

### 3.4 User interface (Bob)

**File:** `bob/components/CopilotPane.tsx` (or a small dedicated settings component used by the Copilot pane)

**Add AI settings section (Tier1+ only):**
```tsx
function AiSettings({ workspace, policy }: Props) {
  const [selectedProvider, setSelectedProvider] = useState(
    workspace.settings?.ai?.provider ?? policy.ai.defaultProvider
  );
  const [selectedModel, setSelectedModel] = useState(
    workspace.settings?.ai?.model ?? null
  );

  // Get available providers for this tier
  const providers = Object.entries(policy.ai.providers)
    .filter(([_, config]) => config.enabled)
    .map(([key, config]) => ({ key, ...config }));

  const currentProvider = policy.ai.providers[selectedProvider];

  // Hide if Free tier (no choice)
  if (providers.length === 0 || (providers.length === 1 && currentProvider.models.length === 1)) {
    return null; // Free tier: no settings needed
  }

  return (
    <SettingsSection title="Copilot AI">
      <SettingsRow label="Provider">
        <Select
          value={selectedProvider}
          onChange={async (value) => {
            setSelectedProvider(value);
            // Auto-select default model for new provider
            const newProvider = policy.ai.providers[value];
            setSelectedModel(newProvider.defaultModel);
            // Save to workspace settings
            await updateWorkspaceSettings(workspace.id, {
              ai: { provider: value, model: newProvider.defaultModel },
            });
          }}
        >
          {providers.map(p => (
            <option key={p.key} value={p.key}>
              {p.displayName}
              {p.key === policy.ai.defaultProvider && ' (recommended)'}
            </option>
          ))}
        </Select>
      </SettingsRow>

      {currentProvider.models.length > 1 && (
        <SettingsRow label="Model">
          <Select
            value={selectedModel ?? currentProvider.defaultModel}
            onChange={async (value) => {
              setSelectedModel(value);
              await updateWorkspaceSettings(workspace.id, {
                ai: { provider: selectedProvider, model: value },
              });
            }}
          >
            {currentProvider.models.map(model => (
              <option key={model} value={model}>
                {formatModelName(model)}
              </option>
            ))}
          </Select>
        </SettingsRow>
      )}

      <SettingsHelp>
        Your tier includes {providers.length} AI providers.
        {workspace.tier === 'free' && (
          <> <UpgradeLink>Upgrade to Tier 1</UpgradeLink> for OpenAI and Claude access.</>
        )}
      </SettingsHelp>
    </SettingsSection>
  );
}

// Human-readable model names
function formatModelName(model: string): string {
  const labels: Record<string, string> = {
    'nova-micro': 'Nova Micro (fastest, cheapest)',
    'nova-lite': 'Nova Lite (balanced)',
    'nova-pro': 'Nova Pro (smart)',
    'nova-premier': 'Nova Premier (best)',
    'deepseek-chat': 'DeepSeek Chat',
    'deepseek-reasoner': 'DeepSeek Reasoner (thinking)',
    'llama-3.3-70b-versatile': 'Llama 3.3 70B (fast, creative)',
    'gpt-4o-mini': 'GPT-4o Mini (fast)',
    'gpt-4o': 'GPT-4o (recommended)',
    'o1-mini': 'o1 Mini (reasoning)',
    'o1': 'o1 (advanced reasoning)',
    'o1-pro': 'o1 Pro (best reasoning)',
    'o3-mini': 'o3 Mini (next-gen reasoning, fast)',
    'o3': 'o3 (next-gen reasoning, best)',
    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-opus-4-20250514': 'Claude Opus 4',
  };
  return labels[model] || model;
}
```

**User experience:**
- **Free tier**: No settings UI (provider/model locked to defaults)
- **Tier1+**: Settings page shows "Copilot AI" section with provider + model dropdowns
- Selection is saved to `workspaces.settings.ai` and sent with grant requests

---

## 4) Tier differentiation summary

### 4.1 Provider/Model access + AI Budget (NEW PARADIGM)

| Tier | Providers | Models | Default | Monthly Price | AI Budget | Budget Cap |
|---|---|---|---|---:|---:|---|
| **Free** | Amazon Nova, DeepSeek | Nova Lite, DeepSeek Chat | Nova Lite | $0 | $0.50 | Fixed |
| **Tier1** | Amazon, DeepSeek, Llama, OpenAI, Claude | Mid-tier (GPT-4o-mini, Nova Pro, Llama 3.3, Haiku) | Nova Pro | $29 | $14.50 | 50% of price |
| **Tier2** | Amazon, DeepSeek, Llama, OpenAI, Claude | Premium (GPT-4o, Llama 3.3, Sonnet, o1-mini) | GPT-4o | $99 | $49.50 | 50% of price |
| **Tier3** | Amazon, DeepSeek, Llama, OpenAI, Claude | All (o3, o3-mini, o1-pro, Llama 3.3, Opus 4) | GPT-4o | $299 | $149.50 | 50% of price |

**Budget paradigm: "Freedom with economic safety"**

Instead of artificial turn/token limits, users get a **monthly dollar budget** capped at **50% of what they pay**:
- **Tier1**: Pays $29/month → gets $14.50 AI budget
- **Tier2**: Pays $99/month → gets $49.50 AI budget
- **Tier3**: Pays $299/month → gets $149.50 AI budget

**How it works:**
- Each AI request deducts its **actual cost** from the budget (based on real LLM API pricing)
- User decides how to spend: many cheap requests (Nova) or few expensive ones (Opus)
- When budget exhausted: "You've used your monthly AI budget. Resets on [date]."
- **Clickeen never loses money** (budget ≤ 50% of revenue)

**Why this paradigm is necessary:**

1. **Economic safety guarantee**
   - Turn/token budgets don't map to costs (GPT-4o costs 16× more than Nova Lite)
   - A user could burn 5M tokens on Opus 4 and cost Clickeen $225 (while paying $99/month)
   - Dollar budget makes costs **impossible to exceed** — budget = 50% of revenue, so worst case is 50% margin
   - Clickeen can NEVER lose money on AI costs, regardless of usage patterns

2. **User freedom and fairness**
   - Power users get to choose: quality vs quantity
   - Light users don't waste budget on caps they'll never hit
   - Different use cases work naturally:
     - Marketing team: Use cheap models for bulk content (high volume)
     - Strategy team: Use expensive reasoning models sparingly (high quality)
   - The person paying should decide the tradeoff, not Clickeen

3. **Eliminates perverse incentives**
   - Turn budgets: User stuffs 10k tokens into one prompt to "save turns" (gaming the system)
   - Token budgets: User can't use expensive models even though they'd pay for them
   - Dollar budgets: Transparent — you see the cost, you make the call

4. **Simplicity for users and support**
   - One metric: "You have $X.XX left this month"
   - No confusing dual budgets ("I have 100 turns left but only 5k tokens — what does that mean?")
   - Clear value proposition: "Pay $99, get $49.50 in AI credits — use however you want"

**Examples:**

Tier1 user ($14.50 budget):
- **Option A**: ~24,000 Nova Lite requests ($0.0006 avg cost each) — bulk content generation
- **Option B**: ~190 Claude Opus 4 requests ($0.075 avg cost each) — deep analysis/strategy
- **Option C**: Balanced mix (100 GPT-4o requests @ $0.03 + 400 Nova Pro @ $0.008 = $6.20 used)

Tier3 user ($149.50 budget):
- Could burn entire budget on 33 o3 reasoning requests (~$4.50 each)
- Or generate 250,000 FAQ answers with Nova Lite
- Or any combination — user decides based on their business needs

**The freedom matters**: We give you a lot of bandwidth. If you want to burn your whole budget chatting all day with Opus 4, be my guest — but Clickeen won't pay for it.

**Provider highlights:**
- **Amazon Nova**: Cost-effective baseline (default for Free/Tier1)
- **DeepSeek**: Ultra-cheap option; good for simple tasks
- **Llama 3.3 (Groq)**: ⚡ **Extremely fast** (300+ tokens/sec); **excellent for marketing copy** (FAQs, CTAs, product descriptions); competitive quality at mid-tier price (~$0.59/1M tokens avg)
- **OpenAI GPT-4o**: Best general-purpose model (default for Tier2+)
- **Claude**: Best for analysis, reasoning, complex writing
- **OpenAI o3/o1**: Premium reasoning models for complex problem-solving (Tier3 only)

**Why Llama 3.3 via Groq:**
- **Speed**: 6× faster than GPT-4o (better UX for real-time Copilot editing)
- **Cost**: Cheaper than GPT-4o (~$0.59 vs ~$2.50/1M tokens avg)
- **Quality**: Competitive with GPT-4o on creative/marketing tasks
- **Use case fit**: Widget content is mostly marketing copy — Llama excels here

### 4.2 Dollar budget implementation

**Entitlements matrix addition** (PRD 41):
```json
"budget.copilot.dollars": {
  "kind": "budget",
  "values": {
    "devstudio": null,
    "minibob": 0.10,
    "free": 0.50,
    "tier1": 14.50,
    "tier2": 49.50,
    "tier3": 149.50
  },
  "period": "monthly",
  "resetDay": 1
}
```

**Cost tracking per request** (San Francisco):
```typescript
// After each LLM request, calculate actual cost
async function calculateRequestCost(
  provider: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number }
): Promise<number> {
  // Model-specific pricing (from LLM provider docs)
  const PRICING: Record<string, { input: number; output: number }> = {
    // Amazon Nova (per 1M tokens)
    'nova-micro': { input: 0.035, output: 0.14 },
    'nova-lite': { input: 0.06, output: 0.24 },
    'nova-pro': { input: 0.80, output: 3.20 },
    'nova-premier': { input: 2.00, output: 8.00 },

    // DeepSeek (per 1M tokens)
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },

    // Llama via Groq (per 1M tokens)
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },

    // OpenAI (per 1M tokens)
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-pro': { input: 37.50, output: 150.00 },
    'o3-mini': { input: 4.00, output: 16.00 },
    'o3': { input: 50.00, output: 200.00 },

    // Claude (per 1M tokens)
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  };

  const pricing = PRICING[model];
  if (!pricing) {
    console.warn(`Unknown model ${model}, using default pricing`);
    return 0.01; // Conservative fallback
  }

  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

// Report cost to Paris after each request
const cost = await calculateRequestCost(provider, model, response.usage);

await paris.post('/api/usage/copilot-dollars', {
  workspaceId,
  publicId,
  provider,
  model,
  tokensUsed: response.usage.promptTokens + response.usage.completionTokens,
  costDollars: cost,
  timestamp: Date.now(),
  signature: hmac({ workspaceId, cost }, AI_GRANT_SECRET),
});
```

**Budget enforcement** (Paris):
```typescript
// Track dollar spending per workspace per month
async function recordDollarUsage(
  workspaceId: string,
  costDollars: number,
  metadata: { provider: string; model: string; tokensUsed: number }
) {
  const periodKey = getCurrentPeriodKey(); // e.g., "2026-02"
  const usageKey = `copilot:dollars:${periodKey}:${workspaceId}`;
  const detailKey = `copilot:dollars:${periodKey}:${workspaceId}:detail`;

  // Increment cost counter
  const newTotal = await kv.incrby(usageKey, Math.round(costDollars * 100)); // Store as cents
  const newTotalDollars = newTotal / 100;

  // Log detail for analytics
  await kv.rpush(detailKey, JSON.stringify({
    timestamp: Date.now(),
    provider: metadata.provider,
    model: metadata.model,
    tokensUsed: metadata.tokensUsed,
    costDollars,
  }));

  // Check budget
  const policy = await getPolicyForWorkspace(workspaceId);
  const dollarBudget = policy.budget.copilot.dollars;

  if (dollarBudget !== null && newTotalDollars > dollarBudget) {
    throw new BudgetExceededError({
      budget: 'copilot.dollars',
      limit: dollarBudget,
      used: newTotalDollars,
      resetsAt: getNextPeriodStart(),
      message: `You've used your monthly AI budget ($${newTotalDollars.toFixed(2)} of $${dollarBudget.toFixed(2)})`,
    });
  }

  return { total: newTotalDollars, limit: dollarBudget };
}
```

**User experience when budget exceeded:**
```
❌ AI budget exhausted

You've spent $14.50 of $14.50 this month.
Your budget resets on March 1, 2026.

Options:
• Wait 13 days for reset
• Upgrade to Tier 2 ($49.50/month AI budget)
```

**Budget usage display in Bob Settings:**
```tsx
function AiBudgetDisplay({ workspace, policy }: Props) {
  const usage = useAiBudgetUsage(workspace.id); // Real-time from Paris

  if (!policy.budget.copilot.dollars) return null; // No budget for this tier

  const percentUsed = (usage.used / usage.limit) * 100;
  const daysUntilReset = getDaysUntilNextPeriod();

  return (
    <SettingsCard>
      <h3>AI Budget</h3>
      <ProgressBar value={percentUsed} max={100} />
      <p className="budget-stats">
        ${usage.used.toFixed(2)} of ${usage.limit.toFixed(2)} used
        {percentUsed > 75 && (
          <span className="warning"> — {daysUntilReset} days until reset</span>
        )}
      </p>

      {usage.recentRequests && (
        <details className="budget-breakdown">
          <summary>Recent requests</summary>
          <ul>
            {usage.recentRequests.map((req, i) => (
              <li key={i}>
                {req.model}: ${req.cost.toFixed(4)} ({req.tokensUsed.toLocaleString()} tokens)
              </li>
            ))}
          </ul>
        </details>
      )}
    </SettingsCard>
  );
}
```

**Key advantages of dollar budgets:**
- **Transparent**: User sees exactly what they're spending
- **Fair**: Heavy model users pay via their choices, not arbitrary caps
- **Profitable**: Impossible for Clickeen to lose money (budget = 50% of tier price)
- **Flexible**: Power users choose quality vs quantity themselves

---

## 5) Rollout plan

### Phase 1: Infrastructure (no user-facing changes)
1. Deploy ck-policy with AI profile configs (including Llama)
2. **Integrate Groq SDK** in San Francisco for Llama 3.3 inference
3. **Implement dollar budget tracking** in San Francisco (cost calculation per model)
4. **Implement dollar budget enforcement** in Paris (KV-based spending tracker)
5. Deploy Paris with AI grant field + dollar budget capability (default all tiers to current behavior)
6. Deploy San Francisco with grant validation + cost reporting
7. **Verify**: Grants are signed/enforced correctly
8. **Verify**: Llama 3.3 via Groq works (test inference speed, quality)
9. **Verify**: Cost calculations are accurate (unit tests + manual checks against LLM provider pricing)

### Phase 2: Free tier lockdown
1. Change Free → `free_low` profile (Nova/DeepSeek only)
2. Enable dollar budget enforcement for Free tier ($0.50/month)
3. Monitor cost reduction and budget exhaustion rates
4. **Verify**: Free Copilot still works (no user complaints)
5. **Verify**: <1% of Free users hit budget limit (validate $0.50 is sufficient)

### Phase 3: Paid tier differentiation + dollar budgets
1. Deploy Bob settings UI (provider/model dropdowns for Tier1+)
2. **Add dollar budget display** in Bob Settings ("$X.XX of $Y.YY used this month")
3. Include Llama 3.3 (Groq) in dropdown with label: "Llama 3.3 (Groq) — Fast, great for marketing copy ⚡"
4. Enable full tier differentiation with dollar budgets (Tier1=$14.50, Tier2=$49.50, Tier3=$149.50)
5. Monitor provider/model selection rates (especially Llama adoption)
6. Monitor dollar budget utilization (avg spending per tier, % hitting limit)
7. **Verify**: Paid users discover and use model choice
8. **Verify**: Llama delivers fast responses (measure p95 latency)
9. **Verify**: Dollar budget UX is clear (users understand budget remaining)

### Phase 4: Optimization
1. Tune defaults based on cost/quality data
2. Add usage analytics (which models are popular by tier; track Llama vs others; cost per workspace trends)
3. A/B test Llama quality for widget content (FAQs, CTAs) vs GPT-4o
4. Adjust model availability if needed (if Llama adoption is low, investigate why)
5. **Add budget usage insights**: Show users "You could get 500 more requests with Nova Lite" when nearing budget
6. **Monitor profitability**: Validate that all tiers stay above 50% gross margin (should be guaranteed by design)

---

## 6) Success metrics

1. **Cost control**: Free tier AI cost/workspace drops 80%+ (from GPT-4o to Nova)
2. **User activation**: Free tier Copilot usage unchanged (no quality complaints)
3. **Paid differentiation**: 40%+ of Tier1+ users change from default provider/model
4. **Security**: Zero grant forgery attempts succeed
5. **Dollar budget effectiveness**:
   - <5% of workspaces hit monthly dollar budget limit
   - Average spending: Free <$0.10, Tier1 <$3, Tier2 <$15, Tier3 <$50
   - 99th percentile spending stays under budget cap (impossible to exceed, but validates padding)
6. **Economic validation** (GUARANTEED):
   - **100% of workspaces are profitable** (budget = 50% of tier price, mathematically impossible to lose money)
   - Free tier: $0.50 budget = effectively zero cost risk
   - Tier1: $14.50 budget < $29 revenue = minimum 50% margin
   - Tier2: $49.50 budget < $99 revenue = minimum 50% margin
   - Tier3: $149.50 budget < $299 revenue = minimum 50% margin
7. **User freedom validated**:
   - Tier2+ users use mix of models (not just defaults)
   - Some workspaces spend heavily on Opus/o3 (max budget), others on Nova (light budget) — diversity indicates choice is valued

---

## 7) Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Free users complain about quality | Churn | Monitor NPS; if real issue, upgrade to GPT-4o-mini (still 10× cheaper than Sonnet); increase Free budget from $0.50 to $1.00 |
| Paid users never change defaults | Wasted feature | Add "try GPT-4o?" suggestions in UI; educate on provider strengths; show cost breakdown in settings |
| Amazon Nova pricing changes | Margins | Profile configs are centralized; swap models without code changes; pricing table is config-driven |
| Grant overhead is high | Latency | Use fast HMAC; cache grants client-side for session |
| **LLM pricing changes (price increases)** | **Unexpected costs** | **ELIMINATED** — budget is dollar-capped, so price increases just mean users get fewer requests (not more cost to Clickeen) |
| **Dollar budget too restrictive** | User complaints | Monitor "budget exhausted" error rates; if >10% of tier hits limit, increase budget slightly (still keeping <75% of tier price for safety margin) |
| **Cost calculation errors** | Over/under billing users | Extensive unit tests for pricing table; log all costs for audit; cross-check with LLM provider bills monthly |
| **Groq API outage/rate limits** | Llama unavailable | Automatic fallback to GPT-4o-mini; monitor Groq SLA; add Together AI as backup provider |
| **Llama quality not good enough** | User complaints | A/B test before GA; if quality issues, hide Llama or only show for Tier2+ |
| **Users burn budget too fast** | Frustration | Show budget usage prominently in UI; warn at 50% and 75%; suggest cheaper models when low; allow budget top-ups for Tier3 (overage billing) |

---

## 8) Open questions

1. **Should Free tier see "locked" dropdowns or hide them entirely?**
   - Recommendation: Hide entirely (avoid "locked feature" frustration)

2. **Should we show per-request costs in UI (e.g., "This request cost $0.03")?**
   - Recommendation: YES in Settings breakdown, NO in Copilot UX (too distracting)
   - Show aggregated budget ("$X used") prominently, detailed breakdown on click

3. **Should Copilot auto-suggest cheaper models when budget is low?**
   - Recommendation: YES — when user has <$2 remaining, suggest: "Switch to Nova Lite to make budget last longer?"

4. **Should we add Gemini (Google)?**
   - Recommendation: Not yet (5 providers with Llama is enough; add Gemini when differentiated)

5. **Should we promote Llama 3.3 as "recommended for widgets"?**
   - Recommendation: YES — add badge in UI: "⚡ Fast • Great for marketing copy"
   - Position it as the "widget specialist" (fast + creative)
   - Track adoption; if high, make it Tier1 default instead of Nova Pro

6. **What if Groq has an outage?**
   - Recommendation: Add automatic fallback to GPT-4o-mini for Llama requests
   - Monitor Groq uptime; if <99.5%, reconsider provider
   - Alternative: Add Together AI as backup Llama provider ($0.60/1M, similar pricing)

7. **Should Tier3 users be able to buy budget top-ups (overage billing)?**
   - Recommendation: YES for Tier3 only (likely enterprise/power users)
   - Allow purchasing additional $50 increments at 2× rate ($100 for $50 credit)
   - This creates high-margin upsell for power users who hit limits

8. **Should we reset budgets mid-month for new subscribers?**
   - Recommendation: Pro-rate on first month (e.g., join on Feb 15 → get 50% of monthly budget)
   - Full budget every month thereafter (resets on subscription anniversary day)

9. **Should we warn users before expensive requests (e.g., "o3 costs $4, continue?")?**
   - Recommendation: NO for v1 (too intrusive)
   - Instead: Show budget prominently in UI; users will self-regulate
   - Phase 2: Add opt-in warning threshold in Settings

---

## 9) Acceptance criteria

1. Free tier can only use Amazon Nova and DeepSeek (enforced server-side)
2. Tier1+ users can select provider/model via Settings UI (Amazon, DeepSeek, Llama, OpenAI, Claude)
3. **Llama 3.3 works via Groq API** with fast inference (300+ tokens/sec measured)
4. San Francisco rejects grants with tampered provider/model selections
5. DevStudio entitlements page shows AI profile mapping by tier (including Llama)
6. **Dollar budgets are enforced** (Free=$0.50, Tier1=$14.50, Tier2=$49.50, Tier3=$149.50)
7. **Per-request cost tracking**: San Francisco calculates actual cost based on model pricing and usage
8. **Paris records dollar spending** per workspace per month (KV storage with detail logging)
9. **Bob shows dollar budget usage** in Settings: "$X.XX of $Y.YY used this month"
10. **Clear error when budget exceeded**: "You've spent $14.50 of $14.50 this month. Budget resets on March 1."
11. **Budget usage breakdown**: Users can see recent requests with per-request costs
12. Copilot continues working for all tiers (no regressions)
13. Free tier AI costs drop 80%+ while maintaining activation rates
14. **Profitability GUARANTEED**: All tiers mathematically profitable (budget = 50% of tier price)
15. **Llama quality verified**: A/B test shows Llama 3.3 performs well for widget marketing copy (FAQs, CTAs)
16. **Pricing table accuracy**: Unit tests verify cost calculations match LLM provider pricing
17. **User freedom validated**: Tier2+ workspaces show diverse model usage (not all using same model)

---

## 10) Migration notes

**Existing workspaces:** No breaking changes.
- Current Copilot behavior continues (defaults apply)
- New settings UI appears for Tier1+ (optional to change)
- Free tier automatically uses new cheap models (transparent to user)

**Backwards compatibility:**
- Old grants without `ai` field fall back to `paid_premium` (safe default)
- Gradual rollout: can deploy enforcement before UI (uses defaults)

---

**Status**: EXECUTING.
