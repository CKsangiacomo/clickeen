import { can } from '@clickeen/ck-policy';
import { buildL10nSnapshot, computeBaseFingerprint, stableStringify } from '@clickeen/l10n';
import type { CuratedInstanceRow, Env, InstanceRow, UpdatePayload } from '../../shared/types';
import { readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { loadWidgetLocalizationAllowlist } from '../../shared/l10n';
import {
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
import { authorizeWorkspace } from '../../shared/workspace-auth';
import {
  allowCuratedWrites,
  inferInstanceKindFromPublicId,
  isCuratedInstanceRow,
  resolveInstanceKind,
} from '../../shared/instances';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { enqueueL10nJobs } from '../l10n';
import {
  enqueueTokyoMirrorJob,
  loadEnforcement,
  normalizeActiveEnforcement,
} from './service';
import { applyTextPackToConfig, materializeTextPack, stripTextFromConfig } from '../../shared/mirror-packs';
import { jsonSha256Hex } from '../../shared/stable-json';
import { generateMetaPack } from '../../shared/seo-geo';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  enforceLimits,
  resolveCuratedMetaUpdate,
  rollbackInstanceWriteOnUsageSyncFailure,
  syncAccountAssetUsageForInstanceStrict,
  validateAccountAssetUsageForInstanceStrict,
} from './helpers';
import { handleWorkspaceGetInstance } from './read-handlers';

export async function handleWorkspaceUpdateInstance(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publishGate = can(policyResult.policy, 'instance.publish');
  if (!publishGate.allow) {
    return ckError(
      { kind: 'DENY', reasonKey: publishGate.reasonKey, upsell: 'UP', detail: publishGate.detail },
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

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const enforcementRow = await loadEnforcement(env, publicId);
  const enforcement = normalizeActiveEnforcement(enforcementRow);
  if (enforcement && config !== undefined) {
    return ckError(
      {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.viewsFrozen',
        upsell: 'UP',
        detail: `Frozen until ${enforcement.resetAt}`,
      },
      403,
    );
  }

  const isCurated = resolveInstanceKind(instance) === 'curated';
  const isCuratedRenameOnly =
    isCurated && displayName !== undefined && config === undefined && status === undefined && meta === undefined;
  if (isCurated && !allowCuratedWrites(env) && !isCuratedRenameOnly) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.curated.localOnly' }, 403);
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

    const assetIssues = configAssetUrlContractIssues(configForWriteValidation, workspace.account_id);
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
      accountId: workspace.account_id,
      publicId,
      config: configForWriteValidation,
    });
    if (usageValidationError) return usageValidationError;
  }

  // Enforce published-instance slots (per workspace tier).
  if (!isCurated && statusChanged && prevStatus !== 'published' && nextStatus === 'published') {
    const max = policyResult.policy.caps['instances.published.max'];
    if (max != null && typeof max === 'number') {
      const params = new URLSearchParams({
        select: 'public_id',
        workspace_id: `eq.${workspaceId}`,
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
    update.owner_account_id = workspace.account_id;
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
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
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
    updatedInstance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
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
        accountId: workspace.account_id,
        publicId,
        config: configForUsageSync,
      });
      if (usageSyncError) {
        await rollbackInstanceWriteOnUsageSyncFailure({
          env,
          workspaceId,
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
        workspace,
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
      const seoGeoEntitled = policyResult.policy.flags['embed.seoGeo.enabled'] === true;
      const seoGeoConfigEnabled = Boolean((updatedInstance.config as any)?.seoGeo?.enabled === true);
      const seoGeoLive = seoGeoRequested === true && seoGeoEntitled && seoGeoConfigEnabled;

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

        type LocaleOverlayRow = {
          layer?: string | null;
          layer_key?: string | null;
          ops?: unknown;
          base_fingerprint?: string | null;
        };

        let localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }> | null = null;
        if (shouldWriteTextPacks || shouldWriteMetaPacks) {
          const baseFingerprint = await computeBaseFingerprint(nextBaseTextPack);
          const localeOpsByLocale = new Map<string, Array<{ op: 'set'; path: string; value: unknown }>>();
          const userOpsByLocale = new Map<string, Array<{ op: 'set'; path: string; value: unknown }>>();

          try {
            const params = new URLSearchParams({
              select: 'layer,layer_key,ops,base_fingerprint',
              public_id: `eq.${publicId}`,
              layer: 'in.(locale,user)',
              base_fingerprint: `eq.${baseFingerprint}`,
              limit: '1000',
            });
            const overlaysRes = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, {
              method: 'GET',
            });
            if (overlaysRes.ok) {
              const rows = ((await overlaysRes.json().catch(() => null)) as LocaleOverlayRow[] | null) ?? [];
              rows.forEach((row) => {
                const layer = typeof row?.layer === 'string' ? row.layer.trim().toLowerCase() : '';
                const locale = typeof row?.layer_key === 'string' ? row.layer_key.trim() : '';
                if (!locale) return;
                if (!availableLocales.includes(locale)) return;
                if (!Array.isArray(row.ops)) return;
                if (layer === 'locale') {
                  localeOpsByLocale.set(locale, row.ops as Array<{ op: 'set'; path: string; value: unknown }>);
                } else if (layer === 'user') {
                  userOpsByLocale.set(locale, row.ops as Array<{ op: 'set'; path: string; value: unknown }>);
                }
              });
            } else {
              const details = await readJson(overlaysRes).catch(() => null);
              console.warn('[ParisWorker] Failed to load locale overlays for text packs', details);
            }
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn('[ParisWorker] Failed to resolve locale overlays for text packs', detail);
          }

          localeTextPacks = availableLocales.map((locale) => {
            if (locale === baseLocale) {
              return { locale, textPack: { ...nextBaseTextPack } };
            }
            const localeOps = localeOpsByLocale.get(locale) ?? null;
            const userOps = userOpsByLocale.get(locale) ?? null;
            return {
              locale,
              textPack: materializeTextPack({ basePack: nextBaseTextPack, localeOps, userOps }),
            };
          });
        }

        if (shouldWriteTextPacks && localeTextPacks) {
          for (const { locale, textPack } of localeTextPacks) {
            const enqueue = await enqueueTokyoMirrorJob(env, {
              v: 1,
              kind: 'write-text-pack',
              publicId,
              locale,
              textPack,
            });
            if (!enqueue.ok) {
              console.error('[ParisWorker] tokyo write-text-pack enqueue failed', enqueue.error);
            }
          }
        }

        if (shouldWriteMetaPacks && localeTextPacks) {
          for (const { locale, textPack } of localeTextPacks) {
            const metaState = applyTextPackToConfig(nextConfigPack, textPack);
            const metaPack = generateMetaPack({ widgetType, state: metaState, locale });
            const enqueueMeta = await enqueueTokyoMirrorJob(env, {
              v: 1,
              kind: 'write-meta-pack',
              publicId,
              locale,
              metaPack,
            });
            if (!enqueueMeta.ok) {
              console.error('[ParisWorker] tokyo write-meta-pack enqueue failed', enqueueMeta.error);
            }
          }
        }

        // PRD 54: write packs first, move pointers last. `sync-live-surface` refuses to
        // advance when any required locale/meta pointers are missing.
        if (shouldSeed || configFpChanged) {
          const writeConfig = await enqueueTokyoMirrorJob(env, {
            v: 1,
            kind: 'write-config-pack',
            publicId,
            widgetType,
            configFp: nextConfigFp,
            configPack: nextConfigPack,
          });
          if (!writeConfig.ok) {
            console.error('[ParisWorker] tokyo write-config-pack enqueue failed', writeConfig.error);
          }

          const sync = await enqueueTokyoMirrorJob(env, {
            v: 1,
            kind: 'sync-live-surface',
            publicId,
            live: true,
            widgetType,
            configFp: nextConfigFp,
            localePolicy: liveLocalePolicy,
            seoGeo: seoGeoLive,
          });
          if (!sync.ok) {
            console.error('[ParisWorker] tokyo sync-live-surface enqueue failed', sync.error);
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error('[ParisWorker] tokyo mirror job planning failed', detail);
      }
    } else if (updatedPrevStatus === 'published' && updatedNextStatus === 'unpublished') {
      const enqueue = await enqueueTokyoMirrorJob(env, { v: 1, kind: 'delete-instance-mirror', publicId });
      if (!enqueue.ok) {
        console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
      }
    }
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}
