import { BUDGET_KEYS, resolvePolicy } from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from '../../shared/types';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { readBudgetUsed } from '../../shared/budgets';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig, isUuid } from '../../shared/validation';
import { allowCuratedWrites, assertWidgetType } from '../../shared/instances';
import { loadInstanceByPublicId, loadWidgetByType } from '../instances';
import type {
  AccountEntitlementsSnapshot,
  AccountWorkspaceRow,
  BootstrapOwnerRecord,
  IdempotencyRecord,
  InstanceListRow,
  RomaBootstrapDomainsPayload,
} from './common';
import {
  ROMA_APP_BOOTSTRAP_TTL_SEC,
  ROMA_APP_IDEMPOTENCY_TTL_SEC,
  assertHandoffId,
  kvGetJson,
  kvPutJson,
  loadAccountAssetsForBootstrap,
  loadAccountUsageAssetRowsForBootstrap,
  loadWorkspaceMembersForBootstrap,
  rollbackCreatedWorkspaceInstanceOnUsageSyncFailure,
  syncAccountAssetUsageForInstanceStrict,
  validateAccountAssetUsageForInstanceStrict,
} from './common';
import {
  accountRoleLabel,
  inferHighestTier,
  loadAccountWorkspaces,
  loadCuratedWidgetsInstances,
  loadOwnedCuratedWidgetsInstances,
  loadWorkspaceWidgetsInstances,
  mergeRomaWidgetInstances,
} from './data';

type RomaBootstrapDomainKey = keyof RomaBootstrapDomainsPayload;
type RomaBootstrapDomainError = {
  reasonKey: string;
  status: number;
  detail?: string;
};
type RomaBootstrapDomainOutcome = {
  status: 'ok' | 'error';
  httpStatus: number;
  reasonKey?: string;
};

type RomaBootstrapDomainsResult = {
  domains: Partial<RomaBootstrapDomainsPayload>;
  domainErrors: Partial<Record<RomaBootstrapDomainKey, RomaBootstrapDomainError>>;
  domainOutcomes: Record<RomaBootstrapDomainKey, RomaBootstrapDomainOutcome>;
  bootstrapFanoutMs: number;
};

function toDomainError(domainKey: RomaBootstrapDomainKey, error: unknown): RomaBootstrapDomainError {
  const detail = error instanceof Error ? error.message : String(error);
  return {
    reasonKey: `roma.errors.bootstrap.${domainKey}_unavailable`,
    status: 502,
    detail,
  };
}

async function loadAccountInstancesForUsage(env: Env, accountWorkspaces: AccountWorkspaceRow[]): Promise<InstanceListRow[]> {
  const workspaceIds = accountWorkspaces.map((workspace) => workspace.id).filter(Boolean);
  if (workspaceIds.length === 0) return [];
  const instanceParams = new URLSearchParams({
    select: 'public_id,status,workspace_id',
    workspace_id: `in.(${workspaceIds.join(',')})`,
    limit: '5000',
  });
  const instanceRes = await supabaseFetch(env, `/rest/v1/widget_instances?${instanceParams.toString()}`, { method: 'GET' });
  if (!instanceRes.ok) {
    const details = await readJson(instanceRes);
    throw new Error(`[ParisWorker] Failed to load account instances for bootstrap (${instanceRes.status}): ${JSON.stringify(details)}`);
  }
  return ((await instanceRes.json()) as InstanceListRow[]) ?? [];
}

async function buildRomaWidgetsDomain(args: {
  env: Env;
  accountId: string;
  workspaceId: string;
  workspaceTier: WorkspaceRow['tier'];
  workspaceRole: MemberRole;
}): Promise<RomaBootstrapDomainsPayload['widgets']> {
  const [workspaceWidgetRows, ownedCuratedRows] = await Promise.all([
    loadWorkspaceWidgetsInstances(args.env, args.workspaceId),
    loadOwnedCuratedWidgetsInstances(args.env, args.accountId),
  ]);
  const policy = resolvePolicy({
    profile: args.workspaceTier,
    role: args.workspaceRole,
  });
  const canMutateWorkspace = policy.role !== 'viewer';
  const canDeleteCurated = allowCuratedWrites(args.env) && canMutateWorkspace;
  const widgetCatalog = mergeRomaWidgetInstances(workspaceWidgetRows, ownedCuratedRows).map((instance) => ({
    ...instance,
    actions: {
      edit: true,
      duplicate: canMutateWorkspace,
      delete: instance.source === 'curated' ? canDeleteCurated : canMutateWorkspace,
    },
  }));
  const widgetTypes = Array.from(
    new Set(widgetCatalog.map((instance) => instance.widgetType).filter((widgetType) => widgetType !== 'unknown')),
  ).sort((a, b) => a.localeCompare(b));
  return {
    accountId: args.accountId,
    workspaceId: args.workspaceId,
    widgetTypes,
    instances: widgetCatalog,
  };
}

async function buildRomaTemplatesDomain(args: {
  env: Env;
  accountId: string;
  workspaceId: string;
}): Promise<RomaBootstrapDomainsPayload['templates']> {
  const curatedRows = await loadCuratedWidgetsInstances(args.env);
  const templateTypes = Array.from(
    new Set(curatedRows.map((instance) => instance.widgetType).filter((widgetType) => widgetType !== 'unknown')),
  ).sort((a, b) => a.localeCompare(b));
  return {
    accountId: args.accountId,
    workspaceId: args.workspaceId,
    widgetTypes: templateTypes,
    instances: curatedRows.map((instance) => ({
      publicId: instance.publicId,
      widgetType: instance.widgetType,
      displayName: instance.displayName,
    })),
  };
}

async function buildRomaAssetsDomain(args: {
  env: Env;
  accountId: string;
  workspaceId: string;
}): Promise<RomaBootstrapDomainsPayload['assets']> {
  const assets = await loadAccountAssetsForBootstrap(args.env, args.accountId);
  return {
    accountId: args.accountId,
    workspaceId: args.workspaceId,
    assets,
  };
}

async function buildRomaTeamDomain(args: {
  env: Env;
  workspaceId: string;
  workspaceRole: MemberRole;
}): Promise<RomaBootstrapDomainsPayload['team']> {
  const members = await loadWorkspaceMembersForBootstrap(args.env, args.workspaceId);
  return {
    workspaceId: args.workspaceId,
    role: args.workspaceRole,
    members,
  };
}

async function buildRomaBillingDomain(args: {
  env: Env;
  accountId: string;
  accountRole: MemberRole;
}): Promise<RomaBootstrapDomainsPayload['billing']> {
  const accountWorkspaces = await loadAccountWorkspaces(args.env, args.accountId);
  const inferredTier = inferHighestTier(accountWorkspaces);
  const accountRoleLabelValue = accountRoleLabel(args.accountRole);
  return {
    accountId: args.accountId,
    role: accountRoleLabelValue,
    provider: 'stripe',
    status: 'not_configured',
    reasonKey: 'coreui.errors.billing.notConfigured',
    plan: {
      inferredTier,
      workspaceCount: accountWorkspaces.length,
    },
    checkoutAvailable: false,
    portalAvailable: false,
  };
}

async function buildRomaUsageDomain(args: {
  env: Env;
  accountId: string;
  accountRole: MemberRole;
}): Promise<RomaBootstrapDomainsPayload['usage']> {
  const [accountWorkspaces, usageAssets] = await Promise.all([
    loadAccountWorkspaces(args.env, args.accountId),
    loadAccountUsageAssetRowsForBootstrap(args.env, args.accountId),
  ]);
  const instances = await loadAccountInstancesForUsage(args.env, accountWorkspaces);
  const publishedInstances = instances.filter((instance) => instance.status === 'published').length;
  const usageBytes = usageAssets.reduce((sum, asset) => {
    const size = Number.isFinite(asset.size_bytes) ? asset.size_bytes : 0;
    return sum + Math.max(0, size);
  }, 0);
  return {
    accountId: args.accountId,
    role: accountRoleLabel(args.accountRole),
    usage: {
      workspaces: accountWorkspaces.length,
      instances: {
        total: instances.length,
        published: publishedInstances,
        unpublished: Math.max(0, instances.length - publishedInstances),
      },
      assets: {
        total: usageAssets.length,
        active: usageAssets.length,
        bytesActive: usageBytes,
      },
    },
  };
}

async function buildRomaSettingsDomain(args: {
  env: Env;
  accountId: string;
  accountStatus: string;
  accountRole: MemberRole;
  workspace: {
    workspaceId: string;
    accountId: string;
    tier: WorkspaceRow['tier'];
    name: string;
    slug: string;
    role: MemberRole;
  };
}): Promise<RomaBootstrapDomainsPayload['settings']> {
  const accountWorkspaces = await loadAccountWorkspaces(args.env, args.accountId);
  const accountRoleLabelValue = accountRoleLabel(args.accountRole);
  return {
    accountSummary: {
      accountId: args.accountId,
      status: args.accountStatus,
      role: accountRoleLabelValue,
      workspaceCount: accountWorkspaces.length,
    },
    workspaceSummary: {
      workspaceId: args.workspace.workspaceId,
      accountId: args.workspace.accountId,
      tier: args.workspace.tier,
      name: args.workspace.name,
      slug: args.workspace.slug,
      role: args.workspace.role,
    },
    accountWorkspaces: accountWorkspaces
      .map((workspace) => ({
        workspaceId: workspace.id,
        accountId: workspace.account_id,
        tier: workspace.tier,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.created_at ?? null,
        updatedAt: workspace.updated_at ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function buildRomaBootstrapDomainsSnapshot(args: {
  env: Env;
  accountId: string;
  accountStatus: string;
  accountRole: MemberRole;
  workspace: {
    workspaceId: string;
    accountId: string;
    tier: WorkspaceRow['tier'];
    name: string;
    slug: string;
    role: MemberRole;
  };
}): Promise<RomaBootstrapDomainsResult> {
  const loaders: Record<RomaBootstrapDomainKey, () => Promise<RomaBootstrapDomainsPayload[RomaBootstrapDomainKey]>> = {
    widgets: () =>
      buildRomaWidgetsDomain({
        env: args.env,
        accountId: args.accountId,
        workspaceId: args.workspace.workspaceId,
        workspaceTier: args.workspace.tier,
        workspaceRole: args.workspace.role,
      }),
    templates: () =>
      buildRomaTemplatesDomain({
        env: args.env,
        accountId: args.accountId,
        workspaceId: args.workspace.workspaceId,
      }),
    assets: () =>
      buildRomaAssetsDomain({
        env: args.env,
        accountId: args.accountId,
        workspaceId: args.workspace.workspaceId,
      }),
    team: () =>
      buildRomaTeamDomain({
        env: args.env,
        workspaceId: args.workspace.workspaceId,
        workspaceRole: args.workspace.role,
      }),
    billing: () =>
      buildRomaBillingDomain({
        env: args.env,
        accountId: args.accountId,
        accountRole: args.accountRole,
      }),
    usage: () =>
      buildRomaUsageDomain({
        env: args.env,
        accountId: args.accountId,
        accountRole: args.accountRole,
      }),
    settings: () =>
      buildRomaSettingsDomain({
        env: args.env,
        accountId: args.accountId,
        accountStatus: args.accountStatus,
        accountRole: args.accountRole,
        workspace: args.workspace,
      }),
  };
  const keys = Object.keys(loaders) as RomaBootstrapDomainKey[];
  const fanoutStartedAt = Date.now();
  const settled = await Promise.allSettled(keys.map((key) => loaders[key]()));
  const domains: Partial<RomaBootstrapDomainsPayload> = {};
  const domainErrors: Partial<Record<RomaBootstrapDomainKey, RomaBootstrapDomainError>> = {};
  const domainOutcomes = {} as Record<RomaBootstrapDomainKey, RomaBootstrapDomainOutcome>;
  settled.forEach((result, index) => {
    const key = keys[index];
    if (!key) return;
    if (result.status === 'fulfilled') {
      (domains as Record<RomaBootstrapDomainKey, unknown>)[key] = result.value;
      domainOutcomes[key] = {
        status: 'ok',
        httpStatus: 200,
      };
      return;
    }
    const domainError = toDomainError(key, result.reason);
    domainErrors[key] = domainError;
    domainOutcomes[key] = {
      status: 'error',
      httpStatus: domainError.status,
      reasonKey: domainError.reasonKey,
    };
  });
  return {
    domains,
    domainErrors,
    domainOutcomes,
    bootstrapFanoutMs: Math.max(0, Date.now() - fanoutStartedAt),
  };
}

async function resolveAccountEntitlementsSnapshot(args: {
  env: Env;
  accountId: string;
  profile: WorkspaceRow['tier'];
  role: MemberRole;
}): Promise<AccountEntitlementsSnapshot> {
  const policy = resolvePolicy({ profile: args.profile, role: args.role });
  const budgets: Record<string, { max: number | null; used: number }> = {};

  await Promise.all(
    BUDGET_KEYS.map(async (budgetKey) => {
      const used = await readBudgetUsed({
        env: args.env,
        scope: { kind: 'account', accountId: args.accountId },
        budgetKey,
      });
      const max = policy.budgets[budgetKey]?.max ?? null;
      budgets[budgetKey] = { max, used };
    }),
  );

  return {
    flags: policy.flags,
    caps: policy.caps,
    budgets,
  };
}

function replayFromIdempotency(record: IdempotencyRecord): Response {
  const headers = new Headers();
  headers.set('x-idempotent-replay', '1');
  return json(record.body, { status: record.status, headers });
}

async function loadIdempotencyRecord(kv: KVNamespace, key: string): Promise<IdempotencyRecord | null> {
  const existing = await kvGetJson<IdempotencyRecord>(kv, key);
  if (!existing || existing.v !== 1) return null;
  if (!Number.isFinite(existing.status) || existing.status < 100 || existing.status > 599) return null;
  return existing;
}

async function storeIdempotencyRecord(
  kv: KVNamespace,
  key: string,
  status: number,
  body: unknown,
  ttlSec = ROMA_APP_IDEMPOTENCY_TTL_SEC,
): Promise<void> {
  const payload: IdempotencyRecord = {
    v: 1,
    status,
    body,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, ttlSec);
}

async function storeBootstrapOwner(kv: KVNamespace, accountId: string, userId: string): Promise<void> {
  const key = `roma:bootstrap:account-owner:${accountId}`;
  const payload: BootstrapOwnerRecord = {
    v: 1,
    userId,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, ROMA_APP_BOOTSTRAP_TTL_SEC);
}

async function hasBootstrapOwnerAccess(kv: KVNamespace, accountId: string, userId: string): Promise<boolean> {
  const key = `roma:bootstrap:account-owner:${accountId}`;
  const payload = await kvGetJson<BootstrapOwnerRecord>(kv, key);
  if (!payload || payload.v !== 1) return false;
  return payload.userId === userId;
}

async function clearBootstrapOwner(kv: KVNamespace, accountId: string): Promise<void> {
  await kv.delete(`roma:bootstrap:account-owner:${accountId}`);
}

async function createWorkspaceForAccount(args: {
  env: Env;
  accountId: string;
  name: string;
  slugBase: string;
}): Promise<{ ok: true; workspace: AccountWorkspaceRow } | { ok: false; response: Response }> {
  const { env, accountId, name, slugBase } = args;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`;
    const insertRes = await supabaseFetch(env, '/rest/v1/workspaces', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        account_id: accountId,
        name,
        slug,
        tier: 'free',
      }),
    });
    if (insertRes.status === 409) {
      continue;
    }
    if (!insertRes.ok) {
      const details = await readJson(insertRes);
      return {
        ok: false,
        response: ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
          500,
        ),
      };
    }
    const rows = ((await insertRes.json()) as AccountWorkspaceRow[]) ?? [];
    const workspace = rows[0];
    if (!workspace?.id) {
      return {
        ok: false,
        response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed' }, 500),
      };
    }
    return { ok: true, workspace };
  }

  return {
    ok: false,
    response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.slug.conflict' }, 409),
  };
}

function resolveMinibobHandoffRoute(publicId: string, workspaceId: string, accountId: string): string {
  const search = new URLSearchParams({
    workspaceId,
    accountId,
    publicId,
    subject: 'workspace',
  });
  return `/builder/${encodeURIComponent(publicId)}?${search.toString()}`;
}

async function materializeMinibobHandoffInstance(args: {
  env: Env;
  accountId: string;
  workspaceId: string;
  handoffId: string;
  widgetType: string;
  widgetId: string;
  config: Record<string, unknown>;
}): Promise<
  | { ok: true; publicId: string }
  | { ok: false; response: Response }
> {
  const handoffIdResult = assertHandoffId(args.handoffId);
  if (!handoffIdResult.ok) return { ok: false, response: handoffIdResult.response };

  const widgetTypeResult = assertWidgetType(args.widgetType);
  if (!widgetTypeResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422) };
  }
  const widgetType = widgetTypeResult.value;

  let widgetId = asTrimmedString(args.widgetId);
  if (!isUuid(widgetId)) {
    const widget = await loadWidgetByType(args.env, widgetType).catch(() => null);
    widgetId = asTrimmedString(widget?.id);
  }
  if (!widgetId || !isUuid(widgetId)) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' }, 404) };
  }

  const configResult = assertConfig(args.config);
  if (!configResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const suffix = handoffIdResult.value.replace(/^mbh_/, '').replace(/[^a-z0-9_-]/g, '').slice(0, 48) || 'handoff';
  const publicId = `wgt_${widgetType}_u_${suffix}`;
  const usageValidationError = await validateAccountAssetUsageForInstanceStrict({
    env: args.env,
    accountId: args.accountId,
    publicId,
    config: configResult.value,
  });
  if (usageValidationError) return { ok: false, response: usageValidationError };

  const insertRes = await supabaseFetch(args.env, '/rest/v1/widget_instances', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      widget_id: widgetId,
      public_id: publicId,
      status: 'unpublished',
      config: configResult.value,
      workspace_id: args.workspaceId,
      kind: 'user',
    }),
  });
  if (insertRes.status === 409) {
    const existing = await loadInstanceByPublicId(args.env, publicId).catch(() => null);
    if (existing && !('widget_type' in existing) && existing.workspace_id === args.workspaceId) {
      return { ok: true, publicId };
    }
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed' }, 409) };
  }
  if (!insertRes.ok) {
    const details = await readJson(insertRes);
    return {
      ok: false,
      response: ckError(
        { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
        500,
      ),
    };
  }

  const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env: args.env,
    accountId: args.accountId,
    publicId,
    config: configResult.value,
  });
  if (usageSyncError) {
    await rollbackCreatedWorkspaceInstanceOnUsageSyncFailure({
      env: args.env,
      workspaceId: args.workspaceId,
      publicId,
    });
    return { ok: false, response: usageSyncError };
  }

  return { ok: true, publicId };
}

export {
  buildRomaBootstrapDomainsSnapshot,
  clearBootstrapOwner,
  createWorkspaceForAccount,
  hasBootstrapOwnerAccess,
  loadIdempotencyRecord,
  materializeMinibobHandoffInstance,
  replayFromIdempotency,
  resolveAccountEntitlementsSnapshot,
  resolveMinibobHandoffRoute,
  type RomaBootstrapDomainError,
  type RomaBootstrapDomainKey,
  type RomaBootstrapDomainOutcome,
  storeBootstrapOwner,
  storeIdempotencyRecord,
};
