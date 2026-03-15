import { isUuid } from '@clickeen/ck-contracts';
import {
  readRomaAuthzCapsuleHeader,
  verifyRomaAccountAuthzCapsule,
  type MemberRole,
} from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../lib/auth/session';
import { resolveTokyoBaseUrl } from '../../../../../lib/env/tokyo';
import { deleteAccountInstanceRow, getAccountInstanceCoreRow } from '../../../../../lib/michael';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

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

function roleRank(value: MemberRole): number {
  switch (value) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
  }
}

async function authorizeRequestAccountRoleFromCapsule(args: {
  request: Request;
  accountId: string;
  minRole: MemberRole;
}) {
  const token = readRomaAuthzCapsuleHeader(args.request);
  if (!token) {
    return {
      ok: false as const,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'authz_capsule_required',
      },
    };
  }

  const secret = String(process.env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
  if (!secret) {
    return {
      ok: false as const,
      status: 500,
      error: {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.misconfigured',
        detail: 'roma_authz_capsule_secret_missing',
      },
    };
  }

  const verified = await verifyRomaAccountAuthzCapsule(secret, token);
  if (!verified.ok) {
    return {
      ok: false as const,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: verified.reason,
      },
    };
  }

  if (verified.payload.accountId !== args.accountId) {
    return {
      ok: false as const,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'account_mismatch',
      },
    };
  }

  if (roleRank(verified.payload.role) < roleRank(args.minRole)) {
    return {
      ok: false as const,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'role_insufficient',
      },
    };
  }

  return { ok: true as const, payload: verified.payload };
}

async function deleteTokyoMirrors(args: {
  tokyoAccessToken: string;
  accountId: string;
  publicId: string;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${args.tokyoAccessToken}`);
  headers.set('accept', 'application/json');
  headers.set('x-account-id', args.accountId);

  const tokyoBaseUrl = resolveTokyoBaseUrl().replace(/\/+$/, '');
  const savedUrl = `${tokyoBaseUrl}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`;
  const liveUrl = `${tokyoBaseUrl}/renders/instances/${encodeURIComponent(args.publicId)}/live.json?accountId=${encodeURIComponent(args.accountId)}`;

  try {
    const [savedResponse, liveResponse] = await Promise.all([
      fetch(savedUrl, { method: 'DELETE', headers, cache: 'no-store' }),
      fetch(liveUrl, { method: 'DELETE', headers, cache: 'no-store' }),
    ]);

    if (!savedResponse.ok && savedResponse.status !== 404) {
      const detail = await savedResponse.text().catch(() => '');
      return { ok: false, detail: detail || `tokyo_saved_config_delete_http_${savedResponse.status}` };
    }
    if (!liveResponse.ok && liveResponse.status !== 404) {
      const detail = await liveResponse.text().catch(() => '');
      return { ok: false, detail: detail || `tokyo_live_surface_delete_http_${liveResponse.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const accountId = String(request.nextUrl.searchParams.get('accountId') || '').trim();
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

  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  const publicIdKind =
    publicId.startsWith('wgt_main_') ? 'main' : publicId.startsWith('wgt_curated_') ? 'curated' : publicId.includes('_u_') ? 'user' : null;
  if (!publicIdKind) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' } },
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

  const sourceIsCurated = publicIdKind === 'main' || publicIdKind === 'curated';
  if (sourceIsCurated && authz.payload.accountIsPlatform !== true) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }),
      session.setCookies,
    );
  }

  const existing = await getAccountInstanceCoreRow(accountId, publicId, session.accessToken);
  if (!existing.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: existing.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey: existing.reasonKey,
            detail: existing.detail,
          },
        },
        { status: existing.status === 401 ? 401 : 502 },
      ),
      session.setCookies,
    );
  }
  if (!existing.row) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      session.setCookies,
    );
  }

  if (sourceIsCurated && existing.row.accountId !== accountId) {
    return withSession(
      request,
      NextResponse.json({ error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } }, { status: 403 }),
      session.setCookies,
    );
  }

  const deleteResult = await deleteAccountInstanceRow({
    accountId,
    publicId,
    berlinAccessToken: session.accessToken,
  });
  if (!deleteResult.ok) {
    const kind =
      deleteResult.status === 401
        ? 'AUTH'
        : deleteResult.status === 403
          ? 'DENY'
          : deleteResult.status === 422
            ? 'VALIDATION'
            : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: deleteResult.reasonKey,
            detail: deleteResult.detail,
          },
        },
        { status: deleteResult.status === 401 || deleteResult.status === 403 || deleteResult.status === 422 ? deleteResult.status : 502 },
      ),
      session.setCookies,
    );
  }

  const tokyoCleanup = await deleteTokyoMirrors({
    tokyoAccessToken: session.accessToken,
    accountId,
    publicId,
  });
  if (!tokyoCleanup.ok) {
    console.error('[roma delete route] tokyo cleanup failed after Michael delete', {
      accountId,
      publicId,
      detail: tokyoCleanup.detail,
    });
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      publicId,
      source: existing.row.source === 'curated' ? 'curated' : 'account',
      deleted: true,
      tokyoCleanupApplied: tokyoCleanup.ok,
    }),
    session.setCookies,
  );
}
