import { NextRequest, NextResponse } from 'next/server';
import { resolveBerlinBaseUrl } from './env/berlin';
import { withSession } from './current-account-route';
import type { SessionCookieSpec } from './auth/session';

type BerlinProxyMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function proxyBerlinTextResponse(args: {
  request: NextRequest;
  accessToken: string;
  setCookies?: SessionCookieSpec[];
  path: string;
  method: BerlinProxyMethod;
  body?: string;
  accept?: string | null;
  contentType?: string | null;
  redirect?: RequestRedirect;
}): Promise<NextResponse> {
  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(`${berlinBase}${args.path}`, {
      method: args.method,
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        accept: args.accept || 'application/json',
        ...(args.body !== undefined
          ? { 'content-type': args.contentType || 'application/json' }
          : {}),
      },
      cache: 'no-store',
      ...(args.redirect ? { redirect: args.redirect } : {}),
      ...(args.body !== undefined ? { body: args.body } : {}),
    });
    const body = await upstream.text().catch(() => '');
    return withSession(
      args.request,
      new NextResponse(body, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        },
      }),
      args.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      args.request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      args.setCookies,
    );
  }
}
