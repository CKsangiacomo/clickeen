import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import {
  loadAccountWidgetInstanceFacts,
  publishAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function readFinitePolicyLimit(limits: Record<string, unknown>, key: string): number | null {
  const value = limits[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function policyContractFailure(key: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'roma.errors.policy.invalidEntitlement',
        detail: key,
      },
    },
    { status: 500 },
  );
}

function upgradeRequired(args: {
  gate: 'instances.published.max';
  action: 'publish_instance';
  current: number;
  limit: number;
}): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      kind: 'UPGRADE_REQUIRED',
      upgrade: args,
    },
    { status: 402 },
  );
}

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

  const instances = await loadAccountWidgetInstanceFacts({
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
  const currentInstance = instances.value.instances.find((entry) => entry.instanceId === instanceId) ?? null;
  if (!currentInstance) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }
  const alreadyPublished = currentInstance?.publishStatus === 'published';
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    entitlements: current.value.authzPayload.entitlements ?? null,
  });
  const publishedLimit = readFinitePolicyLimit(policy.limits, 'instances.published.max');
  if (publishedLimit == null) {
    return withSession(
      request,
      policyContractFailure('instances.published.max'),
      current.value.setCookies,
    );
  }
  const publishedTotal = instances.value.instances.filter((entry) => entry.publishStatus === 'published').length;
  if (!alreadyPublished && publishedTotal >= publishedLimit) {
    return withSession(
      request,
      upgradeRequired({
        gate: 'instances.published.max',
        action: 'publish_instance',
        current: publishedTotal,
        limit: publishedLimit,
      }),
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
