import { NextRequest, NextResponse } from 'next/server';
import {
  resolveRequestProtocol,
  resolveSessionCookieDomain,
  type SessionCookieSpec,
} from './session';

export function applySessionCookies(
  response: NextResponse,
  request: NextRequest,
  setCookies?: SessionCookieSpec[],
) {
  if (!setCookies?.length) return response;
  const secure = resolveRequestProtocol(request) === 'https:';
  const domain = resolveSessionCookieDomain(request);
  for (const cookie of setCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
      ...(domain ? { domain } : {}),
    });
  }
  return response;
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withCorsHeaders(response: NextResponse, corsHeaders?: Record<string, string>): NextResponse {
  if (!corsHeaders) return response;
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export function withSessionAndCors(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
  corsHeaders?: Record<string, string>,
): NextResponse {
  return withNoStore(withCorsHeaders(applySessionCookies(response, request, setCookies), corsHeaders));
}
