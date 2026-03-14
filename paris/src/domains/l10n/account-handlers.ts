import { resolvePolicy, type Policy } from '@clickeen/ck-policy';
import type { AccountRow, Env, InstanceRow, L10nGenerateStateRow, L10nGenerateStatus } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { apiError, ckError, errorDetail } from '../../shared/errors';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import {
  loadWidgetLocalizationAllowlist,
  normalizeLocaleList,
  resolveAccountL10nPolicy,
} from '../../shared/l10n';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { authorizeAccount } from '../../shared/account-auth';
import { supabaseFetch } from '../../shared/supabase';
import { requireAccount } from '../../shared/accounts';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadL10nGenerateStates, loadInstanceOverlays } from './service';
import { resolveL10nPlanningSnapshot } from './planning';
import { enforceL10nSelection, resolveAccountActiveLocales } from './shared';
import { enqueueL10nJobs } from './enqueue-jobs';
import {
  buildLocaleTextPacks,
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
  enqueueTokyoMirrorJob,
  loadSavedConfigStateFromTokyo,
  resolveActivePublishLocales,
} from '../account-instances/service';
import { isCuratedInstanceRow, resolveInstanceAccountId, resolveInstanceKind } from '../../shared/instances';

export async function handleAccountInstanceL10nStatus(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account, authorized.role);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  if (resolveInstanceKind(instance) === 'curated') {
    if (account.is_platform !== true) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    if (isCuratedInstanceRow(instance) && asTrimmedString(instance.owner_account_id) !== accountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const savedState = await loadSavedConfigStateFromTokyo({
    env,
    accountId: resolveInstanceAccountId(instance) ?? accountId,
    publicId,
  });
  if (!savedState) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: 'saved Tokyo revision missing',
      },
      500,
    );
  }

  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: savedState.config,
    baseUpdatedAt: savedState.updatedAt,
  });
  if (!planning.ok) {
    return apiError('INTERNAL_ERROR', 'Failed to resolve l10n planning snapshot', 500, planning.error);
  }
  const baseFingerprint = planning.plan.baseFingerprint;
  const baseUpdatedAt = planning.plan.baseUpdatedAt;

  const accountLocales = resolveAccountActiveLocales({ account });
  if (accountLocales instanceof Response) return accountLocales;
  const locales = accountLocales.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  const stateMap = locales.length
    ? await loadL10nGenerateStates(env, publicId, 'locale', baseFingerprint)
    : new Map<string, L10nGenerateStateRow>();
  const overlays = locales.length ? await loadInstanceOverlays(env, publicId) : [];
  const localeOverlays = overlays.filter((row) => row.layer === 'locale');
  const overlayMatch = new Set<string>();
  const overlayStale = new Set<string>();
  localeOverlays.forEach((row) => {
    const key = row.layer_key;
    if (!key) return;
    if (row.base_fingerprint && row.base_fingerprint === baseFingerprint) {
      overlayMatch.add(key);
      return;
    }
    overlayStale.add(key);
  });

  const localeStates = locales.map((locale) => {
    const row = stateMap.get(locale);
    const hasMatch = overlayMatch.has(locale);
    const hasStale = overlayStale.has(locale);
    let status: L10nGenerateStatus = row?.status ?? 'dirty';
    if (hasMatch) status = 'succeeded';
    else if (!row?.status && hasStale) status = 'superseded';
    const attempts = hasMatch ? Math.max(row?.attempts ?? 0, 1) : (row?.attempts ?? 0);
    return {
      locale,
      status,
      attempts,
      nextAttemptAt: hasMatch ? null : (row?.next_attempt_at ?? null),
      lastAttemptAt: row?.last_attempt_at ?? null,
      lastError: hasMatch ? null : (row?.last_error ?? null),
    };
  });

  return json({
    publicId,
    widgetType,
    baseFingerprint,
    baseUpdatedAt,
    locales: localeStates,
  });
}

async function runAccountLocalesAftermath(args: {
  env: Env;
  accountId: string;
  account: AccountRow;
  policy: Policy;
  previousLocales: string[];
  previousPolicyRaw: unknown;
  nextLocales: string[];
  nextPolicyRaw: unknown;
}): Promise<string[]> {
  const { env, accountId, account, policy, previousLocales, previousPolicyRaw, nextLocales, nextPolicyRaw } = args;
  const warnings: string[] = [];
  const prevPolicy = resolveAccountL10nPolicy(previousPolicyRaw);
  const nextPolicyResolved = resolveAccountL10nPolicy(nextPolicyRaw);
  const prevBaseLocale = prevPolicy.baseLocale;
  const nextBaseLocale = nextPolicyResolved.baseLocale;
  const prevAvailableLocales = resolveActivePublishLocales({
    accountLocales: previousLocales,
    policy,
    baseLocale: prevBaseLocale,
  }).locales;
  const nextAvailableLocales = resolveActivePublishLocales({
    accountLocales: nextLocales,
    policy,
    baseLocale: nextBaseLocale,
  }).locales;

  const baseLocaleChanged = prevBaseLocale !== nextBaseLocale;
  const addedLocales = nextAvailableLocales.filter((locale) => !prevAvailableLocales.includes(locale));
  const removedLocales = prevAvailableLocales.filter((locale) => !nextAvailableLocales.includes(locale));
  const policyChanged = JSON.stringify(prevPolicy) !== JSON.stringify(nextPolicyResolved);

  if (env.RENDER_SNAPSHOT_QUEUE && (baseLocaleChanged || policyChanged || addedLocales.length > 0 || removedLocales.length > 0)) {
    const countryToLocale = Object.fromEntries(
      Object.entries(nextPolicyResolved.ip.countryToLocale).filter(([, locale]) => nextAvailableLocales.includes(locale)),
    );
    const localePolicy = {
      baseLocale: nextBaseLocale,
      availableLocales: nextAvailableLocales,
      ip: {
        enabled: nextPolicyResolved.ip.enabled,
        countryToLocale: nextPolicyResolved.ip.enabled ? countryToLocale : {},
      },
      switcher: {
        enabled: nextPolicyResolved.switcher.enabled,
      },
    };

    const publishedInstances: InstanceRow[] = [];
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const params = new URLSearchParams({
        select: 'public_id,status,created_at,updated_at,widget_id,account_id,kind',
        account_id: `eq.${accountId}`,
        status: 'eq.published',
        limit: String(pageSize),
        offset: String(offset),
      });
      const instancesRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
        method: 'GET',
      });
      if (!instancesRes.ok) {
        const details = await readJson(instancesRes).catch(() => null);
        console.error('[ParisWorker] Failed to load account instances for locale resync', details);
        warnings.push(`load_published_instances_failed:${JSON.stringify(details)}`);
        break;
      }
      const rows = ((await instancesRes.json().catch(() => null)) as InstanceRow[] | null) ?? [];
      publishedInstances.push(...rows);
      if (rows.length < pageSize) break;
      offset += rows.length;
    }

    const widgetIds = Array.from(
      new Set(
        publishedInstances
          .map((row) => row.widget_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const widgetTypeById = new Map<string, string>();
    if (widgetIds.length > 0) {
      const widgetParams = new URLSearchParams({
        select: 'id,type',
        id: `in.(${widgetIds.join(',')})`,
      });
      const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
      if (widgetRes.ok) {
        const widgets = ((await widgetRes.json().catch(() => null)) as Array<{ id?: string; type?: string | null }> | null) ?? [];
        widgets.forEach((widget) => {
          const id = typeof widget?.id === 'string' ? widget.id : '';
          const type = typeof widget?.type === 'string' ? widget.type : '';
          if (id && type) widgetTypeById.set(id, type);
        });
      } else {
        const details = await readJson(widgetRes).catch(() => null);
        console.warn('[ParisWorker] Failed to resolve widget types for locale resync', details);
        warnings.push(`resolve_widget_types_failed:${JSON.stringify(details)}`);
      }
    }

    const allowlistCache = new Map<string, Array<{ path: string; type: 'string' | 'richtext' }>>();
    const localesToSeed = new Set<string>(addedLocales);
    if (baseLocaleChanged) localesToSeed.add(nextBaseLocale);
    const addedAdditionalLocales = nextLocales.filter((locale) => !previousLocales.includes(locale));

    for (const instance of publishedInstances) {
      const publicId = String(instance.public_id || '').trim();
      if (!publicId) continue;
      const widgetType = instance.widget_id ? widgetTypeById.get(instance.widget_id) ?? null : null;
      if (!widgetType) {
        console.warn('[ParisWorker] locale resync skipped: widgetType missing', { publicId });
        warnings.push(`widget_type_missing:${publicId}`);
        continue;
      }

      let allowlist = allowlistCache.get(widgetType) ?? null;
      if (!allowlist) {
        try {
          allowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
          allowlistCache.set(widgetType, allowlist);
        } catch (error) {
          const detail = errorDetail(error);
          console.warn('[ParisWorker] locale resync skipped: allowlist missing', { publicId, widgetType, detail });
          warnings.push(`allowlist_missing:${publicId}:${widgetType}:${detail}`);
          continue;
        }
      }

      const savedState = await loadSavedConfigStateFromTokyo({
        env,
        accountId: resolveInstanceAccountId(instance) ?? accountId,
        publicId,
      }).catch((error) => {
        const detail = errorDetail(error);
        console.warn('[ParisWorker] locale resync skipped: tokyo saved config unavailable', { publicId, detail });
        warnings.push(`saved_config_unavailable:${publicId}:${detail}`);
        return null;
      });
      if (!savedState) continue;

      const baseConfig = savedState.config;
      const baseTextPack = buildL10nSnapshot(baseConfig, allowlist);
      const baseFingerprint = await computeBaseFingerprint(baseTextPack);
      const configPack = stripTextFromConfig(baseConfig, Object.keys(baseTextPack));
      const configFp = await jsonSha256Hex(configPack);

      const overlayLocales = Array.from(localesToSeed).filter((locale) => locale && locale !== nextBaseLocale);
      const { localeOpsByLocale, userOpsByLocale } = await resolveLocaleOverlayOps({
        loadRows: () => loadInstanceOverlays(env, publicId),
        locales: overlayLocales,
        baseFingerprint,
        warnMessage: '[ParisWorker] Failed to resolve overlays for locale resync',
        warnContext: { publicId },
      });

      const seoGeoLive = isSeoGeoLive({
        policy,
        config: baseConfig,
      });

      const localeTextPacks = buildLocaleTextPacks({
        locales: Array.from(localesToSeed).filter((locale) => nextAvailableLocales.includes(locale)),
        baseLocale: nextBaseLocale,
        basePack: baseTextPack,
        localeOpsByLocale,
        userOpsByLocale,
      });

      const textFailures = await enqueueLocaleTextPacks({
        publicId,
        localeTextPacks,
        enqueue: (job) => enqueueTokyoMirrorJob(env, job),
      });
      logMirrorEnqueueFailures({
        kind: 'write-text-pack',
        failures: textFailures,
        context: 'account locales put',
      });
      if (textFailures.length) {
        warnings.push(`write_text_pack_failed:${publicId}:${textFailures.length}`);
      }

      if (seoGeoLive) {
        const metaFailures = await enqueueLocaleMetaPacks({
          publicId,
          widgetType,
          configPack,
          localeTextPacks,
          enqueue: (job) => enqueueTokyoMirrorJob(env, job),
        });
        logMirrorEnqueueFailures({
          kind: 'write-meta-pack',
          failures: metaFailures,
          context: 'account locales put',
        });
        if (metaFailures.length) {
          warnings.push(`write_meta_pack_failed:${publicId}:${metaFailures.length}`);
        }
      }

      const syncError = await enqueueLiveSurfaceSync({
        publicId,
        widgetType,
        configFp,
        localePolicy,
        seoGeo: seoGeoLive,
        enqueue: (job) => enqueueTokyoMirrorJob(env, job),
      });
      logMirrorEnqueueError({
        kind: 'sync-live-surface',
        error: syncError,
        context: 'account locales put',
      });
      if (syncError) {
        warnings.push(`sync_live_surface_failed:${publicId}:${syncError}`);
      }

      if (addedAdditionalLocales.length > 0) {
        const enqueueResult = await enqueueL10nJobs({
          env,
          instance,
          account,
          widgetType,
          config: baseConfig,
          baseUpdatedAt: savedState.updatedAt,
          policy,
          localesOverride: addedAdditionalLocales,
          allowNoDiff: true,
        });
        if (!enqueueResult.ok) {
          console.error('[ParisWorker] l10n enqueue failed (account locales put)', enqueueResult.error);
          warnings.push(`enqueue_l10n_failed:${publicId}:${enqueueResult.error}`);
        }
      }
    }
  }
  return warnings;
}

export async function handleAccountLocalesAftermath(req: Request, env: Env, accountId: string) {
  if (!isTrustedInternalServiceRequest(req, env)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
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

  const previousLocalesResult = normalizeLocaleList((payload as any).previousLocales, 'previousLocales');
  if (!previousLocalesResult.ok) {
    return json(previousLocalesResult.issues, { status: 422 });
  }

  const nextLocalesResult = normalizeLocaleList((payload as any).nextLocales, 'nextLocales');
  if (!nextLocalesResult.ok) {
    return json(nextLocalesResult.issues, { status: 422 });
  }

  const accountResult = await requireAccount(env, accountId);
  if (!accountResult.ok) return accountResult.response;

  const policy = resolvePolicy({
    profile: accountResult.account.tier,
    role: 'editor',
  });

  const warnings = await runAccountLocalesAftermath({
    env,
    accountId,
    account: accountResult.account,
    policy,
    previousLocales: previousLocalesResult.locales,
    previousPolicyRaw: (payload as any).previousPolicy ?? null,
    nextLocales: nextLocalesResult.locales,
    nextPolicyRaw: (payload as any).nextPolicy ?? null,
  });
  if (warnings.length > 0) {
    return json(
      {
        ok: false,
        accountId,
        warnings,
        error: {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.writeFailed',
          detail: 'locales_aftermath_degraded',
        },
      },
      { status: 502 },
    );
  }

  return json({
    ok: true,
    accountId,
  });
}
