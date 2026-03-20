import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountInstanceCoreRow,
  renameAccountInstanceRow,
} from '@roma/lib/michael';
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

  const currentInstance = await getAccountInstanceCoreRow(accountId, publicId, current.value.accessToken);
  if (!currentInstance.ok) {
    const status = currentInstance.status === 401 ? 401 : currentInstance.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: currentInstance.reasonKey, detail: currentInstance.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  const result = await renameAccountInstanceRow({
    accountId,
    publicId,
    displayName,
    berlinAccessToken: current.value.accessToken,
  });
  if (!result.ok) {
    const status = result.status === 401 ? 401 : result.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: result.reasonKey, detail: result.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  if (!result.row) {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' } },
        { status: 404 },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({
      publicId: result.row.publicId,
      displayName: result.row.displayName || 'Untitled widget',
      status: result.row.status,
    }),
    current.value.setCookies,
  );
}
