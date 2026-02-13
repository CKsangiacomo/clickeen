import { NextResponse } from 'next/server';
import {
  fetchWithTimeout,
  proxyErrorResponse,
  resolveParisBaseOrResponse,
  withParisDevAuthorization,
} from '../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id, x-ck-superadmin-key',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const paris = resolveParisBaseOrResponse(CORS_HEADERS);
  if (!paris.ok) return paris.response;

  const incoming = new URL(request.url);
  const query = incoming.search || '';
  const url = `${paris.baseUrl.replace(/\/$/, '')}/api/curated-instances${query}`;

  const headers = withParisDevAuthorization(new Headers());

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
    return proxyErrorResponse(error, CORS_HEADERS);
  }
}
