import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  shouldEnforceSuperadmin,
  withParisDevAuthorization,
} from '../../../../lib/api/paris/proxy-helpers';

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

export async function GET(request: NextRequest) {
  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const reqUrl = new URL(request.url);
  const workspaceId = (reqUrl.searchParams.get('workspaceId') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const url = `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances`;

  const headers = withParisDevAuthorization(new Headers());

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    return proxyErrorResponse(error, CORS_HEADERS);
  }
}

export async function POST(request: NextRequest) {
  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  if (shouldEnforceSuperadmin(request, CK_SUPERADMIN_KEY)) {
    const provided = (request.headers.get('x-ck-superadmin-key') || '').trim();
    if (!provided || provided !== CK_SUPERADMIN_KEY) {
      return NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.superadmin.invalid' } },
        { status: 403, headers: CORS_HEADERS }
      );
    }
  }

  const reqUrl = new URL(request.url);
  const workspaceId = (reqUrl.searchParams.get('workspaceId') || '').trim();
  const subject = (reqUrl.searchParams.get('subject') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const url = `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances?subject=${encodeURIComponent(subject)}`;

  const headers = withParisDevAuthorization(new Headers());

  try {
    const body = await request.text();
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...Object.fromEntries(headers.entries()),
        'content-type': 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    return proxyErrorResponse(error, CORS_HEADERS);
  }
}
