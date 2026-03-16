import { NextRequest, NextResponse } from 'next/server';
import { authorizeRequestAccountRoleFromCapsule } from '@roma/lib/account-authz-capsule';
import {
  applySessionCookies,
  resolveSessionBearer,
  type SessionCookieSpec,
} from '@roma/lib/auth/session';
import { buildLocaleMirrorPayload, deleteTokyoOverlay, loadEffectiveUserLayerContext, upsertTokyoOverlay, validateUserOps, writeTokyoBaseSnapshot } from '@roma/lib/account-l10n';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ accountId: string; publicId: string; locale: string }> };

function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  response.headers.set('cdn-cache-control', 'no-store');
  response.headers.set('cloudflare-cdn-cache-control', 'no-store');
  return response;
}

function withSession(
  request: NextRequest,
  response: NextResponse,
  setCookies?: SessionCookieSpec[],
): NextResponse {
  return withNoStore(applySessionCookies(response, request, setCookies));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveRouteContext(
  request: NextRequest,
  context: RouteContext,
  minRole: 'editor' | 'viewer',
) {
  const session = await resolveSessionBearer(request);
  if (!session.ok) return { ok: false as const, response: withNoStore(session.response) };

  const { accountId: accountIdRaw, publicId: publicIdRaw, locale: localeRaw } = await context.params;
  const accountId = String(accountIdRaw || '').trim();
  const publicId = String(publicIdRaw || '').trim();
  const locale = String(localeRaw || '').trim().toLowerCase();
  if (!isUuid(accountId)) {
    return {
      ok: false as const,
      response: withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
          { status: 422 },
        ),
        session.setCookies,
      ),
    };
  }
  if (!publicId || !locale) {
    return {
      ok: false as const,
      response: withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        session.setCookies,
      ),
    };
  }

  const authz = await authorizeRequestAccountRoleFromCapsule({
    request,
    accountId,
    minRole,
  });
  if (!authz.ok) {
    return {
      ok: false as const,
      response: withSession(
        request,
        NextResponse.json({ error: authz.error }, { status: authz.status }),
        session.setCookies,
      ),
    };
  }

  return {
    ok: true as const,
    session,
    accountId,
    publicId,
    locale,
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const resolved = await resolveRouteContext(request, context, 'editor');
  if (!resolved.ok) return resolved.response;

  let body: { ops?: unknown } | null = null;
  try {
    body = (await request.json()) as { ops?: unknown } | null;
  } catch {
    return withSession(
      request,
      NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        { status: 422 },
      ),
      resolved.session.setCookies,
    );
  }

  try {
    const contextData = await loadEffectiveUserLayerContext({
      berlinBaseUrl: resolveBerlinBaseUrl(),
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.session.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
    });

    const validatedOps = validateUserOps(body?.ops, contextData.userAllowlist);
    if (!validatedOps) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        resolved.session.setCookies,
      );
    }

    const nextUserOps = validatedOps;
    const mirror =
      contextData.published
        ? buildLocaleMirrorPayload({
            widgetType: contextData.widgetType,
            baseConfig: contextData.baseConfig,
            baseLocale: contextData.baseLocale,
            locale: resolved.locale,
            baseTextPack: contextData.baseTextPack,
            baseOps: contextData.localeOps,
            userOps: nextUserOps,
            seoGeoLive: contextData.seoGeoLive,
          })
        : { textPack: null, metaPack: null };

    await writeTokyoBaseSnapshot({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.session.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      baseFingerprint: contextData.baseFingerprint,
      baseTextPack: contextData.baseTextPack,
    });

    if (nextUserOps.length === 0) {
      await deleteTokyoOverlay({
        tokyoBaseUrl: resolveTokyoBaseUrl(),
        accessToken: resolved.session.accessToken,
        accountId: resolved.accountId,
        publicId: resolved.publicId,
        layer: 'user',
        layerKey: resolved.locale,
        baseFingerprint: contextData.baseFingerprint,
        ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
        ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
      });
      return withSession(
        request,
        NextResponse.json({
          publicId: resolved.publicId,
          layer: 'user',
          layerKey: resolved.locale,
          deleted: true,
          baseFingerprint: contextData.baseFingerprint,
          baseUpdatedAt: contextData.baseUpdatedAt,
        }),
        resolved.session.setCookies,
      );
    }

    await upsertTokyoOverlay({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.session.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      layer: 'user',
      layerKey: resolved.locale,
      baseFingerprint: contextData.baseFingerprint,
      baseUpdatedAt: contextData.baseUpdatedAt,
      ops: nextUserOps,
      ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });

    return withSession(
      request,
      NextResponse.json({
        publicId: resolved.publicId,
        layer: 'user',
        layerKey: resolved.locale,
        source: 'user',
        baseFingerprint: contextData.baseFingerprint,
        baseUpdatedAt: contextData.baseUpdatedAt,
      }),
      resolved.session.setCookies,
    );
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
      resolved.session.setCookies,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveRouteContext(request, context, 'editor');
  if (!resolved.ok) return resolved.response;

  try {
    const contextData = await loadEffectiveUserLayerContext({
      berlinBaseUrl: resolveBerlinBaseUrl(),
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.session.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
    });

    const mirror =
      contextData.published
        ? buildLocaleMirrorPayload({
            widgetType: contextData.widgetType,
            baseConfig: contextData.baseConfig,
            baseLocale: contextData.baseLocale,
            locale: resolved.locale,
            baseTextPack: contextData.baseTextPack,
            baseOps: contextData.localeOps,
            userOps: [],
            seoGeoLive: contextData.seoGeoLive,
          })
        : { textPack: null, metaPack: null };

    await deleteTokyoOverlay({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.session.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      layer: 'user',
      layerKey: resolved.locale,
      baseFingerprint: contextData.baseFingerprint,
      ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });

    return withSession(
      request,
      NextResponse.json({
        publicId: resolved.publicId,
        layer: 'user',
        layerKey: resolved.locale,
        deleted: true,
      }),
      resolved.session.setCookies,
    );
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
      resolved.session.setCookies,
    );
  }
}
