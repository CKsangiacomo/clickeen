import { computeBaseFingerprint } from '@clickeen/l10n';
import type { Env, InstanceRow, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig } from '../../shared/validation';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import { isCuratedInstanceRow, resolveInstanceKind } from '../../shared/instances';
import { normalizeSupportedLocaleToken, resolveWorkspaceL10nPolicy } from '../../shared/l10n';
import { loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { loadInstanceOverlays } from '../l10n/service';
import {
  loadEnforcement,
  normalizeActiveEnforcement,
  resolveActivePublishLocales,
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
  void req;
  void env;
  void workspaceId;
  void publicId;

  // PRD 54 pivot: we no longer generate "render snapshots".
  // Venice public is artifact-only; writes happen via Tokyo mirror jobs on save/go-live.
  return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.endpoint.deprecated' }, 410);
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
  for (const row of rows) {
    const configResult = assertConfig(row.config);
    if (!configResult.ok) {
      return ckError(
        {
          kind: 'INTERNAL',
          reasonKey: 'coreui.errors.payload.invalid',
          detail: `Invalid persisted instance config for ${String(row.public_id || 'unknown')}: ${configResult.issues[0]?.message || 'invalid config'}`,
        },
        500,
      );
    }
  }
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
  const configResult = assertConfig(instance.config);
  if (!configResult.ok) {
    return ckError(
      {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: `Invalid persisted instance config for ${String(instance.public_id || 'unknown')}: ${configResult.issues[0]?.message || 'invalid config'}`,
      },
      500,
    );
  }
  const instanceKind = resolveInstanceKind(instance);

  const widgetType = await resolveWidgetTypeForInstance(env, instance);
  if (!widgetType)
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);

  const baseFingerprint = await computeBaseFingerprint(instance.config);
  const enforcementRow = await loadEnforcement(env, publicId);
  const enforcement = normalizeActiveEnforcement(enforcementRow);
  const workspaceL10nPolicy = resolveWorkspaceL10nPolicy(workspace.l10n_policy);
  const baseLocale = workspaceL10nPolicy.baseLocale;
  const { locales: workspaceLocales, invalidWorkspaceLocales } = resolveActivePublishLocales(
    {
      workspaceLocales: workspace.l10n_locales,
      policy: policyResult.policy,
      baseLocale,
    },
  );

  let localeOverlays: WorkspaceLocaleOverlayPayload[] = [];
  try {
    const overlayRows = await loadInstanceOverlays(env, publicId);
    const overlayByLocale = new Map<
      string,
      { localeRow: (typeof overlayRows)[number] | null; userRow: (typeof overlayRows)[number] | null }
    >();

    overlayRows.forEach((row) => {
      const locale = normalizeSupportedLocaleToken(row.layer_key);
      if (!locale) return;
      if (row.layer !== 'locale' && row.layer !== 'user') return;
      const current = overlayByLocale.get(locale) ?? { localeRow: null, userRow: null };
      if (row.layer === 'locale') current.localeRow = row;
      if (row.layer === 'user') current.userRow = row;
      overlayByLocale.set(locale, current);
    });

    localeOverlays = Array.from(overlayByLocale.entries())
      .map(([locale, entry]) => {
        const localeRow = entry.localeRow;
        const userRow = entry.userRow;
        const baseOps = normalizeLocalizationOpsForPayload(localeRow?.ops);
        const userOps =
          userRow != null
            ? normalizeLocalizationOpsForPayload(userRow.ops)
            : normalizeLocalizationOpsForPayload(localeRow?.user_ops);
        return {
          locale,
          source:
            typeof localeRow?.source === 'string'
              ? localeRow.source
              : typeof userRow?.source === 'string'
                ? userRow.source
                : null,
          baseFingerprint:
            typeof localeRow?.base_fingerprint === 'string'
              ? localeRow.base_fingerprint
              : typeof userRow?.base_fingerprint === 'string'
                ? userRow.base_fingerprint
                : null,
          baseUpdatedAt:
            typeof localeRow?.base_updated_at === 'string'
              ? localeRow.base_updated_at
              : typeof userRow?.base_updated_at === 'string'
                ? userRow.base_updated_at
                : null,
          hasUserOps: userOps.length > 0,
          baseOps,
          userOps,
        };
      })
      .sort((a, b) => a.locale.localeCompare(b.locale));
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
      policy: workspaceL10nPolicy,
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
  void req;
  void env;
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const instance = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  if (!instance) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  return json({
    ok: true,
    publicId: instance.public_id,
    instanceStatus: instance.status,
  });
}
