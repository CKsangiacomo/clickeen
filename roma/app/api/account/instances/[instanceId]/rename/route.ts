import { NextRequest, NextResponse } from 'next/server';
import {
  loadTokyoAccountInstanceDocument,
  saveAccountInstanceDirect,
} from '@roma/lib/account-instance-direct';
import { readJsonPayloadOrValidation, requireInstanceIdParam } from '@roma/lib/route-helpers';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ instanceId: string }> };

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountPublicId;
  const instanceId = await requireInstanceIdParam(context);
  if (typeof instanceId !== 'string') {
    return withSession(
      request,
      NextResponse.json({ error: instanceId.error }, { status: instanceId.status }),
      current.value.setCookies,
    );
  }
  const bodyResult = await readJsonPayloadOrValidation<{ displayName?: unknown } | null>(request);
  if (!bodyResult.ok) {
    return withSession(
      request,
      NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status }),
      current.value.setCookies,
    );
  }
  const body = bodyResult.payload;

  const displayName = normalizeDisplayName(body?.displayName);
  if (!displayName) {
    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'coreui.errors.payload.invalid',
            detail: 'displayName must be a non-empty string with at most 120 characters',
          },
        },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

  const currentInstance = await loadTokyoAccountInstanceDocument({
    accountId,
    instanceId,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (!currentInstance.ok) {
    const status =
      currentInstance.status === 401
        ? 401
        : currentInstance.status === 403
          ? 403
          : currentInstance.status === 404
            ? 404
            : currentInstance.status === 422
              ? 422
              : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 404
            ? 'NOT_FOUND'
            : status === 422
              ? 'VALIDATION'
              : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: currentInstance.error.reasonKey, detail: currentInstance.error.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const result = await saveAccountInstanceDirect({
    accountId,
    instanceId,
    widgetType: currentInstance.value.row.widgetType,
    config: currentInstance.value.config,
    displayName,
    meta: currentInstance.value.row.meta ?? null,
    accountCapsule: current.value.authzToken,
    requestId: current.value.requestId,
  });
  if (result.ok === false) {
    const status =
      result.status === 401
        ? 401
        : result.status === 403
          ? 403
          : result.status === 404
            ? 404
            : result.status === 422
              ? 422
              : 502;
    const kind =
      status === 401
        ? 'AUTH'
        : status === 403
          ? 'DENY'
          : status === 404
            ? 'NOT_FOUND'
            : status === 422
              ? 'VALIDATION'
              : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: result.error.reasonKey, detail: result.error.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      instanceId,
      displayName,
    }),
    current.value.setCookies,
  );
}
