import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../../../lib/env/paris';
import { resolveSessionBearer } from '../../../../../lib/auth/session';

export const runtime = 'edge';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

function copyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function forwardToParis(
  request: NextRequest,
  context: RouteContext,
  init: { method: 'GET' | 'PUT'; body?: ArrayBuffer },
) {
  const auth = await resolveSessionBearer(request);
  if (!auth.ok) return auth.response;

  const { publicId } = await context.params;
  const normalizedPublicId = String(publicId || '').trim();
  if (!normalizedPublicId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
      { status: 422 },
    );
  }

  const url = new URL(request.url);
  const workspaceId = String(url.searchParams.get('workspaceId') || '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' } },
      { status: 422 },
    );
  }

  const parisBase = resolveParisBaseUrl();
  const target = new URL(
    `${parisBase}/api/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(
      normalizedPublicId,
    )}`,
  );
  // Roma always runs Bob in workspace subject context.
  target.searchParams.set('subject', 'workspace');

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('authorization', `Bearer ${auth.accessToken}`);

  try {
    const upstream = await fetch(target.toString(), {
      method: init.method,
      headers,
      body: init.body,
      cache: 'no-store',
      redirect: 'manual',
    });

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyResponseHeaders(upstream.headers),
    });

    if (auth.setCookies?.length) {
      const secure = request.nextUrl.protocol === 'https:';
      for (const cookie of auth.setCookies) {
        response.cookies.set({
          name: cookie.name,
          value: cookie.value,
          httpOnly: true,
          secure,
          sameSite: 'lax',
          path: '/',
          maxAge: cookie.maxAge,
        });
      }
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'roma.errors.proxy.paris_unavailable',
          message,
        },
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forwardToParis(request, context, { method: 'GET' });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forwardToParis(request, context, {
    method: 'PUT',
    body: await request.arrayBuffer(),
  });
}
