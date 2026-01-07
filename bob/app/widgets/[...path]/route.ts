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
  const url = buildTokyoUrl(request, prefix, pathSegments);
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
  const url = buildTokyoUrl(request, 'widgets', segments);
  const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');

  return new NextResponse(null, { status: res.status, headers });
}

