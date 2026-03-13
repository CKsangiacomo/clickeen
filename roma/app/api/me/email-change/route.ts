import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../lib/auth/session';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';

export const runtime = 'edge';

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

export async function POST(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(`${berlinBase}/v1/me/email-change`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: request.headers.get('accept') || 'application/json',
        'content-type': request.headers.get('content-type') || 'application/json',
      },
      cache: 'no-store',
      body: await request.text(),
    });
    const body = await upstream.text().catch(() => '');
    return withSession(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      session.setCookies,
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
