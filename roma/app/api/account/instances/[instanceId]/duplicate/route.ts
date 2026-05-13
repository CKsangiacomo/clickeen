import { NextRequest, NextResponse } from 'next/server';
import { duplicateAccountInstanceInTokyo } from '@roma/lib/account-instance-direct';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const sourceInstanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof sourceInstanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: sourceInstanceId.error }, { status: sourceInstanceId.status }),
      current.value.setCookies,
    );
  }

  const duplicate = await duplicateAccountInstanceInTokyo({
    accountId,
    sourceInstanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!duplicate.ok) {
    return withSession(
      request,
      NextResponse.json({ error: duplicate.error }, { status: duplicate.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(
      {
        accountId: duplicate.value.accountId,
        sourceInstanceId: duplicate.value.sourceInstanceId,
        sourceAccountId: duplicate.value.accountId,
        instanceId: duplicate.value.instanceId,
        widgetType: duplicate.value.widgetType,
        status: duplicate.value.status,
        translationFollowup: duplicate.value.translationFollowup,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
