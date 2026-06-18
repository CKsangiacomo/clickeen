import { NextRequest, NextResponse } from 'next/server';
import { generateAccountInstanceTranslations } from '@roma/lib/account-instance-translations';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { requireInstanceIdParam } from '@roma/lib/route-helpers';
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

  const accountLocales = await loadCurrentAccountLocalesState({
    accessToken: current.value.accessToken,
    accountId: current.value.authzPayload.accountId,
    requestId: current.value.requestId,
  });
  if (!accountLocales.ok) {
    return withSession(
      request,
      NextResponse.json(
        accountLocales.payload ?? {
          error: {
            kind: accountLocales.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
            reasonKey:
              accountLocales.status === 401
                ? 'coreui.errors.auth.required'
                : 'coreui.errors.auth.contextUnavailable',
            detail: accountLocales.detail,
          },
        },
        { status: accountLocales.status },
      ),
      current.value.setCookies,
    );
  }
  const baseLocale = accountLocales.localePolicy.baseLocale;
  const activeLocalesToGenerate = accountLocales.selectedTargetLocales.filter(
    (locale) => locale !== baseLocale,
  );

  const generated = await generateAccountInstanceTranslations({
    accountId,
    instanceId,
    baseLocale,
    targetLocales: activeLocalesToGenerate,
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
