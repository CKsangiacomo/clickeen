import { computeBaseFingerprint } from '@clickeen/l10n';
import type { Env, L10nGenerateStateRow, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import { assertPublicId, inferInstanceKindFromPublicId, isCuratedInstanceRow, resolveInstanceKind } from '../../shared/instances';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadInstanceOverlays } from '../l10n/service';
import { resolveL10nPlanningSnapshot } from '../l10n/planning';
import {
  enqueueRenderSnapshot,
  loadEnforcement,
  loadL10nGenerateStatesForFingerprint,
  loadPersistedLocaleOverlayKeys,
  loadLocaleOverlayMatchesForFingerprint,
  loadRenderSnapshotState,
  normalizeActiveEnforcement,
  resolveActivePublishLocales,
  resolveRenderSnapshotLocales,
  waitForEnSnapshotReady,
  type RenderIndexEntry,
} from './service';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  normalizeLocalizationOpsForPayload,
  resolveWorkspaceInstanceDisplayName,
  validateWorkspaceInstanceEnvelope,
  type WorkspaceInstanceEnvelope,
  type WorkspaceLocaleOverlayPayload,
} from './helpers';

export async function handleWorkspaceInstanceRenderSnapshot(
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
  const url = new URL(req.url);
  const waitToken = (url.searchParams.get('waitForEn') ?? url.searchParams.get('wait') ?? '')
    .trim()
    .toLowerCase();
  const waitForEn = waitToken === '1' || waitToken === 'true' || waitToken === 'en-ready';
  const { locales: activeLocales } = await resolveRenderSnapshotLocales({
    env,
    publicId: publicIdResult.value,
    workspaceLocales: workspace.l10n_locales,
    policy: policyResult.policy,
  });
  const baselineSnapshotState = waitForEn
    ? await loadRenderSnapshotState({
        env,
        publicId: publicIdResult.value,
      }).catch(() => null)
    : null;

  const enqueue = await enqueueRenderSnapshot(env, {
    publicId: publicIdResult.value,
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
  let enWaitedMs: number | null = null;
  if (waitForEn) {
    const enReady = await waitForEnSnapshotReady({
      env,
      publicId: publicIdResult.value,
      baselinePointerUpdatedAt: baselineSnapshotState?.pointerUpdatedAt ?? null,
      baselineRevision: baselineSnapshotState?.revision ?? null,
    });
    if (!enReady.ok) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.publish.failed',
          detail: enReady.error,
        },
        503,
      );
    }
    enWaitedMs = enReady.waitedMs;
  }

  const asyncLocales = activeLocales.filter((locale) => locale !== 'en');
  if (asyncLocales.length) {
    const asyncEnqueue = await enqueueRenderSnapshot(env, {
      publicId: publicIdResult.value,
      action: 'upsert',
      locales: asyncLocales,
    });
    if (!asyncEnqueue.ok) {
      console.warn('[ParisWorker] async locale snapshot enqueue failed', {
        publicId: publicIdResult.value,
        detail: asyncEnqueue.error,
      });
    }
  }
  return json(
    {
      ok: true,
      publicId: publicIdResult.value,
      locales: activeLocales,
      snapshotState: waitForEn ? 'ready' : 'queued',
      operationId: crypto.randomUUID(),
      ...(waitForEn ? { enReadyWaitMs: enWaitedMs } : {}),
    },
    { status: waitForEn ? 200 : 202 },
  );
}

export async function handleWorkspaceInstances(req: Request, env: Env, workspaceId: string) {
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'public_id,display_name,status,config,created_at,updated_at,widget_id,workspace_id,kind',
    order: 'created_at.desc',
    limit: '50',
    workspace_id: `eq.${workspaceId}`,
  });
  const instancesRes = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!instancesRes.ok) {
    const details = await readJson(instancesRes);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.readFailed',
        detail: JSON.stringify(details),
      },
      500,
    );
  }

  const rows = ((await instancesRes.json().catch(() => null)) as InstanceRow[] | null) ?? [];
  const widgetIds = Array.from(
    new Set(rows.map((row) => row.widget_id).filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );
  const widgetLookup = new Map<string, { type: string | null; name: string | null }>();
  if (widgetIds.length > 0) {
    const widgetParams = new URLSearchParams({
      select: 'id,type,name',
      id: `in.(${widgetIds.join(',')})`,
    });
    const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
    if (!widgetRes.ok) {
      const details = await readJson(widgetRes);
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.db.readFailed',
          detail: JSON.stringify(details),
        },
        500,
      );
    }
    const widgets = ((await widgetRes.json().catch(() => null)) as WidgetRow[] | null) ?? [];
    widgets.forEach((widget) => {
      if (!widget?.id) return;
      widgetLookup.set(String(widget.id), { type: widget.type ?? null, name: widget.name ?? null });
    });
  }

  const instances = rows.map((row) => {
    const widget = row.widget_id ? widgetLookup.get(row.widget_id) : undefined;
    return {
      publicId: row.public_id,
      widgetname: widget?.type ?? 'unknown',
      displayName: asTrimmedString(row.display_name) ?? DEFAULT_INSTANCE_DISPLAY_NAME,
      config: row.config,
    };
  });
  return json({ instances });
}

export async function handleWorkspaceGetInstance(
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
  const instanceKind = resolveInstanceKind(instance);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  const enforcementRow = await loadEnforcement(env, publicId);
  const enforcement = normalizeActiveEnforcement(enforcementRow);
  const { locales: workspaceLocales, invalidWorkspaceLocales } = resolveActivePublishLocales(
    workspace.l10n_locales,
    policyResult.policy,
  );

  let localeOverlays: WorkspaceLocaleOverlayPayload[] = [];
  try {
    const overlayRows = await loadInstanceOverlays(env, publicId);
    localeOverlays = overlayRows
      .filter((row) => row.layer === 'locale')
      .map((row) => {
        const locale = typeof row.layer_key === 'string' ? row.layer_key.trim().toLowerCase() : '';
        const userOps = normalizeLocalizationOpsForPayload(row.user_ops);
        return {
          locale,
          source: typeof row.source === 'string' ? row.source : null,
          baseFingerprint: typeof row.base_fingerprint === 'string' ? row.base_fingerprint : null,
          baseUpdatedAt: typeof row.base_updated_at === 'string' ? row.base_updated_at : null,
          hasUserOps: userOps.length > 0,
          baseOps: normalizeLocalizationOpsForPayload(row.ops),
          userOps,
        };
      })
      .filter((entry) => Boolean(entry.locale));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.db.readFailed',
        detail,
      },
      500,
    );
  }

  const envelope: WorkspaceInstanceEnvelope = {
    publicId: instance.public_id,
    displayName: resolveWorkspaceInstanceDisplayName(instance),
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
    localization: {
      workspaceLocales,
      invalidWorkspaceLocales,
      localeOverlays,
    },
  };
  const envelopeError = validateWorkspaceInstanceEnvelope(envelope);
  if (envelopeError) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: `Invalid InstanceEnvelope: ${envelopeError}`,
      },
      500,
    );
  }
  return json(envelope);
}

export async function handleWorkspaceInstancePublishStatus(
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
  const instanceKind = resolveInstanceKind(instance);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const configFingerprint = await computeBaseFingerprint(instance.config);
  const planning = await resolveL10nPlanningSnapshot({
    env,
    widgetType,
    config: instance.config,
    baseUpdatedAt: instance.updated_at ?? null,
  });
  if (!planning.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.l10n.enqueueFailed',
        detail: planning.error,
      },
      500,
    );
  }
  const l10nBaseFingerprint = planning.plan.baseFingerprint;
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

  let persistedLocaleOverlayKeys = new Set<string>();
  let persistedOverlayKeysError: string | null = null;
  try {
    const persistedKeys = await loadPersistedLocaleOverlayKeys(env, publicId);
    persistedLocaleOverlayKeys = new Set(persistedKeys);
  } catch (error) {
    persistedOverlayKeysError = error instanceof Error ? error.message : String(error);
  }

  let renderIndexCurrent: Record<string, RenderIndexEntry> | null = null;
  let renderBaseRevision: string | null = null;
  let renderPointerUpdatedAt: string | null = null;
  let renderIndexError: string | null = null;
  try {
    const snapshotState = await loadRenderSnapshotState({ env, publicId });
    renderBaseRevision = snapshotState.revision;
    renderPointerUpdatedAt = snapshotState.pointerUpdatedAt;
    renderIndexCurrent = snapshotState.current;
  } catch (error) {
    renderIndexError = error instanceof Error ? error.message : String(error);
  }

  const localeStatuses = locales.map((locale) => {
    const state = locale === 'en' ? null : stateMap.get(locale);
    const hasOverlayMatch = locale !== 'en' && overlayMatchLocales.has(locale);
    const hadAnyOverlayForLocale = locale !== 'en' && persistedLocaleOverlayKeys.has(locale);
    const overlayState =
      locale === 'en'
        ? ('current' as const)
        : hasOverlayMatch
          ? ('current' as const)
          : hadAnyOverlayForLocale
            ? ('stale' as const)
            : ('missing' as const);
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
    const snapshotState =
      snapshot
        ? ('current' as const)
        : stageReason === 'snapshot_missing' ||
            stageReason === 'l10n_queued' ||
            stageReason === 'l10n_running' ||
            stageReason === 'l10n_retrying'
          ? ('generating' as const)
          : ('missing' as const);
    const source =
      snapshot
        ? ('current_locale' as const)
        : locale !== 'en' && Boolean(renderIndexCurrent?.en)
          ? ('current_revision_en_fallback' as const)
          : ('unavailable' as const);

    return {
      locale,
      overlayState,
      source,
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
      snapshotState,
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

  const baseLocaleStatus = localeStatuses.find((entry) => entry.locale === 'en') ?? null;
  const baseSnapshotBlocked =
    instance.status === 'published' && (!baseLocaleStatus || baseLocaleStatus.snapshotState !== 'current');

  const overall =
    instance.status !== 'published'
      ? 'unpublished'
      : baseSnapshotBlocked
        ? 'awaiting_snapshot'
        : l10nSummary.failedTerminal > 0
          ? 'l10n_failed'
        : l10nSummary.inFlight > 0
          ? 'l10n_in_flight'
          : l10nSummary.retrying > 0
            ? 'l10n_retrying'
            : summary.awaitingL10n > 0
              ? 'awaiting_l10n'
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

  const localeStatusV2 = localeStatuses.reduce(
    (acc, entry) => {
      acc[entry.locale] = {
        overlayState: entry.overlayState,
        snapshotState: entry.snapshotState,
        source: entry.source,
        lastPublishedAt: renderPointerUpdatedAt ?? null,
      };
      return acc;
    },
    {} as Record<
      string,
      {
        overlayState: 'current' | 'stale' | 'missing';
        snapshotState: 'current' | 'generating' | 'missing';
        source: 'current_locale' | 'current_revision_en_fallback' | 'unavailable';
        lastPublishedAt: string | null;
      }
    >,
  );

  return json({
    publicId: instance.public_id,
    widgetType,
    instanceStatus: instance.status,
    revision: {
      configFingerprint,
      l10nBaseFingerprint,
      updatedAt: instance.updated_at ?? null,
    },
    status: {
      v: 2,
      baseRevision: renderBaseRevision,
      baseFingerprint: l10nBaseFingerprint,
      pointerUpdatedAt: renderPointerUpdatedAt,
      locales: localeStatusV2,
    },
    pipeline: {
      overall,
      bindings: {
        renderSnapshotQueue: Boolean(env.RENDER_SNAPSHOT_QUEUE),
        l10nGenerateQueue: Boolean(env.L10N_GENERATE_QUEUE),
      },
      renderIndexFound: Boolean(renderIndexCurrent),
      renderBaseRevision,
      renderPointerUpdatedAt,
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
        persistedOverlayKeysError,
      },
    },
    summary,
    locales: localeStatuses,
  });
}
