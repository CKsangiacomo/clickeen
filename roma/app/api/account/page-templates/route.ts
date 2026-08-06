import { NextRequest, NextResponse } from 'next/server';
import { listAccountPageSources } from '@roma/lib/account-pages';
import { resolveCurrentAccountRouteContext, withSession } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;
  const accountId = current.value.authzPayload.accountPublicId;
  const result = await listAccountPageSources({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  return withSession(
    request,
    result.ok
      ? NextResponse.json({
          accountId,
          templates: result.value.sources.filter((source) => source.isTemplate),
        })
      : NextResponse.json({ error: result.error }, { status: result.status }),
    current.value.setCookies,
  );
}
