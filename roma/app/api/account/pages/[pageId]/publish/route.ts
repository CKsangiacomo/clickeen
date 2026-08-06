import { NextRequest, NextResponse } from 'next/server';
import { isCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ pageId: string }> };

async function requirePageIdParam(context: RouteContext) {
  const { pageId: rawPageId } = await context.params;
  if (isCompactPageId(rawPageId)) return rawPageId;
  return {
    ok: false as const,
    status: 422,
    error: { kind: 'VALIDATION' as const, reasonKey: 'coreui.errors.page.invalidPageId' },
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const pageId = await requirePageIdParam(context);
  if (typeof pageId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: pageId.error }, { status: pageId.status }),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  return withSession(
    request,
    NextResponse.json(
      {
        accountId,
        pageId,
        error: {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.page.publishUnavailable',
          detail: 'Page publishing requires Roma page package generation before publish can be enabled.',
        },
      },
      { status: 422 },
    ),
    current.value.setCookies,
  );
}
