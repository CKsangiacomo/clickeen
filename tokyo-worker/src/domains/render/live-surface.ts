import type { Env } from '../../types';
import { accountInstanceL10nLivePointerKey, accountInstanceL10nTextPackKey, accountInstanceRenderConfigPackKey, accountInstanceRenderLivePointerKey, accountInstanceRenderMetaLivePointerKey, accountInstanceRenderMetaPackKey, accountInstanceRoot, publicProjectionL10nLivePointerKey, publicProjectionL10nTextPackKey, publicProjectionRenderConfigPackKey, publicProjectionRenderLivePointerKey, publicProjectionRenderMetaLivePointerKey, publicProjectionRenderMetaPackKey, publicProjectionRoot } from './keys';
import { normalizeLiveRenderPointer, normalizeLocalePolicy, normalizeMetaPointer, normalizeTextPointer } from './normalize';
import { deletePrefix, loadJson, putJson } from './storage';
import type { EnforceLiveSurfaceJob, LiveRenderPointer, SyncLiveSurfaceJob } from './types';
import { normalizeFingerprint, normalizePublicId } from './utils';

async function copyJsonProjection(env: Env, sourceKey: string, targetKey: string, label: string): Promise<void> {
  const payload = await loadJson(env, sourceKey);
  if (payload == null) throw new Error(`[tokyo] missing required ${label} (${sourceKey})`);
  await putJson(env, targetKey, payload);
}

async function projectAccountLocaleText(args: {
  env: Env;
  accountId: string;
  publicId: string;
  locale: string;
}): Promise<void> {
  const pointerKey = accountInstanceL10nLivePointerKey(args.accountId, args.publicId, args.locale);
  const pointer = normalizeTextPointer(await loadJson(args.env, pointerKey));
  if (!pointer) throw new Error(`[tokyo] missing required text pointer (${args.locale}) (${pointerKey})`);
  await copyJsonProjection(
    args.env,
    accountInstanceL10nTextPackKey(args.accountId, args.publicId, args.locale, pointer.textFp),
    publicProjectionL10nTextPackKey(args.publicId, args.locale, pointer.textFp),
    `text pack (${args.locale})`,
  );
  await putJson(args.env, publicProjectionL10nLivePointerKey(args.publicId, args.locale), pointer);
}

async function projectAccountLocaleMeta(args: {
  env: Env;
  accountId: string;
  publicId: string;
  locale: string;
}): Promise<void> {
  const pointerKey = accountInstanceRenderMetaLivePointerKey(args.accountId, args.publicId, args.locale);
  const pointer = normalizeMetaPointer(await loadJson(args.env, pointerKey));
  if (!pointer) throw new Error(`[tokyo] missing required meta pointer (${args.locale}) (${pointerKey})`);
  await copyJsonProjection(
    args.env,
    accountInstanceRenderMetaPackKey(args.accountId, args.publicId, args.locale, pointer.metaFp),
    publicProjectionRenderMetaPackKey(args.publicId, args.locale, pointer.metaFp),
    `meta pack (${args.locale})`,
  );
  await putJson(args.env, publicProjectionRenderMetaLivePointerKey(args.publicId, args.locale), pointer);
}

async function deletePublicProjectionLocaleText(env: Env, publicId: string, locale: string): Promise<void> {
  await env.TOKYO_R2.delete(publicProjectionL10nLivePointerKey(publicId, locale));
}

async function deletePublicProjectionLocaleMeta(env: Env, publicId: string, locale: string): Promise<void> {
  await env.TOKYO_R2.delete(publicProjectionRenderMetaLivePointerKey(publicId, locale));
}

export async function syncLiveSurface(env: Env, job: SyncLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] sync-live-surface missing publicId');
  const accountId = normalizePublicId(job.accountId);
  if (!accountId) throw new Error('[tokyo] sync-live-surface missing accountId');
  const accountLivePointerKey = accountInstanceRenderLivePointerKey(accountId, publicId);
  const publicLivePointerKey = publicProjectionRenderLivePointerKey(publicId);

  if (!job.live) {
    await Promise.all([
      env.TOKYO_R2.delete(accountLivePointerKey),
      env.TOKYO_R2.delete(publicLivePointerKey),
      deletePrefix(env, `${publicProjectionRoot(publicId)}/l10n/live/`),
      deletePrefix(env, `${publicProjectionRoot(publicId)}/meta/live/`),
    ]);
    return;
  }

  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] sync-live-surface missing widgetType');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] sync-live-surface invalid configFp');
  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] sync-live-surface invalid localePolicy');

  // Refuse to move the live render pointer if account-owned bytes aren't present yet.
  await copyJsonProjection(
    env,
    accountInstanceRenderConfigPackKey(accountId, publicId, configFp),
    publicProjectionRenderConfigPackKey(publicId, configFp),
    'config pack',
  );
  for (const locale of localePolicy.readyLocales) {
    await projectAccountLocaleText({ env, accountId, publicId, locale });
    if (job.seoGeo) {
      await projectAccountLocaleMeta({ env, accountId, publicId, locale });
    }
  }

  const previous = normalizeLiveRenderPointer(await loadJson(env, accountLivePointerKey));
  const previousConfigFp = previous?.configFp ?? null;
  const previousLocales = previous?.localePolicy.readyLocales ?? [];
  const previousSeoGeoEnabled = Boolean(previous?.seoGeo);

  const next: LiveRenderPointer = {
    v: 1,
    publicId,
    widgetType,
    configFp,
    localePolicy,
    l10n: {
      liveBase: `${publicProjectionRoot(publicId)}/l10n/live`,
      packsBase: `${publicProjectionRoot(publicId)}/l10n/packs`,
    },
    seoGeo: job.seoGeo
      ? {
          metaLiveBase: `${publicProjectionRoot(publicId)}/meta/live`,
          metaPacksBase: `${publicProjectionRoot(publicId)}/meta`,
        }
      : undefined,
  };

  await Promise.all([
    putJson(env, accountLivePointerKey, next),
    putJson(env, publicLivePointerKey, next),
  ]);

  if (previousConfigFp && previousConfigFp !== configFp) {
    await env.TOKYO_R2.delete(publicProjectionRenderConfigPackKey(publicId, previousConfigFp));
  }

  const nextLocales = new Set(localePolicy.readyLocales);
  const removedLocales = previousLocales.filter((locale) => !nextLocales.has(locale));
  for (const locale of removedLocales) {
    await deletePublicProjectionLocaleText(env, publicId, locale);
    if (previousSeoGeoEnabled) {
      await deletePublicProjectionLocaleMeta(env, publicId, locale);
    }
  }

  if (previousSeoGeoEnabled && !job.seoGeo) {
    for (const locale of previousLocales) {
      await deletePublicProjectionLocaleMeta(env, publicId, locale);
    }
  }
}

export async function enforceLiveSurface(env: Env, job: EnforceLiveSurfaceJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] enforce-live-surface missing publicId');
  const accountId = normalizePublicId(job.accountId);
  if (!accountId) throw new Error('[tokyo] enforce-live-surface missing accountId');

  const localePolicy = normalizeLocalePolicy(job.localePolicy);
  if (!localePolicy) throw new Error('[tokyo] enforce-live-surface invalid localePolicy');
  const seoGeo = job.seoGeo === true;

  const key = accountInstanceRenderLivePointerKey(accountId, publicId);
  const existing = normalizeLiveRenderPointer(await loadJson(env, key));
  if (!existing) {
    // Nothing is live in account truth; best-effort cleanup of public SEO/meta projections to avoid drift.
    if (!seoGeo) {
      await Promise.all([
        deletePrefix(env, `${publicProjectionRoot(publicId)}/meta/live/`),
        deletePrefix(env, `${publicProjectionRoot(publicId)}/meta/`),
      ]);
    }
    return;
  }

  await syncLiveSurface(env, {
    v: 1,
    kind: 'sync-live-surface',
    publicId,
    accountId,
    live: true,
    widgetType: existing.widgetType,
    configFp: existing.configFp,
    localePolicy,
    seoGeo,
  });
}

export async function deleteInstanceMirror(env: Env, publicId: string, accountId: string): Promise<void> {
  const normalized = normalizePublicId(publicId);
  if (!normalized) throw new Error('[tokyo] delete-instance-mirror missing publicId');
  const normalizedAccount = normalizePublicId(accountId);
  if (!normalizedAccount) throw new Error('[tokyo] delete-instance-mirror missing accountId');
  // Tokyo is a mirror, not an archive: if an instance is not live, its bytes must not exist.
  await Promise.all([
    deletePrefix(env, accountInstanceRoot(normalizedAccount, normalized)),
    deletePrefix(env, publicProjectionRoot(normalized)),
  ]);
}
