import { can } from '@clickeen/ck-policy';
import { computeBaseFingerprint } from '@clickeen/l10n';
import type { CuratedInstanceRow, Env, InstanceRow, UpdatePayload } from '../../shared/types';
import { readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import {
  assertConfig,
  assertDisplayName,
  assertMeta,
  assertStatus,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { consumeBudget } from '../../shared/budgets';
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
  enqueueRenderSnapshot,
  loadEnforcement,
  loadRenderSnapshotState,
  normalizeActiveEnforcement,
  resolveRenderSnapshotLocales,
  waitForEnSnapshotReady,
} from './service';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  enforceLimits,
  resolveCuratedMetaUpdate,
  rollbackInstanceWriteAfterPostCommitFailure,
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
  if (isCurated && status === 'unpublished') {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.status.invalid',
        detail: 'Curated instances are always published',
      },
      422,
    );
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
      : !isCurated && statusChanged && prevStatus !== 'published' && nextStatus === 'published'
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

  const update: Record<string, unknown> = {};
  if (config !== undefined) update.config = config;
  if (isCurated) {
    update.status = 'published';
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
    const rollbackAndReturn = async (response: Response): Promise<Response> => {
      await rollbackInstanceWriteAfterPostCommitFailure({
        env,
        workspaceId,
        publicId,
        before: instance,
        isCurated,
        accountId: workspace.account_id,
      });
      return response;
    };

    const configForUsageSync =
      configChanged
        ? config
        : !isCurated && statusChanged && prevStatus !== 'published' && nextStatus === 'published'
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
        return rollbackAndReturn(
          ckError(
            {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.l10n.enqueueFailed',
              detail: enqueueResult.error,
            },
            500,
          ),
        );
      }
    }

    // Keep Venice snapshots correct for the public embed path (PRD 38).
    // When status/config changes for published instances, regenerate render snapshots.
    // When an instance is unpublished, delete the snapshot index to enforce "published-only".
    const updatedPrevStatus = prevStatus;
    const updatedNextStatus = updatedInstance.status;
    if (updatedNextStatus === 'published' && (statusChanged || configChanged)) {
      const { locales: activeLocales } = await resolveRenderSnapshotLocales({
        env,
        publicId,
        workspaceLocales: workspace.l10n_locales,
        policy: policyResult.policy,
      });
      const maxRegens = policyResult.policy.budgets['budget.snapshots.regens']?.max ?? null;
      const regen = await consumeBudget({
        env,
        scope: { kind: 'workspace', workspaceId },
        budgetKey: 'budget.snapshots.regens',
        max: maxRegens,
        amount: 1,
      });
      if (!regen.ok) {
        return rollbackAndReturn(
          ckError(
            {
              kind: 'DENY',
              reasonKey: regen.reasonKey,
              upsell: 'UP',
              detail: regen.detail,
            },
            403,
          ),
        );
      }
      const baselineSnapshotState = await loadRenderSnapshotState({
        env,
        publicId,
      }).catch(() => null);
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: activeLocales,
      });
      if (!enqueue.ok) {
        return rollbackAndReturn(
          ckError(
            {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.publish.failed',
              detail: enqueue.error,
            },
            503,
          ),
        );
      }
      const enReady = await waitForEnSnapshotReady({
        env,
        publicId,
        baselinePointerUpdatedAt: baselineSnapshotState?.pointerUpdatedAt ?? null,
        baselineRevision: baselineSnapshotState?.revision ?? null,
      });
      if (!enReady.ok) {
        return rollbackAndReturn(
          ckError(
            {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.publish.failed',
              detail: enReady.error,
            },
            503,
          ),
        );
      }
    } else if (
      !isCurated &&
      updatedPrevStatus === 'published' &&
      updatedNextStatus === 'unpublished'
    ) {
      const enqueue = await enqueueRenderSnapshot(env, { publicId, action: 'delete' });
      if (!enqueue.ok) {
        return rollbackAndReturn(
          ckError(
            {
              kind: 'INTERNAL',
              reasonKey: 'coreui.errors.publish.failed',
              detail: enqueue.error,
            },
            503,
          ),
        );
      }
    }
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}
