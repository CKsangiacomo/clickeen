import { HttpError } from '../http';
import {
  getGrantMaxCostUsd,
  getGrantMaxRequests,
  getGrantMaxTokens,
  getGrantTimeoutMs,
} from '../grants';
import { listAiModelCatalog } from '@clickeen/ck-contracts/ai';
import type { AIGrant, Env, Usage } from '../types';
import { resolveModelSelection, type ModelSelection } from './modelRouter';
import { callDeepseekChat } from '../providers/deepseek';
import { callOpenAiChat } from '../providers/openai';
import { callAnthropicChat } from '../providers/anthropic';
import { callGroqChat } from '../providers/groq';
import { callAmazonBedrockChat } from '../providers/amazon';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type PriceEntry = { promptUsdPer1M: number; completionUsdPer1M: number };
type BudgetState = { requests: number; costUsd: number };

const DEFAULT_PRICE_TABLE: Record<string, PriceEntry> = Object.fromEntries(
  listAiModelCatalog().map((entry) => [
    `${entry.provider}:${entry.model}`,
    { promptUsdPer1M: entry.promptUsdPer1M, completionUsdPer1M: entry.completionUsdPer1M },
  ]),
);

// Per-grant request/cost control for this Worker isolate. Durable monthly account
// usage stays with the account policy/Roma usage boundary, not San Francisco.
const budgetCache = new Map<string, BudgetState>();

// Parsed once per isolate from deploy-time config. This estimates request cost for
// grant ceilings; it is not the source of truth for customer billing.
let cachedPriceTable: Record<string, PriceEntry> | null = null;

function resolvePriceTable(env: Env): Record<string, PriceEntry> {
  if (cachedPriceTable) return cachedPriceTable;
  let parsed: Record<string, PriceEntry> = {};
  const raw = typeof env.AI_PRICE_TABLE_JSON === 'string' ? env.AI_PRICE_TABLE_JSON.trim() : '';
  if (raw) {
    try {
      const json = JSON.parse(raw) as Record<string, Partial<PriceEntry>>;
      for (const [modelKey, entry] of Object.entries(json)) {
        if (!modelKey.includes(':')) continue;
        const prompt = entry?.promptUsdPer1M;
        const completion = entry?.completionUsdPer1M;
        if (typeof prompt !== 'number' || !Number.isFinite(prompt) || prompt <= 0) continue;
        if (typeof completion !== 'number' || !Number.isFinite(completion) || completion <= 0) continue;
        parsed[modelKey] = { promptUsdPer1M: prompt, completionUsdPer1M: completion };
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
    grant.sub.kind === 'user'
      ? `${grant.sub.userId}:${grant.sub.accountId}`
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
  const entry = resolvePriceTable(env)[`${usage.provider}:${usage.model}`];
  if (!entry) return null;
  const promptTokens = usage.promptTokens;
  const completionTokens = usage.completionTokens;
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  const promptCost = (promptTokens / 1_000_000) * entry.promptUsdPer1M;
  const completionCost = (completionTokens / 1_000_000) * entry.completionUsdPer1M;
  return promptCost + completionCost;
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
  const selection = resolveModelSelection({ grant: args.grant, agentId: args.agentId });

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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
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
      if (isRetryableProviderFailure(err) && attempt < 2) {
        await sleep(120);
        continue;
      }
      throw err;
    }
  }
  if (!result && lastError) throw lastError;
  if (!result) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: selection.provider, message: 'Empty model response' });

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
