export type AccountTier = 'free' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
export type PolicyProfile = AccountTier;
export type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

export type EntitlementKind = 'flag' | 'limit';

export type EntitlementsMatrix = {
  v: 1;
  tiers: PolicyProfile[];
  entitlements: Record<
    string,
    {
      kind: EntitlementKind;
      values: Record<PolicyProfile, boolean | number | null>;
    }
  >;
};

export type Policy = {
  v: 1;
  profile: PolicyProfile;
  role: MemberRole;
  flags: Record<string, boolean>;
  limits: Record<string, number | null>; // null = unlimited
};
