import { HttpError } from '../http';
import {
  assertProviderAllowed,
  getGrantMaxCostUsd,
  getGrantMaxRequests,
  getGrantMaxTokens,
  getGrantTimeoutMs,
} from '../grants';
import type { AIGrant, Env, Usage } from '../types';
import { resolveModelSelection, type AiProvider, type ModelSelection } from './modelRouter';
import { callDeepseekChat } from '../providers/deepseek';
import { callOpenAiChat } from '../providers/openai';
import { callAnthropicChat } from '../providers/anthropic';
import { callGroqChat } from '../providers/groq';
import { callAmazonBedrockChat } from '../providers/amazon';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type PriceEntry = { promptUsdPer1M: number; completionUsdPer1M: number };
type BudgetState = { requests: number; costUsd: number };

const DEFAULT_PRICE_TABLE: Record<string, PriceEntry> = {
  deepseek: { promptUsdPer1M: 0.14, completionUsdPer1M: 0.28 },
  openai: { promptUsdPer1M: 2.5, completionUsdPer1M: 10 },
  anthropic: { promptUsdPer1M: 3, completionUsdPer1M: 15 },
  groq: { promptUsdPer1M: 0.59, completionUsdPer1M: 0.79 },
  amazon: { promptUsdPer1M: 0.8, completionUsdPer1M: 3.2 },
};

const budgetCache = new Map<string, BudgetState>();
let cachedPriceTable: Record<string, PriceEntry> | null = null;

function resolvePriceTable(env: Env): Record<string, PriceEntry> {
  if (cachedPriceTable) return cachedPriceTable;
  let parsed: Record<string, PriceEntry> = {};
  const raw = typeof env.AI_PRICE_TABLE_JSON === 'string' ? env.AI_PRICE_TABLE_JSON.trim() : '';
  if (raw) {
    try {
      const json = JSON.parse(raw) as Record<string, Partial<PriceEntry>>;
      for (const [provider, entry] of Object.entries(json)) {
        const prompt = entry?.promptUsdPer1M;
        const completion = entry?.completionUsdPer1M;
        if (typeof prompt !== 'number' || !Number.isFinite(prompt) || prompt <= 0) continue;
        if (typeof completion !== 'number' || !Number.isFinite(completion) || completion <= 0) continue;
        parsed[provider] = { promptUsdPer1M: prompt, completionUsdPer1M: completion };
      }
    } catch (err) {
      console.error('[sanfrancisco] Invalid AI_PRICE_TABLE_JSON', err);
    }
  }
  cachedPriceTable = { ...DEFAULT_PRICE_TABLE, ...parsed };
  return cachedPriceTable;
}

function budgetKey(grant: AIGrant, agentId: string): string {
  const subjectKey =
    grant.sub.kind === 'anon'
      ? grant.sub.sessionId
      : grant.sub.kind === 'user'
        ? `${grant.sub.userId}:${grant.sub.workspaceId}`
        : grant.sub.serviceId;
  const sessionId = grant.trace?.sessionId ?? subjectKey;
  const capsKey = grant.caps.join(',');
  const grantKey = grant.jti ?? `${sessionId}:${capsKey}:${grant.exp}`;
  return `ai-budget:${grantKey}:${agentId}`;
}

function grantTtlSeconds(grant: AIGrant): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.max(1, grant.exp - nowSec + 5);
}

async function loadBudgetState(env: Env, key: string): Promise<BudgetState> {
  try {
    const raw = await env.SF_KV.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BudgetState>;
      const requests = typeof parsed.requests === 'number' && Number.isFinite(parsed.requests) ? parsed.requests : 0;
      const costUsd = typeof parsed.costUsd === 'number' && Number.isFinite(parsed.costUsd) ? parsed.costUsd : 0;
      const state = { requests, costUsd };
      budgetCache.set(key, state);
      return state;
    }
  } catch (err) {
    console.error('[sanfrancisco] Failed to read budget state', err);
  }
  return budgetCache.get(key) ?? { requests: 0, costUsd: 0 };
}

async function saveBudgetState(env: Env, key: string, state: BudgetState, ttlSeconds: number): Promise<void> {
  budgetCache.set(key, state);
  try {
    await env.SF_KV.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
  } catch (err) {
    console.error('[sanfrancisco] Failed to persist budget state', err);
  }
}

function computeCostUsd(env: Env, usage: Usage): number | null {
  const entry = resolvePriceTable(env)[usage.provider];
  if (!entry) return null;
  const promptTokens = usage.promptTokens;
  const completionTokens = usage.completionTokens;
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  const promptCost = (promptTokens / 1_000_000) * entry.promptUsdPer1M;
  const completionCost = (completionTokens / 1_000_000) * entry.completionUsdPer1M;
  return promptCost + completionCost;
}

function providerHasCredentials(env: Env, provider: AiProvider): boolean {
  switch (provider) {
    case 'deepseek':
      return Boolean((env.DEEPSEEK_API_KEY || '').trim());
    case 'openai':
      return Boolean((env.OPENAI_API_KEY || '').trim());
    case 'anthropic':
      return Boolean((env.ANTHROPIC_API_KEY || '').trim());
    case 'groq':
      return Boolean((env.GROQ_API_KEY || '').trim());
    case 'amazon':
      return (
        Boolean((env.NOVA_API_KEY || '').trim()) ||
        (Boolean((env.AMAZON_BEDROCK_ACCESS_KEY_ID || '').trim()) &&
          Boolean((env.AMAZON_BEDROCK_SECRET_ACCESS_KEY || '').trim()) &&
          Boolean((env.AMAZON_BEDROCK_REGION || '').trim()))
      );
    default:
      return false;
  }
}

function defaultModelForProvider(env: Env, provider: AiProvider): string {
  if (provider === 'deepseek') return env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  if (provider === 'openai') return env.OPENAI_MODEL ?? 'gpt-5.2';
  if (provider === 'groq') return env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  if (provider === 'amazon') return env.NOVA_MODEL ?? env.AMAZON_BEDROCK_MODEL_ID ?? 'nova-2-lite-v1';
  return env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620';
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function preferredFallbackModels(provider: AiProvider): string[] {
  if (provider === 'openai') return ['gpt-4o-mini', 'gpt-4o'];
  if (provider === 'amazon') return ['amazon.nova-pro-v1:0', 'nova-2-pro-v1', 'amazon.nova-lite-v1:0', 'nova-2-lite-v1'];
  return [];
}

function buildProviderOrder(args: {
  grant: AIGrant;
  env: Env;
  primary: ModelSelection;
}): AiProvider[] {
  const allowed = (args.grant.ai?.allowedProviders ?? [args.primary.provider]) as AiProvider[];
  const selectedProvider = args.grant.ai?.selectedProvider;
  if (selectedProvider) {
    return [selectedProvider];
  }

  const ordered = dedupeStrings([
    args.primary.provider,
    args.grant.ai?.defaultProvider,
    ...allowed,
  ]) as AiProvider[];

  // Keep primary first, then providers that are actually configured.
  const primary = args.primary.provider;
  const rest = ordered.filter((p) => p !== primary);
  const configured = rest.filter((p) => providerHasCredentials(args.env, p));
  const unconfigured = rest.filter((p) => !providerHasCredentials(args.env, p));
  return [primary, ...configured, ...unconfigured];
}

function buildModelOrder(args: {
  grant: AIGrant;
  env: Env;
  provider: AiProvider;
  primary: ModelSelection;
}): string[] {
  const modelPolicy = args.grant.ai?.models?.[args.provider] ?? null;
  const allowedModels = Array.isArray(modelPolicy?.allowed) ? modelPolicy!.allowed : [];
  const selectedProvider = args.grant.ai?.selectedProvider;
  const selectedModel = args.grant.ai?.selectedModel;

  const candidates = dedupeStrings([
    args.provider === args.primary.provider ? args.primary.model : null,
    selectedProvider === args.provider ? selectedModel : null,
    ...preferredFallbackModels(args.provider),
    modelPolicy?.defaultModel,
    ...allowedModels,
    defaultModelForProvider(args.env, args.provider),
  ]);

  if (!allowedModels.length) return candidates.slice(0, 4);
  return candidates.filter((m) => allowedModels.includes(m)).slice(0, 4);
}

function buildSelectionQueue(args: { grant: AIGrant; env: Env; primary: ModelSelection }): ModelSelection[] {
  const providers = buildProviderOrder({
    grant: args.grant,
    env: args.env,
    primary: args.primary,
  });
  const out: ModelSelection[] = [];
  const seen = new Set<string>();
  for (const provider of providers) {
    const models = buildModelOrder({
      grant: args.grant,
      env: args.env,
      provider,
      primary: args.primary,
    });
    for (const model of models) {
      const key = `${provider}::${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        provider,
        model,
        canonicalAgentId: args.primary.canonicalAgentId,
      });
      if (out.length >= 6) return out;
    }
  }
  return out.length ? out : [args.primary];
}

async function callProviderForSelection(args: {
  env: Env;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  selection: ModelSelection;
}): Promise<{ content: string; usage: Usage }> {
  if (args.selection.provider === 'deepseek') {
    return callDeepseekChat({
      env: args.env,
      model: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  if (args.selection.provider === 'openai') {
    return callOpenAiChat({
      env: args.env,
      model: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  if (args.selection.provider === 'groq') {
    return callGroqChat({
      env: args.env,
      model: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  if (args.selection.provider === 'amazon') {
    return callAmazonBedrockChat({
      env: args.env,
      modelId: args.selection.model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      timeoutMs: args.timeoutMs,
    });
  }
  return callAnthropicChat({
    env: args.env,
    model: args.selection.model,
    messages: args.messages,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    timeoutMs: args.timeoutMs,
  });
}

function isRetryableProviderFailure(err: unknown): boolean {
  if (!(err instanceof HttpError)) return false;
  if (err.status !== 502) return false;
  if (err.error.code !== 'PROVIDER_ERROR') return false;
  const message = String(err.error.message || '').toLowerCase();
  if (!message) return false;
  const statusMatch = message.match(/upstream error\s*\((\d{3})\)/);
  const upstreamStatus = statusMatch ? Number(statusMatch[1]) : null;
  if (upstreamStatus != null && Number.isFinite(upstreamStatus)) {
    if (upstreamStatus >= 500) return true;
    if (upstreamStatus === 408 || upstreamStatus === 409 || upstreamStatus === 425 || upstreamStatus === 429) return true;
  }
  return (
    message.includes('empty model response') ||
    message.includes('upstream request failed') ||
    message.includes('invalid upstream json') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callChatCompletion(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; usage: Usage }> {
  const primary = resolveModelSelection({ env: args.env, grant: args.grant, agentId: args.agentId });
  const selectionQueue = buildSelectionQueue({ grant: args.grant, env: args.env, primary });

  const grantMaxTokens = getGrantMaxTokens(args.grant);
  const grantTimeoutMs = getGrantTimeoutMs(args.grant);
  const grantMaxRequests = getGrantMaxRequests(args.grant);
  const grantMaxCostUsd = getGrantMaxCostUsd(args.grant);
  const maxTokens = args.maxTokens ? Math.min(args.maxTokens, grantMaxTokens) : grantMaxTokens;
  const timeoutMs = args.timeoutMs ? Math.min(args.timeoutMs, grantTimeoutMs) : grantTimeoutMs;
  const temperature = typeof args.temperature === 'number' ? args.temperature : 0.2;

  const key = budgetKey(args.grant, args.agentId);
  const ttlSeconds = grantTtlSeconds(args.grant);
  const state = await loadBudgetState(args.env, key);
  if (state.requests >= grantMaxRequests) {
    throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Grant request budget exceeded' });
  }

  let result: { content: string; usage: Usage } | null = null;
  let lastError: unknown = null;
  for (let i = 0; i < selectionQueue.length; i += 1) {
    const selection = selectionQueue[i]!;
    assertProviderAllowed(args.grant, selection.provider);

    const retryWithinSelection = i === 0 ? 2 : 1;
    for (let attempt = 1; attempt <= retryWithinSelection; attempt += 1) {
      try {
        result = await callProviderForSelection({
          env: args.env,
          messages: args.messages,
          temperature,
          maxTokens,
          timeoutMs,
          selection,
        });
        break;
      } catch (err) {
        lastError = err;
        const retryable = isRetryableProviderFailure(err);
        const canRetrySame = retryable && attempt < retryWithinSelection;
        if (canRetrySame) {
          await sleep(120);
          continue;
        }
        const canTryNextSelection = retryable && i < selectionQueue.length - 1;
        if (canTryNextSelection) break;
        throw err;
      }
    }
    if (result) break;
  }
  if (!result && lastError) throw lastError;
  if (!result) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: primary.provider, message: 'Empty model response' });

  const computedCostUsd = computeCostUsd(args.env, result.usage);
  const nextCostUsd = state.costUsd + (computedCostUsd ?? 0);
  if (grantMaxCostUsd != null) {
    if (computedCostUsd == null) {
      throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Grant cost budget cannot be evaluated' });
    }
    if (nextCostUsd > grantMaxCostUsd) {
      throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Grant cost budget exceeded' });
    }
  }

  await saveBudgetState(args.env, key, { requests: state.requests + 1, costUsd: nextCostUsd }, ttlSeconds);
  return {
    content: result.content,
    usage: computedCostUsd != null ? { ...result.usage, costUsd: computedCostUsd } : result.usage,
  };
}
