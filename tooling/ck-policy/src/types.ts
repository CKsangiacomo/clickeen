export type WorkspaceTier = 'free' | 'tier1' | 'tier2' | 'tier3';
export type PolicyProfile = 'minibob' | WorkspaceTier;
export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

export type EntitlementKind = 'flag' | 'cap' | 'budget';

export type EntitlementsMatrix = {
  v: 1;
  tiers: PolicyProfile[];
  capabilities: Record<
    string,
    {
      kind: EntitlementKind;
      values: Record<PolicyProfile, boolean | number | null>;
    }
  >;
};

export type PolicyBudget = {
  max: number | null; // null = unlimited
  used: number;
};

export type Policy = {
  v: 1;
  profile: PolicyProfile;
  role: MemberRole;
  flags: Record<string, boolean>;
  caps: Record<string, number | null>; // null = unlimited
  budgets: Record<string, PolicyBudget>;
};
