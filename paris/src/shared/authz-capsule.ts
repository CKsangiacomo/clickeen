import {
  mintRomaAccountAuthzCapsule as mintSharedRomaAccountAuthzCapsule,
  readRomaAuthzCapsuleHeader,
  verifyRomaAccountAuthzCapsule as verifySharedRomaAccountAuthzCapsule,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import type { Env } from './types';

function resolveRomaAuthzCapsuleSecret(env: Env): string {
  const explicit = (env.ROMA_AUTHZ_CAPSULE_SECRET || '').trim();
  if (explicit) return explicit;
  const aiFallback = (env.AI_GRANT_HMAC_SECRET || '').trim();
  if (aiFallback) return aiFallback;
  return (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export { readRomaAuthzCapsuleHeader, type RomaAccountAuthzCapsulePayload };

export async function mintRomaAccountAuthzCapsule(
  env: Env,
  input: Omit<RomaAccountAuthzCapsulePayload, 'v' | 'typ' | 'iss' | 'aud'>,
) {
  return mintSharedRomaAccountAuthzCapsule(resolveRomaAuthzCapsuleSecret(env), input);
}

export async function verifyRomaAccountAuthzCapsule(env: Env, token: string) {
  return verifySharedRomaAccountAuthzCapsule(resolveRomaAuthzCapsuleSecret(env), token);
}
