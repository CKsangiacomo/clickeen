import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  resolveAiAgent,
  resolveAiBudgets,
  resolveAiDefaultProvider,
  resolveAiModels,
  resolveAiPolicyCapsule,
  type AiGrantPolicy,
  type AiProvider,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import { HttpError, isRecord } from './http';
import { asTrimmedString } from './internalAuth';
import type { AIGrant, Env, Usage } from './types';
import {
  MAX_TOTAL_INPUT_CHARS,
  MAX_TOTAL_ITEMS,
  buildSystemPrompt,
  buildStructuredTranslationPlan,
  buildUserPrompt,
  chunkTranslationEntries,
  executeTranslationModel,
  deleteMergedByPathOrPattern,
  expandPathPatterns,
  isLikelyNonTranslatableLiteral,
  mergeUsage,
  parseTranslationResult,
  restoreStructuredTranslationResults,
  type TranslationItem,
} from './agents/l10nTranslationCore';

type LocalizationOp = { op: 'set'; path: string; value: string };

export type AccountWidgetL10nGenerateRequest = {
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  items: Array<{
    path: string;
    type: 'string' | 'richtext';
    value: string;
  }>;
  existingOpsByLocale: Record<string, LocalizationOp[]>;
  changedPaths: string[] | null;
  removedPaths: string[];
  policyProfile: PolicyProfile;
};

export type AccountWidgetL10nGenerateResponse = {
  results: Array<
    | {
        locale: string;
        ok: true;
        ops: LocalizationOp[];
        usage?: Usage;
      }
    | {
        locale: string;
        ok: false;
        ops: LocalizationOp[];
        error: string;
      }
  >;
};

export function normalizePolicyProfile(value: unknown): PolicyProfile | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    normalized === 'free' ||
    normalized === 'tier1' ||
    normalized === 'tier2' ||
    normalized === 'tier3'
  ) {
    return normalized;
  }
  return null;
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

function normalizeTranslationItems(raw: unknown): TranslationItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw
    .filter((entry) => isRecord(entry) && typeof entry.path === 'string')
    .map((entry) => ({
      path: String(entry.path || '').trim(),
      type: entry.type === 'richtext' ? ('richtext' as const) : ('string' as const),
      value: typeof entry.value === 'string' ? entry.value : '',
    }))
    .filter((entry) => entry.path);
  const seen = new Set<string>();
  return items.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
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

function providerHasCredentials(env: Env, provider: AiProvider): boolean {
  if (provider === 'deepseek') return Boolean(asTrimmedString(env.DEEPSEEK_API_KEY));
  if (provider === 'openai') return Boolean(asTrimmedString(env.OPENAI_API_KEY));
  if (provider === 'anthropic') return Boolean(asTrimmedString(env.ANTHROPIC_API_KEY));
  if (provider === 'groq') return Boolean(asTrimmedString(env.GROQ_API_KEY));
  if (provider === 'amazon') {
    return (
      Boolean(asTrimmedString(env.NOVA_API_KEY)) ||
      (Boolean(asTrimmedString(env.AMAZON_BEDROCK_ACCESS_KEY_ID)) &&
        Boolean(asTrimmedString(env.AMAZON_BEDROCK_SECRET_ACCESS_KEY)) &&
        Boolean(asTrimmedString(env.AMAZON_BEDROCK_REGION)))
    );
  }
  return false;
}

function buildInternalGrant(args: {
  env: Env;
  policyProfile: PolicyProfile;
}): AIGrant {
  const resolvedAgent = resolveAiAgent('l10n.instance.v1');
  if (!resolvedAgent) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing AI registry entry for account l10n generation',
    });
  }

  const baseAi = resolveAiPolicyCapsule({
    entry: resolvedAgent.entry,
    policyProfile: args.policyProfile,
  });
  const allowedProviders = baseAi.allowedProviders.filter((provider) =>
    providerHasCredentials(args.env, provider),
  );
  if (!allowedProviders.length) {
    throw new HttpError(503, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `No model provider credentials for account l10n generation (${baseAi.profile})`,
    });
  }

  const defaultProvider = allowedProviders.includes(baseAi.defaultProvider)
    ? baseAi.defaultProvider
    : resolveAiDefaultProvider(baseAi.profile, allowedProviders);
  const models = Object.fromEntries(
    allowedProviders
      .map((provider) => {
        const policy = resolveAiModels(baseAi.profile, provider);
        return policy ? [provider, policy] : null;
      })
      .filter(Boolean) as Array<[AiProvider, NonNullable<AiGrantPolicy['models']>[AiProvider]]>,
  ) as NonNullable<AiGrantPolicy['models']>;
  const budget = resolveAiBudgets(resolvedAgent.entry, baseAi.profile);
  const ai: AiGrantPolicy = {
    ...baseAi,
    allowedProviders,
    defaultProvider,
    models,
  };

  const nowSec = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    iss: 'sanfrancisco',
    jti: crypto.randomUUID(),
    sub: { kind: 'service', serviceId: 'roma.account.l10n' },
    exp: nowSec + 10 * 60,
    caps: ['agent:l10n.instance.v1'],
    budgets: {
      maxTokens: budget.maxTokens,
      timeoutMs: budget.timeoutMs,
      // One Roma save/publication request may batch many provider calls across locales/items.
      maxRequests: 512,
    },
    mode: 'ops',
    ai,
    trace: {
      sessionId: crypto.randomUUID(),
      envStage: asTrimmedString(args.env.ENVIRONMENT) ?? 'dev',
    },
  };
}

export async function generateAccountWidgetLocaleOps(args: {
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
    translateEntries.push(entry);
  });

  const structuredPlan = buildStructuredTranslationPlan(translateEntries);
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

  const translatedOps: LocalizationOp[] = [];
  let usage: Usage | undefined;

  if (modelEntries.length > 0) {
    const system = buildSystemPrompt({
      locale: args.locale,
      widgetType: args.widgetType,
      items: modelEntries,
    });
    const batches = chunkTranslationEntries(modelEntries);
    const translatedItems: Array<{ path: string; value: string }> = [];
    let provider = 'deepseek';

    for (const batch of batches) {
      const user = buildUserPrompt(batch);
      const result = await executeTranslationModel({
        env: args.env,
        grant: args.grant,
        agentId: 'l10n.instance.v1',
        system,
        user,
      });
      usage = mergeUsage(usage, result.usage);
      provider = result.usage.provider || provider;
      const translated = parseTranslationResult(
        result.content,
        batch,
        result.usage.provider || 'deepseek',
      );
      translatedItems.push(...translated);
    }

    const restoredItems = restoreStructuredTranslationResults({
      entries: translateEntries,
      plan: structuredPlan,
      translatedItems,
      provider,
    });
    restoredItems.forEach((item) => {
      translatedOps.push({ op: 'set', path: item.path, value: item.value });
    });
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

export async function generateAccountWidgetL10nOps(
  request: AccountWidgetL10nGenerateRequest,
  env: Env,
): Promise<AccountWidgetL10nGenerateResponse> {
  const widgetType = asTrimmedString(request.widgetType);
  const baseLocale = normalizeLocaleToken(request.baseLocale) ?? null;
  const policyProfile = normalizePolicyProfile(request.policyProfile);
  const entries = normalizeTranslationItems(request.items);
  const targetLocalesRaw = Array.isArray(request.targetLocales) ? request.targetLocales : [];
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
  if (!entries) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: items',
    });
  }
  if (!baseLocale) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: baseLocale',
    });
  }
  if (!policyProfile) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required field: policyProfile',
    });
  }
  if (!targetLocales.length) {
    return { results: [] };
  }

  const changedPaths = normalizePathList(request.changedPaths);
  const removedPaths = normalizePathList(request.removedPaths) ?? [];
  const existingOpsByLocale = isRecord(request.existingOpsByLocale)
    ? (request.existingOpsByLocale as Record<string, unknown>)
    : {};
  const grant = buildInternalGrant({ env, policyProfile });

  const results = await Promise.all(
    targetLocales.map(async (locale) => {
      const existingOps = normalizeOps(existingOpsByLocale[locale]);
      try {
        const generated = await generateAccountWidgetLocaleOps({
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
          ok: true as const,
          ops: generated.ops,
          ...(generated.usage ? { usage: generated.usage } : {}),
        };
      } catch (error) {
        return {
          locale,
          ok: false as const,
          ops: existingOps,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return { results };
}
