import {
  readRomaAuthzCapsuleHeader,
  resolveCachedJwksVerifyKey,
  verifyRomaAccountAuthzCapsule,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { json } from './http';
import type { Env } from './types';

type ProductAccountPrincipal = {
  accountAuthz: RomaAccountAuthzCapsulePayload;
};

type ProductAccountAuthResult =
  | { ok: true; principal: ProductAccountPrincipal }
  | { ok: false; response: Response };

export const INTERNAL_SERVICE_HEADER = 'x-ck-internal-service';
export const TOKYO_INTERNAL_SERVICE_DEVSTUDIO_LOCAL = 'devstudio.local';
export const TOKYO_INTERNAL_SERVICE_SANFRANCISCO_L10N = 'sanfrancisco.l10n';
export const TOKYO_INTERNAL_SERVICE_ROMA_EDGE = 'roma.edge';

const BERLIN_ACCOUNT_CAPSULE_JWKS_CACHE_KEY = '__CK_TOKYO_ACCOUNT_CAPSULE_JWKS_V2__';
const DEFAULT_BERLIN_BASE_URL = 'https://berlin-dev.clickeen.workers.dev';

function asBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;
  return token.trim() || null;
}

function normalizeInternalServiceId(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function resolveBerlinJwksUrl(env: Env): string {
  const direct = (typeof env.BERLIN_JWKS_URL === 'string' ? env.BERLIN_JWKS_URL.trim() : '') || null;
  if (direct) return direct;
  const base = (typeof env.BERLIN_BASE_URL === 'string' ? env.BERLIN_BASE_URL.trim() : '') || DEFAULT_BERLIN_BASE_URL;
  return `${base.replace(/\/+$/, '')}/.well-known/jwks.json`;
}

async function verifyRomaAccountCapsule(
  req: Request,
  env: Env,
): Promise<
  | { ok: true; payload: RomaAccountAuthzCapsulePayload }
  | { ok: false; response: Response | null }
> {
  const token = readRomaAuthzCapsuleHeader(req);
  if (!token) return { ok: false, response: null };

  const verified = await verifyRomaAccountAuthzCapsule({
    token,
    resolveVerifyKey: (kid) =>
      resolveCachedJwksVerifyKey({
        cacheKey: BERLIN_ACCOUNT_CAPSULE_JWKS_CACHE_KEY,
        jwksUrl: resolveBerlinJwksUrl(env),
        kid,
      }),
  });
  if (!verified.ok) {
    return {
      ok: false,
      response: json(
        { error: { kind: 'DENY', reasonKey: 'AUTH_INVALID', detail: verified.reason } },
        { status: verified.reason === 'verify_key_unavailable' ? 502 : 403 },
      ),
    };
  }

  return { ok: true, payload: verified.payload };
}

export async function assertRomaAccountCapsuleAuth(
  req: Request,
  env: Env,
  options?: { requiredInternalServiceId?: string | null },
): Promise<ProductAccountAuthResult> {
  const requiredInternalServiceId = normalizeInternalServiceId(
    options?.requiredInternalServiceId ?? null,
  );
  if (requiredInternalServiceId) {
    const internalServiceId = normalizeInternalServiceId(req.headers.get(INTERNAL_SERVICE_HEADER));
    if (internalServiceId !== requiredInternalServiceId) {
      return {
        ok: false,
        response: json(
          { error: { kind: 'DENY', reasonKey: 'AUTH_INVALID', detail: 'internal_service_invalid' } },
          { status: 403 },
        ),
      };
    }
  }

  const capsule = await verifyRomaAccountCapsule(req, env);
  if (!capsule.ok) {
    if (capsule.response) return { ok: false, response: capsule.response };
    return {
      ok: false,
      response: json(
        { error: { kind: 'DENY', reasonKey: 'AUTH_INVALID', detail: 'account_authz_capsule_missing' } },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    principal: {
      accountAuthz: capsule.payload,
    },
  };
}

export async function assertProductAccountAuth(req: Request, env: Env): Promise<ProductAccountAuthResult> {
  const expected = (env.CK_INTERNAL_SERVICE_JWT || '').trim();
  if (!expected) {
    return {
      ok: false,
      response: json({ error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.misconfigured' } }, { status: 500 }),
    };
  }

  const internalServiceId = normalizeInternalServiceId(req.headers.get(INTERNAL_SERVICE_HEADER));
  if (internalServiceId !== TOKYO_INTERNAL_SERVICE_ROMA_EDGE) {
    return {
      ok: false,
      response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID', detail: 'internal_service_invalid' } }, { status: 403 }),
    };
  }

  const token = asBearerToken(req.headers.get('authorization'));
  if (!token) {
    return {
      ok: false,
      response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 }),
    };
  }
  if (!timingSafeEqual(token, expected)) {
    return {
      ok: false,
      response: json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 }),
    };
  }

  return assertRomaAccountCapsuleAuth(req, env, {
    requiredInternalServiceId: TOKYO_INTERNAL_SERVICE_ROMA_EDGE,
  });
}

export function requireDevAuth(
  req: Request,
  env: Env,
  options?: { allowTrustedInternalServices?: readonly string[] },
): Response | null {
  const expected = (env.TOKYO_DEV_JWT || '').trim();
  if (!expected) {
    return json({ error: { kind: 'INTERNAL', reasonKey: 'tokyo.errors.misconfigured' } }, { status: 500 });
  }
  const token = asBearerToken(req.headers.get('authorization'));
  if (!token) return json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 });
  const internalServiceId = normalizeInternalServiceId(req.headers.get(INTERNAL_SERVICE_HEADER));
  if (
    !timingSafeEqual(token, expected) ||
    !internalServiceId ||
    !(options?.allowTrustedInternalServices ?? []).includes(internalServiceId)
  ) {
    return json({ error: { kind: 'DENY', reasonKey: 'AUTH_INVALID' } }, { status: 403 });
  }
  return null;
}
