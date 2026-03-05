import type { Env, InstanceOverlayRow } from '../../shared/types';
import { json } from '../../shared/http';
import { apiError, ckError } from '../../shared/errors';
import { asTrimmedString, isRecord } from '../../shared/validation';
import {
  hasLocaleSuffix,
  loadWidgetLayerAllowlist,
  normalizeGeoCountries,
  normalizeL10nSource,
  normalizeLocaleList,
  normalizeLayer,
  normalizeLayerKey,
  resolveUserOps,
  validateL10nOps,
  resolveAccountL10nPolicy,
} from '../../shared/l10n';
import {
  assertPublicId,
  assertWidgetType,
  resolveInstanceKind,
  resolveInstanceAccountId,
} from '../../shared/instances';
import { consumeBudget } from '../../shared/budgets';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeAccount } from '../../shared/account-auth';
import { resolveAdminAccountId } from '../../shared/admin';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import {
  deleteInstanceOverlay,
  loadInstanceOverlay,
  loadInstanceOverlays,
  loadL10nGenerateStateRow,
  upsertInstanceOverlay,
  updateL10nGenerateStatus,
} from './service';
import { enforceLayerEntitlement } from './shared';
import { resolveL10nPlanningSnapshot } from './planning';
import { enqueueTokyoMirrorJob, resolveActivePublishLocales } from '../account-instances/service';
import { applyTextPackToConfig, materializeTextPack, stripTextFromConfig } from '../../shared/mirror-packs';
import { generateMetaPack } from '../../shared/seo-geo';

export async function handleAccountInstanceLayersList(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const adminAccountId = resolveAdminAccountId(env);
  if (resolveInstanceKind(instance) === 'curated' && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  const rows = await loadInstanceOverlays(env, publicIdResult.value);
  return json({
    publicId: instance.public_id,
    accountId,
    layers: rows.map((row) => {
      const { userOps } = resolveUserOps(row);
      return {
        layer: row.layer,
        layerKey: row.layer_key,
        source: row.source,
        baseFingerprint: row.base_fingerprint,
        baseUpdatedAt: row.base_updated_at ?? null,
        geoTargets: row.geo_targets ?? null,
        updatedAt: row.updated_at ?? null,
        hasUserOps: userOps.length > 0,
      };
    }),
  });
}

export async function handleAccountInstanceLayerGet(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const adminAccountId = resolveAdminAccountId(env);
  if (resolveInstanceKind(instance) === 'curated' && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  const row = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  if (!row) {
    return apiError('LAYER_NOT_FOUND', 'Layer overlay not found', 404, {
      publicId,
      layer,
      layerKey,
    });
  }

  const { userOps } = resolveUserOps(row);
  return json({
    publicId: row.public_id,
    layer: row.layer,
    layerKey: row.layer_key,
    source: row.source,
    ops: row.ops,
    userOps,
    baseFingerprint: row.base_fingerprint,
    baseUpdatedAt: row.base_updated_at ?? null,
    geoTargets: row.geo_targets ?? null,
    accountId: row.account_id ?? accountId,
    updatedAt: row.updated_at ?? null,
  });
}

export async function handleAccountInstanceLayerUpsert(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }
  if (layer === 'locale' && hasLocaleSuffix(publicIdResult.value, layerKey)) {
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, {
      publicId,
      locale: layerKey,
    });
  }
  if (
    layer === 'user' &&
    layerKey !== 'global' &&
    hasLocaleSuffix(publicIdResult.value, layerKey)
  ) {
    return apiError('LOCALE_INVALID', 'publicId must be locale-free', 400, {
      publicId,
      locale: layerKey,
    });
  }

  const entitlementGate = enforceLayerEntitlement(policyResult.policy, layer);
  if (entitlementGate) return entitlementGate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError('OPS_INVALID_TYPE', 'Invalid JSON payload', 400);
  }
  if (!isRecord(payload)) {
    return apiError('OPS_INVALID_TYPE', 'Payload must be an object', 400);
  }

  const hasOps = Object.prototype.hasOwnProperty.call(payload, 'ops');
  const hasUserOps = Object.prototype.hasOwnProperty.call(payload, 'userOps');
  if (!hasOps && !hasUserOps) {
    return apiError('OPS_INVALID_TYPE', 'ops or userOps required', 400);
  }
  if (hasUserOps && layer !== 'user') {
    return apiError('OPS_INVALID_TYPE', 'userOps only allowed for layer=user', 400, { layer });
  }

  const hasGeoTargets = Object.prototype.hasOwnProperty.call(payload, 'geoTargets');
  if (hasGeoTargets && layer !== 'locale') {
    return apiError('OPS_INVALID_TYPE', 'geoTargets only allowed for layer=locale', 400, { layer });
  }
  if (hasGeoTargets && !hasOps) {
    return apiError('OPS_INVALID_TYPE', 'geoTargets requires ops', 400);
  }

  const source = hasOps ? normalizeL10nSource((payload as any).source) : null;
  if (hasOps && !source) {
    return apiError('OPS_INVALID_TYPE', 'Invalid source', 400);
  }

  const baseFingerprintRaw = asTrimmedString((payload as any).baseFingerprint);
  const baseUpdatedAtRaw = asTrimmedString((payload as any).baseUpdatedAt);
  const widgetTypeRaw = asTrimmedString((payload as any).widgetType);

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

  const instanceKind = resolveInstanceKind(instance);
  const adminAccountId = resolveAdminAccountId(env);
  if (instanceKind === 'curated' && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }
  if (instanceKind === 'user' && layer === 'locale') {
    const normalized = normalizeLocaleList(account.l10n_locales, 'l10n_locales');
    if (!normalized.ok) {
      return apiError('LOCALE_INVALID', 'Account locales invalid', 500, normalized.issues);
    }
    if (!normalized.locales.includes(layerKey)) {
      return apiError('LOCALE_NOT_ENTITLED', 'Locale not enabled for account', 403, {
        locale: layerKey,
        accountId,
      });
    }
  }

  let widgetTypeFallback: string | null = null;
  if (widgetTypeRaw) {
    const widgetTypeResult = assertWidgetType(widgetTypeRaw);
    if (!widgetTypeResult.ok) {
      return apiError('OPS_INVALID_TYPE', 'Invalid widgetType', 400, widgetTypeResult.issues);
    }
    widgetTypeFallback = widgetTypeResult.value;
  }
  const widgetType = await resolveWidgetTypeForInstance(env, instance, widgetTypeFallback);
  if (!widgetType) {
    return apiError('INTERNAL_ERROR', 'widgetType required for allowlist', 500);
  }

  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: instance.config,
    baseUpdatedAt: baseUpdatedAtRaw ?? instance.updated_at ?? null,
  });
  if (!planning.ok) {
    return apiError('INTERNAL_ERROR', 'Failed to resolve l10n planning snapshot', 500, planning.error);
  }
  const computedFingerprint = planning.plan.baseFingerprint;
  const resolvedBaseUpdatedAt = planning.plan.baseUpdatedAt ?? baseUpdatedAtRaw ?? instance.updated_at ?? null;
  if (!baseFingerprintRaw) {
    return apiError('FINGERPRINT_MISMATCH', 'baseFingerprint required', 409);
  }
  if (baseFingerprintRaw !== computedFingerprint) {
    return apiError('FINGERPRINT_MISMATCH', 'baseFingerprint does not match', 409, {
      provided: baseFingerprintRaw,
    });
  }

  let allowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    allowlist = await loadWidgetLayerAllowlist(env, widgetType, layer);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to load layer allowlist', 500, detail);
  }
  const allowlistPaths = allowlist.map((entry) => entry.path);

  const existing = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  const existingUserOps = resolveUserOps(existing).userOps;

  const geoResult = hasGeoTargets
    ? normalizeGeoCountries((payload as any).geoTargets, 'geoTargets')
    : null;
  if (geoResult && !geoResult.ok) {
    return apiError('OPS_INVALID_TYPE', 'Invalid geoTargets', 400, geoResult.issues);
  }

  const opsResult = hasOps ? validateL10nOps((payload as any).ops, allowlistPaths) : null;
  if (hasOps && opsResult && !opsResult.ok) {
    return apiError(opsResult.code, opsResult.message, 400, opsResult.detail);
  }

  const userOpsResult = hasUserOps
    ? validateL10nOps((payload as any).userOps, allowlistPaths)
    : null;
  if (hasUserOps && userOpsResult && !userOpsResult.ok) {
    return apiError(userOpsResult.code, userOpsResult.message, 400, userOpsResult.detail);
  }

  const maxPublishes = policyResult.policy.budgets['budget.l10n.publishes']?.max ?? null;
  const publish = await consumeBudget({
    env,
    scope: { kind: 'account', accountId },
    budgetKey: 'budget.l10n.publishes',
    max: maxPublishes,
    amount: 1,
  });
  if (!publish.ok) {
    return ckError(
      { kind: 'DENY', reasonKey: publish.reasonKey, upsell: 'UP', detail: publish.detail },
      403,
    );
  }

  let row: InstanceOverlayRow | null = null;
  if (hasOps) {
    const geoTargets = hasGeoTargets
      ? (geoResult?.geoCountries ?? null)
      : (existing?.geo_targets ?? null);
    const payloadRow = {
      public_id: publicIdResult.value,
      layer,
      layer_key: layerKey,
      ops: opsResult?.ok ? opsResult.ops : [],
      user_ops:
        layer === 'user'
          ? hasUserOps && userOpsResult?.ok
            ? userOpsResult.ops
            : existingUserOps
          : [],
      base_fingerprint: computedFingerprint,
      base_updated_at: resolvedBaseUpdatedAt,
      source,
      geo_targets: geoTargets,
      account_id: instanceKind === 'user' ? accountId : null,
    };

    row = await upsertInstanceOverlay(env, payloadRow as InstanceOverlayRow);
  } else if (hasUserOps && userOpsResult?.ok) {
    if (!existing) {
      const payloadRow = {
        public_id: publicIdResult.value,
        layer,
        layer_key: layerKey,
        ops: [],
        user_ops: userOpsResult.ops,
        base_fingerprint: computedFingerprint,
        base_updated_at: resolvedBaseUpdatedAt,
        source: 'user',
        geo_targets: null,
        account_id: instanceKind === 'user' ? accountId : null,
      };
      row = await upsertInstanceOverlay(env, payloadRow as InstanceOverlayRow);
    } else {
      row = await upsertInstanceOverlay(env, {
        ...existing,
        user_ops: userOpsResult.ops,
      });
    }
  }

  if (layer === 'locale') {
    const overlayFingerprint = row?.base_fingerprint ?? computedFingerprint;
    if (overlayFingerprint) {
      try {
        const existingState = await loadL10nGenerateStateRow(
          env,
          publicIdResult.value,
          layer,
          layerKey,
          overlayFingerprint,
        );
        const attempts = existingState?.attempts ?? 1;
        await updateL10nGenerateStatus({
          env,
          publicId: publicIdResult.value,
          layer,
          layerKey,
          baseFingerprint: overlayFingerprint,
          status: 'succeeded',
          widgetType,
          accountId,
          baseUpdatedAt: row?.base_updated_at ?? resolvedBaseUpdatedAt,
          attempts,
          nextAttemptAt: null,
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
          changedPaths: existingState?.changed_paths ?? null,
          removedPaths: existingState?.removed_paths ?? null,
        });
      } catch (error) {
        console.error('[ParisWorker] Failed to mark l10n generate state succeeded', error);
      }
    }
  }

  const resolvedSource = row?.source ?? source ?? null;

  if ((layer === 'locale' || layer === 'user') && instance.status === 'published') {
    const accountL10nPolicy = resolveAccountL10nPolicy(account.l10n_policy);
    const baseLocale = accountL10nPolicy.baseLocale;
    const activeLocales = resolveActivePublishLocales({
      accountLocales: account.l10n_locales,
      policy: policyResult.policy,
      baseLocale,
    }).locales;

    if (activeLocales.includes(layerKey)) {
      const baseTextPack = planning.plan.snapshot;
      let localeOps: Array<{ op: 'set'; path: string; value: unknown }> | null = null;
      let userOps: Array<{ op: 'set'; path: string; value: unknown }> | null = null;

      if (layerKey !== baseLocale) {
        try {
          const rows = await loadInstanceOverlays(env, publicIdResult.value);
          rows.forEach((overlay) => {
            if (overlay.layer_key !== layerKey) return;
            if (overlay.base_fingerprint !== computedFingerprint) return;
            if (!Array.isArray(overlay.ops)) return;
            if (overlay.layer === 'locale') {
              localeOps = overlay.ops;
            } else if (overlay.layer === 'user') {
              userOps = overlay.ops;
            }
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn('[ParisWorker] Failed to resolve overlays for pack mirroring', detail);
        }
      }

      const textPack =
        layerKey === baseLocale
          ? { ...baseTextPack }
          : materializeTextPack({ basePack: baseTextPack, localeOps, userOps });

      const enqueueText = await enqueueTokyoMirrorJob(env, {
        v: 1,
        kind: 'write-text-pack',
        publicId: publicIdResult.value,
        locale: layerKey,
        textPack,
      });
      if (!enqueueText.ok) {
        return apiError('INTERNAL_ERROR', 'Failed to enqueue tokyo text pack', 500, enqueueText.error);
      }

      const seoGeoEntitled = policyResult.policy.flags['embed.seoGeo.enabled'] === true;
      const seoGeoConfigEnabled = Boolean((instance.config as any)?.seoGeo?.enabled === true);
      const seoGeoLive = seoGeoEntitled && seoGeoConfigEnabled;
      if (seoGeoLive) {
        const configPack = stripTextFromConfig(instance.config, Object.keys(baseTextPack));
        const metaState = applyTextPackToConfig(configPack, textPack);
        const metaPack = generateMetaPack({ widgetType, state: metaState, locale: layerKey });
        const enqueueMeta = await enqueueTokyoMirrorJob(env, {
          v: 1,
          kind: 'write-meta-pack',
          publicId: publicIdResult.value,
          locale: layerKey,
          metaPack,
        });
        if (!enqueueMeta.ok) {
          return apiError('INTERNAL_ERROR', 'Failed to enqueue tokyo meta pack', 500, enqueueMeta.error);
        }
      }
    }
  }

  return json({
    publicId: publicIdResult.value,
    layer,
    layerKey,
    source: resolvedSource,
    baseFingerprint: row?.base_fingerprint ?? computedFingerprint,
    baseUpdatedAt: row?.base_updated_at ?? resolvedBaseUpdatedAt,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function handleAccountInstanceLayerDelete(
  req: Request,
  env: Env,
  accountId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;
  const account = authorized.account;

  const policyResult = resolveEditorPolicyFromRequest(req, account);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const layer = normalizeLayer(layerRaw);
  if (!layer) {
    return apiError('LAYER_INVALID', 'Invalid layer', 400, { layer: layerRaw });
  }
  const layerKey = normalizeLayerKey(layer, layerKeyRaw);
  if (!layerKey) {
    return apiError('LAYER_KEY_INVALID', 'Invalid layerKey', 400, { layer, layerKey: layerKeyRaw });
  }

  const instance = await loadInstanceByAccountAndPublicId(env, accountId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

  const adminAccountId = resolveAdminAccountId(env);
  if (resolveInstanceKind(instance) === 'curated' && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType) return apiError('INTERNAL_ERROR', 'widgetType required for allowlist', 500);
  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: instance.config,
    baseUpdatedAt: instance.updated_at ?? null,
  });
  if (!planning.ok) {
    return apiError('INTERNAL_ERROR', 'Failed to resolve l10n planning snapshot', 500, planning.error);
  }
  const computedFingerprint = planning.plan.baseFingerprint;

  const existing = await loadInstanceOverlay(env, publicIdResult.value, layer, layerKey);
  if (!existing) {
    return json({
      publicId: publicIdResult.value,
      layer,
      layerKey,
      deleted: false,
      reason: 'not_found',
    });
  }

  const maxPublishes = policyResult.policy.budgets['budget.l10n.publishes']?.max ?? null;
  const publish = await consumeBudget({
    env,
    scope: { kind: 'account', accountId },
    budgetKey: 'budget.l10n.publishes',
    max: maxPublishes,
    amount: 1,
  });
  if (!publish.ok) {
    return ckError(
      { kind: 'DENY', reasonKey: publish.reasonKey, upsell: 'UP', detail: publish.detail },
      403,
    );
  }

  await deleteInstanceOverlay(env, publicIdResult.value, layer, layerKey);

  if ((layer === 'locale' || layer === 'user') && instance.status === 'published') {
    const accountL10nPolicy = resolveAccountL10nPolicy(account.l10n_policy);
    const baseLocale = accountL10nPolicy.baseLocale;
    const activeLocales = resolveActivePublishLocales({
      accountLocales: account.l10n_locales,
      policy: policyResult.policy,
      baseLocale,
    }).locales;

    if (activeLocales.includes(layerKey)) {
      const baseTextPack = planning.plan.snapshot;
      let localeOps: Array<{ op: 'set'; path: string; value: unknown }> | null = null;
      let userOps: Array<{ op: 'set'; path: string; value: unknown }> | null = null;

      if (layerKey !== baseLocale) {
        try {
          const rows = await loadInstanceOverlays(env, publicIdResult.value);
          rows.forEach((overlay) => {
            if (overlay.layer_key !== layerKey) return;
            if (overlay.base_fingerprint !== computedFingerprint) return;
            if (!Array.isArray(overlay.ops)) return;
            if (overlay.layer === 'locale') {
              localeOps = overlay.ops;
            } else if (overlay.layer === 'user') {
              userOps = overlay.ops;
            }
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn('[ParisWorker] Failed to resolve overlays for pack mirroring', detail);
        }
      }

      const textPack =
        layerKey === baseLocale
          ? { ...baseTextPack }
          : materializeTextPack({ basePack: baseTextPack, localeOps, userOps });
      const enqueueText = await enqueueTokyoMirrorJob(env, {
        v: 1,
        kind: 'write-text-pack',
        publicId: publicIdResult.value,
        locale: layerKey,
        textPack,
      });
      if (!enqueueText.ok) {
        return apiError('INTERNAL_ERROR', 'Failed to enqueue tokyo text pack', 500, enqueueText.error);
      }

      const seoGeoEntitled = policyResult.policy.flags['embed.seoGeo.enabled'] === true;
      const seoGeoConfigEnabled = Boolean((instance.config as any)?.seoGeo?.enabled === true);
      const seoGeoLive = seoGeoEntitled && seoGeoConfigEnabled;
      if (seoGeoLive) {
        const configPack = stripTextFromConfig(instance.config, Object.keys(baseTextPack));
        const metaState = applyTextPackToConfig(configPack, textPack);
        const metaPack = generateMetaPack({ widgetType, state: metaState, locale: layerKey });
        const enqueueMeta = await enqueueTokyoMirrorJob(env, {
          v: 1,
          kind: 'write-meta-pack',
          publicId: publicIdResult.value,
          locale: layerKey,
          metaPack,
        });
        if (!enqueueMeta.ok) {
          return apiError('INTERNAL_ERROR', 'Failed to enqueue tokyo meta pack', 500, enqueueMeta.error);
        }
      }
    }
  }

  return json({ publicId: publicIdResult.value, layer, layerKey, deleted: true });
}
