import type { PolicyEntitlementsSnapshot } from './policy';
import type { MemberRole, PolicyProfile } from './types';

export const ROMA_AUTHZ_CAPSULE_HEADER = 'x-ck-authz-capsule';

const ROMA_AUTHZ_CAPSULE_PREFIX = 'ckac.v1';
const ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC = 60;

export type RomaAccountAuthzCapsulePayload = {
  v: 1;
  typ: 'roma.account';
  iss: 'berlin';
  aud: 'roma';
  sub: string;
  userId: string;
  accountId: string;
  accountStatus: string;
  accountIsPlatform: boolean;
  accountName: string;
  accountSlug: string;
  accountWebsiteUrl: string | null;
  accountL10nLocales?: unknown;
  accountL10nPolicy?: unknown;
  entitlements?: PolicyEntitlementsSnapshot | null;
  profile: PolicyProfile;
  role: MemberRole;
  authzVersion: string;
  iat: number;
  exp: number;
};

type SignableRomaAccountAuthzCapsulePayload = Omit<RomaAccountAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>;

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

function normalizePolicyProfile(value: unknown): PolicyProfile | null {
  switch (value) {
    case 'minibob':
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEntitlementsSnapshot(value: unknown): PolicyEntitlementsSnapshot | null {
  if (!isPlainRecord(value)) return null;

  const flags: Record<string, boolean> | null = isPlainRecord(value.flags)
    ? Object.entries(value.flags).reduce<Record<string, boolean>>((out, [key, entry]) => {
        if (typeof entry === 'boolean') out[key] = entry;
        return out;
      }, {})
    : null;

  const caps: Record<string, number | null> | null = isPlainRecord(value.caps)
    ? Object.entries(value.caps).reduce<Record<string, number | null>>((out, [key, entry]) => {
        if (entry === null || (typeof entry === 'number' && Number.isFinite(entry))) {
          out[key] = entry;
        }
        return out;
      }, {})
    : null;

  const budgets: Record<string, { max: number | null; used: number }> | null = isPlainRecord(value.budgets)
    ? Object.fromEntries(
        Object.entries(value.budgets).flatMap(([key, entry]) => {
          if (!isPlainRecord(entry)) return [];
          const max = entry.max;
          const used = entry.used;
          if (
            !(max === null || (typeof max === 'number' && Number.isFinite(max))) ||
            !(typeof used === 'number' && Number.isFinite(used))
          ) {
            return [];
          }
          return [[key, { max, used: Math.max(0, Math.trunc(used)) }]];
        }),
      )
    : null;

  if (!flags && !caps && !budgets) return null;
  return { ...(flags ? { flags } : {}), ...(caps ? { caps } : {}), ...(budgets ? { budgets } : {}) };
}

export function readRomaAuthzCapsuleHeader(req: Request): string | null {
  const value = req.headers.get(ROMA_AUTHZ_CAPSULE_HEADER);
  if (!value) return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeAccountPayload(
  raw: unknown,
  nowSec: number,
): RomaAccountAuthzCapsulePayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (record.typ !== 'roma.account') return null;
  if (record.iss !== 'berlin') return null;
  if (record.aud !== 'roma') return null;

  const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
  const sub = typeof record.sub === 'string' ? record.sub.trim() : '';
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  const accountStatus = typeof record.accountStatus === 'string' ? record.accountStatus.trim() : '';
  const accountIsPlatform = typeof record.accountIsPlatform === 'boolean' ? record.accountIsPlatform : false;
  const accountName = typeof record.accountName === 'string' ? record.accountName.trim() : '';
  const accountSlug = typeof record.accountSlug === 'string' ? record.accountSlug.trim() : '';
  const accountWebsiteUrlRaw = typeof record.accountWebsiteUrl === 'string' ? record.accountWebsiteUrl.trim() : '';
  const accountL10nLocales = record.accountL10nLocales;
  const accountL10nPolicy = record.accountL10nPolicy;
  const entitlements = normalizeEntitlementsSnapshot(record.entitlements);
  const authzVersion = typeof record.authzVersion === 'string' ? record.authzVersion.trim() : '';
  const role = normalizeMemberRole(record.role);
  const profile = normalizePolicyProfile(record.profile);
  const iat = typeof record.iat === 'number' && Number.isFinite(record.iat) ? Math.trunc(record.iat) : Number.NaN;
  const exp = typeof record.exp === 'number' && Number.isFinite(record.exp) ? Math.trunc(record.exp) : Number.NaN;

  if (!userId || !sub || sub !== userId) return null;
  if (!accountId || !accountStatus || !accountName || !accountSlug || !authzVersion) return null;
  if (!role || !profile) return null;
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= nowSec) return null;
  if (iat > nowSec + ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC) return null;

  return {
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub,
    userId,
    accountId,
    accountStatus,
    accountIsPlatform,
    accountName,
    accountSlug,
    accountWebsiteUrl: accountWebsiteUrlRaw || null,
    accountL10nLocales,
    accountL10nPolicy,
    entitlements,
    profile,
    role,
    authzVersion,
    iat,
    exp,
  };
}

export async function mintRomaAccountAuthzCapsule(
  secret: string,
  input: SignableRomaAccountAuthzCapsulePayload,
): Promise<{ token: string; payload: RomaAccountAuthzCapsulePayload }> {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) {
    throw new Error('[ck-policy] Missing roma authz capsule secret');
  }

  const payload: RomaAccountAuthzCapsulePayload = {
    ...input,
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
  };

  const payloadBase64 = encodeJsonToBase64Url(payload);
  const signature = await hmacSha256Base64Url(normalizedSecret, payloadBase64);
  return {
    token: `${ROMA_AUTHZ_CAPSULE_PREFIX}.${payloadBase64}.${signature}`,
    payload,
  };
}

export async function verifyRomaAccountAuthzCapsule(
  secret: string,
  token: string,
): Promise<{ ok: true; payload: RomaAccountAuthzCapsulePayload } | { ok: false; reason: string }> {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) {
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

  const expected = await hmacSha256Base64Url(normalizedSecret, payloadBase64);
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
