import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  resolveParisSession,
  withParisDevAuthorization,
} from '../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const reqUrl = new URL(request.url);
  const workspaceId = (reqUrl.searchParams.get('workspaceId') || '').trim();
  const subject = (reqUrl.searchParams.get('subject') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: CORS_HEADERS },
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const url = `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/website-creative?subject=${encodeURIComponent(subject)}`;

  const headers = withParisDevAuthorization(new Headers({ 'content-type': 'application/json' }), session.accessToken);

  try {
    const body = await request.text();
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body,
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
