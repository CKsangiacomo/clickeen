import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from '../../../../../lib/env/berlin';
import { resolveRequestOrigin } from '../../../../../lib/auth/session';

export const runtime = 'edge';

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type LoginIntent = 'signin' | 'signup_prague';

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveIntent(value: string | null): LoginIntent {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'signup_prague') return 'signup_prague';
  return 'signin';
}

function parseNextUrl(nextPath: string): URL {
  return new URL(nextPath, 'https://roma.local');
}

function deriveIntent(args: {
  explicitIntent: LoginIntent;
  explicitIntentRaw: string | null;
  nextPath: string;
}): LoginIntent {
  if (args.explicitIntentRaw) return args.explicitIntent;

  try {
    const nextUrl = parseNextUrl(args.nextPath);
    const nextIntent = resolveIntent(nextUrl.searchParams.get('intent'));
    if (nextIntent !== 'signin') return nextIntent;

    const from = (nextUrl.searchParams.get('from') || '').trim().toLowerCase();
    if (from === 'prague_create') return 'signup_prague';
  } catch {
    // Ignore parse failures and fall through to signin.
  }

  return 'signin';
}

function resolveLoginUrl(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/login', resolveRequestOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = resolveNextPath(url.searchParams.get('next'));
  const explicitIntentRaw = url.searchParams.get('intent');
  const explicitIntent = resolveIntent(explicitIntentRaw);
  const intent = deriveIntent({
    explicitIntent,
    explicitIntentRaw,
    nextPath,
  });

  let berlinBase = '';
  try {
    berlinBase = resolveBerlinBaseUrl();
  } catch {
    return NextResponse.redirect(resolveLoginUrl(request, { error: 'roma.errors.auth.config_missing' }), {
      headers: CACHE_HEADERS,
    });
  }

  const upstream = await fetch(`${berlinBase}/auth/login/provider/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      provider: 'google',
      intent,
      next: nextPath,
    }),
  });

  const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  const oauthUrl = payload && typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!upstream.ok || !oauthUrl) {
    const reasonKey =
      payload && typeof payload.error === 'object' && payload.error
        ? (payload.error as Record<string, unknown>).reasonKey
        : null;
    const normalizedReason = typeof reasonKey === 'string' ? reasonKey : 'coreui.errors.auth.login_failed';
    return NextResponse.redirect(resolveLoginUrl(request, { error: normalizedReason }), {
      headers: CACHE_HEADERS,
    });
  }

  return NextResponse.redirect(oauthUrl, { headers: CACHE_HEADERS });
}
