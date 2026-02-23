import { can } from '@clickeen/ck-policy';
import type { CuratedInstanceRow, Env, InstanceRow, WidgetRow } from '../../shared/types';
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
  isRecord,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { consumeBudget } from '../../shared/budgets';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import {
  allowCuratedWrites,
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
  resolveCuratedRowKind,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';
import { loadInstanceByPublicId, loadWidgetByType } from '../instances';
import { enqueueL10nJobs } from '../l10n';
import { enqueueRenderSnapshot, resolveRenderSnapshotLocales } from './service';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  enforceLimits,
  rollbackCreatedInstanceAfterPostCommitFailure,
  rollbackCreatedInstanceOnUsageSyncFailure,
  syncAccountAssetUsageForInstanceStrict,
  titleCase,
  validateAccountAssetUsageForInstanceStrict,
} from './helpers';
import { handleWorkspaceGetInstance } from './read-handlers';

export async function handleWorkspaceCreateInstance(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const workspace = authorized.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
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

  if (isCurated && requestedStatus === 'unpublished') {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.status.invalid',
        detail: 'Curated instances are always published',
      },
      422,
    );
  }

  const status = isCurated ? 'published' : (requestedStatus ?? 'unpublished');

  if (isCurated && !allowCuratedWrites(env)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.curated.localOnly' }, 403);
  }
  if (!isCurated && (payload as any).meta !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  if (isCurated && (payload as any).displayName !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const existing = await loadInstanceByPublicId(env, publicId);
  if (existing) {
    const existingWorkspaceId = resolveInstanceWorkspaceId(existing);
    if (!isCurated && existingWorkspaceId && existingWorkspaceId !== workspaceId) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.conflict' }, 409);
    }
    return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
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

  const assetIssues = configAssetUrlContractIssues(config, workspace.account_id);
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
    accountId: workspace.account_id,
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
        owner_account_id: workspace.account_id,
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

    // Enforce distinct widget types cap (per workspace tier).
    // This is a packaging lever separate from instance slots: it limits how many widget types a workspace can use.
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
        workspace_id: `eq.${workspaceId}`,
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
            workspace_id: `eq.${workspaceId}`,
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
      workspace_id: workspaceId,
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
    const rollbackCreatedAndReturn = async (response: Response): Promise<Response> => {
      await rollbackCreatedInstanceAfterPostCommitFailure({
        env,
        workspaceId,
        publicId,
        isCurated: createdKind === 'curated',
      });
      return response;
    };

    const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
      env,
      accountId: workspace.account_id,
      publicId,
      config: createdInstance.config,
    });
    if (usageSyncError) {
      await rollbackCreatedInstanceAfterPostCommitFailure({
        env,
        workspaceId,
        publicId,
        isCurated: createdKind === 'curated',
      });
      return usageSyncError;
    }

    if (createdInstance.status === 'published') {
      const enqueueResult = await enqueueL10nJobs({
        env,
        instance: createdInstance,
        workspace,
        widgetType,
        baseUpdatedAt: createdInstance.updated_at ?? null,
        policy: policyResult.policy,
      });
      if (!enqueueResult.ok) {
        console.error('[ParisWorker] l10n enqueue failed', enqueueResult.error);
        return rollbackCreatedAndReturn(
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
        return rollbackCreatedAndReturn(
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
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: activeLocales,
      });
      if (!enqueue.ok) {
        return rollbackCreatedAndReturn(
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
