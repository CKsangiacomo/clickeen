import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAccountInstanceFromTokyo,
  saveAccountInstanceInTokyo,
} from '@roma/lib/account-instance-direct';
import { readWidgetMaterializerArtifact } from '@roma/generated/widget-materializer-artifacts';
import { prepareAccountInstanceSourceArtifacts } from '@roma/lib/account-instance-source-artifacts';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import {
  resolveCurrentAccountRouteContext,
  withSession,
  type CurrentAccountRouteContext,
} from '../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

type RouteFailureLike = {
  ok: false;
  status: number;
  error: {
    kind: string;
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

function routeFailureResponse(
  request: NextRequest,
  failure: RouteFailureLike,
  setCookies: CurrentAccountRouteContext['setCookies'],
) {
  return withSession(
    request,
    NextResponse.json({ error: failure.error }, { status: failure.status }),
    setCookies,
  );
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }
  const bodyResult = await readJsonPayloadOrValidation<{
    widgetType: string;
    config: Record<string, unknown>;
  }>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const { widgetType, config } = bodyResult.payload;

  const compiled = readWidgetMaterializerArtifact(widgetType);
  if (!compiled) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  const sourceArtifacts = prepareAccountInstanceSourceArtifacts({
    accountId,
    instanceId,
    widgetType,
    config,
    editableFields: compiled.editableFields,
    initialStatus: 'changed',
  });

  const result = await saveAccountInstanceInTokyo({
    accountId,
    instanceId,
    config: sourceArtifacts.config,
    content: sourceArtifacts.content,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });

  if (!result.ok) {
    return routeFailureResponse(request, result, current.value.setCookies);
  }
  return withSession(
    request,
    NextResponse.json({
      ok: true,
      updatedAt: result.updatedAt,
      publishStatus: result.publishStatus,
    }),
    current.value.setCookies,
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context, { mode: 'normalized' });
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }

  let deleted: Awaited<ReturnType<typeof deleteAccountInstanceFromTokyo>>;
  try {
    deleted = await deleteAccountInstanceFromTokyo({
      accountId,
      instanceId,
      accountCapsule: current.value.authzToken,
      requestId: current.value.requestId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[roma account instance current route] tokyo cleanup failed', {
      accountId,
      instanceId,
      detail,
    });
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
  if (!deleted.ok) {
    return routeFailureResponse(request, deleted, current.value.setCookies);
  }

  return withSession(
    request,
    NextResponse.json({
      accountId,
      instanceId,
      deleted: deleted.value.existed,
      existed: deleted.value.existed,
    }),
    current.value.setCookies,
  );
}
