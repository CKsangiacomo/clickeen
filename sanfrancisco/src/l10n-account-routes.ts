import { normalizeLocaleToken } from '@clickeen/l10n';
import type { AiGrantPolicy } from '@clickeen/ck-policy';
import { HttpError, isRecord, noStore, readJson, json } from './http';
import { assertInternalAuth, asTrimmedString } from './internalAuth';
import type { AIGrant, Env, Usage } from './types';
import {
  MAX_TOTAL_INPUT_CHARS,
  MAX_TOTAL_ITEMS,
  assertTranslationSafety,
  buildRichtextMaskPlan,
  buildSystemPrompt,
  buildUserPrompt,
  chunkTranslationEntries,
  collectTranslatableEntries,
  deepseekTranslate,
  deleteMergedByPathOrPattern,
  expandPathPatterns,
  isLikelyNonTranslatableLiteral,
  mergeUsage,
  normalizeMaskedTagPlaceholders,
  parseTranslationResult,
  restoreMaskedRichtextTags,
  translateRichtextWithSegmentFallback,
  type AllowlistEntry,
  type RichtextMaskPlan,
  type TranslationItem,
} from './agents/l10nTranslationCore';

type LocalizationOp = { op: 'set'; path: string; value: string };
type L10nProvider = 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';

function normalizeAllowlist(raw: unknown): AllowlistEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => isRecord(entry) && typeof entry.path === 'string')
    .map((entry) => ({
      path: String(entry.path || '').trim(),
      type: entry.type === 'richtext' ? ('richtext' as const) : ('string' as const),
    }))
    .filter((entry) => entry.path);
}

function normalizeOps(raw: unknown): LocalizationOp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => isRecord(entry) && entry.op === 'set')
    .map((entry) => ({
      op: 'set' as const,
      path: typeof entry.path === 'string' ? entry.path.trim() : '',
      value: typeof entry.value === 'string' ? entry.value : '',
    }))
    .filter((entry) => entry.path);
}

function normalizePathList(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  return Array.from(
    new Set(
      raw
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function resolveProvider(env: Env): L10nProvider {
  if (asTrimmedString(env.DEEPSEEK_API_KEY)) return 'deepseek';
  if (asTrimmedString(env.OPENAI_API_KEY)) return 'openai';
  if (asTrimmedString(env.ANTHROPIC_API_KEY)) return 'anthropic';
  if (asTrimmedString(env.GROQ_API_KEY)) return 'groq';
  if (
    asTrimmedString(env.NOVA_API_KEY) ||
    (asTrimmedString(env.AMAZON_BEDROCK_ACCESS_KEY_ID) &&
      asTrimmedString(env.AMAZON_BEDROCK_SECRET_ACCESS_KEY) &&
      asTrimmedString(env.AMAZON_BEDROCK_REGION))
  ) {
    return 'amazon';
  }
  throw new HttpError(503, {
    code: 'PROVIDER_ERROR',
    provider: 'sanfrancisco',
    message: 'No configured model provider for account l10n generation',
  });
}

function resolveProviderModel(env: Env, provider: L10nProvider): string {
  if (provider === 'deepseek') return env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  if (provider === 'openai') return env.OPENAI_MODEL ?? 'gpt-5.2';
  if (provider === 'groq') return env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  if (provider === 'amazon') {
    return env.NOVA_MODEL ?? env.AMAZON_BEDROCK_MODEL_ID ?? 'nova-2-lite-v1';
  }
  return env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620';
}

function buildInternalGrant(env: Env): AIGrant {
  const provider = resolveProvider(env);
  const model = resolveProviderModel(env, provider);
  const models = {
    [provider]: {
      defaultModel: model,
      allowed: [model],
    },
  } as NonNullable<AiGrantPolicy['models']>;

  const ai: AiGrantPolicy = {
    profile: 'paid_standard',
    allowedProviders: [provider],
    defaultProvider: provider,
    models,
  };

  const nowSec = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    iss: 'paris',
    jti: crypto.randomUUID(),
    sub: { kind: 'service', serviceId: 'roma.account.l10n' },
    exp: nowSec + 10 * 60,
    caps: ['agent:l10n.instance.v1'],
    budgets: {
      maxTokens: 1200,
      timeoutMs: 35_000,
      maxRequests: 512,
    },
    mode: 'ops',
    ai,
    trace: {
      sessionId: crypto.randomUUID(),
      envStage: asTrimmedString(env.ENVIRONMENT) ?? 'dev',
    },
  };
}

async function generateLocaleOps(args: {
  env: Env;
  grant: AIGrant;
  widgetType: string;
  locale: string;
  entries: TranslationItem[];
  existingOps: LocalizationOp[];
  changedPaths: string[] | null;
  removedPaths: string[];
}): Promise<{ ops: LocalizationOp[]; usage?: Usage }> {
  const entryMap = new Map(args.entries.map((entry) => [entry.path, entry]));
  const candidatePaths = Array.from(
    new Set([
      ...args.entries.map((entry) => entry.path),
      ...args.existingOps.map((op) => op.path),
    ]),
  );
  const expandedChangedPaths =
    args.changedPaths == null
      ? null
      : expandPathPatterns(args.changedPaths, candidatePaths);
  const removedSet = new Set(expandPathPatterns(args.removedPaths, candidatePaths));

  const translateAll = expandedChangedPaths == null;
  const targetPaths = translateAll
    ? args.entries.map((entry) => entry.path)
    : expandedChangedPaths;

  const translateEntries: TranslationItem[] = [];
  const richtextMaskPlans = new Map<string, RichtextMaskPlan>();
  const directOps: LocalizationOp[] = [];

  targetPaths.forEach((path) => {
    const entry = entryMap.get(path);
    if (!entry) {
      removedSet.add(path);
      return;
    }
    if (!entry.value.trim()) {
      directOps.push({ op: 'set', path: entry.path, value: '' });
      return;
    }
    if (isLikelyNonTranslatableLiteral(entry.value)) {
      directOps.push({ op: 'set', path: entry.path, value: entry.value });
      return;
    }
    if (entry.type === 'richtext') {
      const maskPlan = buildRichtextMaskPlan(entry);
      if (maskPlan) {
        richtextMaskPlans.set(entry.path, maskPlan);
        translateEntries.push({ path: entry.path, type: 'string', value: maskPlan.masked });
        return;
      }
    }
    translateEntries.push(entry);
  });

  if (translateEntries.length > MAX_TOTAL_ITEMS) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Too many translatable items (${translateEntries.length})`,
    });
  }

  const totalChars = translateEntries.reduce((sum, item) => sum + item.value.length, 0);
  if (totalChars > MAX_TOTAL_INPUT_CHARS) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `Input too large (${totalChars} chars)`,
    });
  }

  const translatedOps: LocalizationOp[] = [];
  let usage: Usage | undefined;

  if (translateEntries.length > 0) {
    const system = buildSystemPrompt({
      locale: args.locale,
      widgetType: args.widgetType,
      items: translateEntries,
    });
    const batches = chunkTranslationEntries(translateEntries);

    for (const batch of batches) {
      const user = buildUserPrompt(batch);
      const result = await deepseekTranslate({
        env: args.env,
        grant: args.grant,
        agentId: 'l10n.instance.v1',
        system,
        user,
      });
      usage = mergeUsage(usage, result.usage);
      const translated = parseTranslationResult(
        result.content,
        batch,
        result.usage.provider || 'deepseek',
      );

      for (const item of translated) {
        const maskPlan = richtextMaskPlans.get(item.path);
        if (!maskPlan) {
          translatedOps.push({ op: 'set', path: item.path, value: item.value });
          continue;
        }

        const normalizedMasked = normalizeMaskedTagPlaceholders(item.value, maskPlan.tags);
        const restored = restoreMaskedRichtextTags(normalizedMasked, maskPlan.tags);
        const expected = entryMap.get(item.path);
        if (!expected) continue;

        try {
          assertTranslationSafety(expected, restored, result.usage.provider || 'deepseek');
          translatedOps.push({ op: 'set', path: item.path, value: restored });
        } catch {
          const fallback = await translateRichtextWithSegmentFallback({
            env: args.env,
            grant: args.grant,
            agentId: 'l10n.instance.v1',
            locale: args.locale,
            widgetType: args.widgetType,
            expected,
          });
          if (fallback.usage) usage = mergeUsage(usage, fallback.usage);
          translatedOps.push({ op: 'set', path: item.path, value: fallback.value });
        }
      }
    }
  }

  const merged = new Map<string, string>();
  args.existingOps.forEach((op) => {
    if (entryMap.has(op.path)) merged.set(op.path, op.value);
  });

  removedSet.forEach((pathOrPattern) => {
    deleteMergedByPathOrPattern(merged, pathOrPattern);
  });

  [...directOps, ...translatedOps].forEach((op) => {
    merged.set(op.path, op.value);
  });

  const ops = Array.from(merged.entries()).map(([path, value]) => ({
    op: 'set' as const,
    path,
    value,
  }));

  return { ops, ...(usage ? { usage } : {}) };
}

export async function handleAccountL10nOpsGenerate(
  request: Request,
  env: Env,
): Promise<Response> {
  const environment = asTrimmedString(env.ENVIRONMENT);
  if (environment !== 'local' && environment !== 'dev') {
    throw new HttpError(404, { code: 'BAD_REQUEST', message: 'Not found' });
  }

  assertInternalAuth(request, env);

  const body = await readJson(request);
  if (!isRecord(body)) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'body must be an object' });
  }

  const widgetType = asTrimmedString(body.widgetType);
  const config = isRecord(body.config) ? (body.config as Record<string, unknown>) : null;
  const allowlist = normalizeAllowlist(body.allowlist);
  const baseLocale = normalizeLocaleToken(body.baseLocale) ?? null;

  const targetLocalesRaw = Array.isArray(body.targetLocales) ? body.targetLocales : [];
  const targetLocales = Array.from(
    new Set(
      targetLocalesRaw
        .map((entry) => normalizeLocaleToken(entry))
        .filter((locale): locale is string => Boolean(locale && locale !== baseLocale)),
    ),
  );

  if (!widgetType) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: widgetType',
    });
  }
  if (!config) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: config',
    });
  }
  if (!allowlist.length) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: allowlist',
    });
  }
  if (!baseLocale) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: baseLocale',
    });
  }
  if (!targetLocales.length) {
    return noStore(json({ ok: true, results: [] }));
  }

  const changedPaths = normalizePathList(body.changedPaths);
  const removedPaths = normalizePathList(body.removedPaths) ?? [];
  const existingBaseOpsByLocale = isRecord(body.existingBaseOpsByLocale)
    ? (body.existingBaseOpsByLocale as Record<string, unknown>)
    : {};

  const entries = collectTranslatableEntries(config, allowlist, true);
  const grant = buildInternalGrant(env);

  const results = await Promise.all(
    targetLocales.map(async (locale) => {
      const existingOps = normalizeOps(existingBaseOpsByLocale[locale]);
      try {
        const generated = await generateLocaleOps({
          env,
          grant,
          widgetType,
          locale,
          entries,
          existingOps,
          changedPaths,
          removedPaths,
        });

        return {
          locale,
          ops: generated.ops,
          ...(generated.usage ? { usage: generated.usage } : {}),
        };
      } catch (error) {
        return {
          locale,
          ops: existingOps,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return noStore(json({ ok: true, results }));
}
