import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord, normalizeRequestId } from '@clickeen/ck-contracts';
import { readRomaAiGrantEnvelope, verifyRomaAiGrantSignature } from '@clickeen/ck-policy';
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
const LOCALE_TRANSLATION_CONCURRENCY = 6;

type Env = {
  ENVIRONMENT?: string;
  ROMA_AI_GRANT_PUBLIC_KEY_PEM: string;
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
  requestedLocales: string[];
  items: TranslationItem[];
  trace?: {
    requestId?: string;
    client?: 'roma';
  };
};

type TranslationLocaleResult =
  | { locale: string; ok: true; count: number }
  | { locale: string; ok: false; reasonKey: string; detail?: string };

type AgentActivityEvent = {
  message: string;
};

function sendStreamEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, payload: unknown) {
  try {
    controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
  } catch {
    // Activity transport is not translation truth.
  }
}

function closeStream(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.close();
  } catch {
    // The client may have already closed the activity stream.
  }
}

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

function eventStream(stream: ReadableStream<Uint8Array>, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'text/event-stream; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(stream, { ...init, headers });
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
  if (
    raw.length === 0 ||
    raw.some((entry) => typeof entry !== 'string' || !entry || entry !== entry.trim())
  ) {
    return null;
  }
  const normalized = raw as string[];
  return new Set(normalized).size === normalized.length ? normalized : null;
}

async function verifyRomaTranslationGrant(args: {
  grant: string;
  publicKeyPem: string;
  accountPublicId: string;
  instanceId: string;
  requestedLocales: string[];
}): Promise<VerifiedTranslationGrant> {
  if (!String(args.publicKeyPem || '').trim()) {
    throw new HttpError(500, { error: { code: 'PROVIDER_ERROR', provider: 'translation-agent', message: 'Missing ROMA_AI_GRANT_PUBLIC_KEY_PEM' } });
  }
  const envelope = readRomaAiGrantEnvelope(args.grant);
  if (!envelope) {
    throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Invalid grant format or payload' } });
  }
  try {
    if (!(await verifyRomaAiGrantSignature(envelope, args.publicKeyPem))) {
      throw new HttpError(401, { error: { code: 'GRANT_INVALID', message: 'Grant signature mismatch' } });
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, { error: { code: 'PROVIDER_ERROR', provider: 'translation-agent', message: 'Invalid ROMA_AI_GRANT_PUBLIC_KEY_PEM' } });
  }
  const payload = envelope.payload;
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
    !sameStringSet(traceActiveLocales, args.requestedLocales)
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
  const requestedLocales = normalizeStringArray(raw.requestedLocales);
  const items = normalizeTranslationItems(raw.items);
  if (!grant || !accountPublicId || !instanceId || !requestedLocales || !items) return null;
  if (raw.agentId !== undefined && raw.agentId !== TRANSLATION_AGENT_ID) return null;
  return {
    grant,
    accountPublicId,
    instanceId,
    widgetType: asTrimmedString(raw.widgetType) ?? null,
    baseLocale: asTrimmedString(raw.baseLocale) ?? null,
    requestedLocales,
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
  const response = await args.env.SANFRANCISCO_AI_ENGINE.fetch('https://sanfrancisco.internal/model/chat', {
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

function resolveLocaleLabel(locale: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) || locale;
  } catch {
    return locale;
  }
}

async function executeTranslationRun(args: {
  env: Env;
  requestId: string;
  request: TranslationAgentWorkerRequest;
  onActivity?: (event: AgentActivityEvent) => void;
}): Promise<TranslationLocaleResult[]> {
  const results = new Array<TranslationLocaleResult>(args.request.requestedLocales.length);
  let nextLocaleIndex = 0;
  const runNext = async (): Promise<void> => {
    while (nextLocaleIndex < args.request.requestedLocales.length) {
      const localeIndex = nextLocaleIndex++;
      const locale = args.request.requestedLocales[localeIndex]!;
      const localeLabel = resolveLocaleLabel(locale);
      args.onActivity?.({ message: `Writing ${localeLabel}` });
      try {
        const values = await translateLocale({
          env: args.env,
          requestId: args.requestId,
          request: args.request,
          locale,
        });
        await writeTokyoOverlayValues({
          env: args.env,
          requestId: args.requestId,
          grant: args.request.grant,
          accountPublicId: args.request.accountPublicId,
          instanceId: args.request.instanceId,
          locale,
          values,
        });
        args.onActivity?.({ message: `${localeLabel} written` });
        results[localeIndex] = { locale, ok: true, count: Object.keys(values).length };
      } catch (error) {
        const payload = error instanceof HttpError && isRecord(error.payload) ? error.payload : null;
        const errorPayload = isRecord(payload?.error) ? payload.error : null;
        const reasonKey =
          asTrimmedString(errorPayload?.reasonKey) ??
          asTrimmedString(errorPayload?.code) ??
          (error instanceof TranslationAgentError ? error.code : null) ??
          'coreui.errors.translation.failed';
        const detail =
          asTrimmedString(errorPayload?.message) ??
          asTrimmedString(errorPayload?.detail) ??
          (error instanceof Error ? error.message : String(error));
        args.onActivity?.({ message: `${localeLabel} failed` });
        results[localeIndex] = { locale, ok: false, reasonKey, ...(detail ? { detail } : {}) };
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(LOCALE_TRANSLATION_CONCURRENCY, args.request.requestedLocales.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}

async function handleTranslateInstance(args: {
  request: Request;
  env: Env;
  streamActivity: boolean;
}): Promise<Response> {
  const body = normalizeWorkerRequest(await readJson(args.request));
  if (!body) {
    throw new HttpError(400, {
      error: {
        code: 'BAD_REQUEST',
        reasonKey: 'coreui.errors.translation.invalidRequest',
        message: 'Invalid Translation Agent worker request',
        issues: [{ path: '', message: 'Expected { grant, accountPublicId, instanceId, requestedLocales, items }' }],
      },
    });
  }
  const requestId = resolveRequestId(args.request, body);
  await verifyRomaTranslationGrant({
    grant: body.grant,
    publicKeyPem: args.env.ROMA_AI_GRANT_PUBLIC_KEY_PEM,
    accountPublicId: body.accountPublicId,
    instanceId: body.instanceId,
    requestedLocales: body.requestedLocales,
  });

  const run = async (onActivity?: (event: AgentActivityEvent) => void) => {
    onActivity?.({
      message: 'Writing translations',
    });
    const results = await executeTranslationRun({
      env: args.env,
      requestId,
      request: body,
      onActivity,
    });
    const failed = results.filter((result) => !result.ok);
    return {
      status: 200,
      payload: {
        requestId,
        agentId: TRANSLATION_AGENT_ID,
        translation: {
          ok: failed.length === 0,
          baseLocale: body.baseLocale,
          requestedLocales: body.requestedLocales,
          results,
        },
      },
    };
  };

  if (!args.streamActivity) {
    const result = await run();
    return json(result.payload, { status: result.status });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await run((event) => sendStreamEvent(controller, 'activity', event));
        sendStreamEvent(controller, 'result', result);
        closeStream(controller);
      } catch (error) {
        const status =
          error instanceof HttpError ? error.status : error instanceof TranslationAgentError ? error.status : 500;
        const payload = error instanceof HttpError
          ? error.payload
          : error instanceof TranslationAgentError
            ? {
                error: {
                  code: error.code,
                  message: error.message,
                  ...(error.provider ? { provider: error.provider } : {}),
                },
              }
            : {
                error: {
                  code: 'PROVIDER_ERROR',
                  provider: 'translation-agent',
                  message: error instanceof Error ? error.message : String(error),
                },
              };
        sendStreamEvent(controller, 'result', { status, payload });
        closeStream(controller);
      }
    },
  });
  return eventStream(stream);
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
      if (request.method !== 'POST' || url.pathname !== '/translate-instance') {
        throw new HttpError(404, { error: { code: 'BAD_REQUEST', message: 'Not found' } });
      }
      return await handleTranslateInstance({
        request,
        env,
        streamActivity: request.headers.get('accept')?.includes('text/event-stream') === true,
      });
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
