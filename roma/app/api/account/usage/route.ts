import { NextRequest, NextResponse } from 'next/server';
import { readAccountStorageBytesUsed } from '@roma/lib/account-storage-usage';
import { withSession } from '../_lib/current-account-route';
import { resolveCurrentAccountRouteContext } from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({
    request,
    minRole: 'viewer',
  });
  if (!current.ok) return current.response;

  try {
    const storageBytesUsed = await readAccountStorageBytesUsed({
      accountId: current.value.authzPayload.accountId,
      accountCapsule: current.value.authzToken,
    });
    return withSession(
      request,
      NextResponse.json({
        accountId: current.value.authzPayload.accountId,
        storageBytesUsed,
      }),
      current.value.setCookies,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.readFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }
}
