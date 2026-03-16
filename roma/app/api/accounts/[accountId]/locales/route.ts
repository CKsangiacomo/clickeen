import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import { applySessionCookies, resolveSessionBearer, type SessionCookieSpec } from '@roma/lib/auth/session';
import { runAccountLocalesAftermath } from '@roma/lib/account-locales-aftermath';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';

export const runtime = 'edge';
// Same-origin relay only: Roma browser/session cookies terminate on Next, so account UI calls Berlin through this thin host proxy.

type RouteContext = { params: Promise<{ accountId: string }> };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function normalizeLocaleList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const token = entry.trim();
    if (!token) continue;
    normalized.push(token);
  }
  return Array.from(new Set(normalized));
}

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

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  try {
    const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
    const upstream = await fetch(`${berlinBase}/v1/accounts/${encodeURIComponent(accountId)}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    });
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
        session.setCookies,
      );
    }

    const locales = normalizeLocaleList(payload?.account?.l10nLocales);
    const policy =
      payload?.account?.l10nPolicy &&
      typeof payload.account.l10nPolicy === 'object' &&
      !Array.isArray(payload.account.l10nPolicy)
        ? payload.account.l10nPolicy
        : null;

    return withSession(
      request,
      NextResponse.json({
        accountId,
        locales,
        policy,
      }),
      session.setCookies,
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
      session.setCookies,
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return withNoStore(session.response);

  const { accountId: accountIdRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      session.setCookies,
    );
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole: 'editor',
  });
  if (!authz.ok) {
    return withSession(
      request,
      NextResponse.json({ error: authz.error }, { status: authz.status }),
      session.setCookies,
    );
  }

  const berlinBase = resolveBerlinBaseUrl().replace(/\/+$/, '');
  const contentType = request.headers.get('content-type');

  try {
    const upstream = await fetch(`${berlinBase}/v1/accounts/${encodeURIComponent(accountId)}/locales`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        ...(contentType ? { 'content-type': contentType } : {}),
        accept: request.headers.get('accept') || 'application/json',
      },
      cache: 'no-store',
      body: await request.text(),
    });
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
        session.setCookies,
      );
    }

    const upstreamPayload = payloadText ? (JSON.parse(payloadText) as unknown) : null;
    const warnings = isRecord(upstreamPayload) ? normalizeWarnings(upstreamPayload.warnings) : [];
    const aftermathWarnings = await runAccountLocalesAftermath({
      accountId,
      accessToken: session.accessToken,
    });
    const mergedWarnings = Array.from(new Set([...warnings, ...aftermathWarnings]));

    const responsePayload = isRecord(upstreamPayload)
      ? {
          ...upstreamPayload,
          ...(mergedWarnings.length ? { warnings: mergedWarnings } : {}),
        }
      : {
          accountId,
          ...(mergedWarnings.length ? { warnings: mergedWarnings } : {}),
        };

    return withSession(
      request,
      NextResponse.json(responsePayload, { status: upstream.status }),
      session.setCookies,
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
      session.setCookies,
    );
  }
}
