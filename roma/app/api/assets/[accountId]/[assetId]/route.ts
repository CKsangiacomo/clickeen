import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../../lib/env/tokyo';
import { buildTokyoProductHeaders } from '../../../../../lib/tokyo-product-auth';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; assetId: string }> };

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  next.headers.set('cache-control', 'no-store');
  next.headers.set('cdn-cache-control', 'no-store');
  next.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return next;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withSession(request, session.response);

  const { accountId, assetId } = await context.params;
  const normalizedAccountId = String(accountId || '').trim();
  const normalizedAssetId = String(assetId || '').trim();
  if (!isUuid(normalizedAccountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  if (!isUuid(normalizedAssetId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assetId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId: normalizedAccountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(request, NextResponse.json({ error: authz.error }, { status: authz.status }), session.setCookies);
  }

  let tokyoBase = '';
  try {
    tokyoBase = resolveTokyoBaseUrl().replace(/\/+$/, '');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail } },
        { status: 500 },
      ),
      session.setCookies,
    );
  }

  const target = new URL(
    `${tokyoBase}/assets/${encodeURIComponent(normalizedAccountId)}/${encodeURIComponent(normalizedAssetId)}`,
  );
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  try {
    const upstream = await fetch(target.toString(), {
      method: 'DELETE',
      headers: buildTokyoProductHeaders({
        accountId: normalizedAccountId,
        accountCapsule: authz.token,
      }),
      cache: 'no-store',
    });
    const text = await upstream.text().catch(() => '');
    const payload = parseJson(text);
    const body =
      payload && typeof payload === 'object'
        ? payload
        : { error: { kind: 'INTERNAL', reasonKey: `HTTP_${upstream.status}` } };
    return withSession(request, NextResponse.json(body, { status: upstream.status }), session.setCookies);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'roma.errors.proxy.tokyo_unavailable', detail } },
        { status: 502 },
      ),
      session.setCookies,
    );
  }
}
