import { NextRequest, NextResponse } from 'next/server';
import { resolveVeniceBaseUrl } from '../../../../lib/env/venice';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ publicId: string }> };

const READ_TIMEOUT_MS = 5_000;

function misconfiguredResponse(message: string) {
  return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500, headers: CORS_HEADERS });
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = READ_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function resolveSubject(
  request: NextRequest,
): { ok: true } | { ok: false; response: NextResponse } {
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim().toLowerCase();
  if (subject !== 'minibob') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
        { status: 422, headers: CORS_HEADERS },
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { publicId } = await ctx.params;
  if (!publicId) {
    return NextResponse.json({ error: 'INVALID_PUBLIC_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const subjectResult = resolveSubject(request);
  if (!subjectResult.ok) return subjectResult.response;

  let veniceBase: string;
  try {
    veniceBase = resolveVeniceBaseUrl().replace(/\/+$/, '');
  } catch (error) {
    return misconfiguredResponse(error instanceof Error ? error.message : String(error));
  }

  try {
    const upstream = await fetchWithTimeout(`${veniceBase}/api/instance/${encodeURIComponent(publicId)}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
    });
    const body = await upstream.text().catch(() => '');
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'cache-control': 'no-store',
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    return NextResponse.json({ error: 'VENICE_PROXY_ERROR', message }, { status, headers: CORS_HEADERS });
  }
}
