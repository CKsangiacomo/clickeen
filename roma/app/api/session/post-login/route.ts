import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, resolveSessionBearer } from '../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const nextPath = resolveNextPath(request.nextUrl.searchParams.get('next'));
  const auth = await resolveSessionBearer(request);

  if (!auth.ok) {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.required' }), {
      headers: CACHE_HEADERS,
    });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { headers: CACHE_HEADERS });
  applySessionCookies(response, request, auth.setCookies);
  return response;
}
