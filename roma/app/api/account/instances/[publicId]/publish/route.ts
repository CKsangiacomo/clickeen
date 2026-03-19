import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceLiveStatus,
} from '@roma/lib/account-instance-direct';
import { runAccountInstanceSync } from '@roma/lib/account-instance-sync';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import {
  countPublishedAccountInstances,
  loadAccountPublishContainment,
  updateAccountInstanceStatusRow,
} from '@roma/lib/michael';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const containment = await loadAccountPublishContainment(accountId, current.value.accessToken);
  if (!containment.ok) {
    const status = containment.status === 401 ? 401 : containment.status === 403 ? 403 : 502;
    const kind = status === 401 ? 'AUTH' : status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: containment.reasonKey, detail: containment.detail } },
        { status },
      ),
      current.value.setCookies,
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
      current.value.setCookies,
    );
  }

  const currentInstance = await loadTokyoAccountInstanceDocument({
    accountId,
    publicId,
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
  });
  if (!currentInstance.ok) {
    return withSession(
      request,
      NextResponse.json({ error: currentInstance.error }, { status: currentInstance.status }),
      current.value.setCookies,
    );
  }

  const liveStatus = await loadTokyoAccountInstanceLiveStatus({
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    publicId,
  });
  if (!liveStatus.ok) {
    return withSession(
      request,
      NextResponse.json({ error: liveStatus.error }, { status: liveStatus.status }),
      current.value.setCookies,
    );
  }

  if (liveStatus.value === 'published') {
    return withSession(
      request,
      NextResponse.json({ ok: true, publicId, status: 'published', changed: false }),
      current.value.setCookies,
    );
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
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
        current.value.setCookies,
      );
    }
    const publishedCount = await countPublishedAccountInstances(accountId, current.value.accessToken);
    if (!publishedCount.ok) {
      const status = publishedCount.status === 401 ? 401 : publishedCount.status === 403 ? 403 : 502;
      const kind = status === 401 ? 'AUTH' : status === 403 ? 'DENY' : 'UPSTREAM_UNAVAILABLE';
      return withSession(
        request,
        NextResponse.json(
          { error: { kind, reasonKey: publishedCount.reasonKey, detail: publishedCount.detail } },
          { status },
        ),
        current.value.setCookies,
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
        current.value.setCookies,
      );
    }
  }

  const publishWrite = await updateAccountInstanceStatusRow({
    accountId,
    publicId,
    status: 'published',
    berlinAccessToken: current.value.accessToken,
  });
  if (!publishWrite.ok) {
    const status = publishWrite.status === 401 ? 401 : publishWrite.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: publishWrite.reasonKey, detail: publishWrite.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  try {
    await runAccountInstanceSync({
      accessToken: current.value.accessToken,
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
      live: true,
    });
  } catch (error) {
    await updateAccountInstanceStatusRow({
      accountId,
      publicId,
      status: 'unpublished',
      berlinAccessToken: current.value.accessToken,
    }).catch(() => undefined);
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
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, publicId, status: 'published', changed: true }),
    current.value.setCookies,
  );
}
