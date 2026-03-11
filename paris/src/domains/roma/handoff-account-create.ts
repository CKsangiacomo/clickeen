import type { Env } from '../../shared/types';
import { assertSupabaseAuth } from '../../shared/auth';
import { authorizeAccount } from '../../shared/account-auth';
import { ckError, errorDetail } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { resolveAdminAccountId } from '../../shared/admin';
import { asTrimmedString, assertAccountId, assertConfig, isRecord, isUuid } from '../../shared/validation';
import { assertPublicId, assertWidgetType, isCuratedPublicId } from '../../shared/instances';
import { handleAccountCreateInstance } from '../account-instances/create-handler';
import { loadInstanceByPublicId, loadWidgetByType } from '../instances';

const ROMA_IDEMPOTENCY_TTL_SEC = 60 * 60 * 24 * 7;
const MINIBOB_HANDOFF_STATE_TTL_SEC = 60 * 60 * 24 * 7;
const MINIBOB_HANDOFF_MAX_CONFIG_BYTES = 7000;

function isLocalStage(env: Env): boolean {
  return (asTrimmedString(env.ENV_STAGE) ?? 'cloud-dev').toLowerCase() === 'local';
}

type IdempotencyRecord = {
  v: 1;
  status: number;
  body: unknown;
  createdAt: string;
};

type MinibobHandoffStateRecord = {
  v: 1;
  handoffId: string;
  sourcePublicId: string;
  widgetType: string;
  config: Record<string, unknown>;
  status: 'pending' | 'consumed';
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByUserId?: string;
  consumedAccountId?: string;
  resultPublicId?: string;
};

function requireRomaKv(env: Env): { ok: true; kv: KVNamespace } | { ok: false; response: Response } {
  if (!env.USAGE_KV) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.idempotency.unavailable' }, 503),
    };
  }
  return { ok: true, kv: env.USAGE_KV };
}

async function kvGetJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(kv: KVNamespace, key: string, value: object, expirationTtl: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl });
}

function requireIdempotencyKey(req: Request): { ok: true; value: string } | { ok: false; response: Response } {
  const key = (req.headers.get('Idempotency-Key') || '').trim();
  if (!key) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.required' }, 422),
    };
  }
  if (!/^[a-z0-9_-]{8,200}$/i.test(key)) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.invalid' }, 422),
    };
  }
  return { ok: true, value: key };
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

async function storeIdempotencyRecord(kv: KVNamespace, key: string, status: number, body: unknown): Promise<void> {
  const payload: IdempotencyRecord = {
    v: 1,
    status,
    body,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, ROMA_IDEMPOTENCY_TTL_SEC);
}


function resolveMinibobHandoffStateKey(handoffId: string): string {
  return `roma:minibob:handoff:state:${handoffId}`;
}

function assertHandoffId(value: unknown): { ok: true; value: string } | { ok: false; response: Response } {
  const handoffId = asTrimmedString(value);
  if (!handoffId || !/^mbh_[a-z0-9]{16,64}$/.test(handoffId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.idInvalid' }, 422) };
  }
  return { ok: true, value: handoffId };
}

async function resolveMinibobHandoffSnapshot(args: {
  env: Env;
  sourcePublicId: string;
  widgetTypeHint?: string;
  draftConfig?: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      sourcePublicId: string;
      widgetType: string;
      config: Record<string, unknown>;
    }
  | { ok: false; response: Response }
> {
  const sourcePublicIdResult = assertPublicId(args.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.publicId.invalid' }, 422) };
  }
  const sourcePublicId = sourcePublicIdResult.value;
  if (!isCuratedPublicId(sourcePublicId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const sourceInstance =
    args.widgetTypeHint && args.draftConfig ? null : await loadInstanceByPublicId(args.env, sourcePublicId).catch(() => null);
  if (!sourceInstance && !args.draftConfig) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404) };
  }
  if (sourceInstance && !('widget_type' in sourceInstance)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const resolvedWidgetType =
    args.widgetTypeHint || (sourceInstance && 'widget_type' in sourceInstance ? asTrimmedString(sourceInstance.widget_type) : null);
  const widgetTypeResult = assertWidgetType(resolvedWidgetType);
  if (!widgetTypeResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422) };
  }
  const widgetType = widgetTypeResult.value;

  const widget = await loadWidgetByType(args.env, widgetType).catch(() => null);
  if (!widget?.id || !isUuid(widget.id)) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' }, 404) };
  }

  const configCandidate =
    args.draftConfig ??
    (sourceInstance && 'config' in sourceInstance ? (sourceInstance.config as Record<string, unknown>) : null);
  const configResult = assertConfig(configCandidate);
  if (!configResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }
  const serializedConfig = JSON.stringify(configResult.value);
  if (serializedConfig.length > MINIBOB_HANDOFF_MAX_CONFIG_BYTES) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  return {
    ok: true,
    sourcePublicId,
    widgetType,
    config: JSON.parse(serializedConfig) as Record<string, unknown>,
  };
}

function resolveMinibobHandoffRoute(publicId: string, accountId: string): string {
  const search = new URLSearchParams({
    accountId,
    publicId,
    subject: 'account',
  });
  return `/builder/${encodeURIComponent(publicId)}?${search.toString()}`;
}

function createUserInstancePublicIdFromHandoff(widgetType: string, handoffId: string): string {
  const suffix = String(handoffId || '')
    .replace(/^mbh_/, '')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 48);
  const safeSuffix = suffix || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `wgt_${widgetType}_u_${safeSuffix}`;
}

async function materializeMinibobHandoffInstance(args: {
  req: Request;
  env: Env;
  accountId: string;
  widgetType: string;
  config: Record<string, unknown>;
  publicId: string;
}): Promise<{ ok: true; publicId: string } | { ok: false; response: Response }> {
  const createUrl = new URL(args.req.url);
  createUrl.pathname = `/api/accounts/${encodeURIComponent(args.accountId)}/instances`;
  createUrl.search = '';
  createUrl.searchParams.set('subject', 'account');

  const createHeaders = new Headers();
  const authorization = args.req.headers.get('authorization');
  if (authorization) createHeaders.set('authorization', authorization);
  const capsule = args.req.headers.get('x-ck-authz-capsule');
  if (capsule) createHeaders.set('x-ck-authz-capsule', capsule);
  createHeaders.set('content-type', 'application/json');

  const createReq = new Request(createUrl.toString(), {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify({
      publicId: args.publicId,
      widgetType: args.widgetType,
      status: 'unpublished',
      config: args.config,
    }),
  });

  const res = await handleAccountCreateInstance(createReq, args.env, args.accountId);
  if (!res.ok) return { ok: false, response: res };
  const payload = await readJson(res);
  const createdPublicId =
    payload && typeof payload === 'object' && 'publicId' in payload ? asTrimmedString((payload as any).publicId) : null;
  return { ok: true, publicId: createdPublicId || args.publicId };
}

export async function handleMinibobHandoffStart(req: Request, env: Env): Promise<Response> {
  const kvResult = requireRomaKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }
  if (!isRecord(bodyRaw)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const sourcePublicId = asTrimmedString(bodyRaw.sourcePublicId) || asTrimmedString(bodyRaw.publicId);
  if (!sourcePublicId) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.minibobHandoff.sourcePublicIdRequired' }, 422);
  }

  let widgetTypeHint: string | undefined;
  if (bodyRaw.widgetType !== undefined) {
    const widgetTypeResult = assertWidgetType(bodyRaw.widgetType);
    if (!widgetTypeResult.ok) {
      return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422);
    }
    widgetTypeHint = widgetTypeResult.value;
  }

  let draftConfig: Record<string, unknown> | undefined;
  if (bodyRaw.draftConfig !== undefined) {
    const configResult = assertConfig(bodyRaw.draftConfig);
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
    config: snapshot.config,
    status: 'pending',
    createdAt,
    expiresAt,
  };

  try {
    await kvPutJson(kv, resolveMinibobHandoffStateKey(handoffId), record, MINIBOB_HANDOFF_STATE_TTL_SEC);
  } catch (error) {
    const detail = errorDetail(error);
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

export async function handleMinibobHandoffComplete(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireRomaKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  let bodyRaw: unknown;
  try {
    bodyRaw = await req.json();
  } catch {
    bodyRaw = null;
  }
  if (!isRecord(bodyRaw)) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  const accountIdResult = assertAccountId(bodyRaw.accountId);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;
  const adminAccountId = resolveAdminAccountId(env);
  if (!isLocalStage(env) && accountId !== adminAccountId) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.unavailable', detail: 'minibob_handoff_admin_account_only' }, 403);
  }

  const handoffIdResult = assertHandoffId(bodyRaw.handoffId);
  if (!handoffIdResult.ok) return handoffIdResult.response;
  const handoffId = handoffIdResult.value;

  const replayKey = `roma:idem:minibob:handoff:complete:${userId}:${idempotencyKey}`;
  const idemExisting = await loadIdempotencyRecord(kv, replayKey);
  if (idemExisting) return replayFromIdempotency(idemExisting);

  const accountAuth = await authorizeAccount(req, env, accountId, 'editor');
  if (!accountAuth.ok) return accountAuth.response;

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
      existingHandoff.consumedAccountId === accountId &&
      typeof existingHandoff.resultPublicId === 'string' &&
      existingHandoff.resultPublicId.length > 0;
    if (!sameTarget) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed' }, 409);
    }

    const resultPublicId = existingHandoff.resultPublicId as string;
    const replayPayload = {
      handoffId: existingHandoff.handoffId,
      accountId: existingHandoff.consumedAccountId as string,
      sourcePublicId: existingHandoff.sourcePublicId,
      publicId: resultPublicId,
      builderRoute: resolveMinibobHandoffRoute(resultPublicId, existingHandoff.consumedAccountId as string),
      replay: true,
    };
    await storeIdempotencyRecord(kv, replayKey, 200, replayPayload).catch(() => undefined);
    return json(replayPayload, { status: 200 });
  }

  if (existingHandoff.status !== 'pending') {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.minibobHandoff.unavailable' }, 409);
  }

  const publicId = createUserInstancePublicIdFromHandoff(existingHandoff.widgetType, handoffId);
  const materialized = await materializeMinibobHandoffInstance({
    req,
    env,
    accountId,
    widgetType: existingHandoff.widgetType,
    config: existingHandoff.config,
    publicId,
  });
  if (!materialized.ok) return materialized.response;

  const completedState: MinibobHandoffStateRecord = {
    ...existingHandoff,
    status: 'consumed',
    consumedAt: new Date().toISOString(),
    consumedByUserId: userId,
    consumedAccountId: accountId,
    resultPublicId: materialized.publicId,
  };
  await kvPutJson(kv, handoffStateKey, completedState, MINIBOB_HANDOFF_STATE_TTL_SEC).catch(() => undefined);

  const payload = {
    handoffId,
    accountId,
    sourcePublicId: existingHandoff.sourcePublicId,
    publicId: materialized.publicId,
    builderRoute: resolveMinibobHandoffRoute(materialized.publicId, accountId),
    replay: false,
  };
  await storeIdempotencyRecord(kv, replayKey, 200, payload).catch(() => undefined);
  return json(payload, { status: 200 });
}
