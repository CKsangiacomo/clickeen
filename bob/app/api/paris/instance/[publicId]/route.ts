import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout, proxyErrorResponse, resolveParisBaseOrResponse } from '../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ publicId: string }> };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function resolveSubject(request: NextRequest): { ok: true; subject: string } | { ok: false; response: NextResponse } {
  const requestUrl = new URL(request.url);
  const subject = (requestUrl.searchParams.get('subject') || '').trim();
  if (!subject) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
        { status: 422, headers: CORS_HEADERS },
      ),
    };
  }
  return { ok: true, subject };
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { publicId } = await ctx.params;
  if (!publicId) {
    return NextResponse.json({ error: 'INVALID_PUBLIC_ID' }, { status: 400, headers: CORS_HEADERS });
  }

  const subjectResult = resolveSubject(request);
  if (!subjectResult.ok) return subjectResult.response;

  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const url = new URL(`${paris.baseUrl.replace(/\/$/, '')}/api/instance/${encodeURIComponent(publicId)}`);
  url.searchParams.set('subject', subjectResult.subject);

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        cache: 'no-store',
      },
      5000,
    );

    const text = await res.text();
    return new NextResponse(text, {
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
