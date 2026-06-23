import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord, normalizeRequestId } from '@clickeen/ck-contracts';
import { timingSafeEqualBytes } from '@clickeen/ck-contracts/security';
import {
  buildStructuredTranslationPlan,
  buildSystemPrompt,
  buildUserPrompt,
  chunkTranslationEntries,
  parseTranslationResult,
  restoreStructuredTranslationResults,
  TranslationAgentError,
  type TranslationItem,
} from './index';

const TRANSLATION_AGENT_ID = 'widget.instance.translator';
const TOKYO_INTERNAL_SERVICE_TRANSLATION_AGENT = 'translation-agent';

type Env = {
  ENVIRONMENT?: string;
  AI_GRANT_HMAC_SECRET: string;
  SANFRANCISCO_AI_ENGINE?: Fetcher;
  TOKYO_PRODUCT_CONTROL?: Fetcher;
};

type VerifiedTranslationGrant = {
  iss: 'roma';
  exp: number;
  caps: string[];
  ai: { agentId: typeof TRANSLATION_AGENT_ID };
  trace: {
    accountPublicId: string;
    instanceId: string;
    activeLocales: string[];
  };
};

type TranslationAgentWorkerRequest = {
  grant: string;
  agentId?: string;
  accountPublicId: string;
  instanceId: string;
  widgetType?: string | null;
  baseLocale?: string | null;
  activeLocales: string[];
  items: TranslationItem[];
  trace?: {
    requestId?: string;
    client?: 'roma';
  };
};

type TranslationLocaleResult =
  | { locale: string; ok: true; count: number }
  | { locale: string; ok: false; reasonKey: string; detail?: string };

class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(isRecord(payload) && typeof payload.message === 'string' ? payload.message : `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(value), { ...init, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } });
  }
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry));
  if (values.some((entry) => !entry) || values.length === 0) return null;
  return Array.from(new Set(values as string[]));
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

function readGrantPayload(grant: string): { payloadB64: string; sigB64: string; payload: unknown } {
  const parts = grant.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Invalid grant format' } });
  }
  try {
    const payloadText = new TextDecoder().decode(base64UrlToBytes(parts[1] ?? ''));
    return { payloadB64: parts[1] ?? '', sigB64: parts[2] ?? '', payload: JSON.parse(payloadText) as unknown };
  } catch {
    throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Invalid grant payload' } });
  }
}

async function verifyRomaTranslationGrant(args: {
  grant: string;
  secret: string;
  accountPublicId: string;
  instanceId: string;
  activeLocales: string[];
}): Promise<VerifiedTranslationGrant> {
  if (!args.secret) {
    throw new HttpError(500, { error: { code: 'PROVIDER_ERROR', provider: 'translation-agent', message: 'Missing AI_GRANT_HMAC_SECRET' } });
  }
  const { payloadB64, sigB64, payload } = readGrantPayload(args.grant);
  const expectedSig = await hmacSha256(args.secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqualBytes(expectedSig, providedSig)) {
    throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Grant signature mismatch' } });
  }
  if (!isRecord(payload)) {
    throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Invalid grant payload' } });
  }
  const exp = typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? Math.floor(payload.exp) : 0;
  if (exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, { error: { code: 'GRANT_EXPIRED', message: 'Grant expired' } });
  }
  const caps = Array.isArray(payload.caps) && payload.caps.every((entry) => typeof entry === 'string')
    ? payload.caps
    : [];
  const ai = isRecord(payload.ai) ? payload.ai : null;
  const trace = isRecord(payload.trace) ? payload.trace : null;
  const traceAccountPublicId = asTrimmedString(trace?.accountPublicId);
  const traceInstanceId = asTrimmedString(trace?.instanceId);
  const traceActiveLocales = normalizeStringArray(trace?.activeLocales);
  if (
    payload.iss !== 'roma' ||
    !caps.includes(`agent:${TRANSLATION_AGENT_ID}`) ||
    ai?.agentId !== TRANSLATION_AGENT_ID ||
    traceAccountPublicId !== args.accountPublicId ||
    traceInstanceId !== args.instanceId ||
    !traceActiveLocales ||
    !sameStringSet(traceActiveLocales, args.activeLocales)
  ) {
    throw new HttpError(403, {
      error: {
        code: 'CAPABILITY_DENIED',
        message: 'Translation Agent grant does not match the requested account instance.',
      },
    });
  }
  return {
    iss: 'roma',
    exp,
    caps,
    ai: { agentId: TRANSLATION_AGENT_ID },
    trace: {
      accountPublicId: traceAccountPublicId,
      instanceId: traceInstanceId,
      activeLocales: traceActiveLocales,
    },
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false;
  if (leftSet.size !== rightSet.size) return false;
  return Array.from(leftSet).every((value) => rightSet.has(value));
}

function isTranslationItem(value: unknown): value is TranslationItem {
  if (!isRecord(value)) return false;
  const path = asTrimmedString(value.path);
  const itemType = value.type;
  return Boolean(
    path &&
      (itemType === 'string' || itemType === 'richtext') &&
      typeof value.value === 'string' &&
      (value.label === undefined || typeof value.label === 'string') &&
      (value.role === undefined || typeof value.role === 'string') &&
      (value.promptType === undefined || value.promptType === 'string' || value.promptType === 'richtext'),
  );
}

function normalizeTranslationItems(raw: unknown): TranslationItem[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  const items = raw.filter(isTranslationItem);
  if (items.length !== raw.length) return null;
  return items.map((item) => ({
    path: item.path,
    type: item.type,
    value: item.value,
    ...(item.label ? { label: item.label } : {}),
    ...(item.role ? { role: item.role } : {}),
    ...(item.promptType ? { promptType: item.promptType } : {}),
  }));
}

function normalizeWorkerRequest(raw: unknown): TranslationAgentWorkerRequest | null {
  if (!isRecord(raw)) return null;
  const grant = asTrimmedString(raw.grant);
  const accountPublicId = asTrimmedString(raw.accountPublicId);
  const instanceId = asTrimmedString(raw.instanceId);
  const activeLocales = normalizeStringArray(raw.activeLocales);
  const items = normalizeTranslationItems(raw.items);
  if (!grant || !accountPublicId || !instanceId || !activeLocales || !items) return null;
  if (raw.agentId !== undefined && raw.agentId !== TRANSLATION_AGENT_ID) return null;
  return {
    grant,
    accountPublicId,
    instanceId,
    widgetType: asTrimmedString(raw.widgetType) ?? null,
    baseLocale: asTrimmedString(raw.baseLocale) ?? null,
    activeLocales,
    items,
    trace: isRecord(raw.trace)
      ? {
          requestId: asTrimmedString(raw.trace.requestId) ?? undefined,
          client: raw.trace.client === 'roma' ? 'roma' : undefined,
        }
      : undefined,
  };
}

function resolveRequestId(request: Request, body: TranslationAgentWorkerRequest): string {
  return (
    normalizeRequestId(request.headers.get(CK_REQUEST_ID_HEADER)) ??
    normalizeRequestId(body.trace?.requestId) ??
    crypto.randomUUID()
  );
}

function buildExactOverlayValues(args: {
  items: TranslationItem[];
  restored: Array<{ path: string; value: string }>;
}): Record<string, string> {
  const values = Object.fromEntries(args.restored.map((item) => [item.path, item.value]));
  const expectedPaths = new Set(args.items.map((item) => item.path));
  for (const path of expectedPaths) {
    if (typeof values[path] !== 'string') {
      throw new HttpError(502, {
        error: {
          code: 'PROVIDER_ERROR',
          provider: 'translation-agent',
          message: `Translation output missing requested path: ${path}`,
        },
      });
    }
  }
  for (const path of Object.keys(values)) {
    if (!expectedPaths.has(path)) {
      throw new HttpError(502, {
        error: {
          code: 'PROVIDER_ERROR',
          provider: 'translation-agent',
          message: `Translation output included unexpected path: ${path}`,
        },
      });
    }
  }
  return values;
}

async function readJsonResponse(response: Response): Promise<{ text: string; payload: unknown }> {
  const text = await response.text().catch(() => '');
  try {
    return { text, payload: text ? JSON.parse(text) as unknown : null };
  } catch {
    return { text, payload: null };
  }
}

async function callSanFranciscoModel(args: {
  env: Env;
  requestId: string;
  grant: string;
  locale: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
}): Promise<string> {
  const body = JSON.stringify({
    grant: args.grant,
    agentId: TRANSLATION_AGENT_ID,
    messages: args.messages,
    temperature: 0.2,
    trace: { client: 'translation-agent', requestId: args.requestId, locale: args.locale },
  });
  const headers = {
    'content-type': 'application/json',
    [CK_REQUEST_ID_HEADER]: args.requestId,
  };
  if (!args.env.SANFRANCISCO_AI_ENGINE) {
    throw new HttpError(500, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'translation-agent',
        message: 'Missing SANFRANCISCO_AI_ENGINE service binding.',
      },
    });
  }
  const response = await args.env.SANFRANCISCO_AI_ENGINE.fetch('https://sanfrancisco.internal/v1/model/chat', {
    method: 'POST',
    headers,
    body,
  });
  const { text, payload } = await readJsonResponse(response);
  if (!response.ok) {
    throw new HttpError(response.status, isRecord(payload) ? payload : {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'sanfrancisco',
        message: text || `San Francisco model execution failed (${response.status})`,
      },
    });
  }
  if (!isRecord(payload) || typeof payload.content !== 'string') {
    throw new HttpError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'sanfrancisco',
        message: 'San Francisco returned an invalid model execution response.',
      },
    });
  }
  return payload.content;
}

async function writeTokyoOverlayValues(args: {
  env: Env;
  requestId: string;
  grant: string;
  accountPublicId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
}): Promise<void> {
  const path = `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(args.locale)}`;
  const init: RequestInit = {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      [CK_REQUEST_ID_HEADER]: args.requestId,
      'x-account-id': args.accountPublicId,
      'x-ck-internal-service': TOKYO_INTERNAL_SERVICE_TRANSLATION_AGENT,
      'x-ck-ai-grant': args.grant,
    },
    body: JSON.stringify({ values: args.values }),
  };
  if (!args.env.TOKYO_PRODUCT_CONTROL) {
    throw new HttpError(500, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'translation-agent',
        message: 'Missing TOKYO_PRODUCT_CONTROL service binding.',
      },
    });
  }
  const response = await args.env.TOKYO_PRODUCT_CONTROL.fetch(`https://tokyo-product-control.internal${path}`, init);
  const { text, payload } = await readJsonResponse(response);
  if (!response.ok) {
    throw new HttpError(response.status, isRecord(payload) ? payload : {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'tokyo-worker',
        message: text || `Tokyo overlay write failed (${response.status})`,
      },
    });
  }
  if (!isRecord(payload) || payload.ok !== true || payload.locale !== args.locale) {
    throw new HttpError(502, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'tokyo-worker',
        message: 'Tokyo returned an invalid overlay write response.',
      },
    });
  }
}

async function translateLocale(args: {
  env: Env;
  requestId: string;
  request: TranslationAgentWorkerRequest;
  locale: string;
}): Promise<Record<string, string>> {
  const plan = buildStructuredTranslationPlan(args.request.items);
  if (plan.modelEntries.length === 0) {
    throw new HttpError(400, {
      error: {
        code: 'BAD_REQUEST',
        reasonKey: 'coreui.errors.translation.noTranslatableContent',
        message: 'Translation request contains no translatable content.',
      },
    });
  }
  const translatedItems: Array<{ path: string; value: string }> = [];
  for (const chunk of chunkTranslationEntries(plan.modelEntries)) {
    const content = await callSanFranciscoModel({
      env: args.env,
      requestId: args.requestId,
      grant: args.request.grant,
      locale: args.locale,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({
            locale: args.locale,
            widgetType: args.request.widgetType,
            items: chunk,
          }),
        },
        { role: 'user', content: buildUserPrompt(chunk) },
      ],
    });
    translatedItems.push(...parseTranslationResult(content, chunk, 'sanfrancisco'));
  }
  const restored = restoreStructuredTranslationResults({
    entries: args.request.items,
    plan,
    translatedItems,
    provider: 'sanfrancisco',
  });
  return buildExactOverlayValues({ items: args.request.items, restored });
}

async function executeTranslationRun(args: {
  env: Env;
  requestId: string;
  request: TranslationAgentWorkerRequest;
}): Promise<TranslationLocaleResult[]> {
  const translated = new Map<string, Record<string, string>>();
  for (const locale of args.request.activeLocales) {
    translated.set(locale, await translateLocale({
      env: args.env,
      requestId: args.requestId,
      request: args.request,
      locale,
    }));
  }
  const results: TranslationLocaleResult[] = [];
  for (const locale of args.request.activeLocales) {
    const values = translated.get(locale);
    if (!values) {
      throw new HttpError(502, {
        error: {
          code: 'PROVIDER_ERROR',
          provider: 'translation-agent',
          message: `Translation Agent did not produce values for ${locale}.`,
        },
      });
    }
    await writeTokyoOverlayValues({
      env: args.env,
      requestId: args.requestId,
      grant: args.request.grant,
      accountPublicId: args.request.accountPublicId,
      instanceId: args.request.instanceId,
      locale,
      values,
    });
    results.push({ locale, ok: true, count: Object.keys(values).length });
  }
  return results;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') {
      return json({
        ok: true,
        service: 'translation-agent',
        env: env.ENVIRONMENT ?? 'unknown',
        ts: Date.now(),
      });
    }
    try {
      if (request.method !== 'POST' || url.pathname !== '/v1/translate-instance') {
        throw new HttpError(404, { error: { code: 'BAD_REQUEST', message: 'Not found' } });
      }
      const body = normalizeWorkerRequest(await readJson(request));
      if (!body) {
        throw new HttpError(400, {
          error: {
            code: 'BAD_REQUEST',
            reasonKey: 'coreui.errors.translation.invalidRequest',
            message: 'Invalid Translation Agent worker request',
            issues: [{ path: '', message: 'Expected { grant, accountPublicId, instanceId, activeLocales, items }' }],
          },
        });
      }
      const requestId = resolveRequestId(request, body);
      await verifyRomaTranslationGrant({
        grant: body.grant,
        secret: env.AI_GRANT_HMAC_SECRET,
        accountPublicId: body.accountPublicId,
        instanceId: body.instanceId,
        activeLocales: body.activeLocales,
      });
      const results = await executeTranslationRun({ env, requestId, request: body });
      const failed = results.filter((result) => !result.ok);
      return json({
        requestId,
        agentId: TRANSLATION_AGENT_ID,
        translation: {
          ok: failed.length === 0,
          baseLocale: body.baseLocale,
          activeLocales: body.activeLocales,
          results,
        },
      }, { status: failed.length ? 424 : 200 });
    } catch (error) {
      if (error instanceof TranslationAgentError) {
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.provider ? { provider: error.provider } : {}),
            },
          },
          { status: error.status },
        );
      }
      if (error instanceof HttpError) {
        return json(error.payload, { status: error.status });
      }
      console.error('[translation-agent] Unhandled error', error);
      return json(
        {
          error: {
            code: 'PROVIDER_ERROR',
            provider: 'translation-agent',
            message: 'Translation Agent failed unexpectedly.',
          },
        },
        { status: 500 },
      );
    }
  },
};
