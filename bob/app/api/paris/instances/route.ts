import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../lib/env/paris';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id, x-ck-superadmin-key',
} as const;

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;
const CK_SUPERADMIN_KEY = process.env.CK_SUPERADMIN_KEY;

function shouldEnforceSuperadmin(request: NextRequest): boolean {
  if (!CK_SUPERADMIN_KEY) return false;
  if (process.env.NODE_ENV === 'development') return false;
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return false;
  return true;
}

function resolveParisBaseOrResponse() {
  try {
    return { ok: true as const, baseUrl: resolveParisBaseUrl() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: CORS_HEADERS }),
    };
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const paris = resolveParisBaseOrResponse();
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

  const headers: HeadersInit = {};
  if (PARIS_DEV_JWT) {
    headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;
  }

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
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  const paris = resolveParisBaseOrResponse();
  if (!paris.ok) return paris.response;

  if (shouldEnforceSuperadmin(request)) {
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

  const headers: HeadersInit = {};
  if (PARIS_DEV_JWT) {
    headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;
  }

  try {
    const body = await request.text();
    const res = await fetchWithTimeout(url, {
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
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status, headers: CORS_HEADERS }
    );
  }
}
