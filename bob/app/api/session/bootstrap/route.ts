import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionBearer } from '../../../../../lib/auth/session';
import { resolveBerlinBaseUrl } from '../../../../../lib/env/berlin';
import { withSessionAndCors } from '../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) {
    return withSessionAndCors(request, session.response, undefined, CORS_HEADERS);
  }

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
    const body = await upstream.text().catch(() => '');
    return withSessionAndCors(
      request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      session.setCookies,
      CORS_HEADERS,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSessionAndCors(
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
      CORS_HEADERS,
    );
  }
}
