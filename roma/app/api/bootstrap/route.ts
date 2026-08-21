import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAccountAuthzCookieName,
  resolveSessionBearer,
} from '../../../lib/auth/session';
import { withSession } from '../../../lib/current-account-route';
import { resolveBerlinBaseUrl } from '../../../lib/env/berlin';

export const runtime = 'edge';

type BootstrapPayload = {
  authz: {
    accountCapsule: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function GET(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withSession(request, session.response);

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(`${berlinBase}/session/bootstrap`, {
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

    const { accountCapsule, ...authz } = payload.authz;
    return withSession(
      request,
      NextResponse.json({ ...payload, authz }),
      [
        ...(session.setCookies ?? []),
        {
          name: resolveAccountAuthzCookieName(),
          value: accountCapsule,
        },
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
