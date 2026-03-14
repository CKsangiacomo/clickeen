import { computeBaseFingerprint, normalizeLocaleToken } from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import {
  MAX_TOTAL_INPUT_CHARS,
  MAX_TOTAL_ITEMS,
  POLICY_VERSION,
  PROMPT_VERSION,
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
} from './l10nTranslationCore';

type L10nJobV1 = {
  v: 1;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseUpdatedAt: string;
  kind: 'curated' | 'user';
  accountId?: string | null;
  // Legacy alias for accountId (pre account-only tenancy pivot).
  workspaceId?: string | null;
  envStage?: string;
};

type L10nJobV2 = {
  v: 2;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseFingerprint: string;
  baseUpdatedAt?: string | null;
  changedPaths?: string[];
  removedPaths?: string[];
  kind: 'curated' | 'user';
  accountId?: string | null;
  // Legacy alias for accountId (pre account-only tenancy pivot).
  workspaceId?: string | null;
  envStage?: string;
};

export type L10nJob = L10nJobV1 | L10nJobV2;

export type L10nPlanningSnapshot = {
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  snapshot: Record<string, string>;
};

type InstanceResponse = {
  publicId: string;
  status: 'published' | 'unpublished';
  widgetType?: string | null;
  config: Record<string, unknown>;
  updatedAt?: string | null;
};

type AllowlistFile = { v: 1; paths: AllowlistEntry[] };

type L10nGenerateStatus = 'running' | 'succeeded' | 'failed' | 'superseded';

export function isL10nJob(value: unknown): value is L10nJob {
  if (!isRecord(value)) return false;
  if (value.v !== 1 && value.v !== 2) return false;
  const agentId = asString(value.agentId);
  const grant = asString(value.grant);
  const publicId = asString(value.publicId);
  const widgetType = asString(value.widgetType);
  const locale = asString(value.locale);
  const kind = value.kind;
  if (!agentId || !grant || !publicId || !widgetType || !locale) return false;
  if (kind !== 'curated' && kind !== 'user') return false;
  if (value.v === 1) {
    const baseUpdatedAt = asString(value.baseUpdatedAt);
    if (!baseUpdatedAt) return false;
  }
  if (value.v === 2) {
    const baseFingerprint = asString(value.baseFingerprint);
    if (!baseFingerprint) return false;
    if (value.changedPaths != null && !Array.isArray(value.changedPaths)) return false;
    if (value.removedPaths != null && !Array.isArray(value.removedPaths)) return false;
  }
  return true;
}

function resolveJobAccountId(job: L10nJob): string | null {
  const accountId = asString((job as any).accountId);
  if (accountId) return accountId;
  const legacyWorkspaceId = asString((job as any).workspaceId);
  if (legacyWorkspaceId) return legacyWorkspaceId;
  return null;
}

function requireEnvVar(value: unknown, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed)
    throw new HttpError(500, {
      code: 'PROVIDER_ERROR',
      provider: 'sanfrancisco',
      message: `Missing ${name}`,
    });
  return trimmed;
}

function buildParisInternalHeaders(token: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-ck-internal-service', 'sanfrancisco.l10n');
  return headers;
}

function getTokyoReadBase(env: Env): string {
  return requireEnvVar((env as any).TOKYO_BASE_URL, 'TOKYO_BASE_URL');
}


async function fetchInstanceByContext(args: { accountId: string; publicId: string }, env: Env): Promise<InstanceResponse> {
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/accounts/${encodeURIComponent(args.accountId)}/instance/${encodeURIComponent(args.publicId)}?subject=account`,
    baseUrl,
  ).toString();

  const res = await fetch(url, {
    method: 'GET',
    headers: buildParisInternalHeaders(token, { 'cache-control': 'no-store' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: `Failed to load instance (${res.status}) ${text}`.trim(),
    });
  }
  const body = (await res.json().catch(() => null)) as InstanceResponse | null;
  if (!body || typeof body !== 'object' || !body.config) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: 'Invalid instance response',
    });
  }
  return body;
}

async function fetchInstance(job: L10nJob, env: Env): Promise<InstanceResponse> {
  const accountId = resolveJobAccountId(job);
  if (!accountId) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing accountId' });
  }
  return fetchInstanceByContext({ accountId, publicId: job.publicId }, env);
}

async function fetchAllowlist(widgetType: string, env: Env): Promise<AllowlistEntry[]> {
  const cacheKey = `l10n:allowlist:${widgetType}`;
  const cached = await env.SF_KV.get(cacheKey, { type: 'json' }).catch(() => null);
  if (cached && isRecord(cached) && cached.v === 1 && Array.isArray(cached.paths)) {
    return cached.paths as AllowlistEntry[];
  }

  const baseUrl = getTokyoReadBase(env);
  const url = new URL(
    `/widgets/${encodeURIComponent(widgetType)}/localization.json`,
    baseUrl,
  ).toString();
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: `Failed to load allowlist (${res.status}) ${text}`.trim(),
    });
  }
  const json = (await res.json().catch(() => null)) as AllowlistFile | null;
  if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: 'Invalid localization.json',
    });
  }

  const entries: AllowlistEntry[] = json.paths
    .map((entry) => ({
      path: typeof entry?.path === 'string' ? entry.path.trim() : '',
      type: entry?.type === 'richtext' ? ('richtext' as const) : ('string' as const),
    }))
    .filter((entry) => entry.path);

  await env.SF_KV.put(cacheKey, JSON.stringify({ v: 1, paths: entries }), { expirationTtl: 3600 });
  return entries;
}

export async function resolveL10nPlanningSnapshot(args: {
  env: Env;
  widgetType: string;
  config?: Record<string, unknown> | null;
  baseUpdatedAt?: string | null;
  accountId?: string | null;
  // Legacy alias for accountId (pre account-only tenancy pivot).
  workspaceId?: string | null;
  publicId?: string | null;
}): Promise<L10nPlanningSnapshot> {
  const widgetTypeHint = asString(args.widgetType);
  if (!widgetTypeHint) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing widgetType' });
  }

  let config: Record<string, unknown>;
  let resolvedWidgetType = widgetTypeHint;
  let resolvedBaseUpdatedAt: string | null =
    typeof args.baseUpdatedAt === 'string' && args.baseUpdatedAt.trim()
      ? args.baseUpdatedAt.trim()
      : null;

  if (args.config && isRecord(args.config)) {
    config = args.config;
  } else {
    const accountId = asString(args.accountId) || asString(args.workspaceId);
    if (!accountId) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing accountId' });
    }
    const publicId = asString(args.publicId);
    if (!publicId) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing publicId' });
    }
    const instance = await fetchInstanceByContext({ accountId, publicId }, args.env);
    resolvedWidgetType = instance.widgetType ? String(instance.widgetType) : widgetTypeHint;
    config = instance.config;
    resolvedBaseUpdatedAt = instance.updatedAt ?? resolvedBaseUpdatedAt;
  }

  const allowlist = await fetchAllowlist(resolvedWidgetType, args.env);
  const entries = collectTranslatableEntries(config, allowlist, true);
  const snapshot: Record<string, string> = {};
  entries.forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });

  return {
    widgetType: resolvedWidgetType,
    baseFingerprint: await computeBaseFingerprint(snapshot),
    baseUpdatedAt: resolvedBaseUpdatedAt,
    snapshot,
  };
}

type ExistingLocale = {
  locale: string;
  source?: string | null;
  baseFingerprint?: string | null;
  baseUpdatedAt?: string | null;
  hasUserOps?: boolean | null;
  ops?: Array<{ op: 'set'; path: string; value: string }>;
};

async function fetchExistingLocale(
  job: L10nJob,
  locale: string,
  env: Env,
): Promise<ExistingLocale | null> {
  const accountId = resolveJobAccountId(job);
  if (!accountId) return null;
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
      job.publicId,
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'account');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: buildParisInternalHeaders(token, { 'cache-control': 'no-store' }),
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as any;
  const ops = Array.isArray(body?.ops)
    ? body.ops
        .filter(
          (op: any) =>
            op && op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'string',
        )
        .map((op: any) => ({ op: 'set' as const, path: op.path, value: op.value }))
    : [];
  return {
    locale,
    source: typeof body?.source === 'string' ? body.source : null,
    baseFingerprint: typeof body?.baseFingerprint === 'string' ? body.baseFingerprint : null,
    baseUpdatedAt: typeof body?.baseUpdatedAt === 'string' ? body.baseUpdatedAt : null,
    hasUserOps: Array.isArray(body?.userOps) ? body.userOps.length > 0 : null,
    ops,
  };
}

type OverlayWriteResult = { ok: true } | { ok: false; reason: 'stale_instance' };

async function writeOverlay(
  job: L10nJob,
  locale: string,
  overlay: {
    v: 1;
    baseUpdatedAt?: string | null;
    baseFingerprint?: string | null;
    ops: Array<{ op: 'set'; path: string; value: string }>;
  },
  env: Env,
): Promise<OverlayWriteResult> {
  const accountId = resolveJobAccountId(job);
  if (!accountId) return { ok: false, reason: 'stale_instance' };
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
      job.publicId,
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'account');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: buildParisInternalHeaders(token, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      ops: overlay.ops,
      baseUpdatedAt: overlay.baseUpdatedAt ?? null,
      baseFingerprint: overlay.baseFingerprint ?? null,
      source: 'agent',
      widgetType: job.widgetType,
    }),
  });
  if (!res.ok) {
    const details = (await res.json().catch(() => null)) as any;
    const code = details?.error?.code;
    if (code === 'FINGERPRINT_MISMATCH') return { ok: false, reason: 'stale_instance' };
    const text = await res.text().catch(() => '');
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'paris',
      message: `Overlay write failed (${res.status}) ${text}`.trim(),
    });
  }
  return { ok: true };
}

async function writeLog(
  env: Env,
  job: L10nJob,
  baseFingerprint: string | null,
  payload: Record<string, unknown>,
) {
  const fallback = job.v === 2 ? job.baseFingerprint : job.baseUpdatedAt;
  const fingerprint = baseFingerprint || fallback || 'unknown';
  const key = `l10n/${job.publicId}/${job.locale}/${fingerprint}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function reportL10nGenerateStatus(args: {
  env: Env;
  job: L10nJob;
  status: L10nGenerateStatus;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  locale: string;
  error?: string | null;
  occurredAtMs?: number;
  widgetType?: string | null;
  accountId?: string | null;
}) {
  const baseUrl = requireEnvVar((args.env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((args.env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL('/api/l10n/jobs/report', baseUrl).toString();
  const jobAccountId = resolveJobAccountId(args.job);
  const payload = {
    v: 1,
    publicId: args.job.publicId,
    layer: 'locale',
    layerKey: args.locale,
    baseFingerprint: args.baseFingerprint,
    status: args.status,
    widgetType: args.widgetType ?? args.job.widgetType,
    accountId: asString(args.accountId) || jobAccountId,
    baseUpdatedAt: args.baseUpdatedAt ?? null,
    error: args.error ?? null,
    occurredAt: new Date(args.occurredAtMs ?? Date.now()).toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildParisInternalHeaders(token, { 'content-type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[sanfrancisco] l10n report failed', res.status, text);
    }
  } catch (err) {
    console.error('[sanfrancisco] l10n report error', err);
  }
}

export async function executeL10nJob(job: L10nJob, env: Env, grant: AIGrant): Promise<void> {
  const startedAt = Date.now();
  const accountId = resolveJobAccountId(job);
  const locale = normalizeLocaleToken(job.locale);
  const jobBaseUpdatedAt = job.v === 2 ? (job.baseUpdatedAt ?? null) : job.baseUpdatedAt;
  const jobBaseFingerprint = job.v === 2 ? job.baseFingerprint : null;
  if (!accountId) {
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'skipped',
      reason: 'missing_account',
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'superseded',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: 'missing_account',
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  let instance: InstanceResponse;
  try {
    instance = await fetchInstance(job, env);
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'failed',
      reason,
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'failed',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: reason,
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  const resolvedWidgetType = instance.widgetType ? String(instance.widgetType) : job.widgetType;
  let allowlist: AllowlistEntry[];
  try {
    allowlist = await fetchAllowlist(resolvedWidgetType, env);
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, {
      status: 'failed',
      reason,
      job,
      occurredAtMs: startedAt,
    });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'failed',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: reason,
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  const entries = collectTranslatableEntries(instance.config, allowlist, true);
  const snapshot: Record<string, string> = {};
  entries.forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });
  const baseFingerprint = await computeBaseFingerprint(snapshot);
  const baseUpdatedAt = instance.updatedAt ?? jobBaseUpdatedAt ?? null;

  if (!locale) {
    await writeLog(env, job, baseFingerprint, {
      status: 'skipped',
      reason: 'invalid_locale',
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'superseded',
      baseFingerprint,
      baseUpdatedAt,
      locale: job.locale,
      error: 'invalid_locale',
      occurredAtMs: startedAt,
    });
    return;
  }

  if (job.v === 2 && job.baseFingerprint !== baseFingerprint) {
    await writeLog(env, job, baseFingerprint, {
      status: 'skipped',
      reason: 'stale_instance',
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'superseded',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      error: 'stale_instance',
      occurredAtMs: startedAt,
    });
    return;
  }

  await reportL10nGenerateStatus({
    env,
    job,
    status: 'running',
    baseFingerprint,
    baseUpdatedAt,
    locale,
    occurredAtMs: startedAt,
  });

  try {
    const entryMap = new Map(entries.map((entry) => [entry.path, entry]));
    const existing = await fetchExistingLocale({ ...job, locale }, locale, env);
    const jobChangedPaths =
      job.v === 2 && Array.isArray(job.changedPaths)
        ? job.changedPaths.filter((path) => typeof path === 'string' && path.trim())
        : null;
    const jobRemovedPaths =
      job.v === 2 && Array.isArray(job.removedPaths)
        ? job.removedPaths.filter((path) => typeof path === 'string' && path.trim())
        : [];
    const candidatePaths = Array.from(
      new Set([
        ...entries.map((entry) => entry.path),
        ...(existing?.ops ?? [])
          .map((op) => (op && op.op === 'set' && typeof op.path === 'string' ? op.path : ''))
          .filter(Boolean),
      ]),
    );
    const expandedChangedPaths =
      jobChangedPaths == null ? null : expandPathPatterns(jobChangedPaths, candidatePaths);
    const expandedRemovedPaths = expandPathPatterns(jobRemovedPaths, candidatePaths);
    const removedSet = new Set(expandedRemovedPaths);
    const translateAll = existing == null || expandedChangedPaths == null;
    const targetPaths = translateAll ? entries.map((entry) => entry.path) : expandedChangedPaths;

    const fingerprintMatch =
      existing?.baseFingerprint && existing.baseFingerprint === baseFingerprint;
    if (translateAll && fingerprintMatch && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'already_localized',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    if (!translateAll && targetPaths.length === 0 && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_changes',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    const translateEntries: TranslationItem[] = [];
    const richtextMaskPlans = new Map<string, RichtextMaskPlan>();
    const directOps: Array<{ op: 'set'; path: string; value: string }> = [];
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

    if (entries.length === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_translatables',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

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

    const translatedOps: Array<{ op: 'set'; path: string; value: string }> = [];
    const richtextFallbackPaths: string[] = [];
    let usage: Usage | undefined;
    if (translateEntries.length > 0) {
      const system = buildSystemPrompt(locale);
      const batches = chunkTranslationEntries(translateEntries);
      for (const batch of batches) {
        const user = buildUserPrompt(batch);
        const result = await deepseekTranslate({ env, grant, agentId: job.agentId, system, user });
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
          if (!expected) {
            throw new HttpError(502, {
              code: 'PROVIDER_ERROR',
              provider: result.usage.provider || 'deepseek',
              message: `Missing expected richtext source for path: ${item.path}`,
            });
          }
          try {
            assertTranslationSafety(expected, restored, result.usage.provider || 'deepseek');
            translatedOps.push({ op: 'set', path: item.path, value: restored });
          } catch {
            const fallback = await translateRichtextWithSegmentFallback({
              env,
              grant,
              agentId: job.agentId,
              locale,
              expected,
            });
            if (fallback.usage) usage = mergeUsage(usage, fallback.usage);
            richtextFallbackPaths.push(item.path);
            translatedOps.push({ op: 'set', path: item.path, value: fallback.value });
          }
        }
      }
    }

    const baseOps = existing?.ops ?? [];
    const merged = new Map<string, string>();
    baseOps.forEach((op) => {
      if (op && op.op === 'set' && entryMap.has(op.path)) {
        merged.set(op.path, op.value);
      }
    });
    removedSet.forEach((pathOrPattern) => deleteMergedByPathOrPattern(merged, pathOrPattern));
    [...directOps, ...translatedOps].forEach((op) => {
      merged.set(op.path, op.value);
    });

    if (!translateAll && merged.size === 0 && removedSet.size === 0) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: 'no_effective_changes',
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'succeeded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        occurredAtMs: startedAt,
      });
      return;
    }

    const ops = Array.from(merged.entries()).map(([path, value]) => ({
      op: 'set' as const,
      path,
      value,
    }));
    const overlay = { v: 1 as const, baseUpdatedAt, baseFingerprint, ops };

    const writeResult = await writeOverlay({ ...job, locale }, locale, overlay, env);
    if (writeResult.ok === false) {
      const reason = writeResult.reason;
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason,
        job,
        baseFingerprint,
        occurredAtMs: startedAt,
      });
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'superseded',
        baseFingerprint,
        baseUpdatedAt,
        locale,
        error: reason,
        occurredAtMs: startedAt,
      });
      return;
    }

    await writeLog(env, job, baseFingerprint, {
      status: 'ok',
      job,
      baseFingerprint,
      baseUpdatedAt,
      opsCount: ops.length,
      usage,
      richtextFallbackPaths: richtextFallbackPaths.length ? richtextFallbackPaths : undefined,
      promptVersion: PROMPT_VERSION,
      policyVersion: POLICY_VERSION,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'succeeded',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      occurredAtMs: startedAt,
    });
  } catch (err) {
    const reason =
      err instanceof HttpError
        ? (err.error?.message ?? err.message)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    await writeLog(env, job, baseFingerprint, {
      status: 'failed',
      reason,
      job,
      baseFingerprint,
      occurredAtMs: startedAt,
    });
    await reportL10nGenerateStatus({
      env,
      job,
      status: 'failed',
      baseFingerprint,
      baseUpdatedAt,
      locale,
      error: reason,
      occurredAtMs: startedAt,
    });
  }
}
