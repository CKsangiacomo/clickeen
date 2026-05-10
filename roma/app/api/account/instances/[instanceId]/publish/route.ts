import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceIndex,
  loadTokyoAccountInstanceLiveStatus,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { normalizeDesiredAccountLocales } from '@roma/lib/account-locales';
import {
  syncAccountInstanceLiveSurface,
  TokyoAccountInstanceSyncError,
} from '@roma/lib/account-instance-sync';
import {
  loadAccountPublishContainment,
} from '@roma/lib/berlin-product';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { instanceId: instanceIdRaw } = await context.params;
  const instanceId = String(instanceIdRaw || '').trim();
  if (!instanceId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.instanceIdRequired' } },
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
    instanceId,
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
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
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
      NextResponse.json({ ok: true, instanceId, status: 'published', changed: false }),
      current.value.setCookies,
    );
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const publishedLimitRaw = policy.limits['instances.published.max'];
  const publishedLimit =
    typeof publishedLimitRaw === 'number' && Number.isFinite(publishedLimitRaw)
      ? Math.max(0, Math.floor(publishedLimitRaw))
      : null;
  if (publishedLimit != null) {
    if (publishedLimit === 0) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'DENY',
              reasonKey: 'coreui.upsell.reason.limitReached',
              detail: `instances.published.max=${publishedLimit}`,
            },
          },
          { status: 403 },
        ),
        current.value.setCookies,
      );
    }
    const accountIndex = await loadTokyoAccountInstanceIndex({
      accountId,
      accountCapsule: current.value.authzToken,
    });
    if (!accountIndex.ok) {
      return withSession(
        request,
        NextResponse.json({ error: accountIndex.error }, { status: accountIndex.status }),
        current.value.setCookies,
      );
    }

    if (accountIndex.value.publishedCount >= publishedLimit) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'DENY',
              reasonKey: 'coreui.upsell.reason.limitReached',
              detail: `instances.published.max=${publishedLimit}`,
            },
          },
          { status: 403 },
        ),
        current.value.setCookies,
      );
    }
  }

  const accountLocalesState = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!accountLocalesState.ok) {
    const status =
      accountLocalesState.status === 401
        ? 401
        : accountLocalesState.status === 403
          ? 403
          : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey:
              status === 401
                ? 'coreui.errors.auth.required'
                : status === 403
                  ? 'coreui.errors.auth.forbidden'
                  : 'coreui.errors.auth.contextUnavailable',
            detail:
              accountLocalesState.detail ||
              `berlin_account_http_${accountLocalesState.status}`,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  try {
    await syncAccountInstanceLiveSurface({
      accountId,
      instanceId,
      accountCapsule: current.value.authzToken,
      l10nIntent: {
        baseLocale: accountLocalesState.policy.baseLocale,
        desiredLocales: normalizeDesiredAccountLocales({
          baseLocale: accountLocalesState.policy.baseLocale,
          locales: accountLocalesState.locales,
        }),
        countryToLocale: accountLocalesState.policy.ip.countryToLocale,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const status =
      error instanceof TokyoAccountInstanceSyncError
        ? error.status === 401
          ? 401
          : error.status === 403
            ? 403
            : error.status === 404
              ? 404
              : error.status === 422
                ? 422
                : 502
        : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 404
            ? 'NOT_FOUND'
            : status === 422
              ? 'VALIDATION'
              : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind,
            reasonKey:
              status === 404
                ? 'coreui.errors.instance.notFound'
                : status === 422
                  ? detail
                  : 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, instanceId, status: 'published', changed: true }),
    current.value.setCookies,
  );
}
