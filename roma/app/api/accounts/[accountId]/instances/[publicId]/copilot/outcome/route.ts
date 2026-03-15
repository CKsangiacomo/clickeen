import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../../lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../../../../lib/auth/session';
import {
  forwardCopilotOutcome,
  isValidCopilotOutcomePayload,
} from '../../../../../../../../lib/ai/account-copilot';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

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

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json({ ok: false, message: 'Invalid accountId' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      session.setCookies,
    );
  }
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json({ ok: false, message: 'Invalid publicId' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
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
      NextResponse.json({ ok: false, message: authz.error.reasonKey }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      session.setCookies,
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isValidCopilotOutcomePayload(body)) {
      return withSession(
        request,
        NextResponse.json({ ok: false, message: 'Invalid outcome payload' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
        session.setCookies,
      );
    }

    const forwarded = await forwardCopilotOutcome(body);
    if (!forwarded.ok) {
      return withSession(
        request,
        NextResponse.json({ ok: false, message: forwarded.message }, { status: 200, headers: { 'cache-control': 'no-store' } }),
        session.setCookies,
      );
    }

    return withSession(
      request,
      NextResponse.json({ ok: true, data: forwarded.upstream }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      session.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json({ ok: false, message: detail || 'Outcome attach failed' }, { status: 200, headers: { 'cache-control': 'no-store' } }),
      session.setCookies,
    );
  }
}
