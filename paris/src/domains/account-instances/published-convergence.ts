import type { Policy } from '@clickeen/ck-policy';
import { computeBaseFingerprint } from '@clickeen/l10n';
import type { AccountRow, Env } from '../../shared/types';
import { resolveAccountL10nPolicy } from '../../shared/l10n';
import {
  buildLocaleTextPacks,
  resolveLocaleOverlayOps,
  stripTextFromConfig,
} from '../../shared/text-packs';
import {
  enqueueConfigPack,
  enqueueLiveSurfaceSync,
  enqueueLocaleMetaPacks,
  enqueueLocaleTextPacks,
  logMirrorEnqueueError,
  logMirrorEnqueueFailures,
} from '../../shared/tokyo-mirror-jobs';
import { jsonSha256Hex } from '../../shared/stable-json';
import { isSeoGeoLive } from '../../shared/seo-geo';
import { loadInstanceOverlays } from '../l10n/service';
import {
  buildReadyLocalePolicy,
  enqueueTokyoMirrorJob,
  resolveActivePublishLocales,
  resolveMaterializableLocalesForFingerprint,
  waitForTokyoReadyLocalesForFingerprint,
} from './service';

export async function convergePublishedInstanceSurface(args: {
  env: Env;
  account: AccountRow;
  policy: Policy;
  publicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  baseTextPack: Record<string, string>;
  writeTextPacks: boolean;
  writeConfigPack: boolean;
  syncLiveSurface?: boolean;
  context: string;
}): Promise<string | null> {
  const accountL10nPolicy = resolveAccountL10nPolicy(args.account.l10n_policy);
  const baseLocale = accountL10nPolicy.baseLocale;
  const publishLocales = resolveActivePublishLocales({
    accountLocales: args.account.l10n_locales,
    baseLocale,
  });
  const desiredLocales = publishLocales.locales;
  const baseFingerprint = await computeBaseFingerprint(args.baseTextPack);
  const materializableLocales = await resolveMaterializableLocalesForFingerprint({
    env: args.env,
    publicId: args.publicId,
    desiredLocales,
    baseLocale,
    baseFingerprint,
  });
  const seoGeoLive = isSeoGeoLive({
    policy: args.policy,
    config: args.config,
  });
  const writeMetaPacks = seoGeoLive && (args.writeTextPacks || args.writeConfigPack);
  const syncLiveSurface = args.syncLiveSurface ?? args.writeConfigPack;
  let consumerCandidateLocales = materializableLocales.slice();

  let localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }> | null = null;
  if (args.writeTextPacks || writeMetaPacks) {
    const { localeOpsByLocale, userOpsByLocale } = await resolveLocaleOverlayOps({
      loadRows: () => loadInstanceOverlays(args.env, args.publicId),
      locales: materializableLocales,
      baseFingerprint,
      warnMessage: '[ParisWorker] Failed to resolve locale overlays for published convergence',
      warnContext: {
        publicId: args.publicId,
        context: args.context,
      },
    });

    localeTextPacks = buildLocaleTextPacks({
      locales: materializableLocales,
      baseLocale,
      basePack: args.baseTextPack,
      localeOpsByLocale,
      userOpsByLocale,
    });
  }

  if (args.writeTextPacks && localeTextPacks) {
    const failures = await enqueueLocaleTextPacks({
      publicId: args.publicId,
      baseFingerprint,
      localeTextPacks,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueFailures({
      kind: 'write-text-pack',
      failures,
      context: args.context,
    });
    if (failures.length) {
      if (failures.some((failure) => failure.locale === baseLocale)) {
        return `[${args.context}:text-pack] ${failures[0]?.error || 'enqueue failed'}`;
      }
      const failedLocales = new Set(failures.map((failure) => failure.locale));
      consumerCandidateLocales = consumerCandidateLocales.filter((locale) => !failedLocales.has(locale));
    }
  }

  const nextConfigPack = stripTextFromConfig(args.config, Object.keys(args.baseTextPack));
  const nextConfigFp = await jsonSha256Hex(nextConfigPack);

  if (writeMetaPacks && localeTextPacks) {
    const candidateTextPacks = localeTextPacks.filter(({ locale }) => consumerCandidateLocales.includes(locale));
    const failures = await enqueueLocaleMetaPacks({
      publicId: args.publicId,
      widgetType: args.widgetType,
      configPack: nextConfigPack,
      localeTextPacks: candidateTextPacks,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueFailures({
      kind: 'write-meta-pack',
      failures,
      context: args.context,
    });
    if (failures.length) {
      if (failures.some((failure) => failure.locale === baseLocale)) {
        return `[${args.context}:meta-pack] ${failures[0]?.error || 'enqueue failed'}`;
      }
      const failedLocales = new Set(failures.map((failure) => failure.locale));
      consumerCandidateLocales = consumerCandidateLocales.filter((locale) => !failedLocales.has(locale));
    }
  }

  if (args.writeConfigPack) {
    const configError = await enqueueConfigPack({
      publicId: args.publicId,
      widgetType: args.widgetType,
      configFp: nextConfigFp,
      configPack: nextConfigPack,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueError({
      kind: 'write-config-pack',
      error: configError,
      context: args.context,
    });
    if (configError) {
      return `[${args.context}:config-pack] ${configError}`;
    }

  }

  if (syncLiveSurface) {
    const consumerReadyLocales =
      args.writeTextPacks && consumerCandidateLocales.length > 0
        ? await waitForTokyoReadyLocalesForFingerprint({
            env: args.env,
            publicId: args.publicId,
            desiredLocales,
            baseLocale,
            baseFingerprint,
            targetLocales: consumerCandidateLocales,
          })
        : await waitForTokyoReadyLocalesForFingerprint({
            env: args.env,
            publicId: args.publicId,
            desiredLocales,
            baseLocale,
            baseFingerprint,
            timeoutMs: 0,
          });
    const liveLocalePolicy = buildReadyLocalePolicy({
      accountL10nPolicy,
      readyLocales: consumerReadyLocales,
    });
    const syncError = await enqueueLiveSurfaceSync({
      publicId: args.publicId,
      widgetType: args.widgetType,
      configFp: nextConfigFp,
      localePolicy: liveLocalePolicy,
      seoGeo: seoGeoLive,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueError({
      kind: 'sync-live-surface',
      error: syncError,
      context: args.context,
    });
    if (syncError) {
      return `[${args.context}:live-sync] ${syncError}`;
    }
  }

  return null;
}
