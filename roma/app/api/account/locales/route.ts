import { NextRequest, NextResponse } from 'next/server';
import {
  isRecord,
  parseAccountLocaleListStrict,
  parseAccountLocalePolicyStrict,
  validateAccountLocaleList,
  validateAccountLocalePolicy,
} from '@clickeen/ck-contracts';
import { resolvePolicy } from '@clickeen/ck-policy';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { listAccountWidgetInstanceIds } from '@roma/lib/account-instance-direct';
import {
  deleteAccountInstanceLocalePackageArtifact,
} from '@roma/lib/account-instance-locale-package';
import { deleteAccountInstanceTranslationValues } from '@roma/lib/account-instance-translations';
import {
  emptyRemovedLocaleCleanup,
  runRemovedLocaleCleanup,
  type RemovedLocaleCleanup,
} from '@roma/lib/account-locale-cleanup';
import { loadAccountBaseLocaleLockState } from '@roma/lib/account-base-locale-lock';
import {
  ACCOUNT_ACTIVE_LOCALES_PATCH_SELECT,
  buildAccountActiveLocalesPatch,
  readAccountActiveLocalesPatch,
  type AccountActiveLocalesPatchRow,
} from '@roma/lib/account-active-locales-storage';
import { enforceActiveLocaleEntitlement } from '@roma/lib/account-locale-entitlements';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type AccountLocalesWritePayload = {
  activeLocales?: unknown;
  localePolicy?: unknown;
};

function resolveSupabaseAdminConfig(): { baseUrl: string; serviceRoleKey: string } {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('roma.errors.account.locales.supabase_admin_config_missing');
  }
  return { baseUrl, serviceRoleKey };
}

async function supabaseAdminFetch(pathnameWithQuery: string, init?: RequestInit): Promise<Response> {
  const config = resolveSupabaseAdminConfig();
  const headers = new Headers(init?.headers);
  headers.set('apikey', config.serviceRoleKey);
  headers.set('authorization', `Bearer ${config.serviceRoleKey}`);
  headers.set('accept', 'application/json');
  if (!headers.has('content-type') && init?.body) headers.set('content-type', 'application/json');

  return fetch(`${config.baseUrl}${pathnameWithQuery}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolveDbErrorDetail(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const message = payload.message ?? payload.error_description ?? payload.error;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveActiveLocaleDelta(args: {
  previousActiveLocales: string[];
  nextActiveLocales: string[];
  baseLocale: string;
}): {
  addedLocales: string[];
  removedLocales: string[];
} {
  const previousActiveLocales = Array.from(
    new Set(args.previousActiveLocales.filter((locale) => locale !== args.baseLocale)),
  );
  const nextActiveLocales = Array.from(new Set(args.nextActiveLocales.filter((locale) => locale !== args.baseLocale)));
  const previousActiveSet = new Set(previousActiveLocales);
  const nextActiveSet = new Set(nextActiveLocales);
  return {
    addedLocales: nextActiveLocales.filter((locale) => !previousActiveSet.has(locale)),
    removedLocales: previousActiveLocales.filter((locale) => !nextActiveSet.has(locale)),
  };
}

async function cleanupRemovedAccountLocales(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  removedLocales: string[];
}): Promise<RemovedLocaleCleanup> {
  const removedLocales = Array.from(new Set(args.removedLocales));
  if (removedLocales.length === 0) return emptyRemovedLocaleCleanup();
  const instances = await listAccountWidgetInstanceIds({
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!instances.ok) {
    return {
      ...emptyRemovedLocaleCleanup(),
      ok: false,
      error: instances.error,
    };
  }
  return runRemovedLocaleCleanup({
    accountId: args.accountId,
    instanceIds: instances.value.instanceIds,
    removedLocales,
    deleteTranslation: (instanceId, locale) =>
      deleteAccountInstanceTranslationValues({
        accountId: args.accountId,
        instanceId,
        locale,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      }),
    deletePackage: (instanceId, locale) =>
      deleteAccountInstanceLocalePackageArtifact({
        accountId: args.accountId,
        instanceId,
        locale,
        accountCapsule: args.accountCapsule,
        requestId: args.requestId,
      }),
  });
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  try {
    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!accountState.ok) {
      return withSession(
        request,
        NextResponse.json(
          accountState.payload ?? {
            error: {
              kind: accountState.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                accountState.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: accountState.status },
        ),
        current.value.setCookies,
      );
    }

    const baseLocaleLock = await loadAccountBaseLocaleLockState({
      accountId: current.value.authzPayload.accountPublicId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!baseLocaleLock.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: baseLocaleLock.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                baseLocaleLock.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
              detail: baseLocaleLock.detail,
            },
          },
          { status: baseLocaleLock.status },
        ),
        current.value.setCookies,
      );
    }

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        activeLocales: accountState.activeLocales,
        localePolicy: accountState.localePolicy,
        baseLocaleLocked: baseLocaleLock.locked,
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}

export async function PUT(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'admin' });
  if (!current.ok) return current.response;

  try {
    const bodyResult = await readJsonPayloadOrValidation<AccountLocalesWritePayload | null>(request);
    if (!bodyResult.ok) {
      return withSession(
        request,
        NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
        current.value.setCookies,
      );
    }
    const body = bodyResult.payload;

    if (!isRecord(body)) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const localeIssues = validateAccountLocaleList(body.activeLocales, 'activeLocales');
    if (localeIssues.length) {
      return withSession(request, NextResponse.json(localeIssues, { status: 422 }), current.value.setCookies);
    }

    const policyIssues = validateAccountLocalePolicy(body.localePolicy, 'localePolicy');
    if (policyIssues.length) {
      return withSession(request, NextResponse.json(policyIssues, { status: 422 }), current.value.setCookies);
    }

    const activeLocales = parseAccountLocaleListStrict(body.activeLocales);
    const localePolicy = parseAccountLocalePolicyStrict(body.localePolicy);
    const baseLocale = normalizeLocaleToken(localePolicy.baseLocale);
    if (!baseLocale) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const policy = resolvePolicy({
      profile: current.value.authzPayload.profile,
      role: current.value.authzPayload.role,
    });
    const entitlementGate = enforceActiveLocaleEntitlement(policy, activeLocales);
    if (entitlementGate) return withSession(request, entitlementGate, current.value.setCookies);

    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!accountState.ok) {
      return withSession(
        request,
        NextResponse.json(
          accountState.payload ?? {
            error: {
              kind: accountState.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                accountState.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: accountState.status },
        ),
        current.value.setCookies,
      );
    }

    const baseLocaleLock = await loadAccountBaseLocaleLockState({
      accountId: current.value.authzPayload.accountPublicId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
    if (!baseLocaleLock.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: baseLocaleLock.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                baseLocaleLock.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
              detail: baseLocaleLock.detail,
            },
          },
          { status: baseLocaleLock.status },
        ),
        current.value.setCookies,
      );
    }
    if (baseLocaleLock.locked && baseLocale !== accountState.localePolicy.baseLocale) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'VALIDATION',
              reasonKey: 'coreui.errors.account.locales.baseLocaleLocked',
            },
          },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

    const activeDelta = resolveActiveLocaleDelta({
      previousActiveLocales: accountState.activeLocales,
      nextActiveLocales: activeLocales,
      baseLocale,
    });
    const settingsUnchanged =
      activeDelta.addedLocales.length === 0 &&
      activeDelta.removedLocales.length === 0 &&
      sameJson(localePolicy, accountState.localePolicy);

    if (settingsUnchanged) {
      return withSession(
        request,
        NextResponse.json({
          accountId: current.value.authzPayload.accountId,
          activeLocales: accountState.activeLocales,
          localePolicy: accountState.localePolicy,
          localeCleanup: emptyRemovedLocaleCleanup(),
        }),
        current.value.setCookies,
      );
    }

    const params = new URLSearchParams({
      id: `eq.${current.value.authzPayload.accountId}`,
      select: ACCOUNT_ACTIVE_LOCALES_PATCH_SELECT,
    });
    const upstream = await supabaseAdminFetch(`/rest/v1/accounts?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(buildAccountActiveLocalesPatch({ activeLocales, localePolicy })),
    });
    const upstreamPayload = await readJson(upstream);
    if (!upstream.ok) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.db.writeFailed',
              detail: resolveDbErrorDetail(upstreamPayload, `supabase_status_${upstream.status}`),
            },
          },
          { status: 502 },
        ),
        current.value.setCookies,
      );
    }
    if (!Array.isArray(upstreamPayload)) {
      return withSession(
        request,
        NextResponse.json(
          {
            error: {
              kind: 'UPSTREAM_UNAVAILABLE',
              reasonKey: 'coreui.errors.db.writeFailed',
              detail: 'account_locale_patch_payload_invalid',
            },
          },
          { status: 502 },
        ),
        current.value.setCookies,
      );
    }

    const patchedRow = upstreamPayload[0] as AccountActiveLocalesPatchRow | undefined;
    if (!isRecord(patchedRow) || patchedRow.id !== current.value.authzPayload.accountId) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' } },
          { status: 404 },
        ),
        current.value.setCookies,
      );
    }

    const localeCleanup =
      activeDelta.removedLocales.length > 0
        ? await cleanupRemovedAccountLocales({
        accountId: current.value.authzPayload.accountPublicId,
        accountCapsule: current.value.authzToken,
        requestId: current.value.requestId,
        removedLocales: activeDelta.removedLocales,
          })
        : emptyRemovedLocaleCleanup();

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        ...readAccountActiveLocalesPatch(patchedRow),
        localeCleanup,
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}
