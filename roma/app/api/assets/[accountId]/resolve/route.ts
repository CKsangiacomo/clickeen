import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../../lib/env/tokyo';
import { buildTokyoProductHeaders } from '../../../../../lib/tokyo-product-auth';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

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

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withSession(request, session.response);

  const { accountId } = await context.params;
  const normalizedAccountId = String(accountId || '').trim();
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

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId: normalizedAccountId,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSession(request, NextResponse.json({ error: authz.error }, { status: authz.status }), session.setCookies);
  }

  const bodyText = await request.text().catch(() => '');

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

  try {
    const upstream = await fetch(
      `${tokyoBase}/assets/account/${encodeURIComponent(normalizedAccountId)}/resolve`,
      {
        method: 'POST',
        headers: buildTokyoProductHeaders({
          accountId: normalizedAccountId,
          accountCapsule: authz.token,
          contentType: 'application/json',
        }),
        cache: 'no-store',
        body: bodyText,
      },
    );
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
