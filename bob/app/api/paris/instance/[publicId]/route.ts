import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PARIS_BASE_URL =
  process.env.PARIS_BASE_URL ||
  process.env.NEXT_PUBLIC_PARIS_URL ||
  'http://localhost:3001';

const PARIS_DEV_JWT = process.env.PARIS_DEV_JWT;

function containsNonPersistableUrl(value: string): boolean {
  return /(?:^|[\s("'=,])(?:data|blob):/i.test(value);
}

function configNonPersistableUrlIssues(config: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];

  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (containsNonPersistableUrl(node)) {
        issues.push({
          path,
          message: 'non-persistable URL scheme found (data:/blob:). Persist stable URLs/keys only.',
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    }
  };

  visit(config, 'config');
  return issues;
}

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
  _request: NextRequest,
  ctx: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await ctx.params;
  if (typeof publicId !== 'string' || !publicId) {
    return NextResponse.json(
      { error: 'INVALID_PUBLIC_ID' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  return forwardToParis(publicId, { method: 'GET' });
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

  const body = await request.text();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const config = (parsed as any).config;
      const issues = config !== undefined ? configNonPersistableUrlIssues(config) : [];
      if (issues.length) {
        return NextResponse.json(issues, {
          status: 422,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  } catch {
    // Forward invalid JSON payloads to Paris for the canonical validation response.
  }

  return forwardToParis(publicId, {
    method: 'PUT',
    body,
  });
}
