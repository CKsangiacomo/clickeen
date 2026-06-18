import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import {
  loadAccountWidgetDefaultsInTokyo,
  saveAccountWidgetDefaultsInTokyo,
  type AccountWidgetDefaultsDocument,
} from '@roma/lib/account-widget-defaults-direct';
import { validateAccountWidgetDefaultsContract } from '@roma/lib/account-widget-defaults-contract';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

function routeKind(status: number): 'AUTH' | 'DENY' | 'VALIDATION' | 'UPSTREAM_UNAVAILABLE' {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'DENY';
  if (status === 422) return 'VALIDATION';
  return 'UPSTREAM_UNAVAILABLE';
}

function stampWidgetDefaultsSave(args: {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
}): AccountWidgetDefaultsDocument {
  return {
    ...args.widgetDefaults,
    accountId: args.accountId,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const result = await loadAccountWidgetDefaultsInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(result.status),
            reasonKey: result.error.reasonKey,
            detail: result.error.detail,
          },
        },
        { status: result.status },
      ),
      current.value.setCookies,
    );
  }

  const contract = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: result.value.widgetDefaults,
  });
  if (!contract.ok) {
    return withSession(
      request,
      NextResponse.json({ error: contract.error }, { status: contract.status }),
      current.value.setCookies,
    );
  }

  return withSession(request, NextResponse.json(result.value), current.value.setCookies);
}

export async function PUT(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{ widgetDefaults?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const widgetDefaults = bodyResult.payload?.widgetDefaults;
  if (!isRecord(widgetDefaults)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const stamped = stampWidgetDefaultsSave({
    accountId,
    widgetDefaults: widgetDefaults as AccountWidgetDefaultsDocument,
  });
  const contract = await validateAccountWidgetDefaultsContract({
    request,
    widgetDefaults: stamped,
  });
  if (!contract.ok) {
    return withSession(
      request,
      NextResponse.json({ error: contract.error }, { status: contract.status }),
      current.value.setCookies,
    );
  }

  const result = await saveAccountWidgetDefaultsInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
    widgetDefaults: stamped,
  });
  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(result.status),
            reasonKey: result.error.reasonKey,
            detail: result.error.detail,
          },
        },
        { status: result.status },
      ),
      current.value.setCookies,
    );
  }

  return withSession(request, NextResponse.json(result.value), current.value.setCookies);
}
