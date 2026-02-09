import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../../../../../../lib/env/paris';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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

export async function POST(request: NextRequest, ctx: { params: Promise<{ workspaceId: string; publicId: string }> }) {
  if (shouldEnforceSuperadmin(request)) {
    const provided = (request.headers.get('x-ck-superadmin-key') || '').trim();
    if (!provided || provided !== CK_SUPERADMIN_KEY) {
      return NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.superadmin.invalid' } },
        { status: 403, headers: CORS_HEADERS },
      );
    }
  }

  const { workspaceId, publicId } = await ctx.params;
  if (!workspaceId) {
    return NextResponse.json({ error: 'INVALID_WORKSPACE_ID' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!publicId) {
    return NextResponse.json({ error: 'INVALID_PUBLIC_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const paris = resolveParisBaseOrResponse();
  if (!paris.ok) return paris.response;

  const url = new URL(
    `${paris.baseUrl.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      publicId,
    )}/l10n/enqueue-selected`,
  );
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (subject) url.searchParams.set('subject', subject);

  const headers = new Headers();
  headers.set('content-type', request.headers.get('content-type') || 'application/json');
  headers.set('x-request-id', request.headers.get('x-request-id') || crypto.randomUUID());
  if (PARIS_DEV_JWT && !headers.has('authorization')) headers.set('authorization', `Bearer ${PARIS_DEV_JWT}`);

  const body = await request.text();

  try {
    const res = await fetchWithTimeout(url.toString(), { method: 'POST', headers, body, cache: 'no-store' });
    const text = await res.text().catch(() => '');
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    return NextResponse.json({ error: 'PARIS_PROXY_ERROR', message }, { status, headers: CORS_HEADERS });
  }
}

