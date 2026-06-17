import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentAccountRouteContext, withSession } from './_lib/current-account-route';

export const runtime = 'edge';

export async function DELETE(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'owner' });
  if (!current.ok) return current.response;

  const response = NextResponse.json(
    {
      error: {
        kind: 'CONFLICT',
        reasonKey: 'coreui.errors.account.deleteUnavailable',
        detail: 'account_deletion_disabled',
      },
    },
    { status: 409 },
  );
  return withSession(request, response, current.value.setCookies);
}
