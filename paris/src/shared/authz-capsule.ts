import {
  mintRomaAccountAuthzCapsule as mintSharedRomaAccountAuthzCapsule,
  readRomaAuthzCapsuleHeader,
  verifyRomaAccountAuthzCapsule as verifySharedRomaAccountAuthzCapsule,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import type { AccountTier, Env } from './types';

function resolveRomaAuthzCapsuleSecret(env: Env): string {
  const secret = (env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
  if (!secret) {
    throw new Error('[paris] Missing ROMA_AUTHZ_CAPSULE_SECRET');
  }
  return secret;
}

export { readRomaAuthzCapsuleHeader, type RomaAccountAuthzCapsulePayload };

export function normalizeAccountTier(value: unknown): AccountTier | null {
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

export async function mintRomaAccountAuthzCapsule(
  env: Env,
  input: Omit<RomaAccountAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>,
) {
  return mintSharedRomaAccountAuthzCapsule(resolveRomaAuthzCapsuleSecret(env), input);
}

export async function verifyRomaAccountAuthzCapsule(env: Env, token: string) {
  return verifySharedRomaAccountAuthzCapsule(resolveRomaAuthzCapsuleSecret(env), token);
}
