import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from '../../shared/types';
import { assertDevAuth } from '../../shared/auth';
import { ckError } from '../../shared/errors';
import { readJson } from '../../shared/http';
import { readRomaAccountAuthzCapsuleHeader, verifyRomaAccountAuthzCapsule } from '../../shared/authz-capsule';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString } from '../../shared/validation';
import type {
  AccountAuthzResult,
  AccountRow,
  AccountWorkspaceRow,
  CuratedWidgetInstanceListRow,
  RomaWidgetsInstancePayload,
  WidgetLookupRow,
  WorkspaceMemberListRow,
  WorkspaceMembershipRow,
  WorkspaceWidgetInstanceRow,
} from './common';
import {
  DEFAULT_INSTANCE_DISPLAY_NAME,
  ROMA_WIDGET_LOOKUP_CACHE_TTL_MS,
  deriveHighestRole,
  normalizeRole,
  normalizeWorkspaceTier,
  resolveRomaWidgetLookupStore,
  roleRank,
} from './common';

async function loadAccount(env: Env, accountId: string): Promise<AccountRow | null> {
  const params = new URLSearchParams({
    select: 'id,status,is_platform',
    id: `eq.${accountId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/accounts?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = (await res.json()) as AccountRow[];
  return rows?.[0] ?? null;
}

async function loadAccountWorkspaces(env: Env, accountId: string): Promise<AccountWorkspaceRow[]> {
  const params = new URLSearchParams({
    select: 'id,account_id,tier,name,slug,created_at,updated_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspaces?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account workspaces (${res.status}): ${JSON.stringify(details)}`);
  }
  return ((await res.json()) as AccountWorkspaceRow[]) ?? [];
}

function normalizeWidgetTypeLabel(value: unknown): string {
  const widgetType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return widgetType || 'unknown';
}

function readCuratedMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function formatCuratedDisplayName(meta: Record<string, unknown> | null, fallback: string): string {
  if (!meta) return fallback;
  const styleName = asTrimmedString(meta.styleName ?? meta.name ?? meta.title);
  if (!styleName) return fallback;
  return styleName;
}

async function loadKnownWidgetTypes(env: Env): Promise<string[]> {
  const params = new URLSearchParams({
    select: 'type',
    order: 'type.asc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load widget types (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as Array<{ type?: string | null }>) ?? [];
  return Array.from(
    new Set(
      rows
        .map((row) => normalizeWidgetTypeLabel(row?.type))
        .filter((type) => type !== 'unknown'),
    ),
  );
}

async function resolveWidgetTypesById(env: Env, widgetIds: string[]): Promise<Map<string, string>> {
  const store = resolveRomaWidgetLookupStore();
  const now = Date.now();
  const missing: string[] = [];
  const resolved = new Map<string, string>();

  widgetIds.forEach((rawId) => {
    const widgetId = asTrimmedString(rawId);
    if (!widgetId) return;
    const cached = store.cache[widgetId];
    if (cached && cached.expiresAt > now) {
      resolved.set(widgetId, cached.widgetType);
      return;
    }
    if (cached) delete store.cache[widgetId];
    missing.push(widgetId);
  });

  if (missing.length > 0) {
    const uniqueMissing = Array.from(new Set(missing));
    const widgetParams = new URLSearchParams({
      select: 'id,type,name',
      id: `in.(${uniqueMissing.join(',')})`,
      limit: String(uniqueMissing.length),
    });
    const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
    if (!widgetRes.ok) {
      const details = await readJson(widgetRes);
      throw new Error(`[ParisWorker] Failed to load widget rows (${widgetRes.status}): ${JSON.stringify(details)}`);
    }
    const widgetRows = ((await widgetRes.json()) as WidgetLookupRow[]) ?? [];
    const rowById = new Map<string, WidgetLookupRow>();
    widgetRows.forEach((widget) => {
      const widgetId = asTrimmedString(widget.id);
      if (!widgetId) return;
      rowById.set(widgetId, widget);
    });

    uniqueMissing.forEach((widgetId) => {
      const row = rowById.get(widgetId);
      const widgetType = normalizeWidgetTypeLabel(row?.type);
      resolved.set(widgetId, widgetType);
      store.cache[widgetId] = {
        widgetType,
        expiresAt: Date.now() + ROMA_WIDGET_LOOKUP_CACHE_TTL_MS,
      };
    });
  }

  return resolved;
}

async function loadWorkspaceWidgetsInstances(
  env: Env,
  workspaceId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const withDisplayParams = new URLSearchParams({
    workspace_id: `eq.${workspaceId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  withDisplayParams.set('select', 'public_id,display_name,workspace_id,widget_id');
  const instanceRes = await supabaseFetch(env, `/rest/v1/widget_instances?${withDisplayParams.toString()}`, {
    method: 'GET',
  });
  if (!instanceRes.ok) {
    const details = await readJson(instanceRes);
    throw new Error(`[ParisWorker] Failed to load workspace instances (${instanceRes.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await instanceRes.json()) as WorkspaceWidgetInstanceRow[]) ?? [];

  const widgetIds = Array.from(
    new Set(rows.map((row) => asTrimmedString(row.widget_id)).filter((id): id is string => Boolean(id))),
  );
  const widgetTypeById = widgetIds.length > 0 ? await resolveWidgetTypesById(env, widgetIds) : new Map<string, string>();

  return rows.map((row) => {
    const widgetId = asTrimmedString(row.widget_id);
    const widgetType = widgetId ? widgetTypeById.get(widgetId) ?? 'unknown' : 'unknown';
    return {
      publicId: row.public_id,
      widgetType,
      displayName: asTrimmedString(row.display_name) || DEFAULT_INSTANCE_DISPLAY_NAME,
      workspaceId: asTrimmedString(row.workspace_id) || null,
      source: 'workspace',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
      },
    };
  });
}

async function loadCuratedWidgetsInstances(env: Env): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,meta,owner_account_id',
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    throw new Error(`[ParisWorker] Failed to load curated instances (${curatedRes.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await curatedRes.json()) as CuratedWidgetInstanceListRow[]) ?? [];
  return mapCuratedRowsToRomaInstances(rows);
}

async function loadOwnedCuratedWidgetsInstances(
  env: Env,
  ownerAccountId: string,
): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,meta,owner_account_id',
    owner_account_id: `eq.${ownerAccountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account-owned curated instances (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as CuratedWidgetInstanceListRow[]) ?? [];
  return mapCuratedRowsToRomaInstances(rows);
}

function mapCuratedRowsToRomaInstances(rows: CuratedWidgetInstanceListRow[]): RomaWidgetsInstancePayload[] {
  return rows.map((row) => {
    const publicId = asTrimmedString(row.public_id) || 'unknown';
    const meta = readCuratedMeta(row.meta);
    return {
      publicId,
      widgetType: normalizeWidgetTypeLabel(row.widget_type),
      displayName: formatCuratedDisplayName(meta, publicId),
      workspaceId: null,
      source: 'curated',
      actions: {
        edit: true,
        duplicate: true,
        delete: true,
      },
    };
  });
}

function mergeRomaWidgetInstances(
  primary: RomaWidgetsInstancePayload[],
  secondary: RomaWidgetsInstancePayload[],
): RomaWidgetsInstancePayload[] {
  const merged = new Map<string, RomaWidgetsInstancePayload>();
  for (const item of primary) merged.set(item.publicId, item);
  for (const item of secondary) {
    if (!merged.has(item.publicId)) merged.set(item.publicId, item);
  }
  return Array.from(merged.values());
}

type CuratedOwnerLookupRow = {
  public_id: string;
  owner_account_id?: string | null;
};

async function loadCuratedInstanceOwnerAccountId(env: Env, publicId: string): Promise<string | null> {
  const params = new URLSearchParams({
    select: 'public_id,owner_account_id',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load curated owner (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as CuratedOwnerLookupRow[]) ?? [];
  const owner = asTrimmedString(rows[0]?.owner_account_id);
  return owner || null;
}

async function deleteWorkspaceInstance(env: Env, workspaceId: string, publicId: string): Promise<void> {
  const deletePath = `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
  const deleteRes = await supabaseFetch(env, deletePath, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    throw new Error(`[ParisWorker] Failed to delete workspace instance (${deleteRes.status}): ${JSON.stringify(details)}`);
  }
}

async function deleteCuratedInstance(env: Env, publicId: string): Promise<void> {
  const deleteRes = await supabaseFetch(
    env,
    `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    throw new Error(`[ParisWorker] Failed to delete curated instance (${deleteRes.status}): ${JSON.stringify(details)}`);
  }
}

async function resolveAccountMembershipRole(env: Env, accountId: string, userId: string): Promise<MemberRole | null> {
  const workspaces = await loadAccountWorkspaces(env, accountId);
  const workspaceIds = workspaces.map((workspace) => workspace.id).filter(Boolean);
  if (workspaceIds.length === 0) return null;

  const membershipParams = new URLSearchParams({
    select: 'workspace_id,role',
    user_id: `eq.${userId}`,
    workspace_id: `in.(${workspaceIds.join(',')})`,
    limit: '500',
  });
  const membershipRes = await supabaseFetch(env, `/rest/v1/workspace_members?${membershipParams.toString()}`, {
    method: 'GET',
  });
  if (!membershipRes.ok) {
    const details = await readJson(membershipRes);
    throw new Error(`[ParisWorker] Failed to resolve account membership (${membershipRes.status}): ${JSON.stringify(details)}`);
  }
  const memberships = (await membershipRes.json()) as WorkspaceMembershipRow[];
  const roles: MemberRole[] = memberships
    .map((row) => normalizeRole(row.role))
    .filter((role): role is MemberRole => Boolean(role));
  return deriveHighestRole(roles);
}

function accountRoleLabel(workspaceRole: MemberRole): 'account_owner' | 'account_admin' | 'account_member' {
  if (workspaceRole === 'owner') return 'account_owner';
  if (workspaceRole === 'admin') return 'account_admin';
  return 'account_member';
}

async function authorizeAccount(
  req: Request,
  env: Env,
  accountId: string,
  minRole: MemberRole,
): Promise<AccountAuthzResult> {
  const auth = await assertDevAuth(req, env);
  if ('response' in auth) return { ok: false, response: auth.response };

  const userId = auth.principal?.userId ?? '';
  if (!userId) {
    return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
  }

  const accountCapsule = readRomaAccountAuthzCapsuleHeader(req);
  if (accountCapsule) {
    const verified = await verifyRomaAccountAuthzCapsule(env, accountCapsule);
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if (payload.userId !== userId || payload.accountId !== accountId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    return {
      ok: true,
      auth,
      account: {
        id: payload.accountId,
        status: payload.accountStatus,
        is_platform: false,
      },
      role: payload.role,
    };
  }

  let account: AccountRow | null = null;
  try {
    account = await loadAccount(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }
  if (!account) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404) };
  }

  let role: MemberRole | null = null;
  try {
    role = await resolveAccountMembershipRole(env, accountId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }

  if (!role) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  if (roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, auth, account, role };
}

function tierRank(tier: WorkspaceRow['tier']): number {
  switch (tier) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
    default:
      return 1;
  }
}

function inferHighestTier(workspaces: AccountWorkspaceRow[]): WorkspaceRow['tier'] {
  let tier: WorkspaceRow['tier'] = 'free';
  for (const workspace of workspaces) {
    if (tierRank(workspace.tier) > tierRank(tier)) tier = workspace.tier;
  }
  return tier;
}

function inferHighestTierFromIdentityWorkspaces(
  workspaces: Array<{
    accountId: string;
    tier: string;
  }>,
  accountId: string,
): WorkspaceRow['tier'] | null {
  let best: WorkspaceRow['tier'] | null = null;
  for (const workspace of workspaces) {
    if (asTrimmedString(workspace.accountId) !== accountId) continue;
    const tier = normalizeWorkspaceTier(workspace.tier);
    if (!tier) continue;
    if (!best || tierRank(tier) > tierRank(best)) best = tier;
  }
  return best;
}

export {
  accountRoleLabel,
  authorizeAccount,
  deleteCuratedInstance,
  deleteWorkspaceInstance,
  inferHighestTier,
  inferHighestTierFromIdentityWorkspaces,
  loadAccount,
  loadAccountWorkspaces,
  loadCuratedInstanceOwnerAccountId,
  loadCuratedWidgetsInstances,
  loadOwnedCuratedWidgetsInstances,
  loadWorkspaceWidgetsInstances,
  mergeRomaWidgetInstances,
  normalizeWidgetTypeLabel,
  resolveAccountMembershipRole,
};
