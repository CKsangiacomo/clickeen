import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  resolveAiAgent,
  type AiGrantPolicy,
} from '@clickeen/ck-contracts/ai';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type PolicyProfile,
} from '@clickeen/ck-policy';
import { HttpError, asTrimmedString, isRecord } from './http';
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

function buildInternalGrant(args: {
  env: Env;
  policyProfile: PolicyProfile;
}): AIGrant {
  const resolvedAgent = resolveAiAgent('widget.instance.translator');
  if (!resolvedAgent) {
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: 'Missing AI registry entry for account l10n generation',
    });
  }

  const ai: AiGrantPolicy = resolveAiRuntimePolicy({
    entry: resolvedAgent.entry,
    policyProfile: args.policyProfile,
  });
  const budget = resolveAiRuntimeBudget(ai);

  const nowSec = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    iss: 'sanfrancisco',
    jti: crypto.randomUUID(),
    sub: { kind: 'service', serviceId: 'roma.account.l10n' },
    exp: nowSec + 10 * 60,
    caps: ['agent:widget.instance.translator'],
    budgets: {
      maxTokens: budget.maxTokens,
      timeoutMs: budget.timeoutMs,
      // One Roma save/publication request may batch many provider calls across locales/items.
      maxRequests: 512,
      ...(typeof budget.maxCostUsd === 'number' ? { maxCostUsd: budget.maxCostUsd } : {}),
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
        agentId: 'widget.instance.translator',
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
