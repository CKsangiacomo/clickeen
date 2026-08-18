import { NextRequest, NextResponse } from 'next/server';
import { createCompactInstanceId } from '@clickeen/ck-contracts/overlay-identity';
import {
  createAccountInstanceInTokyo,
  loadTokyoAccountInstanceDocument,
} from '@roma/lib/account-instance-direct';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
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

  const accountId = current.value.authzPayload.accountPublicId;
  const sourceInstanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof sourceInstanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: sourceInstanceId.error }, { status: sourceInstanceId.status }),
      current.value.setCookies,
    );
  }

  const source = await loadTokyoAccountInstanceDocument({
    accountId,
    instanceId: sourceInstanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!source.ok) {
    return withSession(
      request,
      NextResponse.json({ error: source.error }, { status: source.status }),
      current.value.setCookies,
    );
  }

  const widgetType = source.value.row.widgetType;
  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(accountLocales.payload, { status: accountLocales.status }),
      current.value.setCookies,
    );
  }

  const baseLocale = accountLocales.localePolicy.baseLocale;

  const instanceId = createCompactInstanceId();
  const content = {
    ...source.value.source.content,
    id: instanceId,
    accountId,
    widgetType,
    fields: Object.fromEntries(
      Object.entries(source.value.source.content.fields).map(([path, field]) => [
        path,
        { ...field, status: 'ok' as const },
      ]),
    ),
    updatedAt: new Date().toISOString(),
  };

  const duplicate = await createAccountInstanceInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    instanceId,
    widgetType,
    displayName: null,
    config: source.value.source.config,
    content,
    baseLocale,
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
        accountId: duplicate.value.row.accountId,
        sourceInstanceId,
        sourceAccountId: duplicate.value.row.accountId,
        instanceId: duplicate.value.row.instanceId,
        widgetType: duplicate.value.row.widgetType,
        status: duplicate.value.row.publishStatus,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
