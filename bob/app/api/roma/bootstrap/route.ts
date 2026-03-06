import { NextRequest, NextResponse } from 'next/server';
import { proxyToParisRoute } from '../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  return proxyToParisRoute(request, {
    path: '/api/roma/bootstrap',
    method: 'GET',
    corsHeaders: CORS_HEADERS,
  });
}
