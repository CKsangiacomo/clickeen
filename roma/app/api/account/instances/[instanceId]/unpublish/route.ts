import { NextRequest, NextResponse } from 'next/server';
import { unpublishAccountInstanceInTokyo } from '@roma/lib/account-instance-direct';
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

  const unpublish = await unpublishAccountInstanceInTokyo({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
  });
  if (!unpublish.ok) {
    return withSession(
      request,
      NextResponse.json({ error: unpublish.error }, { status: unpublish.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      ok: true,
      instanceId: unpublish.value.instanceId,
      status: unpublish.value.status,
      changed: unpublish.value.changed,
    }),
    current.value.setCookies,
  );
}
