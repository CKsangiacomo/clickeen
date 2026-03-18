import type { MemberRole, PolicyProfile } from '@clickeen/ck-policy';
import type { BerlinContactMethodsPayload } from './contact-methods';

type WorkspaceTier = Exclude<PolicyProfile, 'minibob'>;

type LifecycleNotice = {
  tierChangedAt: string | null;
  tierChangedFrom: WorkspaceTier | null;
  tierChangedTo: WorkspaceTier | null;
  tierDropDismissedAt: string | null;
  tierDropEmailSentAt: string | null;
};

export type BerlinUserPayload = {
  id: string;
  email: string | null;
  role: string | null;
};

export type BerlinUserProfilePayload = {
  userId: string;
  primaryEmail: string;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  primaryLanguage: string | null;
  country: string | null;
  timezone: string | null;
  contactMethods?: BerlinContactMethodsPayload;
};

export type BerlinIdentityPayload = {
  identityId: string;
  provider: string;
  providerSubject: string | null;
};

export type BerlinConnectorSummaryPayload = {
  linkedIdentities: BerlinIdentityPayload[];
  traits: {
    linkedProviders: string[];
  };
};

export type BerlinAccountContext = {
  accountId: string;
  role: MemberRole;
  name: string;
  slug: string;
  status: string;
  isPlatform: boolean;
  tier: WorkspaceTier;
  websiteUrl: string | null;
  membershipVersion: string | null;
  lifecycleNotice: LifecycleNotice;
  l10nLocales: unknown;
  l10nPolicy: unknown;
};

export type BerlinAccountMember = {
  userId: string;
  role: MemberRole;
  createdAt: string | null;
  profile: BerlinUserProfilePayload | null;
};

export type BerlinBootstrapPayload = {
  user: BerlinUserPayload;
  profile: BerlinUserProfilePayload;
  activeAccount: BerlinAccountContext;
  accounts: BerlinAccountContext[];
  defaults: {
    accountId: string | null;
  };
  connectors: BerlinConnectorSummaryPayload;
  authz: null | {
    accountCapsule: string;
    accountId: string;
    role: MemberRole;
    profile: WorkspaceTier;
    authzVersion: string;
    issuedAt: string;
    expiresAt: string;
    entitlements: {
      flags: Record<string, boolean>;
      caps: Record<string, number | null>;
      budgets: Record<string, { max: number | null; used?: number | null }>;
    };
  };
};

export type { WorkspaceTier };
