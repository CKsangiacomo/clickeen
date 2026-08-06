import { NextRequest, NextResponse } from 'next/server';
import { listPageCatalog } from '@roma/lib/account-catalog';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const result = await listPageCatalog({ accountId: current.value.authzPayload.accountPublicId, accountCapsule: current.value.authzToken, requestId: current.value.requestId });
  return withSession(request, result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}
