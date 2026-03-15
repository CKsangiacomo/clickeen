import {
  resolvePolicyFromEntitlementsSnapshot,
  type Policy,
  type PolicyEntitlementsSnapshot,
} from '@clickeen/ck-policy';
import type { AccountRow, Env, InstanceRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError, errorDetail } from '../../shared/errors';
import { asTrimmedString, isRecord } from '../../shared/validation';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import { loadWidgetLocalizationAllowlist, normalizeLocaleList, resolveAccountL10nPolicy } from '../../shared/l10n';
import { isTrustedInternalServiceRequest } from '../../shared/auth';
import { supabaseFetch } from '../../shared/supabase';
import { requireAccount } from '../../shared/accounts';
import { enqueueL10nJobs } from './enqueue-jobs';
import { loadSavedConfigStateFromTokyo, resolveActivePublishLocales } from '../account-instances/service';
import { convergePublishedInstanceSurface } from '../account-instances/published-convergence';
import { resolveInstanceAccountId } from '../../shared/instances';

function normalizeEntitlementsSnapshot(value: unknown): PolicyEntitlementsSnapshot | null {
  if (!isRecord(value)) return null;
  return value as PolicyEntitlementsSnapshot;
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
    baseLocale: prevBaseLocale,
  }).locales;
  const nextAvailableLocales = resolveActivePublishLocales({
    accountLocales: nextLocales,
    baseLocale: nextBaseLocale,
  }).locales;

  const baseLocaleChanged = prevBaseLocale !== nextBaseLocale;
  const addedLocales = nextAvailableLocales.filter((locale) => !prevAvailableLocales.includes(locale));
  const removedLocales = prevAvailableLocales.filter((locale) => !nextAvailableLocales.includes(locale));
  const policyChanged = JSON.stringify(prevPolicy) !== JSON.stringify(nextPolicyResolved);

  if (env.RENDER_SNAPSHOT_QUEUE && (baseLocaleChanged || policyChanged || addedLocales.length > 0 || removedLocales.length > 0)) {
    const publishedInstances: InstanceRow[] = [];
    const widgetTypeByPublicId = new Map<string, string>();
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

    offset = 0;
    while (true) {
      const params = new URLSearchParams({
        select: 'public_id,status,created_at,updated_at,widget_type,owner_account_id,kind',
        owner_account_id: `eq.${accountId}`,
        status: 'eq.published',
        limit: String(pageSize),
        offset: String(offset),
      });
      const curatedRes = await supabaseFetch(
        env,
        `/rest/v1/curated_widget_instances?${params.toString()}`,
        { method: 'GET' },
      );
      if (!curatedRes.ok) {
        const details = await readJson(curatedRes).catch(() => null);
        console.error('[ParisWorker] Failed to load curated account instances for locale resync', details);
        warnings.push(`load_published_curated_instances_failed:${JSON.stringify(details)}`);
        break;
      }
      const rows =
        ((await curatedRes.json().catch(() => null)) as Array<{
          public_id?: string;
          status?: 'published' | 'unpublished';
          created_at?: string;
          updated_at?: string | null;
          widget_type?: string | null;
          kind?: string | null;
        }> | null) ?? [];
      const curatedInstances: InstanceRow[] = [];
      rows.forEach((row) => {
        const publicId = asTrimmedString(row?.public_id);
        const widgetType = asTrimmedString(row?.widget_type);
        const status = row?.status === 'published' ? row.status : null;
        const createdAt = asTrimmedString(row?.created_at);
        if (!publicId || !widgetType || !status || !createdAt) return;
        widgetTypeByPublicId.set(publicId, widgetType);
        curatedInstances.push({
          public_id: publicId,
          status,
          created_at: createdAt,
          updated_at: asTrimmedString(row?.updated_at) ?? null,
          widget_id: null,
          account_id: accountId,
          kind: 'curated',
          config: {},
        });
      });
      publishedInstances.push(...curatedInstances);
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
      const widgetType =
        widgetTypeByPublicId.get(publicId) ??
        (instance.widget_id ? widgetTypeById.get(instance.widget_id) ?? null : null);
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
      const convergenceError = await convergePublishedInstanceSurface({
        env,
        account,
        policy,
        publicId,
        widgetType,
        config: baseConfig,
        baseTextPack,
        writeTextPacks: true,
        writeConfigPack: false,
        syncLiveSurface: true,
        context: 'account locales put',
      });
      if (convergenceError) {
        warnings.push(`published_convergence_failed:${publicId}:${convergenceError}`);
      }

      if (addedAdditionalLocales.length > 0) {
        const enqueueResult = await enqueueL10nJobs({
          env,
          instance,
          account,
          widgetType,
          config: baseConfig,
          baseUpdatedAt: savedState.updatedAt,
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

  const entitlements = normalizeEntitlementsSnapshot((payload as { entitlements?: unknown }).entitlements);
  if (!entitlements) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: accountResult.account.tier,
    role: 'editor',
    entitlements,
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
