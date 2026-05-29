import { CK_REQUEST_ID_HEADER, isRecord, serializeCkLogEvent } from '@clickeen/ck-contracts';
import { isCompactAccountPublicId } from '@clickeen/ck-contracts/overlay-identity';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  INTERNAL_SERVICE_HEADER,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION,
  assertRomaAccountCapsuleAuth,
} from '../auth';
import {
  AccountInstanceTransitionError,
} from '../domains/render';
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

function logInternalRenderWarning(args: {
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

export async function readInternalRenderJsonBody(args: {
  req: Request;
  env: Env;
  boundary: string;
  instanceId?: string | null;
  accountId?: string | null;
}): Promise<unknown | null> {
  try {
    return await args.req.json();
  } catch (error) {
    logInternalRenderWarning({
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
}): Promise<
  | { ok: true }
  | { ok: false; response: Response }
> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION) {
    return { ok: true };
  }
  const auth = await authorizeRomaEditorTransition(args);
  return auth.ok ? { ok: true } : auth;
}

export function authorizeTranslationCompletionTransition(req: Request): Response | null {
  const internalServiceId = String(req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_SANFRANCISCO_TRANSLATION) return null;
  return json(
    { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
    { status: 403 },
  );
}

export type InternalRouteHandler = (args: TokyoRouteArgs) => Promise<Response | null>;
