import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../../../../lib/env/paris';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

function resolveParisBaseOrResponse() {
  try {
    return { ok: true as const, baseUrl: resolveParisBaseUrl() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, response: NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: CORS_HEADERS }) };
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function forwardToParis(
  request: NextRequest,
  publicId: string,
  locale: string,
  init: RequestInit,
  timeoutMs = 5000
) {
  const paris = resolveParisBaseOrResponse();
  if (!paris.ok) return paris.response;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  headers.set('X-Request-ID', headers.get('X-Request-ID') ?? crypto.randomUUID());
  if (PARIS_DEV_JWT && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${PARIS_DEV_JWT}`);
  }

  const url = new URL(
    `${paris.baseUrl.replace(/\/$/, '')}/api/instances/${encodeURIComponent(publicId)}/locales/${encodeURIComponent(locale)}`
  );
  const requestUrl = new URL(request.url);
  const workspaceId = (requestUrl.searchParams.get('workspaceId') || '').trim();
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);

  try {
    const res = await fetch(url.toString(), {
      ...init,
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });

    const contentType = res.headers.get('Content-Type') ?? '';
    let body: BodyInit | null = null;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => undefined);
      body = JSON.stringify(data ?? null);
    } else {
      body = await res.text().catch(() => '');
    }

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType || 'application/json',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status: 502, headers: CORS_HEADERS });
  } finally {
    clearTimeout(timeout);
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ publicId: string; locale: string }> }) {
  const { publicId, locale } = await ctx.params;
  if (!publicId || !locale) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400, headers: CORS_HEADERS });
  }
  const body = await request.text();
  return forwardToParis(request, publicId, locale, { method: 'PUT', body });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ publicId: string; locale: string }> }) {
  const { publicId, locale } = await ctx.params;
  if (!publicId || !locale) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400, headers: CORS_HEADERS });
  }
  return forwardToParis(request, publicId, locale, { method: 'GET' });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ publicId: string; locale: string }> }) {
  const { publicId, locale } = await ctx.params;
  if (!publicId || !locale) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400, headers: CORS_HEADERS });
  }
  return forwardToParis(request, publicId, locale, { method: 'DELETE' });
}
