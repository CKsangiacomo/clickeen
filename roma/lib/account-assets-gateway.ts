import type { MemberRole } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from './account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from './auth/session';
import {
  assertTokyoAssetControlBindingAvailable,
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';

export const ACCOUNT_ASSET_UPLOAD_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-public-id, x-widget-type, x-filename, x-source, x-request-id',
} as const;

type AccountAssetGatewayContext = {
  accountId: string;
  accountCapsule: string;
  sessionSetCookies?: SessionCookieSpec[];
};

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isWidgetPublicId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

export function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

export function finalizeAccountAssetResponse(args: {
  request: NextRequest;
  response: NextResponse;
  setCookies?: SessionCookieSpec[];
  extraHeaders?: Record<string, string>;
}): NextResponse {
  const next = withNoStore(applySessionCookies(args.response, args.request, args.setCookies));
  Object.entries(args.extraHeaders ?? {}).forEach(([key, value]) => next.headers.set(key, value));
  return next;
}

export function accountAssetUploadOptionsResponse() {
  return new NextResponse(null, { status: 204, headers: ACCOUNT_ASSET_UPLOAD_CORS_HEADERS });
}

export function parseJsonOrNull(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function buildErrorResponse(
  request: NextRequest,
  setCookies: SessionCookieSpec[] | undefined,
  status: number,
  error: { kind: string; reasonKey: string; detail?: string },
  extraHeaders?: Record<string, string>,
) {
  return finalizeAccountAssetResponse({
    request,
    response: NextResponse.json({ error }, { status }),
    setCookies,
    extraHeaders,
  });
}

export async function resolveAccountAssetGatewayContext(args: {
  request: NextRequest;
  accountId: string;
  minRole: MemberRole;
  extraHeaders?: Record<string, string>;
}): Promise<{ ok: true; value: AccountAssetGatewayContext } | { ok: false; response: NextResponse }> {
  const session = await resolveSessionBearer(args.request);
  if (!session.ok) {
    return {
      ok: false,
      response: finalizeAccountAssetResponse({
        request: args.request,
        response: session.response,
        extraHeaders: args.extraHeaders,
      }),
    };
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request: args.request,
    accountId: args.accountId,
    minRole: args.minRole,
  });
  if (!authz.ok) {
    return {
      ok: false,
      response: buildErrorResponse(
        args.request,
        session.setCookies,
        authz.status,
        authz.error,
        args.extraHeaders,
      ),
    };
  }

  try {
    assertTokyoAssetControlBindingAvailable();
    return {
      ok: true,
      value: {
        accountId: args.accountId,
        accountCapsule: authz.token,
        sessionSetCookies: session.setCookies,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: buildErrorResponse(
        args.request,
        session.setCookies,
        500,
        { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail },
        args.extraHeaders,
      ),
    };
  }
}

export async function proxyAccountAssetJson(args: {
  request: NextRequest;
  context: AccountAssetGatewayContext;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: BodyInit;
  contentType?: string;
  extraHeaders?: HeadersInit;
  passthroughSearchParams?: URLSearchParams;
  responseHeaders?: Record<string, string>;
}): Promise<NextResponse> {
  let headers: Headers;
  try {
    headers = buildTokyoAssetControlHeaders({
      accountId: args.context.accountId,
      accountCapsule: args.context.accountCapsule,
      ...(args.contentType ? { contentType: args.contentType } : {}),
    });
    new Headers(args.extraHeaders).forEach((value, key) => headers.set(key, value));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildErrorResponse(
      args.request,
      args.context.sessionSetCookies,
      500,
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail },
      args.responseHeaders,
    );
  }

  try {
    const target = new URL(
      args.path.startsWith('/') ? args.path : `/${args.path}`,
      'https://tokyo-asset-control.internal',
    );
    args.passthroughSearchParams?.forEach((value, key) => target.searchParams.set(key, value));
    const upstream = await fetchTokyoAssetControl({
      path: `${target.pathname}${target.search}`,
      method: args.method,
      headers,
      ...(args.body !== undefined ? { body: args.body } : {}),
    });
    const text = await upstream.text().catch(() => '');
    const payload = parseJsonOrNull(text);
    const body =
      payload && typeof payload === 'object'
        ? payload
        : {
            error: {
              kind: 'INTERNAL',
              reasonKey: `HTTP_${upstream.status}`,
              ...(text ? { detail: text } : {}),
            },
          };
    return finalizeAccountAssetResponse({
      request: args.request,
      response: NextResponse.json(body, { status: upstream.status }),
      setCookies: args.context.sessionSetCookies,
      extraHeaders: args.responseHeaders,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildErrorResponse(
      args.request,
      args.context.sessionSetCookies,
      502,
      { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'roma.errors.proxy.tokyo_unavailable', detail },
      args.responseHeaders,
    );
  }
}
