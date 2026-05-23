import { NextRequest, NextResponse } from 'next/server';
import { isRecord } from '@clickeen/ck-contracts';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { loadAccountBaseLocaleLockState } from '@roma/lib/account-base-locale-lock';
import { loadCurrentAccountLocalesState } from '@roma/lib/account-locales-state';
import { resolveSelectedTargetLocales } from '@roma/lib/account-locales';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

type AccountLocalesWritePayload = {
  selectedTargetLocales?: unknown;
  localePolicy?: unknown;
};

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
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const contentType = request.headers.get('content-type') || 'application/json';

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

    const baseLocale = normalizeLocaleToken((body.localePolicy as Record<string, unknown> | null | undefined)?.baseLocale);
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

    const nextPayload: AccountLocalesWritePayload = {
      ...body,
      selectedTargetLocales: resolveSelectedTargetLocales({
        profile: current.value.authzPayload.profile,
        baseLocale,
        requestedLocales: body.selectedTargetLocales,
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
    const refreshedAccountState = await loadCurrentAccountLocalesState({
      accessToken: current.value.accessToken,
      accountId: current.value.authzPayload.accountId,
      requestId: current.value.requestId,
    });
    if (!refreshedAccountState.ok) {
      return withSession(
        request,
        NextResponse.json(
          refreshedAccountState.payload ?? {
            error: {
              kind: refreshedAccountState.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                refreshedAccountState.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: refreshedAccountState.status },
        ),
        current.value.setCookies,
      );
    }
    const mergedWarnings = Array.from(new Set(warnings));

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
