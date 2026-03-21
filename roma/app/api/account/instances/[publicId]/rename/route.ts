import { NextRequest, NextResponse } from 'next/server';
import { classifyWidgetPublicId } from '@clickeen/ck-contracts';
import {
  loadTokyoAccountInstanceDocument,
  saveAccountInstanceDirect,
} from '@roma/lib/account-instance-direct';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole: 'editor' });
  if (!current.ok) return current.response;

  const accountId = current.value.authzPayload.accountId;
  const { publicId: publicIdRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  if (!publicId) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.publicIdRequired' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }
  if (classifyWidgetPublicId(publicId) !== 'user') {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' } },
        { status: 403 },
      ),
      current.value.setCookies,
    );
  }

  let body: { displayName?: unknown } | null = null;
  try {
    body = (await request.json()) as { displayName?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      current.value.setCookies,
    );
  }

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
    publicId,
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
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
    publicId,
    widgetType: currentInstance.value.row.widgetType,
    config: currentInstance.value.config,
    displayName,
    source: currentInstance.value.row.source,
    meta: currentInstance.value.row.meta ?? null,
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
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
      publicId,
      displayName,
    }),
    current.value.setCookies,
  );
}
