export type RomaDomainKey =
  | 'home'
  | 'profile'
  | 'builder'
  | 'widgets'
  | 'pages'
  | 'assets'
  | 'team'
  | 'billing'
  | 'usage'
  | 'ai'
  | 'settings'
  | 'widgetDefaults';

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
  { key: 'pages', label: 'Pages', href: '/pages', description: 'Stack widget instances into pages.' },
  { key: 'builder', label: 'Builder', href: '/builder', description: 'Edit widget instances in Bob.' },
  { key: 'assets', label: 'Assets', href: '/assets', description: 'Account library and usage mapping.' },
  { key: 'team', label: 'Team', href: '/team', description: 'Members and roles.' },
  { key: 'billing', label: 'Billing', href: '/billing', description: 'Current plan; billing provider not connected.' },
  { key: 'usage', label: 'Usage', href: '/usage', description: 'Storage usage and quota snapshot.' },
  { key: 'ai', label: 'AI', href: '/ai', description: 'AI entitlement profile and limits.' },
  { key: 'settings', label: 'Settings', href: '/settings', description: 'Account languages, ownership, and final controls.' },
  { key: 'widgetDefaults', label: 'Widget Defaults', href: '/settings/widget-defaults', description: 'Account defaults for new widget instances.' },
] as const;

export const ROMA_MAIN_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'home',
  'widgets',
  'pages',
  'builder',
  'assets',
  'settings',
];

export const ROMA_SETTINGS_DOMAIN_KEYS: readonly RomaDomainKey[] = [
  'settings',
  'profile',
  'team',
  'billing',
  'usage',
  'ai',
  'widgetDefaults',
];

export const ROMA_MAIN_DOMAINS = ROMA_MAIN_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma main domain: ${key}`);
  return domain;
});

export const ROMA_SETTINGS_DOMAINS = ROMA_SETTINGS_DOMAIN_KEYS.map((key) => {
  const domain = ROMA_DOMAINS.find((entry) => entry.key === key);
  if (!domain) throw new Error(`missing Roma settings domain: ${key}`);
  return key === 'settings' ? { ...domain, label: 'Account' } : domain;
});

export const DEFAULT_HOME_ROUTE = '/home';
