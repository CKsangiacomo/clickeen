import type { MemberRole, PolicyProfile } from '@clickeen/ck-policy';
import type { BerlinContactMethodsPayload } from '../identity/contact-methods';

type AccountTier = PolicyProfile;

type LifecycleNotice = {
  tierChangedAt: string | null;
  tierChangedFrom: AccountTier | null;
  tierChangedTo: AccountTier | null;
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
  accountPublicId: string;
  role: MemberRole;
  name: string;
  slug: string;
  status: string;
  isPlatform: boolean;
  tier: AccountTier;
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
  connectors: BerlinConnectorSummaryPayload;
  authz: null | {
    accountCapsule: string;
    accountId: string;
    accountPublicId: string;
    role: MemberRole;
    profile: AccountTier;
    authzVersion: string;
    issuedAt: string;
    expiresAt: string;
    entitlements: {
      flags: Record<string, boolean>;
      limits: Record<string, number | null>;
    };
  };
};

export type { AccountTier };
