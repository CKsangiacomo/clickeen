import { NextRequest, NextResponse } from 'next/server';
import {
  createAccountPageInTokyo,
  listAccountPagesInTokyo,
} from '@roma/lib/account-page-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../_lib/current-account-route';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const result = await listAccountPagesInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }
  return withSession(
    request,
    NextResponse.json({ accountId, pages: result.value.pages }),
    current.value.setCookies,
  );
}

export async function POST(request: NextRequest) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const bodyResult = await readJsonPayloadOrValidation<{ head?: unknown; placements?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const result = await createAccountPageInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    head: bodyResult.payload?.head && typeof bodyResult.payload.head === 'object' && !Array.isArray(bodyResult.payload.head)
      ? bodyResult.payload.head
      : null,
    placements: Array.isArray(bodyResult.payload?.placements) ? bodyResult.payload.placements : undefined,
    requestId: current.value.requestId,
  });
  if (!result.ok) {
    return withSession(
      request,
      NextResponse.json({ error: result.error }, { status: result.status }),
      current.value.setCookies,
    );
  }
  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        pageId: result.value.source.id,
        source: result.value.source,
        summary: result.value.summary,
      },
      { status: 201 },
    ),
    current.value.setCookies,
  );
}
