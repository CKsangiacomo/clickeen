import { isRecord } from '@clickeen/ck-contracts';
import type { Policy, PolicyProfile } from './types';
import { FLAG_KEYS, PLAN_LIMIT_KEYS } from './registry';
import { getEntitlementsMatrix } from './matrix';

type ResolvePolicyArgs = {
  profile: PolicyProfile;
  role: Policy['role'];
};

export type PolicyEntitlementsSnapshot = {
  flags?: Record<string, boolean> | null;
  limits?: Record<string, number | null> | null;
};

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`[ck-policy] Invalid entitlements snapshot at ${path}.${key}`);
    }
  }
}

function createTotalPolicyBase(args: ResolvePolicyArgs): Policy {
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Policy['flags'];
  const limits = Object.fromEntries(PLAN_LIMIT_KEYS.map((k) => [k, 0])) as Policy['limits'];

  return {
    v: 1,
    profile: args.profile,
    role: args.role,
    flags,
    limits,
  };
}

export function resolvePolicy(args: ResolvePolicyArgs): Policy {
  const policy = createTotalPolicyBase(args);
  const matrix = getEntitlementsMatrix();

  const entitlements = matrix.entitlements;
  for (const [key, entry] of Object.entries(entitlements)) {
    const value = entry.values[args.profile];
    if (entry.kind === 'flag') {
      policy.flags[key] = Boolean(value);
    } else {
      policy.limits[key] = value as number | null;
    }
  }

  return policy;
}

export function assertPolicyEntitlementsSnapshot(
  value: unknown,
): PolicyEntitlementsSnapshot | null {
  if (value == null) return null;
  if (!isRecord(value)) {
    throw new Error('[ck-policy] Invalid entitlements snapshot');
  }

  assertAllowedKeys(value, ['flags', 'limits'], 'entitlements');

  const flagsRaw = value.flags;
  const limitsRaw = value.limits;

  const flags =
    typeof flagsRaw === 'undefined'
      ? undefined
      : (() => {
          if (flagsRaw == null) return null;
          if (!isRecord(flagsRaw)) {
            throw new Error('[ck-policy] Invalid entitlements snapshot at entitlements.flags');
          }
          assertAllowedKeys(flagsRaw, FLAG_KEYS, 'entitlements.flags');
          return Object.fromEntries(
            Object.entries(flagsRaw).map(([key, entry]) => {
              if (typeof entry !== 'boolean') {
                throw new Error(`[ck-policy] Invalid entitlements snapshot at entitlements.flags.${key}`);
              }
              return [key, entry];
            }),
          ) as Record<string, boolean>;
        })();

  const limits =
    typeof limitsRaw === 'undefined'
      ? undefined
      : (() => {
          if (limitsRaw == null) return null;
          if (!isRecord(limitsRaw)) {
            throw new Error('[ck-policy] Invalid entitlements snapshot at entitlements.limits');
          }
          assertAllowedKeys(limitsRaw, PLAN_LIMIT_KEYS, 'entitlements.limits');
          return Object.fromEntries(
            Object.entries(limitsRaw).map(([key, entry]) => {
              if (!(entry === null || (typeof entry === 'number' && Number.isFinite(entry)))) {
                throw new Error(`[ck-policy] Invalid entitlements snapshot at entitlements.limits.${key}`);
              }
              return [key, entry];
            }),
          ) as Record<string, number | null>;
        })();

  return {
    ...(typeof flags === 'undefined' ? {} : { flags }),
    ...(typeof limits === 'undefined' ? {} : { limits }),
  };
}

export function resolvePolicyFromEntitlementsSnapshot(
  args: ResolvePolicyArgs & { entitlements?: PolicyEntitlementsSnapshot | null }
): Policy {
  const policy = resolvePolicy(args);
  const entitlements = args.entitlements;
  if (!entitlements) return policy;

  for (const key of FLAG_KEYS) {
    const next = entitlements.flags?.[key];
    if (typeof next === 'boolean') {
      policy.flags[key] = next;
    }
  }

  for (const key of PLAN_LIMIT_KEYS) {
    const next = entitlements.limits?.[key];
    if (next === null || typeof next === 'number') {
      policy.limits[key] = next;
    }
  }

  return policy;
}

export function isPolicyEntitled(policy: Policy, key: string): boolean {
  if (key in policy.flags) {
    return policy.flags[key] === true;
  }
  if (key in policy.limits) {
    const value = policy.limits[key];
    return value == null || (Number.isFinite(value) && value > 0);
  }
  return false;
}
