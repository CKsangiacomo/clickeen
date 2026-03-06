import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { proxyToParisRoute } from '../../../../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ accountId: string; publicId: string; locale: string }> };

function validateParams(
  accountIdRaw: string,
  publicIdRaw: string,
  localeRaw: string,
): { ok: true; accountId: string; publicId: string; locale: string } | { ok: false; response: NextResponse } {
  const accountId = String(accountIdRaw || '').trim();
  if (!isUuid(accountId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422, headers: CORS_HEADERS },
      ),
    };
  }
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422, headers: CORS_HEADERS },
      ),
    };
  }
  const locale = String(localeRaw || '').trim();
  if (!locale) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.locales.invalid' } },
        { status: 422, headers: CORS_HEADERS },
      ),
    };
  }
  return { ok: true, accountId, publicId, locale };
}

function resolvePath(accountId: string, publicId: string, locale: string): string {
  return `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
    publicId,
  )}/layers/user/${encodeURIComponent(locale)}`;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw, locale: localeRaw } = await context.params;
  const validated = validateParams(accountIdRaw, publicIdRaw, localeRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: resolvePath(validated.accountId, validated.publicId, validated.locale),
    method: 'PUT',
    corsHeaders: CORS_HEADERS,
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw, locale: localeRaw } = await context.params;
  const validated = validateParams(accountIdRaw, publicIdRaw, localeRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: resolvePath(validated.accountId, validated.publicId, validated.locale),
    method: 'DELETE',
    corsHeaders: CORS_HEADERS,
  });
}
