import { NextRequest, NextResponse } from 'next/server';
import { proxyToParisRoute } from '../../../../lib/api/paris/proxy-helpers';

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
  return proxyToParisRoute(request, {
    path: `/api/instance/${encodeURIComponent(publicId)}`,
    method: 'GET',
    auth: 'none',
    corsHeaders: CORS_HEADERS,
  });
}
