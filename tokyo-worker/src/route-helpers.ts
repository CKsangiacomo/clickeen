import { isUuid } from '@clickeen/ck-contracts';
import {
  assertRomaAccountCapsuleAuth,
  INTERNAL_SERVICE_HEADER,
  requireDevAuth,
  TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL,
  TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
} from './auth';
import { prettyStableJson, sha256Hex } from './asset-utils';
import { json } from './http';
import { roleRank, type MemberRole } from './domains/assets';
import type { Env } from './types';

export type TokyoRouteArgs = {
  req: Request;
  env: Env;
  pathname: string;
  url: URL;
  respond: (response: Response) => Response;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function sha256StableJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(prettyStableJson(value));
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return await sha256Hex(arrayBuffer);
}

export function respondMethodNotAllowed(respond: TokyoRouteArgs['respond']): Response {
  return respond(json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 }));
}

export function respondValidation(
  respond: TokyoRouteArgs['respond'],
  reasonKey: string,
  status = 422,
): Response {
  return respond(json({ error: { kind: 'VALIDATION', reasonKey } }, { status }));
}

export function respondInternalOnly(
  respond: TokyoRouteArgs['respond'],
  detail: string,
): Response {
  return respond(
    json(
      {
        error: {
          kind: 'VALIDATION',
          reasonKey: 'tokyo.errors.internalOnly',
          detail,
        },
      },
      { status: 410 },
    ),
  );
}

export function isValidScopedInstance(
  publicId: string | null,
  accountId: string,
): boolean {
  return Boolean(publicId) && isUuid(accountId);
}

export async function authorizeRomaAccountScopedRequest(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  const auth = await assertRomaAccountCapsuleAuth(args.req, args.env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
  if (!auth.ok) return auth.response;
  const capsule = auth.principal.accountAuthz;
  if (capsule.accountId !== args.accountId) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
      { status: 403 },
    );
  }
  if (roleRank(capsule.role) < roleRank(args.minRole)) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
      { status: 403 },
    );
  }
  return null;
}

export async function authorizeSavedRenderControlRequest(args: {
  req: Request;
  env: Env;
  accountId: string;
  minRole: MemberRole;
}): Promise<Response | null> {
  const internalServiceId = String(args.req.headers.get(INTERNAL_SERVICE_HEADER) || '')
    .trim()
    .toLowerCase();
  if (internalServiceId === TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL) {
    return requireDevAuth(args.req, args.env, {
      allowTrustedInternalServices: [TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL],
    });
  }
  return authorizeRomaAccountScopedRequest(args);
}
