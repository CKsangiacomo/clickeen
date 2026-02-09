import { collectAllowlistedEntries, computeBaseFingerprint, normalizeLocaleToken } from '@clickeen/l10n';
import type { AIGrant, Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';
import { callChatCompletion } from '../ai/chat';

type L10nJobV1 = {
  v: 1;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseUpdatedAt: string;
  kind: 'curated' | 'user';
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
  workspaceId?: string | null;
  envStage?: string;
};

export type L10nJob = L10nJobV1 | L10nJobV2;

type InstanceResponse = {
  publicId: string;
  status: 'published' | 'unpublished';
  widgetType?: string | null;
  config: Record<string, unknown>;
  updatedAt?: string | null;
};

type AllowlistEntry = { path: string; type: 'string' | 'richtext' };
type AllowlistFile = { v: 1; paths: AllowlistEntry[] };

type TranslationItem = { path: string; type: AllowlistEntry['type']; value: string };

type L10nGenerateStatus = 'running' | 'succeeded' | 'failed' | 'superseded';

const PROMPT_VERSION = 'l10n.instance.v1@2025-01-12';
const POLICY_VERSION = 'l10n.ops.v1';

const MAX_ITEMS = 200;
const MAX_INPUT_CHARS = 12000;
const MAX_TOKENS = 900;
const TIMEOUT_MS = 35_000;

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

function requireEnvVar(value: unknown, name: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'sanfrancisco', message: `Missing ${name}` });
  return trimmed;
}

function getTokyoReadBase(env: Env): string {
  return requireEnvVar((env as any).TOKYO_BASE_URL, 'TOKYO_BASE_URL');
}

function collectTranslatableEntries(
  config: Record<string, unknown>,
  allowlist: AllowlistEntry[],
  includeEmpty = false,
): TranslationItem[] {
  const entries = collectAllowlistedEntries(config, allowlist, { includeEmpty: true });
  return entries
    .filter((entry) => includeEmpty || entry.value.trim())
    .map((entry) => ({ path: entry.path, type: entry.type, value: entry.value }));
}

function buildSystemPrompt(locale: string): string {
  return [
    'You are a localization engine for Clickeen widgets.',
    `Translate into locale: ${locale}.`,
    '',
    'Rules:',
    '- Return ONLY JSON. No markdown, no extra text.',
    '- Keep the same item count and order as input.',
    '- Preserve paths exactly.',
    '- Preserve URLs, emails, brand names, and placeholders (e.g. {token}, {{token}}, :token).',
    '- For richtext values, preserve existing HTML tags and attributes; do not add new tags.',
  ].join('\n');
}

function buildUserPrompt(items: TranslationItem[]): string {
  const payload = items.map((item) => ({ path: item.path, type: item.type, value: item.value }));
  return [
    'Translate the following items.',
    'Return JSON array: [{"path":"...","value":"..."},...]',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

async function deepseekTranslate(args: {
  env: Env;
  grant: AIGrant;
  agentId: string;
  system: string;
  user: string;
}): Promise<{ content: string; usage: Usage }> {
  return callChatCompletion({
    env: args.env,
    grant: args.grant,
    agentId: args.agentId,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    temperature: 0.2,
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
  });
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  const objStart = trimmed.indexOf('{');
  const objEnd = trimmed.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    return trimmed.slice(objStart, objEnd + 1);
  }

  return trimmed;
}

function parseTranslationResult(raw: string, expected: TranslationItem[]): Array<{ path: string; value: string }> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    const candidate = extractJsonPayload(raw);
    try {
      json = JSON.parse(candidate);
    } catch {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Invalid JSON response' });
    }
  }

  const items = Array.isArray(json) ? json : isRecord(json) && Array.isArray((json as any).items) ? (json as any).items : null;
  if (!items) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Expected JSON array response' });
  }

  const expectedPaths = new Set(expected.map((item) => item.path));
  const seen = new Set<string>();
  const mapped = new Map<string, string>();

  items.forEach((entry: unknown, index: number) => {
    if (!isRecord(entry)) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: `Item ${index} is not an object` });
    }
    const path = asString(entry.path);
    const value = asString(entry.value);
    if (!path || value == null) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: `Item ${index} missing path/value` });
    }
    if (!expectedPaths.has(path)) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: `Unexpected path: ${path}` });
    }
    if (seen.has(path)) {
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: `Duplicate path: ${path}` });
    }
    seen.add(path);
    mapped.set(path, value);
  });

  if (mapped.size !== expected.length) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Translation output size mismatch' });
  }

  return expected.map((item) => ({ path: item.path, value: mapped.get(item.path) ?? item.value }));
}

async function fetchInstance(job: L10nJob, env: Env): Promise<InstanceResponse> {
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Missing workspaceId' });
  }
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(job.publicId)}?subject=devstudio`,
    baseUrl,
  ).toString();

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-store',
    },
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
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'paris', message: 'Invalid instance response' });
  }
  return body;
}

async function fetchAllowlist(widgetType: string, env: Env): Promise<AllowlistEntry[]> {
  const cacheKey = `l10n:allowlist:${widgetType}`;
  const cached = await env.SF_KV.get(cacheKey, { type: 'json' }).catch(() => null);
  if (cached && isRecord(cached) && cached.v === 1 && Array.isArray(cached.paths)) {
    return cached.paths as AllowlistEntry[];
  }

  const baseUrl = getTokyoReadBase(env);
  const url = new URL(`/widgets/${encodeURIComponent(widgetType)}/localization.json`, baseUrl).toString();
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
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'tokyo', message: 'Invalid localization.json' });
  }

  const entries = json.paths
    .map((entry) => ({
      path: typeof entry?.path === 'string' ? entry.path.trim() : '',
      type: entry?.type === 'richtext' ? 'richtext' : 'string',
    }))
    .filter((entry) => entry.path);

  await env.SF_KV.put(cacheKey, JSON.stringify({ v: 1, paths: entries }), { expirationTtl: 3600 });
  return entries;
}

type ExistingLocale = {
  locale: string;
  source?: string | null;
  baseFingerprint?: string | null;
  baseUpdatedAt?: string | null;
  hasUserOps?: boolean | null;
  ops?: Array<{ op: 'set'; path: string; value: string }>;
};

async function fetchExistingLocale(job: L10nJob, locale: string, env: Env): Promise<ExistingLocale | null> {
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) return null;
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      job.publicId
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'devstudio');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-store',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as any;
  const ops = Array.isArray(body?.ops)
    ? body.ops
        .filter((op: any) => op && op.op === 'set' && typeof op.path === 'string' && typeof op.value === 'string')
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
  overlay: { v: 1; baseUpdatedAt?: string | null; baseFingerprint?: string | null; ops: Array<{ op: 'set'; path: string; value: string }> },
  env: Env,
): Promise<OverlayWriteResult> {
  const workspaceId = asString(job.workspaceId);
  if (!workspaceId) return { ok: false, reason: 'stale_instance' };
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      job.publicId
    )}/layers/locale/${encodeURIComponent(locale)}`,
    baseUrl,
  );
  url.searchParams.set('subject', 'devstudio');
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
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

async function writeLog(env: Env, job: L10nJob, baseFingerprint: string | null, payload: Record<string, unknown>) {
  const fallback = job.v === 2 ? job.baseFingerprint : job.baseUpdatedAt;
  const fingerprint = baseFingerprint || fallback || 'unknown';
  const key = `l10n/${job.publicId}/${job.locale}/${fingerprint}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });
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
  workspaceId?: string | null;
}) {
  const baseUrl = requireEnvVar((args.env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((args.env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL('/api/l10n/jobs/report', baseUrl).toString();
  const payload = {
    v: 1,
    publicId: args.job.publicId,
    layer: 'locale',
    layerKey: args.locale,
    baseFingerprint: args.baseFingerprint,
    status: args.status,
    widgetType: args.widgetType ?? args.job.widgetType,
    workspaceId: args.workspaceId ?? args.job.workspaceId ?? null,
    baseUpdatedAt: args.baseUpdatedAt ?? null,
    error: args.error ?? null,
    occurredAt: new Date(args.occurredAtMs ?? Date.now()).toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
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
  const workspaceId = asString(job.workspaceId);
  const locale = normalizeLocaleToken(job.locale);
  const jobBaseUpdatedAt = job.v === 2 ? job.baseUpdatedAt ?? null : job.baseUpdatedAt;
  const jobBaseFingerprint = job.v === 2 ? job.baseFingerprint : null;
  if (!workspaceId) {
    await writeLog(env, job, jobBaseFingerprint, { status: 'skipped', reason: 'missing_workspace', job, occurredAtMs: startedAt });
    if (jobBaseFingerprint) {
      await reportL10nGenerateStatus({
        env,
        job,
        status: 'superseded',
        baseFingerprint: jobBaseFingerprint,
        baseUpdatedAt: jobBaseUpdatedAt,
        locale: job.locale,
        error: 'missing_workspace',
        occurredAtMs: startedAt,
      });
    }
    return;
  }

  let instance: InstanceResponse;
  try {
    instance = await fetchInstance(job, env);
  } catch (err) {
    const reason = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, { status: 'failed', reason, job, occurredAtMs: startedAt });
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
    const reason = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
    await writeLog(env, job, jobBaseFingerprint, { status: 'failed', reason, job, occurredAtMs: startedAt });
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
    const jobChangedPaths =
      job.v === 2 && Array.isArray(job.changedPaths)
        ? job.changedPaths.filter((path) => typeof path === 'string' && path.trim())
        : null;
    const jobRemovedPaths =
      job.v === 2 && Array.isArray(job.removedPaths)
        ? job.removedPaths.filter((path) => typeof path === 'string' && path.trim())
        : [];
    const removedSet = new Set(jobRemovedPaths);
    const translateAll = jobChangedPaths == null;
    const targetPaths = translateAll ? entries.map((entry) => entry.path) : jobChangedPaths;

    const existing = await fetchExistingLocale({ ...job, locale }, locale, env);
    const fingerprintMatch = existing?.baseFingerprint && existing.baseFingerprint === baseFingerprint;
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

    if (translateEntries.length > MAX_ITEMS) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: `Too many translatable items (${translateEntries.length})` });
    }

    const totalChars = translateEntries.reduce((sum, item) => sum + item.value.length, 0);
    if (totalChars > MAX_INPUT_CHARS) {
      throw new HttpError(400, { code: 'BAD_REQUEST', message: `Input too large (${totalChars} chars)` });
    }

    const translatedOps: Array<{ op: 'set'; path: string; value: string }> = [];
    let usage: Usage | undefined;
    if (translateEntries.length > 0) {
      const system = buildSystemPrompt(locale);
      const user = buildUserPrompt(translateEntries);
      const result = await deepseekTranslate({ env, grant, agentId: job.agentId, system, user });
      usage = result.usage;
      const translated = parseTranslationResult(result.content, translateEntries);
      translatedOps.push(...translated.map((item) => ({ op: 'set' as const, path: item.path, value: item.value })));
    }

    const baseOps = existing?.ops ?? [];
    const merged = new Map<string, string>();
    baseOps.forEach((op) => {
      if (op && op.op === 'set' && entryMap.has(op.path)) {
        merged.set(op.path, op.value);
      }
    });
    removedSet.forEach((path) => merged.delete(path));
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

    const ops = Array.from(merged.entries()).map(([path, value]) => ({ op: 'set' as const, path, value }));
    const overlay = { v: 1, baseUpdatedAt, baseFingerprint, ops };

    const writeResult = await writeOverlay({ ...job, locale }, locale, overlay, env);
    if (!writeResult.ok) {
      await writeLog(env, job, baseFingerprint, {
        status: 'skipped',
        reason: writeResult.reason,
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
        error: writeResult.reason,
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
    const reason = err instanceof HttpError ? err.error?.message ?? err.message : err instanceof Error ? err.message : 'Unknown error';
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
