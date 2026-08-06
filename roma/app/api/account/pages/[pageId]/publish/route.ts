import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { publishAccountPage } from '@roma/lib/account-pages';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';
type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const access = resolvePageProductPolicy(current.value.authzPayload, 'publish_page');
  if (!access.ok) {
    return withSession(request, NextResponse.json(access.payload, { status: access.status }), current.value.setCookies);
  }
  const { pageId } = await context.params;
  if (!isCompactPageId(pageId)) {
    return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalidPageId' } }, { status: 422 }), current.value.setCookies);
  }
  const result = await publishAccountPage({
    accountId: current.value.authzPayload.accountPublicId,
    pageId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok ? NextResponse.json({ ok: true, ...result.value }) : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}
