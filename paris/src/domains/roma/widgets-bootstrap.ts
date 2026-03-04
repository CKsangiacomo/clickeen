import { BUDGET_KEYS, resolvePolicy } from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import type { AccountRow, Env, InstanceRow, WidgetRow } from '../../shared/types';
import { authorizeAccount } from '../../shared/account-auth';
import { mintRomaAccountAuthzCapsule } from '../../shared/authz-capsule';
import { readBudgetUsed } from '../../shared/budgets';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { loadAccountById } from '../../shared/accounts';
import { resolveAdminAccountId } from '../../shared/admin';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertAccountId, assertConfig, isRecord } from '../../shared/validation';
import { assertPublicId, assertWidgetType, isCuratedInstanceRow, isCuratedPublicId } from '../../shared/instances';
import { syncAccountAssetUsageForInstanceStrict } from '../account-instances/helpers';
import { enqueueTokyoMirrorJob } from '../account-instances/service';
import { handleAccountCreateInstance } from '../account-instances/create-handler';
import { loadInstanceByAccountAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { resolveIdentityMePayload } from '../identity';

const ROMA_AUTHZ_CAPSULE_TTL_SEC = 15 * 60;

type AccountEntitlementsSnapshot = {
  flags: Record<string, boolean>;
  caps: Record<string, number | null>;
  budgets: Record<string, { max: number | null; used: number }>;
};

function normalizeMemberRole(value: unknown): MemberRole | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

function roleRank(role: MemberRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

async function resolveAccountEntitlementsSnapshot(args: {
  env: Env;
  accountId: string;
  profile: AccountRow['tier'];
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

function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  return `wgt_${stem}_u_${suffix}`;
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

type RomaWidgetsInstancePayload = {
  publicId: string;
  widgetType: string;
  displayName: string;
  status: 'published' | 'unpublished';
  source: 'account' | 'curated';
  actions: {
    edit: boolean;
    duplicate: boolean;
    delete: boolean;
  };
};

async function resolveWidgetTypesById(env: Env, widgetIds: string[]): Promise<Map<string, string>> {
  if (widgetIds.length === 0) return new Map();
  const unique = Array.from(new Set(widgetIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();
  const widgetParams = new URLSearchParams({
    select: 'id,type',
    id: `in.(${unique.join(',')})`,
    limit: String(unique.length),
  });
  const widgetRes = await supabaseFetch(env, `/rest/v1/widgets?${widgetParams.toString()}`, { method: 'GET' });
  if (!widgetRes.ok) {
    const details = await readJson(widgetRes);
    throw new Error(`[ParisWorker] Failed to load widget rows (${widgetRes.status}): ${JSON.stringify(details)}`);
  }
  const widgetRows = ((await widgetRes.json()) as WidgetRow[] | null) ?? [];
  const map = new Map<string, string>();
  widgetRows.forEach((row) => {
    const id = asTrimmedString(row?.id);
    const type = asTrimmedString(row?.type);
    if (id && type) map.set(id, type);
  });
  return map;
}

async function loadAccountWidgetInstances(env: Env, accountId: string): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,status,display_name,widget_id,created_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const res = await supabaseFetch(env, `/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to load account instances (${res.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await res.json()) as Array<Pick<InstanceRow, 'public_id' | 'status' | 'display_name' | 'widget_id'>> | null) ?? [];

  const widgetIds = Array.from(
    new Set(rows.map((row) => asTrimmedString(row.widget_id)).filter((id): id is string => Boolean(id))),
  );
  const widgetTypeById = await resolveWidgetTypesById(env, widgetIds);

  return rows.map((row) => {
    const widgetId = asTrimmedString(row.widget_id);
    const widgetType = widgetId ? widgetTypeById.get(widgetId) ?? 'unknown' : 'unknown';
    const status = row.status === 'published' ? 'published' : 'unpublished';
    return {
      publicId: row.public_id,
      widgetType,
      displayName: asTrimmedString(row.display_name) ?? 'Untitled widget',
      status,
      source: 'account',
      actions: { edit: true, duplicate: true, delete: true },
    };
  });
}

type CuratedWidgetInstanceListRow = {
  public_id: string;
  widget_type: string | null;
  status?: 'published' | 'unpublished' | null;
  meta: unknown;
  owner_account_id?: string | null;
};

async function loadOwnedCuratedWidgetInstances(env: Env, ownerAccountId: string): Promise<RomaWidgetsInstancePayload[]> {
  const params = new URLSearchParams({
    select: 'public_id,widget_type,status,meta,owner_account_id',
    owner_account_id: `eq.${ownerAccountId}`,
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    throw new Error(`[ParisWorker] Failed to load curated instances (${curatedRes.status}): ${JSON.stringify(details)}`);
  }
  const rows = ((await curatedRes.json()) as CuratedWidgetInstanceListRow[] | null) ?? [];
  return rows.map((row) => {
    const publicId = asTrimmedString(row.public_id) ?? 'unknown';
    const meta = readCuratedMeta(row.meta);
    return {
      publicId,
      widgetType: asTrimmedString(row.widget_type) ?? 'unknown',
      displayName: formatCuratedDisplayName(meta, publicId),
      status: row.status === 'unpublished' ? 'unpublished' : 'published',
      source: 'curated',
      actions: { edit: true, duplicate: true, delete: true },
    };
  });
}

async function loadAllWidgetTypes(env: Env): Promise<string[]> {
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
  const rows = ((await res.json()) as Array<{ type?: string | null }> | null) ?? [];
  return rows
    .map((row) => asTrimmedString(row.type))
    .filter((type): type is string => Boolean(type))
    .map((type) => type.toLowerCase())
    .sort((a, b) => a.localeCompare(b));
}

export async function handleRomaBootstrap(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveIdentityMePayload(req, env);
  if (!resolved.ok) return resolved.response;

  const accountId = resolved.payload.defaults.accountId;
  if (!accountId) {
    return json({ ...resolved.payload, authz: null }, { status: 200 });
  }

  const accountIdResult = assertAccountId(accountId);
  if (!accountIdResult.ok) return accountIdResult.response;

  const principal = resolved.principal;

  const membershipContext =
    resolved.payload.accounts.find((entry) => entry.accountId === accountIdResult.value) ?? null;
  if (!membershipContext) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  let account: AccountRow | null = null;
  try {
    account = await loadAccountById(env, accountIdResult.value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!account) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);
  }

  const role = normalizeMemberRole(membershipContext?.role) ?? 'viewer';
  const profile = account.tier;
  const authzVersion =
    asTrimmedString(membershipContext?.membershipVersion) ||
    `account:${account.id}:role:${role}:profile:${profile}`;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSec = nowSec + ROMA_AUTHZ_CAPSULE_TTL_SEC;
  const issuedAtIso = new Date(nowSec * 1000).toISOString();
  const expiresAtIso = new Date(expiresSec * 1000).toISOString();

  let accountCapsule: string;
  let entitlements: AccountEntitlementsSnapshot;
  try {
    const [capsule, entitlementsSnapshot] = await Promise.all([
      mintRomaAccountAuthzCapsule(env, {
        sub: principal.userId,
        userId: principal.userId,
        accountId: account.id,
        accountStatus: account.status ?? 'active',
        accountName: account.name,
        accountSlug: account.slug,
        accountWebsiteUrl: account.website_url,
        accountL10nLocales: account.l10n_locales,
        accountL10nPolicy: account.l10n_policy,
        role,
        profile,
        authzVersion,
        iat: nowSec,
        exp: expiresSec,
      }),
      resolveAccountEntitlementsSnapshot({
        env,
        accountId: account.id,
        profile,
        role,
      }),
    ]);
    accountCapsule = capsule.token;
    entitlements = entitlementsSnapshot;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.auth.contextUnavailable', detail }, 500);
  }

  return json({
    ...resolved.payload,
    authz: {
      accountCapsule,
      accountId: account.id,
      role,
      profile,
      authzVersion,
      issuedAt: issuedAtIso,
      expiresAt: expiresAtIso,
      entitlements,
    },
  });
}

export async function handleRomaWidgets(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.account.tier, role: authorized.role });
  const canMutate = policy.role !== 'viewer';

  let instances: RomaWidgetsInstancePayload[] = [];
  let allWidgetTypes: string[] = [];
  try {
    const [accountRows, ownedCuratedRows, widgetTypes] = await Promise.all([
      loadAccountWidgetInstances(env, accountId),
      loadOwnedCuratedWidgetInstances(env, accountId),
      loadAllWidgetTypes(env),
    ]);
    instances = [...accountRows, ...ownedCuratedRows];
    allWidgetTypes = widgetTypes;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const adminAccountId = resolveAdminAccountId(env);
  const canMutateCurated = canMutate && accountId === adminAccountId;

  const actionAware = instances.map((instance) => {
    const isCurated = instance.source === 'curated';
    return {
      ...instance,
      actions: {
        edit: true,
        duplicate: canMutate,
        delete: isCurated ? canMutateCurated : canMutate,
      },
    };
  });

  const widgetTypeSet = new Set<string>(allWidgetTypes.filter((type) => type !== 'unknown'));
  actionAware.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.account.id,
      tier: authorized.account.tier,
      name: authorized.account.name,
      slug: authorized.account.slug,
      role: authorized.role,
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: actionAware,
  });
}

export async function handleRomaTemplates(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'public_id,widget_type,status,meta',
    status: 'eq.published',
    order: 'created_at.desc',
    limit: '500',
  });
  const curatedRes = await supabaseFetch(env, `/rest/v1/curated_widget_instances?${params.toString()}`, { method: 'GET' });
  if (!curatedRes.ok) {
    const details = await readJson(curatedRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = ((await curatedRes.json()) as Array<{ public_id?: string; widget_type?: string | null; meta?: unknown }> | null) ?? [];

  const instances = rows
    .map((row) => {
      const publicId = asTrimmedString(row.public_id);
      if (!publicId) return null;
      const meta = readCuratedMeta(row.meta);
      return {
        publicId,
        widgetType: asTrimmedString(row.widget_type) ?? 'unknown',
        displayName: formatCuratedDisplayName(meta, publicId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const widgetTypes = Array.from(new Set(instances.map((instance) => instance.widgetType).filter((t) => t !== 'unknown'))).sort((a, b) =>
    a.localeCompare(b),
  );

  return json({
    account: {
      accountId: authorized.account.id,
    },
    widgetTypes,
    instances,
  });
}

export async function handleRomaWidgetDuplicate(req: Request, env: Env): Promise<Response> {
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }
  if (!isRecord(bodyRaw)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const accountIdResult = assertAccountId(bodyRaw.accountId);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const sourcePublicIdResult = assertPublicId(bodyRaw.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const sourcePublicId = sourcePublicIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  const sourceIsCurated = isCuratedPublicId(sourcePublicId);

  let sourceInstance: Awaited<ReturnType<typeof loadInstanceByAccountAndPublicId>> = null;
  try {
    sourceInstance = await loadInstanceByAccountAndPublicId(env, accountId, sourcePublicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!sourceInstance) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  let widgetType: string | null = null;
  try {
    widgetType = await resolveWidgetTypeForInstance(env, sourceInstance);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!widgetType) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.widgetMissing' }, 500);
  }
  const widgetTypeResult = assertWidgetType(widgetType);
  if (!widgetTypeResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
  }

  const configResult = assertConfig(sourceInstance.config);
  if (!configResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const destinationPublicId = createUserInstancePublicId(widgetTypeResult.value);
  const createUrl = new URL(req.url);
  createUrl.pathname = `/api/accounts/${encodeURIComponent(accountId)}/instances`;
  createUrl.search = '';
  createUrl.searchParams.set('subject', 'account');

  const createHeaders = new Headers();
  const authorization = req.headers.get('authorization');
  if (authorization) createHeaders.set('authorization', authorization);
  const capsule = req.headers.get('x-ck-authz-capsule');
  if (capsule) createHeaders.set('x-ck-authz-capsule', capsule);
  createHeaders.set('content-type', 'application/json');

  const createReq = new Request(createUrl.toString(), {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify({
      publicId: destinationPublicId,
      widgetType: widgetTypeResult.value,
      status: 'unpublished',
      config: configResult.value,
    }),
  });

  const createResponse = await handleAccountCreateInstance(createReq, env, accountId);
  if (!createResponse.ok) return createResponse;

  const createdPayload = await readJson(createResponse);
  const createdPublicIdRaw =
    createdPayload && typeof createdPayload === 'object' && 'publicId' in createdPayload
      ? asTrimmedString((createdPayload as { publicId?: unknown }).publicId)
      : null;
  const createdPublicId = createdPublicIdRaw || destinationPublicId;

  return json(
    {
      accountId,
      sourcePublicId,
      publicId: createdPublicId,
      widgetType: widgetTypeResult.value,
      status: 'unpublished',
      source: sourceIsCurated ? 'curated' : 'account',
    },
    { status: 201 },
  );
}

export async function handleRomaWidgetDelete(req: Request, env: Env, publicIdRaw: string): Promise<Response> {
  const publicIdResult = assertPublicId(publicIdRaw);
  if (!publicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const publicId = publicIdResult.value;

  const url = new URL(req.url);
  const accountIdResult = assertAccountId(url.searchParams.get('accountId'));
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'editor');
  if (!authorized.ok) return authorized.response;

  const adminAccountId = resolveAdminAccountId(env);
  const sourceIsCurated = isCuratedPublicId(publicId);
  if (sourceIsCurated && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  let existing: Awaited<ReturnType<typeof loadInstanceByAccountAndPublicId>> = null;
  try {
    existing = await loadInstanceByAccountAndPublicId(env, accountId, publicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!existing) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  if (sourceIsCurated && isCuratedInstanceRow(existing)) {
    const ownerAccountId = asTrimmedString(existing.owner_account_id) || null;
    if (ownerAccountId && ownerAccountId !== adminAccountId) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
  }

  let tokyoCleanupQueued = false;
  try {
    const enqueue = await enqueueTokyoMirrorJob(env, { v: 1, kind: 'delete-instance-mirror', publicId });
    tokyoCleanupQueued = enqueue.ok;
    if (!enqueue.ok) {
      console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', enqueue.error);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[ParisWorker] tokyo delete-instance-mirror enqueue failed', detail);
  }

  const deletePath = sourceIsCurated
    ? `/rest/v1/curated_widget_instances?public_id=eq.${encodeURIComponent(publicId)}`
    : `/rest/v1/widget_instances?public_id=eq.${encodeURIComponent(publicId)}&account_id=eq.${encodeURIComponent(accountId)}`;
  const deleteRes = await supabaseFetch(env, deletePath, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!deleteRes.ok) {
    const details = await readJson(deleteRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) }, 500);
  }

  const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env,
    accountId,
    publicId,
    config: {},
  });
  if (usageSyncError) return usageSyncError;

  return json(
    { accountId, publicId, source: sourceIsCurated ? 'curated' : 'account', deleted: true, tokyoCleanupQueued },
    { status: 200 },
  );
}
