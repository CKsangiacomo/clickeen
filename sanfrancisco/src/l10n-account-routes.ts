import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  validateTranslatedValuesForProducerItems as validateTranslatedValuesForSavedTextItems,
  type TranslatedValueMap,
} from '@clickeen/ck-contracts/translated-value-primitives';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { assertCap, verifyGrant } from './grants';
import { resolveModelSelection } from './ai/modelRouter';
import { HttpError, asTrimmedString, isRecord, json, noStore, readJson } from './http';
import type { AIGrant, Env, InteractionEvent, Usage } from './types';
import {
  MAX_TOTAL_INPUT_CHARS,
  MAX_TOTAL_ITEMS,
  buildSystemPrompt,
  buildStructuredTranslationPlan,
  buildUserPrompt,
  chunkTranslationEntries,
  executeTranslationModel,
  isLikelyNonTranslatableLiteral,
  parseTranslationResult,
  restoreStructuredTranslationResults,
  type TranslationItem,
} from './agents/l10nTranslationCore';

const TRANSLATOR_AGENT_ID = 'widget.instance.translator';

export type SavedTextGraphItem = {
  path: string;
  type: 'string' | 'richtext';
  label?: string;
  role?: string;
  value: string;
};

export type SavedTextGraphTranslationRequest = {
  v: 1;
  widgetType: string;
  sourceLanguage: string;
  targetLanguage: string;
  items: SavedTextGraphItem[];
};

export type CurrentLanguageValuesResult = {
  v: 1;
  values: TranslatedValueMap;
  usage?: Usage;
};

export type InstanceTranslationAgentRequest = {
  v: 1;
  operation: 'translate_saved_instance';
  accountId: string;
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  targetLocale: string;
  jobId: string;
  currentSavedTextGraph: SavedTextGraphItem[];
};

export type InstanceTranslationAgentResult = {
  v: 1;
  operation: 'translate_saved_instance';
  accountId: string;
  instanceId: string;
  widgetType: string;
  targetLocale: string;
  jobId: string;
  currentLanguageValues: CurrentLanguageValuesResult;
  usage?: Usage;
};

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

function assertProviderConfigured(env: Env, provider: string): void {
  if (provider === 'deepseek' && !env.DEEPSEEK_API_KEY) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'deepseek',
      message: 'AI provider is unavailable.',
    });
  }
  if (provider === 'openai' && !env.OPENAI_API_KEY) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'openai',
      message: 'AI provider is unavailable.',
    });
  }
}

function normalizeSavedTextItems(raw: unknown): SavedTextGraphItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: SavedTextGraphItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.value !== 'string') return null;
    const path = asTrimmedString(entry.path);
    if (!path || seen.has(path) || path.includes('*') || path.includes('[]')) return null;
    if (entry.type !== 'string' && entry.type !== 'richtext') return null;
    seen.add(path);
    items.push({
      path,
      type: entry.type,
      ...(asTrimmedString(entry.label) ? { label: asTrimmedString(entry.label) as string } : {}),
      ...(asTrimmedString(entry.role) ? { role: asTrimmedString(entry.role) as string } : {}),
      value: entry.value,
    });
  }
  return items;
}

export function normalizeInstanceTranslationAgentRequest(raw: unknown): InstanceTranslationAgentRequest | null {
  if (!isRecord(raw) || raw.v !== 1 || raw.operation !== 'translate_saved_instance') return null;
  const accountId = asTrimmedString(raw.accountId);
  const instanceId = asTrimmedString(raw.instanceId);
  const widgetType = asTrimmedString(raw.widgetType);
  const baseLocale = normalizeLocaleToken(raw.baseLocale);
  const targetLocale = normalizeLocaleToken(raw.targetLocale);
  const jobId = asTrimmedString(raw.jobId);
  const currentSavedTextGraph = normalizeSavedTextItems(raw.currentSavedTextGraph);
  if (
    !accountId ||
    !instanceId ||
    !widgetType ||
    !baseLocale ||
    !targetLocale ||
    baseLocale === targetLocale ||
    !jobId ||
    !currentSavedTextGraph
  ) {
    return null;
  }
  return {
    v: 1,
    operation: 'translate_saved_instance',
    accountId,
    instanceId,
    widgetType,
    baseLocale,
    targetLocale,
    jobId,
    currentSavedTextGraph,
  };
}

function asTranslationItem(item: SavedTextGraphItem): TranslationItem {
  return {
    path: item.path,
    type: item.type,
    label: item.label,
    role: item.role,
    promptType: item.type,
    value: item.value,
  };
}

async function sendInstanceTranslationAudit(args: {
  env: Env;
  ctx?: WaitUntilContext;
  requestId: string;
  agentId: string;
  grant: AIGrant;
  request: InstanceTranslationAgentRequest;
  result: InstanceTranslationAgentResult;
  startedAtMs: number;
}): Promise<void> {
  if (!args.env.SF_EVENTS) return;
  const event: InteractionEvent = {
    v: 1,
    requestId: args.requestId,
    agentId: args.agentId,
    occurredAtMs: args.startedAtMs,
    subject: args.grant.sub,
    trace: args.grant.trace,
    ai: {
      policyProfile: args.grant.ai?.policyProfile,
      policyVersion: args.grant.ai?.policyVersion,
      learningCapture: args.grant.ai?.learningCapture,
      taskClass: resolveAiAgent(args.agentId)?.entry.taskClass,
    },
    input: args.request,
    result: {
      ...args.result,
      meta: {
        outcome: 'translated',
        operation: args.result.operation,
      },
    },
    ...(args.result.usage ? { usage: args.result.usage } : {}),
  };

  const sendPromise = args.env.SF_EVENTS.send(event).catch((err: unknown) => {
    console.error('[sanfrancisco] SF_EVENTS.send failed', err);
  });
  if (args.ctx) {
    args.ctx.waitUntil(sendPromise);
    return;
  }
  await sendPromise;
}

export async function produceCurrentLanguageValues(args: {
  env: Env;
  grant: AIGrant;
  request: SavedTextGraphTranslationRequest;
}): Promise<CurrentLanguageValuesResult> {
  const items = args.request.items.map(asTranslationItem);
  const directValues = new Map<string, string>();
  const modelItems: TranslationItem[] = [];

  for (const item of items) {
    if (!item.value.trim() || isLikelyNonTranslatableLiteral(item.value)) {
      directValues.set(item.path, item.value);
      continue;
    }
    modelItems.push(item);
  }

  const structuredPlan = buildStructuredTranslationPlan(modelItems);
  const modelEntries = structuredPlan.modelEntries;
  if (modelEntries.length > MAX_TOTAL_ITEMS) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Too many translatable items (${modelEntries.length})`,
    });
  }

  const totalChars = modelEntries.reduce((sum, item) => sum + item.value.length, 0);
  if (totalChars > MAX_TOTAL_INPUT_CHARS) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Input too large (${totalChars} chars)`,
    });
  }

  const values: TranslatedValueMap = Object.fromEntries(directValues);
  let usage: Usage | undefined;

  if (modelEntries.length > 0) {
    const system = buildSystemPrompt({
      locale: args.request.targetLanguage,
      widgetType: args.request.widgetType,
      items: modelEntries,
    });
    const batches = chunkTranslationEntries(modelEntries);
    const translatedItems: Array<{ path: string; value: string }> = [];
    let provider = '';

    for (const batch of batches) {
      const result = await executeTranslationModel({
        env: args.env,
        grant: args.grant,
        agentId: TRANSLATOR_AGENT_ID,
        system,
        user: buildUserPrompt(batch),
      });
      provider = result.usage.provider;
      if (!provider || !result.usage.model.trim() || !Number.isInteger(result.usage.promptTokens) || result.usage.promptTokens < 0 || !Number.isInteger(result.usage.completionTokens) || result.usage.completionTokens < 0 || (usage && (usage.provider !== result.usage.provider || usage.model !== result.usage.model))) throw new HttpError(502, { code: 'PROVIDER_ERROR', provider, message: 'Translation usage invalid' });
      usage = usage ? { ...usage, promptTokens: usage.promptTokens + result.usage.promptTokens, completionTokens: usage.completionTokens + result.usage.completionTokens, latencyMs: usage.latencyMs + result.usage.latencyMs } : result.usage;
      translatedItems.push(
        ...parseTranslationResult(result.content, batch, provider),
      );
    }

    const restored = restoreStructuredTranslationResults({
      entries: modelItems,
      plan: structuredPlan,
      translatedItems,
      provider,
    });
    for (const item of restored) {
      values[item.path] = item.value;
    }
  }

  const exact = validateTranslatedValuesForSavedTextItems(args.request.items, values);
  if (!exact.ok) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `Instance Translation Agent output ${exact.reason}: ${exact.path}`,
    });
  }

  return {
    v: 1,
    values,
    ...(usage ? { usage } : {}),
  };
}

export async function produceInstanceTranslationValues(args: {
  env: Env;
  grant: AIGrant;
  request: InstanceTranslationAgentRequest;
}): Promise<InstanceTranslationAgentResult> {
  const produced = await produceCurrentLanguageValues({
    env: args.env,
    grant: args.grant,
    request: {
      v: 1,
      widgetType: args.request.widgetType,
      sourceLanguage: args.request.baseLocale,
      targetLanguage: args.request.targetLocale,
      items: args.request.currentSavedTextGraph,
    },
  });

  return {
    v: 1,
    operation: 'translate_saved_instance',
    accountId: args.request.accountId,
    instanceId: args.request.instanceId,
    widgetType: args.request.widgetType,
    targetLocale: args.request.targetLocale,
    jobId: args.request.jobId,
    currentLanguageValues: {
      v: 1,
      values: produced.values,
    },
    ...(produced.usage ? { usage: produced.usage } : {}),
  };
}

export async function handleInstanceTranslationAgent(
  request: Request,
  env: Env,
  ctx?: WaitUntilContext,
  requestId: string = crypto.randomUUID(),
): Promise<Response> {
  const resolvedAgent = resolveAiAgent(TRANSLATOR_AGENT_ID);
  if (!resolvedAgent) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing AI registry entry for Instance Translation Agent',
    });
  }

  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Missing AI grant' });
  }
  const grant = await verifyGrant(token, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${resolvedAgent.canonicalId}`);

  const body = normalizeInstanceTranslationAgentRequest(await readJson(request));
  if (!body) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Expected translate saved instance request',
    });
  }

  const startedAtMs = Date.now();
  const result = await produceInstanceTranslationValues({ env, grant, request: body });
  await sendInstanceTranslationAudit({
    env,
    ctx,
    requestId,
    agentId: resolvedAgent.canonicalId,
    grant,
    request: body,
    result,
    startedAtMs,
  });
  return noStore(json(result));
}

export async function handleInstanceTranslationRuntimeStatus(
  request: Request,
  env: Env,
): Promise<Response> {
  const resolvedAgent = resolveAiAgent(TRANSLATOR_AGENT_ID);
  if (!resolvedAgent) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing AI registry entry for Instance Translation Agent',
    });
  }

  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Missing AI grant' });
  }
  const grant = await verifyGrant(token, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${resolvedAgent.canonicalId}`);
  const selection = resolveModelSelection({ grant, agentId: resolvedAgent.canonicalId });
  assertProviderConfigured(env, selection.provider);

  return noStore(
    json({
      ok: true,
      agentId: resolvedAgent.canonicalId,
      provider: selection.provider,
      model: selection.model,
    }),
  );
}
