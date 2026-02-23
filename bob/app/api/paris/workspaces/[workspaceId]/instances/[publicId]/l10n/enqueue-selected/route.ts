import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  resolveParisSession,
  withParisDevAuthorization,
} from '../../../../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ workspaceId: string; publicId: string }> }) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const { workspaceId, publicId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: 'INVALID_WORKSPACE_ID' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!publicId) {
    return NextResponse.json({ error: 'INVALID_PUBLIC_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(
    `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      publicId,
    )}/l10n/enqueue-selected`,
  );
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (subject) url.searchParams.set('subject', subject);

  const headers = withParisDevAuthorization(new Headers(), session.accessToken);
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  headers.set('x-request-id', request.headers.get('x-request-id') || crypto.randomUUID());

  const body = await request.text();

  try {
    const res = await fetchWithTimeout(url.toString(), { method: 'POST', headers, body, cache: 'no-store' });
    const text = await res.text().catch(() => '');
    const response = new NextResponse(text, {
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
