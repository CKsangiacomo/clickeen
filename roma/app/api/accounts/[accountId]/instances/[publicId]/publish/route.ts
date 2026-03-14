import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicy } from '@clickeen/ck-policy';
import {
  loadTokyoPreferredAccountInstance,
  normalizeAftermathWarning,
  notifyParisPublishedSurfaceSync,
} from '../../../../../../../../bob/lib/account-instance-direct';
import { authorizeRequestAccountRoleFromCapsule } from '../../../../../../../../bob/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '../../../../../../../lib/auth/session';
import { resolveParisBaseUrl } from '../../../../../../../lib/env/paris';
import { resolveTokyoBaseUrl } from '../../../../../../../lib/env/tokyo';
import {
  countPublishedAccountInstances,
  loadAccountPublishContainment,
  updateAccountInstanceStatusRow,
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

  const containment = await loadAccountPublishContainment(accountId, session.accessToken);
  if (!containment.ok) {
    const status = containment.status === 401 ? 401 : containment.status === 403 ? 403 : 502;
    const kind =
      status === 401 ? 'AUTH' : status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: containment.reasonKey,
            detail: containment.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }
  if (containment.containment.active) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'DENY',
            reasonKey: 'coreui.errors.account.publishingPaused',
            detail: containment.containment.reason ?? 'account_publish_containment_active',
          },
        },
        { status: 403 },
      ),
      session.setCookies,
    );
  }

  const current = await loadTokyoPreferredAccountInstance({
    accountId,
    publicId,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: session.accessToken,
  });
  if (!current.ok) {
    return withSession(
      request,
      NextResponse.json({ error: current.error }, { status: current.status }),
      session.setCookies,
    );
  }

  if (current.value.row.status === 'published') {
    return withSession(
      request,
      NextResponse.json({ ok: true, publicId, status: 'published', changed: false }),
      session.setCookies,
    );
  }

  const policy = resolvePolicy({
    profile: authz.payload.profile,
    role: authz.payload.role,
  });
  const publishedCapRaw = policy.caps['instances.published.max'];
  const publishedCap =
    typeof publishedCapRaw === 'number' && Number.isFinite(publishedCapRaw)
      ? Math.max(0, Math.floor(publishedCapRaw))
      : null;
  if (publishedCap != null) {
    if (publishedCap === 0) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'DENY',
              reasonKey: 'coreui.upsell.reason.capReached',
              detail: `instances.published.max=${publishedCap}`,
            },
          },
          { status: 403 },
        ),
        session.setCookies,
      );
    }
    const publishedCount = await countPublishedAccountInstances(accountId, session.accessToken);
    if (!publishedCount.ok) {
      const status = publishedCount.status === 401 ? 401 : publishedCount.status === 403 ? 403 : 502;
      const kind = status === 401 ? 'AUTH' : status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE';
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind,
              reasonKey: publishedCount.reasonKey,
              detail: publishedCount.detail,
            },
          },
          { status },
        ),
        session.setCookies,
      );
    }
    if (publishedCount.count >= publishedCap) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'DENY',
              reasonKey: 'coreui.upsell.reason.capReached',
              detail: `instances.published.max=${publishedCap}`,
            },
          },
          { status: 403 },
        ),
        session.setCookies,
      );
    }
  }

  const publishWrite = await updateAccountInstanceStatusRow({
    accountId,
    publicId,
    status: 'published',
    berlinAccessToken: session.accessToken,
  });
  if (!publishWrite.ok) {
    const status = publishWrite.status === 401 ? 401 : publishWrite.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey: publishWrite.reasonKey,
            detail: publishWrite.detail,
          },
        },
        { status },
      ),
      session.setCookies,
    );
  }

  const aftermath = await notifyParisPublishedSurfaceSync({
    parisBaseUrl: resolveParisBaseUrl(),
    parisAccessToken: session.accessToken,
    authzCapsule: request.headers.get('x-ck-authz-capsule'),
    internalServiceName: 'roma.edge',
    accountId,
    publicId,
    previousConfig: {},
    instance: {
      widgetType: current.value.row.widgetType,
      status: 'published',
      source: current.value.row.source,
    },
    created: true,
  });

  if (!aftermath.ok) {
    await updateAccountInstanceStatusRow({
      accountId,
      publicId,
      status: 'unpublished',
      berlinAccessToken: session.accessToken,
    }).catch(() => undefined);
    const normalized = normalizeAftermathWarning({
      status: aftermath.status,
      payload: aftermath.payload,
    });
    return withSession(
      request,
      NextResponse.json({ error: normalized.error }, { status: normalized.status }),
      session.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, publicId, status: 'published', changed: true }),
    session.setCookies,
  );
}
