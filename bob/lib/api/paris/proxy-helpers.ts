import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../env/paris';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

export function resolveParisBaseOrResponse(corsHeaders: HeadersInit) {
  try {
    return { ok: true as const, baseUrl: resolveParisBaseUrl() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: corsHeaders }),
    };
  }
}

export async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function shouldEnforceSuperadmin(request: NextRequest, superadminKey: string | undefined): boolean {
  if (!superadminKey) return false;
  if (process.env.NODE_ENV === 'development') return false;
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return false;
  return true;
}

export function withParisDevAuthorization(headers: Headers): Headers {
  if (PARIS_DEV_JWT && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${PARIS_DEV_JWT}`);
  }
  return headers;
}

export function proxyErrorResponse(error: unknown, corsHeaders: HeadersInit) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
  return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status, headers: corsHeaders });
}

