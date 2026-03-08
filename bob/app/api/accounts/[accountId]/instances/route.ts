import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { proxyToParisRoute } from '../../../../../lib/api/paris/proxy-helpers';
import { resolveCorsHeaders } from '../../../../../lib/api/cors';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string }> };

function validateAccountId(request: NextRequest, accountIdRaw: string): { ok: true; accountId: string } | { ok: false; response: NextResponse } {
  const corsHeaders = resolveCorsHeaders(request, 'POST,OPTIONS');
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
  return { ok: true, accountId };
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(request, 'POST,OPTIONS') });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw } = await context.params;
  const validated = validateAccountId(request, accountIdRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: `/api/accounts/${encodeURIComponent(validated.accountId)}/instances`,
    method: 'POST',
    corsHeaders: resolveCorsHeaders(request, 'POST,OPTIONS'),
  });
}
