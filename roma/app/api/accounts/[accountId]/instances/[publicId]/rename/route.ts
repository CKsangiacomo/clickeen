import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../../bob/lib/account-authz-capsule';
import { updateSavedPointerMetadataInTokyo } from '../../../../../../../../bob/lib/account-instance-direct';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '../../../../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../../../../lib/env/tokyo';
import {
  getAccountInstanceCoreRow,
  renameAccountInstanceRow,
} from '../../../../../../../lib/michael';

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

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
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
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
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

  let body: { displayName?: unknown } | null = null;
  try {
    body = (await request.json()) as { displayName?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const displayName = normalizeDisplayName(body?.displayName);
  if (!displayName) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: 'displayName must be a non-empty string with at most 120 characters',
          },
        },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const current = await getAccountInstanceCoreRow(accountId, publicId, session.accessToken);
  if (!current.ok) {
    const status = current.status === 401 ? 401 : current.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: current.reasonKey,
            detail: current.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  const previousDisplayName = current.row?.displayName || 'Untitled widget';
  const result = await renameAccountInstanceRow({
    accountId,
    publicId,
    displayName,
    berlinAccessToken: session.accessToken,
  });
  if (!result.ok) {
    const status = result.status === 401 ? 401 : result.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: result.reasonKey,
            detail: result.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  if (!result.row) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      session.setCookies,
    );
  }

  try {
    await updateSavedPointerMetadataInTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: session.accessToken,
      accountId,
      publicId,
      displayName: result.row.displayName || 'Untitled widget',
    });
  } catch (error) {
    try {
      await renameAccountInstanceRow({
        accountId,
        publicId,
        displayName: previousDisplayName,
        berlinAccessToken: session.accessToken,
      });
    } catch (rollbackError) {
      console.error('[roma rename route] failed to rollback Michael rename after Tokyo failure', {
        publicId,
        detail: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }

    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502 },
      ),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      publicId: result.row.publicId,
      displayName: result.row.displayName || 'Untitled widget',
      status: result.row.status,
    }),
    session.setCookies,
  );
}
