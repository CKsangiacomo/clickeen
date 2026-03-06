import { can } from '@clickeen/ck-policy';
import { buildL10nSnapshot, computeBaseFingerprint, stableStringify } from '@clickeen/l10n';
import type { CuratedInstanceRow, Env, InstanceRow, UpdatePayload } from '../../shared/types';
import { readJson } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { loadWidgetLocalizationAllowlist } from '../../shared/l10n';
import {
  asTrimmedString,
  assertConfig,
  assertDisplayName,
  assertLocalePolicy,
  assertMeta,
  assertSeoGeo,
  assertStatus,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeAccount } from '../../shared/account-auth';
import {
  inferInstanceKindFromPublicId,
  isCuratedInstanceRow,
  resolveInstanceKind,
} from '../../shared/instances';
import { resolveAdminAccountId } from '../../shared/admin';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { enqueueL10nJobs } from '../l10n';
import { loadInstanceOverlays } from '../l10n/service';
import { enqueueTokyoMirrorJob } from './service';
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
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  enforceLimits,
  resolveCuratedMetaUpdate,
  rollbackInstanceWriteOnUsageSyncFailure,
  syncAccountAssetUsageForInstanceStrict,
  validateAccountAssetUsageForInstanceStrict,
} from './helpers';
import { handleAccountGetInstance } from './read-handlers';

export async function handleAccountUpdateInstance(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const updateGate = can(policyResult.policy, 'instance.update');
  if (!updateGate.allow) {
    return ckError(
      { kind: 'DENY', reasonKey: updateGate.reasonKey, upsell: 'UP', detail: updateGate.detail },
      403,
    );
  }

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  const configResult =
    payload.config !== undefined
      ? assertConfig(payload.config)
      : { ok: true as const, value: undefined };
  if (!configResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.config.invalid' }, 422);
  }

  const statusResult = assertStatus(payload.status);
  if (!statusResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.status.invalid' }, 422);
  }
  const displayNameResult = assertDisplayName(payload.displayName);
  if (!displayNameResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const metaResult =
    payload.meta !== undefined ? assertMeta(payload.meta) : { ok: true as const, value: undefined };
  if (!metaResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const config = configResult.value;
  const status = statusResult.value;
  const displayName = displayNameResult.value;
  const meta = metaResult.value;

  if (config === undefined && status === undefined && meta === undefined && displayName === undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.empty' }, 422);
  }

  const localePolicyResult = assertLocalePolicy(payload.localePolicy);
  if (!localePolicyResult.ok) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: localePolicyResult.issues[0]?.message,
        paths: localePolicyResult.issues.map((issue) => issue.path),
      },
      422,
    );
  }
  const localePolicy = localePolicyResult.value;

  const seoGeoResult = assertSeoGeo(payload.seoGeo);
  if (!seoGeoResult.ok) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: seoGeoResult.issues[0]?.message,
        paths: seoGeoResult.issues.map((issue) => issue.path),
      },
      422,
    );
  }
  const seoGeoRequested = seoGeoResult.value;

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const isCurated = resolveInstanceKind(instance) === 'curated';
  if (isCurated) {
    const adminAccountId = resolveAdminAccountId(env);
    if (accountId !== adminAccountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    const ownerAccountId = asTrimmedString((instance as CuratedInstanceRow).owner_account_id) || null;
    if (ownerAccountId && ownerAccountId !== adminAccountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  if (!isCurated && payload.meta !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  if (isCurated) {
    const isValidType = await isKnownWidgetType(env, widgetType);
    if (!isValidType) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
  }

  const prevStatus = instance.status;
  const nextStatus = status ?? prevStatus;
  const statusChanged = status !== undefined && status !== prevStatus;
  let configChanged = false;
  if (config !== undefined) {
    try {
      const [currentFingerprint, nextFingerprint] = await Promise.all([
        computeBaseFingerprint(instance.config),
        computeBaseFingerprint(config),
      ]);
      configChanged = currentFingerprint !== nextFingerprint;
    } catch {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.config.invalid' }, 422);
    }
  }
  const configForWriteValidation =
    configChanged
      ? config
      : statusChanged && prevStatus !== 'published' && nextStatus === 'published'
        ? instance.config
        : undefined;

  if (configForWriteValidation !== undefined) {
    const issues = configNonPersistableUrlIssues(configForWriteValidation);
    if (issues.length) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.publish.nonPersistableUrl',
          detail: issues[0]?.message,
          paths: issues.map((i) => i.path),
        },
        422,
      );
    }

    const assetIssues = configAssetUrlContractIssues(configForWriteValidation, account.id);
    if (assetIssues.length) {
      return ckError(
        {
          kind: 'VALIDATION',
          reasonKey: 'coreui.errors.publish.nonPersistableUrl',
          detail: assetIssues[0]?.message,
          paths: assetIssues.map((i) => i.path),
        },
        422,
      );
    }

    const denyByLimits = await enforceLimits(
      env,
      policyResult.policy,
      widgetType,
      configForWriteValidation,
    );
    if (denyByLimits) return denyByLimits;

    const usageValidationError = await validateAccountAssetUsageForInstanceStrict({
      env,
      accountId: account.id,
      publicId,
      config: configForWriteValidation,
    });
    if (usageValidationError) return usageValidationError;
  }

  // Enforce published-instance slots (per account tier).
  if (!isCurated && statusChanged && prevStatus !== 'published' && nextStatus === 'published') {
    const max = policyResult.policy.caps['instances.published.max'];
    if (max != null && typeof max === 'number') {
      const params = new URLSearchParams({
        select: 'public_id',
        account_id: `eq.${accountId}`,
        status: 'eq.published',
        limit: '250',
      });
      const countRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
        method: 'GET',
      });
      if (!countRes.ok) {
        const details = await readJson(countRes);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.readFailed',
            detail: JSON.stringify(details),
          },
          500,
        );
      }
      const publishedRows = (await countRes.json().catch(() => null)) as Array<{
        public_id?: string;
      }> | null;
      const publishedCount = Array.isArray(publishedRows) ? publishedRows.length : 0;
      if (publishedCount >= max) {
        return ckError(
          {
            kind: 'DENY',
            reasonKey: 'coreui.upsell.reason.capReached',
            upsell: 'UP',
            detail: `instances.published.max=${max}`,
          },
          403,
        );
      }
    }
  }

  const needsLivePlanForMirror =
    (prevStatus === 'published' && config !== undefined) || (statusChanged && nextStatus === 'published');
  if (needsLivePlanForMirror) {
    if (!localePolicy) {
      return ckError(
        { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'localePolicy is required to update a live instance.' },
        422,
      );
    }
    if (seoGeoRequested === undefined) {
      return ckError(
        { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid', detail: 'seoGeo is required to update a live instance.' },
        422,
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (config !== undefined) update.config = config;
  if (isCurated) {
    if (status !== undefined) update.status = status;
    const curatedMetaUpdate = resolveCuratedMetaUpdate({
      currentMetaRaw: isCuratedInstanceRow(instance) ? instance.meta : null,
      incomingMeta: meta,
      displayName,
    });
    if (curatedMetaUpdate !== undefined) update.meta = curatedMetaUpdate;
  } else if (status !== undefined) {
    update.status = status;
  }
  if (!isCurated && meta !== undefined) update.meta = meta;
  if (!isCurated && displayName !== undefined) update.display_name = displayName ?? DEFAULT_INSTANCE_DISPLAY_NAME;

  let updatedInstance: InstanceRow | CuratedInstanceRow | null = instance;
  const patchPath = isCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&account_id=eq.${encodeURIComponent(accountId)}`;
  let patchRes = await supabaseFetch(env, patchPath, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(update),
  });
  if (!patchRes.ok) {
    const details = await readJson(patchRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }
  const updated = (await patchRes.json().catch(() => null)) as Array<
    InstanceRow | CuratedInstanceRow
  > | null;
  updatedInstance = updated?.[0] ?? updatedInstance;

  if (!updatedInstance) {
    updatedInstance = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  }

  if (updatedInstance) {
    const configForUsageSync =
      configChanged
        ? config
        : statusChanged && prevStatus !== 'published' && nextStatus === 'published'
          ? updatedInstance.config
          : undefined;

    if (configForUsageSync !== undefined) {
      const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
        env,
        accountId: account.id,
        publicId,
        config: configForUsageSync,
      });
      if (usageSyncError) {
        await rollbackInstanceWriteOnUsageSyncFailure({
          env,
          accountId: account.id,
          publicId,
          before: instance,
          isCurated,
        });
        return usageSyncError;
      }
    }

    const shouldTrigger = configChanged || (statusChanged && updatedInstance.status === 'published');
    if (shouldTrigger && updatedInstance.status === 'published') {
      const enqueueResult = await enqueueL10nJobs({
        env,
        instance: updatedInstance,
        account,
        widgetType,
        baseUpdatedAt: updatedInstance.updated_at ?? null,
        policy: policyResult.policy,
      });
      if (!enqueueResult.ok) {
        console.error('[ParisWorker] l10n enqueue failed', enqueueResult.error);
      }
    }

    // PRD 54: Tokyo is the live mirror. Venice public serves Tokyo bytes only.
    const updatedPrevStatus = prevStatus;
    const updatedNextStatus = updatedInstance.status;
    if (updatedNextStatus === 'published' && needsLivePlanForMirror) {
      const shouldSeed = updatedPrevStatus !== 'published';
      const liveLocalePolicy = localePolicy!;
      const baseLocale = liveLocalePolicy.baseLocale;
      const availableLocales = liveLocalePolicy.availableLocales;
      const seoGeoLive = isSeoGeoLive({
        policy: policyResult.policy,
        config: updatedInstance.config,
        requested: seoGeoRequested === true,
      });

      try {
        const allowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
        const previousBaseTextPack = buildL10nSnapshot(instance.config, allowlist);
        const nextBaseTextPack = buildL10nSnapshot(updatedInstance.config, allowlist);
        const textChanged = stableStringify(previousBaseTextPack) !== stableStringify(nextBaseTextPack);

        const nextConfigPack = stripTextFromConfig(updatedInstance.config, Object.keys(nextBaseTextPack));
        const nextConfigFp = await jsonSha256Hex(nextConfigPack);

        let configFpChanged = shouldSeed;
        if (!configFpChanged) {
          const previousConfigPack = stripTextFromConfig(instance.config, Object.keys(previousBaseTextPack));
          const previousConfigFp = await jsonSha256Hex(previousConfigPack);
          configFpChanged = previousConfigFp !== nextConfigFp;
        }

        const shouldWriteTextPacks = shouldSeed || textChanged;
        const shouldWriteMetaPacks = seoGeoLive && (shouldSeed || textChanged || configFpChanged);

        let localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }> | null = null;
        if (shouldWriteTextPacks || shouldWriteMetaPacks) {
          const baseFingerprint = await computeBaseFingerprint(nextBaseTextPack);
          const { localeOpsByLocale, userOpsByLocale } = await resolveLocaleOverlayOps({
            loadRows: () => loadInstanceOverlays(env, publicId),
            locales: availableLocales,
            baseFingerprint,
            warnMessage: '[ParisWorker] Failed to resolve locale overlays for text packs',
          });

          localeTextPacks = buildLocaleTextPacks({
            locales: availableLocales,
            baseLocale,
            basePack: nextBaseTextPack,
            localeOpsByLocale,
            userOpsByLocale,
          });
        }

        if (shouldWriteTextPacks && localeTextPacks) {
          const failures = await enqueueLocaleTextPacks({
            publicId,
            localeTextPacks,
            enqueue: (job) => enqueueTokyoMirrorJob(env, job),
          });
          logMirrorEnqueueFailures({ kind: 'write-text-pack', failures });
        }

        if (shouldWriteMetaPacks && localeTextPacks) {
          const failures = await enqueueLocaleMetaPacks({
            publicId,
            widgetType,
            configPack: nextConfigPack,
            localeTextPacks,
            enqueue: (job) => enqueueTokyoMirrorJob(env, job),
          });
          logMirrorEnqueueFailures({ kind: 'write-meta-pack', failures });
        }

        // PRD 54: write packs first, move pointers last. `sync-live-surface` refuses to
        // advance when any required locale/meta pointers are missing.
        if (shouldSeed || configFpChanged) {
          const configError = await enqueueConfigPack({
            publicId,
            widgetType,
            configFp: nextConfigFp,
            configPack: nextConfigPack,
            enqueue: (job) => enqueueTokyoMirrorJob(env, job),
          });
          logMirrorEnqueueError({ kind: 'write-config-pack', error: configError });

          const syncError = await enqueueLiveSurfaceSync({
            publicId,
            widgetType,
            configFp: nextConfigFp,
            localePolicy: liveLocalePolicy,
            seoGeo: seoGeoLive,
            enqueue: (job) => enqueueTokyoMirrorJob(env, job),
          });
          logMirrorEnqueueError({ kind: 'sync-live-surface', error: syncError });
        }
      } catch (error) {
        const detail = errorDetail(error);
        console.error('[ParisWorker] tokyo mirror job planning failed', detail);
      }
    } else if (updatedPrevStatus === 'published' && updatedNextStatus === 'unpublished') {
      const enqueue = await enqueueTokyoMirrorJob(env, { v: 1, kind: 'delete-instance-mirror', publicId });
      if (!enqueue.ok) {
        console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
      }
    }
  }

  return handleAccountGetInstance(req, env, accountId, publicId);
}
