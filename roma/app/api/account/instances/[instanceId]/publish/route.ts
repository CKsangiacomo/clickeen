import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  listAccountInstancesInTokyo,
  publishAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const productAccountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  const instances = await listAccountInstancesInTokyo({
    accountId: productAccountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!instances.ok) {
    return withSession(
      request,
      NextResponse.json({ error: instances.error }, { status: instances.status }),
      current.value.setCookies,
    );
  }
  const currentInstance = instances.value.accountInstances.find((entry) => entry.instanceId === instanceId) ?? null;
  const alreadyPublished = currentInstance?.publishStatus === 'published';
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
  if (
    !alreadyPublished &&
    publishedLimit != null &&
    instances.value.accountInstances.filter((entry) => entry.publishStatus === 'published').length >= publishedLimit
  ) {
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

  const publish = await publishAccountInstanceInTokyo({
    accountId: productAccountId,
    instanceId,
    accountCapsule: current.value.authzToken,
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
