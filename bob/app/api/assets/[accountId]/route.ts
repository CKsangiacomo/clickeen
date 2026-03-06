import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { resolveParisSession, withSessionAndCors } from '../../../../lib/api/paris/proxy-helpers';
import { resolveTokyoBaseUrl } from '../../../../lib/env/tokyo';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ accountId: string }> };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveParisSession(request);
  if (!session.ok) return withSessionAndCors(request, session.response, undefined, CORS_HEADERS);

  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  if (!isUuid(accountId)) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422, headers: CORS_HEADERS },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  }

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/+$/, '');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail } },
        { status: 500, headers: CORS_HEADERS },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  }

  const target = new URL(`${tokyoBase}/assets/account/${encodeURIComponent(accountId)}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    const text = await upstream.text().catch(() => '');
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = null;
      }
    }

    return withSessionAndCors(
      request,
      NextResponse.json(
        payload && typeof payload === 'object'
          ? payload
          : { error: { kind: 'INTERNAL', reasonKey: `HTTP_${upstream.status}` } },
        { status: upstream.status, headers: CORS_HEADERS },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'bob.errors.proxy.tokyo_unavailable', detail } },
        { status: 502, headers: CORS_HEADERS },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  }
}
