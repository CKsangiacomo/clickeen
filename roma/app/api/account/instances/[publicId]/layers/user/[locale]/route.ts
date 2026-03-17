import { NextRequest, NextResponse } from 'next/server';
import {
  buildLocaleMirrorPayload,
  deleteTokyoOverlay,
  loadEffectiveUserLayerContext,
  upsertTokyoOverlay,
  validateUserOps,
  writeTokyoBaseSnapshot,
} from '@roma/lib/account-l10n';
import { resolveBerlinBaseUrl } from '@roma/lib/env/berlin';
import { resolveTokyoBaseUrl } from '@roma/lib/env/tokyo';
import { resolveCurrentAccountRouteContext, withSession } from '../../../../../_lib/current-account-route';

export const runtime = 'edge';

type RouteContext = { params: Promise<{ publicId: string; locale: string }> };

async function resolveRouteContext(
  request: NextRequest,
  context: RouteContext,
  minRole: 'editor' | 'viewer',
) {
  const current = await resolveCurrentAccountRouteContext({ request, minRole });
  if (!current.ok) return { ok: false as const, response: current.response };

  const { publicId: publicIdRaw, locale: localeRaw } = await context.params;
  const publicId = String(publicIdRaw || '').trim();
  const locale = String(localeRaw || '').trim().toLowerCase();
  if (!publicId || !locale) {
    return {
      ok: false as const,
      response: withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        current.value.setCookies,
      ),
    };
  }

  return {
    ok: true as const,
    current,
    accountId: current.value.authzPayload.accountId,
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
      resolved.current.value.setCookies,
    );
  }

  try {
    const contextData = await loadEffectiveUserLayerContext({
      berlinBaseUrl: resolveBerlinBaseUrl(),
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
      accountCapsule: resolved.current.value.authzToken,
    });

    const validatedOps = validateUserOps(body?.ops, contextData.userAllowlist);
    if (!validatedOps) {
      return withSession(
        request,
        NextResponse.json(
          { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' } },
          { status: 422 },
        ),
        resolved.current.value.setCookies,
      );
    }

    const nextUserOps = validatedOps;
    const mirror = contextData.published
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
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      accountCapsule: resolved.current.value.authzToken,
      baseFingerprint: contextData.baseFingerprint,
      baseTextPack: contextData.baseTextPack,
    });

    if (nextUserOps.length === 0) {
      await deleteTokyoOverlay({
        tokyoBaseUrl: resolveTokyoBaseUrl(),
        accessToken: resolved.current.value.accessToken,
        accountId: resolved.accountId,
        publicId: resolved.publicId,
        accountCapsule: resolved.current.value.authzToken,
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
        resolved.current.value.setCookies,
      );
    }

    await upsertTokyoOverlay({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      accountCapsule: resolved.current.value.authzToken,
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
      resolved.current.value.setCookies,
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
      resolved.current.value.setCookies,
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
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      locale: resolved.locale,
      accountCapsule: resolved.current.value.authzToken,
    });

    const mirror = contextData.published
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

    await writeTokyoBaseSnapshot({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      accountCapsule: resolved.current.value.authzToken,
      baseFingerprint: contextData.baseFingerprint,
      baseTextPack: contextData.baseTextPack,
    });

    await deleteTokyoOverlay({
      tokyoBaseUrl: resolveTokyoBaseUrl(),
      accessToken: resolved.current.value.accessToken,
      accountId: resolved.accountId,
      publicId: resolved.publicId,
      accountCapsule: resolved.current.value.authzToken,
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
      resolved.current.value.setCookies,
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
      resolved.current.value.setCookies,
    );
  }
}
