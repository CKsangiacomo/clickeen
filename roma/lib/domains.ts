export type RomaDomainKey =
  | 'home'
  | 'profile'
  | 'builder'
  | 'widgets'
  | 'assets'
  | 'team'
  | 'billing'
  | 'usage'
  | 'ai'
  | 'settings';

export type RomaDomainDefinition = {
  key: RomaDomainKey;
  label: string;
  href: string;
  description: string;
};

export const ROMA_DOMAINS: readonly RomaDomainDefinition[] = [
  { key: 'home', label: 'Home', href: '/home', description: 'Account overview and quick actions.' },
  { key: 'profile', label: 'User Settings', href: '/profile', description: 'Person-scoped settings for the signed-in user.' },
  { key: 'widgets', label: 'Widgets', href: '/widgets', description: 'Manage account-owned instances.' },
  { key: 'builder', label: 'Builder', href: '/builder', description: 'Edit widget instances in Bob.' },
  { key: 'assets', label: 'Assets', href: '/assets', description: 'Account library and usage mapping.' },
  { key: 'team', label: 'Team', href: '/team', description: 'Members and roles.' },
  { key: 'billing', label: 'Billing', href: '/billing', description: 'Current plan; billing provider not connected.' },
  { key: 'usage', label: 'Usage', href: '/usage', description: 'Storage usage and quota snapshot.' },
  { key: 'ai', label: 'AI', href: '/ai', description: 'AI entitlement profile and limits.' },
  { key: 'settings', label: 'Settings', href: '/settings', description: 'Account languages, ownership, and final controls.' },
] as const;

export const DEFAULT_HOME_ROUTE = '/home';
