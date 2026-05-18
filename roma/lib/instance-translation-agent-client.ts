import { CK_REQUEST_ID_HEADER, asTrimmedString, looksLikeHtmlErrorPage } from '@clickeen/ck-contracts';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { resolveAiAgent, type AiGrantPolicy } from '@clickeen/ck-contracts/ai';
import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';
import { resolveSanfranciscoBaseUrl } from './env/sanfrancisco';

type SavedTextGraphItem = {
  path: string;
  type: 'string' | 'richtext';
  label?: string;
  role?: string;
  value: string;
};

type InstanceTranslationRequest = {
  v: 1;
  widgetType: string;
  sourceLanguage: string;
  targetLanguage: string;
  items: SavedTextGraphItem[];
};

type CurrentLanguageValues = {
  v: 1;
  values: Record<string, string>;
};

type AIGrant = {
  v: 1;
  iss: 'roma';
  jti: string;
  sub: { kind: 'user'; userId: string; accountId: string };
  exp: number;
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
  };
  mode: 'ops';
  ai: AiGrantPolicy;
  trace: {
    sessionId: string;
    instancePublicId: string;
    envStage: string;
  };
};

function readTrimmedSecret(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAiGrantSecret(): string {
  const fromRequestContext = getOptionalCloudflareRequestContext<{
    env?: { AI_GRANT_HMAC_SECRET?: string };
  }>()?.env?.AI_GRANT_HMAC_SECRET;
  const requestSecret = readTrimmedSecret(fromRequestContext);
  if (requestSecret) return requestSecret;

  const processSecret = readTrimmedSecret(
    typeof process !== 'undefined' ? process.env.AI_GRANT_HMAC_SECRET : undefined,
  );
  if (processSecret) return processSecret;

  throw new Error('[Roma] Missing AI_GRANT_HMAC_SECRET');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

function resolveEnvStage(): string {
  const stage = String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || '')
    .trim()
    .toLowerCase();
  if (stage) return stage;
  return process.env.NODE_ENV === 'development' ? 'local' : 'cloud-dev';
}

async function mintGrant(grant: AIGrant): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigB64 = await hmacSha256Base64Url(resolveAiGrantSecret(), `v1.${payloadB64}`);
  return `v1.${payloadB64}.${sigB64}`;
}

async function issueInstanceTranslationGrant(args: {
  authz: RomaAccountAuthzCapsulePayload;
  instanceId: string;
}): Promise<string> {
  const resolvedAgent = resolveAiAgent('widget.instance.translator');
  if (!resolvedAgent) throw new Error('instance_translation_agent_missing');
  const ai = resolveAiRuntimePolicy({
    entry: resolvedAgent.entry,
    policyProfile: args.authz.profile,
  });
  const budget = resolveAiRuntimeBudget(ai);
  const nowSec = Math.floor(Date.now() / 1000);
  return mintGrant({
    v: 1,
    iss: 'roma',
    jti: crypto.randomUUID(),
    sub: {
      kind: 'user',
      userId: args.authz.userId,
      accountId: args.authz.accountId,
    },
    exp: nowSec + 10 * 60,
    caps: [`agent:${resolvedAgent.canonicalId}`],
    budgets: {
      maxTokens: budget.maxTokens,
      timeoutMs: budget.timeoutMs,
    },
    mode: 'ops',
    ai,
    trace: {
      sessionId: crypto.randomUUID(),
      instancePublicId: args.instanceId,
      envStage: resolveEnvStage(),
    },
  });
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function summarizeUpstreamError(args: { baseUrl: string; status: number; bodyText: string }): string {
  const base = args.baseUrl ? args.baseUrl.replace(/\/$/, '') : '(missing)';
  if (looksLikeHtmlErrorPage(args.bodyText)) {
    return `SanFrancisco returned an HTML error page (HTTP ${args.status}). Check SANFRANCISCO_BASE_URL (currently: ${base}).`;
  }
  return args.bodyText || `SanFrancisco error (${args.status})`;
}

function normalizeInstanceTranslationResponse(payload: unknown): CurrentLanguageValues | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const currentLanguageValues =
    record.currentLanguageValues &&
    typeof record.currentLanguageValues === 'object' &&
    !Array.isArray(record.currentLanguageValues)
      ? (record.currentLanguageValues as Record<string, unknown>)
      : null;
  if (
    record.v === 1 &&
    record.operation === 'translate_saved_instance' &&
    currentLanguageValues?.v === 1 &&
    currentLanguageValues.values &&
    typeof currentLanguageValues.values === 'object' &&
    !Array.isArray(currentLanguageValues.values)
  ) {
    const values: Record<string, string> = {};
    for (const [path, value] of Object.entries(currentLanguageValues.values as Record<string, unknown>)) {
      if (typeof value !== 'string') return null;
      values[path] = value;
    }
    return { v: 1, values };
  }
  if (record.v !== 1 || !record.values || typeof record.values !== 'object' || Array.isArray(record.values)) {
    return null;
  }
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(record.values as Record<string, unknown>)) {
    if (typeof value !== 'string') return null;
    values[path] = value;
  }
  return { v: 1, values };
}

export async function produceInstanceTranslationValues(args: {
  authz: RomaAccountAuthzCapsulePayload;
  instanceId: string;
  request: InstanceTranslationRequest;
  requestId?: string | null;
}): Promise<{ ok: true; value: CurrentLanguageValues } | { ok: false; detail: string }> {
  let baseUrl: string;
  let grant: string;
  try {
    baseUrl = resolveSanfranciscoBaseUrl().replace(/\/+$/, '');
    grant = await issueInstanceTranslationGrant({
      authz: args.authz,
      instanceId: args.instanceId,
    });
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/agents/instance-translation/translate-saved-instance`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${grant}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(args.requestId ? { [CK_REQUEST_ID_HEADER]: args.requestId } : {}),
      },
      body: JSON.stringify({
        v: 1,
        operation: 'translate_saved_instance',
        accountId: args.authz.accountId,
        instanceId: args.instanceId,
        widgetType: args.request.widgetType,
        baseLocale: args.request.sourceLanguage,
        targetLocale: args.request.targetLanguage,
        jobId: crypto.randomUUID(),
        currentSavedTextGraph: args.request.items,
      }),
      cache: 'no-store',
    });
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const text = await response.text().catch(() => '');
  const payload = safeJsonParse(text);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? asTrimmedString((payload as Record<string, unknown>).error && (payload as any).error.message)
        : null;
    return {
      ok: false,
      detail:
        message ??
        summarizeUpstreamError({
          baseUrl,
          status: response.status,
          bodyText: text,
        }),
    };
  }

  const normalized = normalizeInstanceTranslationResponse(payload);
  if (!normalized) {
    return {
      ok: false,
      detail: 'sanfrancisco_instance_translation_invalid_payload',
    };
  }
  return { ok: true, value: normalized };
}
