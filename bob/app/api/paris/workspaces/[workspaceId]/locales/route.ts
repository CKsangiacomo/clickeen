import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  resolveParisSession,
  withParisDevAuthorization,
} from '../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ workspaceId: string }> }) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const { workspaceId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: 'INVALID_WORKSPACE_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(
    `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/locales`
  );
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (subject) url.searchParams.set('subject', subject);
  const headers = withParisDevAuthorization(new Headers(), session.accessToken);

  try {
    const res = await fetchWithTimeout(url.toString(), { method: 'GET', headers, cache: 'no-store' });
    const data = await res.text();
    const response = new NextResponse(data, {
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

export async function PUT(request: NextRequest, ctx: { params: Promise<{ workspaceId: string }> }) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const { workspaceId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: 'INVALID_WORKSPACE_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(`${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/locales`);
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (subject) url.searchParams.set('subject', subject);

  const headers = withParisDevAuthorization(
    new Headers({ 'Content-Type': request.headers.get('Content-Type') || 'application/json' }),
    session.accessToken,
  );

  const bodyText = await request.text().catch(() => '');

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: 'PUT',
      headers,
      body: bodyText || undefined,
      cache: 'no-store',
    });
    const data = await res.text();
    const response = new NextResponse(data, {
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
