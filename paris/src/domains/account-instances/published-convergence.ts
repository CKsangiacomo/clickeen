import type { Policy } from '@clickeen/ck-policy';
import { computeBaseFingerprint } from '@clickeen/l10n';
import type { AccountRow, Env } from '../../shared/types';
import { resolveAccountL10nPolicy } from '../../shared/l10n';
import {
  buildLocaleTextPacks,
  enqueueConfigPack,
  enqueueLiveSurfaceSync,
  enqueueLocaleMetaPacks,
  enqueueLocaleTextPacks,
  logMirrorEnqueueError,
  logMirrorEnqueueFailures,
  resolveLocaleOverlayOps,
  stripTextFromConfig,
} from '../../shared/mirror-packs';
import { jsonSha256Hex } from '../../shared/stable-json';
import { isSeoGeoLive } from '../../shared/seo-geo';
import { loadInstanceOverlays } from '../l10n/service';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from './service';

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
  context: string;
}): Promise<string | null> {
  const accountL10nPolicy = resolveAccountL10nPolicy(args.account.l10n_policy);
  const baseLocale = accountL10nPolicy.baseLocale;
  const publishLocales = resolveActivePublishLocales({
    accountLocales: args.account.l10n_locales,
    policy: args.policy,
    baseLocale,
  });
  const availableLocales = publishLocales.locales;
  const countryToLocale = Object.fromEntries(
    Object.entries(accountL10nPolicy.ip.countryToLocale).filter(([, locale]) => availableLocales.includes(locale)),
  );
  const liveLocalePolicy = {
    baseLocale,
    availableLocales,
    ip: {
      enabled: accountL10nPolicy.ip.enabled,
      countryToLocale: accountL10nPolicy.ip.enabled ? countryToLocale : {},
    },
    switcher: {
      enabled: accountL10nPolicy.switcher.enabled,
    },
  };
  const seoGeoLive = isSeoGeoLive({
    policy: args.policy,
    config: args.config,
  });
  const writeMetaPacks = seoGeoLive && (args.writeTextPacks || args.writeConfigPack);

  let localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }> | null = null;
  if (args.writeTextPacks || writeMetaPacks) {
    const baseFingerprint = await computeBaseFingerprint(args.baseTextPack);
    const { localeOpsByLocale, userOpsByLocale } = await resolveLocaleOverlayOps({
      loadRows: () => loadInstanceOverlays(args.env, args.publicId),
      locales: availableLocales,
      baseFingerprint,
      warnMessage: '[ParisWorker] Failed to resolve locale overlays for published convergence',
      warnContext: {
        publicId: args.publicId,
        context: args.context,
      },
    });

    localeTextPacks = buildLocaleTextPacks({
      locales: availableLocales,
      baseLocale,
      basePack: args.baseTextPack,
      localeOpsByLocale,
      userOpsByLocale,
    });
  }

  if (args.writeTextPacks && localeTextPacks) {
    const failures = await enqueueLocaleTextPacks({
      publicId: args.publicId,
      localeTextPacks,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueFailures({
      kind: 'write-text-pack',
      failures,
      context: args.context,
    });
    if (failures.length) {
      return `[${args.context}:text-pack] ${failures[0]?.error || 'enqueue failed'}`;
    }
  }

  const nextConfigPack = stripTextFromConfig(args.config, Object.keys(args.baseTextPack));
  const nextConfigFp = await jsonSha256Hex(nextConfigPack);

  if (writeMetaPacks && localeTextPacks) {
    const failures = await enqueueLocaleMetaPacks({
      publicId: args.publicId,
      widgetType: args.widgetType,
      configPack: nextConfigPack,
      localeTextPacks,
      enqueue: (job) => enqueueTokyoMirrorJob(args.env, job),
    });
    logMirrorEnqueueFailures({
      kind: 'write-meta-pack',
      failures,
      context: args.context,
    });
    if (failures.length) {
      return `[${args.context}:meta-pack] ${failures[0]?.error || 'enqueue failed'}`;
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
