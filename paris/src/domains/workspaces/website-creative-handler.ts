import type { CuratedInstanceRow, Env, WidgetRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import {
  assertConfig,
  configAssetUrlContractIssues,
  configNonPersistableUrlIssues,
  isRecord,
} from '../../shared/validation';
import { isKnownWidgetType } from '../../shared/tokyo';
import { resolveEditorPolicyFromRequest } from '../../shared/policy';
import { authorizeWorkspace } from '../../shared/workspace-auth';
import {
  assertPublicId,
  assertWidgetType,
  isCuratedInstanceRow,
  resolveCuratedRowKind,
} from '../../shared/instances';
import { loadInstanceByWorkspaceAndPublicId, loadWidgetByType } from '../instances';
import {
  enforceLimits,
  rollbackCreatedInstanceOnUsageSyncFailure,
  rollbackInstanceWriteOnUsageSyncFailure,
  syncAccountAssetUsageForInstanceStrict,
  validateAccountAssetUsageForInstanceStrict,
} from './helpers';

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
  const authorized = await authorizeWorkspace(req, env, workspaceId, 'owner');
  if (!authorized.ok) return authorized.response;

  if ((env.ENV_STAGE || '').toLowerCase() !== 'local') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.curated.localOnly' }, 403);
  }

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
  const publicIdSuffix = `${widgetType}_${page}_${slot}`
    .replace(/[.]+/g, '_')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const publicId = `wgt_curated_${publicIdSuffix}`;

  const publicIdResult = assertPublicId(publicId);
  if (!publicIdResult.ok)
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);

  const isValidType = await isKnownWidgetType(env, widgetType);
  if (!isValidType) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
  }

  // 1) Ensure instance exists (and optionally reset config to baseline).
  let existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  const existingBeforeOverwrite = existing;
  let createdWebsiteCreative = false;
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

  const assetIssues = configAssetUrlContractIssues(baselineConfig, workspace.account_id);
  if (assetIssues.length) {
    return ckError(
      {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.publish.nonPersistableUrl',
        detail: assetIssues[0]?.message,
        paths: assetIssues.map((i) => `baselineConfig.${i.path}`),
      },
      422,
    );
  }

  const denyByLimits = await enforceLimits(env, policyResult.policy, widgetType, baselineConfig);
  if (denyByLimits) return denyByLimits;

  const usageValidationError = await validateAccountAssetUsageForInstanceStrict({
    env,
    accountId: workspace.account_id,
    publicId,
    config: baselineConfig,
  });
  if (usageValidationError) return usageValidationError;

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
        owner_account_id: workspace.account_id,
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
    createdWebsiteCreative = true;
  } else {
    const patchRes = await supabaseFetch(
      env,
      `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          config: baselineConfig,
          kind: resolveCuratedRowKind(publicId),
          owner_account_id: workspace.account_id,
        }),
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

  const creativeUsageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env,
    accountId: workspace.account_id,
    publicId,
    config: existing.config,
  });
  if (creativeUsageSyncError) {
    if (createdWebsiteCreative) {
      await rollbackCreatedInstanceOnUsageSyncFailure({
        env,
        workspaceId,
        publicId,
        isCurated: true,
      });
    } else if (existingBeforeOverwrite && isCuratedInstanceRow(existingBeforeOverwrite)) {
      await rollbackInstanceWriteOnUsageSyncFailure({
        env,
        workspaceId,
        publicId,
        before: existingBeforeOverwrite,
        isCurated: true,
      });
    }
    return creativeUsageSyncError;
  }

  return json({ creativeKey, publicId }, { status: 200 });
}
