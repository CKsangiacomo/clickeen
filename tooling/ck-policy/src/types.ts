import type { BudgetKey, CapKey, FlagKey } from './registry';

export type WorkspaceTier = 'free' | 'tier1' | 'tier2' | 'tier3';
export type PolicyProfile = 'devstudio' | 'minibob' | WorkspaceTier;
export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

export type PolicyBudget = {
  max: number | null; // null = unlimited
  used: number;
};

export type Policy = {
  v: 1;
  profile: PolicyProfile;
  role: MemberRole;
  flags: Record<FlagKey, boolean>;
  caps: Record<CapKey, number | null>; // null = unlimited
  budgets: Record<BudgetKey, PolicyBudget>;
};

