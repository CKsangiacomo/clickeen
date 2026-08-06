import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { NextRequest, NextResponse } from 'next/server';
import { resolvePageProductPolicy } from '@roma/lib/account-page-policy';
import { renameAccountPage } from '@roma/lib/account-pages';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ pageId: string }> };

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value && value === value.trim() && value.length <= 120 ? value : null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;
  const access = resolvePageProductPolicy(current.value.authzPayload, 'save_page');
  if (!access.ok) {
    return withSession(
      request,
      NextResponse.json(access.payload, { status: access.status }),
      current.value.setCookies,
    );
  }
  const { pageId } = await context.params;
  if (!isCompactPageId(pageId)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalidPageId' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const body = await readJsonPayloadOrValidation<{ displayName?: unknown } | null>(request);
  if (!body.ok) {
    return withSession(
      request,
      NextResponse.json({ error: body.error }, { status: body.status }),
      current.value.setCookies,
    );
  }
  const displayName = normalizeDisplayName(body.payload?.displayName);
  if (!displayName) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const result = await renameAccountPage({
    accountId: current.value.authzPayload.accountPublicId,
    pageId,
    displayName,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok
      ? NextResponse.json(result.value)
      : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}
