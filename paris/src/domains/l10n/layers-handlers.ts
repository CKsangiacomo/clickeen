import type { Env, InstanceOverlayRow, L10nPublishQueueJob } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { apiError, ckError } from '../../shared/errors';
import { asTrimmedString, isRecord } from '../../shared/validation';
import {
  hasLocaleSuffix,
  loadWidgetLayerAllowlist,
  normalizeGeoCountries,
  normalizeL10nSource,
  normalizeLayer,
  normalizeLayerKey,
  resolveUserOps,
  validateL10nOps,
} from '../../shared/l10n';
import {
  assertPublicId,
  assertWidgetType,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';
import { consumeBudget } from '../../shared/budgets';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import { supabaseFetch } from '../../shared/supabase';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import {
  loadInstanceOverlay,
  loadInstanceOverlays,
  loadL10nGenerateStateRow,
  markL10nPublishDirty,
  updateL10nGenerateStatus,
} from './service';
import { enforceLayerEntitlement } from './shared';
import { resolveL10nPlanningSnapshot } from './planning';

export async function handleWorkspaceInstanceLayersList(
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

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

  const rows = await loadInstanceOverlays(env, publicIdResult.value);
  return json({
    publicId: instance.public_id,
    workspaceId: resolveInstanceWorkspaceId(instance),
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

export async function handleWorkspaceInstanceLayerGet(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
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

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);

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
    workspaceId: row.workspace_id ?? null,
    updatedAt: row.updated_at ?? null,
  });
}

export async function handleWorkspaceInstanceLayerUpsert(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
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

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

  const instanceKind = resolveInstanceKind(instance);
  const instanceWorkspaceId = resolveInstanceWorkspaceId(instance);
  if (instanceKind === 'user') {
    if (!instanceWorkspaceId) {
      return apiError('WORKSPACE_MISMATCH', 'Instance missing workspace', 403, { publicId });
    }
    if (instanceWorkspaceId !== workspaceId) {
      return apiError('WORKSPACE_MISMATCH', 'Instance does not belong to workspace', 403, {
        publicId,
        workspaceId,
      });
    }
    if (layer === 'locale') {
      const normalized = normalizeLocaleList(workspace.l10n_locales, 'l10n_locales');
      if (!normalized.ok) {
        return apiError('LOCALE_INVALID', 'Workspace locales invalid', 500, normalized.issues);
      }
      if (!normalized.locales.includes(layerKey)) {
        return apiError('LOCALE_NOT_ENTITLED', 'Locale not enabled for workspace', 403, {
          locale: layerKey,
          workspaceId: instanceWorkspaceId,
        });
      }
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
    scope: { kind: 'workspace', workspaceId },
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
      workspace_id: instanceWorkspaceId,
    };

    const upsertRes = await supabaseFetch(
      env,
      `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`,
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payloadRow),
      },
    );
    if (!upsertRes.ok) {
      const details = await readJson(upsertRes);
      return apiError('INTERNAL_ERROR', 'Failed to upsert layer', 500, details);
    }

    const rows = (await upsertRes.json().catch(() => [])) as InstanceOverlayRow[];
    row = rows?.[0] ?? null;
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
        workspace_id: instanceWorkspaceId,
      };
      const insertRes = await supabaseFetch(
        env,
        `/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`,
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payloadRow),
        },
      );
      if (!insertRes.ok) {
        const details = await readJson(insertRes);
        return apiError('INTERNAL_ERROR', 'Failed to create layer overrides', 500, details);
      }
      const rows = (await insertRes.json().catch(() => [])) as InstanceOverlayRow[];
      row = rows?.[0] ?? null;
    } else {
      const patchRes = await supabaseFetch(
        env,
        `/rest/v1/widget_instance_overlays?public_id=eq.${encodeURIComponent(
          publicIdResult.value,
        )}&layer=eq.${encodeURIComponent(layer)}&layer_key=eq.${encodeURIComponent(layerKey)}`,
        {
          method: 'PATCH',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ user_ops: userOpsResult.ops }),
        },
      );
      if (!patchRes.ok) {
        const details = await readJson(patchRes);
        return apiError('INTERNAL_ERROR', 'Failed to update layer overrides', 500, details);
      }
      const rows = (await patchRes.json().catch(() => [])) as InstanceOverlayRow[];
      row = rows?.[0] ?? null;
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
          workspaceId: instanceWorkspaceId ?? workspaceId ?? null,
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

  if (!env.L10N_PUBLISH_QUEUE) {
    return apiError('INTERNAL_ERROR', 'L10N_PUBLISH_QUEUE missing', 500);
  }
  const markDirty = await markL10nPublishDirty({
    env,
    publicId: publicIdResult.value,
    layer,
    layerKey,
    baseFingerprint: computedFingerprint,
  });
  if (markDirty) return markDirty;
  try {
    await env.L10N_PUBLISH_QUEUE.send({
      v: 2,
      publicId: publicIdResult.value,
      layer,
      layerKey,
      action: 'upsert',
    } satisfies L10nPublishQueueJob);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to enqueue publish job', 500, detail);
  }

  const resolvedSource = row?.source ?? source ?? null;
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

export async function handleWorkspaceInstanceLayerDelete(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
  layerRaw: string,
  layerKeyRaw: string,
) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
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

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance) return apiError('INSTANCE_NOT_FOUND', 'Instance not found', 404, { publicId });

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
    scope: { kind: 'workspace', workspaceId },
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

  const deleteRes = await supabaseFetch(
    env,
    `/rest/v1/widget_instance_overlays?public_id=eq.${encodeURIComponent(
      publicIdResult.value,
    )}&layer=eq.${encodeURIComponent(layer)}&layer_key=eq.${encodeURIComponent(layerKey)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    },
  );
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    return apiError('INTERNAL_ERROR', 'Failed to delete layer overlay', 500, details);
  }

  if (!env.L10N_PUBLISH_QUEUE) {
    return apiError('INTERNAL_ERROR', 'L10N_PUBLISH_QUEUE missing', 500);
  }
  const markDirty = await markL10nPublishDirty({
    env,
    publicId: publicIdResult.value,
    layer,
    layerKey,
    baseFingerprint: computedFingerprint,
  });
  if (markDirty) return markDirty;
  try {
    await env.L10N_PUBLISH_QUEUE.send({
      v: 2,
      publicId: publicIdResult.value,
      layer,
      layerKey,
      action: 'delete',
    } satisfies L10nPublishQueueJob);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', 'Failed to enqueue publish job', 500, detail);
  }

  return json({ publicId: publicIdResult.value, layer, layerKey, deleted: true });
}
