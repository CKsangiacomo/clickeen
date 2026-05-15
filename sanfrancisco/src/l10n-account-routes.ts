import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  validateOverlayValuesForProducerItems,
  type BabelTextProducerItem,
  type BabelTextProducerRequest,
  type BabelTextProducerResponse,
  type OverlayValueMap,
} from '@clickeen/ck-contracts/overlay-primitives';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { assertCap, verifyGrant } from './grants';
import { HttpError, asTrimmedString, isRecord, json, noStore, readJson } from './http';
import type { AIGrant, Env, Usage } from './types';
import {
  MAX_TOTAL_INPUT_CHARS,
  MAX_TOTAL_ITEMS,
  buildSystemPrompt,
  buildStructuredTranslationPlan,
  buildUserPrompt,
  chunkTranslationEntries,
  executeTranslationModel,
  isLikelyNonTranslatableLiteral,
  mergeUsage,
  parseTranslationResult,
  restoreStructuredTranslationResults,
  type TranslationItem,
} from './agents/l10nTranslationCore';

const TRANSLATOR_AGENT_ID = 'widget.instance.translator';

export type BabelTextValuesResult = BabelTextProducerResponse & {
  usage?: Usage;
};

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

function normalizeProducerItems(raw: unknown): BabelTextProducerItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((entry) => isRecord(entry))
    .map((entry) => ({
      path: asTrimmedString(entry.path) ?? '',
      type: entry.type === 'richtext' ? ('richtext' as const) : ('string' as const),
      value: typeof entry.value === 'string' ? entry.value : null,
    }));
  if (items.some((entry) => !entry.path || entry.value == null)) return null;
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.path)) return null;
    if (item.path.includes('*') || item.path.includes('[]')) return null;
    seen.add(item.path);
  }
  return items as BabelTextProducerItem[];
}

export function normalizeBabelTextProducerRequest(raw: unknown): BabelTextProducerRequest | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const widgetType = asTrimmedString(raw.widgetType);
  const sourceLanguage = normalizeLocaleToken(raw.sourceLanguage);
  const targetLanguage = normalizeLocaleToken(raw.targetLanguage);
  const items = normalizeProducerItems(raw.items);
  if (!widgetType || !sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage || !items) {
    return null;
  }
  return {
    v: 1,
    widgetType,
    sourceLanguage,
    targetLanguage,
    items,
  };
}

function asTranslationItem(item: BabelTextProducerItem): TranslationItem {
  return {
    path: item.path,
    type: item.type,
    promptType: item.type,
    value: item.value,
  };
}

export async function produceBabelTextValues(args: {
  env: Env;
  grant: AIGrant;
  request: BabelTextProducerRequest;
}): Promise<BabelTextValuesResult> {
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

  const values: OverlayValueMap = Object.fromEntries(directValues);
  let usage: Usage | undefined;

  if (modelEntries.length > 0) {
    const system = buildSystemPrompt({
      locale: args.request.targetLanguage,
      widgetType: args.request.widgetType,
      items: modelEntries,
    });
    const batches = chunkTranslationEntries(modelEntries);
    const translatedItems: Array<{ path: string; value: string }> = [];
    let provider: string = args.grant.ai?.selectedModel?.provider ?? args.grant.ai?.defaultModel?.provider ?? 'deepseek';

    for (const batch of batches) {
      const result = await executeTranslationModel({
        env: args.env,
        grant: args.grant,
        agentId: TRANSLATOR_AGENT_ID,
        system,
        user: buildUserPrompt(batch),
      });
      usage = mergeUsage(usage, result.usage);
      provider = result.usage.provider || provider;
      translatedItems.push(
        ...parseTranslationResult(result.content, batch, result.usage.provider || provider),
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

  const exact = validateOverlayValuesForProducerItems(args.request.items, values);
  if (!exact.ok) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `Producer output ${exact.reason}: ${exact.path}`,
    });
  }

  return {
    v: 1,
    values,
    ...(usage ? { usage } : {}),
  };
}

export async function handleBabelTextValues(request: Request, env: Env): Promise<Response> {
  const resolvedAgent = resolveAiAgent(TRANSLATOR_AGENT_ID);
  if (!resolvedAgent) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing AI registry entry for Babel text production',
    });
  }

  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Missing AI grant' });
  }
  const grant = await verifyGrant(token, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${resolvedAgent.canonicalId}`);

  const body = normalizeBabelTextProducerRequest(await readJson(request));
  if (!body) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Expected Babel text producer request',
    });
  }

  return noStore(json(await produceBabelTextValues({ env, grant, request: body })));
}
