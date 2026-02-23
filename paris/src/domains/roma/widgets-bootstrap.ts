import { resolvePolicy } from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { mintRomaAccountAuthzCapsule, mintRomaWorkspaceAuthzCapsule } from '../../shared/authz-capsule';
import { asTrimmedString, assertConfig } from '../../shared/validation';
import { authorizeWorkspace as authorizeWorkspaceAccess } from '../../shared/workspace-auth';
import { allowCuratedWrites, assertPublicId, assertWidgetType, isCuratedPublicId } from '../../shared/instances';
import { loadInstanceByPublicId, loadInstanceByWorkspaceAndPublicId, resolveWidgetTypeForInstance } from '../instances';
import { handleWorkspaceCreateInstance } from '../workspaces';
import { resolveIdentityMePayload } from '../identity';
import type { AccountEntitlementsSnapshot, RomaBootstrapDomainsPayload, RomaWidgetsInstancePayload } from './common';
import {
  ROMA_AUTHZ_CAPSULE_TTL_SEC,
  assertWorkspaceId,
  createUserInstancePublicId,
  deriveHighestRole,
  normalizeRole,
  normalizeWorkspaceTier,
  parseBodyAsRecord,
  syncAccountAssetUsageForInstanceStrict,
} from './common';
import {
  deleteCuratedInstance,
  deleteWorkspaceInstance,
  inferHighestTierFromIdentityWorkspaces,
  loadCuratedInstanceOwnerAccountId,
  loadCuratedWidgetsInstances,
  loadOwnedCuratedWidgetsInstances,
  loadWorkspaceWidgetsInstances,
  mergeRomaWidgetInstances,
} from './data';
import {
  buildRomaBootstrapDomainsSnapshot,
  resolveAccountEntitlementsSnapshot,
  type RomaBootstrapDomainError,
  type RomaBootstrapDomainKey,
  type RomaBootstrapDomainOutcome,
} from './bootstrap-core';

export async function handleWorkspaceGet(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const workspace = authorized.workspace;
  return json({
    workspaceId: workspace.id,
    accountId: workspace.account_id,
    tier: workspace.tier,
    name: workspace.name,
    slug: workspace.slug,
    role: authorized.role,
  });
}

export async function handleRomaWidgetDuplicate(req: Request, env: Env): Promise<Response> {
  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const workspaceIdResult = assertWorkspaceId(String(bodyResult.value.workspaceId || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const sourcePublicIdResult = assertPublicId(bodyResult.value.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const sourcePublicId = sourcePublicIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;

  const sourceIsCurated = isCuratedPublicId(sourcePublicId);

  let sourceInstance: Awaited<ReturnType<typeof loadInstanceByPublicId>> = null;
  try {
    sourceInstance = sourceIsCurated
      ? await loadInstanceByPublicId(env, sourcePublicId)
      : await loadInstanceByWorkspaceAndPublicId(env, workspaceId, sourcePublicId);
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
  createUrl.pathname = `/api/workspaces/${encodeURIComponent(workspaceId)}/instances`;
  createUrl.search = '';
  createUrl.searchParams.set('subject', 'workspace');

  const createHeaders = new Headers();
  const authorization = req.headers.get('authorization');
  if (authorization) createHeaders.set('authorization', authorization);
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

  const createResponse = await handleWorkspaceCreateInstance(createReq, env, workspaceId);
  if (!createResponse.ok) return createResponse;

  const createdPayload = await readJson(createResponse);
  const createdPublicIdRaw =
    createdPayload && typeof createdPayload === 'object' && 'publicId' in createdPayload
      ? asTrimmedString((createdPayload as { publicId?: unknown }).publicId)
      : null;
  const createdPublicId = createdPublicIdRaw || destinationPublicId;

  return json(
    {
      workspaceId,
      sourcePublicId,
      publicId: createdPublicId,
      widgetType: widgetTypeResult.value,
      status: 'unpublished',
      source: sourceIsCurated ? 'curated' : 'workspace',
    },
    { status: 201 },
  );
}

export async function handleRomaWidgetDelete(
  req: Request,
  env: Env,
  publicIdRaw: string,
): Promise<Response> {
  const publicIdResult = assertPublicId(publicIdRaw);
  if (!publicIdResult.ok) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422);
  }
  const publicId = publicIdResult.value;

  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'editor');
  if (!authorized.ok) return authorized.response;
  const policy = resolvePolicy({
    profile: authorized.workspace.tier,
    role: authorized.role,
  });
  const canMutateWorkspace = policy.role !== 'viewer';
  const canDeleteCurated = allowCuratedWrites(env) && canMutateWorkspace;

  const sourceIsCurated = isCuratedPublicId(publicId);
  if (sourceIsCurated) {
    if (!canDeleteCurated) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }

    let ownerAccountId: string | null = null;
    try {
      ownerAccountId = await loadCuratedInstanceOwnerAccountId(env, publicId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
    }
    if (!ownerAccountId) {
      return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
    }
    if (ownerAccountId !== authorized.workspace.account_id) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }

    try {
      await deleteCuratedInstance(env, publicId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
    }
    const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
      env,
      accountId: authorized.workspace.account_id,
      publicId,
      config: {},
    });
    if (usageSyncError) return usageSyncError;

    return json({ workspaceId, publicId, source: 'curated', deleted: true }, { status: 200 });
  }

  let existing: Awaited<ReturnType<typeof loadInstanceByWorkspaceAndPublicId>> = null;
  try {
    existing = await loadInstanceByWorkspaceAndPublicId(env, workspaceId, publicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }
  if (!existing) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404);
  }

  try {
    await deleteWorkspaceInstance(env, workspaceId, publicId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail }, 500);
  }
  const usageSyncError = await syncAccountAssetUsageForInstanceStrict({
    env,
    accountId: authorized.workspace.account_id,
    publicId,
    config: {},
  });
  if (usageSyncError) return usageSyncError;

  return json({ workspaceId, publicId, source: 'workspace', deleted: true }, { status: 200 });
}

export async function handleRomaBootstrap(req: Request, env: Env): Promise<Response> {
  const resolved = await resolveIdentityMePayload(req, env);
  if (!resolved.ok) return resolved.response;

  const payload = resolved.payload;
  const workspaceId = asTrimmedString(payload.defaults.workspaceId) || '';
  const workspace = workspaceId
    ? payload.workspaces.find((candidate) => candidate.workspaceId === workspaceId) ?? null
    : null;

  let authz: {
    workspaceCapsule: string | null;
    workspaceId: string | null;
    accountId: string | null;
    role: MemberRole | null;
    profile: WorkspaceRow['tier'] | null;
    authzVersion: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    accountCapsule: string | null;
    accountRole: MemberRole | null;
    accountProfile: WorkspaceRow['tier'] | null;
    accountAuthzVersion: string | null;
    accountIssuedAt: string | null;
    accountExpiresAt: string | null;
    entitlements: AccountEntitlementsSnapshot | null;
  } = {
    workspaceCapsule: null,
    workspaceId: null,
    accountId: null,
    role: null,
    profile: null,
    authzVersion: null,
    issuedAt: null,
    expiresAt: null,
    accountCapsule: null,
    accountRole: null,
    accountProfile: null,
    accountAuthzVersion: null,
    accountIssuedAt: null,
    accountExpiresAt: null,
    entitlements: null,
  };
  let domains: Partial<RomaBootstrapDomainsPayload> | null = null;
  let domainErrors: Partial<Record<RomaBootstrapDomainKey, RomaBootstrapDomainError>> = {};
  let bootstrapDomainOutcomes: Partial<Record<RomaBootstrapDomainKey, RomaBootstrapDomainOutcome>> = {};
  let bootstrapFanoutMs: number | null = null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSec = nowSec + ROMA_AUTHZ_CAPSULE_TTL_SEC;
  const issuedAtIso = new Date(nowSec * 1000).toISOString();
  const expiresAtIso = new Date(expiresSec * 1000).toISOString();

  if (workspace) {
    const role = normalizeRole(workspace.role);
    const profile = normalizeWorkspaceTier(workspace.tier);
    const accountId = asTrimmedString(workspace.accountId);
    const authzVersion =
      asTrimmedString(workspace.membershipVersion) || `workspace:${workspace.workspaceId}:role:${workspace.role}`;

    if (role && profile && accountId) {
      const accountRecord = payload.accounts.find((entry) => asTrimmedString(entry.accountId) === accountId) ?? null;
      const accountStatus = asTrimmedString(accountRecord?.status) || 'active';
      const roleCandidates: MemberRole[] = [
        role,
        ...(Array.isArray(accountRecord?.workspaceRoles)
          ? accountRecord.workspaceRoles
              .map((candidate) => normalizeRole(candidate))
              .filter((candidate): candidate is MemberRole => Boolean(candidate))
          : []),
      ];
      const accountRole = deriveHighestRole(roleCandidates);
      const accountRoleResolved: MemberRole = accountRole ?? role;
      const accountProfile = inferHighestTierFromIdentityWorkspaces(payload.workspaces, accountId) || profile;
      const accountAuthzVersion = `account:${accountId}:role:${accountRoleResolved}:profile:${accountProfile}`;

      try {
        const [workspaceCapsule, accountCapsule, entitlements] = await Promise.all([
          mintRomaWorkspaceAuthzCapsule(env, {
            sub: resolved.principal.userId,
            userId: resolved.principal.userId,
            accountId,
            workspaceId: workspace.workspaceId,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            workspaceWebsiteUrl: workspace.websiteUrl ?? null,
            workspaceTier: profile,
            role,
            authzVersion,
            iat: nowSec,
            exp: expiresSec,
          }),
          mintRomaAccountAuthzCapsule(env, {
            sub: resolved.principal.userId,
            userId: resolved.principal.userId,
            accountId,
            accountStatus,
            role: accountRoleResolved,
            profile: accountProfile,
            authzVersion: accountAuthzVersion,
            iat: nowSec,
            exp: expiresSec,
          }),
          resolveAccountEntitlementsSnapshot({
            env,
            accountId,
            profile: accountProfile,
            role: accountRoleResolved,
          }),
        ]);

        authz = {
          workspaceCapsule: workspaceCapsule.token,
          workspaceId: workspace.workspaceId,
          accountId,
          role,
          profile,
          authzVersion,
          issuedAt: issuedAtIso,
          expiresAt: expiresAtIso,
          accountCapsule: accountCapsule?.token ?? null,
          accountRole: accountRoleResolved,
          accountProfile,
          accountAuthzVersion,
          accountIssuedAt: issuedAtIso,
          accountExpiresAt: expiresAtIso,
          entitlements,
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return ckError(
          {
            kind: 'INTERNAL',
            reasonKey: 'coreui.errors.auth.contextUnavailable',
            detail,
          },
          500,
        );
      }

      try {
        const snapshot = await buildRomaBootstrapDomainsSnapshot({
          env,
          accountId,
          accountStatus,
          accountRole: accountRoleResolved,
          workspace: {
            workspaceId: workspace.workspaceId,
            accountId,
            tier: profile,
            name: workspace.name,
            slug: workspace.slug,
            role,
          },
        });
        domains = snapshot.domains;
        domainErrors = snapshot.domainErrors;
        bootstrapDomainOutcomes = snapshot.domainOutcomes;
        bootstrapFanoutMs = snapshot.bootstrapFanoutMs;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        domainErrors = {
          widgets: { reasonKey: 'roma.errors.bootstrap.widgets_unavailable', status: 502, detail },
          templates: { reasonKey: 'roma.errors.bootstrap.templates_unavailable', status: 502, detail },
          assets: { reasonKey: 'roma.errors.bootstrap.assets_unavailable', status: 502, detail },
          team: { reasonKey: 'roma.errors.bootstrap.team_unavailable', status: 502, detail },
          billing: { reasonKey: 'roma.errors.bootstrap.billing_unavailable', status: 502, detail },
          usage: { reasonKey: 'roma.errors.bootstrap.usage_unavailable', status: 502, detail },
          settings: { reasonKey: 'roma.errors.bootstrap.settings_unavailable', status: 502, detail },
        };
        bootstrapDomainOutcomes = {
          widgets: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.widgets_unavailable' },
          templates: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.templates_unavailable' },
          assets: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.assets_unavailable' },
          team: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.team_unavailable' },
          billing: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.billing_unavailable' },
          usage: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.usage_unavailable' },
          settings: { status: 'error', httpStatus: 502, reasonKey: 'roma.errors.bootstrap.settings_unavailable' },
        };
        bootstrapFanoutMs = null;
        domains = {};
      }
    }
  }

  const publicAccounts = payload.accounts.map((account) => ({
    accountId: account.accountId,
    status: account.status,
    derivedRole: account.derivedRole,
    workspaceRoles: account.workspaceRoles,
  }));

  return json({
    ...payload,
    accounts: publicAccounts,
    authz,
    domains,
    domainErrors,
    bootstrapFanoutMs,
    bootstrapDomainOutcomes,
  });
}

export async function handleRomaWidgets(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let catalogInstances: RomaWidgetsInstancePayload[] = [];
  try {
    const [workspaceRows, ownedCuratedRows] = await Promise.all([
      loadWorkspaceWidgetsInstances(env, authorized.workspace.id),
      loadOwnedCuratedWidgetsInstances(env, authorized.workspace.account_id),
    ]);
    catalogInstances = mergeRomaWidgetInstances(workspaceRows, ownedCuratedRows);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const policy = resolvePolicy({
    profile: authorized.workspace.tier,
    role: authorized.role,
  });
  const canMutateWorkspace = policy.role !== 'viewer';
  const canDeleteCurated = allowCuratedWrites(env) && canMutateWorkspace;
  const actionAwareInstances = catalogInstances.map((instance) => ({
    ...instance,
    actions: {
      edit: true,
      duplicate: canMutateWorkspace,
      delete: instance.source === 'curated' ? canDeleteCurated : canMutateWorkspace,
    },
  }));

  const widgetTypeSet = new Set<string>();
  actionAwareInstances.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.workspace.account_id,
    },
    workspace: {
      workspaceId: authorized.workspace.id,
      accountId: authorized.workspace.account_id,
      name: authorized.workspace.name,
      slug: authorized.workspace.slug,
      tier: authorized.workspace.tier,
      role: authorized.role,
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: actionAwareInstances,
  });
}

export async function handleRomaTemplates(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const workspaceIdResult = assertWorkspaceId(String(url.searchParams.get('workspaceId') || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspaceAccess(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let curatedInstances: RomaWidgetsInstancePayload[] = [];
  try {
    curatedInstances = await loadCuratedWidgetsInstances(env);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const widgetTypeSet = new Set<string>();
  curatedInstances.forEach((instance) => {
    if (instance.widgetType !== 'unknown') widgetTypeSet.add(instance.widgetType);
  });

  return json({
    account: {
      accountId: authorized.workspace.account_id,
    },
    workspace: {
      workspaceId: authorized.workspace.id,
      accountId: authorized.workspace.account_id,
      name: authorized.workspace.name,
      slug: authorized.workspace.slug,
      tier: authorized.workspace.tier,
      role: authorized.role,
    },
    widgetTypes: Array.from(widgetTypeSet).sort((a, b) => a.localeCompare(b)),
    instances: curatedInstances,
  });
}
