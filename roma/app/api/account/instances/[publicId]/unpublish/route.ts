import { NextRequest, NextResponse } from 'next/server';
import {
  deleteLiveSurfaceFromTokyo,
  loadTokyoAccountInstanceDocument,
  loadTokyoAccountInstanceLiveStatus,
} from '@roma/lib/account-instance-direct';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import { updateAccountInstanceStatusRow } from '@roma/lib/michael';
import { resolveCurrentAccountRouteContext, withSession } from '../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string }> };

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

  const currentInstance = await loadTokyoAccountInstanceDocument({
    accountId,
    publicId,
    tokyoAccessToken: current.value.accessToken,
    accountCapsule: current.value.authzToken,
  });
  if (!currentInstance.ok) {
    return withSession(
      request,
      NextResponse.json({ error: currentInstance.error }, { status: currentInstance.status }),
      current.value.setCookies,
    );
  }

  const liveStatus = await loadTokyoAccountInstanceLiveStatus({
    tokyoBaseUrl: resolveTokyoBaseUrl(),
    publicId,
  });
  if (!liveStatus.ok) {
    return withSession(
      request,
      NextResponse.json({ error: liveStatus.error }, { status: liveStatus.status }),
      current.value.setCookies,
    );
  }

  if (liveStatus.value === 'unpublished') {
    return withSession(
      request,
      NextResponse.json({ ok: true, publicId, status: 'unpublished', changed: false }),
      current.value.setCookies,
    );
  }

  const unpublishWrite = await updateAccountInstanceStatusRow({
    accountId,
    publicId,
    status: 'unpublished',
    berlinAccessToken: current.value.accessToken,
  });
  if (!unpublishWrite.ok) {
    const status = unpublishWrite.status === 401 ? 401 : unpublishWrite.status === 404 ? 404 : 502;
    const kind = status === 401 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE';
    return withSession(
      request,
      NextResponse.json(
        { error: { kind, reasonKey: unpublishWrite.reasonKey, detail: unpublishWrite.detail } },
        { status },
      ),
      current.value.setCookies,
    );
  }

  try {
    await deleteLiveSurfaceFromTokyo({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      tokyoAccessToken: current.value.accessToken,
      accountId,
      publicId,
      accountCapsule: current.value.authzToken,
    });
  } catch (error) {
    await updateAccountInstanceStatusRow({
      accountId,
      publicId,
      status: 'published',
      berlinAccessToken: current.value.accessToken,
    }).catch(() => undefined);

    return withSession(
      request,
      NextResponse.json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        { status: 502 },
      ),
      current.value.setCookies,
    );
  }

  return withSession(
    request,
    NextResponse.json({ ok: true, publicId, status: 'unpublished', changed: true }),
    current.value.setCookies,
  );
}
