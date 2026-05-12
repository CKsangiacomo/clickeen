import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAccountAuthzCookieName,
  resolveJwtCookieMaxAge,
  resolveSessionBearer,
} from '../../../lib/auth/session';
import { withSession } from '../../../lib/current-account-route';
import { resolveBerlinBaseUrl } from '../../../lib/env/berlin';

export const runtime = 'edge';

type BootstrapPayload = {
  authz?: {
    accountCapsule?: unknown;
  } | null;
  [key: string]: unknown;
};

function sanitizeBootstrapPayload(payload: BootstrapPayload): {
  payload: BootstrapPayload;
  accountCapsule: string | null;
} {
  const accountCapsule =
    typeof payload.authz?.accountCapsule === 'string' && payload.authz.accountCapsule.trim()
      ? payload.authz.accountCapsule.trim()
      : null;
  const authz =
    payload.authz && typeof payload.authz === 'object'
      ? { ...(payload.authz as Record<string, unknown>) }
      : null;
  if (authz) {
    delete authz.accountCapsule;
  }
  return {
    payload: {
      ...payload,
      ...(authz ? { authz } : {}),
    },
    accountCapsule,
  };
}

export async function GET(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withSession(request, session.response);

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(`${berlinBase}/v1/session/bootstrap`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    const payload = (await upstream.json().catch(() => null)) as BootstrapPayload | null;
    if (!upstream.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return withSession(
        request,
        NextResponse.json(payload ?? { error: { reasonKey: 'coreui.errors.auth.contextUnavailable' } }, {
          status: upstream.status || 502,
        }),
        session.setCookies,
      );
    }

    const sanitized = sanitizeBootstrapPayload(payload);
    return withSession(
      request,
      NextResponse.json(sanitized.payload),
      [
        ...(session.setCookies ?? []),
        ...(sanitized.accountCapsule
          ? [
              {
                name: resolveAccountAuthzCookieName(),
                value: sanitized.accountCapsule,
                maxAge: resolveJwtCookieMaxAge(sanitized.accountCapsule, 30 * 60),
              },
            ]
          : []),
      ],
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}
