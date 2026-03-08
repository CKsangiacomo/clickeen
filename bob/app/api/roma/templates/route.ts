import { NextRequest, NextResponse } from 'next/server';
import { proxyToParisRoute } from '../../../../lib/api/paris/proxy-helpers';
import { resolveCorsHeaders } from '../../../../lib/api/cors';

export const runtime = 'edge';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(request, 'GET,OPTIONS') });
}

export async function GET(request: NextRequest) {
  return proxyToParisRoute(request, {
    path: '/api/roma/templates',
    method: 'GET',
    corsHeaders: resolveCorsHeaders(request, 'GET,OPTIONS'),
  });
}
