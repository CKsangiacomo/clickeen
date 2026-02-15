import {
  resolveAiAgent,
  resolveAiPolicyCapsule,
  resolvePolicy,
  resolveWidgetCopilotRequestedAgentId,
} from '@clickeen/ck-policy';
import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from '../../shared/types';
import { assertDevAuth, assertSupabaseAuth } from '../../shared/auth';
import { ckError } from '../../shared/errors';
import { json, readJson } from '../../shared/http';
import { supabaseFetch } from '../../shared/supabase';
import { asTrimmedString, assertConfig, isUuid } from '../../shared/validation';
import { requireWorkspace } from '../../shared/workspaces';
import {
  assertPublicId,
  assertWidgetType,
  inferInstanceKindFromPublicId,
} from '../../shared/instances';
import {
  loadInstanceByPublicId,
  loadWidgetByType,
} from '../instances';

type AccountRow = {
  id: string;
  status: string;
  is_platform: boolean;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceMemberListRow = {
  user_id: string;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type AccountWorkspaceRow = {
  id: string;
  account_id: string;
  tier: WorkspaceRow['tier'];
  name: string;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type InstanceListRow = {
  public_id: string;
  status: 'published' | 'unpublished';
  workspace_id: string;
};

type AccountAssetRow = {
  asset_id: string;
  size_bytes: number;
  deleted_at?: string | null;
};

type IdempotencyRecord = {
  v: 1;
  status: number;
  body: unknown;
  createdAt: string;
};

type BootstrapOwnerRecord = {
  v: 1;
  userId: string;
  createdAt: string;
};

type ClaimNonceRecord = {
  v: 1;
  nonce: string;
  userId: string;
  accountId: string;
  workspaceId: string;
  sourcePublicId: string;
  builderPublicId: string;
  mode: 'rebound' | 'materialized';
  claimedAt: string;
};

type MinibobClaimTokenPayload = {
  nonce: string;
  publicId: string;
  iat: number;
  exp?: number;
  widgetType?: string;
  draftConfig?: Record<string, unknown>;
};

type AccountAuthzResult =
  | {
      ok: true;
      auth: { source: 'dev' | 'supabase'; principal?: { userId: string } };
      account: AccountRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

type WorkspaceAuthzResult =
  | {
      ok: true;
      auth: { source: 'dev' | 'supabase'; principal?: { userId: string } };
      workspace: WorkspaceRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

const CONTROLPLANE_IDEMPOTENCY_TTL_SEC = 60 * 60 * 24;
const CONTROLPLANE_BOOTSTRAP_TTL_SEC = 60 * 60 * 24 * 7;
const CLAIM_NONCE_TTL_SEC = 60 * 60 * 24 * 7;
const CLAIM_TOKEN_MAX_AGE_SEC = 60 * 60 * 24;
const CLAIM_TOKEN_FUTURE_SKEW_SEC = 5 * 60;

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeUtf8(value: string): string | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  return base64UrlEncodeBytes(await hmacSha256(secret, message));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireControlplaneKv(env: Env): { ok: true; kv: KVNamespace } | { ok: false; response: Response } {
  if (!env.USAGE_KV) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.idempotency.unavailable' }, 503),
    };
  }
  return { ok: true, kv: env.USAGE_KV };
}

async function kvGetJson<T extends object>(kv: KVNamespace, key: string): Promise<T | null> {
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
  if (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9_.:-]+$/.test(key)) {
    return {
      ok: false,
      response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.idempotencyKey.invalid' }, 422),
    };
  }
  return { ok: true, value: key };
}

function parseBodyAsRecord(value: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; response: Response } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

function sanitizeWorkspaceName(value: unknown): { ok: true; value: string } | { ok: false; response: Response } {
  const name = asTrimmedString(value);
  if (!name) return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.name.required' }, 422) };
  if (name.length < 2 || name.length > 80) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.name.invalid' }, 422) };
  }
  return { ok: true, value: name };
}

function slugifyWorkspaceName(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'workspace';
}

function sanitizeWorkspaceSlug(raw: unknown, fallbackName: string): { ok: true; value: string } | { ok: false; response: Response } {
  const fromInput = asTrimmedString(raw);
  const candidate = fromInput ? slugifyWorkspaceName(fromInput) : slugifyWorkspaceName(fallbackName);
  if (!candidate || candidate.length > 64 || !/^[a-z0-9][a-z0-9_-]*$/.test(candidate)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspace.slug.invalid' }, 422) };
  }
  return { ok: true, value: candidate };
}

function resolveClaimSecret(env: Env): string | null {
  const claimSecret = asTrimmedString((env as Env & { MINIBOB_CLAIM_HMAC_SECRET?: string }).MINIBOB_CLAIM_HMAC_SECRET);
  if (claimSecret) return claimSecret;
  return asTrimmedString(env.AI_GRANT_HMAC_SECRET);
}

async function verifyMinibobClaimToken(
  token: string,
  env: Env,
): Promise<{ ok: true; payload: MinibobClaimTokenPayload } | { ok: false; response: Response }> {
  const secret = resolveClaimSecret(env);
  if (!secret) {
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.claim.secretMissing' }, 503),
    };
  }

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'mbc' || parts[1] !== 'v1') {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }
  const payloadB64 = parts[2] || '';
  const signature = parts[3] || '';
  if (!payloadB64 || !signature) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }

  const expected = await hmacSha256Base64Url(secret, `mbc.v1.${payloadB64}`);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }

  const payloadText = base64UrlDecodeUtf8(payloadB64);
  if (!payloadText) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }
  const body = parseBodyAsRecord(parsed);
  if (!body.ok) return body;

  const nonce = asTrimmedString(body.value.nonce);
  const publicIdRaw = asTrimmedString(body.value.publicId);
  const iatRaw = body.value.iat;
  const expRaw = body.value.exp;

  const iat =
    typeof iatRaw === 'number'
      ? iatRaw
      : typeof iatRaw === 'string'
        ? Number.parseInt(iatRaw, 10)
        : Number.NaN;
  const exp =
    expRaw === undefined
      ? undefined
      : typeof expRaw === 'number'
        ? expRaw
        : typeof expRaw === 'string'
          ? Number.parseInt(expRaw, 10)
          : Number.NaN;
  if (!nonce || nonce.length < 8 || !Number.isFinite(iat) || iat <= 0 || !publicIdRaw) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }
  if (exp !== undefined && (!Number.isFinite(exp) || exp <= 0)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }

  const publicIdResult = assertPublicId(publicIdRaw);
  if (!publicIdResult.ok) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (iat > nowSec + CLAIM_TOKEN_FUTURE_SKEW_SEC) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
  }
  if (nowSec - iat > CLAIM_TOKEN_MAX_AGE_SEC) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenExpired' }, 403) };
  }
  if (exp !== undefined && exp < nowSec) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenExpired' }, 403) };
  }

  const widgetTypeRaw = body.value.widgetType;
  let widgetType: string | undefined;
  if (widgetTypeRaw !== undefined) {
    const validated = assertWidgetType(widgetTypeRaw);
    if (!validated.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
    }
    widgetType = validated.value;
  }

  let draftConfig: Record<string, unknown> | undefined;
  if (body.value.draftConfig !== undefined) {
    const configResult = assertConfig(body.value.draftConfig);
    if (!configResult.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenInvalid' }, 403) };
    }
    draftConfig = configResult.value;
  }

  return {
    ok: true,
    payload: {
      nonce,
      publicId: publicIdResult.value,
      iat: Math.floor(iat),
      exp: exp === undefined ? undefined : Math.floor(exp),
      widgetType,
      draftConfig,
    },
  };
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

function normalizeRole(value: unknown): MemberRole | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'owner' || raw === 'admin' || raw === 'editor' || raw === 'viewer') {
    return raw;
  }
  return null;
}

function deriveHighestRole(roles: MemberRole[]): MemberRole | null {
  if (roles.length === 0) return null;
  let best: MemberRole = roles[0];
  for (const role of roles) {
    if (roleRank(role) > roleRank(best)) best = role;
  }
  return best;
}

function assertAccountId(value: string): { ok: true; value: string } | { ok: false; response: Response } {
  const accountId = String(value || '').trim();
  if (!accountId || !isUuid(accountId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422) };
  }
  return { ok: true, value: accountId };
}

function assertWorkspaceId(value: string): { ok: true; value: string } | { ok: false; response: Response } {
  const workspaceId = String(value || '').trim();
  if (!workspaceId || !isUuid(workspaceId)) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.workspaceId.invalid' }, 422) };
  }
  return { ok: true, value: workspaceId };
}

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

async function resolveWorkspaceMembershipRole(env: Env, workspaceId: string, userId: string): Promise<MemberRole | null> {
  const params = new URLSearchParams({
    select: 'workspace_id,role',
    user_id: `eq.${userId}`,
    workspace_id: `eq.${workspaceId}`,
    limit: '1',
  });
  const res = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const details = await readJson(res);
    throw new Error(`[ParisWorker] Failed to resolve workspace membership (${res.status}): ${JSON.stringify(details)}`);
  }
  const memberships = (await res.json()) as WorkspaceMembershipRow[];
  return normalizeRole(memberships[0]?.role ?? null);
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
  if (!auth.ok) return auth;

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

  if (auth.source === 'dev') {
    const actorAccountId = (req.headers.get('x-account-id') || '').trim();
    if (!actorAccountId) {
      return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.accountId.required' }, 401) };
    }
    if (!isUuid(actorAccountId)) {
      return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' }, 422) };
    }
    if (actorAccountId !== accountId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.account.mismatch' }, 403) };
    }
    return { ok: true, auth, account, role: 'owner' };
  }

  const userId = auth.principal?.userId ?? '';
  if (!userId) {
    return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
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

async function authorizeWorkspace(
  req: Request,
  env: Env,
  workspaceId: string,
  minRole: MemberRole,
): Promise<WorkspaceAuthzResult> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return auth;

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) {
    return { ok: false, response: workspaceResult.response };
  }
  const workspace = workspaceResult.workspace;

  if (auth.source === 'dev') {
    return { ok: true, auth, workspace, role: 'owner' };
  }

  const userId = auth.principal?.userId ?? '';
  if (!userId) {
    return { ok: false, response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401) };
  }

  let role: MemberRole | null = null;
  try {
    role = await resolveWorkspaceMembershipRole(env, workspaceId, userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500) };
  }

  if (!role || roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, auth, workspace, role };
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
  ttlSec = CONTROLPLANE_IDEMPOTENCY_TTL_SEC,
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
  const key = `cp:bootstrap:account-owner:${accountId}`;
  const payload: BootstrapOwnerRecord = {
    v: 1,
    userId,
    createdAt: new Date().toISOString(),
  };
  await kvPutJson(kv, key, payload, CONTROLPLANE_BOOTSTRAP_TTL_SEC);
}

async function hasBootstrapOwnerAccess(kv: KVNamespace, accountId: string, userId: string): Promise<boolean> {
  const key = `cp:bootstrap:account-owner:${accountId}`;
  const payload = await kvGetJson<BootstrapOwnerRecord>(kv, key);
  if (!payload || payload.v !== 1) return false;
  return payload.userId === userId;
}

async function clearBootstrapOwner(kv: KVNamespace, accountId: string): Promise<void> {
  await kv.delete(`cp:bootstrap:account-owner:${accountId}`);
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

function resolveClaimRoute(publicId: string, workspaceId: string, accountId: string): string {
  const search = new URLSearchParams({
    workspaceId,
    accountId,
    publicId,
    subject: 'workspace',
  });
  return `/builder/${encodeURIComponent(publicId)}?${search.toString()}`;
}

async function materializeClaimTargetInstance(args: {
  env: Env;
  workspaceId: string;
  sourcePublicId: string;
  widgetTypeHint?: string;
  draftConfig?: Record<string, unknown>;
}): Promise<
  | { ok: true; publicId: string; mode: 'rebound' | 'materialized' }
  | { ok: false; response: Response }
> {
  const sourcePublicIdResult = assertPublicId(args.sourcePublicId);
  if (!sourcePublicIdResult.ok) {
    return { ok: false, response: sourcePublicIdResult.response };
  }
  const sourcePublicId = sourcePublicIdResult.value;
  const sourceKind = inferInstanceKindFromPublicId(sourcePublicId);

  const sourceInstance = await loadInstanceByPublicId(args.env, sourcePublicId).catch(() => null);
  if (!sourceInstance && !args.draftConfig) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404) };
  }

  if (sourceKind === 'user') {
    if (!sourceInstance) {
      return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404) };
    }
    const patchRes = await supabaseFetch(args.env, `/rest/v1/widget_instances?public_id=eq.${sourcePublicId}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ workspace_id: args.workspaceId }),
    });
    if (!patchRes.ok) {
      const details = await readJson(patchRes);
      return {
        ok: false,
        response: ckError(
          { kind: 'INTERNAL', reasonKey: 'coreui.errors.db.writeFailed', detail: JSON.stringify(details) },
          500,
        ),
      };
    }
    const patchedRows = ((await patchRes.json().catch(() => [])) as Array<{ public_id?: string }>) ?? [];
    if (patchedRows.length === 0) {
      return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' }, 404) };
    }
    return { ok: true, publicId: sourcePublicId, mode: 'rebound' };
  }

  const resolvedWidgetType =
    args.widgetTypeHint ||
    (sourceInstance && 'widget_type' in sourceInstance ? asTrimmedString(sourceInstance.widget_type) : null);
  const widgetTypeResult = assertWidgetType(resolvedWidgetType);
  if (!widgetTypeResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.widgetType.invalid' }, 422) };
  }
  const widgetType = widgetTypeResult.value;
  const widget = await loadWidgetByType(args.env, widgetType).catch(() => null);
  if (!widget?.id) {
    return { ok: false, response: ckError({ kind: 'NOT_FOUND', reasonKey: 'coreui.errors.widget.notFound' }, 404) };
  }

  const configCandidate =
    args.draftConfig ??
    (sourceInstance && 'config' in sourceInstance ? (sourceInstance.config as Record<string, unknown>) : null);
  const configResult = assertConfig(configCandidate);
  if (!configResult.ok) {
    return { ok: false, response: ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422) };
  }

  const nonceBase = crypto.randomUUID().replace(/[^a-z0-9]+/gi, '').toLowerCase().slice(0, 16) || 'claim';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = attempt === 0 ? nonceBase : `${nonceBase}${attempt + 1}`;
    const publicId = `wgt_${widgetType}_u_${suffix}`;
    const insertRes = await supabaseFetch(args.env, '/rest/v1/widget_instances', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        widget_id: widget.id,
        public_id: publicId,
        status: 'unpublished',
        config: configResult.value,
        workspace_id: args.workspaceId,
        kind: 'user',
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
    return { ok: true, publicId, mode: 'materialized' };
  }

  return {
    ok: false,
    response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.instance.createFailed' }, 500),
  };
}

export async function handleAccountCreate(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireControlplaneKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `cp:idem:accounts:create:${auth.principal.userId}:${idempotencyKey}`;
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
    isPlatform: false,
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

  const kvResult = requireControlplaneKv(env);
  if (!kvResult.ok) return kvResult.response;
  const kv = kvResult.kv;

  const replayKey = `cp:idem:accounts:${accountId}:workspaces:create:${userId}:${idempotencyKey}`;
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
  if (!membershipRole || roleRank(membershipRole) < roleRank('admin')) {
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

export async function handleMinibobClaimComplete(req: Request, env: Env): Promise<Response> {
  const auth = await assertSupabaseAuth(req, env);
  if (!auth.ok) return auth.response;
  const userId = auth.principal.userId;

  const idempotencyResult = requireIdempotencyKey(req);
  if (!idempotencyResult.ok) return idempotencyResult.response;
  const idempotencyKey = idempotencyResult.value;

  const kvResult = requireControlplaneKv(env);
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

  const claimToken = asTrimmedString(bodyResult.value.claimToken);
  if (!claimToken) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.claim.tokenRequired' }, 422);
  }

  const verified = await verifyMinibobClaimToken(claimToken, env);
  if (!verified.ok) return verified.response;
  const claim = verified.payload;

  const replayKey = `cp:idem:claims:minibob:${userId}:${idempotencyKey}`;
  const idemExisting = await loadIdempotencyRecord(kv, replayKey);
  if (idemExisting) return replayFromIdempotency(idemExisting);

  const workspaceRole = await resolveWorkspaceMembershipRole(env, workspaceIdResult.value, userId).catch(() => null);
  if (!workspaceRole) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403);
  }

  const workspaceResult = await requireWorkspace(env, workspaceIdResult.value);
  if (!workspaceResult.ok) return workspaceResult.response;
  if (workspaceResult.workspace.account_id !== accountIdResult.value) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.account.mismatch' }, 403);
  }

  const nonceKey = `cp:claims:minibob:nonce:${claim.nonce}`;
  const existingNonce = await kvGetJson<ClaimNonceRecord>(kv, nonceKey);
  if (existingNonce && existingNonce.v === 1) {
    const sameTarget =
      existingNonce.userId === userId &&
      existingNonce.accountId === accountIdResult.value &&
      existingNonce.workspaceId === workspaceIdResult.value &&
      existingNonce.sourcePublicId === claim.publicId;
    if (!sameTarget) {
      return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.claim.tokenReplay' }, 409);
    }
    const replayPayload = {
      accountId: existingNonce.accountId,
      workspaceId: existingNonce.workspaceId,
      sourcePublicId: existingNonce.sourcePublicId,
      publicId: existingNonce.builderPublicId,
      mode: existingNonce.mode,
      builderRoute: resolveClaimRoute(
        existingNonce.builderPublicId,
        existingNonce.workspaceId,
        existingNonce.accountId,
      ),
      replay: true,
    };
    await storeIdempotencyRecord(kv, replayKey, 200, replayPayload).catch(() => undefined);
    return json(replayPayload, { status: 200 });
  }

  const materialized = await materializeClaimTargetInstance({
    env,
    workspaceId: workspaceIdResult.value,
    sourcePublicId: claim.publicId,
    widgetTypeHint: claim.widgetType,
    draftConfig: claim.draftConfig,
  });
  if (!materialized.ok) return materialized.response;

  const nonceRecord: ClaimNonceRecord = {
    v: 1,
    nonce: claim.nonce,
    userId,
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    sourcePublicId: claim.publicId,
    builderPublicId: materialized.publicId,
    mode: materialized.mode,
    claimedAt: new Date().toISOString(),
  };
  await kvPutJson(kv, nonceKey, nonceRecord, CLAIM_NONCE_TTL_SEC).catch(() => undefined);

  const payload = {
    accountId: accountIdResult.value,
    workspaceId: workspaceIdResult.value,
    sourcePublicId: claim.publicId,
    publicId: materialized.publicId,
    mode: materialized.mode,
    builderRoute: resolveClaimRoute(materialized.publicId, workspaceIdResult.value, accountIdResult.value),
    replay: false,
  };
  await storeIdempotencyRecord(kv, replayKey, 200, payload).catch(() => undefined);
  return json(payload, { status: 200 });
}

export async function handleWorkspaceGet(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'viewer');
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

export async function handleWorkspaceMembers(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const workspaceId = workspaceIdResult.value;

  const authorized = await authorizeWorkspace(req, env, workspaceId, 'viewer');
  if (!authorized.ok) return authorized.response;

  const params = new URLSearchParams({
    select: 'user_id,role,created_at,updated_at',
    workspace_id: `eq.${workspaceId}`,
    order: 'created_at.asc',
    limit: '500',
  });
  const membersRes = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, { method: 'GET' });
  if (!membersRes.ok) {
    const details = await readJson(membersRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const rows = ((await membersRes.json()) as WorkspaceMemberListRow[]) ?? [];

  return json({
    workspaceId,
    role: authorized.role,
    members: rows.map((row) => ({
      userId: row.user_id,
      role: normalizeRole(row.role) ?? row.role,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })),
  });
}

export async function handleWorkspacePolicy(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  return json({
    workspaceId: authorized.workspace.id,
    accountId: authorized.workspace.account_id,
    profile: authorized.workspace.tier,
    role: authorized.role,
    policy,
  });
}

export async function handleWorkspaceEntitlements(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  return json({
    workspaceId: authorized.workspace.id,
    profile: policy.profile,
    role: policy.role,
    entitlements: {
      flags: policy.flags,
      caps: policy.caps,
      budgets: policy.budgets,
    },
  });
}

export async function handleWorkspaceAiProfile(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const requestedId = 'widget.copilot.v1';
  const canonicalId = resolveWidgetCopilotRequestedAgentId({
    requestedAgentId: requestedId,
    policyProfile: authorized.workspace.tier,
  });
  const resolved = canonicalId ? resolveAiAgent(canonicalId) : null;
  if (!resolved) {
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.ai.profileUnavailable' }, 500);
  }

  const capsule = resolveAiPolicyCapsule({
    entry: resolved.entry,
    policyProfile: authorized.workspace.tier,
    isCurated: false,
  });

  return json({
    workspaceId: authorized.workspace.id,
    profile: authorized.workspace.tier,
    role: authorized.role,
    widgetCopilot: {
      requestedAgentId: requestedId,
      canonicalAgentId: resolved.canonicalId,
      profile: capsule.profile,
      provider: capsule.provider,
      model: capsule.model,
      strict: capsule.strict,
      reasonKey: capsule.reasonKey ?? null,
      upsell: capsule.upsell ?? null,
    },
  });
}

export async function handleWorkspaceAiLimits(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'viewer');
  if (!authorized.ok) return authorized.response;

  const policy = resolvePolicy({ profile: authorized.workspace.tier, role: authorized.role });
  const caps = Object.fromEntries(
    Object.entries(policy.caps).filter(([key]) => key.startsWith('ai.') || key.includes('copilot')),
  );
  const budgets = Object.fromEntries(
    Object.entries(policy.budgets).filter(([key]) => key.startsWith('budget.ai') || key.startsWith('budget.copilot')),
  );

  return json({
    workspaceId: authorized.workspace.id,
    profile: policy.profile,
    role: policy.role,
    caps,
    budgets,
  });
}

export async function handleWorkspaceAiOutcomes(req: Request, env: Env, workspaceIdRaw: string): Promise<Response> {
  const workspaceIdResult = assertWorkspaceId(workspaceIdRaw);
  if (!workspaceIdResult.ok) return workspaceIdResult.response;
  const authorized = await authorizeWorkspace(req, env, workspaceIdResult.value, 'admin');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.ai.outcomes.unavailable',
      detail: 'San Francisco outcomes read contract is not wired in this repo snapshot.',
    },
    501,
  );
}

export async function handleAccountGet(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaceCount = 0;
  try {
    const workspaces = await loadAccountWorkspaces(env, accountId);
    workspaceCount = workspaces.length;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  return json({
    accountId,
    status: authorized.account.status,
    isPlatform: authorized.account.is_platform,
    role: accountRoleLabel(authorized.role),
    workspaceCount,
  });
}

export async function handleAccountWorkspaces(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    workspaces: workspaces.map((workspace) => ({
      workspaceId: workspace.id,
      accountId: workspace.account_id,
      tier: workspace.tier,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.created_at ?? null,
      updatedAt: workspace.updated_at ?? null,
    })),
  });
}

export async function handleAccountUsage(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'viewer');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const workspaceIds = workspaces.map((workspace) => workspace.id).filter(Boolean);

  let instances: InstanceListRow[] = [];
  if (workspaceIds.length > 0) {
    const instanceParams = new URLSearchParams({
      select: 'public_id,status,workspace_id',
      workspace_id: `in.(${workspaceIds.join(',')})`,
      limit: '5000',
    });
    const instanceRes = await supabaseFetch(env, `/rest/v1/widget_instances?${instanceParams.toString()}`, { method: 'GET' });
    if (!instanceRes.ok) {
      const details = await readJson(instanceRes);
      return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
    }
    instances = ((await instanceRes.json()) as InstanceListRow[]) ?? [];
  }

  const assetParams = new URLSearchParams({
    select: 'asset_id,size_bytes,deleted_at',
    account_id: `eq.${accountId}`,
    limit: '5000',
  });
  const assetRes = await supabaseFetch(env, `/rest/v1/account_assets?${assetParams.toString()}`, { method: 'GET' });
  if (!assetRes.ok) {
    const details = await readJson(assetRes);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail: JSON.stringify(details) }, 500);
  }
  const assets = ((await assetRes.json()) as AccountAssetRow[]) ?? [];

  const activeAssets = assets.filter((asset) => !asset.deleted_at);
  const assetBytes = activeAssets.reduce((sum, asset) => {
    const size = Number.isFinite(asset.size_bytes) ? asset.size_bytes : 0;
    return sum + Math.max(0, size);
  }, 0);

  const publishedInstances = instances.filter((instance) => instance.status === 'published').length;

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    usage: {
      workspaces: workspaces.length,
      instances: {
        total: instances.length,
        published: publishedInstances,
        unpublished: Math.max(0, instances.length - publishedInstances),
      },
      assets: {
        total: assets.length,
        active: activeAssets.length,
        bytesActive: assetBytes,
      },
    },
  });
}

export async function handleAccountBillingSummary(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
  if (!authorized.ok) return authorized.response;

  let workspaces: AccountWorkspaceRow[] = [];
  try {
    workspaces = await loadAccountWorkspaces(env, accountId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500);
  }

  const inferredTier = inferHighestTier(workspaces);

  return json({
    accountId,
    role: accountRoleLabel(authorized.role),
    provider: 'stripe',
    status: 'not_configured',
    reasonKey: 'coreui.errors.billing.notConfigured',
    plan: {
      inferredTier,
      workspaceCount: workspaces.length,
    },
    checkoutAvailable: false,
    portalAvailable: false,
  });
}

export async function handleAccountBillingCheckoutSession(
  req: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.billing.notConfigured',
      detail: 'Checkout session contract is not wired yet in this repo snapshot.',
    },
    503,
  );
}

export async function handleAccountBillingPortalSession(req: Request, env: Env, accountIdRaw: string): Promise<Response> {
  const accountIdResult = assertAccountId(accountIdRaw);
  if (!accountIdResult.ok) return accountIdResult.response;
  const accountId = accountIdResult.value;

  const authorized = await authorizeAccount(req, env, accountId, 'admin');
  if (!authorized.ok) return authorized.response;

  return ckError(
    {
      kind: 'INTERNAL',
      reasonKey: 'coreui.errors.billing.notConfigured',
      detail: 'Portal session contract is not wired yet in this repo snapshot.',
    },
    503,
  );
}
