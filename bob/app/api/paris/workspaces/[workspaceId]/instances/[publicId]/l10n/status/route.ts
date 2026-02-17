import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  resolveParisSession,
  resolveParisBaseOrResponse,
  withParisDevAuthorization,
} from '../../../../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function forwardToParis(
  request: NextRequest,
  workspaceId: string,
  publicId: string,
  accessToken: string,
  setCookies: Array<{ name: string; value: string; maxAge: number }> | undefined,
  init: RequestInit,
  timeoutMs = 5000,
) {
  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const headers = withParisDevAuthorization(new Headers(init.headers), accessToken);
  headers.set('X-Request-ID', headers.get('X-Request-ID') ?? crypto.randomUUID());

  const url = new URL(
    `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      publicId,
    )}/l10n/status`,
  );
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const res = await fetchWithTimeout(url.toString(), {
      ...init,
      headers,
      cache: 'no-store',
    }, timeoutMs);

    const contentType = res.headers.get('Content-Type') ?? '';
    let body: BodyInit | null = null;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => undefined);
      body = JSON.stringify(data ?? null);
    } else {
      body = await res.text().catch(() => '');
    }

    const response = new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType || 'application/json',
        ...CORS_HEADERS,
      },
    });
    return applySessionCookies(response, request, setCookies);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status: 502, headers: CORS_HEADERS });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ workspaceId: string; publicId: string }> }) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const { workspaceId, publicId } = await ctx.params;
  if (!workspaceId || !publicId) {
    return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400, headers: CORS_HEADERS });
  }
  return forwardToParis(request, workspaceId, publicId, session.accessToken, session.setCookies, { method: 'GET' });
}
