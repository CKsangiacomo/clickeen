import {
  resolvePolicyFromEntitlementsSnapshot,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { normalizeLocaleToken } from '@clickeen/l10n';
import {
  collectConfigMediaAssetIds,
  isUuid,
  materializeConfigMedia,
  type LocalizationOp,
  normalizeWidgetLocaleSwitcherSettings,
} from '@clickeen/ck-contracts';
import {
  buildAccountAssetVersionPath,
  normalizePublicId,
  normalizeSha256Hex,
  prettyStableJson,
  sha256Hex,
} from '../asset-utils';
import { json } from '../http';
import type { Env } from '../types';
import { loadAccountAssetManifestByIdentity } from './assets';
import {
  buildLocaleMirrorPayload,
  generateLocaleOpsWithSanfrancisco,
  loadOverlayOps,
  normalizeReadyLocales,
} from './account-localization';
import { upsertL10nOverlay } from './l10n-authoring';
import {
  type SyncInstanceOverlaysJob,
  ensureSavedRenderL10nBase,
  loadSavedRenderL10nBase,
  readSavedRenderConfig,
  resolveTokyoPublicBaseUrl,
  syncLiveSurface,
  writeSavedRenderL10nState,
  writeConfigPack,
  type LocalePolicy,
} from './render';
import {
  acceptWidgetTranslationState,
  isCurrentWidgetTranslationGeneration,
  markWidgetTranslationFinished,
  markWidgetTranslationWorking,
} from './translation-state';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type SyncAuthzSnapshot = Pick<
  RomaAccountAuthzCapsulePayload,
  'profile' | 'role' | 'entitlements'
>;

type SyncL10nIntent = {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
};

function normalizeCountryToLocale(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [countryRaw, localeRaw] of Object.entries(raw as Record<string, unknown>)) {
    const country = countryRaw.trim().toUpperCase();
    const locale = normalizeLocaleToken(localeRaw);
    if (!/^[A-Z]{2}$/.test(country) || !locale) continue;
    out[country] = locale;
  }
  return out;
}

function normalizeSyncL10nIntent(raw: unknown): SyncL10nIntent | null {
  const record = asRecord(raw);
  if (!record) return null;
  const baseLocale = normalizeLocaleToken(record.baseLocale) ?? '';
  const desiredLocales = normalizeReadyLocales({
    baseLocale,
    locales: Array.isArray(record.desiredLocales) ? record.desiredLocales : [],
  });
  if (!baseLocale || !desiredLocales.includes(baseLocale)) return null;
  const countryToLocale = normalizeCountryToLocale(record.countryToLocale);
  return {
    baseLocale,
    desiredLocales,
    countryToLocale,
  };
}

function diffL10nSnapshots(args: {
  previous: Record<string, string>;
  current: Record<string, string>;
}): { changedPaths: string[]; removedPaths: string[] } {
  return {
    changedPaths: Object.keys(args.current)
      .filter((path) => args.previous[path] !== args.current[path])
      .sort(),
    removedPaths: Object.keys(args.previous)
      .filter((path) => !Object.prototype.hasOwnProperty.call(args.current, path))
      .sort(),
  };
}

function buildLiveLocalePolicy(args: {
  baseLocale: string;
  readyLocales: string[];
  countryToLocale: Record<string, string>;
  config: Record<string, unknown>;
}): LocalePolicy {
  const localeSwitcher = normalizeWidgetLocaleSwitcherSettings(args.config.localeSwitcher);
  const readySet = new Set(args.readyLocales);
  const countryToLocale = Object.fromEntries(
    Object.entries(args.countryToLocale || {}).filter(([, locale]) =>
      readySet.has(locale),
    ),
  );
  const alwaysShowLocale =
    localeSwitcher.byIp === true || !localeSwitcher.alwaysShowLocale || !readySet.has(localeSwitcher.alwaysShowLocale)
      ? undefined
      : localeSwitcher.alwaysShowLocale;

  return {
    baseLocale: args.baseLocale,
    readyLocales: args.readyLocales,
    ip: {
      enabled: localeSwitcher.byIp === true,
      countryToLocale: localeSwitcher.byIp === true ? countryToLocale : {},
    },
    switcher: {
      enabled: localeSwitcher.enabled === true,
      ...(alwaysShowLocale ? { alwaysShowLocale } : {}),
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

export async function syncAccountInstance(args: {
  env: Env;
  accountId: string;
  publicId: string;
  live: boolean;
  previousBaseFingerprint?: string | null;
  accountAuthz: SyncAuthzSnapshot;
  l10nIntent: SyncL10nIntent;
}): Promise<{
  ok: true;
  publicId: string;
  widgetType: string;
  live: boolean;
  baseFingerprint: string;
  readyLocales: string[];
  configFp?: string;
}> {
  const saved = await readSavedRenderConfig({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
  });
  if (!saved.ok) {
    throw new Error(saved.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : saved.reasonKey);
  }

  const l10nBase = await ensureSavedRenderL10nBase({
    env: args.env,
    publicId: args.publicId,
    widgetType: saved.value.pointer.widgetType,
    config: saved.value.config,
    existingBaseFingerprint: saved.value.pointer.l10n?.baseFingerprint ?? null,
  });
  const baseFingerprint = l10nBase.baseFingerprint;
  const localizationAllowlist = l10nBase.allowlist;
  const baseTextPack = l10nBase.snapshot;
  const sourceBaseFingerprint =
    args.previousBaseFingerprint && args.previousBaseFingerprint !== baseFingerprint
      ? args.previousBaseFingerprint
      : baseFingerprint;
  const previousL10nBase =
    sourceBaseFingerprint !== baseFingerprint
      ? await loadSavedRenderL10nBase({
          env: args.env,
          publicId: args.publicId,
          widgetType: saved.value.pointer.widgetType,
          baseFingerprint: sourceBaseFingerprint,
        })
      : null;
  const snapshotDiff =
    sourceBaseFingerprint !== baseFingerprint
      ? previousL10nBase
        ? diffL10nSnapshots({
            previous: previousL10nBase.snapshot,
            current: baseTextPack,
          })
        : { changedPaths: null as string[] | null, removedPaths: [] as string[] }
      : { changedPaths: [] as string[], removedPaths: [] as string[] };

  const baseLocale = args.l10nIntent.baseLocale;
  const desiredLocales = normalizeReadyLocales({
    baseLocale,
    locales: args.l10nIntent.desiredLocales,
  });
  const nonBaseLocales = desiredLocales.filter((locale) => locale !== baseLocale);

  const existingLocaleOverlays = new Map(
    await Promise.all(
      nonBaseLocales.map(async (locale) => {
        const baseOverlay = await loadOverlayOps({
          env: args.env,
          publicId: args.publicId,
          layer: 'locale',
          layerKey: locale,
          baseFingerprint: sourceBaseFingerprint,
          allowlist: localizationAllowlist,
        });
        return [
          locale,
          {
            baseOps: baseOverlay.ops,
            hasSourceOverlay: baseOverlay.baseUpdatedAt !== null || baseOverlay.ops.length > 0,
          },
        ] as const;
      }),
    ),
  );

  const localesWithSourceOps = nonBaseLocales.filter(
    (locale) => existingLocaleOverlays.get(locale)?.hasSourceOverlay === true,
  );
  const localesNeedingFullGeneration = nonBaseLocales.filter(
    (locale) => existingLocaleOverlays.get(locale)?.hasSourceOverlay !== true,
  );
  const generatedBaseOpsByLocale = new Map<string, LocalizationOp[]>();
  const incompleteLocales = new Set<string>();
  const localeAllowlist = localizationAllowlist.map((entry) => ({
    path: entry.path,
    type: entry.type === 'richtext' ? 'richtext' : 'string',
  })) as Array<{ path: string; type: 'string' | 'richtext' }>;

  if (
    localesWithSourceOps.length > 0 &&
    (sourceBaseFingerprint !== baseFingerprint ||
      snapshotDiff.changedPaths === null ||
      snapshotDiff.changedPaths.length > 0 ||
      snapshotDiff.removedPaths.length > 0)
  ) {
    const incremental = await generateLocaleOpsWithSanfrancisco({
      env: args.env,
      policyProfile: args.accountAuthz.profile,
      widgetType: saved.value.pointer.widgetType,
      config: saved.value.config,
      allowlist: localeAllowlist,
      baseLocale,
      targetLocales: localesWithSourceOps,
      existingBaseOpsByLocale: Object.fromEntries(
        localesWithSourceOps.map((locale) => [
          locale,
          existingLocaleOverlays.get(locale)?.baseOps ?? [],
        ]),
      ) as Record<string, LocalizationOp[]>,
      changedPaths: snapshotDiff.changedPaths,
      removedPaths: snapshotDiff.removedPaths,
    });
    incremental.forEach((ops, locale) => {
      generatedBaseOpsByLocale.set(locale, ops);
    });
    localesWithSourceOps
      .filter((locale) => !incremental.has(locale))
      .forEach((locale) => incompleteLocales.add(locale));
  } else {
    localesWithSourceOps.forEach((locale) => {
      generatedBaseOpsByLocale.set(locale, existingLocaleOverlays.get(locale)?.baseOps ?? []);
    });
  }

  if (localesNeedingFullGeneration.length > 0) {
    const full = await generateLocaleOpsWithSanfrancisco({
      env: args.env,
      policyProfile: args.accountAuthz.profile,
      widgetType: saved.value.pointer.widgetType,
      config: saved.value.config,
      allowlist: localeAllowlist,
      baseLocale,
      targetLocales: localesNeedingFullGeneration,
      existingBaseOpsByLocale: Object.fromEntries(
        localesNeedingFullGeneration.map((locale) => [locale, []]),
      ) as Record<string, LocalizationOp[]>,
      changedPaths: null,
      removedPaths: [],
    });
    full.forEach((ops, locale) => {
      generatedBaseOpsByLocale.set(locale, ops);
    });
    localesNeedingFullGeneration
      .filter((locale) => !full.has(locale))
      .forEach((locale) => incompleteLocales.add(locale));
  }

  const policyResolved = resolvePolicyFromEntitlementsSnapshot({
    profile: args.accountAuthz.profile,
    role: args.accountAuthz.role,
    entitlements: args.accountAuthz.entitlements ?? null,
  });
  const seoGeoConfig = asRecord(saved.value.config.seoGeo);
  const seoGeoEnabled =
    args.live &&
    policyResolved.flags['embed.seoGeo.enabled'] === true &&
    seoGeoConfig?.enabled === true;

  const readyLocales = desiredLocales.filter(
    (locale) => locale === baseLocale || !incompleteLocales.has(locale),
  );

  for (const locale of desiredLocales) {
    if (locale !== baseLocale && incompleteLocales.has(locale)) {
      continue;
    }
    const existing = existingLocaleOverlays.get(locale);
    const baseOps = locale === baseLocale ? [] : generatedBaseOpsByLocale.get(locale) ?? existing?.baseOps ?? [];

    const mirror = buildLocaleMirrorPayload({
      widgetType: saved.value.pointer.widgetType,
      baseConfig: saved.value.config,
      baseLocale,
      locale,
      baseTextPack,
      baseOps,
      seoGeoLive: seoGeoEnabled,
    });

    await upsertL10nOverlay({
      env: args.env,
      publicId: args.publicId,
      layer: 'locale',
      layerKey: locale,
      baseFingerprint,
      baseUpdatedAt: saved.value.pointer.updatedAt,
      ops: baseOps,
      textPack: mirror.textPack,
      ...(mirror.metaPack ? { metaPack: mirror.metaPack } : {}),
    });
  }

  await writeSavedRenderL10nState({
    env: args.env,
    publicId: args.publicId,
    accountId: args.accountId,
    baseFingerprint,
    summary: {
      baseLocale,
      desiredLocales,
    },
  });

  let configFp: string | null = null;
  if (args.live) {
    const runtimeConfigPack = await materializeRuntimeConfigPack({
      env: args.env,
      accountId: args.accountId,
      config: saved.value.config,
    });
    configFp = await (async () => {
      const bytes = new TextEncoder().encode(prettyStableJson(runtimeConfigPack));
      const nextConfigFp = await sha256Hex(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      await writeConfigPack(args.env, {
        v: 1,
        kind: 'write-config-pack',
        publicId: args.publicId,
        widgetType: saved.value.pointer.widgetType,
        configFp: nextConfigFp,
        configPack: runtimeConfigPack,
      });
      return nextConfigFp;
    })();

    const localePolicy = buildLiveLocalePolicy({
      baseLocale,
      readyLocales,
      countryToLocale: args.l10nIntent.countryToLocale,
      config: saved.value.config,
    });
    await syncLiveSurface(args.env, {
      v: 1,
      kind: 'sync-live-surface',
      publicId: args.publicId,
      live: true,
      widgetType: saved.value.pointer.widgetType,
      configFp,
      localePolicy,
      seoGeo: seoGeoEnabled,
    });
  }

  return {
    ok: true,
    publicId: args.publicId,
    widgetType: saved.value.pointer.widgetType,
    live: args.live,
    baseFingerprint,
    readyLocales,
    ...(configFp ? { configFp } : {}),
  };
}

export async function runQueuedAccountInstanceSync(
  env: Env,
  job: SyncInstanceOverlaysJob,
  _args?: { attempt?: number | null },
): Promise<void> {
  const currentGeneration = await isCurrentWidgetTranslationGeneration({
    env,
    publicId: job.publicId,
    accountId: job.accountId,
    generationId: job.generationId,
  });
  if (!currentGeneration) {
    return;
  }
  const current = await readSavedRenderConfig({
    env,
    publicId: job.publicId,
    accountId: job.accountId,
  });
  if (!current.ok) {
    throw new Error(current.kind === 'NOT_FOUND' ? 'tokyo_saved_not_found' : current.reasonKey);
  }
  const currentBaseFingerprint = normalizeSha256Hex(current.value.pointer.l10n?.baseFingerprint);
  if (!currentBaseFingerprint) {
    throw new Error('tokyo_saved_l10n_base_missing');
  }
  if (currentBaseFingerprint !== job.baseFingerprint) {
    return;
  }

  await markWidgetTranslationWorking({
    env,
    publicId: job.publicId,
    accountId: job.accountId,
    generationId: job.generationId,
  });

  const result = await syncAccountInstance({
    env,
    accountId: job.accountId,
    publicId: job.publicId,
    live: job.live === true,
    previousBaseFingerprint: job.previousBaseFingerprint ?? null,
    accountAuthz: job.accountAuthz,
    l10nIntent: {
      baseLocale: job.baseLocale,
      desiredLocales: job.desiredLocales,
      countryToLocale: job.countryToLocale,
    },
  });
  await markWidgetTranslationFinished({
    env,
    publicId: job.publicId,
    accountId: job.accountId,
    generationId: job.generationId,
    readyLocales: result.readyLocales,
  });
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
  const previousBaseFingerprint =
    body && Object.prototype.hasOwnProperty.call(body, 'previousBaseFingerprint')
      ? normalizeSha256Hex(body.previousBaseFingerprint)
      : null;
  if (
    body &&
    Object.prototype.hasOwnProperty.call(body, 'previousBaseFingerprint') &&
    body.previousBaseFingerprint !== null &&
    !previousBaseFingerprint
  ) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
      { status: 422 },
    );
  }
  const l10nIntent = normalizeSyncL10nIntent(body?.l10nIntent);
  if (!l10nIntent) {
    return json(
      { error: { kind: 'VALIDATION', reasonKey: 'tokyo.errors.render.invalid' } },
      { status: 422 },
    );
  }

  try {
    const result = await syncAccountInstance({
      env,
      accountId,
      publicId,
      live,
      previousBaseFingerprint,
      accountAuthz: {
        profile: accountAuthz.profile,
        role: accountAuthz.role,
        entitlements: accountAuthz.entitlements ?? null,
      },
      l10nIntent,
    });
    const accepted = await acceptWidgetTranslationState({
      env,
      publicId,
      accountId,
      widgetType: result.widgetType,
      baseLocale: l10nIntent.baseLocale,
      requestedLocales: l10nIntent.desiredLocales,
      baseFingerprint: result.baseFingerprint,
    });
    await markWidgetTranslationFinished({
      env,
      publicId,
      accountId,
      generationId: accepted.generationId,
      readyLocales: result.readyLocales,
    });
    return json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail === 'tokyo_saved_not_found') {
      return json({ error: { kind: 'NOT_FOUND', reasonKey: detail } }, { status: 404 });
    }
    return json({ error: { kind: 'VALIDATION', reasonKey: detail } }, { status: 422 });
  }
}
