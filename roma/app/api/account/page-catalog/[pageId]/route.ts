import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { readPageCatalogTemplate } from '@roma/lib/account-catalog';
import { resolveCurrentAccountRouteContext, withSession } from '../../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest, context: { params: Promise<{ pageId: string }> }) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const { pageId } = await context.params;
  if (!isCompactPageId(pageId)) return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.page.invalidPageId' } }, { status: 422 }), current.value.setCookies);
  const result = await readPageCatalogTemplate({ accountId: current.value.authzPayload.accountPublicId, accountCapsule: current.value.authzToken, requestId: current.value.requestId, pageId });
  return withSession(request, result.ok ? NextResponse.json(result.value) : NextResponse.json({ error: result.error }, { status: result.status }), current.value.setCookies);
}
