import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import { can, evaluateLimits } from '@clickeen/ck-policy';
import type { LimitsSpec, Policy } from '@clickeen/ck-policy';
import type {
  CuratedInstanceRow,
  Env,
  InstanceRow,
  L10nGenerateStateRow,
  UpdatePayload,
  WidgetRow,
  WorkspaceBusinessProfileRow,
} from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { assertDevAuth } from '../../shared/auth';
import { supabaseFetch } from '../../shared/supabase';
import {
  assertConfig,
  assertMeta,
  assertStatus,
  configNonPersistableUrlIssues,
  isRecord,
} from '../../shared/validation';
import { isKnownWidgetType, loadWidgetLimits } from '../../shared/tokyo';
import { requireWorkspace } from '../../shared/workspaces';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { loadWidgetLocalizationAllowlist } from '../../shared/l10n';
import { consumeBudget } from '../../shared/budgets';
import {
  allowCuratedWrites,
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
  isCuratedInstanceRow,
  resolveCuratedRowKind,
  resolveInstanceKind,
  resolveInstanceWorkspaceId,
} from '../../shared/instances';
import {
  handleInstances,
  loadInstanceByPublicId,
  loadInstanceByWorkspaceAndPublicId,
  loadWidgetByType,
  resolveWidgetTypeForInstance,
} from '../instances';
import { enqueueL10nJobs } from '../l10n';
import {
  enqueueRenderSnapshot,
  loadEnforcement,
  loadL10nGenerateStatesForFingerprint,
  loadLocaleOverlayMatchesForFingerprint,
  loadRenderIndexCurrent,
  normalizeActiveEnforcement,
  resolveActivePublishLocales,
  type RenderIndexEntry,
} from './service';

export async function handleWorkspaceInstanceRenderSnapshot(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const kind = inferInstanceKindFromPublicId(publicIdResult.value);
  if (kind !== 'curated') {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'Curated publicId required',
      },
      422,
    );
  }

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicIdResult.value);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  const { locales: activeLocales } = resolveActivePublishLocales(
    workspace.l10n_locales,
    policyResult.policy,
  );

  const enqueue = await enqueueRenderSnapshot(env, {
    publicId: publicIdResult.value,
    action: 'upsert',
    locales: activeLocales,
  });
  if (!enqueue.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.publish.failed',
        detail: enqueue.error,
      },
      503,
    );
  }

  return json({ ok: true, publicId: publicIdResult.value, locales: activeLocales });
}

export async function handleWorkspaceInstances(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;

  // Reuse the legacy shape for now (DevStudio tooling consumes it), but scope it to a workspace.
  const url = new URL(req.url);
  url.searchParams.set('workspaceId', workspaceId);
  return handleInstances(new Request(url.toString(), { method: 'GET', headers: req.headers }), env);
}

export async function handleWorkspaceGetInstance(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  const instanceKind = resolveInstanceKind(instance);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  const enforcementRow = await loadEnforcement(env, publicId);
  const enforcement = normalizeActiveEnforcement(enforcementRow);

  return json({
    publicId: instance.public_id,
    ownerAccountId: workspace.account_id,
    status: instance.status,
    widgetType,
    config: instance.config,
    meta: isCuratedInstanceRow(instance) ? (instance.meta ?? null) : null,
    updatedAt: instance.updated_at ?? null,
    baseFingerprint,
    enforcement,
    policy: policyResult.policy,
    workspace: {
      id: workspace.id,
      accountId: workspace.account_id,
      tier: workspace.tier,
      websiteUrl: workspace.website_url,
    },
  });
}

export async function handleWorkspaceInstancePublishStatus(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance)
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  const instanceKind = resolveInstanceKind(instance);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const configFingerprint = await computeBaseFingerprint(instance.config);

  let localizationAllowlist: Array<{ path: string; type: 'string' | 'richtext' }>;
  try {
    localizationAllowlist = await loadWidgetLocalizationAllowlist(env, widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.limits.loadFailed', detail }, 500);
  }

  const l10nSnapshot = buildL10nSnapshot(instance.config, localizationAllowlist);
  const l10nBaseFingerprint = await computeBaseFingerprint(l10nSnapshot);
  const { locales, invalidWorkspaceLocales } = resolveActivePublishLocales(
    workspace.l10n_locales,
    policyResult.policy,
  );

  let stateMap = new Map<string, L10nGenerateStateRow>();
  try {
    stateMap = await loadL10nGenerateStatesForFingerprint({
      env,
      publicId,
      baseFingerprint: l10nBaseFingerprint,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.l10n.enqueueFailed', detail },
      500,
    );
  }

  let overlayMatchLocales = new Set<string>();
  let overlayMatchError: string | null = null;
  try {
    overlayMatchLocales = await loadLocaleOverlayMatchesForFingerprint({
      env,
      publicId,
      baseFingerprint: l10nBaseFingerprint,
    });
  } catch (error) {
    overlayMatchError = error instanceof Error ? error.message : String(error);
  }

  let renderIndexCurrent: Record<string, RenderIndexEntry> | null = null;
  let renderIndexError: string | null = null;
  try {
    renderIndexCurrent = await loadRenderIndexCurrent({ env, publicId });
  } catch (error) {
    renderIndexError = error instanceof Error ? error.message : String(error);
  }

  const localeStatuses = locales.map((locale) => {
    const state = locale === 'en' ? null : stateMap.get(locale);
    const hasOverlayMatch = locale !== 'en' && overlayMatchLocales.has(locale);
    const l10nStatus =
      locale === 'en' ? 'succeeded' : hasOverlayMatch ? 'succeeded' : (state?.status ?? 'dirty');
    const snapshot = renderIndexCurrent?.[locale] ?? null;
    const snapshotStatus = snapshot ? 'pointer_flipped' : 'missing';
    const retryScheduled = Boolean(state?.next_attempt_at);

    let stage = 'pointer_flipped';
    let stageReason = 'live';
    if (instance.status !== 'published') {
      stage = 'unpublished';
      stageReason = 'instance_unpublished';
    } else if (locale !== 'en') {
      if (l10nStatus === 'failed') {
        if (retryScheduled) {
          stage = 'awaiting_l10n';
          stageReason = 'l10n_retrying';
        } else {
          stage = 'failed';
          stageReason = 'l10n_failed_terminal';
        }
      } else if (l10nStatus === 'dirty') {
        stage = 'awaiting_l10n';
        stageReason = 'l10n_dirty';
      } else if (l10nStatus === 'queued') {
        stage = 'awaiting_l10n';
        stageReason = 'l10n_queued';
      } else if (l10nStatus === 'running') {
        stage = 'awaiting_l10n';
        stageReason = 'l10n_running';
      } else if (l10nStatus === 'superseded') {
        stage = 'awaiting_l10n';
        stageReason = 'l10n_superseded';
      }
    }
    if (stage === 'pointer_flipped' && !snapshot) {
      stage = 'awaiting_snapshot';
      stageReason = 'snapshot_missing';
    }

    return {
      locale,
      l10n: {
        status: l10nStatus,
        attempts: locale === 'en' ? 0 : (state?.attempts ?? 0),
        nextAttemptAt: locale === 'en' ? null : (state?.next_attempt_at ?? null),
        lastAttemptAt: locale === 'en' ? null : (state?.last_attempt_at ?? null),
        lastError: locale === 'en' ? null : (state?.last_error ?? null),
      },
      snapshot: {
        status: snapshotStatus,
        e: snapshot?.e ?? null,
        r: snapshot?.r ?? null,
        meta: snapshot?.meta ?? null,
      },
      stage,
      stageReason,
    };
  });

  const nonBaseLocaleStatuses = localeStatuses.filter((entry) => entry.locale !== 'en');
  const l10nSummary = {
    dirty: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'dirty').length,
    queued: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'queued').length,
    running: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'running').length,
    succeeded: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'succeeded').length,
    failed: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'failed').length,
    superseded: nonBaseLocaleStatuses.filter((entry) => entry.l10n.status === 'superseded').length,
    retrying: nonBaseLocaleStatuses.filter(
      (entry) => entry.l10n.status === 'failed' && Boolean(entry.l10n.nextAttemptAt),
    ).length,
    failedTerminal: nonBaseLocaleStatuses.filter(
      (entry) => entry.l10n.status === 'failed' && !entry.l10n.nextAttemptAt,
    ).length,
    inFlight: nonBaseLocaleStatuses.filter(
      (entry) => entry.stageReason === 'l10n_queued' || entry.stageReason === 'l10n_running',
    ).length,
    needsEnqueue: nonBaseLocaleStatuses.filter(
      (entry) => entry.stageReason === 'l10n_dirty' || entry.stageReason === 'l10n_superseded',
    ).length,
  };

  const summary = {
    total: localeStatuses.length,
    pointerFlipped: localeStatuses.filter((entry) => entry.stage === 'pointer_flipped').length,
    awaitingL10n: localeStatuses.filter((entry) => entry.stage === 'awaiting_l10n').length,
    awaitingSnapshot: localeStatuses.filter((entry) => entry.stage === 'awaiting_snapshot').length,
    failed: localeStatuses.filter((entry) => entry.stage === 'failed').length,
    unpublished: localeStatuses.filter((entry) => entry.stage === 'unpublished').length,
    l10n: l10nSummary,
  };

  const blockedStageReasonSummary = localeStatuses
    .filter((entry) => entry.stage !== 'pointer_flipped')
    .reduce(
      (acc, entry) => {
        const key =
          typeof entry.stageReason === 'string' && entry.stageReason.trim()
            ? entry.stageReason.trim()
            : 'unknown';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  const overall =
    instance.status !== 'published'
      ? 'unpublished'
      : summary.failed > 0
        ? 'failed'
        : l10nSummary.inFlight > 0
          ? 'l10n_in_flight'
          : l10nSummary.retrying > 0
            ? 'l10n_retrying'
            : summary.awaitingL10n > 0
              ? 'awaiting_l10n'
              : summary.awaitingSnapshot > 0
                ? 'awaiting_snapshot'
                : 'ready';

  const nextAction =
    instance.status !== 'published'
      ? { key: 'publish_instance', label: 'Publish instance to start localization.' }
      : l10nSummary.failedTerminal > 0
        ? {
            key: 'inspect_terminal_failures',
            label: 'Inspect last error and requeue failed locales.',
          }
        : l10nSummary.needsEnqueue > 0
          ? instanceKind === 'curated'
            ? {
                key: 'enqueue_selected',
                label: 'Click "Translate locales" to enqueue stale locales.',
              }
            : {
                key: 'publish_instance',
                label: 'Publish base content to enqueue locale updates.',
              }
          : l10nSummary.retrying > 0
            ? {
                key: 'wait_retry_backoff',
                label: 'Retry backoff in progress; wait for next attempt.',
              }
            : l10nSummary.inFlight > 0
              ? {
                  key: 'wait_in_flight',
                  label: 'Translations are running; wait for completion.',
                }
              : summary.awaitingSnapshot > 0
                ? {
                    key: 'wait_snapshot_publish',
                    label: 'Waiting for snapshot publish.',
                  }
                : null;

  return json({
    publicId: instance.public_id,
    widgetType,
    instanceStatus: instance.status,
    revision: {
      configFingerprint,
      l10nBaseFingerprint,
      updatedAt: instance.updated_at ?? null,
    },
    pipeline: {
      overall,
      bindings: {
        renderSnapshotQueue: Boolean(env.RENDER_SNAPSHOT_QUEUE),
        l10nGenerateQueue: Boolean(env.L10N_GENERATE_QUEUE),
      },
      renderIndexFound: Boolean(renderIndexCurrent),
      renderIndexError,
      workspaceLocales: {
        invalid: invalidWorkspaceLocales,
      },
      l10n: {
        inFlight: l10nSummary.inFlight,
        retrying: l10nSummary.retrying,
        failedTerminal: l10nSummary.failedTerminal,
        needsEnqueue: l10nSummary.needsEnqueue,
        stageReasons: blockedStageReasonSummary,
        nextAction,
        overlayMatchError,
      },
    },
    summary,
    locales: localeStatuses,
  });
}

async function enforceLimits(
  env: Env,
  policy: Policy,
  widgetType: string | null,
  config: Record<string, unknown>,
) {
  if (!widgetType) return null;
  let limits: LimitsSpec | null = null;
  try {
    limits = await loadWidgetLimits(env, widgetType);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.limits.loadFailed', detail }, 500);
  }
  if (!limits) return null;

  const violations = evaluateLimits({ config, limits, policy, context: 'publish' });
  if (violations.length === 0) return null;

  const first = violations[0];
  return ckError(
    {
      kind: 'DENY',
      reasonKey: first.reasonKey,
      upsell: 'UP',
      detail: first.detail,
      paths: [first.path],
    },
    403,
  );
}

export async function handleWorkspaceUpdateInstance(
  req: Request,
  env: Env,
  workspaceId: string,
  publicId: string,
) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

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

  const metaResult =
    payload.meta !== undefined ? assertMeta(payload.meta) : { ok: true as const, value: undefined };
  if (!metaResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const config = configResult.value;
  const status = statusResult.value;
  const meta = metaResult.value;

  if (config === undefined && status === undefined && meta === undefined) {
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
  if (isCurated && !allowCuratedWrites(env)) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
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

  if (config !== undefined) {
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

    const denyByLimits = await enforceLimits(env, policyResult.policy, widgetType, config);
    if (denyByLimits) return denyByLimits;
  }

  const prevStatus = instance.status;
  const nextStatus = status ?? prevStatus;
  const statusChanged = status !== undefined && status !== prevStatus;

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
  } else if (status !== undefined) {
    update.status = status;
  }
  if (meta !== undefined) update.meta = meta;

  let updatedInstance: InstanceRow | CuratedInstanceRow | null = instance;
  const patchPath = isCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
  const patchRes = await supabaseFetch(env, patchPath, {
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
    const shouldTrigger =
      config !== undefined || (status === 'published' && updatedInstance.status === 'published');
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
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.l10n.enqueueFailed',
            detail: enqueueResult.error,
          },
          500,
        );
      }
    }

    // Keep Venice snapshots correct for the public embed path (PRD 38).
    // When status/config changes for published instances, regenerate render snapshots.
    // When an instance is unpublished, delete the snapshot index to enforce "published-only".
    const updatedPrevStatus = prevStatus;
    const updatedNextStatus = updatedInstance.status;
    const configChanged = config !== undefined;
    if (
      isCurated &&
      updatedNextStatus === 'published' &&
      (updatedPrevStatus !== updatedNextStatus || configChanged)
    ) {
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: ['en'],
      });
      if (!enqueue.ok) {
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.publish.failed',
            detail: enqueue.error,
          },
          503,
        );
      }
    } else if (
      !isCurated &&
      updatedNextStatus === 'published' &&
      (statusChanged || configChanged)
    ) {
      const { locales: activeLocales } = resolveActivePublishLocales(
        workspace.l10n_locales,
        policyResult.policy,
      );
      const maxRegens = policyResult.policy.budgets['budget.snapshots.regens']?.max ?? null;
      const regen = await consumeBudget({
        env,
        scope: { kind: 'workspace', workspaceId },
        budgetKey: 'budget.snapshots.regens',
        max: maxRegens,
        amount: 1,
      });
      if (!regen.ok) {
        return ckError(
          {
            kind: 'DENY',
            reasonKey: regen.reasonKey,
            upsell: 'UP',
            detail: regen.detail,
          },
          403,
        );
      }
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: activeLocales,
      });
      if (!enqueue.ok) {
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.publish.failed',
            detail: enqueue.error,
          },
          503,
        );
      }
    } else if (
      !isCurated &&
      updatedPrevStatus === 'published' &&
      updatedNextStatus === 'unpublished'
    ) {
      const enqueue = await enqueueRenderSnapshot(env, { publicId, action: 'delete' });
      if (!enqueue.ok) {
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.publish.failed',
            detail: enqueue.error,
          },
          503,
        );
      }
    }
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}

export async function handleWorkspaceCreateInstance(req: Request, env: Env, workspaceId: string) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

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
  const metaResult =
    (payload as any).meta !== undefined
      ? assertMeta((payload as any).meta)
      : { ok: true as const, value: undefined };

  if (
    !widgetTypeResult.ok ||
    !publicIdResult.ok ||
    !configResult.ok ||
    !statusResult.ok ||
    !metaResult.ok
  ) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const widgetType = widgetTypeResult.value;
  const publicId = publicIdResult.value;
  const config = configResult.value;
  const requestedStatus = statusResult.value;
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
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
  }
  if (!isCurated && (payload as any).meta !== undefined) {
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

  const denyByLimits = await enforceLimits(env, policyResult.policy, widgetType, config);
  if (denyByLimits) return denyByLimits;

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

    const instanceInsert = await supabaseFetch(env, `/rest/v1/widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        widget_id: widget.id,
        public_id: publicId,
        status,
        config,
        kind,
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
    if (createdKind === 'curated' && createdInstance.status === 'published') {
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: ['en'],
      });
      if (!enqueue.ok) {
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.publish.failed',
            detail: enqueue.error,
          },
          503,
        );
      }
    } else if (createdKind !== 'curated' && createdInstance.status === 'published') {
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
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.l10n.enqueueFailed',
            detail: enqueueResult.error,
          },
          500,
        );
      }

      const { locales: activeLocales } = resolveActivePublishLocales(
        workspace.l10n_locales,
        policyResult.policy,
      );
      const maxRegens = policyResult.policy.budgets['budget.snapshots.regens']?.max ?? null;
      const regen = await consumeBudget({
        env,
        scope: { kind: 'workspace', workspaceId },
        budgetKey: 'budget.snapshots.regens',
        max: maxRegens,
        amount: 1,
      });
      if (!regen.ok) {
        return ckError(
          {
            kind: 'DENY',
            reasonKey: regen.reasonKey,
            upsell: 'UP',
            detail: regen.detail,
          },
          403,
        );
      }
      const enqueue = await enqueueRenderSnapshot(env, {
        publicId,
        action: 'upsert',
        locales: activeLocales,
      });
      if (!enqueue.ok) {
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.publish.failed',
            detail: enqueue.error,
          },
          503,
        );
      }
    }
  }

  return handleWorkspaceGetInstance(req, env, workspaceId, publicId);
}

const WEBSITE_CREATIVE_PAGES = new Set(['overview', 'templates', 'examples', 'features']);

function assertWebsiteCreativePage(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!trimmed || !WEBSITE_CREATIVE_PAGES.has(trimmed)) {
    return {
      ok: false as const,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.page.invalid' }, 422),
    };
  }
  return { ok: true as const, value: trimmed };
}

function assertWebsiteCreativeSlot(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : '';
  // Website creative block ids are dot-separated slot keys (e.g. "feature.left.50").
  // Lock: lowercase segments matching [a-z0-9][a-z0-9_-]*, separated by dots.
  if (!trimmed || !/^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/.test(trimmed)) {
    return {
      ok: false as const,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.slot.invalid' }, 422),
    };
  }
  return { ok: true as const, value: trimmed };
}

function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function handleWorkspaceEnsureWebsiteCreative(
  req: Request,
  env: Env,
  workspaceId: string,
) {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  if ((env.ENV_STAGE || '').toLowerCase() !== 'local') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.superadmin.localOnly' }, 403);
  }

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) return workspaceResult.response;
  const workspace = workspaceResult.workspace;

  const policyResult = resolveEditorPolicyFromRequest(req, workspace);
  if (!policyResult.ok) return policyResult.response;
  if (policyResult.profile !== 'devstudio') {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.subject.invalid' }, 422);
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
  if (!widgetTypeResult.ok)
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);

  const pageResult = assertWebsiteCreativePage((payload as any).page);
  if (!pageResult.ok) return pageResult.response;

  const slotResult = assertWebsiteCreativeSlot((payload as any).slot);
  if (!slotResult.ok) return slotResult.response;

  const overwrite = (payload as any).overwrite === true;

  const widgetType = widgetTypeResult.value;
  const page = pageResult.value;
  const slot = slotResult.value;
  const creativeKey = `${widgetType}.${page}.${slot}`;
  const publicId = `wgt_curated_${creativeKey}`;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok)
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);

  const isValidType = await isKnownWidgetType(env, widgetType);
  if (!isValidType) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
  }

  // 1) Ensure instance exists (and optionally reset config to baseline).
  let existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (existing && !overwrite) {
    // No-op open path: do not validate or mutate baseline config if we're only opening an existing creative.
    return json({ creativeKey, publicId }, { status: 200 });
  }

  const baselineConfigResult = assertConfig((payload as any).baselineConfig);
  if (!baselineConfigResult.ok)
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  const baselineConfig = baselineConfigResult.value;

  const issues = configNonPersistableUrlIssues(baselineConfig);
  if (issues.length) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: issues[0]?.message,
        paths: issues.map((i) => `baselineConfig.${i.path}`),
      },
      422,
    );
  }

  const denyByLimits = await enforceLimits(env, policyResult.policy, widgetType, baselineConfig);
  if (denyByLimits) return denyByLimits;

  if (!existing) {
    let widget = await loadWidgetByType(env, widgetType);
    if (!widget) {
      const insertRes = await supabaseFetch(env, `/rest/v1/widgets`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          type: widgetType,
          name: titleCase(widgetType) || widgetType,
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

    const instanceInsert = await supabaseFetch(env, `/rest/v1/curated_widget_instances`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        public_id: publicId,
        widget_type: widgetType,
        kind: resolveCuratedRowKind(publicId),
        status: 'published',
        config: baselineConfig,
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
    const created = (await instanceInsert.json().catch(() => null)) as CuratedInstanceRow[] | null;
    existing = created?.[0] ?? null;
  } else {
    const patchRes = await supabaseFetch(
      env,
      `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ config: baselineConfig, kind: resolveCuratedRowKind(publicId) }),
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
    const updated = (await patchRes.json().catch(() => null)) as CuratedInstanceRow[] | null;
    existing = updated?.[0] ?? existing;
  }

  if (!existing) {
    existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  }
  if (!existing) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.notFound' }, 500);
  }

  return json({ creativeKey, publicId }, { status: 200 });
}

async function loadWorkspaceBusinessProfile(
  env: Env,
  workspaceId: string,
): Promise<WorkspaceBusinessProfileRow | null> {
  const params = new URLSearchParams({
    select: 'workspace_id,profile,sources,created_at,updated_at',
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(
    env,
    `/rest/v1/workspace_business_profiles?${params.toString()}`,
    { method: 'GET' },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to load workspace profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as WorkspaceBusinessProfileRow[];
  return rows?.[0] ?? null;
}

async function upsertWorkspaceBusinessProfile(args: {
  env: Env;
  workspaceId: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown>;
}): Promise<WorkspaceBusinessProfileRow | null> {
  const payload = {
    workspace_id: args.workspaceId,
    profile: args.profile,
    ...(args.sources ? { sources: args.sources } : {}),
  };
  const res = await supabaseFetch(
    args.env,
    `/rest/v1/workspace_business_profiles?on_conflict=workspace_id`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(
      `[ParisWorker] Failed to upsert workspace profile (${res.status}): ${JSON.stringify(details)}`,
    );
  }
  const rows = (await res.json()) as WorkspaceBusinessProfileRow[];
  return rows?.[0] ?? null;
}

export async function handleWorkspaceBusinessProfileGet(
  req: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  try {
    const row = await loadWorkspaceBusinessProfile(env, workspaceId);
    if (!row) return json({ error: 'NOT_FOUND' }, { status: 404 });
    return json({
      profile: row.profile,
      sources: row.sources ?? null,
      updatedAt: row.updated_at ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'DB_ERROR', detail }, { status: 500 });
  }
}

export async function handleWorkspaceBusinessProfileUpsert(
  req: Request,
  env: Env,
  workspaceId: string,
): Promise<Response> {
  const auth = assertDevAuth(req, env);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json([{ path: 'body', message: 'invalid JSON payload' }], { status: 422 });
  }
  if (!isRecord(body)) {
    return json([{ path: 'body', message: 'body must be an object' }], { status: 422 });
  }

  const profile = isRecord((body as any).profile)
    ? ((body as any).profile as Record<string, unknown>)
    : null;
  if (!profile) {
    return json([{ path: 'profile', message: 'profile must be an object' }], { status: 422 });
  }
  const sources = isRecord((body as any).sources)
    ? ((body as any).sources as Record<string, unknown>)
    : undefined;

  try {
    const row = await upsertWorkspaceBusinessProfile({ env, workspaceId, profile, sources });
    return json({
      profile: row?.profile ?? profile,
      sources: row?.sources ?? sources ?? null,
      updatedAt: row?.updated_at ?? null,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return json({ error: 'DB_ERROR', detail }, { status: 500 });
  }
}
