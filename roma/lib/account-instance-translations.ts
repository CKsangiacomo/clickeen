import {
  asTrimmedString,
  isRecord,
} from '@clickeen/ck-contracts';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import {
  resolveAiAgent,
  type AiGrantPolicy,
} from '@clickeen/ck-contracts/ai';
import {
  mintRomaAIGrant,
  resolveAiGrantSecret,
  resolveEnvStage,
  type RomaAIGrant,
} from './ai/grants';
import { callTokyo } from './tokyo-client';
import { fetchTranslationAgent } from './translation-agent-control';

const TRANSLATION_AGENT_ID = 'widget.instance.translator';

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

type SavedInstanceSourcePayload = {
  widgetType: string;
  source: {
    content: {
      fields: Record<string, { value: string; identityKey?: string; fieldPattern?: string }>;
    };
  };
};

type TranslationAgentItem = {
  path: string;
  type: 'string' | 'richtext';
  value: string;
  label?: string;
  role?: string;
};

type TranslationAgentLocaleResult =
  | { locale: string; ok: true; count: number }
  | { locale: string; ok: false; reasonKey: string; detail?: string };

type TranslationAgentResponse = {
  requestId: string;
  agentId: typeof TRANSLATION_AGENT_ID;
  translation: {
    ok: boolean;
    baseLocale?: string | null;
    activeLocales: string[];
    results: TranslationAgentLocaleResult[];
  };
};

export type InstanceTranslationSummary = {
  locale: string;
};

export type InstanceTranslationsPayload = {
    baseLocale: string;
  translations: InstanceTranslationSummary[];
};

export type InstanceTranslationValuesPayload = {
    locale: string;
  values: Record<string, string>;
};

export type InstanceTranslationsGeneratePayload = {
  ok: true;
  translation: {
    ok: true;
    accepted: boolean;
    baseLocale: string;
    activeLocales: string[];
    skippedLocales: string[];
  };
};

function invalidPayload(detail: string): RouteFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.payload.invalid',
      detail,
    },
  };
}

function normalizeValueMap(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function normalizeTranslationSummary(raw: unknown): InstanceTranslationSummary | null {
  if (!isRecord(raw)) return null;
  const locale = asTrimmedString(raw.locale);
  return locale ? { locale } : null;
}

function normalizeTranslationsPayload(payload: unknown): InstanceTranslationsPayload | null {
  if (!isRecord(payload)) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale || !Array.isArray(payload.translations)) return null;
  const translations = payload.translations
    .map((entry) => normalizeTranslationSummary(entry))
    .filter((entry): entry is InstanceTranslationSummary => Boolean(entry));
  if (translations.length !== payload.translations.length) return null;
  return {
    baseLocale,
    translations,
  };
}

function normalizeTranslationValuesPayload(payload: unknown): InstanceTranslationValuesPayload | null {
  if (!isRecord(payload)) return null;
  const locale = asTrimmedString(payload.locale);
  const values = normalizeValueMap(payload.values);
  return locale && values ? { locale, values } : null;
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry));
  if (values.some((entry) => !entry)) return null;
  return values as string[];
}

function normalizeSavedInstanceSourcePayload(raw: unknown): SavedInstanceSourcePayload | null {
  if (!isRecord(raw)) return null;
  const widgetType = asTrimmedString(raw.widgetType);
  const source = isRecord(raw.source) ? raw.source : null;
  const content = isRecord(source?.content) ? source.content : null;
  const fields = isRecord(content?.fields) ? content.fields : null;
  if (!widgetType || !fields) return null;
  const normalizedFields: SavedInstanceSourcePayload['source']['content']['fields'] = {};
  for (const [path, field] of Object.entries(fields)) {
    if (!path || !isRecord(field) || typeof field.value !== 'string') return null;
    normalizedFields[path] = {
      value: field.value,
      ...(typeof field.identityKey === 'string' && field.identityKey ? { identityKey: field.identityKey } : {}),
      ...(typeof field.fieldPattern === 'string' && field.fieldPattern ? { fieldPattern: field.fieldPattern } : {}),
    };
  }
  return { widgetType, source: { content: { fields: normalizedFields } } };
}

function isRichtextValue(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function buildTranslationAgentItems(content: SavedInstanceSourcePayload['source']['content']): TranslationAgentItem[] {
  return Object.entries(content.fields).map(([path, field]) => ({
    path,
    type: isRichtextValue(field.value) ? 'richtext' : 'string',
    value: field.value,
    ...(field.identityKey ? { label: field.identityKey } : {}),
    ...(field.fieldPattern ? { role: field.fieldPattern } : {}),
  }));
}

function normalizeLocaleResult(raw: unknown): TranslationAgentLocaleResult | null {
  if (!isRecord(raw)) return null;
  const locale = asTrimmedString(raw.locale);
  if (!locale || typeof raw.ok !== 'boolean') return null;
  if (raw.ok) {
    return typeof raw.count === 'number' && Number.isFinite(raw.count)
      ? { locale, ok: true, count: Math.max(0, Math.floor(raw.count)) }
      : null;
  }
  const reasonKey = asTrimmedString(raw.reasonKey);
  if (!reasonKey) return null;
  const detail = asTrimmedString(raw.detail);
  return { locale, ok: false, reasonKey, ...(detail ? { detail } : {}) };
}

function normalizeTranslationAgentResponse(raw: unknown): TranslationAgentResponse | null {
  if (!isRecord(raw)) return null;
  const requestId = asTrimmedString(raw.requestId);
  const agentId = asTrimmedString(raw.agentId);
  const translation = isRecord(raw.translation) ? raw.translation : null;
  const activeLocales = normalizeStringArray(translation?.activeLocales);
  const resultsRaw = Array.isArray(translation?.results) ? translation.results : null;
  const results = resultsRaw
    ? resultsRaw.map((entry) => normalizeLocaleResult(entry)).filter((entry): entry is TranslationAgentLocaleResult => Boolean(entry))
    : null;
  if (
    !requestId ||
    agentId !== TRANSLATION_AGENT_ID ||
    !translation ||
    typeof translation.ok !== 'boolean' ||
    !activeLocales ||
    !results ||
    results.length !== resultsRaw?.length
  ) {
    return null;
  }
  return {
    requestId,
    agentId: TRANSLATION_AGENT_ID,
    translation: {
      ok: translation.ok,
      baseLocale: asTrimmedString(translation.baseLocale),
      activeLocales,
      results,
    },
  };
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false;
  if (leftSet.size !== rightSet.size) return false;
  return Array.from(leftSet).every((value) => rightSet.has(value));
}

async function loadSavedInstanceSource(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: SavedInstanceSourcePayload } | RouteFailure> {
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'coreui.errors.db.readFailed',
      errorDetail: 'tokyo_instance_open_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeSavedInstanceSourcePayload(result.value);
  if (!value) return invalidPayload('tokyo_instance_source_invalid_payload');
  return { ok: true, value };
}

function resolveTranslationAgentPolicy(authz: RomaAccountAuthzCapsulePayload): AiGrantPolicy {
  const resolved = resolveAiAgent(TRANSLATION_AGENT_ID);
  if (!resolved) throw new Error(`[Roma] Unknown Translation Agent: ${TRANSLATION_AGENT_ID}`);
  return resolveAiRuntimePolicy({
    entry: resolved.entry,
    policyProfile: authz.profile,
  });
}

async function issueTranslationAgentGrant(args: {
  authz: RomaAccountAuthzCapsulePayload;
  accountPublicId: string;
  instanceId: string;
  activeLocales: string[];
}): Promise<{ grant: string; agentId: typeof TRANSLATION_AGENT_ID }> {
  const resolved = resolveAiAgent(TRANSLATION_AGENT_ID);
  if (!resolved) throw new Error(`[Roma] Unknown Translation Agent: ${TRANSLATION_AGENT_ID}`);
  const ai = resolveTranslationAgentPolicy(args.authz);
  const budgets = resolveAiRuntimeBudget(ai);
  const nowSec = Math.floor(Date.now() / 1000);
  const grantPayload: RomaAIGrant = {
        iss: 'roma',
    jti: crypto.randomUUID(),
    sub: { kind: 'user', userId: args.authz.userId, accountId: args.authz.accountId },
    exp: nowSec + 10 * 60,
    caps: [`agent:${resolved.canonicalId}`],
    budgets,
    mode: 'ops',
    ai,
    trace: {
      accountPublicId: args.accountPublicId,
      instanceId: args.instanceId,
      activeLocales: args.activeLocales,
      surfaceId: 'roma.account.instance.translations',
      envStage: resolveEnvStage(),
    },
  };
  return {
    grant: await mintRomaAIGrant(grantPayload, resolveAiGrantSecret()),
    agentId: TRANSLATION_AGENT_ID,
  };
}

function routeFailureFromTranslationAgentError(status: number, payload: unknown, fallback: string): RouteFailure {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const reasonKey = asTrimmedString(error?.reasonKey) ?? asTrimmedString(error?.code) ?? 'coreui.errors.translation.failed';
  const detail = asTrimmedString(error?.message) ?? asTrimmedString(error?.detail) ?? fallback;
  return {
    ok: false,
    status: status === 400 || status === 401 || status === 403 || status === 422 ? status : 502,
    error: {
      kind: status === 401 ? 'AUTH' : status === 403 ? 'DENY' : status === 400 || status === 422 ? 'VALIDATION' : 'UPSTREAM_UNAVAILABLE',
      reasonKey,
      detail,
    },
  };
}

export async function loadAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationsPayload } | RouteFailure> {
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translations_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeTranslationsPayload(result.value);
  if (!value) return invalidPayload('tokyo_instance_translations_invalid_payload');
  return { ok: true, value };
}

export async function generateAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  authz: RomaAccountAuthzCapsulePayload;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationsGeneratePayload; status: number } | RouteFailure> {
  const baseLocale = asTrimmedString(args.baseLocale);
  const activeLocales = normalizeStringArray(args.activeLocales);
  if (!baseLocale) return invalidPayload('baseLocale_missing');
  if (!activeLocales) return invalidPayload('activeLocales_invalid');
  if (activeLocales.length === 0) {
    return {
      ok: true,
      status: 200,
      value: {
        ok: true,
        translation: {
          ok: true,
          accepted: false,
          baseLocale,
          activeLocales,
          skippedLocales: [],
        },
      },
    };
  }
  const saved = await loadSavedInstanceSource({
    accountId: args.accountId,
    instanceId: args.instanceId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!saved.ok) return saved;
  const items = buildTranslationAgentItems(saved.value.source.content);
  if (items.length === 0) return invalidPayload('saved_instance_has_no_translatable_fields');

  let issued: { grant: string; agentId: typeof TRANSLATION_AGENT_ID };
  try {
    issued = await issueTranslationAgentGrant({
      authz: args.authz,
      accountPublicId: args.accountId,
      instanceId: args.instanceId,
      activeLocales,
    });
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.auth.contextUnavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  let response: Response;
  try {
    response = await fetchTranslationAgent({
      path: '/translate-instance',
      method: 'POST',
      requestId: args.requestId,
      body: {
        grant: issued.grant,
        agentId: issued.agentId,
        accountPublicId: args.accountId,
        instanceId: args.instanceId,
        widgetType: saved.value.widgetType,
        baseLocale,
        activeLocales,
        items,
        trace: { client: 'roma', requestId: args.requestId ?? undefined },
      },
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.translation.failed',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  const text = await response.text().catch(() => '');
  const payload = safeJsonParse(text);
  if (!response.ok) {
    return routeFailureFromTranslationAgentError(response.status, payload, text || `translation_agent_http_${response.status}`);
  }
  const translated = normalizeTranslationAgentResponse(payload);
  if (
    !translated ||
    !translated.translation.ok ||
    !sameStringSet(translated.translation.activeLocales, activeLocales) ||
    !translated.translation.results.every((result) => result.ok) ||
    !sameStringSet(translated.translation.results.map((result) => result.locale), activeLocales)
  ) {
    return invalidPayload('translation_agent_invalid_payload');
  }
  return {
    ok: true,
    status: 200,
    value: {
      ok: true,
      translation: {
        ok: true,
        accepted: true,
        baseLocale,
        activeLocales: translated.translation.activeLocales,
        skippedLocales: [],
      },
    },
  };
}

export async function readAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationValuesPayload } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  if (!locale) return invalidPayload('locale_missing');
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_read_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeTranslationValuesPayload(result.value);
  if (!value || value.locale !== locale) return invalidPayload('tokyo_instance_translation_invalid_payload');
  return { ok: true, value };
}

export async function deleteAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { locale: string } } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  if (!locale) return invalidPayload('locale_missing');
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'DELETE',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_delete_http_error',
    },
  );
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const deletedLocale = asTrimmedString(payload?.locale);
  if (payload?.ok !== true || deletedLocale !== locale) {
    return invalidPayload('tokyo_instance_translation_delete_invalid_payload');
  }
  return { ok: true, value: { locale } };
}

export async function writeAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { locale: string } } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  const values = normalizeValueMap(args.values);
  if (!locale) return invalidPayload('locale_missing');
  if (!values) return invalidPayload('values_invalid');
  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'PUT',
      body: { values },
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_write_http_error',
    },
  );
  if (!result.ok) return result;
  const payload = isRecord(result.value) ? result.value : null;
  const storedLocale = asTrimmedString(payload?.locale);
  if (storedLocale !== locale) return invalidPayload('tokyo_instance_translation_write_invalid_payload');
  return { ok: true, value: { locale } };
}
