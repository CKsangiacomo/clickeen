import { NextRequest, NextResponse } from 'next/server';
import { resolveTokyoBaseUrl } from '../../../lib/env/tokyo';

export const runtime = 'edge';

function buildTokyoUrl(request: NextRequest, prefix: string, pathSegments: string[]): string {
  if (pathSegments.some((seg) => seg === '..' || seg === '.')) {
    throw new Error('Invalid path');
  }

  const base = resolveTokyoBaseUrl().replace(/\/+$/, '');
  const joined = pathSegments.map((seg) => encodeURIComponent(seg)).join('/');
  const url = `${base}/${prefix}/${joined}`;
  const qs = request.nextUrl.search;
  return qs ? `${url}${qs}` : url;
}

async function proxyGet(request: NextRequest, prefix: string, pathSegments: string[]) {
  let url: string;
  try {
    url = buildTokyoUrl(request, prefix, pathSegments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'MISCONFIGURED', message }, { status: 500 });
  }

  const res = await fetch(url, { cache: 'no-store' });

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');

  return new NextResponse(res.body, { status: res.status, headers });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  return proxyGet(request, 'widgets', segments);
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const params = await ctx.params;
  const segments = Array.isArray(params.path) ? params.path : [];
  let url: string;
  try {
    url = buildTokyoUrl(request, 'widgets', segments);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(null, { status: 500, headers: { 'x-ck-error': message } });
  }

  const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');

  return new NextResponse(null, { status: res.status, headers });
}
