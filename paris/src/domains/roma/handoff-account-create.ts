import type { MemberRole } from '@clickeen/ck-policy';
import type { Env } from '../../shared/types';
import { assertSupabaseAuth } from '../../shared/auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig } from '../../shared/validation';
import { assertWidgetType } from '../../shared/instances';
import { authorizeWorkspace as authorizeWorkspaceAccess } from '../../shared/workspace-auth';
import type { MinibobHandoffStateRecord } from './common';
import {
  MINIBOB_HANDOFF_MAX_CONFIG_BYTES,
  MINIBOB_HANDOFF_STATE_TTL_SEC,
  assertAccountId,
  assertHandoffId,
  assertWorkspaceId,
  kvGetJson,
  kvPutJson,
  parseBodyAsRecord,
  requireIdempotencyKey,
  requireRomaAppKv,
  resolveMinibobHandoffSnapshot,
  resolveMinibobHandoffStateKey,
  roleRank,
  sanitizeWorkspaceName,
  sanitizeWorkspaceSlug,
} from './common';
import { accountRoleLabel, loadAccount, resolveAccountMembershipRole } from './data';
import {
  clearBootstrapOwner,
  createWorkspaceForAccount,
  hasBootstrapOwnerAccess,
  loadIdempotencyRecord,
  materializeMinibobHandoffInstance,
  replayFromIdempotency,
  resolveMinibobHandoffRoute,
  storeBootstrapOwner,
  storeIdempotencyRecord,
} from './bootstrap-core';

export async function handleMinibobHandoffStart(req: Request, env: Env): Promise<Response> {
  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const sourcePublicId =
    asTrimmedString(bodyResult.value.sourcePublicId) ||
    asTrimmedString(bodyResult.value.publicId);
  if (!sourcePublicId) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.sourcePublicIdRequired' }, 422);
  }

  let widgetTypeHint: string | undefined;
  if (bodyResult.value.widgetType !== undefined) {
    const widgetTypeResult = assertWidgetType(bodyResult.value.widgetType);
    if (!widgetTypeResult.ok) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
    widgetTypeHint = widgetTypeResult.value;
  }

  let draftConfig: Record<string, unknown> | undefined;
  if (bodyResult.value.draftConfig !== undefined) {
    const configResult = assertConfig(bodyResult.value.draftConfig);
    if (!configResult.ok) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
    const serialized = JSON.stringify(configResult.value);
    if (serialized.length > MINIBOB_HANDOFF_MAX_CONFIG_BYTES) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
    draftConfig = JSON.parse(serialized) as Record<string, unknown>;
  }

  const snapshot = await resolveMinibobHandoffSnapshot({
    env,
    sourcePublicId,
    widgetTypeHint,
    draftConfig,
  });
  if (!snapshot.ok) return snapshot.response;

  const handoffId = `mbh_${crypto.randomUUID().replace(/-/g, '')}`;
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + MINIBOB_HANDOFF_STATE_TTL_SEC * 1000).toISOString();

  const record: MinibobHandoffStateRecord = {
    v: 1,
    handoffId,
    sourcePublicId: snapshot.sourcePublicId,
    widgetType: snapshot.widgetType,
    widgetId: snapshot.widgetId,
    config: snapshot.config,
    status: 'pending',
    createdAt,
    expiresAt,
  };

  try {
    await kvPutJson(kv, resolveMinibobHandoffStateKey(handoffId), record, MINIBOB_HANDOFF_STATE_TTL_SEC);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.minibobHandoff.unavailable', detail }, 503);
  }

  return json(
    {
      handoffId,
      sourcePublicId: snapshot.sourcePublicId,
      widgetType: snapshot.widgetType,
      expiresAt,
    },
    { status: 201 },
  );
}

export async function handleAccountCreate(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `roma:idem:accounts:create:${auth.principal.userId}:${idempotencyKey}`;
  const existing = await loadIdempotencyRecord(kv, replayKey);
  if (existing) return replayFromIdempotency(existing);

  let bodyRaw: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      bodyRaw = await req.json();
    } catch {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
    }
  }
  if (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw)) {
    const ignoredName = asTrimmedString((bodyRaw as Record<string, unknown>).name);
    if (ignoredName && ignoredName.length > 120) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.account.name.invalid' }, 422);
    }
  } else if (bodyRaw !== null && bodyRaw !== undefined) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const accountId = crypto.randomUUID();
  const insertRes = await supabaseFetch(env, '/rest/v1/accounts', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: accountId,
      status: 'active',
      is_platform: false,
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

  try {
    await storeBootstrapOwner(kv, accountId, auth.principal.userId);
  } catch (error) {
    await supabaseFetch(env, `/rest/v1/accounts?id=eq.${accountId}`, { method: 'DELETE' }).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.idempotency.unavailable', detail }, 503);
  }

  const payload = {
    accountId,
    status: 'active',
    role: 'account_owner',
    bootstrap: {
      needsWorkspace: true,
      ownerSource: 'bootstrap_kv',
    },
  };
  await storeIdempotencyRecord(kv, replayKey, 201, payload).catch(() => undefined);
  return json(payload, { status: 201 });
}

export async function handleAccountCreateWorkspace(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `roma:idem:accounts:${accountId}:workspaces:create:${userId}:${idempotencyKey}`;
  const existing = await loadIdempotencyRecord(kv, replayKey);
  if (existing) return replayFromIdempotency(existing);

  const account = await loadAccount(env, accountId).catch(() => null);
  if (!account) return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.account.notFound' }, 404);

  let membershipRole: MemberRole | null = null;
  try {
    membershipRole = await resolveAccountMembershipRole(env, accountId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  let bootstrapAllowed = false;
  if (!membershipRole || roleRank(membershipRole) < roleRank('editor')) {
    bootstrapAllowed = await hasBootstrapOwnerAccess(kv, accountId, userId).catch(() => false);
    if (!bootstrapAllowed) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
    }
    membershipRole = 'owner';
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const nameResult = sanitizeWorkspaceName(bodyResult.value.name);
  if (!nameResult.ok) return nameResult.response;
  const slugResult = sanitizeWorkspaceSlug(bodyResult.value.slug, nameResult.value);
  if (!slugResult.ok) return slugResult.response;

  const created = await createWorkspaceForAccount({
    env,
    accountId,
    name: nameResult.value,
    slugBase: slugResult.value,
  });
  if (!created.ok) return created.response;

  const memberRes = await supabaseFetch(env, '/rest/v1/workspace_members', {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      workspace_id: created.workspace.id,
      user_id: userId,
      role: 'owner',
    }),
  });
  if (!memberRes.ok) {
    const details = await readJson(memberRes);
    return ckError(
      { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
      500,
    );
  }

  if (bootstrapAllowed) {
    await clearBootstrapOwner(kv, accountId).catch(() => undefined);
  }

  const payload = {
    accountId,
    role: accountRoleLabel(membershipRole),
    workspace: {
      workspaceId: created.workspace.id,
      accountId: created.workspace.account_id,
      tier: created.workspace.tier,
      name: created.workspace.name,
      slug: created.workspace.slug,
      createdAt: created.workspace.created_at ?? null,
      updatedAt: created.workspace.updated_at ?? null,
    },
  };
  await storeIdempotencyRecord(kv, replayKey, 201, payload).catch(() => undefined);
  return json(payload, { status: 201 });
}

export async function handleMinibobHandoffComplete(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaAppKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  const bodyResult = parseBodyAsRecord(bodyRaw);
  if (!bodyResult.ok) return bodyResult.response;

  const accountIdResult = assertAccountId(String(bodyResult.value.accountId || ''));
  if (!accountIdResult.ok) return accountIdResult.response;
  const workspaceIdResult = assertWorkspaceId(String(bodyResult.value.workspaceId || ''));
  if (!workspaceIdResult.ok) return workspaceIdResult.response;

  const handoffIdRaw = asTrimmedString(bodyResult.value.handoffId);
  if (!handoffIdRaw) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.idRequired' }, 422);
  }
  const handoffIdResult = assertHandoffId(handoffIdRaw);
  if (!handoffIdResult.ok) return handoffIdResult.response;
  const handoffId = handoffIdResult.value;

  const replayKey = `roma:idem:minibob:handoff:complete:${userId}:${idempotencyKey}`;
  const idemExisting = await loadIdempotencyRecord(kv, replayKey);
  if (idemExisting) return replayFromIdempotency(idemExisting);

  const workspaceAuth = await authorizeWorkspaceAccess(req, env, workspaceIdResult.value, 'viewer');
  if (!workspaceAuth.ok) return workspaceAuth.response;
  const workspace = workspaceAuth.workspace;
  if (workspace.account_id !== accountIdResult.value) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.account.mismatch' }, 403);
  }

  const handoffStateKey = resolveMinibobHandoffStateKey(handoffId);
  const existingHandoff = await kvGetJson<MinibobHandoffStateRecord>(kv, handoffStateKey);
  if (!existingHandoff || existingHandoff.v !== 1) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.minibobHandoff.notFound' }, 404);
  }
  if (existingHandoff.handoffId !== handoffId) {
    return ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.minibobHandoff.notFound' }, 404);
  }

  const expiresAtMs = Date.parse(existingHandoff.expiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.expired' }, 410);
  }

  if (existingHandoff.status === 'consumed') {
    const sameTarget =
      existingHandoff.consumedByUserId === userId &&
      existingHandoff.consumedAccountId === accountIdResult.value &&
      existingHandoff.consumedWorkspaceId === workspaceIdResult.value &&
      typeof existingHandoff.resultPublicId === 'string' &&
      existingHandoff.resultPublicId.length > 0;
    if (!sameTarget) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed' }, 409);
    }
    const replayPayload = {
      handoffId: existingHandoff.handoffId,
      accountId: existingHandoff.consumedAccountId as string,
      workspaceId: existingHandoff.consumedWorkspaceId as string,
      sourcePublicId: existingHandoff.sourcePublicId,
      publicId: existingHandoff.resultPublicId as string,
      builderRoute: resolveMinibobHandoffRoute(
        existingHandoff.resultPublicId as string,
        existingHandoff.consumedWorkspaceId as string,
        existingHandoff.consumedAccountId as string,
      ),
      replay: true,
    };
    await storeIdempotencyRecord(kv, replayKey, 200, replayPayload).catch(() => undefined);
    return json(replayPayload, { status: 200 });
  }
  if (existingHandoff.status !== 'pending') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.unavailable' }, 409);
  }

  const materialized = await materializeMinibobHandoffInstance({
    env,
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    handoffId,
    widgetType: existingHandoff.widgetType,
    widgetId: existingHandoff.widgetId,
    config: existingHandoff.config,
  });
  if (!materialized.ok) return materialized.response;

  const completedState: MinibobHandoffStateRecord = {
    ...existingHandoff,
    status: 'consumed',
    consumedAt: new Date().toISOString(),
    consumedByUserId: userId,
    consumedAccountId: accountIdResult.value,
    consumedWorkspaceId: workspaceIdResult.value,
    resultPublicId: materialized.publicId,
  };
  await kvPutJson(kv, handoffStateKey, completedState, MINIBOB_HANDOFF_STATE_TTL_SEC).catch(() => undefined);

  const payload = {
    handoffId,
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    sourcePublicId: existingHandoff.sourcePublicId,
    publicId: materialized.publicId,
    builderRoute: resolveMinibobHandoffRoute(materialized.publicId, workspaceIdResult.value, accountIdResult.value),
    replay: false,
  };
  await storeIdempotencyRecord(kv, replayKey, 200, payload).catch(() => undefined);
  return json(payload, { status: 200 });
}
