import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id, x-ck-superadmin-key',
} as const;

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;
const CK_SUPERADMIN_KEY = process.env.CK_SUPERADMIN_KEY;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const workspaceId = (reqUrl.searchParams.get('workspaceId') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: CORS_HEADERS }
    );
  }

  const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances`;

  const headers: HeadersInit = {};
  if (PARIS_DEV_JWT) {
    headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;
  }

  try {
    const res = await fetch(url, {
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  if (CK_SUPERADMIN_KEY) {
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

  const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances?subject=${encodeURIComponent(subject)}`;

  const headers: HeadersInit = {};
  if (PARIS_DEV_JWT) {
    headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;
  }

  try {
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
