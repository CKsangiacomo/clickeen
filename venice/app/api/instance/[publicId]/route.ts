import { NextResponse } from 'next/server';
import { tokyoFetch } from '@venice/lib/tokyo';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: BASE_HEADERS });
}

function ckError(kind: string, reasonKey: string, status: number, detail?: string) {
  return json(
    {
      error: {
        kind,
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    status,
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: BASE_HEADERS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  if (!publicId) {
    return ckError('VALIDATION', 'coreui.errors.instance.notFound', 404);
  }

  try {
    const upstream = await tokyoFetch(
      `/renders/instances/${encodeURIComponent(publicId)}/live/public-instance.json`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    );
    const body = await upstream.text().catch(() => '');
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        ...BASE_HEADERS,
        'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return ckError(
      'INTERNAL',
      'coreui.errors.internal.serverError',
      502,
      error instanceof Error ? error.message : String(error),
    );
  }
}
