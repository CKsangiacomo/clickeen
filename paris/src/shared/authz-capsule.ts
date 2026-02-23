import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from './types';

export const ROMA_AUTHZ_CAPSULE_HEADER = 'x-ck-authz-capsule';
export const ROMA_ACCOUNT_CAPSULE_HEADER = 'x-ck-account-capsule';

const ROMA_AUTHZ_CAPSULE_PREFIX = 'ckac.v1';
const ROMA_ACCOUNT_CAPSULE_PREFIX = 'ckacc.v1';
const ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC = 60;

export type RomaWorkspaceAuthzCapsulePayload = {
  v: 1;
  typ: 'roma.workspace';
  iss: 'paris';
  aud: 'roma';
  sub: string;
  userId: string;
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceWebsiteUrl: string | null;
  workspaceTier: WorkspaceRow['tier'];
  role: MemberRole;
  authzVersion: string;
  iat: number;
  exp: number;
};

type SignableRomaWorkspaceAuthzCapsulePayload = Omit<RomaWorkspaceAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>;

export type RomaAccountAuthzCapsulePayload = {
  v: 1;
  typ: 'roma.account';
  iss: 'paris';
  aud: 'roma';
  sub: string;
  userId: string;
  accountId: string;
  accountStatus: string;
  profile: WorkspaceRow['tier'];
  role: MemberRole;
  authzVersion: string;
  iat: number;
  exp: number;
};

type SignableRomaAccountAuthzCapsulePayload = Omit<RomaAccountAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>;

function resolveRomaAuthzCapsuleSecret(env: Env): string {
  const explicit = (env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
  if (explicit) return explicit;
  const aiFallback = (env.AI_GRANT_HMAC_SECRET || '').trim();
  if (aiFallback) return aiFallback;
  return (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] || 0);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function encodeJsonToBase64Url(value: object): string {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  return toBase64Url(encoded);
}

function decodeJsonFromBase64Url<T>(value: string): T | null {
  const bytes = fromBase64Url(value);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed as T;
  } catch {
    return null;
  }
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function normalizeWorkspaceTier(value: unknown): WorkspaceRow['tier'] | null {
  switch (value) {
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

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

function normalizePayload(
  raw: unknown,
  nowSec: number,
): RomaWorkspaceAuthzCapsulePayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (record.typ !== 'roma.workspace') return null;
  if (record.iss !== 'paris') return null;
  if (record.aud !== 'roma') return null;

  const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
  const sub = typeof record.sub === 'string' ? record.sub.trim() : '';
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  const workspaceId = typeof record.workspaceId === 'string' ? record.workspaceId.trim() : '';
  const workspaceName = typeof record.workspaceName === 'string' ? record.workspaceName.trim() : '';
  const workspaceSlug = typeof record.workspaceSlug === 'string' ? record.workspaceSlug.trim() : '';
  const workspaceWebsiteUrlRaw = typeof record.workspaceWebsiteUrl === 'string' ? record.workspaceWebsiteUrl.trim() : '';
  const authzVersion = typeof record.authzVersion === 'string' ? record.authzVersion.trim() : '';
  const role = normalizeMemberRole(record.role);
  const workspaceTier = normalizeWorkspaceTier(record.workspaceTier);
  const iat = typeof record.iat === 'number' && Number.isFinite(record.iat) ? Math.trunc(record.iat) : Number.NaN;
  const exp = typeof record.exp === 'number' && Number.isFinite(record.exp) ? Math.trunc(record.exp) : Number.NaN;

  if (!userId || !sub || sub !== userId) return null;
  if (!accountId || !workspaceId || !workspaceName || !workspaceSlug || !authzVersion) return null;
  if (!role || !workspaceTier) return null;
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= nowSec) return null;
  if (iat > nowSec + ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC) return null;

  return {
    v: 1,
    typ: 'roma.workspace',
    iss: 'paris',
    aud: 'roma',
    sub,
    userId,
    accountId,
    workspaceId,
    workspaceName,
    workspaceSlug,
    workspaceWebsiteUrl: workspaceWebsiteUrlRaw || null,
    workspaceTier,
    role,
    authzVersion,
    iat,
    exp,
  };
}

export function readRomaAuthzCapsuleHeader(req: Request): string | null {
  const value = req.headers.get(ROMA_AUTHZ_CAPSULE_HEADER);
  if (!value) return null;
  const normalized = value.trim();
  return normalized || null;
}

export function readRomaAccountAuthzCapsuleHeader(req: Request): string | null {
  const value = req.headers.get(ROMA_ACCOUNT_CAPSULE_HEADER);
  if (!value) return null;
  const normalized = value.trim();
  return normalized || null;
}

export async function mintRomaWorkspaceAuthzCapsule(
  env: Env,
  input: SignableRomaWorkspaceAuthzCapsulePayload,
): Promise<{ token: string; payload: RomaWorkspaceAuthzCapsulePayload }> {
  const secret = resolveRomaAuthzCapsuleSecret(env);
  if (!secret) {
    throw new Error('[ParisWorker] Missing roma authz capsule secret');
  }

  const payload: RomaWorkspaceAuthzCapsulePayload = {
    ...input,
    v: 1,
    typ: 'roma.workspace',
    iss: 'paris',
    aud: 'roma',
  };

  const payloadBase64 = encodeJsonToBase64Url(payload);
  const signature = await hmacSha256Base64Url(secret, payloadBase64);
  return {
    token: `${ROMA_AUTHZ_CAPSULE_PREFIX}.${payloadBase64}.${signature}`,
    payload,
  };
}

function normalizeAccountPayload(
  raw: unknown,
  nowSec: number,
): RomaAccountAuthzCapsulePayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (record.typ !== 'roma.account') return null;
  if (record.iss !== 'paris') return null;
  if (record.aud !== 'roma') return null;

  const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
  const sub = typeof record.sub === 'string' ? record.sub.trim() : '';
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  const accountStatus = typeof record.accountStatus === 'string' ? record.accountStatus.trim() : '';
  const authzVersion = typeof record.authzVersion === 'string' ? record.authzVersion.trim() : '';
  const role = normalizeMemberRole(record.role);
  const profile = normalizeWorkspaceTier(record.profile);
  const iat = typeof record.iat === 'number' && Number.isFinite(record.iat) ? Math.trunc(record.iat) : Number.NaN;
  const exp = typeof record.exp === 'number' && Number.isFinite(record.exp) ? Math.trunc(record.exp) : Number.NaN;

  if (!userId || !sub || sub !== userId) return null;
  if (!accountId || !accountStatus || !authzVersion) return null;
  if (!role || !profile) return null;
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= nowSec) return null;
  if (iat > nowSec + ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC) return null;

  return {
    v: 1,
    typ: 'roma.account',
    iss: 'paris',
    aud: 'roma',
    sub,
    userId,
    accountId,
    accountStatus,
    profile,
    role,
    authzVersion,
    iat,
    exp,
  };
}

export async function mintRomaAccountAuthzCapsule(
  env: Env,
  input: SignableRomaAccountAuthzCapsulePayload,
): Promise<{ token: string; payload: RomaAccountAuthzCapsulePayload }> {
  const secret = resolveRomaAuthzCapsuleSecret(env);
  if (!secret) {
    throw new Error('[ParisWorker] Missing roma authz capsule secret');
  }

  const payload: RomaAccountAuthzCapsulePayload = {
    ...input,
    v: 1,
    typ: 'roma.account',
    iss: 'paris',
    aud: 'roma',
  };

  const payloadBase64 = encodeJsonToBase64Url(payload);
  const signature = await hmacSha256Base64Url(secret, payloadBase64);
  return {
    token: `${ROMA_ACCOUNT_CAPSULE_PREFIX}.${payloadBase64}.${signature}`,
    payload,
  };
}

export async function verifyRomaWorkspaceAuthzCapsule(
  env: Env,
  token: string,
): Promise<{ ok: true; payload: RomaWorkspaceAuthzCapsulePayload } | { ok: false; reason: string }> {
  const secret = resolveRomaAuthzCapsuleSecret(env);
  if (!secret) {
    return { ok: false, reason: 'secret_missing' };
  }

  const normalized = String(token || '').trim();
  const prefix = `${ROMA_AUTHZ_CAPSULE_PREFIX}.`;
  if (!normalized.startsWith(prefix)) {
    return { ok: false, reason: 'format_invalid' };
  }

  const remainder = normalized.slice(prefix.length);
  const dotIndex = remainder.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= remainder.length - 1) {
    return { ok: false, reason: 'format_invalid' };
  }
  const payloadBase64 = remainder.slice(0, dotIndex);
  const signature = remainder.slice(dotIndex + 1);
  if (!payloadBase64 || !signature) {
    return { ok: false, reason: 'format_invalid' };
  }

  const expected = await hmacSha256Base64Url(secret, payloadBase64);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'signature_invalid' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = normalizePayload(decodeJsonFromBase64Url<unknown>(payloadBase64), nowSec);
  if (!payload) {
    return { ok: false, reason: 'payload_invalid' };
  }

  return { ok: true, payload };
}

export async function verifyRomaAccountAuthzCapsule(
  env: Env,
  token: string,
): Promise<{ ok: true; payload: RomaAccountAuthzCapsulePayload } | { ok: false; reason: string }> {
  const secret = resolveRomaAuthzCapsuleSecret(env);
  if (!secret) {
    return { ok: false, reason: 'secret_missing' };
  }

  const normalized = String(token || '').trim();
  const prefix = `${ROMA_ACCOUNT_CAPSULE_PREFIX}.`;
  if (!normalized.startsWith(prefix)) {
    return { ok: false, reason: 'format_invalid' };
  }

  const remainder = normalized.slice(prefix.length);
  const dotIndex = remainder.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= remainder.length - 1) {
    return { ok: false, reason: 'format_invalid' };
  }
  const payloadBase64 = remainder.slice(0, dotIndex);
  const signature = remainder.slice(dotIndex + 1);
  if (!payloadBase64 || !signature) {
    return { ok: false, reason: 'format_invalid' };
  }

  const expected = await hmacSha256Base64Url(secret, payloadBase64);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, reason: 'signature_invalid' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = normalizeAccountPayload(decodeJsonFromBase64Url<unknown>(payloadBase64), nowSec);
  if (!payload) {
    return { ok: false, reason: 'payload_invalid' };
  }

  return { ok: true, payload };
}
