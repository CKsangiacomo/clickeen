import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { proxyToParisRoute } from '../../../../../../lib/api/paris/proxy-helpers';
import { resolveCorsHeaders } from '../../../../../../lib/api/cors';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

function validateParams(
  request: NextRequest,
  accountIdRaw: string,
  publicIdRaw: string,
): { ok: true; accountId: string; publicId: string } | { ok: false; response: NextResponse } {
  const corsHeaders = resolveCorsHeaders(request, 'GET,PUT,OPTIONS');
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
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(request, 'GET,PUT,OPTIONS') });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(request, accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: `/api/accounts/${encodeURIComponent(validated.accountId)}/instance/${encodeURIComponent(validated.publicId)}`,
    method: 'GET',
    corsHeaders: resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(request, accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: `/api/accounts/${encodeURIComponent(validated.accountId)}/instance/${encodeURIComponent(validated.publicId)}`,
    method: 'PUT',
    corsHeaders: resolveCorsHeaders(request, 'GET,PUT,OPTIONS'),
  });
}
