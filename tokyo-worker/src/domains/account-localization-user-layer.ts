import { normalizeLocalizationOps, type LocalizationOp } from '@clickeen/ck-contracts';
import type { AllowlistEntry } from '@clickeen/l10n';
import { json } from '../http';
import type { Env } from '../types';
import { deleteL10nOverlay, upsertL10nOverlay } from './l10n-authoring';
import { buildLocaleMirrorPayload } from './account-localization-mirror';
import {
  filterAllowlistedOps,
  parseBearerToken,
} from './account-localization-utils';
import {
  loadAccountLocalizationSnapshotData,
  loadBaseTextPack,
  loadWidgetAllowlist,
} from './account-localization-state';

function validateUserOps(
  raw: unknown,
  allowlist: AllowlistEntry[],
): LocalizationOp[] | null {
  const normalized = normalizeLocalizationOps(raw);
  if (!Array.isArray(raw) || normalized.length !== raw.length) return null;
  const filtered = filterAllowlistedOps(normalized, allowlist);
  if (filtered.length !== normalized.length) return null;
  return filtered;
}

async function loadEffectiveUserLayerContext(args: {
  env: Env;
  accessToken: string;
  accountId: string;
  publicId: string;
  locale: string;
}): Promise<{
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  userAllowlist: AllowlistEntry[];
  baseConfig: Record<string, unknown>;
  baseLocale: string;
  baseTextPack: Record<string, string>;
  localeOps: LocalizationOp[];
  userOps: LocalizationOp[];
  published: boolean;
  seoGeoLive: boolean;
}> {
  const snapshot = await loadAccountLocalizationSnapshotData(args);
  const userAllowlist = await loadWidgetAllowlist({
    env: args.env,
    widgetType: snapshot.widgetType,
    path: 'user-layer',
  });
  const overlay =
    snapshot.snapshot.localeOverlays.find((entry) => entry.locale === args.locale) ?? null;
  return {
    widgetType: snapshot.widgetType,
    baseFingerprint: snapshot.baseFingerprint,
    baseUpdatedAt: snapshot.saved.updatedAt,
    userAllowlist,
    baseConfig: snapshot.saved.config,
    baseLocale: snapshot.snapshot.baseLocale,
    baseTextPack: await loadBaseTextPack({
      env: args.env,
      publicId: args.publicId,
      baseFingerprint: snapshot.baseFingerprint,
    }),
    localeOps: overlay?.baseOps ?? [],
    userOps: overlay?.userOps ?? [],
    published: snapshot.saved.published,
    seoGeoLive: snapshot.saved.seoGeoLive,
  };
}

export async function handleUpsertAccountUserLayer(
  req: Request,
  env: Env,
  publicId: string,
  accountId: string,
  locale: string,
): Promise<Response> {
  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as { ops?: unknown } | null;
  const contextData = await loadEffectiveUserLayerContext({
    env,
    accessToken,
    accountId,
    publicId,
    locale,
  });

  const nextUserOps = validateUserOps(body?.ops, contextData.userAllowlist);
  if (!nextUserOps) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.l10n.invalid' } },
      { status: 422 },
    );
  }

  const mirror = contextData.published
    ? buildLocaleMirrorPayload({
        widgetType: contextData.widgetType,
        baseConfig: contextData.baseConfig,
        baseLocale: contextData.baseLocale,
        locale,
        baseTextPack: contextData.baseTextPack,
        baseOps: contextData.localeOps,
        userOps: nextUserOps,
        seoGeoLive: contextData.seoGeoLive,
      })
    : { textPack: null, metaPack: null };

  if (nextUserOps.length === 0) {
    await deleteL10nOverlay({
      env,
      publicId,
      layer: 'user',
      layerKey: locale,
      baseFingerprint: contextData.baseFingerprint,
      ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });
    return json({
      publicId,
      layer: 'user',
      layerKey: locale,
      deleted: true,
      baseFingerprint: contextData.baseFingerprint,
      baseUpdatedAt: contextData.baseUpdatedAt,
    });
  }

  await upsertL10nOverlay({
    env,
    publicId,
    layer: 'user',
    layerKey: locale,
    baseFingerprint: contextData.baseFingerprint,
    baseUpdatedAt: contextData.baseUpdatedAt,
    ops: nextUserOps,
    ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
    ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
  });

  return json({
    publicId,
    layer: 'user',
    layerKey: locale,
    source: 'user',
    baseFingerprint: contextData.baseFingerprint,
    baseUpdatedAt: contextData.baseUpdatedAt,
  });
}

export async function handleDeleteAccountUserLayer(
  req: Request,
  env: Env,
  publicId: string,
  accountId: string,
  locale: string,
): Promise<Response> {
  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json(
      { error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } },
      { status: 401 },
    );
  }

  const contextData = await loadEffectiveUserLayerContext({
    env,
    accessToken,
    accountId,
    publicId,
    locale,
  });

  const mirror = contextData.published
    ? buildLocaleMirrorPayload({
        widgetType: contextData.widgetType,
        baseConfig: contextData.baseConfig,
        baseLocale: contextData.baseLocale,
        locale,
        baseTextPack: contextData.baseTextPack,
        baseOps: contextData.localeOps,
        userOps: [],
        seoGeoLive: contextData.seoGeoLive,
      })
    : { textPack: null, metaPack: null };

  await deleteL10nOverlay({
    env,
    publicId,
    layer: 'user',
    layerKey: locale,
    baseFingerprint: contextData.baseFingerprint,
    ...(mirror.textPack ? { textPack: mirror.textPack } : {}),
    ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
  });

  return json({
    publicId,
    layer: 'user',
    layerKey: locale,
    deleted: true,
    baseFingerprint: contextData.baseFingerprint,
    baseUpdatedAt: contextData.baseUpdatedAt,
  });
}
