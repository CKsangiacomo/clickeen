import { NextRequest, NextResponse } from 'next/server';
import { resolvePolicy } from '@clickeen/ck-policy';
import { materializeAccountInstanceLocalePackages } from '@roma/lib/account-instance-locale-package';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
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
  const activeLocalesToMaterialize = accountLocales.activeLocales.filter(
    (locale) => locale !== baseLocale,
  );
  const policy = resolvePolicy({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
  });
  const entitlementGate = enforceActiveLocaleEntitlement(policy, activeLocalesToMaterialize);
  if (entitlementGate) return withSession(request, entitlementGate, current.value.setCookies);

  const packages = await materializeAccountInstanceLocalePackages({
    request,
    accountId,
    instanceId,
    baseLocale,
    activeLocales: activeLocalesToMaterialize,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!packages.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          ok: false,
          error: packages.error,
          localePackages: packages.value,
        },
        { status: packages.status },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      ok: true,
      baseLocale,
      activeLocales: activeLocalesToMaterialize,
      localePackages: packages.value,
    }),
    current.value.setCookies,
  );
}
