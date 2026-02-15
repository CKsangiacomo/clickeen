export type RomaModuleKey =
  | 'home'
  | 'builder'
  | 'instances'
  | 'assets'
  | 'team'
  | 'billing'
  | 'usage'
  | 'ai'
  | 'settings';

export type RomaModuleDefinition = {
  key: RomaModuleKey;
  label: string;
  href: string;
  description: string;
};

export const ROMA_MODULES: readonly RomaModuleDefinition[] = [
  { key: 'home', label: 'Home', href: '/home', description: 'Account and workspace overview.' },
  { key: 'builder', label: 'Builder', href: '/builder', description: 'Bob module mount and edit lifecycle.' },
  { key: 'instances', label: 'Instances', href: '/instances', description: 'Create, duplicate, publish, and archive instances.' },
  { key: 'assets', label: 'Assets', href: '/assets', description: 'Account library and usage mapping.' },
  { key: 'team', label: 'Team', href: '/team', description: 'Members, invites, and role controls.' },
  { key: 'billing', label: 'Billing', href: '/billing', description: 'Plan, checkout, portal, and subscription state.' },
  { key: 'usage', label: 'Usage', href: '/usage', description: 'Quota diagnostics and metering visibility.' },
  { key: 'ai', label: 'AI', href: '/ai', description: 'Policy profile and AI outcome visibility.' },
  { key: 'settings', label: 'Settings', href: '/settings', description: 'Account and workspace configuration.' }
] as const;

export const DEFAULT_HOME_ROUTE = '/home';
