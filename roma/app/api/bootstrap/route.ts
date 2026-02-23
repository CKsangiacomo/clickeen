import { NextRequest, NextResponse } from 'next/server';
import { resolveParisBaseUrl } from '../../../lib/env/paris';
import { resolveSessionBearer } from '../../../lib/auth/session';

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

function copyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

export async function GET(request: NextRequest) {
  const auth = await resolveSessionBearer(request);
  if (!auth.ok) {
    auth.response.headers.set('cache-control', 'no-store');
    auth.response.headers.set('cdn-cache-control', 'no-store');
    auth.response.headers.set('cloudflare-cdn-cache-control', 'no-store');
    return auth.response;
  }

  const parisBase = resolveParisBaseUrl();
  const target = `${parisBase}/api/roma/bootstrap${request.nextUrl.search}`;
  try {
    const upstreamResponse = await fetch(target, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
      },
      cache: 'no-store',
    });

    const response = new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: copyResponseHeaders(upstreamResponse.headers),
    });
    response.headers.set('cache-control', 'no-store');
    response.headers.set('cdn-cache-control', 'no-store');
    response.headers.set('cloudflare-cdn-cache-control', 'no-store');

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
      {
        status: 502,
        headers: {
          'cache-control': 'no-store',
          'cdn-cache-control': 'no-store',
          'cloudflare-cdn-cache-control': 'no-store',
        },
      },
    );
  }
}
