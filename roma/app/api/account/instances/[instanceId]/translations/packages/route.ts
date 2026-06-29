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

type PackageRefreshPayload = {
  locales?: unknown;
};

type PayloadFailure = {
  ok: false;
  status: 422;
  error: {
    kind: 'VALIDATION';
    reasonKey: string;
    detail?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readOptionalPackageRefreshPayload(
  request: NextRequest,
): Promise<{ ok: true; locales: string[] | null } | PayloadFailure> {
  const text = await request.text().catch(() => '');
  if (!text.trim()) return { ok: true, locales: null };
  let parsed: PackageRefreshPayload;
  try {
    parsed = JSON.parse(text) as PackageRefreshPayload;
  } catch {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalidJson',
      },
    };
  }
  if (!isRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, 'locales')) {
    return { ok: true, locales: null };
  }
  if (!Array.isArray(parsed.locales)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'locales_invalid',
      },
    };
  }
  const locales = parsed.locales.map((locale) =>
    typeof locale === 'string' ? locale.trim() : '',
  );
  if (!locales.length || locales.some((locale) => !locale) || new Set(locales).size !== locales.length) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'locales_invalid',
      },
    };
  }
  return { ok: true, locales };
}

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
  const body = await readOptionalPackageRefreshPayload(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  const activeLocaleSet = new Set(activeLocalesToMaterialize);
  if (body.locales && body.locales.some((locale) => !activeLocaleSet.has(locale))) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: 'locales_not_active',
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const requestedLocalesToMaterialize = body.locales ?? activeLocalesToMaterialize;
  const policy = resolvePolicy({
    profile: current.value.authzPayload.profile,
    role: current.value.authzPayload.role,
  });
  const entitlementGate = enforceActiveLocaleEntitlement(policy, requestedLocalesToMaterialize);
  if (entitlementGate) return withSession(request, entitlementGate, current.value.setCookies);

  const packages = await materializeAccountInstanceLocalePackages({
    request,
    accountId,
    instanceId,
    baseLocale,
    activeLocales: requestedLocalesToMaterialize,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  }).catch((error): Awaited<ReturnType<typeof materializeAccountInstanceLocalePackages>> => ({
    ok: false,
    status: 502,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.instance.embedNotReady',
      detail: error instanceof Error ? error.message : String(error),
    },
    value: {
      ok: false,
      completed: [],
      skipped: requestedLocalesToMaterialize.map((locale) => ({
        accountId,
        instanceId,
        locale,
        phase: 'not-attempted-after-failure',
      })),
      failed: {
        accountId,
        instanceId,
        locale: requestedLocalesToMaterialize[0] ?? '',
        phase: 'materializer',
        reasonKey: 'coreui.errors.instance.embedNotReady',
        detail: error instanceof Error ? error.message : String(error),
      },
    },
  }));
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
      activeLocales: requestedLocalesToMaterialize,
      localePackages: packages.value,
    }),
    current.value.setCookies,
  );
}
