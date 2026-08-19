import { NextRequest, NextResponse } from 'next/server';
import type { Policy } from '@clickeen/ck-policy';
import {
  loadAccountWidgetInstanceFacts,
  loadTokyoAccountInstanceDocument,
  publishAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import {
  materializeAccountInstancePublicPackage,
  readWidgetForInstancePackage,
} from '@roma/lib/account-instance-public-package';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

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
  const policy: Policy = {
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
    flags: current.value.authzPayload.entitlements!.flags!,
    limits: current.value.authzPayload.entitlements!.limits!,
  };
  const publishedLimit = policy.limits['instances.published.max']!;
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

  const saved = await loadTokyoAccountInstanceDocument({
    accountId: productAccountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!saved.ok) {
    return withSession(
      request,
      NextResponse.json({ error: saved.error }, { status: saved.status }),
      current.value.setCookies,
    );
  }

  const compiled = readWidgetForInstancePackage(saved.value.row.widgetType);

  const materialized = await materializeAccountInstancePublicPackage({
    compiled,
    accountId: productAccountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    instanceId,
    baseLocale: saved.value.row.baseLocale,
    config: saved.value.config,
    discoveryPolicyEnabled: policy.flags['embed.seoGeo.enabled']!,
  });
  if (!materialized.ok) {
    return withSession(
      request,
      NextResponse.json({ error: materialized.error }, { status: materialized.status }),
      current.value.setCookies,
    );
  }

  const publish = await publishAccountInstanceInTokyo({
    accountId: productAccountId,
    instanceId,
    sourceUpdatedAt: saved.value.row.updatedAt,
    publishedLimit,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    publicPackage: {
      indexHtml: materialized.value.indexHtml,
      stylesCss: materialized.value.stylesCss,
      runtimeJs: materialized.value.runtimeJs,
    },
  });
  if (!publish.ok) {
    if (publish.status === 402) {
      return withSession(
        request,
        upgradeRequired({
          gate: 'instances.published.max',
          action: 'publish_instance',
          current: publish.error.current!,
          limit: publish.error.limit!,
        }),
        current.value.setCookies,
      );
    }
    return withSession(
      request,
      NextResponse.json(
        {
          ok: false,
          error: publish.error,
        },
        { status: publish.status },
      ),
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
