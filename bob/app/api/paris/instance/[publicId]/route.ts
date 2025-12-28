import { NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

async function forwardToParis(
  publicId: string,
  init: RequestInit,
  timeoutMs = 5000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  headers.set('X-Request-ID', headers.get('X-Request-ID') ?? crypto.randomUUID());
  if (PARIS_DEV_JWT && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${PARIS_DEV_JWT}`);
  }

  try {
    const res = await fetch(
      `${PARIS_BASE_URL.replace(/\/$/, '')}/api/instance/${encodeURIComponent(publicId)}`,
      {
        ...init,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      }
    );

    const contentType = res.headers.get('Content-Type') ?? '';

    let body: BodyInit | null = null;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => undefined);
      body = JSON.stringify(data ?? null);
    } else {
      body = await res.text().catch(() => '');
    }

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'PARIS_PROXY_ERROR', message },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { publicId: string } }
) {
  return forwardToParis(params.publicId, { method: 'GET' });
}

export async function PUT(
  request: Request,
  { params }: { params: { publicId: string } }
) {
  const body = await request.text();
  return forwardToParis(params.publicId, {
    method: 'PUT',
    body,
  });
}
