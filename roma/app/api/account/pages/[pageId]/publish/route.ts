import { NextRequest, NextResponse } from 'next/server';
import {
  loadAccountPageFromTokyo,
  publishAccountPageInTokyo,
} from '@roma/lib/account-page-direct';
import {
  listAccountInstancesInTokyo,
} from '@roma/lib/account-instance-direct';
import {
  resolveCurrentAccountRouteContext,
  withSession,
} from '../../../_lib/current-account-route';

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

function routeKind(status: number): 'AUTH' | 'DENY' | 'VALIDATION' | 'UPSTREAM_UNAVAILABLE' {
  if (status === 401) return 'AUTH';
  if (status === 403) return 'DENY';
  if (status === 422) return 'VALIDATION';
  return 'UPSTREAM_UNAVAILABLE';
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
  const page = await loadAccountPageFromTokyo({
    accountId,
    pageId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!page.ok) {
    return withSession(
      request,
      NextResponse.json({ error: page.error }, { status: page.status }),
      current.value.setCookies,
    );
  }
  if (!page.value) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.page.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }
  if (page.value.source.placements.length < 1) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.page.empty' } },
        { status: 409 },
      ),
      current.value.setCookies,
    );
  }

  const accountInstances = await listAccountInstancesInTokyo({
    accountId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!accountInstances.ok) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: routeKind(accountInstances.status),
            reasonKey: accountInstances.error.reasonKey,
            detail: accountInstances.error.detail,
          },
        },
        { status: accountInstances.status },
      ),
      current.value.setCookies,
    );
  }

  const instanceStatusById = new Map(
    accountInstances.value.accountInstances.map((instance) => [instance.instanceId, instance.publishStatus]),
  );
  const blockingInstanceIds = Array.from(
    new Set(
      page.value.source.placements
        .map((placement) => placement.instanceId)
        .filter((instanceId) => instanceStatusById.get(instanceId) !== 'published'),
    ),
  );
  if (blockingInstanceIds.length > 0) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.page.instanceBlocksPublish',
            detail: 'Page publish requires every placed instance to be published.',
            instanceIds: blockingInstanceIds,
          },
        },
        { status: 409 },
      ),
      current.value.setCookies,
    );
  }

  const result = await publishAccountPageInTokyo({
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
  return withSession(
    request,
    NextResponse.json({ accountId, pageId, publishStatus: result.value.publishStatus, changed: result.value.changed }),
    current.value.setCookies,
  );
}
