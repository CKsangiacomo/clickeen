import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

async function forwardToParis(
  workspaceId: string,
  publicId: string,
  subject: string,
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
      `${PARIS_BASE_URL.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`,
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
  request: NextRequest,
  ctx: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await ctx.params;
  if (typeof publicId !== 'string' || !publicId) {
    return NextResponse.json(
      { error: 'INVALID_PUBLIC_ID' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const url = new URL(request.url);
  const workspaceId = (url.searchParams.get('workspaceId') || '').trim();
  const subject = (url.searchParams.get('subject') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
      { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  return forwardToParis(workspaceId, publicId, subject, { method: 'GET' });
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await ctx.params;
  if (typeof publicId !== 'string' || !publicId) {
    return NextResponse.json(
      { error: 'INVALID_PUBLIC_ID' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const url = new URL(request.url);
  const workspaceId = (url.searchParams.get('workspaceId') || '').trim();
  const subject = (url.searchParams.get('subject') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' } },
      { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const body = await request.text();
  return forwardToParis(workspaceId, publicId, subject, {
    method: 'PUT',
    body,
  });
}
