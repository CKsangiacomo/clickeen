import { NextRequest, NextResponse } from 'next/server';
import {
  applySessionCookies,
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  resolveParisSession,
  shouldEnforceSuperadmin,
  withParisDevAuthorization,
} from '../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id, x-ck-superadmin-key',
} as const;

const CK_SUPERADMIN_KEY = process.env.CK_SUPERADMIN_KEY;

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

  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  const url = new URL(`${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances`);
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

export async function POST(request: NextRequest, ctx: { params: Promise<{ workspaceId: string }> }) {
  const session = await resolveParisSession(request);
  if (!session.ok) return session.response;

  if (shouldEnforceSuperadmin(request, CK_SUPERADMIN_KEY)) {
    const provided = (request.headers.get('x-ck-superadmin-key') || '').trim();
    if (!provided || provided !== CK_SUPERADMIN_KEY) {
      return NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.superadmin.invalid' } },
        { status: 403, headers: CORS_HEADERS },
      );
    }
  }

  const { workspaceId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: 'INVALID_WORKSPACE_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (!subject) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(`${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances`);
  url.searchParams.set('subject', subject);

  const headers = withParisDevAuthorization(new Headers(), session.accessToken);
  headers.set('content-type', request.headers.get('content-type') || 'application/json');

  try {
    const body = await request.text();
    const res = await fetchWithTimeout(url.toString(), {
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
