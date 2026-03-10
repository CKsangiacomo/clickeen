import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import {
  resolveParisSession,
  withParisDevAuthorization,
  withSessionAndCors,
} from '../../../../../../../lib/api/paris/proxy-helpers';
import { resolveCorsHeaders } from '../../../../../../../lib/api/cors';
import { resolveParisBaseUrl } from '../../../../../../../lib/env/paris';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateParams(
  request: NextRequest,
  accountIdRaw: string,
  publicIdRaw: string,
): { ok: true; accountId: string; publicId: string } | { ok: false; response: NextResponse } {
  const corsHeaders = resolveCorsHeaders(request, 'GET,OPTIONS');
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422, headers: corsHeaders },
      ),
    };
  }
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422, headers: corsHeaders },
      ),
    };
  }
  return { ok: true, accountId, publicId };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(request, 'GET,OPTIONS') });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(request, accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;

  const session = await resolveParisSession(request);
  if (!session.ok) {
    return withSessionAndCors(request, session.response, undefined, resolveCorsHeaders(request, 'GET,OPTIONS'));
  }

  let parisBaseUrl: string;
  try {
    parisBaseUrl = resolveParisBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'INTERNAL', reasonKey: 'coreui.errors.misconfigured', detail: message } },
        { status: 500, headers: resolveCorsHeaders(request, 'GET,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,OPTIONS'),
    );
  }

  const headers = withParisDevAuthorization(new Headers(), session.accessToken);
  headers.set('accept', 'application/json');
  const authzCapsule = request.headers.get('x-ck-authz-capsule');
  if (authzCapsule) headers.set('x-ck-authz-capsule', authzCapsule);

  const upstreamUrl = new URL(
    `${parisBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(validated.accountId)}/instances/${encodeURIComponent(validated.publicId)}/localization`,
  );
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });
    const payload = (await upstream.json().catch(() => null)) as unknown;
    if (!upstream.ok) {
      return withSessionAndCors(
        request,
        NextResponse.json(
          isRecord(payload) ? payload : { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'PARIS_PROXY_ERROR' } },
          { status: upstream.status, headers: resolveCorsHeaders(request, 'GET,OPTIONS') },
        ),
        session.setCookies,
        resolveCorsHeaders(request, 'GET,OPTIONS'),
      );
    }

    if (!isRecord(payload) || !('localization' in payload)) {
      return withSessionAndCors(
        request,
        NextResponse.json(
          { error: { kind: 'UPSTREAM_INVALID', reasonKey: 'coreui.errors.instance.localizationMissing' } },
          { status: 502, headers: resolveCorsHeaders(request, 'GET,OPTIONS') },
        ),
        session.setCookies,
        resolveCorsHeaders(request, 'GET,OPTIONS'),
      );
    }

    return withSessionAndCors(
      request,
      NextResponse.json(
        { localization: payload.localization },
        { status: 200, headers: resolveCorsHeaders(request, 'GET,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,OPTIONS'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withSessionAndCors(
      request,
      NextResponse.json(
        { error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'PARIS_PROXY_ERROR', detail: message } },
        { status: 502, headers: resolveCorsHeaders(request, 'GET,OPTIONS') },
      ),
      session.setCookies,
      resolveCorsHeaders(request, 'GET,OPTIONS'),
    );
  }
}
