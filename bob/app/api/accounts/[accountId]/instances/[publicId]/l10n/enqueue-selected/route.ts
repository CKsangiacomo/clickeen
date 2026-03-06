import { NextRequest, NextResponse } from 'next/server';
import { isUuid } from '@clickeen/ck-contracts';
import { proxyToParisRoute } from '../../../../../../../../lib/api/paris/proxy-helpers';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-request-id',
} as const;

type RouteContext = { params: Promise<{ accountId: string; publicId: string }> };

function validateParams(accountIdRaw: string, publicIdRaw: string): { ok: true; accountId: string; publicId: string } | { ok: false; response: NextResponse } {
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
  return { ok: true, accountId, publicId };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { accountId: accountIdRaw, publicId: publicIdRaw } = await context.params;
  const validated = validateParams(accountIdRaw, publicIdRaw);
  if (!validated.ok) return validated.response;
  return proxyToParisRoute(request, {
    path: `/api/accounts/${encodeURIComponent(validated.accountId)}/instances/${encodeURIComponent(validated.publicId)}/l10n/enqueue-selected`,
    method: 'POST',
    corsHeaders: CORS_HEADERS,
  });
}
