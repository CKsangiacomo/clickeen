import { NextRequest, NextResponse } from 'next/server';
import { normalizeLocaleToken } from '@clickeen/l10n';
import { materializeAccountAdditionalLocales } from '@roma/lib/account-locales';
import { runAccountLocalesAftermath } from '@roma/lib/account-locales-aftermath';
import { parseAccountL10nPolicyStrict, parseAccountLocaleListStrict } from '@roma/lib/account-l10n';
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

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(
      `${berlinBase}/v1/accounts/${encodeURIComponent(current.value.authzPayload.accountId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${current.value.accessToken}`,
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
      return withSession(
        request,
        NextResponse.json(
          payload ?? {
            error: {
              kind: upstream.status === 401 ? 'AUTH' : 'UPSTREAM_UNAVAILABLE',
              reasonKey:
                upstream.status === 401
                  ? 'coreui.errors.auth.required'
                  : 'coreui.errors.auth.contextUnavailable',
            },
          },
          { status: upstream.status },
        ),
        current.value.setCookies,
      );
    }

    const locales = parseAccountLocaleListStrict(payload?.account?.l10nLocales);
    const policy = parseAccountL10nPolicyStrict(payload?.account?.l10nPolicy);

    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        locales,
        policy,
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
    const aftermathWarnings = await runAccountLocalesAftermath({
      accountId: current.value.authzPayload.accountId,
      accessToken: current.value.accessToken,
      policyProfile: current.value.authzPayload.profile,
      accountCapsule: current.value.authzToken,
    });
    const mergedWarnings = Array.from(new Set([...warnings, ...aftermathWarnings]));

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
