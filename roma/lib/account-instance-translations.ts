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
  resolveRomaAiGrantPrivateKeyPem,
  resolveEnvStage,
  type RomaAIGrant,
} from './ai/grants';
import { readWidgetMaterializerArtifact } from '../generated/widget-materializer-artifacts';
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

type TranslationAgentRouteFailure = {
  ok: false;
  status: number;
  error: {
    code: string;
    message: string;
    provider?: string;
  };
};

type SavedInstanceSourcePayload = {
  widgetType: string;
  source: {
    content: {
      fields: Record<string, { value: string; identityKey: string; fieldPattern: string }>;
    };
  };
};

type TokyoTranslationsPayload = InstanceTranslationsPayload & { ok: true };
type TokyoTranslationValuesPayload = InstanceTranslationValuesPayload & { ok: true };
type TokyoTranslationMutationPayload = { ok: true; locale: string };

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

export type TranslationAgentActivityEvent = {
  message: string;
};

type TranslationAgentResponse = {
  requestId: string;
  agentId: typeof TRANSLATION_AGENT_ID;
  translation: {
    ok: boolean;
    baseLocale?: string | null;
    requestedLocales: string[];
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
  ok: boolean;
  translation: {
    ok: boolean;
    accepted: boolean;
    baseLocale: string;
    requestedLocales: string[];
    translatedLocales: string[];
    failedLocales: Array<{ locale: string; reasonKey: string; detail?: string }>;
  };
};

function buildTranslationAgentItems(args: {
  widgetType: string;
  content: SavedInstanceSourcePayload['source']['content'];
}): TranslationAgentItem[] {
  const editableFields = readWidgetMaterializerArtifact(args.widgetType)!.editableFields.fields;
  const editableFieldsByPattern = new Map(editableFields.map((field) => [field.path, field]));
  return Object.values(args.content.fields).map((field) => {
    const editableField = editableFieldsByPattern.get(field.fieldPattern)!;
    return {
      path: field.identityKey,
      type: editableField.type,
      value: field.value,
      label: editableField.label,
      role: editableField.role,
    };
  });
}

async function readTranslationAgentResponse(args: {
  response: Response;
  onActivity?: (event: TranslationAgentActivityEvent) => void;
}): Promise<{ status: number; payload: unknown }> {
  const contentType = args.response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') || !args.response.body) {
    const text = await args.response.text();
    return { status: args.response.status, payload: JSON.parse(text) as unknown };
  }

  const reader = args.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: unknown = null;

  const consumeEvent = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    if (eventName === 'activity') {
      const event = JSON.parse(data) as TranslationAgentActivityEvent;
      try {
        args.onActivity?.(event);
      } catch {
        // Activity transport is not translation truth.
      }
      return;
    }
    if (eventName === 'result') finalPayload = JSON.parse(data) as unknown;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      consumeEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  const tail = `${buffer}${decoder.decode()}`.trim();
  if (tail) consumeEvent(tail);
  const result = finalPayload as { status: number; payload: unknown };
  return { status: result.status, payload: result.payload };
}

async function loadSavedInstanceSource(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: SavedInstanceSourcePayload } | RouteFailure> {
  const result = await callTokyo<SavedInstanceSourcePayload>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}`,
      method: 'GET',
      decode: (payload) => payload as SavedInstanceSourcePayload,
      errorKey: 'coreui.errors.db.readFailed',
      errorDetail: 'tokyo_instance_open_http_error',
    },
  );
  if (!result.ok) return result;
  return { ok: true, value: result.value };
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
    grant: await mintRomaAIGrant(grantPayload, resolveRomaAiGrantPrivateKeyPem()),
    agentId: TRANSLATION_AGENT_ID,
  };
}

function routeFailureFromTranslationAgentError(
  status: number,
  payload: unknown,
): TranslationAgentRouteFailure {
  const error = (payload as {
    error: { code: string; message: string; provider?: string };
  }).error;
  return {
    ok: false,
    status,
    error,
  };
}

export async function loadAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: InstanceTranslationsPayload } | RouteFailure> {
  const result = await callTokyo<TokyoTranslationsPayload>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations`,
      method: 'GET',
      decode: (payload) => payload as TokyoTranslationsPayload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translations_http_error',
    },
  );
  if (!result.ok) return result;
  return {
    ok: true,
    value: {
      baseLocale: result.value.baseLocale,
      translations: result.value.translations,
    },
  };
}

export async function generateAccountInstanceTranslations(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  activeLocales: string[];
  authz: RomaAccountAuthzCapsulePayload;
  accountCapsule?: string | null;
  requestId?: string | null;
  onActivity?: (event: TranslationAgentActivityEvent) => void;
}): Promise<
  | { ok: true; value: InstanceTranslationsGeneratePayload; status: number }
  | RouteFailure
  | TranslationAgentRouteFailure
> {
  const baseLocale = args.baseLocale;
  const activeLocales = args.activeLocales;
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
          requestedLocales: [],
          translatedLocales: [],
          failedLocales: [],
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
  const items = buildTranslationAgentItems({
    widgetType: saved.value.widgetType,
    content: saved.value.source.content,
  });

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
      accept: args.onActivity ? 'text/event-stream' : 'application/json',
      body: {
        grant: issued.grant,
        agentId: issued.agentId,
        accountPublicId: args.accountId,
        instanceId: args.instanceId,
        widgetType: saved.value.widgetType,
        baseLocale,
        requestedLocales: activeLocales,
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
  const agentResult = await readTranslationAgentResponse({
    response,
    onActivity: args.onActivity,
  });
  if (agentResult.status < 200 || agentResult.status >= 300) {
    return routeFailureFromTranslationAgentError(
      agentResult.status,
      agentResult.payload,
    );
  }
  const translated = agentResult.payload as TranslationAgentResponse;
  const translatedLocales = translated.translation.results.flatMap((result) => (result.ok ? [result.locale] : []));
  const failedLocales = translated.translation.results.flatMap((result) =>
    result.ok
      ? []
      : [{
          locale: result.locale,
          reasonKey: result.reasonKey,
          ...(result.detail ? { detail: result.detail } : {}),
        }],
  );
  return {
    ok: true,
    status: 200,
    value: {
      ok: translated.translation.ok,
      translation: {
        ok: translated.translation.ok,
        accepted: true,
        baseLocale,
        requestedLocales: translated.translation.requestedLocales,
        translatedLocales,
        failedLocales,
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
  const locale = args.locale;
  const result = await callTokyo<TokyoTranslationValuesPayload>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'GET',
      decode: (payload) => payload as TokyoTranslationValuesPayload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_read_http_error',
    },
  );
  if (!result.ok) return result;
  return {
    ok: true,
    value: { locale: result.value.locale, values: result.value.values },
  };
}

export async function deleteAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { locale: string } } | RouteFailure> {
  const locale = args.locale;
  const result = await callTokyo<TokyoTranslationMutationPayload>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'DELETE',
      decode: (payload) => payload as TokyoTranslationMutationPayload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_delete_http_error',
    },
  );
  if (!result.ok) return result;
  return { ok: true, value: { locale: result.value.locale } };
}

export async function writeAccountInstanceTranslationValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { locale: string } } | RouteFailure> {
  const locale = args.locale;
  const result = await callTokyo<TokyoTranslationMutationPayload>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`,
      method: 'PUT',
      body: { values: args.values },
      decode: (payload) => payload as TokyoTranslationMutationPayload,
      errorKey: 'tokyo.errors.translation.invalid',
      errorDetail: 'tokyo_instance_translation_write_http_error',
    },
  );
  if (!result.ok) return result;
  return { ok: true, value: { locale: result.value.locale } };
}
