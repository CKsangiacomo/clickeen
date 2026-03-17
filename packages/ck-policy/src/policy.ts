import type { Policy, PolicyProfile } from './types';
import { BUDGET_KEYS, CAP_KEYS, FLAG_KEYS } from './registry';
import { getEntitlementsMatrix } from './matrix';

type ResolvePolicyArgs = {
  profile: PolicyProfile;
  role: Policy['role'];
};

export type PolicyEntitlementsSnapshot = {
  flags?: Record<string, boolean> | null;
  caps?: Record<string, number | null> | null;
  budgets?: Record<string, { max: number | null; used?: number | null } | null> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function assertFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[ck-policy] Invalid entitlements snapshot at ${path}`);
  }
  return value;
}

function assertNonNegativeInteger(value: unknown, path: string): number {
  const numeric = assertFiniteNumber(value, path);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throw new Error(`[ck-policy] Invalid entitlements snapshot at ${path}`);
  }
  return numeric;
}

function createTotalPolicyBase(args: ResolvePolicyArgs): Policy {
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Policy['flags'];
  const caps = Object.fromEntries(CAP_KEYS.map((k) => [k, 0])) as Policy['caps'];
  const budgets = Object.fromEntries(
    BUDGET_KEYS.map((k) => [k, { max: 0, used: 0 }])
  ) as Policy['budgets'];

  return {
    v: 1,
    profile: args.profile,
    role: args.role,
    flags,
    caps,
    budgets,
  };
}

export function resolvePolicy(args: ResolvePolicyArgs): Policy {
  const policy = createTotalPolicyBase(args);
  const matrix = getEntitlementsMatrix();

  const capabilities = matrix.capabilities;
  for (const [key, entry] of Object.entries(capabilities)) {
    const value = entry.values[args.profile];
    if (entry.kind === 'flag') {
      policy.flags[key] = Boolean(value);
    } else if (entry.kind === 'cap') {
      policy.caps[key] = value as number | null;
    } else {
      policy.budgets[key].max = value as number | null;
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

  assertAllowedKeys(value, ['flags', 'caps', 'budgets'], 'entitlements');

  const flagsRaw = value.flags;
  const capsRaw = value.caps;
  const budgetsRaw = value.budgets;

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

  const caps =
    typeof capsRaw === 'undefined'
      ? undefined
      : (() => {
          if (capsRaw == null) return null;
          if (!isRecord(capsRaw)) {
            throw new Error('[ck-policy] Invalid entitlements snapshot at entitlements.caps');
          }
          assertAllowedKeys(capsRaw, CAP_KEYS, 'entitlements.caps');
          return Object.fromEntries(
            Object.entries(capsRaw).map(([key, entry]) => {
              if (!(entry === null || (typeof entry === 'number' && Number.isFinite(entry)))) {
                throw new Error(`[ck-policy] Invalid entitlements snapshot at entitlements.caps.${key}`);
              }
              return [key, entry];
            }),
          ) as Record<string, number | null>;
        })();

  const budgets =
    typeof budgetsRaw === 'undefined'
      ? undefined
      : (() => {
          if (budgetsRaw == null) return null;
          if (!isRecord(budgetsRaw)) {
            throw new Error('[ck-policy] Invalid entitlements snapshot at entitlements.budgets');
          }
          assertAllowedKeys(budgetsRaw, BUDGET_KEYS, 'entitlements.budgets');
          return Object.fromEntries(
            Object.entries(budgetsRaw).map(([key, entry]) => {
              if (!isRecord(entry)) {
                throw new Error(`[ck-policy] Invalid entitlements snapshot at entitlements.budgets.${key}`);
              }
              assertAllowedKeys(entry, ['max', 'used'], `entitlements.budgets.${key}`);
              const max =
                entry.max === null || typeof entry.max === 'undefined'
                  ? entry.max ?? null
                  : assertFiniteNumber(entry.max, `entitlements.budgets.${key}.max`);
              const used =
                typeof entry.used === 'undefined' || entry.used === null
                  ? undefined
                  : assertNonNegativeInteger(entry.used, `entitlements.budgets.${key}.used`);
              return [key, typeof used === 'undefined' ? { max } : { max, used }];
            }),
          ) as Record<string, { max: number | null; used?: number | null }>;
        })();

  return {
    ...(typeof flags === 'undefined' ? {} : { flags }),
    ...(typeof caps === 'undefined' ? {} : { caps }),
    ...(typeof budgets === 'undefined' ? {} : { budgets }),
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

  for (const key of CAP_KEYS) {
    const next = entitlements.caps?.[key];
    if (next === null || typeof next === 'number') {
      policy.caps[key] = next;
    }
  }

  for (const key of BUDGET_KEYS) {
    const next = entitlements.budgets?.[key];
    if (!next) continue;
    if (next.max === null || typeof next.max === 'number') {
      policy.budgets[key].max = next.max;
    }
    if (typeof next.used === 'number' && Number.isFinite(next.used)) {
      policy.budgets[key].used = Math.max(0, Math.trunc(next.used));
    }
  }

  return policy;
}
