import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../../../lib/env/berlin';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type BerlinCallbackPayload = {
  error?: unknown;
};

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function extractReasonKey(payload: BerlinCallbackPayload | null, fallback = 'coreui.errors.auth.login_failed'): string {
  if (!payload) return fallback;
  if (payload.error && typeof payload.error === 'object') {
    const reasonKey = (payload.error as Record<string, unknown>).reasonKey;
    if (typeof reasonKey === 'string' && reasonKey.trim()) return reasonKey.trim();
  }
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  return fallback;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const state = String(url.searchParams.get('state') || '').trim();
  const oauthError = String(url.searchParams.get('error') || '').trim();
  const oauthErrorDescription = String(url.searchParams.get('error_description') || '').trim();

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'roma.errors.auth.config_missing' }), {
      headers: CACHE_HEADERS,
    });
  }

  if (!oauthError && (!code || !state)) {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'coreui.errors.auth.provider.invalidCallback' }), {
      headers: CACHE_HEADERS,
    });
  }

  const callbackUrl = new URL('/auth/login/provider/callback', berlinBase);
  if (code) callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);
  if (oauthError) callbackUrl.searchParams.set('error', oauthError);
  if (oauthErrorDescription) callbackUrl.searchParams.set('error_description', oauthErrorDescription);

  const upstream = await fetch(callbackUrl.toString(), {
    method: 'GET',
    headers: { accept: 'application/json, text/plain;q=0.5, */*;q=0.1' },
    cache: 'no-store',
    redirect: 'manual',
  });

  const upstreamLocation = upstream.headers.get('location');
  if (isRedirectStatus(upstream.status) && upstreamLocation) {
    return NextResponse.redirect(upstreamLocation, { headers: CACHE_HEADERS });
  }

  const payload = (await upstream.json().catch(() => null)) as BerlinCallbackPayload | null;
  const reasonKey = extractReasonKey(payload);
  return NextResponse.redirect(resolveLoginUrl(request, { error: reasonKey }), { headers: CACHE_HEADERS });
}
