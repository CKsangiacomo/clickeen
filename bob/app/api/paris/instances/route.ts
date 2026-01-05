import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const workspaceId = (reqUrl.searchParams.get('workspaceId') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const url = `${PARIS_BASE_URL.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instances`;

  const headers: HeadersInit = {};
  if (PARIS_DEV_JWT) {
    headers['Authorization'] = `Bearer ${PARIS_DEV_JWT}`;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
