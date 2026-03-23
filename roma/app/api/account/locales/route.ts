import { NextRequest, NextResponse } from 'next/server';
import { parseAccountL10nPolicyStrict, parseAccountLocaleListStrict } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { loadAccountBaseLocaleLockState } from '@roma/lib/account-base-locale-lock';
import { materializeAccountAdditionalLocales } from '@roma/lib/account-locales';
import { runAccountLocalesSync } from '@roma/lib/account-locales-sync';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type AccountLocalesWritePayload = {
  locales?: unknown;
  policy?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
}

async function loadCurrentAccountLocalesState(args: {
  accessToken: string;
  accountId: string;
}): Promise<
  | {
      ok: true;
      locales: string[];
      policy: ReturnType<typeof parseAccountL10nPolicyStrict>;
    }
  | {
      ok: false;
      status: number;
      payload: unknown;
      detail?: string;
    }
> {
  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const upstream = await fetch(
    `${berlinBase}/v1/accounts/${encodeURIComponent(args.accountId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const payload = (await upstream.json().catch(() => null)) as
    | {
        account?: {
          l10nLocales?: unknown;
          l10nPolicy?: unknown;
        } | null;
        error?: unknown;
      }
    | null;

  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      payload,
      detail: `berlin_account_http_${upstream.status}`,
    };
  }

  return {
    ok: true,
    locales: parseAccountLocaleListStrict(payload?.account?.l10nLocales),
    policy: parseAccountL10nPolicyStrict(payload?.account?.l10nPolicy),
  };
}

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  try {
    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
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
      accountId: current.value.authzPayload.accountId,
      berlinAccessToken: current.value.accessToken,
      tokyoAccessToken: current.value.accessToken,
      accountCapsule: current.value.authzToken,
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
        locales: accountState.locales,
        policy: accountState.policy,
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
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const contentType = request.headers.get('content-type') || 'application/json';

  try {
    let body: AccountLocalesWritePayload | null = null;
    try {
      body = (await request.json()) as AccountLocalesWritePayload | null;
    } catch {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
          { status: 422 },
        ),
        current.value.setCookies,
      );
    }

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

    const baseLocale = normalizeLocaleToken((body.policy as Record<string, unknown> | null | undefined)?.baseLocale);
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

    const accountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
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
      accountId: current.value.authzPayload.accountId,
      berlinAccessToken: current.value.accessToken,
      tokyoAccessToken: current.value.accessToken,
      accountCapsule: current.value.authzToken,
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
    if (baseLocaleLock.locked && baseLocale !== accountState.policy.baseLocale) {
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

    const nextPayload: AccountLocalesWritePayload = {
      ...body,
      locales: materializeAccountAdditionalLocales({
        profile: current.value.authzPayload.profile,
        baseLocale,
        requestedLocales: body.locales,
      }),
    };

    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}/locales`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
          ...(contentType ? { 'content-type': contentType } : {}),
          accept: request.headers.get('accept') || 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(nextPayload),
      },
    );
    const payloadText = (await upstream.text().catch(() => '')) || '';
    if (!upstream.ok) {
      return withSession(
        request,
        new NextResponse(payloadText, {
          status: upstream.status,
          headers: {
            'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
          },
        }),
        current.value.setCookies,
      );
    }

    const upstreamPayload = payloadText ? (JSON.parse(payloadText) as unknown) : null;
    const warnings = isRecord(upstreamPayload) ? normalizeWarnings(upstreamPayload.warnings) : [];
    const syncWarnings = await runAccountLocalesSync({
      accountId: current.value.authzPayload.accountId,
      accessToken: current.value.accessToken,
      accountCapsule: current.value.authzToken,
    });
    const mergedWarnings = Array.from(new Set([...warnings, ...syncWarnings]));

    const responsePayload = isRecord(upstreamPayload)
      ? {
          ...upstreamPayload,
          ...(mergedWarnings.length ? { warnings: mergedWarnings } : {}),
        }
      : {
          ...(mergedWarnings.length ? { warnings: mergedWarnings } : {}),
        };

    return withSession(
      request,
      NextResponse.json(responsePayload, { status: 200 }),
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
