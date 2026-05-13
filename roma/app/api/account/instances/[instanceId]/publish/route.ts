import { NextRequest, NextResponse } from 'next/server';
import { publishAccountInstanceInTokyo } from '@roma/lib/account-instance-direct';
import { loadAccountL10nIntent } from '@roma/lib/account-l10n-intent';
import { loadAccountPublishContainment } from '@roma/lib/berlin-product';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  const containment = await loadAccountPublishContainment(accountId, current.value.accessToken, current.value.requestId);
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

  const l10nIntent = await loadAccountL10nIntent({
    accessToken: current.value.accessToken,
    accountId,
    requestId: current.value.requestId,
  });
  if (!l10nIntent.ok) {
    return withSession(
      request,
      NextResponse.json({ error: l10nIntent.error }, { status: l10nIntent.status }),
      current.value.setCookies,
    );
  }

  const publish = await publishAccountInstanceInTokyo({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    l10nIntent: l10nIntent.value,
    requestId: current.value.requestId,
  });
  if (!publish.ok) {
    return withSession(
      request,
      NextResponse.json({ error: publish.error }, { status: publish.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      ok: true,
      instanceId: publish.value.instanceId,
      status: publish.value.status,
      changed: publish.value.changed,
    }),
    current.value.setCookies,
  );
}
