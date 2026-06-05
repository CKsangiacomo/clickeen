import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountPageFromTokyo,
  loadAccountPageFromTokyo,
  saveAccountPageInTokyo,
} from '@roma/lib/account-page-direct';
import type { TokyoAccountPageSource } from '@roma/lib/account-page-direct';
import { readJsonPayloadOrValidation } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ pageId: string }> };

async function requirePageIdParam(context: RouteContext) {
  const { pageId: rawPageId } = await context.params;
  const pageId = typeof rawPageId === 'string' ? rawPageId.trim().toUpperCase() : '';
  if (pageId) return pageId;
  return {
    ok: false as const,
    status: 422,
    error: { kind: 'VALIDATION' as const, reasonKey: 'coreui.errors.page.invalidPageId' },
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
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
  const result = await loadAccountPageFromTokyo({
    accountId,
    pageId,
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
  if (!result.value) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.page.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }
  return withSession(
    request,
    NextResponse.json({ accountId, pageId, source: result.value.source, publishStatus: result.value.publishStatus }),
    current.value.setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
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

  const bodyResult = await readJsonPayloadOrValidation<{ source?: TokyoAccountPageSource } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  if (!bodyResult.payload?.source || typeof bodyResult.payload.source !== 'object' || Array.isArray(bodyResult.payload.source)) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.sourceInvalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const sourceId = typeof bodyResult.payload.source.id === 'string' ? bodyResult.payload.source.id.trim().toUpperCase() : '';
  if (sourceId !== pageId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalidPageId' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const accountId = current.value.authzPayload.accountPublicId;
  const result = await saveAccountPageInTokyo({
    accountId,
    pageId,
    source: bodyResult.payload.source,
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
    NextResponse.json({
      accountId,
      pageId,
      source: result.value.source,
      summary: result.value.summary,
    }),
    current.value.setCookies,
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
  let deleted: { existed: boolean };
  try {
    deleted = await deleteAccountPageFromTokyo({
      accountId,
      pageId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail,
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ accountId, pageId, deleted: deleted.existed, existed: deleted.existed }),
    current.value.setCookies,
  );
}
