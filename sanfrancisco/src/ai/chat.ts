import { HttpError } from '../http';
import {
  assertProviderAllowed,
  getGrantMaxCostUsd,
  getGrantMaxRequests,
  getGrantMaxTokens,
  getGrantTimeoutMs,
} from '../grants';
import type { AIGrant, Env, Usage } from '../types';
import { resolveModelSelection } from './modelRouter';
import { callDeepseekChat } from '../providers/deepseek';
import { callOpenAiChat } from '../providers/openai';
import { callAnthropicChat } from '../providers/anthropic';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type PriceEntry = { promptUsdPer1M: number; completionUsdPer1M: number };
type BudgetState = { requests: number; costUsd: number };

const DEFAULT_PRICE_TABLE: Record<string, PriceEntry> = {
  deepseek: { promptUsdPer1M: 0.14, completionUsdPer1M: 0.28 },
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

export async function callChatCompletion(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; usage: Usage }> {
  const selection = resolveModelSelection({ env: args.env, grant: args.grant, agentId: args.agentId });
  assertProviderAllowed(args.grant, selection.provider);

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

  let result: { content: string; usage: Usage };
  if (selection.provider === 'deepseek') {
    result = await callDeepseekChat({
      env: args.env,
      model: selection.model,
      messages: args.messages,
      temperature,
      maxTokens,
      timeoutMs,
    });
  } else if (selection.provider === 'openai') {
    result = await callOpenAiChat({
      env: args.env,
      model: selection.model,
      messages: args.messages,
      temperature,
      maxTokens,
      timeoutMs,
    });
  } else {
    result = await callAnthropicChat({
      env: args.env,
      model: selection.model,
      messages: args.messages,
      temperature,
      maxTokens,
      timeoutMs,
    });
  }

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
