import { computeBaseFingerprint, normalizeLocaleToken } from '@clickeen/l10n';
import type { Env, Usage } from '../types';
import { HttpError, asString, isRecord } from '../http';

export type L10nJob = {
  v: 1;
  publicId: string;
  widgetType: string;
  locale: string;
  baseUpdatedAt: string;
  kind: 'curated' | 'user';
  workspaceId?: string | null;
  envStage?: string;
};

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

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
};

const PROMPT_VERSION = 'l10n.instance.v1@2025-01-12';
const POLICY_VERSION = 'l10n.ops.v1';

const MAX_ITEMS = 200;
const MAX_INPUT_CHARS = 12000;
const MAX_TOKENS = 900;
const TIMEOUT_MS = 20_000;

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

export function isL10nJob(value: unknown): value is L10nJob {
  if (!isRecord(value)) return false;
  if (value.v !== 1) return false;
  const publicId = asString(value.publicId);
  const widgetType = asString(value.widgetType);
  const locale = asString(value.locale);
  const baseUpdatedAt = asString(value.baseUpdatedAt);
  const kind = value.kind;
  if (!publicId || !widgetType || !locale || !baseUpdatedAt) return false;
  if (kind !== 'curated' && kind !== 'user') return false;
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

function hasProhibitedSegment(path: string): boolean {
  return path
    .split('.')
    .some((segment) => segment && PROHIBITED_SEGMENTS.has(segment));
}

function joinPath(base: string, next: string): string {
  return base ? `${base}.${next}` : next;
}

function collectEntriesForPath(args: {
  value: unknown;
  segments: string[];
  currentPath: string;
  type: AllowlistEntry['type'];
  out: TranslationItem[];
}) {
  if (args.segments.length === 0) {
    if (typeof args.value === 'string') {
      const trimmed = args.value.trim();
      if (trimmed) {
        args.out.push({ path: args.currentPath, type: args.type, value: args.value });
      }
    }
    return;
  }

  const [head, ...tail] = args.segments;
  if (!head || PROHIBITED_SEGMENTS.has(head)) return;

  if (head === '*') {
    if (!Array.isArray(args.value)) return;
    args.value.forEach((item, index) => {
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: joinPath(args.currentPath, String(index)),
        type: args.type,
        out: args.out,
      });
    });
    return;
  }

  if (Array.isArray(args.value) && /^\d+$/.test(head)) {
    const index = Number(head);
    collectEntriesForPath({
      value: args.value[index],
      segments: tail,
      currentPath: joinPath(args.currentPath, head),
      type: args.type,
      out: args.out,
    });
    return;
  }

  if (!isRecord(args.value)) return;
  collectEntriesForPath({
    value: args.value[head],
    segments: tail,
    currentPath: joinPath(args.currentPath, head),
    type: args.type,
    out: args.out,
  });
}

function collectTranslatableEntries(config: Record<string, unknown>, allowlist: AllowlistEntry[]): TranslationItem[] {
  const out: TranslationItem[] = [];
  for (const entry of allowlist) {
    const path = entry.path.trim();
    if (!path || hasProhibitedSegment(path)) continue;
    const segments = path.split('.').map((seg) => seg.trim()).filter(Boolean);
    if (segments.length === 0) continue;
    collectEntriesForPath({
      value: config,
      segments,
      currentPath: '',
      type: entry.type,
      out,
    });
  }

  const deduped: TranslationItem[] = [];
  const seen = new Set<string>();
  for (const item of out) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      deduped.push(item);
    }
  }
  return deduped;
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
  return [
    'Translate the following items.',
    'Return JSON array: [{ "path": "...", "value": "..." }, ...]',
    '',
    JSON.stringify(
      items.map((item) => ({ path: item.path, type: item.type, value: item.value })),
      null,
      2,
    ),
  ].join('\n');
}

async function deepseekTranslate(args: {
  env: Env;
  system: string;
  user: string;
}): Promise<{ content: string; usage: Usage }> {
  if (!args.env.DEEPSEEK_API_KEY) {
    throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Missing DEEPSEEK_API_KEY' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const baseUrl = args.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const model = args.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

  const startedAt = Date.now();
  let responseJson: OpenAIChatResponse;
  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${args.env.DEEPSEEK_API_KEY}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: 'system', content: args.system },
            { role: 'user', content: args.user },
          ],
        }),
      });
    } catch (err: unknown) {
      const name = isRecord(err) ? asString((err as any).name) : null;
      if (name === 'AbortError') {
        throw new HttpError(429, { code: 'BUDGET_EXCEEDED', message: 'Execution timeout exceeded' });
      }
      throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Upstream request failed' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(502, {
        code: 'PROVIDER_ERROR',
        provider: 'deepseek',
        message: `Upstream error (${res.status}) ${text}`.trim(),
      });
    }
    responseJson = (await res.json()) as OpenAIChatResponse;
  } finally {
    clearTimeout(timeout);
  }

  const latencyMs = Date.now() - startedAt;
  const content = responseJson.choices?.[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Empty model response' });
  }

  const usage: Usage = {
    provider: 'deepseek',
    model: responseJson.model ?? model,
    promptTokens: responseJson.usage?.prompt_tokens ?? 0,
    completionTokens: responseJson.usage?.completion_tokens ?? 0,
    latencyMs,
  };

  return { content, usage };
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
  const url = new URL(`/api/instance/${encodeURIComponent(job.publicId)}?subject=devstudio`, baseUrl).toString();

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
};

async function fetchExistingLocale(job: L10nJob, env: Env): Promise<ExistingLocale | null> {
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(`/api/instances/${encodeURIComponent(job.publicId)}/locales`, baseUrl);
  url.searchParams.set('subject', 'devstudio');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-store',
    },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as any;
  const locales = Array.isArray(body?.locales) ? body.locales : null;
  if (!locales) return null;
  const entry = locales.find((item: any) => item?.locale === job.locale);
  if (!entry) return null;
  return {
    locale: job.locale,
    source: typeof entry.source === 'string' ? entry.source : null,
    baseFingerprint: typeof entry.baseFingerprint === 'string' ? entry.baseFingerprint : null,
    baseUpdatedAt: typeof entry.baseUpdatedAt === 'string' ? entry.baseUpdatedAt : null,
    hasUserOps: typeof entry.hasUserOps === 'boolean' ? entry.hasUserOps : null,
  };
}

type OverlayWriteResult = { ok: true } | { ok: false; reason: 'stale_instance' };

async function writeOverlay(
  job: L10nJob,
  overlay: { v: 1; baseUpdatedAt?: string | null; baseFingerprint?: string | null; ops: Array<{ op: 'set'; path: string; value: string }> },
  env: Env,
): Promise<OverlayWriteResult> {
  const baseUrl = requireEnvVar((env as any).PARIS_BASE_URL, 'PARIS_BASE_URL');
  const token = requireEnvVar((env as any).PARIS_DEV_JWT, 'PARIS_DEV_JWT');
  const url = new URL(
    `/api/instances/${encodeURIComponent(job.publicId)}/locales/${encodeURIComponent(job.locale)}`,
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

async function writeLog(env: Env, job: L10nJob, payload: Record<string, unknown>) {
  const key = `l10n/${job.publicId}/${job.locale}/${job.baseUpdatedAt}.${Date.now()}.json`;
  await env.SF_R2.put(key, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });
}

export async function executeL10nJob(job: L10nJob, env: Env): Promise<void> {
  const startedAt = Date.now();
  const locale = normalizeLocaleToken(job.locale);
  if (!locale) {
    await writeLog(env, job, { status: 'skipped', reason: 'invalid_locale', job, occurredAtMs: startedAt });
    return;
  }

  const instance = await fetchInstance(job, env);
  const updatedAt = instance.updatedAt ?? null;
  if (!updatedAt || updatedAt !== job.baseUpdatedAt) {
    await writeLog(env, job, { status: 'skipped', reason: 'stale_instance', job, updatedAt, occurredAtMs: startedAt });
    return;
  }

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  const existing = await fetchExistingLocale({ ...job, locale }, env);
  if (existing) {
    const hasUserOps = existing.hasUserOps === true;
    if (existing.source === 'user' && !hasUserOps) {
      await writeLog(env, job, { status: 'skipped', reason: 'user_override', job, occurredAtMs: startedAt });
      return;
    }
    const fingerprintMatch = existing.baseFingerprint && existing.baseFingerprint === baseFingerprint;
    const updatedAtMatch = existing.baseUpdatedAt && existing.baseUpdatedAt === job.baseUpdatedAt;
    if (fingerprintMatch || updatedAtMatch) {
      await writeLog(env, job, { status: 'skipped', reason: 'already_localized', job, occurredAtMs: startedAt });
      return;
    }
  }

  const resolvedWidgetType = instance.widgetType ? String(instance.widgetType) : job.widgetType;
  const allowlist = await fetchAllowlist(resolvedWidgetType, env);
  const entries = collectTranslatableEntries(instance.config, allowlist);

  if (entries.length === 0) {
    await writeLog(env, job, { status: 'skipped', reason: 'no_translatables', job, occurredAtMs: startedAt });
    return;
  }

  if (entries.length > MAX_ITEMS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Too many translatable items (${entries.length})` });
  }

  const totalChars = entries.reduce((sum, item) => sum + item.value.length, 0);
  if (totalChars > MAX_INPUT_CHARS) {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: `Input too large (${totalChars} chars)` });
  }

  const system = buildSystemPrompt(locale);
  const user = buildUserPrompt(entries);
  const { content, usage } = await deepseekTranslate({ env, system, user });
  const translated = parseTranslationResult(content, entries);

  const ops = translated.map((item) => ({ op: 'set' as const, path: item.path, value: item.value }));
  const overlay = { v: 1, baseUpdatedAt: job.baseUpdatedAt, baseFingerprint, ops };

  const writeResult = await writeOverlay({ ...job, locale }, overlay, env);
  if (!writeResult.ok) {
    await writeLog(env, job, { status: 'skipped', reason: writeResult.reason, job, occurredAtMs: startedAt });
    return;
  }

  await writeLog(env, job, {
    status: 'ok',
    job,
    opsCount: ops.length,
    usage,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    occurredAtMs: startedAt,
  });
}
