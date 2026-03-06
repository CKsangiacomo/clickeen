import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../lib/auth/session';
import { listAccountMembersForAccount, readJwtSubject } from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

type MemberPayload = {
  userId: string;
  role: string;
  createdAt: string | null;
  updatedAt: null;
};

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeMemberRows(rows: Array<{ user_id?: unknown; role?: unknown; created_at?: unknown }>): MemberPayload[] {
  return rows
    .map((row) => {
      const userId = asTrimmedString(row.user_id);
      const role = asTrimmedString(row.role);
      if (!userId || !role) return null;
      return {
        userId,
        role,
        createdAt: asTrimmedString(row.created_at),
        updatedAt: null,
      } satisfies MemberPayload;
    })
    .filter((row): row is MemberPayload => row !== null);
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

  const members = await listAccountMembersForAccount(accountId, session.accessToken);
  if (!members.ok) {
    const status = members.status === 401 ? 401 : 502;
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey: members.reasonKey,
            detail: members.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  const normalizedMembers = normalizeMemberRows(members.rows);
  const currentUserId = readJwtSubject(session.accessToken);
  const currentMembership = currentUserId
    ? normalizedMembers.find((member) => member.userId === currentUserId)
    : null;

  if (!currentMembership) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      role: currentMembership.role,
      members: normalizedMembers,
    }),
    session.setCookies,
  );
}
