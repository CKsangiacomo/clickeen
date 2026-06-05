import type { MemberRole } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentAccountRouteContext, withNoStore, withSession, type CurrentAccountRouteContext } from './current-account-route';
import {
  assertTokyoAssetControlBindingAvailable,
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';

type AccountAssetGatewayContext = {
  accountId: string;
  accountCapsule: string;
  authzPayload: CurrentAccountRouteContext['authzPayload'];
  requestId: string;
  sessionSetCookies?: CurrentAccountRouteContext['setCookies'];
};

export function finalizeAccountAssetResponse(args: {
  request: NextRequest;
  response: NextResponse;
  setCookies?: CurrentAccountRouteContext['setCookies'];
}): NextResponse {
  return withSession(args.request, args.response, args.setCookies);
}

export function accountAssetUploadOptionsResponse() {
  return withNoStore(new NextResponse(null, { status: 204, headers: { allow: 'POST, OPTIONS' } }));
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
  setCookies: CurrentAccountRouteContext['setCookies'],
  status: number,
  error: { kind: string; reasonKey: string; detail?: string },
) {
  return finalizeAccountAssetResponse({
    request,
    response: NextResponse.json({ error }, { status }),
    setCookies,
  });
}

export async function resolveCurrentAccountAssetGatewayContext(args: {
  request: NextRequest;
  minRole: MemberRole;
}): Promise<{ ok: true; value: AccountAssetGatewayContext } | { ok: false; response: NextResponse }> {
  const current = await resolveCurrentAccountRouteContext({
    request: args.request,
    minRole: args.minRole,
  });
  if (!current.ok) return current;

  try {
    assertTokyoAssetControlBindingAvailable();
    return {
      ok: true,
      value: {
        accountId: current.value.authzPayload.accountPublicId,
        accountCapsule: current.value.authzToken,
        authzPayload: current.value.authzPayload,
        requestId: current.value.requestId,
        sessionSetCookies: current.value.setCookies,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: buildErrorResponse(
        args.request,
        current.value.setCookies,
        500,
        { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail },
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
  passthroughSearchParams?: URLSearchParams;
}): Promise<NextResponse> {
  let headers: Headers;
  try {
    headers = buildTokyoAssetControlHeaders({
      accountId: args.context.accountId,
      accountCapsule: args.context.accountCapsule,
      requestId: args.context.requestId,
      ...(args.contentType ? { contentType: args.contentType } : {}),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildErrorResponse(
      args.request,
      args.context.sessionSetCookies,
      500,
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail },
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
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return buildErrorResponse(
      args.request,
      args.context.sessionSetCookies,
      502,
      { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'roma.errors.proxy.tokyo_unavailable', detail },
    );
  }
}
