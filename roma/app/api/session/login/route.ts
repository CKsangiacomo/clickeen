import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const DEFAULT_ACCESS_COOKIE = 'sb-access-token';
const DEFAULT_REFRESH_COOKIE = 'sb-refresh-token';
const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;

type SupabaseAuthConfig = {
  baseUrl: string;
  apiKey: string;
};

type PasswordGrantSession = {
  accessToken: string;
  refreshToken: string;
  maxAge: number;
};

function resolveSupabaseConfig(): SupabaseAuthConfig | null {
  const baseUrl = (
    process.env.SUPABASE_AUTH_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_BASE_URL ??
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (!baseUrl) return null;

  const apiKey = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ''
  ).trim();
  if (!apiKey) return null;

  return { baseUrl, apiKey };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizePassword(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseSessionPayload(payload: unknown): PasswordGrantSession | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;

  const accessToken = typeof record.access_token === 'string' ? record.access_token.trim() : '';
  const refreshToken = typeof record.refresh_token === 'string' ? record.refresh_token.trim() : '';
  if (!accessToken || !refreshToken) return null;

  const expiresIn =
    typeof record.expires_in === 'number'
      ? record.expires_in
      : typeof record.expires_in === 'string'
        ? Number.parseInt(record.expires_in, 10)
        : 3600;
  const maxAge = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;

  return {
    accessToken,
    refreshToken,
    maxAge,
  };
}

function buildErrorResponse(reasonKey: string, status: number) {
  return NextResponse.json(
    {
      error: {
        kind: 'AUTH',
        reasonKey,
      },
    },
    { status, headers: CACHE_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  const config = resolveSupabaseConfig();
  if (!config) {
    return buildErrorResponse('roma.errors.auth.config_missing', 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(body?.email);
  const password = normalizePassword(body?.password);
  if (!email || !password) {
    return buildErrorResponse('coreui.errors.auth.invalid_credentials', 422);
  }

  const upstream = await fetch(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ email, password }),
  });

  const upstreamPayload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!upstream.ok) {
    const upstreamCode = typeof upstreamPayload?.error_code === 'string' ? upstreamPayload.error_code : '';
    const upstreamMessage = typeof upstreamPayload?.msg === 'string' ? upstreamPayload.msg : '';
    const invalidCreds = upstream.status === 400 || upstreamCode === 'invalid_credentials' || upstreamMessage.includes('Invalid login credentials');
    return buildErrorResponse(invalidCreds ? 'coreui.errors.auth.invalid_credentials' : 'coreui.errors.auth.login_failed', invalidCreds ? 401 : 502);
  }

  const session = parseSessionPayload(upstreamPayload);
  if (!session) {
    return buildErrorResponse('coreui.errors.auth.login_failed', 502);
  }

  const secure = request.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  response.cookies.set({
    name: DEFAULT_ACCESS_COOKIE,
    value: session.accessToken,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: session.maxAge,
  });
  response.cookies.set({
    name: DEFAULT_REFRESH_COOKIE,
    value: session.refreshToken,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: DEFAULT_REFRESH_MAX_AGE,
  });
  return response;
}
