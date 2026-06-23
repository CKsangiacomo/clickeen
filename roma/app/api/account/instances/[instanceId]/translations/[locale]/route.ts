import { NextRequest, NextResponse } from 'next/server';
import { readAccountInstanceTranslationValues } from '@roma/lib/account-instance-translations';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string; locale: string }> };

async function requireLocaleParam(context: RouteContext): Promise<string | null> {
  const params = await context.params;
  const locale = String(params.locale || '').trim();
  return locale || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }
  const locale = await requireLocaleParam(context);
  if (!locale) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'locale_missing' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const result = await readAccountInstanceTranslationValues({
    accountId,
    instanceId,
    locale,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(result.value),
    current.value.setCookies,
  );
}
