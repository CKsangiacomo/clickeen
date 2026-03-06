import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { type SessionCookieSpec } from '../../../../../lib/auth/session';
import { applySessionCookies, resolveParisSession } from '../../../../../lib/api/paris/proxy-helpers';
import { getAccountLocalesRow } from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

function withCorsAndSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  const next = applySessionCookies(response, request, setCookies);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => next.headers.set(key, value));
  return next;
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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveParisSession(request);
  if (!session.ok) {
    return withCorsAndSession(request, session.response);
  }

  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  if (!isUuid(accountId)) {
    return withCorsAndSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const rowResult = await getAccountLocalesRow(accountId, session.accessToken);
  if (!rowResult.ok) {
    const status = rowResult.status === 401 ? 401 : 502;
    return withCorsAndSession(
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
    return withCorsAndSession(
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

  return withCorsAndSession(
    request,
    NextResponse.json({
      accountId,
      locales,
      policy,
    }),
    session.setCookies,
  );
}
