import type { Policy, PolicyProfile } from './types';
import { BUDGET_KEYS, CAP_KEYS, FLAG_KEYS } from './registry';
import { getEntitlementsMatrix } from './matrix';

type ResolvePolicyArgs = {
  profile: PolicyProfile;
  role: Policy['role'];
};

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
