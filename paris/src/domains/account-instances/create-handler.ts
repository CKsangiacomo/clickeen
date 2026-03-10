import { can } from '@clickeen/ck-policy';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import type { CuratedInstanceRow, Env, InstanceRow, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { loadWidgetLocalizationAllowlist, resolveAccountL10nPolicy } from '../../shared/l10n';
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
  assertConfig,
  assertDisplayName,
  assertMeta,
  assertStatus,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
  isRecord,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeAccount } from '../../shared/account-auth';
import {
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
  resolveCuratedRowKind,
  resolveInstanceKind,
} from '../../shared/instances';
import { resolveAdminAccountId } from '../../shared/admin';
import { loadInstanceByPublicId, loadWidgetByType } from '../instances';
import { enqueueL10nJobs } from '../l10n';
import { loadInstanceOverlays } from '../l10n/service';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales, writeSavedConfigToTokyo } from './service';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  enforceLimits,
  rollbackCreatedInstanceAfterPostCommitFailure,
  syncAccountAssetUsageForInstanceStrict,
  titleCase,
  validateAccountAssetUsageForInstanceStrict,
} from './helpers';

export async function handleAccountCreateInstance(req: Request, env: Env, accountId: string) {
  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account, authorized.role);
  if (!policyResult.ok) return policyResult.response;

  const createGate = can(policyResult.policy, 'instance.create');
  if (!createGate.allow) {
    return ckError(
      { kind: 'DENY', reasonKey: createGate.reasonKey, upsell: 'UP', detail: createGate.detail },
      403,
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  if (!isRecord(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetTypeResult = assertWidgetType((payload as any).widgetType);
  const publicIdResult = assertPublicId((payload as any).publicId);
  const configResult = assertConfig((payload as any).config);
  const statusResult = assertStatus((payload as any).status);
  const displayNameResult = assertDisplayName((payload as any).displayName);
  const metaResult =
    (payload as any).meta !== undefined
      ? assertMeta((payload as any).meta)
      : { ok: true as const, value: undefined };

  if (
    !widgetTypeResult.ok ||
    !publicIdResult.ok ||
    !configResult.ok ||
    !statusResult.ok ||
    !displayNameResult.ok ||
    !metaResult.ok
  ) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetType = widgetTypeResult.value;
  const publicId = publicIdResult.value;
  const config = configResult.value;
  const requestedStatus = statusResult.value;
  const requestedDisplayName = displayNameResult.value;
  const meta = metaResult.value;
  const kind = inferInstanceKindFromPublicId(publicId);
  const isCurated = kind === 'curated';
  const status = requestedStatus ?? 'unpublished';

  const adminAccountId = resolveAdminAccountId(env);
  if (isCurated && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }
  if (!isCurated && (payload as any).meta !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  if (isCurated && (payload as any).displayName !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const existing = await loadInstanceByPublicId(env, publicId);
  if (existing) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.conflict' }, 409);
  }

  const issues = configNonPersistableUrlIssues(config);
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

  const assetIssues = configAssetUrlContractIssues(config, account.id);
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

  const denyByLimits = await enforceLimits(env, policyResult.policy, widgetType, config);
  if (denyByLimits) return denyByLimits;

  const usageValidationError = await validateAccountAssetUsageForInstanceStrict({
    env,
    accountId: account.id,
    publicId,
    config,
  });
  if (usageValidationError) return usageValidationError;

  let createdInstance: InstanceRow | CuratedInstanceRow | null = null;

  if (isCurated) {
    const isValidType = await isKnownWidgetType(env, widgetType);
    if (!isValidType) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
    const curatedInsert = await supabaseFetch(env, `/rest/v1/curated_widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        public_id: publicId,
        widget_type: widgetType,
        kind: resolveCuratedRowKind(publicId),
        owner_account_id: account.id,
        status,
        config,
        meta,
      }),
    });
    if (!curatedInsert.ok) {
      const details = await readJson(curatedInsert);
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: JSON.stringify(details),
        },
        500,
      );
    }
    const created = (await curatedInsert.json().catch(() => null)) as CuratedInstanceRow[] | null;
    createdInstance = created?.[0] ?? null;
  } else {
    const widgetTypesCapRaw = policyResult.policy.caps['widgets.types.max'];
    const widgetTypesCap =
      typeof widgetTypesCapRaw === 'number' && Number.isFinite(widgetTypesCapRaw)
        ? Math.max(0, Math.floor(widgetTypesCapRaw))
        : null;

    let widget = await loadWidgetByType(env, widgetType);
    if (!widget) {
      const widgetName = (payload as any).widgetName;
      const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          type: widgetType,
          name:
            typeof widgetName === 'string' && widgetName.trim()
              ? widgetName.trim()
              : titleCase(widgetType) || widgetType,
        }),
      });
      if (!insertRes.ok) {
        const details = await readJson(insertRes);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: JSON.stringify(details),
          },
          500,
        );
      }
      const created = (await insertRes.json().catch(() => null)) as WidgetRow[] | null;
      widget = created?.[0] ?? null;
    }

    if (!widget?.id) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: 'Failed to resolve widget row',
        },
        500,
      );
    }

    // Enforce distinct widget types cap (per account tier).
    // This is a packaging lever separate from instance slots: it limits how many widget types an account can use.
    if (widgetTypesCap != null) {
      if (widgetTypesCap === 0) {
        return ckError(
          {
            kind: 'DENY',
            reasonKey: 'coreui.upsell.reason.capReached',
            upsell: 'UP',
            detail: `widgets.types.max=${widgetTypesCap}`,
          },
          403,
        );
      }

      const existingTypeParams = new URLSearchParams({
        select: 'public_id',
        account_id: `eq.${accountId}`,
        widget_id: `eq.${widget.id}`,
        limit: '1',
      });
      const existingTypeRes = await supabaseFetch(
        env,
        `/rest/v1/widget_instances?${existingTypeParams.toString()}`,
        { method: 'GET' },
      );
      if (!existingTypeRes.ok) {
        const details = await readJson(existingTypeRes);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.readFailed',
            detail: JSON.stringify(details),
          },
          500,
        );
      }
      const existingTypeRows = (await existingTypeRes.json().catch(() => null)) as Array<{
        public_id?: string | null;
      }> | null;
      const hasWidgetType = Boolean(existingTypeRows?.length);

      if (!hasWidgetType) {
        const pageSize = 500;
        let offset = 0;
        const widgetIds = new Set<string>();
        while (widgetIds.size < widgetTypesCap) {
          const params = new URLSearchParams({
            select: 'widget_id',
            account_id: `eq.${accountId}`,
            limit: String(pageSize),
            offset: String(offset),
          });
          const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
            method: 'GET',
          });
          if (!res.ok) {
            const details = await readJson(res);
            return ckError(
              {
                kind: 'INTERNAL',
                reasonKey: 'coreui.errors.db.readFailed',
                detail: JSON.stringify(details),
              },
              500,
            );
          }
          const rows = (await res.json().catch(() => null)) as Array<{
            widget_id?: string | null;
          }> | null;
          if (!rows?.length) break;
          for (const row of rows) {
            const id = typeof row?.widget_id === 'string' ? row.widget_id : null;
            if (id) widgetIds.add(id);
            if (widgetIds.size >= widgetTypesCap) break;
          }
          if (rows.length < pageSize) break;
          offset += pageSize;
        }

        if (widgetIds.size >= widgetTypesCap) {
          return ckError(
            {
              kind: 'DENY',
              reasonKey: 'coreui.upsell.reason.capReached',
              upsell: 'UP',
              detail: `widgets.types.max=${widgetTypesCap}`,
            },
            403,
          );
        }
      }
    }

    const baseInsertPayload = {
      account_id: account.id,
      widget_id: widget.id,
      public_id: publicId,
      status,
      config,
      kind,
    };
    const resolvedDisplayName = requestedDisplayName ?? DEFAULT_INSTANCE_DISPLAY_NAME;
    let instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...baseInsertPayload,
        display_name: resolvedDisplayName,
      }),
    });
    if (!instanceInsert.ok) {
      const details = await readJson(instanceInsert);
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: JSON.stringify(details),
        },
        500,
      );
    }
    const created = (await instanceInsert.json().catch(() => null)) as InstanceRow[] | null;
    createdInstance = created?.[0] ?? null;
  }

  if (createdInstance) {
    const createdKind = resolveInstanceKind(createdInstance);

    const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
      env,
      accountId: account.id,
      publicId,
      config: createdInstance.config,
    });
    if (usageSyncError) {
      await rollbackCreatedInstanceAfterPostCommitFailure({
        env,
        accountId: account.id,
        publicId,
        isCurated: createdKind === 'curated',
      });
      return usageSyncError;
    }

    if (createdKind !== 'curated') {
      try {
        await writeSavedConfigToTokyo({
          env,
          accountId: account.id,
          publicId,
          widgetType,
          config: createdInstance.config,
        });
      } catch (error) {
        await rollbackCreatedInstanceAfterPostCommitFailure({
          env,
          accountId: account.id,
          publicId,
          isCurated: false,
        });
        const detail = errorDetail(error);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.db.writeFailed',
            detail: `[tokyo-saved-config] ${detail}`,
          },
          500,
        );
      }
    }

    if (createdKind !== 'curated') {
      const enqueueResult = await enqueueL10nJobs({
        env,
        instance: createdInstance,
        account,
        widgetType,
        baseUpdatedAt: createdInstance.updated_at ?? null,
        policy: policyResult.policy,
      });
      if (!enqueueResult.ok) {
        console.error('[ParisWorker] l10n enqueue failed', enqueueResult.error);
      }
    }

    if (createdInstance.status === 'published') {
      const accountL10nPolicy = resolveAccountL10nPolicy(account.l10n_policy);
      const baseLocale = accountL10nPolicy.baseLocale;
      const publishLocales = resolveActivePublishLocales({
        accountLocales: account.l10n_locales,
        policy: policyResult.policy,
        baseLocale,
      });
      const availableLocales = publishLocales.locales;
      const countryToLocale = Object.fromEntries(
        Object.entries(accountL10nPolicy.ip.countryToLocale).filter(([, locale]) =>
          availableLocales.includes(locale),
        ),
      );
      const localePolicy = {
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
        policy: policyResult.policy,
        config: createdInstance.config,
      });

      try {
        const allowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
        const baseTextPack = buildL10nSnapshot(createdInstance.config, allowlist);
        const configPack = stripTextFromConfig(createdInstance.config, Object.keys(baseTextPack));
        const configFp = await jsonSha256Hex(configPack);

        const baseFingerprint = await computeBaseFingerprint(baseTextPack);
        const { localeOpsByLocale, userOpsByLocale } = await resolveLocaleOverlayOps({
          loadRows: () => loadInstanceOverlays(env, publicId),
          locales: availableLocales,
          baseFingerprint,
          warnMessage: '[ParisWorker] Failed to resolve overlays for text packs',
        });

        const textPacksByLocale = new Map(
          buildLocaleTextPacks({
            locales: availableLocales,
            baseLocale,
            basePack: baseTextPack,
            localeOpsByLocale,
            userOpsByLocale,
          }).map(({ locale, textPack }) => [locale, textPack] as const),
        );

        const localeTextPacks = availableLocales.map((locale) => ({
          locale,
          textPack: textPacksByLocale.get(locale) ?? baseTextPack,
        }));
        const textFailures = await enqueueLocaleTextPacks({
          publicId,
          localeTextPacks,
          enqueue: (job) => enqueueTokyoMirrorJob(env, job),
        });
        logMirrorEnqueueFailures({ kind: 'write-text-pack', failures: textFailures });

        if (seoGeoLive) {
          const metaFailures = await enqueueLocaleMetaPacks({
            publicId,
            widgetType,
            configPack,
            localeTextPacks,
            enqueue: (job) => enqueueTokyoMirrorJob(env, job),
          });
          logMirrorEnqueueFailures({ kind: 'write-meta-pack', failures: metaFailures });
        }

        const configError = await enqueueConfigPack({
          publicId,
          widgetType,
          configFp,
          configPack,
          enqueue: (job) => enqueueTokyoMirrorJob(env, job),
        });
        logMirrorEnqueueError({ kind: 'write-config-pack', error: configError });

        const syncError = await enqueueLiveSurfaceSync({
          publicId,
          widgetType,
          configFp,
          localePolicy,
          seoGeo: seoGeoLive,
          enqueue: (job) => enqueueTokyoMirrorJob(env, job),
        });
        logMirrorEnqueueError({ kind: 'sync-live-surface', error: syncError });
      } catch (error) {
        const detail = errorDetail(error);
        console.error('[ParisWorker] tokyo mirror job planning failed', detail);
      }
    }
  }

  return json(
    {
      publicId,
      widgetType,
      status,
      source: isCurated ? 'curated' : 'account',
    },
    { status: 201 },
  );
}
