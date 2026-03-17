import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/members`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      },
    );
    const body = await upstream.text().catch(() => '');
    return withSession(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      current.value.setCookies,
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
      current.value.setCookies,
    );
  }
}
