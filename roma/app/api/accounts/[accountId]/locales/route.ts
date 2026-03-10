import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../bob/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../lib/auth/session';
import { proxyToParis } from '../../../../../lib/api/paris-proxy';
import { getAccountLocalesRow } from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const token = entry.trim();
    if (!token) continue;
    normalized.push(token);
  }
  return Array.from(new Set(normalized));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
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
    accountId,
    minRole: 'viewer',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const rowResult = await getAccountLocalesRow(accountId, session.accessToken);
  if (!rowResult.ok) {
    const status = rowResult.status === 401 ? 401 : 502;
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey: rowResult.reasonKey,
            detail: rowResult.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  if (!rowResult.row) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
      session.setCookies,
    );
  }

  const locales = normalizeLocaleList(rowResult.row.l10n_locales);
  const policy =
    rowResult.row.l10n_policy && typeof rowResult.row.l10n_policy === 'object' && !Array.isArray(rowResult.row.l10n_policy)
      ? rowResult.row.l10n_policy
      : null;

  return withSession(
    request,
    NextResponse.json({
      accountId,
      locales,
      policy,
    }),
    session.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
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
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  return proxyToParis(request, {
    method: 'PUT',
    path: `/api/accounts/${encodeURIComponent(accountId)}/locales`,
  });
}
