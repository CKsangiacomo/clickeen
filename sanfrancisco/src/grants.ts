import type { AIGrant } from './types';
import { HttpError, asNumber, asString, isRecord } from './http';

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function verifyGrant(grant: string, secret: string): Promise<AIGrant> {
  const parts = grant.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant format' });
  }

  const payloadB64 = parts[1];
  const sigB64 = parts[2];

  let payload: unknown;
  try {
    const jsonText = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(jsonText);
  } catch {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant payload' });
  }

  if (!isRecord(payload)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Invalid grant payload' });

  const v = asNumber(payload.v);
  const iss = asString(payload.iss);
  const exp = asNumber(payload.exp);
  const caps = Array.isArray(payload.caps) && payload.caps.every((c) => typeof c === 'string') ? payload.caps : null;
  const budgets = isRecord(payload.budgets) ? payload.budgets : null;
  const mode = asString(payload.mode);
  const sub = isRecord(payload.sub) ? payload.sub : null;

  if (v !== 1 || iss !== 'paris' || exp === null || !caps || !budgets || !sub || (mode !== 'editor' && mode !== 'ops')) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant missing required fields' });
  }

  const subKind = asString(sub.kind);
  if (subKind === 'anon') {
    if (!asString(sub.sessionId)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing sessionId' });
  } else if (subKind === 'user') {
    if (!asString(sub.userId) || !asString(sub.workspaceId)) {
      throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing userId/workspaceId' });
    }
  } else if (subKind === 'service') {
    if (!asString(sub.serviceId)) throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject missing serviceId' });
  } else {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant subject kind is invalid' });
  }

  const expectedSig = await hmacSha256(secret, `v1.${payloadB64}`);
  const providedSig = base64UrlToBytes(sigB64);
  if (!timingSafeEqual(expectedSig, providedSig)) {
    throw new HttpError(401, { code: 'GRANT_INVALID', message: 'Grant signature mismatch' });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (exp <= nowSec) throw new HttpError(401, { code: 'GRANT_EXPIRED', message: 'Grant expired' });

  return payload as AIGrant;
}

export function assertCap(grant: AIGrant, capability: string): void {
  if (!grant.caps.includes(capability)) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Capability denied: ${capability}` });
  }
}

export function getGrantMaxTokens(grant: AIGrant): number {
  const maxTokens = (grant.budgets as any).maxTokens;
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.maxTokens must be a positive number' });
  }
  return maxTokens;
}

export function getGrantTimeoutMs(grant: AIGrant): number {
  const timeoutMs = (grant.budgets as any).timeoutMs;
  if (timeoutMs === undefined) return 20_000;
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new HttpError(400, { code: 'GRANT_INVALID', message: 'Grant budgets.timeoutMs must be a positive number' });
  }
  return timeoutMs;
}
