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
import { loadAccountBaseLocaleLockState } from '@roma/lib/account-base-locale-lock';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type AccountLocalesWritePayload = {
  selectedTargetLocales?: unknown;
  localePolicy?: unknown;
};

type AccountLocalePatchRow = {
  id?: unknown;
  selected_target_locales?: unknown;
  locale_policy?: unknown;
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

function resolveTranslatedLocaleEntitlementMax(policy: ReturnType<typeof resolvePolicy>): number | null {
  const raw = policy.limits['l10n.locales.max'];
  return raw == null ? null : Math.max(0, Math.floor(raw));
}

function enforceLocaleSelection(policy: ReturnType<typeof resolvePolicy>, locales: string[]): NextResponse | null {
  const maxTranslatedLocales = resolveTranslatedLocaleEntitlementMax(policy);
  if (maxTranslatedLocales != null && locales.length > maxTranslatedLocales) {
    return NextResponse.json(
      {
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.upsell.reason.limitReached',
          upsell: 'UP',
          detail: `l10n.locales.max=${maxTranslatedLocales}`,
        },
      },
      { status: 403 },
    );
  }

  return null;
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
        selectedTargetLocales: accountState.selectedTargetLocales,
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

    const localeIssues = validateAccountLocaleList(body.selectedTargetLocales, 'selectedTargetLocales');
    if (localeIssues.length) {
      return withSession(request, NextResponse.json(localeIssues, { status: 422 }), current.value.setCookies);
    }

    const policyIssues = validateAccountLocalePolicy(body.localePolicy, 'localePolicy');
    if (policyIssues.length) {
      return withSession(request, NextResponse.json(policyIssues, { status: 422 }), current.value.setCookies);
    }

    const selectedTargetLocales = parseAccountLocaleListStrict(body.selectedTargetLocales);
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
    const entitlementGate = enforceLocaleSelection(policy, selectedTargetLocales);
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

    const params = new URLSearchParams({
      id: `eq.${current.value.authzPayload.accountId}`,
      select: 'id,selected_target_locales,locale_policy',
    });
    const upstream = await supabaseAdminFetch(`/rest/v1/accounts?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        selected_target_locales: selectedTargetLocales,
        locale_policy: localePolicy,
      }),
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

    const patchedRow = upstreamPayload[0] as AccountLocalePatchRow | undefined;
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

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        selectedTargetLocales: parseAccountLocaleListStrict(patchedRow.selected_target_locales),
        localePolicy: parseAccountLocalePolicyStrict(patchedRow.locale_policy),
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
