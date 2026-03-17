import { assertPolicyEntitlementsSnapshot, type PolicyEntitlementsSnapshot } from './policy';
import type { MemberRole, PolicyProfile } from './types';

export const ROMA_AUTHZ_CAPSULE_HEADER = 'x-ck-authz-capsule';

const ROMA_AUTHZ_CAPSULE_MAX_SKEW_SEC = 60;
const RS256_ALG = 'RSASSA-PKCS1-v1_5';

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
  entitlements?: PolicyEntitlementsSnapshot | null;
  profile: PolicyProfile;
  role: MemberRole;
  authzVersion: string;
  iat: number;
  exp: number;
};

type SignableRomaAccountAuthzCapsulePayload = Omit<RomaAccountAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>;
type RomaAccountAuthzCapsuleHeader = {
  alg: 'RS256';
  typ: 'JWT';
  kid: string;
};
export type RomaAccountAuthzCapsuleSigningContext = {
  kid: string;
  privateKey: CryptoKey;
};

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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  const cloned = new Uint8Array(bytes.byteLength);
  cloned.set(bytes);
  return cloned.buffer;
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
  let entitlements: PolicyEntitlementsSnapshot | null | undefined;
  try {
    entitlements =
      Object.prototype.hasOwnProperty.call(record, 'entitlements')
        ? assertPolicyEntitlementsSnapshot(record.entitlements)
        : undefined;
  } catch {
    return null;
  }
  const authzVersion = typeof record.authzVersion === 'string' ? record.authzVersion.trim() : '';
  const role = normalizeMemberRole(record.role);
  const profile = normalizePolicyProfile(record.profile);
  const iat = typeof record.iat === 'number' && Number.isFinite(record.iat) ? Math.trunc(record.iat) : Number.NaN;
  const exp = typeof record.exp === 'number' && Number.isFinite(record.exp) ? Math.trunc(record.exp) : Number.NaN;

  if (!userId || !sub || sub !== userId) return null;
  if (!accountId || !accountStatus || !accountName || !accountSlug || !authzVersion) return null;
  if (!role || !profile) return null;
  if (typeof entitlements === 'undefined') return null;
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
    ...(typeof entitlements === 'undefined' ? {} : { entitlements }),
    profile,
    role,
    authzVersion,
    iat,
    exp,
  };
}

export async function mintRomaAccountAuthzCapsule(
  signing: RomaAccountAuthzCapsuleSigningContext,
  input: SignableRomaAccountAuthzCapsulePayload,
): Promise<{ token: string; payload: RomaAccountAuthzCapsulePayload }> {
  const kid = String(signing.kid || '').trim();
  if (!kid || !(signing.privateKey instanceof CryptoKey)) {
    throw new Error('[ck-policy] Missing roma authz capsule signing context');
  }

  const payload: RomaAccountAuthzCapsulePayload = {
    ...input,
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
  };

  const header: RomaAccountAuthzCapsuleHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };
  const headerBase64 = encodeJsonToBase64Url(header);
  const payloadBase64 = encodeJsonToBase64Url(payload);
  const message = `${headerBase64}.${payloadBase64}`;
  const signature = await crypto.subtle.sign(RS256_ALG, signing.privateKey, new TextEncoder().encode(message));
  return {
    token: `${message}.${toBase64Url(new Uint8Array(signature))}`,
    payload,
  };
}

export async function verifyRomaAccountAuthzCapsule(
  args: {
    token: string;
    resolveVerifyKey: (kid: string) => Promise<CryptoKey | null>;
  },
): Promise<{ ok: true; payload: RomaAccountAuthzCapsulePayload } | { ok: false; reason: string }> {
  const normalized = String(args.token || '').trim();
  if (!normalized) {
    return { ok: false, reason: 'format_invalid' };
  }

  const parts = normalized.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'format_invalid' };
  }
  const [headerBase64, payloadBase64, signatureBase64] = parts;
  if (!headerBase64 || !payloadBase64 || !signatureBase64) {
    return { ok: false, reason: 'format_invalid' };
  }

  const header = decodeJsonFromBase64Url<RomaAccountAuthzCapsuleHeader | Record<string, unknown>>(headerBase64);
  const kid = header && typeof header === 'object' ? (typeof header.kid === 'string' ? header.kid.trim() : '') : '';
  const alg = header && typeof header === 'object' ? header.alg : null;
  const typ = header && typeof header === 'object' ? header.typ : null;
  if (!kid || alg !== 'RS256' || typ !== 'JWT') {
    return { ok: false, reason: 'header_invalid' };
  }

  let verifyKey: CryptoKey | null = null;
  try {
    verifyKey = await args.resolveVerifyKey(kid);
  } catch {
    return { ok: false, reason: 'verify_key_unavailable' };
  }
  if (!verifyKey) {
    return { ok: false, reason: 'unknown_kid' };
  }

  const signature = fromBase64Url(signatureBase64);
  if (!signature) {
    return { ok: false, reason: 'format_invalid' };
  }

  const verified = await crypto.subtle.verify(
    RS256_ALG,
    verifyKey,
    toArrayBuffer(signature),
    new TextEncoder().encode(`${headerBase64}.${payloadBase64}`),
  );
  if (!verified) {
    return { ok: false, reason: 'signature_invalid' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = normalizeAccountPayload(decodeJsonFromBase64Url<unknown>(payloadBase64), nowSec);
  if (!payload) {
    return { ok: false, reason: 'payload_invalid' };
  }

  return { ok: true, payload };
}
