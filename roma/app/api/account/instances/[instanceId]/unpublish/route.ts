import { NextRequest, NextResponse } from 'next/server';
import {
  deleteLiveSurfaceFromTokyo,
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceLiveStatus,
} from '@roma/lib/account-instance-direct';
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

  if (liveStatus.value === 'unpublished') {
    return withSession(
      request,
      NextResponse.json({ ok: true, instanceId, status: 'unpublished', changed: false }),
      current.value.setCookies,
    );
  }

  try {
    await deleteLiveSurfaceFromTokyo({
      accountId,
      instanceId,
      accountCapsule: current.value.authzToken,
    });
  } catch (error) {
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
    NextResponse.json({ ok: true, instanceId, status: 'unpublished', changed: true }),
    current.value.setCookies,
  );
}
