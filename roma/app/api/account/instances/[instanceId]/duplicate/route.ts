import { NextRequest, NextResponse } from 'next/server';
import { normalizeInstanceId } from '@clickeen/ck-contracts';
import { duplicateAccountInstanceInTokyo } from '@roma/lib/account-instance-direct';
import { loadAccountL10nIntent } from '@roma/lib/account-l10n-intent';
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
  const { instanceId: sourceInstanceIdRaw } = await context.params;
  const sourceInstanceId = normalizeInstanceId(sourceInstanceIdRaw);
  if (!sourceInstanceId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instanceId.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const l10nIntent = await loadAccountL10nIntent({
    accessToken: current.value.accessToken,
    accountId,
  });
  if (!l10nIntent.ok) {
    return withSession(
      request,
      NextResponse.json({ error: l10nIntent.error }, { status: l10nIntent.status }),
      current.value.setCookies,
    );
  }

  const duplicate = await duplicateAccountInstanceInTokyo({
    accountId,
    sourceInstanceId,
    accountCapsule: current.value.authzToken,
    l10nIntent: l10nIntent.value,
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
