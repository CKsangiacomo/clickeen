import {
  resolvePolicyFromEntitlementsSnapshot,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import {
  collectConfigMediaAssetIds,
  isUuid,
  materializeConfigMedia,
  type AccountL10nPolicy,
  type LocalizationOp,
} from '@clickeen/ck-contracts';
import {
  buildAccountAssetVersionPath,
  normalizePublicId,
  prettyStableJson,
  sha256Hex,
} from '../asset-utils';
import { json } from '../http';
import type { Env } from '../types';
import { loadAccountAssetManifestByIdentity } from './assets';
import {
  buildLocaleMirrorPayload,
  generateLocaleOpsWithSanfrancisco,
  loadBaseTextPack,
  loadBerlinAccountL10nState,
  loadOverlayOps,
  normalizeReadyLocales,
  parseBearerToken,
} from './account-localization';
import { upsertL10nOverlay } from './l10n-authoring';
import {
  loadWidgetLocalizationAllowlist,
  readSavedRenderConfig,
  resolveTokyoPublicBaseUrl,
  syncLiveSurface,
  writeConfigPack,
  type LocalePolicy,
} from './render';

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function buildLiveLocalePolicy(args: {
  baseLocale: string;
  readyLocales: string[];
  policy: AccountL10nPolicy;
}): LocalePolicy {
  const readySet = new Set(args.readyLocales);
  const countryToLocale = Object.fromEntries(
    Object.entries(args.policy.ip.countryToLocale || {}).filter(([, locale]) =>
      readySet.has(locale),
    ),
  );
  const switcherLocales = (args.policy.switcher.locales || []).filter((locale) =>
    readySet.has(locale),
  );

  return {
    baseLocale: args.baseLocale,
    readyLocales: args.readyLocales,
    ip: {
      enabled: args.policy.ip.enabled === true,
      countryToLocale,
    },
    switcher: {
      enabled: args.policy.switcher.enabled !== false,
      ...(switcherLocales.length ? { locales: switcherLocales } : {}),
    },
  };
}

async function materializeRuntimeConfigPack(args: {
  env: Env;
  accountId: string;
  config: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const assetIds = Array.from(new Set(collectConfigMediaAssetIds(args.config)));
  if (!assetIds.length) {
    return structuredClone(args.config);
  }

  const publicBaseUrl = resolveTokyoPublicBaseUrl(args.env);
  if (!publicBaseUrl) {
    throw new Error('tokyo_public_base_missing');
  }

  const assetsById = new Map<string, { assetId: string; assetRef: string; url: string }>();

  for (const assetId of assetIds) {
    const manifest = await loadAccountAssetManifestByIdentity(args.env, args.accountId, assetId);
    if (!manifest?.key) {
      throw new Error(`tokyo_account_assets_resolve_missing:${assetId}`);
    }
    assetsById.set(assetId, {
      assetId,
      assetRef: manifest.key,
      url: `${publicBaseUrl}${buildAccountAssetVersionPath(manifest.key)}`,
    });
  }

  const materialized = materializeConfigMedia(args.config, assetsById);
  const materializedRecord = asRecord(materialized);
  if (!materializedRecord) {
    throw new Error('tokyo_account_assets_resolve_invalidMaterializedConfig');
  }
  return materializedRecord;
}

export async function handleSyncAccountInstance(
  req: Request,
  env: Env,
  publicIdRaw: string,
  accountId: string,
  accountAuthz: RomaAccountAuthzCapsulePayload,
): Promise<Response> {
  const publicId = normalizePublicId(publicIdRaw);
  if (!publicId || !isUuid(accountId)) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
      { status: 422 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const live = body?.live === true;
  if (body && Object.prototype.hasOwnProperty.call(body, 'live') && typeof body.live !== 'boolean') {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
      { status: 422 },
    );
  }

  const accessToken = parseBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return json({ error: { kind: 'DENY', reasonKey: 'AUTH_REQUIRED' } }, { status: 401 });
  }

  const saved = await readSavedRenderConfig({ env, publicId, accountId });
  if (!saved) {
    return json(
      { error: { kind: 'NOT_FOUND', reasonKey: 'tokyo.errors.render.notFound' } },
      { status: 404 },
    );
  }

  const baseFingerprint = saved.pointer.l10n?.baseFingerprint ?? null;
  if (!baseFingerprint) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'tokyo.errors.internal',
          detail: 'saved_pointer_missing_l10n_fingerprint',
        },
      },
      { status: 500 },
    );
  }

  const [{ accountLocales, policy }, localizationAllowlist, baseTextPack] = await Promise.all([
    loadBerlinAccountL10nState({
      env,
      accessToken,
      accountId,
    }),
    loadWidgetLocalizationAllowlist({
      env,
      widgetType: saved.pointer.widgetType,
    }),
    loadBaseTextPack({
      env,
      publicId,
      baseFingerprint,
    }),
  ]);

  const baseLocale = policy.baseLocale;
  const desiredLocales = normalizeReadyLocales({
    baseLocale,
    locales: accountLocales,
  });
  const nonBaseLocales = desiredLocales.filter((locale) => locale !== baseLocale);

  const existingLocaleOverlays = new Map(
    await Promise.all(
      nonBaseLocales.map(async (locale) => {
        const [baseOverlay, userOverlay] = await Promise.all([
          loadOverlayOps({
            env,
            publicId,
            layer: 'locale',
            layerKey: locale,
            baseFingerprint,
            allowlist: localizationAllowlist,
          }),
          loadOverlayOps({
            env,
            publicId,
            layer: 'user',
            layerKey: locale,
            baseFingerprint,
            allowlist: localizationAllowlist,
          }),
        ]);
        return [locale, { baseOps: baseOverlay.ops, userOps: userOverlay.ops }] as const;
      }),
    ),
  );

  const generatedBaseOpsByLocale =
    nonBaseLocales.length > 0
      ? await generateLocaleOpsWithSanfrancisco({
          env,
          policyProfile: accountAuthz.profile,
          widgetType: saved.pointer.widgetType,
          config: saved.config,
          allowlist: localizationAllowlist.map((entry) => ({
            path: entry.path,
            type: entry.type === 'richtext' ? 'richtext' : 'string',
          })),
          baseLocale,
          targetLocales: nonBaseLocales,
          existingBaseOpsByLocale: Object.fromEntries(
            nonBaseLocales.map((locale) => [locale, existingLocaleOverlays.get(locale)?.baseOps ?? []]),
          ) as Record<string, LocalizationOp[]>,
        })
      : new Map<string, LocalizationOp[]>();

  const policyResolved = resolvePolicyFromEntitlementsSnapshot({
    profile: accountAuthz.profile,
    role: accountAuthz.role,
    entitlements: accountAuthz.entitlements ?? null,
  });
  const seoGeoConfig = asRecord(saved.config.seoGeo);
  const seoGeoEnabled =
    live &&
    policyResolved.flags['embed.seoGeo.enabled'] === true &&
    seoGeoConfig?.enabled === true;

  for (const locale of desiredLocales) {
    const existing = existingLocaleOverlays.get(locale);
    const baseOps =
      locale === baseLocale
        ? []
        : generatedBaseOpsByLocale.get(locale) ?? existing?.baseOps ?? [];
    const userOps = locale === baseLocale ? [] : (existing?.userOps ?? []);

    const mirror = buildLocaleMirrorPayload({
      widgetType: saved.pointer.widgetType,
      baseConfig: saved.config,
      baseLocale,
      locale,
      baseTextPack,
      baseOps,
      userOps,
      seoGeoLive: seoGeoEnabled,
    });

    await upsertL10nOverlay({
      env,
      publicId,
      layer: 'locale',
      layerKey: locale,
      baseFingerprint,
      baseUpdatedAt: saved.pointer.updatedAt,
      ops: baseOps,
      textPack: mirror.textPack,
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });
  }

  let configFp: string | null = null;
  if (live) {
    const runtimeConfigPack = await materializeRuntimeConfigPack({
      env,
      accountId,
      config: saved.config,
    });
    configFp = await (async () => {
      const bytes = new TextEncoder().encode(prettyStableJson(runtimeConfigPack));
      const nextConfigFp = await sha256Hex(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      await writeConfigPack(env, {
        v: 1,
        kind: 'write-config-pack',
        publicId,
        widgetType: saved.pointer.widgetType,
        configFp: nextConfigFp,
        configPack: runtimeConfigPack,
      });
      return nextConfigFp;
    })();

    const localePolicy = buildLiveLocalePolicy({
      baseLocale,
      readyLocales: desiredLocales,
      policy,
    });
    await syncLiveSurface(env, {
      v: 1,
      kind: 'sync-live-surface',
      publicId,
      live: true,
      widgetType: saved.pointer.widgetType,
      configFp,
      localePolicy,
      seoGeo: seoGeoEnabled,
    });
  }

  return json({
    ok: true,
    publicId,
    live,
    baseFingerprint,
    readyLocales: desiredLocales,
    ...(configFp ? { configFp } : {}),
  });
}
