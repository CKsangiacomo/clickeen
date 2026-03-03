import type { Env, InstanceRow, L10nGenerateStateRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { apiError, ckError } from '../../shared/errors';
import { isRecord } from '../../shared/validation';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import { normalizeLocaleList, parseWorkspaceL10nPolicy, loadWidgetLocalizationAllowlist, resolveWorkspaceL10nPolicy } from '../../shared/l10n';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import { supabaseFetch } from '../../shared/supabase';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadL10nGenerateStates, loadInstanceOverlays } from './service';
import { enqueueL10nJobs } from './enqueue-jobs';
import { resolveL10nPlanningSnapshot } from './planning';
import { enforceL10nSelection, resolveWorkspaceActiveLocales } from './shared';
import { applyTextPackToConfig, materializeTextPack, stripTextFromConfig } from '../../shared/mirror-packs';
import { jsonSha256Hex } from '../../shared/stable-json';
import { generateMetaPack } from '../../shared/seo-geo';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from '../workspaces/service';

export async function handleWorkspaceInstanceL10nStatus(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: instance.config,
    baseUpdatedAt: instance.updated_at ?? null,
  });
  if (!planning.ok) {
    return apiError('INTERNAL_ERROR', 'Failed to resolve l10n planning snapshot', 500, planning.error);
  }
  const baseFingerprint = planning.plan.baseFingerprint;
  const baseUpdatedAt = planning.plan.baseUpdatedAt;

  const workspaceLocales = resolveWorkspaceActiveLocales({ workspace });
  if (workspaceLocales instanceof Response) return workspaceLocales;
  const locales = workspaceLocales.locales;
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

export async function handleWorkspaceInstanceL10nEnqueueSelected(
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

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const workspaceLocales = resolveWorkspaceActiveLocales({ workspace });
  if (workspaceLocales instanceof Response) return workspaceLocales;
  const locales = workspaceLocales.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  const baseUpdatedAt = instance.updated_at ?? null;
  const enqueueResult = await enqueueL10nJobs({
    env,
    instance,
    workspace,
    widgetType,
    baseUpdatedAt,
    policy: policyResult.policy,
    localesOverride: locales,
    allowNoDiff: true,
  });
  if (!enqueueResult.ok) {
    console.error('[ParisWorker] l10n enqueue failed (enqueue-selected)', enqueueResult.error);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.l10n.enqueueFailed',
        detail: enqueueResult.error,
      },
      500,
    );
  }

  return json({
    ok: true,
    publicId,
    widgetType,
    queued: enqueueResult.queued,
    skipped: enqueueResult.skipped,
  });
}

export async function handleWorkspaceLocalesGet(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const resolved = resolveWorkspaceActiveLocales({ workspace });
  if (resolved instanceof Response) return resolved;
  return json({ locales: resolved.locales, policy: resolveWorkspaceL10nPolicy(workspace.l10n_policy) });
}

export async function handleWorkspaceLocalesPut(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  if (!isRecord(payload)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const localesResult = normalizeLocaleList((payload as any).locales, 'locales');
  if (!localesResult.ok) {
    return json(localesResult.issues, { status: 422 });
  }

  const locales = localesResult.locales;
  const entitlementGate = enforceL10nSelection(policyResult.policy, locales);
  if (entitlementGate) return entitlementGate;

  let nextPolicy = workspace.l10n_policy;
  if (Object.prototype.hasOwnProperty.call(payload, 'policy')) {
    const policyRaw = (payload as any).policy;
    if (policyRaw != null) {
      const policyResult = parseWorkspaceL10nPolicy(policyRaw);
      if (!policyResult.ok) {
        return json(policyResult.issues, { status: 422 });
      }
      nextPolicy = policyResult.policy;
    } else {
      nextPolicy = null;
    }
  }

  const patchRes = await supabaseFetch(
    env,
    `/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ l10n_locales: locales, l10n_policy: nextPolicy }),
    },
  );
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

  const prevPolicy = resolveWorkspaceL10nPolicy(workspace.l10n_policy);
  const nextPolicyResolved = resolveWorkspaceL10nPolicy(nextPolicy);
  const prevBaseLocale = prevPolicy.baseLocale;
  const nextBaseLocale = nextPolicyResolved.baseLocale;
  const prevAvailableLocales = resolveActivePublishLocales({
    workspaceLocales: workspace.l10n_locales,
    policy: policyResult.policy,
    baseLocale: prevBaseLocale,
  }).locales;
  const nextAvailableLocales = resolveActivePublishLocales({
    workspaceLocales: locales,
    policy: policyResult.policy,
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
        select: 'public_id,status,config,created_at,updated_at,widget_id,workspace_id,kind',
        workspace_id: `eq.${workspaceId}`,
        status: 'eq.published',
        limit: String(pageSize),
        offset: String(offset),
      });
      const instancesRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
        method: 'GET',
      });
      if (!instancesRes.ok) {
        const details = await readJson(instancesRes).catch(() => null);
        console.error('[ParisWorker] Failed to load workspace instances for locale resync', details);
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
      }
    }

    const allowlistCache = new Map<string, Array<{ path: string; type: 'string' | 'richtext' }>>();
    const localesToSeed = new Set<string>(addedLocales);
    if (baseLocaleChanged) localesToSeed.add(nextBaseLocale);
    const addedWorkspaceLocales = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
    const previousAdditionalLocales = addedWorkspaceLocales.ok ? addedWorkspaceLocales.locales : [];
    const addedAdditionalLocales = locales.filter((locale) => !previousAdditionalLocales.includes(locale));

    for (const instance of publishedInstances) {
      const publicId = String(instance.public_id || '').trim();
      if (!publicId) continue;
      const widgetType = instance.widget_id ? widgetTypeById.get(instance.widget_id) ?? null : null;
      if (!widgetType) {
        console.warn('[ParisWorker] locale resync skipped: widgetType missing', { publicId });
        continue;
      }

      let allowlist = allowlistCache.get(widgetType) ?? null;
      if (!allowlist) {
        try {
          allowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
          allowlistCache.set(widgetType, allowlist);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn('[ParisWorker] locale resync skipped: allowlist missing', { publicId, widgetType, detail });
          continue;
        }
      }

      const baseTextPack = buildL10nSnapshot(instance.config, allowlist);
      const baseFingerprint = await computeBaseFingerprint(baseTextPack);
      const configPack = stripTextFromConfig(instance.config, Object.keys(baseTextPack));
      const configFp = await jsonSha256Hex(configPack);

      const overlayLocales = Array.from(localesToSeed).filter((locale) => locale && locale !== nextBaseLocale);
      const overlayLocaleSet = new Set(overlayLocales);
      const localeOpsByLocale = new Map<string, Array<{ op: 'set'; path: string; value: unknown }>>();
      const userOpsByLocale = new Map<string, Array<{ op: 'set'; path: string; value: unknown }>>();
      if (overlayLocales.length > 0) {
        try {
          const params = new URLSearchParams({
            select: 'layer,layer_key,ops',
            public_id: `eq.${publicId}`,
            layer: 'in.(locale,user)',
            base_fingerprint: `eq.${baseFingerprint}`,
            limit: '1000',
          });
          const overlaysRes = await supabaseFetch(env, `/rest/v1/widget_instance_overlays?${params.toString()}`, {
            method: 'GET',
          });
          if (overlaysRes.ok) {
            const rows =
              ((await overlaysRes.json().catch(() => null)) as Array<{ layer?: string | null; layer_key?: string | null; ops?: unknown }> | null) ??
              [];
            rows.forEach((row) => {
              const layer = typeof row?.layer === 'string' ? row.layer.trim().toLowerCase() : '';
              const locale = typeof row?.layer_key === 'string' ? row.layer_key.trim() : '';
              if (!locale || !overlayLocaleSet.has(locale)) return;
              if (!Array.isArray(row.ops)) return;
              if (layer === 'locale') {
                localeOpsByLocale.set(locale, row.ops as Array<{ op: 'set'; path: string; value: unknown }>);
              } else if (layer === 'user') {
                userOpsByLocale.set(locale, row.ops as Array<{ op: 'set'; path: string; value: unknown }>);
              }
            });
          } else {
            const details = await readJson(overlaysRes).catch(() => null);
            console.warn('[ParisWorker] Failed to load overlays for locale resync', { publicId, details });
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn('[ParisWorker] Failed to resolve overlays for locale resync', { publicId, detail });
        }
      }

      const seoGeoEntitled = policyResult.policy.flags['embed.seoGeo.enabled'] === true;
      const seoGeoConfigEnabled = Boolean((instance.config as any)?.seoGeo?.enabled === true);
      const seoGeoLive = seoGeoEntitled && seoGeoConfigEnabled;

      for (const locale of localesToSeed) {
        if (!nextAvailableLocales.includes(locale)) continue;
        const textPack =
          locale === nextBaseLocale
            ? { ...baseTextPack }
            : materializeTextPack({
                basePack: baseTextPack,
                localeOps: localeOpsByLocale.get(locale) ?? null,
                userOps: userOpsByLocale.get(locale) ?? null,
              });

        const enqueueText = await enqueueTokyoMirrorJob(env, {
          v: 1,
          kind: 'write-text-pack',
          publicId,
          locale,
          textPack,
        });
        if (!enqueueText.ok) {
          console.error('[ParisWorker] tokyo write-text-pack enqueue failed (workspace locales put)', enqueueText.error);
        }

        if (seoGeoLive) {
          const metaState = applyTextPackToConfig(configPack, textPack);
          const metaPack = generateMetaPack({ widgetType, state: metaState, locale });
          const enqueueMeta = await enqueueTokyoMirrorJob(env, {
            v: 1,
            kind: 'write-meta-pack',
            publicId,
            locale,
            metaPack,
          });
          if (!enqueueMeta.ok) {
            console.error('[ParisWorker] tokyo write-meta-pack enqueue failed (workspace locales put)', enqueueMeta.error);
          }
        }
      }

      const sync = await enqueueTokyoMirrorJob(env, {
        v: 1,
        kind: 'sync-live-surface',
        publicId,
        live: true,
        widgetType,
        configFp,
        localePolicy,
        seoGeo: seoGeoLive,
      });
      if (!sync.ok) {
        console.error('[ParisWorker] tokyo sync-live-surface enqueue failed (workspace locales put)', sync.error);
      }

      if (addedAdditionalLocales.length > 0) {
        const enqueueResult = await enqueueL10nJobs({
          env,
          instance,
          workspace,
          widgetType,
          baseUpdatedAt: instance.updated_at ?? null,
          policy: policyResult.policy,
          localesOverride: addedAdditionalLocales,
          allowNoDiff: true,
        });
        if (!enqueueResult.ok) {
          console.error('[ParisWorker] l10n enqueue failed (workspace locales put)', enqueueResult.error);
        }
      }
    }
  }

  return json({ locales, policy: resolveWorkspaceL10nPolicy(nextPolicy) });
}
