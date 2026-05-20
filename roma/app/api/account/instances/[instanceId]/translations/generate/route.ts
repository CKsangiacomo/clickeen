import { NextRequest, NextResponse } from 'next/server';
import { generateAccountInstanceTranslations } from '@roma/lib/account-instance-translations';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
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

  const bodyResult = await readJsonPayloadOrValidation<{ baseLocale?: unknown; targetLocales?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }

  const body = bodyResult.payload;
  const baseLocale = typeof body?.baseLocale === 'string' ? body.baseLocale.trim() : '';
  const targetLocales = Array.isArray(body?.targetLocales)
    ? body.targetLocales.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (!baseLocale || targetLocales.some((locale) => !locale.trim())) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const generated = await generateAccountInstanceTranslations({
    accountId,
    instanceId,
    baseLocale,
    targetLocales,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!generated.ok) {
    return withSession(
      request,
      NextResponse.json({ error: generated.error }, { status: generated.status }),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json(generated.value, { status: generated.status }),
    current.value.setCookies,
  );
}
