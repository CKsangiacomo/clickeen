import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  resolveParisSession,
  withParisDevAuthorization,
} from '../../../../../lib/api/paris/proxy-helpers';

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
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(`${paris.baseUrl.replace(/\/$/, '')}/api/roma/bootstrap`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const headers = withParisDevAuthorization(new Headers(), session.accessToken);

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
      7000,
    );

    const data = await res.text();
    const response = new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      },
    });
    return applySessionCookies(response, request, session.setCookies);
  } catch (error) {
    return proxyErrorResponse(error, CORS_HEADERS);
  }
}
