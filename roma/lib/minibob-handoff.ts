import { isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';
import { verifyRomaAccountAuthzCapsule, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createAccountInstance } from './account-instance-create';

type RomaKv = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
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

export type MinibobHandoffError = {
  kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'INTERNAL';
  reasonKey: string;
  detail?: string;
};

export type MinibobHandoffResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: MinibobHandoffError };

const MINIBOB_HANDOFF_STATE_TTL_SEC = 60 * 60 * 24 * 7;
const MINIBOB_HANDOFF_MAX_CONFIG_BYTES = 7000;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function resolveRomaAuthzCapsuleSecret(): string {
  return String(process.env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
}

function requireUsageKv(): MinibobHandoffResult<RomaKv> {
  try {
    const env = getRequestContext().env as { USAGE_KV?: RomaKv };
    if (env.USAGE_KV) {
      return { ok: true, value: env.USAGE_KV };
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.minibobHandoff.unavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
  return {
    ok: false,
    status: 503,
    error: {
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'coreui.errors.minibobHandoff.unavailable',
      detail: 'usage_kv_missing',
    },
  };
}

async function kvGetJson<T>(kv: RomaKv, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvPutJson(kv: RomaKv, key: string, value: object, expirationTtl: number): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl });
}

function resolveMinibobHandoffStateKey(handoffId: string): string {
  return `roma:minibob:handoff:state:${handoffId}`;
}

function resolveMinibobHandoffReplayKey(args: { userId: string; handoffId: string }): string {
  return `roma:minibob:handoff:complete:${args.userId}:${args.handoffId}`;
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

function resolveStage(): string {
  return String(process.env.ENV_STAGE || process.env.CF_PAGES_BRANCH || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
}

function isLocalStage(): boolean {
  const stage = resolveStage();
  if (!stage) return true;
  return stage === 'local' || stage === 'development' || stage === 'dev';
}

async function verifyAccountCapsule(args: {
  accountCapsule: string;
  accountId: string;
}): Promise<MinibobHandoffResult<RomaAccountAuthzCapsulePayload>> {
  const secret = resolveRomaAuthzCapsuleSecret();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: {
        kind: 'INTERNAL',
        reasonKey: 'coreui.errors.misconfigured',
        detail: 'roma_authz_capsule_secret_missing',
      },
    };
  }

  const verified = await verifyRomaAccountAuthzCapsule(secret, args.accountCapsule);
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: verified.reason,
      },
    };
  }
  if (verified.payload.accountId !== args.accountId) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'account_mismatch',
      },
    };
  }
  return { ok: true, value: verified.payload };
}

export async function startMinibobHandoff(args: {
  sourcePublicId: string;
  widgetType?: string | null;
  draftConfig?: Record<string, unknown> | null;
}): Promise<
  MinibobHandoffResult<{
    handoffId: string;
    sourcePublicId: string;
    widgetType: string;
    expiresAt: string;
  }>
> {
  const kvResult = requireUsageKv();
  if (!kvResult.ok) return kvResult;
  const kv = kvResult.value;

  const sourcePublicId = asTrimmedString(args.sourcePublicId);
  if (!sourcePublicId || !isCuratedOrMainWidgetPublicId(sourcePublicId)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'minibob_source_public_id_invalid',
      },
    };
  }

  const widgetType = asTrimmedString(args.widgetType);
  if (!widgetType || !args.draftConfig || !isRecord(args.draftConfig)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'minibob_handoff_snapshot_required',
      },
    };
  }

  const serializedConfig = JSON.stringify(args.draftConfig);
  if (serializedConfig.length > MINIBOB_HANDOFF_MAX_CONFIG_BYTES) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'draft_too_large',
      },
    };
  }

  const handoffId = `mbh_${crypto.randomUUID().replace(/-/g, '')}`;
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + MINIBOB_HANDOFF_STATE_TTL_SEC * 1000).toISOString();

  const record: MinibobHandoffStateRecord = {
    v: 1,
    handoffId,
    sourcePublicId,
    widgetType,
    config: JSON.parse(serializedConfig) as Record<string, unknown>,
    status: 'pending',
    createdAt,
    expiresAt,
  };

  await kvPutJson(kv, resolveMinibobHandoffStateKey(handoffId), record, MINIBOB_HANDOFF_STATE_TTL_SEC);
  return {
    ok: true,
    value: {
      handoffId,
      sourcePublicId,
      widgetType,
      expiresAt,
    },
  };
}

export async function completeMinibobHandoff(args: {
  accessToken: string;
  accountId: string;
  handoffId: string;
  accountCapsule: string | null;
}): Promise<
  MinibobHandoffResult<{
    handoffId: string;
    accountId: string;
    sourcePublicId: string;
    publicId: string;
    builderRoute: string;
    replay: boolean;
  }>
> {
  if (!args.accountCapsule) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.contextUnavailable',
      },
    };
  }
  if (!isUuid(args.accountId)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.accountId.invalid',
      },
    };
  }
  const handoffId = asTrimmedString(args.handoffId);
  if (!handoffId || !/^mbh_[a-z0-9]{16,64}$/.test(handoffId)) {
    return {
      ok: false,
      status: 422,
      error: {
        kind: 'VALIDATION',
        reasonKey: 'coreui.errors.minibobHandoff.idInvalid',
      },
    };
  }

  const kvResult = requireUsageKv();
  if (!kvResult.ok) return kvResult;
  const kv = kvResult.value;

  const authz = await verifyAccountCapsule({
    accountCapsule: args.accountCapsule,
    accountId: args.accountId,
  });
  if (!authz.ok) return authz;
  if (!isLocalStage() && authz.value.accountIsPlatform !== true) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.minibobHandoff.unavailable',
        detail: 'minibob_handoff_platform_account_only',
      },
    };
  }

  const replayKey = resolveMinibobHandoffReplayKey({
    userId: authz.value.userId,
    handoffId,
  });
  const replay = await kvGetJson<{
    handoffId: string;
    accountId: string;
    sourcePublicId: string;
    publicId: string;
    builderRoute: string;
    replay: boolean;
  }>(kv, replayKey);
  if (replay) {
    return { ok: true, value: { ...replay, replay: true } };
  }

  const handoffStateKey = resolveMinibobHandoffStateKey(handoffId);
  const existingHandoff = await kvGetJson<MinibobHandoffStateRecord>(kv, handoffStateKey);
  if (!existingHandoff || existingHandoff.v !== 1 || existingHandoff.handoffId !== handoffId) {
    return {
      ok: false,
      status: 404,
      error: {
        kind: 'NOT_FOUND',
        reasonKey: 'coreui.errors.minibobHandoff.notFound',
      },
    };
  }

  const expiresAtMs = Date.parse(existingHandoff.expiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    return {
      ok: false,
      status: 410,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.minibobHandoff.expired',
      },
    };
  }

  if (existingHandoff.status === 'consumed') {
    const sameTarget =
      existingHandoff.consumedByUserId === authz.value.userId &&
      existingHandoff.consumedAccountId === args.accountId &&
      typeof existingHandoff.resultPublicId === 'string' &&
      existingHandoff.resultPublicId.length > 0;
    if (!sameTarget) {
      return {
        ok: false,
        status: 409,
        error: {
          kind: 'DENY',
          reasonKey: 'coreui.errors.minibobHandoff.alreadyConsumed',
        },
      };
    }
    const resultPublicId = existingHandoff.resultPublicId as string;
    return {
      ok: true,
      value: {
        handoffId,
        accountId: args.accountId,
        sourcePublicId: existingHandoff.sourcePublicId,
        publicId: resultPublicId,
        builderRoute: resolveMinibobHandoffRoute(resultPublicId, args.accountId),
        replay: true,
      },
    };
  }

  const publicId = createUserInstancePublicIdFromHandoff(existingHandoff.widgetType, handoffId);
  const created = await createAccountInstance({
    accountId: args.accountId,
    publicId,
    widgetType: existingHandoff.widgetType,
    config: existingHandoff.config,
    accessToken: args.accessToken,
    accountCapsule: args.accountCapsule,
    authz: authz.value,
  });
  if (!created.ok) {
    return {
      ok: false,
      status: created.status,
      error: created.error,
    };
  }

  const completedState: MinibobHandoffStateRecord = {
    ...existingHandoff,
    status: 'consumed',
    consumedAt: new Date().toISOString(),
    consumedByUserId: authz.value.userId,
    consumedAccountId: args.accountId,
    resultPublicId: created.value.publicId,
  };
  await kvPutJson(kv, handoffStateKey, completedState, MINIBOB_HANDOFF_STATE_TTL_SEC).catch(() => undefined);

  const payload = {
    handoffId,
    accountId: args.accountId,
    sourcePublicId: existingHandoff.sourcePublicId,
    publicId: created.value.publicId,
    builderRoute: resolveMinibobHandoffRoute(created.value.publicId, args.accountId),
    replay: false,
  };
  await kvPutJson(kv, replayKey, payload, MINIBOB_HANDOFF_STATE_TTL_SEC).catch(() => undefined);
  return { ok: true, value: payload };
}
