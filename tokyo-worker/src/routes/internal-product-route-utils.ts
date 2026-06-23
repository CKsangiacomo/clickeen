import { CK_REQUEST_ID_HEADER, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import { timingSafeEqualBytes } from '@clickeen/ck-contracts/security';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  INTERNAL_SERVICE_HEADER,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  TOKYO_INTERNAL_SERVICE_TRANSLATION_AGENT,
  assertRomaAccountCapsuleAuth,
} from '../auth';
import {
  AccountInstanceTransitionError,
} from '../domains/account-instances/operations';
import { roleRank } from '../domains/assets';
import { json } from '../http';
import type { TokyoRouteArgs } from '../route-helpers';
import type { Env } from '../types';

export function normalizeAccountPublicId(value: unknown): string {
  const accountId = String(value || '').trim().toUpperCase();
  return isCompactAccountPublicId(accountId) ? accountId : '';
}

export function normalizeTranslatedValues(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const values: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!path || typeof text !== 'string') return null;
    values[path] = text;
  }
  return values;
}

function asTrimmedString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function normalizeStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map((entry) => asTrimmedString(entry));
  if (values.some((entry) => !entry)) return null;
  return values as string[];
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

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false;
  if (leftSet.size !== rightSet.size) return false;
  return Array.from(leftSet).every((value) => rightSet.has(value));
}

async function verifyTranslationAgentWriteGrant(args: {
  req: Request;
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<null | Response> {
  const secret = String(args.env.AI_GRANT_HMAC_SECRET || '').trim();
  if (!secret) {
    return json(
      { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'tokyo.translation.writeGrantSecretMissing' } },
      { status: 503 },
    );
  }
  const grant = String(args.req.headers.get('x-ck-ai-grant') || '').trim();
  const parts = grant.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    return json({ error: { kind: 'AUTH', reasonKey: 'tokyo.translation.writeGrantInvalid' } }, { status: 401 });
  }
  const payloadB64 = parts[1] ?? '';
  const sigB64 = parts[2] ?? '';
  let payload: unknown;
  try {
    const payloadText = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(payloadText) as unknown;
  } catch {
    return json({ error: { kind: 'AUTH', reasonKey: 'tokyo.translation.writeGrantInvalid' } }, { status: 401 });
  }
  const expectedSig = await hmacSha256(secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqualBytes(expectedSig, providedSig)) {
    return json({ error: { kind: 'AUTH', reasonKey: 'tokyo.translation.writeGrantInvalid' } }, { status: 401 });
  }
  if (!isRecord(payload)) {
    return json({ error: { kind: 'AUTH', reasonKey: 'tokyo.translation.writeGrantInvalid' } }, { status: 401 });
  }
  const exp = typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? Math.floor(payload.exp) : 0;
  if (exp <= Math.floor(Date.now() / 1000)) {
    return json({ error: { kind: 'AUTH', reasonKey: 'tokyo.translation.writeGrantExpired' } }, { status: 401 });
  }
  const caps = Array.isArray(payload.caps) && payload.caps.every((entry) => typeof entry === 'string') ? payload.caps : [];
  const ai = isRecord(payload.ai) ? payload.ai : null;
  const trace = isRecord(payload.trace) ? payload.trace : null;
  const traceAccountPublicId = asTrimmedString(trace?.accountPublicId);
  const traceInstanceId = asTrimmedString(trace?.instanceId);
  const traceActiveLocales = normalizeStringArray(trace?.activeLocales);
  if (
    payload.iss !== 'roma' ||
    !caps.includes('agent:widget.instance.translator') ||
    ai?.agentId !== 'widget.instance.translator' ||
    traceAccountPublicId !== args.accountId ||
    traceInstanceId !== args.instanceId ||
    !traceActiveLocales ||
    !sameStringSet(traceActiveLocales, Array.from(new Set(traceActiveLocales))) ||
    !traceActiveLocales.includes(args.locale)
  ) {
    return json({ error: { kind: 'DENY', reasonKey: 'tokyo.translation.writeGrantDenied' } }, { status: 403 });
  }
  return null;
}

export function normalizeReasonText(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

export function transitionErrorResponse(error: unknown): Response {
  if (error instanceof AccountInstanceTransitionError) {
    return json(
      {
        error: {
          kind: error.kind,
          reasonKey: error.reasonKey,
          detail: error.message,
          ...(error.paths?.length ? { paths: error.paths } : {}),
        },
      },
      { status: error.status },
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  return json(
    {
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail,
      },
    },
    { status: 502 },
  );
}

function logInternalProductWarning(args: {
  req: Request;
  env: Env;
  boundary: string;
  detail: string;
  instanceId?: string | null;
  accountId?: string | null;
}): void {
  console.warn(
    serializeCkLogEvent({
      event: 'boundary.parse_failed',
      service: 'tokyo-worker',
      stage: typeof args.env.ENV_STAGE === 'string' && args.env.ENV_STAGE.trim() ? args.env.ENV_STAGE.trim() : 'unknown',
      requestId: String(args.req.headers.get(CK_REQUEST_ID_HEADER) || '').trim() || crypto.randomUUID(),
      boundary: args.boundary,
      method: args.req.method,
      path: new URL(args.req.url).pathname,
      detail: args.detail,
      ...(args.instanceId ? { instanceId: args.instanceId } : {}),
      ...(args.accountId ? { accountId: args.accountId } : {}),
    }),
  );
}

export async function readInternalProductJsonBody(args: {
  req: Request;
  env: Env;
  boundary: string;
  instanceId?: string | null;
  accountId?: string | null;
}): Promise<unknown | null> {
  try {
    return await args.req.json();
  } catch (error) {
    logInternalProductWarning({
      req: args.req,
      env: args.env,
      boundary: args.boundary,
      instanceId: args.instanceId,
      accountId: args.accountId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function authorizeRomaEditorTransition(args: {
  req: Request;
  env: Env;
  accountId: string;
}): Promise<
  | { ok: true; capsule: RomaAccountAuthzCapsulePayload }
  | { ok: false; response: Response }
> {
  const auth = await assertRomaAccountCapsuleAuth(args.req, args.env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
  if (!auth.ok) return auth;
  const capsule = auth.principal.accountAuthz;
  if (capsule.accountPublicId !== args.accountId || roleRank(capsule.role) < roleRank('editor')) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
    };
  }
  return { ok: true, capsule };
}

export async function authorizeTranslatedLocaleWriteTransition(args: {
  req: Request;
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<
  | { ok: true }
  | { ok: false; response: Response }
> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_TRANSLATION_AGENT) {
    const grantError = await verifyTranslationAgentWriteGrant({
      req: args.req,
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      locale: args.locale,
    });
    return grantError ? { ok: false, response: grantError } : { ok: true };
  }
  const auth = await authorizeRomaEditorTransition(args);
  return auth.ok ? { ok: true } : auth;
}

export type InternalRouteHandler = (args: TokyoRouteArgs) => Promise<Response | null>;
