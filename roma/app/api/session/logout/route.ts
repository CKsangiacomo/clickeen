import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../lib/env/berlin';
import {
  resolveRequestProtocol,
  resolveSessionCookieDomain,
  resolveSessionCookieNames,
} from '../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveAllSessionCookieNames(): string[] {
  const active = resolveSessionCookieNames();
  return [active.access, active.refresh];
}

export async function POST(request: NextRequest) {
  const active = resolveSessionCookieNames();
  const refreshToken = request.cookies.get(active.refresh)?.value?.trim() || '';

  try {
    const berlinBase = resolveBerlinBaseUrl();
    if (refreshToken) {
      await fetch(`${berlinBase}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }
  } catch {
    // Best-effort logout should still clear local cookies even when Berlin is unreachable.
  }

  const secure = resolveRequestProtocol(request) === 'https:';
  const domain = resolveSessionCookieDomain(request);
  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  const cookieNames = resolveAllSessionCookieNames();
  for (const cookieName of cookieNames) {
    response.cookies.set({
      name: cookieName,
      value: '',
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    if (domain) {
      response.cookies.set({
        name: cookieName,
        value: '',
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        domain,
      });
    }
  }
  return response;
}
