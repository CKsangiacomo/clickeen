import { CK_REQUEST_ID_HEADER, asTrimmedString } from '@clickeen/ck-contracts';
import {
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { resolveAiAgent, type AiGrantPolicy } from '@clickeen/ck-contracts/ai';
import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';
import { resolveSanfranciscoBaseUrl } from './env/sanfrancisco';

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
  const fromRequestContext = getOptionalCloudflareRequestContext<{ env?: { AI_GRANT_HMAC_SECRET?: string } }>()
    ?.env?.AI_GRANT_HMAC_SECRET;
  const requestSecret = readTrimmedSecret(fromRequestContext);
  if (requestSecret) return requestSecret;

  const processSecret = readTrimmedSecret(typeof process !== 'undefined' ? process.env.AI_GRANT_HMAC_SECRET : undefined);
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
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

function resolveEnvStage(): string {
  const stage = String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  if (stage) return stage;
  return process.env.NODE_ENV === 'development' ? 'local' : 'cloud-dev';
}

async function mintGrant(grant: AIGrant): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(grant)));
  const sigB64 = await hmacSha256Base64Url(resolveAiGrantSecret(), `v1.${payloadB64}`);
  return `v1.${payloadB64}.${sigB64}`;
}

export async function issueInstanceTranslationGrant(args: {
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
    sub: { kind: 'user', userId: args.authz.userId, accountId: args.authz.accountId },
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

function normalizeRuntimeStatusResponse(payload: unknown): { ok: true } | { ok: false; detail: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, detail: 'sanfrancisco_instance_translation_runtime_invalid_payload' };
  }
  const record = payload as Record<string, unknown>;
  if (record.ok === true) return { ok: true };
  const error = record.error && typeof record.error === 'object' && !Array.isArray(record.error)
    ? (record.error as Record<string, unknown>)
    : null;
  const detail =
    asTrimmedString(error?.message) ??
    asTrimmedString(error?.detail) ??
    asTrimmedString(record.detail) ??
    'sanfrancisco_instance_translation_runtime_unavailable';
  return { ok: false, detail };
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function assertInstanceTranslationRuntimeReady(args: {
  authz: RomaAccountAuthzCapsulePayload;
  instanceId: string;
  requestId?: string | null;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  let baseUrl: string;
  let grant: string;
  try {
    baseUrl = resolveSanfranciscoBaseUrl().replace(/\/+$/, '');
    grant = await issueInstanceTranslationGrant({
      authz: args.authz,
      instanceId: args.instanceId,
    });
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/agents/instance-translation/runtime-status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${grant}`,
        accept: 'application/json',
        ...(args.requestId ? { [CK_REQUEST_ID_HEADER]: args.requestId } : {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  const text = await response.text().catch(() => '');
  const payload = safeJsonParse(text);
  if (!response.ok) {
    const normalized = normalizeRuntimeStatusResponse(payload);
    return normalized.ok ? { ok: false, detail: `SanFrancisco runtime unavailable (${response.status})` } : normalized;
  }
  const normalized = normalizeRuntimeStatusResponse(payload);
  return normalized.ok ? { ok: true } : normalized;
}
