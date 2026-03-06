import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { proxyToParisRoute, resolveParisSession, withSessionAndCors } from '../../../../../lib/api/paris/proxy-helpers';
import { getAccountLocalesRow } from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

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
    return withSessionAndCors(request, session.response, undefined, CORS_HEADERS);
  }

  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  if (!isUuid(accountId)) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  }

  const rowResult = await getAccountLocalesRow(accountId, session.accessToken);
  if (!rowResult.ok) {
    const status = rowResult.status === 401 ? 401 : 502;
    return withSessionAndCors(
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
      CORS_HEADERS,
    );
  }

  if (!rowResult.row) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
      session.setCookies,
      CORS_HEADERS,
    );
  }

  const locales = normalizeLocaleList(rowResult.row.l10n_locales);
  const policy =
    rowResult.row.l10n_policy && typeof rowResult.row.l10n_policy === 'object' && !Array.isArray(rowResult.row.l10n_policy)
      ? rowResult.row.l10n_policy
      : null;

  return withSessionAndCors(
    request,
    NextResponse.json({
      accountId,
      locales,
      policy,
    }),
    session.setCookies,
    CORS_HEADERS,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const accountId = String(params.accountId || '').trim();
  if (!isUuid(accountId)) {
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      undefined,
      CORS_HEADERS,
    );
  }

  return proxyToParisRoute(request, {
    path: `/api/accounts/${encodeURIComponent(accountId)}/locales`,
    method: 'PUT',
    corsHeaders: CORS_HEADERS,
  });
}
