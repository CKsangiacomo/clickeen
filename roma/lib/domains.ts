export type RomaDomainKey =
  | 'home'
  | 'builder'
  | 'widgets'
  | 'templates'
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
  { key: 'home', label: 'Home', href: '/home', description: 'Workspace overview and quick actions.' },
  { key: 'widgets', label: 'Widgets', href: '/widgets', description: 'Create and manage widgets.' },
  { key: 'builder', label: 'Builder', href: '/builder', description: 'Edit widget instances in Bob.' },
  { key: 'templates', label: 'Templates', href: '/templates', description: 'Browse curated templates by widget.' },
  { key: 'assets', label: 'Assets', href: '/assets', description: 'Account library and usage mapping.' },
  { key: 'team', label: 'Team', href: '/team', description: 'Members and roles.' },
  { key: 'billing', label: 'Billing', href: '/billing', description: 'Plan and billing actions.' },
  { key: 'usage', label: 'Usage', href: '/usage', description: 'Quota and metering visibility.' },
  { key: 'ai', label: 'AI', href: '/ai', description: 'AI profile and limits.' },
  { key: 'settings', label: 'Settings', href: '/settings', description: 'App preferences and context.' },
] as const;

export const DEFAULT_HOME_ROUTE = '/home';
